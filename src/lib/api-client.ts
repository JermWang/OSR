'use client';

// Client for the local game API (same-origin Next.js route handlers).

export interface NodeInfo {
  id: string;
  type: 'oil' | 'mine';
  level: number;
  productionRate: number;
  isActive: boolean;
  totalProduced: number;
  createdAt: string;
  layoutSeed: number;
  components: Array<{ slot: string; rarity: string; durability?: number }>;
  componentMultiplier: number;
  pendingOsr: number;
  storageCap: number;
  nextLevelCost: number;
}

export interface CompoundInfo {
  level: number;
  maxNodes: number;
  shaftBonusSlots: number;
  cratesPerDay: number;
  crateCost: number;
  cooldownRemainingMs: number;
  nextUpgradeCost: null | {
    targetLevel: number;
    totalOsr: number;
    solLamports: number;
    burnOsr: number;
    reserveOsr: number;
    treasuryOsr: number;
  };
}

export interface UserOperation {
  level: number;
  maxNodes: number;
  shaftBonusSlots: number;
  productionRate: number;
  growPower: number;
  networkGrowPower: number;
  joinedAtMs: number | null;
  welcomeBoostFactor: number;
  osrBalance: number;
  totalProduced: number;
  totals: Record<string, number>;
  pending: Record<string, number>;
  claimCooldownRemainingMs: number;
  crateCooldown: { rigCratesRemaining: number; shaftCratesRemaining: number };
  compound: CompoundInfo;
  nodes: NodeInfo[];
}

export interface ProtocolOverview {
  networkProductionRate: number;
  totalNodes: number;
  totalOilRigs: number;
  totalMiningShafts: number;
  totalSupply: number;
  totalOsrBurned: number;
  totalCreatorRewardsProcessed: number;
  osrReserveBalance: number;
  xomxReserveBalance: number;
  cvxxReserveBalance: number;
  treasury: number;
  genesisMs: number;
  halving: {
    cycleIndex: number;
    nextHalvingMs: number;
    currentRatePerSec: number;
    nextRatePerSec: number;
    cycleProgress: number;
  };
}

export interface CrateResult {
  inventoryItemId: number;
  slot: string;
  rarity: string;
  isUpgrade: boolean;
  previousRarity?: string;
  pityTriggered: 'legendary' | 'mythic' | 'divine' | null;
}

export interface InventoryItem {
  id: number;
  slot: string;
  family: 'oil' | 'mine';
  nodeType: 'oil' | 'mine';
  rarity: string;
  equippedNodeId: number | null;
  createdAt: number;
  durability: number;
  multiplier: number;
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  return res.json();
}

const idem = () => `idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const api = {
  operation: (wallet: string) => request<UserOperation>(`/user/${wallet}/operation`),
  overview: () => request<ProtocolOverview>('/protocol/overview'),
  reserves: () =>
    request<Array<{ walletLabel: string; walletAddress: string; assetSymbol: string; balanceUi: number }>>(
      '/protocol/reserves'
    ),
  snapshots: () =>
    request<{ genesisMs: number; now: number; currentRatePerSec: number; points: Array<{ t: number; ratePerSec: number; distributedPct: number }> }>(
      '/protocol/snapshots'
    ),
  treasuryEvents: (limit = 100) =>
    request<Array<{ id: number; createdAt: number; eventType: string; walletLabel: string; amount: number; assetSymbol: string; meta: Record<string, unknown> | null }>>(
      `/protocol/treasury-events?limit=${limit}`
    ),
  families: () =>
    request<Array<{ key: string; name: string; description: string; family: 'oil' | 'mine'; burnCostOsr: number; burnShareBps: number; treasuryShareBps: number; solMintFeeLamports: number }>>(
      '/nodes/families'
    ),
  crateOdds: (wallet?: string) =>
    request<{ level: number; odds: Array<{ rarity: string; chance: number }>; guarantees: { legendaryPlus: number; mythicPlus: number; divine: number }; pity?: { sinceLegendaryPlus: number; sinceMythicPlus: number; sinceDivine: number } }>(
      `/crates/odds${wallet ? `?wallet=${wallet}` : ''}`
    ),
  compound: (wallet: string) => request<CompoundInfo>(`/compound/${wallet}`),
  inventory: (wallet: string) => request<{ items: InventoryItem[] }>(`/user/${wallet}/inventory`),
  leaderboard: (metric = 'compound_level') =>
    request<Array<{ rank: number; wallet: string; compoundLevel: number; maxLevel: number; sumLevel: number; nodes: number; productionRate: number; totalProduced: number; totalBurned: number }>>(
      `/leaderboard?metric=${metric}`
    ),
  xstockPending: (wallet: string) => request<{ xomx: number; cvxx: number }>(`/xstock/pending/${wallet}`),

  mintNode: (wallet: string, familyKey: string) =>
    request<{ node: { id: number } }>('/nodes/mint', {
      method: 'POST',
      body: JSON.stringify({ wallet, familyKey, idempotencyKey: idem() }),
    }),
  upgradeNode: (wallet: string, nodeId: string | number) =>
    request<{ nodeId: number; level: number; cost: number }>('/nodes/upgrade', {
      method: 'POST',
      body: JSON.stringify({ wallet, nodeId, idempotencyKey: idem() }),
    }),
  claim: (wallet: string, nodeId?: string | number, mode: 'claim' | 'compound' = 'claim') =>
    request<{ claims: Array<{ nodeId: number; status: string; gross: number; fee: number; net: number; mode: string }> }>(
      '/rewards/claim',
      { method: 'POST', body: JSON.stringify({ wallet, nodeId, mode, idempotencyKey: idem() }) }
    ),
  openCrate: (wallet: string, crateType: 'rig_crate' | 'shaft_crate', targetNodeId?: string | number) =>
    request<CrateResult>('/crates/open', {
      method: 'POST',
      body: JSON.stringify({ wallet, crateType, targetNodeId, idempotencyKey: idem() }),
    }),
  upgradeCompound: (wallet: string) =>
    request<{ compound: { level: number; maxNodes: number; cratesPerDay: number } }>('/compound/upgrade', {
      method: 'POST',
      body: JSON.stringify({ wallet, idempotencyKey: idem() }),
    }),
  expediteCompound: (wallet: string) =>
    request<{ compound: { level: number; maxNodes: number; cratesPerDay: number } }>('/compound/expedite', {
      method: 'POST',
      body: JSON.stringify({ wallet, idempotencyKey: idem() }),
    }),
  equip: (wallet: string, inventoryItemId: number, targetNodeId: string | number) =>
    request<{ ok: boolean; slot: string }>('/components/equip', {
      method: 'POST',
      body: JSON.stringify({ wallet, inventoryItemId, targetNodeId, idempotencyKey: idem() }),
    }),
  unequip: (wallet: string, nodeId: string | number, slot: string) =>
    request<{ ok: boolean }>('/components/unequip', {
      method: 'POST',
      body: JSON.stringify({ wallet, nodeId, slot, idempotencyKey: idem() }),
    }),
  xstockClaim: (wallet: string, assetSymbol: 'XOMX' | 'CVXX') =>
    request<{ ok: boolean; reason?: string; txSignature?: string; amount?: number }>('/xstock/claim', {
      method: 'POST',
      body: JSON.stringify({ wallet, assetSymbol, idempotencyKey: idem() }),
    }),
  testerTopup: (wallet: string) =>
    request<{ ok: boolean; reason?: string; granted?: number }>('/tester-topup', {
      method: 'POST',
      body: JSON.stringify({ wallet }),
    }),
};
