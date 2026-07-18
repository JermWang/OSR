import { handleSettlementRoute, requireString } from '@/lib/settle-route';
import { GameError, getOrCreateUser, openCrate } from '@/lib/game';
import { CRATE_FEE_ETH, SPLIT_BURN_BPS, SPLIT_RESERVE_BPS, getCrateCost } from '@/lib/economy';

export const dynamic = 'force-dynamic';

const TREASURY_BPS = 10_000 - SPLIT_BURN_BPS - SPLIT_RESERVE_BPS;

interface Params {
  crateType: 'rig_crate' | 'shaft_crate';
  targetNodeId: number | null;
}

export async function POST(request: Request) {
  return handleSettlementRoute<Params>(request, {
    action: 'OpenCrate',
    parse: (body) => {
      const crateType = requireString(body.crateType, 'crateType');
      if (crateType !== 'rig_crate' && crateType !== 'shaft_crate') {
        throw new GameError('crateType must be rig_crate or shaft_crate');
      }
      const raw = body.targetNodeId;
      const targetNodeId = raw == null ? null : Number(raw);
      if (targetNodeId != null && !Number.isInteger(targetNodeId)) {
        throw new GameError('targetNodeId must be an integer');
      }
      return { crateType, targetNodeId };
    },
    // Fits inside the 32-byte detail payload: "rig_crate:1234567890".
    encode: (p) => `${p.crateType}:${p.targetNodeId ?? 0}`,
    decode: (detail) => {
      const [crateType, id] = detail.split(':');
      const targetNodeId = Number(id);
      return {
        crateType: crateType as Params['crateType'],
        targetNodeId: targetNodeId > 0 ? targetNodeId : null,
      };
    },
    price: (wallet) => ({
      osrAmount: getCrateCost(getOrCreateUser(wallet).compound_level),
      burnBps: SPLIT_BURN_BPS,
      treasuryBps: TREASURY_BPS,
      feeEth: CRATE_FEE_ETH,
    }),
    apply: (wallet, p) => openCrate(wallet, p.crateType, p.targetNodeId, { settledOnChain: true }),
  });
}
