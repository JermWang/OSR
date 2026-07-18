import { NextResponse } from 'next/server';
import { requireAuthenticatedWallet } from '@/lib/api-util';
import { GameError, claimRewards, settleUser } from '@/lib/game';
import { issueClaimVoucher, settleClaim } from '@/lib/settlement';
import { CLAIM_FEE_BPS } from '@/lib/economy';

export const dynamic = 'force-dynamic';

/**
 * Claiming pays OSR out of the vault, so it runs the opposite way to the
 * priced actions:
 *
 *   quote   compute the claimable net, issue a Vault ClaimVoucher
 *   settle  verify the on-chain Claimed event, then zero the accrual
 *
 * The accrual is deliberately NOT deducted at quote time. If it were and the
 * operator never redeemed, the OSR would simply vanish. Deducting only after a
 * verified redemption means an unredeemed voucher costs them nothing, and
 * issueClaimVoucher allows just one outstanding voucher per wallet so the
 * overlap can't be redeemed twice.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const wallet = await requireAuthenticatedWallet(request, body.wallet);

    const nonce = typeof body.nonce === 'string' ? body.nonce : null;
    const txHash = typeof body.txHash === 'string' ? body.txHash : null;

    if (nonce && txHash) {
      const result = await settleClaim(wallet, nonce, txHash, () =>
        // Real tokens already left the vault, so skip the mirrored credit.
        claimRewards(wallet, undefined, 'claim', { settledOnChain: true })
      );
      return NextResponse.json({ settled: true, result });
    }
    if (nonce || txHash) {
      throw new GameError('both nonce and txHash are required to settle', 400);
    }

    // Quote: sum what is claimable right now, net of the claim fee.
    const { nodes } = settleUser(wallet);
    const gross = nodes.reduce((sum, n) => sum + n.pendingOsr, 0);
    if (gross <= 0) throw new GameError('nothing to claim yet');
    const net = gross - (gross * CLAIM_FEE_BPS) / 10_000;

    const voucher = await issueClaimVoucher(wallet, net);
    return NextResponse.json({ settled: false, voucher, gross, net });
  } catch (e) {
    if (e instanceof GameError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[claim]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
