import { NextResponse } from 'next/server';
import { requireAuthenticatedWallet } from '@/lib/api-util';
import { GameError, getOrCreateUser } from '@/lib/game';
import { getDb } from '@/lib/db';
import { splitSale, transferSoldItem } from '@/lib/market';
import {
  SETTLEMENT_CONFIGURED,
  encodeDetail,
  payoutOsr,
  quoteSpend,
  recordPayout,
  settleSpend,
} from '@/lib/settlement';

export const dynamic = 'force-dynamic';

/**
 * Buy a listed item.
 *
 * The buyer pays the full price to the protocol treasury, the item moves, and
 * the protocol forwards the seller their share less the marketplace fee. Paying
 * the treasury rather than the seller directly is what makes the payment
 * verifiable with the same receipt check every other action uses — a direct
 * buyer-to-seller transfer would have to be trusted from the client.
 *
 * Ordering mirrors claims: the item transfers first, then the seller is paid.
 * The reverse would let a failed transfer leave a seller paid for an item they
 * still own. A failed payout is recorded as owed rather than dropped.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const wallet = await requireAuthenticatedWallet(request, body.wallet);

    const listingId = Number(body.listingId);
    if (!Number.isInteger(listingId) || listingId <= 0) {
      throw new GameError('listingId is required', 400);
    }

    const listing = getDb()
      .prepare(`SELECT id, seller, price_osr, status FROM listings WHERE id = ?`)
      .get(listingId) as
      | { id: number; seller: string; price_osr: number; status: string }
      | undefined;
    if (!listing) throw new GameError('listing not found', 404);
    if (listing.status !== 'open') throw new GameError('that listing is no longer available', 409);
    if (listing.seller === wallet) throw new GameError('you cannot buy your own listing', 400);

    const { fee, toSeller } = splitSale(listing.price_osr);

    // Pre-token: no chain to settle against, so the mirrored balances move.
    if (!SETTLEMENT_CONFIGURED) {
      const db = getDb();
      const buyer = getOrCreateUser(wallet);
      if (buyer.osr_balance < listing.price_osr) {
        throw new GameError(
          `Not enough OSR: need ${listing.price_osr.toLocaleString()} (you have ${Math.floor(buyer.osr_balance).toLocaleString()}).`,
          400
        );
      }
      getOrCreateUser(listing.seller);
      const sold = transferSoldItem(listingId, wallet);
      db.prepare('UPDATE users SET osr_balance = osr_balance - ? WHERE wallet = ?').run(
        listing.price_osr,
        wallet
      );
      db.prepare('UPDATE users SET osr_balance = osr_balance + ? WHERE wallet = ?').run(
        toSeller,
        listing.seller
      );
      return NextResponse.json({ settled: true, result: { listing: sold, paid: listing.price_osr, fee } });
    }

    const nonce = typeof body.nonce === 'string' ? body.nonce : null;
    const txHash = typeof body.txHash === 'string' ? body.txHash : null;

    // Phase 2 — the buyer's payment is on-chain; verify it, move the item, pay out.
    if (nonce && txHash) {
      const sold = await settleSpend(wallet, nonce, txHash, () =>
        transferSoldItem(listingId, wallet)
      );
      let payoutHash: string | null = null;
      try {
        const payout = await payoutOsr(listing.seller, toSeller);
        payoutHash = payout.hash;
        recordPayout(listing.seller, payout.sentOsr, payout.hash, { listingId });
      } catch (payoutError) {
        // Null, not a placeholder string: the unique index on tx_hash is
        // partial, so a literal would insert once then collide on every later
        // failed payout — precisely when the debt most needs recording.
        recordPayout(listing.seller, toSeller, null, {
          listingId,
          error: String(payoutError),
        });
        console.error('[market/buy] seller payout failed after item transferred', payoutError);
      }
      return NextResponse.json({
        settled: true,
        result: {
          listing: sold,
          fee,
          toSeller,
          payoutHash,
          // Surfaced so the buyer is not told the sale is clean when the
          // seller has not actually been paid yet.
          sellerPaid: payoutHash != null,
        },
      });
    }
    if (nonce || txHash) throw new GameError('both nonce and txHash are required to settle', 400);

    // Phase 1 — quote the purchase. The whole price goes to the treasury; none
    // of it is burned, since this is a transfer between players rather than a
    // protocol sink.
    const payment = await quoteSpend(wallet, {
      action: 'MarketBuy',
      detail: encodeDetail(String(listingId)),
      osrAmount: listing.price_osr,
    });
    return NextResponse.json({ settled: false, payment, fee, toSeller });
  } catch (e) {
    if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[market/buy]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
