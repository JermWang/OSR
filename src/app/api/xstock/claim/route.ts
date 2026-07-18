import { handle } from '@/lib/api-util';
import { GameError } from '@/lib/game';

export const dynamic = 'force-dynamic';

/**
 * xStock dividends (XOMX / CVXX) settle against tokenised-equity contracts that
 * are not part of this deployment: XSTOCK_TOKEN addresses are unset and
 * AUTO_SWAP_ENABLED is false. Rather than pretend to settle, this endpoint
 * states plainly that the payout rail does not exist yet. Accrual continues to
 * be tracked off-chain and is readable via /api/xstock/pending.
 */
export async function POST() {
  return handle(() => {
    throw new GameError(
      'xStock dividend settlement is not available: the XOMX/CVXX payout contracts are not deployed. Accrued dividends remain recorded and claimable once they are.',
      503
    );
  });
}
