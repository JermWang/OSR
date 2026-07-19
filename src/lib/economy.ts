// OSR economy constants — matched to the original deployment's reverse-
// engineered tables (see README + guide page for the player-facing versions).

import type { Rarity } from './rarity';

export const RARITY_MULT: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.8,
  rare: 3,
  epic: 10,
  legendary: 50,
  mythic: 300,
  divine: 3000,
};

/** Per-component grow-power boost stack (Formula D). */
export const RARITY_BOOST: Record<Rarity, number> = {
  common: 1,
  uncommon: 1,
  rare: 1,
  epic: 1.05,
  legendary: 1.15,
  mythic: 1.4,
  divine: 2,
};

/** Base crate drop weights (percent). */
export const DROP_WEIGHTS: Record<Rarity, number> = {
  common: 47.9,
  uncommon: 25,
  rare: 15,
  epic: 8,
  legendary: 3,
  mythic: 1,
  divine: 0.1,
};

/** Rarity pools unlock with compound level. */
export const RARITY_UNLOCK_LEVEL: Partial<Record<Rarity, number>> = {
  legendary: 4,
  mythic: 6,
  divine: 8,
};

/** Bad-luck protection ("crates since" thresholds). */
export const PITY = {
  legendary: { soft: 20, hard: 30, rampMax: 4 },
  mythic: { soft: 100, hard: 150, rampMax: 4 },
  divine: { soft: null as number | null, hard: 1500, rampMax: 1 },
};

/** Compound level -> capacity + upgrade cost (cost = OSR to REACH this level). */
export const COMPOUND_LEVELS: Record<
  number,
  { maxNodes: number; cratesPerDay: number; osrUpgradeCost: number; feeEth: number }
> = {
  1: { maxNodes: 2, cratesPerDay: 3, osrUpgradeCost: 0, feeEth: 0 },
  2: { maxNodes: 3, cratesPerDay: 4, osrUpgradeCost: 500, feeEth: 0.00001 },
  3: { maxNodes: 3, cratesPerDay: 5, osrUpgradeCost: 1000, feeEth: 0.00001 },
  4: { maxNodes: 4, cratesPerDay: 6, osrUpgradeCost: 2000, feeEth: 0.00001 },
  5: { maxNodes: 4, cratesPerDay: 8, osrUpgradeCost: 4000, feeEth: 0.00001 },
  6: { maxNodes: 5, cratesPerDay: 10, osrUpgradeCost: 8000, feeEth: 0.00001 },
  7: { maxNodes: 5, cratesPerDay: 12, osrUpgradeCost: 15000, feeEth: 0.00001 },
  8: { maxNodes: 6, cratesPerDay: 15, osrUpgradeCost: 25000, feeEth: 0.00001 },
  9: { maxNodes: 7, cratesPerDay: 18, osrUpgradeCost: 40000, feeEth: 0.00001 },
  10: { maxNodes: 8, cratesPerDay: 20, osrUpgradeCost: 60000, feeEth: 0.00001 },
};
export const MAX_COMPOUND_LEVEL = 10;

/** Mining Shafts add bonus node slots at higher compound levels. */
export function getShaftBonusSlots(level: number): number {
  if (level >= 9) return 4;
  if (level >= 7) return 3;
  if (level >= 5) return 2;
  return 0;
}

/** Crate cost scales with compound level: 500 OSR at L1 -> 1625 at L10. */
export function getCrateCost(level: number): number {
  return Math.floor(500 * (1 + 0.25 * (level - 1)));
}

/** Node level -> production multiplier (L11+ extrapolates +0.6/level). */
export function levelMultiplier(level: number): number {
  const TABLE: Record<number, number> = {
    1: 1.0, 2: 1.25, 3: 1.55, 4: 1.9, 5: 2.3,
    6: 2.75, 7: 3.25, 8: 3.8, 9: 4.4, 10: 5.0,
  };
  if (level <= 10) return TABLE[Math.max(1, level)];
  return 5.0 + (level - 10) * 0.6;
}

// Fees & splits — protocol fees denominated in ETH (Robinhood Chain gas token).
export const CLAIM_FEE_BPS = 200; // 2% claim fee
export const CLAIM_COOLDOWN_MS = 3_600_000; // 1h per wallet
export const COMPOUND_REINVEST_FEE_BPS = 75; // 0.75% when compounding instead of claiming
export const MINT_FEE_ETH = 0.0002;
export const CRATE_FEE_ETH = 0.00002;
export const COMPOUND_FEE_ETH = 0.00001;
export const EXPEDITE_FEE_ETH = 0.005;
/** Mint OSR split. */
export const MINT_BURN_BPS = 7000;
export const MINT_TREASURY_BPS = 3000;
/** Upgrade & crate OSR split: burn / reserve / treasury. */
export const SPLIT_BURN_BPS = 5000;
export const SPLIT_RESERVE_BPS = 3000;
export const SPLIT_TREASURY_BPS = 2000;

// Node families
export interface NodeFamilyDef {
  key: 'oil_rig' | 'mine_shaft';
  name: string;
  description: string;
  family: 'oil' | 'mine';
  burnCostOsr: number;
  burnShareBps: number;
  treasuryShareBps: number;
  mintFeeEth: number;
}

export const NODE_FAMILIES: NodeFamilyDef[] = [
  {
    key: 'oil_rig',
    name: 'Oil Rig',
    description: 'Offshore platform on the water quadrant. Earns OSR, claim-only in v1 · unlocks xStock dividends at compound L5+.',
    family: 'oil',
    burnCostOsr: 1000,
    burnShareBps: MINT_BURN_BPS,
    treasuryShareBps: MINT_TREASURY_BPS,
    mintFeeEth: MINT_FEE_ETH,
  },
  {
    key: 'mine_shaft',
    name: 'Mining Shaft',
    description: 'Underground operation on the land quadrant. Earns OSR, compoundable at a reduced 0.75% fee · bonus node slots at L5/L7/L9.',
    family: 'mine',
    burnCostOsr: 750,
    burnShareBps: MINT_BURN_BPS,
    treasuryShareBps: MINT_TREASURY_BPS,
    mintFeeEth: MINT_FEE_ETH,
  },
];

// Emission — Bitcoin-style halving curve.
/**
 * Total OSR supply.
 *
 * Flap mints every launch at its default max supply of 1e9 with 18 decimals,
 * so that is the figure the app must agree with. Overridable because the true
 * number is whatever the deployed token reports: once NEXT_PUBLIC_OSR_TOKEN is
 * set, protocolOverview reads totalSupply() straight off the contract and this
 * constant becomes a fallback for the pre-launch period only.
 *
 * Emission is sized from this rather than hardcoded, so the schedule can never
 * promise more OSR than the reserve holds. See EMISSION_RESERVE below.
 */
export const TOTAL_SUPPLY = Number(
  process.env.NEXT_PUBLIC_OSR_TOTAL_SUPPLY ?? 1_000_000_000
);

export const HALVING_PERIOD_MS = 7 * 24 * 3600 * 1000; // halves weekly
export const SHARE_CAP = 0.3; // no user captures more than 30% of emission

/**
 * Share of total supply reserved to pay node rewards.
 *
 * On a Flap launch the full 1e9 is minted to the bonding curve; this slice is
 * acquired at genesis and held as the emission reserve, leaving the remainder
 * as public float. Rewards are the product here, so a dedicated rewards pool is
 * the allocation that actually has to exist.
 */
export const EMISSION_RESERVE_PCT = Number(
  process.env.NEXT_PUBLIC_OSR_EMISSION_RESERVE_PCT ?? 0.1
);

/** OSR set aside at genesis to fund every reward the protocol will ever pay. */
export const EMISSION_RESERVE = TOTAL_SUPPLY * EMISSION_RESERVE_PCT;

/**
 * Genesis emission rate, derived so the halving schedule spends exactly the
 * reserve and not a token more.
 *
 * A halving schedule's lifetime sum is rate * period * 2, so inverting it gives
 * the only rate that makes lifetime emission equal the reserve. Hardcoding the
 * rate instead is how the previous 262 OSR/sec ended up promising 316.9M
 * against a 229M supply — 38% more than could ever exist.
 */
export const GENESIS_RATE_PER_SEC = EMISSION_RESERVE / ((HALVING_PERIOD_MS / 1000) * 2);

/** Compact figure for display: 1000000000 -> 1B, 316915200 -> 316.9M. */
export function compactOsr(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  return Math.round(n).toLocaleString();
}

/**
 * Total OSR ever paid out as rewards, across every halving cycle.
 *
 * Equal to EMISSION_RESERVE by construction, since the genesis rate is derived
 * from it. Kept as its own name because the docs need to talk about the
 * schedule's lifetime output and the pool funding it as separate ideas.
 */
export const LIFETIME_EMISSION = GENESIS_RATE_PER_SEC * (HALVING_PERIOD_MS / 1000) * 2;

/** Supply left circulating on the curve once the reserve is set aside. */
export const PUBLIC_FLOAT = TOTAL_SUPPLY - EMISSION_RESERVE;

export const SUPPLY_LABEL = compactOsr(TOTAL_SUPPLY);
export const LIFETIME_EMISSION_LABEL = compactOsr(LIFETIME_EMISSION);
export const EMISSION_RESERVE_LABEL = compactOsr(EMISSION_RESERVE);
export const PUBLIC_FLOAT_LABEL = compactOsr(PUBLIC_FLOAT);
export const RESERVE_PCT_LABEL = `${Math.round(EMISSION_RESERVE_PCT * 100)}%`;
export const FLOAT_PCT_LABEL = `${Math.round((1 - EMISSION_RESERVE_PCT) * 100)}%`;

/**
 * The halving schedule as displayed text, derived from GENESIS_RATE_PER_SEC.
 *
 * Built rather than written out: these figures move whenever the reserve
 * percentage changes, and a hardcoded table silently goes stale the moment it
 * does (exactly how the old 229M supply figures drifted).
 */
export const HALVING_SCHEDULE_TEXT = [0, 7, 14, 30]
  .map((day) => {
    const rate = GENESIS_RATE_PER_SEC / Math.pow(2, day / 7);
    const emittedPct = Math.round((1 - Math.pow(0.5, day / 7)) * 100);
    const tail = day === 0 ? '' : `, ${emittedPct}% of lifetime emitted`;
    return `Day ${String(day).padStart(2)} : ${rate.toFixed(1).padStart(6)} OSR/sec  (${compactOsr(rate * 86400)}/day${tail})`;
  })
  .join('\n');

/** First-day emission, for the docs' summary line. */
export const DAY_ONE_EMISSION_LABEL = compactOsr(GENESIS_RATE_PER_SEC * 86400);

export function emissionRateAt(genesisMs: number, nowMs: number): number {
  const cycle = Math.max(0, Math.floor((nowMs - genesisMs) / HALVING_PERIOD_MS));
  return GENESIS_RATE_PER_SEC / 2 ** cycle;
}

export function halvingInfo(genesisMs: number, nowMs: number) {
  const cycleIndex = Math.max(0, Math.floor((nowMs - genesisMs) / HALVING_PERIOD_MS));
  const cycleStart = genesisMs + cycleIndex * HALVING_PERIOD_MS;
  const nextHalvingMs = cycleStart + HALVING_PERIOD_MS;
  const currentRatePerSec = GENESIS_RATE_PER_SEC / 2 ** cycleIndex;
  return {
    cycleIndex,
    nextHalvingMs,
    currentRatePerSec,
    nextRatePerSec: currentRatePerSec / 2,
    cycleProgress: (nowMs - cycleStart) / HALVING_PERIOD_MS,
  };
}

// Welcome boost: 8x -> 1x linearly over 72h from first mint.
export const WELCOME_BOOST_WINDOW_S = 259_200;

export function welcomeBoostFactor(joinedAtMs: number | null, nowMs: number): number {
  if (!joinedAtMs) return 1;
  const t = Math.max(0, (nowMs - joinedAtMs) / 1000);
  if (t >= WELCOME_BOOST_WINDOW_S) return 1;
  return 1 + 7 * (1 - t / WELCOME_BOOST_WINDOW_S);
}

/**
 * Additional simulated grow power folded into the emission denominator. Kept at
 * 0 so no fabricated participants are counted — the denominator is the real sum
 * of every recorded node's grow power (see networkGrowPower in game.ts). Raise
 * this only to damp early solo dominance; it is a tuning knob, not a fix.
 */
export const SIM_NETWORK_GP = 0;

/**
 * One-time OSR credited to a wallet on first sight so a new operator can afford
 * their first node (an Oil Rig burns 1,000 OSR). Without this a fresh wallet has
 * no route to its first node: no nodes means no production means nothing to
 * claim, and crates also cost OSR. Tracked via users.dripped so it grants once.
 */
export const STARTER_OSR_GRANT = 1_000;

/** Storage cap = 12h of production. */
export const STORAGE_CAP_SECONDS = 43_200;

export const COMPOUND_COOLDOWN_MS = 12 * 3600 * 1000; // 12h, expedite fee skips

// xStock
export const XSTOCK_MIN_COMPOUND_LEVEL = 5;
export const AUTO_SWAP_ENABLED = false;
export const XSTOCK_ACCRUAL_RATE = 0.01;
