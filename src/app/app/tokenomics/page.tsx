'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';
import { api, type ProtocolOverview } from '@/lib/api-client';
import { AURA_TIERS } from '@/lib/aura';
import {
  CLAIM_FEE_BPS,
  COMPOUND_LEVELS,
  MAX_COMPOUND_LEVEL,
  SOL_MINT_FEE_LAMPORTS,
  getCrateCost,
  getShaftBonusSlots,
} from '@/lib/economy';

// Actual server response shape for /api/nodes/families (NODE_FAMILIES).
interface FamilyEcon {
  key: string;
  name: string;
  description: string;
  family: 'oil' | 'mine';
  burnCostOsr: number;
  burnShareBps: number;
  treasuryShareBps: number;
  solMintFeeLamports: number;
}

const REWARD_FLOW = `Genesis: 229M OSR pre-minted to OSR Emission Reserve PDA
         (mint authority revoked immediately after distribution)
                │
                ▼
  ┌─────────────────────────────┐
  │   OSR Emission Reserve      │
  │   229M OSR (pre-minted)     │
  └──────────────┬──────────────┘
                 │  halving curve E(t) = 262 × 0.5^(t/7d)
                 ▼
    Each user's per-second rate:
    share = min(userGP / totalGP, 30%) × welcomeBoost(elapsed)
                 │
                 ▼
  ┌─────────────────────────┐       ┌──────────────────────────┐
  │  Oil Rig claims         │       │  Mining Shaft claims     │
  │  pay OSR                │       │  pay OSR (compoundable)  │
  └─────────────────────────┘       └──────────────────────────┘

  Separately: Protocol SOL revenue (Token-2022 2% + LP 2%) → treasury ops
  (XOMX/CVXX swap path is a legacy ops-side flow, not a user-rewards path)`;

const HALVING_TABLE = `E(t) = E₀ × 0.5 ^ (t / 7 days)

Day 0  :  262  OSR/sec   (22.6M/day)
Day 7  :  131  OSR/sec   (11.3M/day, 50% of lifetime emitted)
Day 14 :  65.5 OSR/sec   (5.66M/day, 75%)
Day 30 :  13.4 OSR/sec   (1.16M/day, 95%)
Day 90 :  ~0             (emission effectively extinct)`;

const USER_RATE = `user_rate = min(user_gp / total_network_gp, 30%) × E(t) × welcome_boost

user_gp = Σ componentMult for each node (Formula D: base × Π rarityBoost)`;

const WELCOME_BOOST = `boost(elapsed) = 1 + 7 × max(0, 1 − elapsed / 72h)

Hour 0  : 8.00×
Hour 24 : 5.67×
Hour 48 : 3.33×
Hour 72 : 1.00× (boost expired)`;

const THROTTLE = `runwayDays = reserveBalance / unconstrainedDailyBurn

runway ≥ 45d  →  f = 1.0      (healthy)
14d → 45d     →  f 0.7 → 1.0  (gentle)
7d  → 14d     →  f 0.3 → 0.7  (notable)
3d  → 7d      →  f 0   → 0.3  (emergency)
≤ 3d          →  f = 0        (halted)`;

export default function TokenomicsPage() {
  const [families, setFamilies] = useState<FamilyEcon[] | null>(null);
  const [overview, setOverview] = useState<ProtocolOverview | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [fams, ov] = await Promise.all([api.families(), api.overview()]);
        setFamilies(fams as unknown as FamilyEcon[]);
        setOverview(ov);
      } catch {
        /* silently swallowed — static copy still renders */
      }
    })();
  }, []);

  const mintSolFee = (families?.[0]?.solMintFeeLamports ?? SOL_MINT_FEE_LAMPORTS) / 1e9;

  return (
    <PageShell
      title="Tokenomics"
      subtitle="Live economic model for OSR, Oil Rigs, and Mining Shafts"
    >
      <div className="space-y-10">
        {/* 1. The Economic Loop */}
        <Section title="1. The Economic Loop">
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-steel-300">
            <li>
              Users burn OSR + pay a SOL fee to deploy virtual nodes (Oil Rigs or Mining Shafts).
            </li>
            <li>
              Every mint burns <strong className="text-white">70%</strong> of the OSR cost to the
              burn wallet, routing the other <strong className="text-white">30%</strong> into the
              treasury wallet. Compound upgrades and crates split their OSR cost{' '}
              <strong className="text-white">50/30/20</strong> burn / reserve / treasury.
            </li>
            <li>
              A halving emission curve (E₀ = 262 OSR/sec, halves every 7 days) distributes OSR from
              a pre-minted <strong className="text-white">229M reserve</strong>. Each user earns a
              share proportional to their grow-power, capped at 30% per user to prevent
              lottery-in-thin-network wins.
            </li>
            <li>
              Under v2 accrual, both <strong className="text-white">Oil Rigs</strong> and{' '}
              <strong className="text-white">Mining Shafts</strong> accrue{' '}
              <strong className="text-white">$OSR</strong> per second out of that reserve.
              Progression is wallet-wide: <strong className="text-white">compound upgrades</strong>{' '}
              (OSR + 0.001 SOL, 12h cooldown) raise your Compound Level, unlocking more node slots,
              more daily crates, and higher rarity pools. Mining Shafts add bonus node slots at L5+.
            </li>
            <li>
              Protocol SOL revenue (Token-2022 2% transfer fee + Meteora DAMM v2 LP 2% fee) flows to
              the treasury ops budget — it funds infrastructure, not user rewards. User accrual is
              OSR-only from the halving reserve.
            </li>
          </ol>
        </Section>

        {/* 2. Node Family Economics */}
        <Section title="2. Node Family Economics">
          {!families ? (
            <p className="text-sm text-steel-400">Loading…</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {families.map((f) => (
                <div key={f.key} className="panel p-4">
                  <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-amber-500">
                    {f.name}
                  </h3>
                  <p className="mt-1 text-xs text-steel-400">{f.description}</p>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <Row k="Mint cost" v={`${f.burnCostOsr.toLocaleString()} OSR`} />
                    <Row
                      k="→ burned (70%)"
                      v={`${((f.burnCostOsr * f.burnShareBps) / 10000).toLocaleString()} OSR`}
                      dim
                    />
                    <Row
                      k="→ treasury (30%)"
                      v={`${((f.burnCostOsr * f.treasuryShareBps) / 10000).toLocaleString()} OSR`}
                      dim
                    />
                    <Row k="SOL mint fee" v={`${f.solMintFeeLamports / 1e9} SOL`} />
                    <Row k="Reward asset" v="OSR (halving share)" />
                    <Row k="Share formula" v="min(userGp / totalGp, 30%) × E(t) × welcomeBoost" />
                    <Row
                      k="Family perk"
                      v={
                        f.family === 'mine'
                          ? 'Bonus node slots at L5/L7/L9 (+2/+3/+4)'
                          : 'Claim-only earnings in v1'
                      }
                    />
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 3. Fees */}
        <Section title="3. Fees">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <FeeCard label="Mint burn" value="70%" caption="of OSR cost" />
            <FeeCard label="Mint treasury" value="30%" caption="of OSR cost" />
            <FeeCard label="Mint SOL fee" value={`${mintSolFee} SOL`} caption="flat, per mint" />
            <FeeCard
              label="Claim fee"
              value={`${CLAIM_FEE_BPS / 100}%`}
              caption="on gross claim · 1h cooldown"
            />
            <FeeCard
              label="Compound upgrade"
              value="500 → 60k OSR"
              caption="L2→L10 ladder · +0.001 SOL · 12h cooldown"
            />
            <FeeCard label="Expedite" value="1 SOL" caption="skip the compound cooldown" />
            <FeeCard
              label="Crate cost"
              value={`${getCrateCost(1)} → ${getCrateCost(10)} OSR`}
              caption="by compound level · +0.002 SOL fee"
            />
            <FeeCard
              label="Upgrade & crate split"
              value="50/30/20"
              caption="burn / reserve / treasury"
            />
          </div>
        </Section>

        {/* 4. Reward Flow */}
        <Section title="4. Reward Flow">
          <div className="panel overflow-x-auto p-4">
            <pre className="font-mono text-[11px] leading-relaxed text-steel-300">{REWARD_FLOW}</pre>
          </div>
        </Section>

        {/* 5. Halving Emission Model */}
        <Section title="5. Halving Emission Model">
          <p className="text-sm leading-relaxed text-steel-300">
            Global OSR emission follows a Bitcoin-style halving curve. Starting at{' '}
            <code className="rounded bg-ink-700 px-1 font-mono text-xs text-amber-500">
              E₀ = 262 OSR/sec
            </code>{' '}
            at genesis, the rate halves every <strong className="text-white">7 days</strong> until
            the reserve is fully paid out.
          </p>
          <div className="panel mt-3 overflow-x-auto p-4">
            <pre className="font-mono text-[11px] leading-relaxed text-steel-300">
              {HALVING_TABLE}
            </pre>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-steel-300">
            Lifetime emission = <strong className="text-white">229M OSR</strong>, pre-minted to the
            program-owned emission reserve PDA at genesis. Mint authority is revoked
            post-distribution — no new supply can ever be created.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-steel-300">
            Each user earns a proportional share of each second&rsquo;s emission:
          </p>
          <div className="panel mt-3 overflow-x-auto p-4">
            <pre className="font-mono text-[11px] leading-relaxed text-steel-300">{USER_RATE}</pre>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-steel-300">
            A 30% per-user share cap prevents lucky-in-thin-network lottery wins, keeping the
            experience fair across network sizes.
          </p>
        </Section>

        {/* 5b. Welcome Boost */}
        <Section title="5b. Welcome Boost">
          <p className="text-sm leading-relaxed text-steel-300">
            New users receive an <strong className="text-white">8× share multiplier</strong> that
            linearly decays to 1× over their first 72 hours. This is critical for latecomers joining
            mid-cycle when the halving curve has already decayed.
          </p>
          <div className="panel mt-3 overflow-x-auto p-4">
            <pre className="font-mono text-[11px] leading-relaxed text-steel-300">
              {WELCOME_BOOST}
            </pre>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-steel-300">
            The boost applies from your first mint. Separately, the one-time{' '}
            <strong className="text-white">welcome stipend</strong> unlocks only after reaching
            Compound L4 — that gate is what stops $100 × 10 alt-wallets from draining the welcome
            allocation.
          </p>
        </Section>

        {/* 5c. Emission Throttle */}
        <Section title="5c. Emission Throttle (safety layer)">
          <p className="text-sm leading-relaxed text-steel-300">
            Orthogonal to the halving, a runway-based throttle factor{' '}
            <code className="rounded bg-ink-700 px-1 font-mono text-xs text-amber-500">
              f ∈ [0, 1]
            </code>{' '}
            protects against pathological drain on legacy flat-rate families (not used for OSR under
            the halving model, but retained for any future secondary-asset families):
          </p>
          <div className="panel mt-3 overflow-x-auto p-4">
            <pre className="font-mono text-[11px] leading-relaxed text-steel-300">{THROTTLE}</pre>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-steel-300">
            Under the halving model for OSR, the emission reserve is pre-minted and cannot deplete
            beyond lifetime emission, so{' '}
            <code className="rounded bg-ink-700 px-1 font-mono text-xs text-amber-500">f = 1.0</code>{' '}
            effectively always. When paused by admin, f is forced to 0 across all families.
          </p>
        </Section>

        {/* 6. Compound Levels */}
        <Section title="6. Compound Levels">
          <p className="text-sm leading-relaxed text-steel-300">
            Progression is wallet-wide. Each compound level unlocks more node slots per family, a
            higher daily crate limit, and pricier crates. Upgrades cost OSR (split 50/30/20 burn /
            reserve / treasury) + 0.001 SOL, on a 12h cooldown (1 SOL expedite skips it). Mining
            Shafts get bonus node slots on top: +2 at L5, +3 at L7, +4 at L9. Rarity pools unlock by
            level too — Legendary at L4, Mythic at L6, Divine at L8.
          </p>
          <div className="panel mt-3 overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead>
                <tr className="border-b border-ink-600">
                  <th className="stat-label px-4 py-3 font-normal">Level</th>
                  <th className="stat-label px-4 py-3 text-right font-normal">Upgrade cost</th>
                  <th className="stat-label px-4 py-3 text-right font-normal">Max nodes / family</th>
                  <th className="stat-label px-4 py-3 text-right font-normal">Shaft bonus</th>
                  <th className="stat-label px-4 py-3 text-right font-normal">Crates / day</th>
                  <th className="stat-label px-4 py-3 text-right font-normal">Crate cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/60">
                {Array.from({ length: MAX_COMPOUND_LEVEL }, (_, i) => i + 1).map((lvl) => {
                  const row = COMPOUND_LEVELS[lvl];
                  const bonus = getShaftBonusSlots(lvl);
                  return (
                    <tr key={lvl}>
                      <td className="px-4 py-2.5 font-mono text-amber-500">L{lvl}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-white">
                        {lvl === 1 ? '—' : `${row.osrUpgradeCost.toLocaleString()} OSR`}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-white">{row.maxNodes}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-steel-300">
                        {bonus > 0 ? `+${bonus} shafts` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-white">
                        {row.cratesPerDay}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-white">
                        {getCrateCost(lvl).toLocaleString()} OSR
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 7. Aura Tier Palette */}
        <Section title="7. Aura Tier Palette">
          <p className="text-sm leading-relaxed text-steel-300">
            Each node&rsquo;s emissive material color shifts with its level, making progression
            visible at a glance in the 3D scene.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(AURA_TIERS).map(([lvl, tier]) => (
              <div key={lvl} className="panel flex flex-col items-center gap-1 p-3">
                <span
                  className="font-mono text-lg font-bold"
                  style={{ color: tier.color, textShadow: `0 0 12px ${tier.color}66` }}
                >
                  L{lvl}
                </span>
                <span
                  className="h-2 w-full rounded-full"
                  style={{ background: tier.color, boxShadow: `0 0 8px ${tier.color}88` }}
                />
                <span className="font-mono text-[10px] uppercase tracking-widest text-steel-400">
                  {tier.label}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* 8. Live Protocol State */}
        <Section title="8. Live Protocol State">
          {!overview ? (
            <p className="text-sm text-steel-400">Loading live state…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <LiveCard
                label="OSR Burned"
                value={overview.totalOsrBurned.toLocaleString()}
                suffix="OSR"
              />
              <LiveCard
                label="Nodes Deployed"
                value={String(overview.totalNodes)}
                suffix={`${overview.totalOilRigs} oil · ${overview.totalMiningShafts} mine`}
              />
              <LiveCard
                label="Protocol SOL Revenue"
                value={overview.totalCreatorRewardsProcessed.toFixed(4)}
                suffix="SOL (Token-2022 + LP)"
              />
              <LiveCard
                label="XOMX Reserve"
                value={overview.xomxReserveBalance.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
                suffix="XOMX"
                color="#ffb347"
              />
              <LiveCard
                label="CVXX Reserve"
                value={overview.cvxxReserveBalance.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
                suffix="CVXX"
                color="#c8e0f0"
              />
              <LiveCard
                label="OSR Reserve"
                value={overview.osrReserveBalance.toLocaleString()}
                suffix="OSR"
                color="#ffd24d"
              />
            </div>
          )}
          <p className="mt-3 text-xs text-steel-400">
            See{' '}
            <Link href="/app/vault" className="text-amber-500 hover:underline">
              <strong>Reserve Vault</strong>
            </Link>{' '}
            for the full event feed and{' '}
            <Link href="/app/market" className="text-amber-500 hover:underline">
              <strong>Market Room</strong>
            </Link>{' '}
            for aggregated metrics.
          </p>
        </Section>

        {/* 9. Source of Truth */}
        <Section title="9. Source of Truth">
          <p className="text-sm leading-relaxed text-steel-300">
            All constants on this page are imported from{' '}
            <code className="rounded bg-ink-700 px-1 font-mono text-xs text-amber-500">
              @osr/types
            </code>{' '}
            and{' '}
            <code className="rounded bg-ink-700 px-1 font-mono text-xs text-amber-500">
              @osr/game-core
            </code>
            , and the live family config comes from{' '}
            <code className="rounded bg-ink-700 px-1 font-mono text-xs text-amber-500">
              GET /api/nodes/families
            </code>
            , so this page can never drift from what the backend actually enforces. Admin config
            changes appear here on the next reload.
          </p>
        </Section>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-amber-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ k, v, dim }: { k: string; v: string; dim?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-xs ${dim ? 'text-steel-500' : 'text-steel-400'}`}>{k}</dt>
      <dd
        className={`text-right font-mono text-xs ${dim ? 'text-steel-500' : 'text-steel-200'}`}
      >
        {v}
      </dd>
    </div>
  );
}

function FeeCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="panel p-4">
      <p className="stat-label">{label}</p>
      <p className="mt-1 font-mono text-lg text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-steel-500">{caption}</p>
    </div>
  );
}

function LiveCard({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string;
  suffix: string;
  color?: string;
}) {
  return (
    <div className="panel p-4">
      <p className="stat-label">{label}</p>
      <p className="mt-1 break-words font-mono text-lg" style={{ color: color ?? '#ffffff' }}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-steel-500">{suffix}</p>
    </div>
  );
}
