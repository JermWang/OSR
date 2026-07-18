import { handleSettlementRoute, requireNodeId } from '@/lib/settle-route';
import { GameError, nodeUpgradeCost, upgradeNode, userOperation } from '@/lib/game';
import { SPLIT_BURN_BPS, SPLIT_RESERVE_BPS } from '@/lib/economy';

export const dynamic = 'force-dynamic';

/** Treasury takes whatever the burn and reserve shares leave behind. */
const TREASURY_BPS = 10_000 - SPLIT_BURN_BPS - SPLIT_RESERVE_BPS;

export async function POST(request: Request) {
  return handleSettlementRoute<{ nodeId: number }>(request, {
    action: 'UpgradeNode',
    parse: (body) => ({ nodeId: requireNodeId(body.nodeId) }),
    encode: (p) => String(p.nodeId),
    decode: (detail) => ({ nodeId: Number(detail) }),
    price: (wallet, p) => {
      const node = userOperation(wallet).nodes.find((n) => Number(n.id) === p.nodeId);
      if (!node) throw new GameError('node not found', 404);
      return {
        osrAmount: nodeUpgradeCost(node.level),
        burnBps: SPLIT_BURN_BPS,
        treasuryBps: TREASURY_BPS,
        feeEth: 0,
      };
    },
    apply: (wallet, p, opts) => upgradeNode(wallet, p.nodeId, opts),
  });
}
