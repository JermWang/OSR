import { handle } from '@/lib/api-util';
import { protocolOverview } from '@/lib/game';
import { onchainTotalSupply } from '@/lib/onchain';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const overview = protocolOverview();
    // Once the token exists, its own totalSupply() is the only correct figure.
    // Flap mints at its default 1e9, but a launch can differ and the contract is
    // the authority, not our constant. Falls back silently when the token is
    // unconfigured or the RPC is unreachable.
    const onchain = await onchainTotalSupply();
    return onchain == null ? overview : { ...overview, totalSupply: onchain };
  });
}
