'use client';

// Client for the same-origin API. Privy tokens are attached automatically when
// managed wallet mode is configured, allowing the server to bind every write
// to the authenticated wallet owner.

import { getAccessToken, getIdentityToken } from '@privy-io/react-auth';
import { PRIVY_CONFIGURED } from './config';
import {
  submitPayment,
  type PaymentRequest,
  type StepHandler,
} from './settlement-client';

export type { SettlementStep, StepHandler } from './settlement-client';

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
    feeEth: number;
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
  emissionFactors: { simNetworkGp: number; shareCap: number };
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

export interface GlobalProfile {
  wallet: string;
  displayName: string | null;
  joinedAt: number;
  lastSeenAt: number;
  totalSessions: number;
  compoundLevel: number;
  nodeCount: number;
  maxNodeLevel: number;
  sumNodeLevels: number;
  productionRate: number;
  totalProduced: number;
  totalBurned: number;
  online: boolean;
}

export interface ActivityItem {
  id: number;
  wallet: string;
  eventType: string;
  source: 'app' | 'onchain';
  amount: number | null;
  assetSymbol: string | null;
  txHash: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const controller = opts?.signal ? null : new AbortController();
  const timeout = controller ? window.setTimeout(() => controller.abort(), 15_000) : null;
  let res: Response;
  try {
    let accessToken: string | null = null;
    let identityToken: string | null = null;
    if (PRIVY_CONFIGURED) {
      try {
        [accessToken, identityToken] = await Promise.all([getAccessToken(), getIdentityToken()]);
      } catch {
        // Public reads remain available before sign-in. Protected endpoints
        // still reject the request server-side when these headers are absent.
      }
    }
    res = await fetch(`/api${path}`, {
      ...opts,
      signal: opts?.signal ?? controller?.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(identityToken ? { 'privy-id-token': identityToken } : {}),
        ...(opts?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch (error) {
    if (controller?.signal.aborted) throw new Error('Request timed out');
    throw error;
  } finally {
    if (timeout != null) window.clearTimeout(timeout);
  }
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

// ---------------------------------------------------------------------------
// Settlement-backed actions
// ---------------------------------------------------------------------------

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

/**
 * Ask the server to settle, retrying while the receipt is still short of the
 * required confirmations. The server answers 425 in that window; anything else
 * is a real failure and propagates immediately.
 */
async function settleWithRetry<T>(
  path: string,
  wallet: string,
  nonce: string,
  txHash: string,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const ATTEMPTS = 12;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const res = await post<{ settled: boolean; result: T }>(path, {
        wallet,
        nonce,
        txHash,
        ...extra,
      });
      return res.result;
    } catch (e) {
      const awaiting = e instanceof Error && /awaiting confirmations/i.test(e.message);
      if (!awaiting || attempt === ATTEMPTS - 1) throw e;
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
  throw new Error('Settlement timed out waiting for confirmations');
}

/**
 * Full lifecycle for a priced action: quote, submit on-chain, then settle.
 *
 * The tx hash is the only thing carried from the client into the settle call,
 * and the server re-derives everything else from the receipt, so a tampered
 * client cannot talk itself into a state change it did not pay for.
 */
async function runAction<T>(
  path: string,
  wallet: string,
  params: Record<string, unknown>,
  onStep?: StepHandler
): Promise<T> {
  onStep?.('quoting');
  const quote = await post<{ settled: boolean; payment?: PaymentRequest; result?: T }>(path, {
    wallet,
    ...params,
  });
  // Settlement is not configured yet, so the server already applied the action
  // and there is nothing for the operator to pay.
  if (quote.settled || !quote.payment) return quote.result as T;

  const txHash = await submitPayment(quote.payment, onStep);
  onStep?.('settling');
  return settleWithRetry<T>(path, wallet, quote.payment.nonce, txHash, params);
}

export const api = {
  privySession: (wallet: string) =>
    request<{ authenticated: boolean; userId: string; wallet: string; walletType: string }>(
      '/auth/session',
      { method: 'POST', body: JSON.stringify({ wallet }) }
    ),
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
    request<Array<{ key: string; name: string; description: string; family: 'oil' | 'mine'; burnCostOsr: number; burnShareBps: number; treasuryShareBps: number; mintFeeEth: number }>>(
      '/nodes/families'
    ),
  crateOdds: (wallet?: string) =>
    request<{ level: number; odds: Array<{ rarity: string; chance: number }>; guarantees: { legendaryPlus: number; mythicPlus: number; divine: number }; pity?: { sinceLegendaryPlus: number; sinceMythicPlus: number; sinceDivine: number } }>(
      `/crates/odds${wallet ? `?wallet=${wallet}` : ''}`
    ),
  compound: (wallet: string) => request<CompoundInfo>(`/compound/${wallet}`),
  inventory: (wallet: string) => request<{ items: InventoryItem[] }>(`/user/${wallet}/inventory`),
  profile: (wallet: string) =>
    request<{ configured: boolean; profile: GlobalProfile | null; history: ActivityItem[] }>(
      `/profiles/${wallet}`
    ),
  leaderboard: (metric = 'compound_level') =>
    request<Array<{ rank: number; wallet: string; compoundLevel: number; maxLevel: number; sumLevel: number; nodes: number; productionRate: number; totalProduced: number; totalBurned: number }>>(
      `/leaderboard?metric=${metric}`
    ),
  xstockPending: (wallet: string) => request<{ xomx: number; cvxx: number }>(`/xstock/pending/${wallet}`),

  // Each of these quotes on the server, sends one on-chain transaction through
  // the connected wallet, and then settles. onStep lets the UI narrate a flow
  // that may involve an approval as well as the action itself.
  mintNode: (wallet: string, familyKey: string, onStep?: StepHandler) =>
    runAction<{ node: { id: number } }>('/nodes/mint', wallet, { familyKey }, onStep),

  upgradeNode: (wallet: string, nodeId: string | number, onStep?: StepHandler) =>
    runAction<{ nodeId: number; level: number; cost: number }>(
      '/nodes/upgrade',
      wallet,
      { nodeId: Number(nodeId) },
      onStep
    ),

  /**
   * The protocol pays the operator, so there is nothing for them to sign — one
   * request, and the server transfers OSR from the protocol wallet.
   */
  claim: async (
    wallet: string,
    nodeId?: string | number,
    mode: 'claim' | 'compound' = 'claim',
    onStep?: StepHandler
  ) => {
    type Claims = {
      claims: Array<{ nodeId: number; status: string; gross: number; fee: number; net: number; mode: string }>;
    };
    onStep?.('settling');
    const res = await post<{
      settled: boolean;
      result: Claims;
      txHash?: string;
      /** OSR withheld to cover the gas of the payout transaction. */
      gasOsr?: number;
    }>('/rewards/claim', {
      wallet,
      nodeId: nodeId == null ? undefined : Number(nodeId),
      mode,
    });
    return { ...res.result, txHash: res.txHash, gasOsr: res.gasOsr ?? 0 };
  },

  openCrate: (
    wallet: string,
    crateType: 'rig_crate' | 'shaft_crate',
    targetNodeId?: string | number,
    onStep?: StepHandler
  ) =>
    runAction<CrateResult>(
      '/crates/open',
      wallet,
      { crateType, targetNodeId: targetNodeId == null ? null : Number(targetNodeId) },
      onStep
    ),

  upgradeCompound: (wallet: string, onStep?: StepHandler) =>
    runAction<{ compound: { level: number; maxNodes: number; cratesPerDay: number } }>(
      '/compound/upgrade',
      wallet,
      {},
      onStep
    ),

  expediteCompound: (wallet: string, onStep?: StepHandler) =>
    runAction<{ compound: { level: number; maxNodes: number; cratesPerDay: number } }>(
      '/compound/expedite',
      wallet,
      {},
      onStep
    ),
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
};
