import { NextResponse } from 'next/server';
import { requireAuthenticatedWallet } from '@/lib/api-util';
import { GameError, claimRewards, settleUser } from '@/lib/game';
import { issueClaimVoucher, settleClaim } from '@/lib/settlement';
import { CLAIM_FEE_BPS, COMPOUND_REINVEST_FEE_BPS } from '@/lib/economy';

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

    const mode = body.mode === 'compound' ? 'compound' : 'claim';
    const nodeId = body.nodeId == null ? undefined : Number(body.nodeId);
    if (nodeId != null && !Number.isInteger(nodeId)) {
      throw new GameError('nodeId must be an integer');
    }

    if (nonce && txHash) {
      const result = await settleClaim(wallet, nonce, txHash, () =>
        claimRewards(wallet, nodeId, mode, { settledOnChain: true })
      );
      return NextResponse.json({ settled: true, result });
    }
    if (nonce || txHash) {
      throw new GameError('both nonce and txHash are required to settle', 400);
    }

    // Quote what is claimable right now, net of the mode's fee. Compound mode
    // applies only to mining shafts and charges the lower reinvest fee.
    const { nodes } = settleUser(wallet);
    const eligible = nodes
      .filter((n) => (nodeId == null ? true : n.row.id === nodeId))
      .filter((n) => (mode === 'compound' ? n.row.family === 'mine' : true));

    const gross = eligible.reduce((sum, n) => sum + n.pendingOsr, 0);
    if (gross <= 0) {
      throw new GameError(
        mode === 'compound' ? 'nothing to compound on a mining shaft yet' : 'nothing to claim yet'
      );
    }
    const feeBps = mode === 'compound' ? COMPOUND_REINVEST_FEE_BPS : CLAIM_FEE_BPS;
    const net = gross - (gross * feeBps) / 10_000;

    const voucher = await issueClaimVoucher(wallet, net);
    return NextResponse.json({ settled: false, voucher, gross, net, mode });
  } catch (e) {
    if (e instanceof GameError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[claim]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
