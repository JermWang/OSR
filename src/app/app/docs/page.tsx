'use client';

import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';
import ComponentTile from '@/components/ui/ComponentTile';
import { AURA_TIERS } from '@/lib/aura';
import { RARITY_MULT } from '@/lib/economy';
import { NODE_SLOTS, RARITIES, SLOT_LABELS, rarityHex, type Rarity } from '@/lib/rarity';

const CONTENTS: Array<{ href: string; label: string }> = [
  { href: '#overview', label: '1. What is OSR?' },
  { href: '#quickstart', label: '2. Quick start' },
  { href: '#nodes', label: '3. Nodes: Rigs vs Shafts' },
  { href: '#levels', label: '4. Levels & Auras' },
  { href: '#components', label: '5. Components & Crates' },
  { href: '#earning', label: '6. Earning & Claiming' },
  { href: '#compounding', label: '7. Compound Levels' },
  { href: '#fees', label: '8. Fees' },
  { href: '#emission', label: '9. Why rewards can slow down' },
  { href: '#safety', label: '10. Safety & FAQ' },
];

const rarityLabel = (r: Rarity) => r.charAt(0).toUpperCase() + r.slice(1);

const EMISSION_CURVE = `E(t) = 262 OSR/sec × 0.5 ^ (t / 7d)

Day 0  : 22.6M OSR emitted
Day 7  : 50% of lifetime already emitted
Day 14 : 75% emitted
Day 30 : 95% emitted
Lifetime total: 229M OSR (pre-minted, mint authority revoked)`;

const USER_RATE = `user_rate = min(your_gp / network_gp, 30%) × E(t) × welcome_boost

Two key mechanics:
  • Share cap: no user can capture more than 30% of emission
    (prevents lottery-in-thin-network wins)
  • Welcome boost: new users get 8× multiplier for 72h,
    linearly decaying — critical for latecomer retention`;

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'Is OSR a financial product or investment?',
    a: (
      <p>
        No. OSR is an on-chain game. Rewards are not guaranteed — they depend on the halving
        emission schedule, reserve health, and the OSR token&rsquo;s market value. Treat any token
        interaction as risk capital.
      </p>
    ),
  },
  {
    q: 'Can I lose my nodes?',
    a: (
      <p>
        Nodes don&rsquo;t disappear. What can happen: if the protocol is paused by admin, or if the
        halving curve has fully decayed (past day ~60), accrual rates become very small or zero. The
        nodes themselves stay in your wallet permanently — they just stop earning meaningful yield
        as the halving tail approaches zero.
      </p>
    ),
  },
  {
    q: 'What if I lose access to my wallet?',
    a: (
      <p>
        OSR cannot recover wallet access. Protect your seed phrase. If you switch wallets, your
        nodes stay with the original wallet — there&rsquo;s no transfer or migration feature in v1.
      </p>
    ),
  },
  {
    q: 'Where does the reward money come from?',
    a: (
      <p>
        The entire OSR emission for the project&rsquo;s lifetime —{' '}
        <strong className="text-white">229M OSR</strong> — is pre-minted to a program-owned emission
        reserve PDA at genesis. Mint authority is revoked immediately after, so no new OSR can ever
        be created. Each second, the halving curve determines how much OSR flows out to users
        proportional to their grow-power share. Protocol SOL revenue (Token-2022 2% transfer fee +
        LP 2%) goes to a separate treasury and funds infrastructure/ops, not user rewards. The{' '}
        <Link href="/app/vault" className="text-amber-500 hover:underline">
          Vault
        </Link>{' '}
        page shows the protocol&rsquo;s live ledger — reserve balances, burns, and treasury events;
        on-chain verification of the reserve wallet lands with real-mode launch.
      </p>
    ),
  },
  {
    q: 'How many nodes can I own?',
    a: (
      <p>
        It scales with your Compound Level: 2 per family at L1 up to 8 per family at L10. Mining
        Shafts add bonus slots on top (+2 at L5, +3 at L7, +4 at L9), so a maxed wallet can run 8
        rigs and 12 shafts. The caps keep the 3D scene readable and prevent farming rewards with an
        unbounded number of bare nodes.
      </p>
    ),
  },
  {
    q: 'What happens at Compound L10?',
    a: (
      <p>
        L10 is the current max. From there, output growth comes from better components — higher
        rarity pools, pity protection on the top tiers, and keeping durability fresh. The prestige
        black-and-gold finish stays.
      </p>
    ),
  },
  {
    q: 'Is my data safe?',
    a: (
      <p>
        OSR reads wallet addresses only — no email, no KYC. Your game state (nodes, components,
        pending rewards) lives on OSR servers keyed to your wallet; token balances, burns, and claim
        payouts settle on-chain to your wallet.
      </p>
    ),
  },
];

export default function DocsPage() {
  return (
    <PageShell
      title="Player Guide"
      subtitle="How Oil Strategic Reserve works, start to finish"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-10">
        {/* Contents */}
        <nav className="panel p-4">
          <p className="stat-label mb-2">Contents</p>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {CONTENTS.map(({ href, label }) => (
              <li key={href}>
                <a href={href} className="text-steel-300 transition hover:text-amber-500">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* 1. What is OSR? */}
        <Section id="overview" title="1. What is OSR?">
          <p>
            <strong className="text-white">Oil Strategic Reserve (OSR)</strong> is a gamified,
            virtual node-mining platform on Solana. You burn{' '}
            <strong className="text-white">$OSR</strong> tokens to deploy virtual{' '}
            <strong className="text-white">Oil Rigs</strong> and{' '}
            <strong className="text-white">Mining Shafts</strong> on your own 3D compound. Those
            nodes produce real rewards over time, paid out from a 229M $OSR emission reserve
            released via a Bitcoin-style halving curve.
          </p>
          <p>
            Think of it like an incremental game where every action is on-chain: your rigs and
            shafts are real state, your burns reduce the $OSR supply, and your rewards settle to
            your wallet.
          </p>
          <p>
            Both <strong className="text-white">Oil Rigs</strong> and{' '}
            <strong className="text-white">Mining Shafts</strong> accrue{' '}
            <strong className="text-white">$OSR</strong> per second. Progression is wallet-wide: you
            raise your <strong className="text-white">Compound Level</strong> to unlock more node
            slots, more daily crates, and higher rarity pools. Mining Shafts earn bonus node slots
            at higher levels; Oil Rigs are claim-only in v1.
          </p>
        </Section>

        {/* 2. Quick start */}
        <Section id="quickstart" title="2. Quick start">
          <ol className="space-y-4">
            <Step n={1} title="Connect a wallet">
              Open the{' '}
              <Link href="/app" className="text-amber-500 hover:underline">
                Command Center
              </Link>{' '}
              and connect a Solana wallet. In mock mode you can just paste any address to try the
              game.
            </Step>
            <Step n={2} title="Deploy your first node">
              Tap <strong className="text-white">Deploy</strong>. Pick an Oil Rig or Mining Shaft,
              burn the required $OSR + small SOL fee, and it appears on your compound.
            </Step>
            <Step n={3} title="Let it produce">
              Nodes accrue rewards every second based on your components&rsquo; grow-power and your
              share of the global halving emission. Watch{' '}
              <strong className="text-white">pending rewards</strong> tick up in your HUD.
            </Step>
            <Step n={4} title="Claim, open crates, compound-upgrade">
              Claim to cash out (2% fee, 1h cooldown), open Supply Crates to upgrade your
              components, or compound-upgrade your wallet to unlock more nodes and crates. Repeat.
            </Step>
          </ol>
        </Section>

        {/* 3. Nodes */}
        <Section id="nodes" title="3. Nodes: Rigs vs Shafts">
          <p>
            Node capacity scales with your <strong className="text-white">Compound Level</strong>: 2
            per family at L1, growing to <strong className="text-white">8 per family</strong> at L10
            — and Mining Shafts add bonus slots on top (+2 at L5, +3 at L7, +4 at L9). Each node is
            an independent entity with its own components and production rate.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <NodeCard
              accent="#ffb347"
              title="Oil Rig"
              tagline="Offshore platform on the water quadrant."
              bullets={[
                <>
                  Earns <strong className="text-white">$OSR</strong> via the halving emission
                </>,
                <>Funded by the 229M OSR emission reserve</>,
                <>
                  <strong className="text-white">Claim-only</strong> in v1 — compound is a Mining
                  Shaft feature
                </>,
                <>Slots: Derrick Tower, Pump Jack, Pipeline, Flare Stack</>,
              ]}
            />
            <NodeCard
              accent="#d4d8de"
              title="Mining Shaft"
              tagline="Underground operation on the land quadrant."
              bullets={[
                <>
                  Earns <strong className="text-white">$OSR</strong>
                </>,
                <>Funded by the OSR reserve wallet</>,
                <>
                  <strong className="text-white">Bonus node slots</strong> at Compound L5/L7/L9
                  (+2/+3/+4 shafts)
                </>,
                <>Slots: Drill Bit, Ore Cart, Rail Track, Shaft Elevator</>,
              ]}
            />
          </div>
        </Section>

        {/* 4. Levels & Auras */}
        <Section id="levels" title="4. Levels & Auras">
          <p>
            Your nodes&rsquo; visual level mirrors your wallet&rsquo;s{' '}
            <strong className="text-white">Compound Level (L1 → L10)</strong>. Each level upgrades
            the rig&rsquo;s <strong className="text-white">material era</strong> — rough steel
            through reinforced and high-tech to a black-and-gold prestige finish — and grows its
            size, making progress visible at a glance on the compound.
          </p>
          <p>
            Production itself comes from your components, not the visual level:{' '}
            <code className="rounded bg-ink-700 px-1 font-mono text-xs text-amber-500">
              your rate = min(your GP / network GP, 30%) × E(t) × welcome boost
            </code>{' '}
            — where GP (grow-power) is the Formula D multiplier of your installed components.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
          <p>
            Higher levels also pump up the scene&rsquo;s bloom intensity — a max-level compound
            looks visibly brighter than a fresh one.
          </p>
          {/* Live preview placeholder (3D module ships separately) */}
          <div className="rounded-lg border border-dashed border-steel-500/40 p-6 text-center">
            <p className="stat-label">Live preview — each level</p>
            <p className="mt-2 text-sm text-steel-400">
              The interactive 3D level preview loads on the{' '}
              <Link href="/app" className="text-amber-500 hover:underline">
                Command
              </Link>{' '}
              page.
            </p>
          </div>
          <p className="text-xs text-steel-500">
            Higher levels upgrade the rig&rsquo;s material era (rough steel → reinforced → high-tech
            → black-and-gold prestige), grow its size, and light a powered deck ring at the
            milestone levels. The per-component rarity glow layers on top.
          </p>
        </Section>

        {/* 5. Components & Crates */}
        <Section id="components" title="5. Components & Crates">
          <p>
            Each node has <strong className="text-white">4 component slots</strong>. Components are
            earned by opening <strong className="text-white">Supply Crates</strong> — 500 $OSR at L1
            scaling to 1,625 $OSR at L10 (split 50/30/20 burn / reserve / treasury), plus a flat
            0.002 SOL protocol fee. Your daily crate limit scales with Compound Level — from 3/day
            at L1 up to 20/day at L10, per node type. Every drop has a rarity tier that multiplies
            the node&rsquo;s output:
          </p>
          <div className="panel overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead>
                <tr className="border-b border-ink-600">
                  <th className="stat-label px-4 py-3 font-normal">Rarity</th>
                  <th className="stat-label px-4 py-3 text-right font-normal">Multiplier</th>
                  <th className="stat-label px-4 py-3 text-right font-normal">Visual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/60">
                {RARITIES.map((r) => (
                  <tr key={r}>
                    <td
                      className="px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest"
                      style={{ color: rarityHex(r) }}
                    >
                      {rarityLabel(r)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-white">
                      {RARITY_MULT[r].toLocaleString()}×
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="ml-auto block h-3 w-3 rounded-full"
                        style={{
                          background: rarityHex(r),
                          boxShadow: `0 0 8px ${rarityHex(r)}aa`,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            A node&rsquo;s total multiplier uses <strong className="text-white">Formula D</strong>:
            the average of its 4 slots&rsquo; durability-adjusted multipliers, raised to the power
            0.75 (capped at 500×), then multiplied by a rarity-boost stack (Epic ×1.05, Legendary
            ×1.15, Mythic ×1.4, Divine ×2.0 per component). Empty slots count as Common. Higher
            rarity pools unlock with Compound Level: Legendary at L4, Mythic at L6, Divine at L8.
            Drop odds are published and a bad-luck-protection (pity) system guarantees dry streaks
            on the top tiers can&rsquo;t run forever.
          </p>
          <p>
            <strong className="text-white">Slot compatibility:</strong> Oil Rig components fit only
            in Oil Rigs, Mining Shaft components fit only in Shafts. Each component has a specific
            slot (you can&rsquo;t put a Derrick Tower in a Pump Jack socket).
          </p>
          <p>
            Use the{' '}
            <Link href="/app/inventory" className="text-amber-500 hover:underline">
              Inventory
            </Link>{' '}
            page to move components between nodes — unequip from one, equip on another. The
            displaced component falls back to your locker.
          </p>

          {/* Gallery */}
          <div>
            <p className="stat-label mb-3">Every slot, every rarity</p>
            <div className="space-y-6">
              {(
                [
                  { family: 'oil' as const, title: 'Oil Rig slots', accent: '#ffb347' },
                  { family: 'mine' as const, title: 'Mining Shaft slots', accent: '#c8e0f0' },
                ] as const
              ).map(({ family, title, accent }) => (
                <div key={family} className="panel overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-600">
                        <th
                          className="whitespace-nowrap px-3 py-3 font-mono text-[11px] font-bold uppercase tracking-widest"
                          style={{ color: accent }}
                        >
                          {title}
                        </th>
                        {RARITIES.map((r) => (
                          <th key={r} className="px-2 py-3 text-center">
                            <span
                              className="block font-mono text-[10px] font-bold uppercase tracking-wider"
                              style={{ color: rarityHex(r) }}
                            >
                              {rarityLabel(r)}
                            </span>
                            <span className="block font-mono text-[9px] text-steel-500">
                              {RARITY_MULT[r].toFixed(2)}×
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-600/60">
                      {NODE_SLOTS[family].map((slot) => (
                        <tr key={slot}>
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-steel-300">
                            {SLOT_LABELS[slot]}
                          </td>
                          {RARITIES.map((r) => (
                            <td key={r} className="px-2 py-2">
                              <div className="mx-auto flex h-16 w-16 items-center justify-center">
                                <ComponentTile slot={slot} rarity={r} size={56} />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-steel-500">
              Each tile shows that slot at that rarity — rarer tiers add emissive glow that blooms
              in the scene. The live rig preview above shows the hero model these install into.
            </p>
          </div>
        </Section>

        {/* 6. Earning & Claiming */}
        <Section id="earning" title="6. Earning & Claiming">
          <p>
            Rewards accrue <strong className="text-white">continuously, per second</strong>, based
            on:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Your <strong className="text-white">grow-power</strong> (Formula D multiplier summed
              across your nodes&rsquo; components)
            </li>
            <li>
              Your <strong className="text-white">share of total network grow-power</strong> —
              capped at 30% per user
            </li>
            <li>
              The global <strong className="text-white">halving emission rate</strong> E(t) (see
              section 9)
            </li>
            <li>
              Your <strong className="text-white">welcome boost</strong> (8× → 1× over your first 72
              hours)
            </li>
          </ul>
          <p>
            Pending rewards are kept server-side and streamed to your HUD every ~10s. When you{' '}
            <strong className="text-white">Claim All</strong>, every node&rsquo;s pending balance is
            zeroed and the reserve wallet pays out the net amount to your wallet (2% fee retained in
            the reserve to keep emissions solvent). Claims have a{' '}
            <strong className="text-white">1-hour cooldown</strong> per wallet.
          </p>
          <p>
            Crate installs and compound upgrades internally accrue first, so you never lose
            production between actions — you&rsquo;re always paid at the rate you actually had for
            the time you had it.
          </p>
        </Section>

        {/* 7. Compound Levels */}
        <Section id="compounding" title="7. Compound Levels">
          <p>
            Your <strong className="text-white">Compound Level</strong> (L1 → L10) is your
            wallet-wide progression track. Each upgrade costs $OSR — from{' '}
            <strong className="text-white">500 OSR</strong> for L2 up to{' '}
            <strong className="text-white">60,000 OSR</strong> for L10, split 50/30/20 burn /
            reserve / treasury — plus a flat 0.001 SOL fee. Each level unlocks:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              More <strong className="text-white">node slots</strong> per family (2 at L1 → 8 at
              L10; shafts +2/+3/+4 bonus at L5/L7/L9)
            </li>
            <li>
              A higher <strong className="text-white">daily crate limit</strong> (3/day at L1 →
              20/day at L10, per node type)
            </li>
            <li>
              Higher <strong className="text-white">rarity pools</strong> (Legendary at L4, Mythic
              at L6, Divine at L8)
            </li>
          </ul>
          <p>
            Upgrades have a <strong className="text-white">12-hour cooldown</strong>. In a hurry,
            you can <strong className="text-white">expedite</strong>: pay 1 SOL to skip the cooldown
            for one upgrade (the fee goes to the treasury).
          </p>
          <p>
            See the full level table on the{' '}
            <Link href="/app/tokenomics" className="text-amber-500 hover:underline">
              Tokenomics
            </Link>{' '}
            page.
          </p>
        </Section>

        {/* 8. Fees */}
        <Section id="fees" title="8. Fees">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <FeeCard label="Mint burn" value="70%" caption="of OSR cost to burn wallet" />
            <FeeCard label="Mint treasury" value="30%" caption="of OSR cost to treasury" />
            <FeeCard label="Mint SOL fee" value="0.05 SOL" caption="flat, per mint" />
            <FeeCard label="Claim fee" value="2%" caption="retained in reserve · 1h cooldown" />
            <FeeCard
              label="Compound upgrade"
              value="500 → 60k OSR"
              caption="L2→L10 · +0.001 SOL · 12h cooldown"
            />
            <FeeCard label="Expedite" value="1 SOL" caption="skip the compound cooldown" />
            <FeeCard
              label="Crate cost"
              value="500 → 1625 OSR"
              caption="by compound level · +0.002 SOL fee"
            />
            <FeeCard
              label="Upgrade & crate split"
              value="50/30/20"
              caption="burn / reserve / treasury"
            />
          </div>
          <p className="text-xs text-steel-500">
            Mints split 70/30 burn/treasury on the OSR leg; compound upgrades and crates split
            50/30/20 burn/reserve/treasury. See{' '}
            <Link href="/app/tokenomics" className="text-amber-500 hover:underline">
              Tokenomics
            </Link>{' '}
            for the live numbers straight from the backend.
          </p>
        </Section>

        {/* 9. Emission */}
        <Section id="emission" title="9. How emission works">
          <p>
            OSR uses a <strong className="text-white">halving emission curve</strong>. Global OSR
            issuance starts at <strong className="text-white">262 OSR/sec</strong> at genesis and
            halves every <strong className="text-white">7 days</strong> until the lifetime supply is
            fully paid out.
          </p>
          <div className="panel overflow-x-auto p-4">
            <pre className="font-mono text-[11px] leading-relaxed text-steel-300">
              {EMISSION_CURVE}
            </pre>
          </div>
          <p>
            Each user earns a share of each second&rsquo;s emission, proportional to their{' '}
            <strong className="text-white">grow-power</strong> (sum of component multipliers across
            their nodes):
          </p>
          <div className="panel overflow-x-auto p-4">
            <pre className="font-mono text-[11px] leading-relaxed text-steel-300">{USER_RATE}</pre>
          </div>
          <p>
            <strong className="text-white">Why does emission halve?</strong> To front-load
            excitement during the first 2 weeks while still leaving meaningful yields for
            latecomers. By day 14, 75% of lifetime OSR has been distributed — but latecomers with
            the welcome boost still earn well for their first 72 hours.
          </p>
          <p>
            You can always see current global emission and your share on the{' '}
            <Link href="/app/vault" className="text-amber-500 hover:underline">
              Reserve Vault
            </Link>{' '}
            page — it&rsquo;s fully public.
          </p>
        </Section>

        {/* 10. Safety & FAQ */}
        <Section id="safety" title="10. Safety & FAQ">
          <div className="space-y-2">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="panel group p-0">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-steel-200 transition hover:text-amber-500">
                  {q}
                </summary>
                <div className="border-t border-ink-600/60 px-4 py-3 text-sm leading-relaxed text-steel-300">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <footer className="space-y-2 border-t border-ink-600 pt-4 text-xs text-steel-500">
          <p>
            <strong className="text-steel-300">More depth:</strong>{' '}
            <Link href="/app/tokenomics" className="text-amber-500 hover:underline">
              Tokenomics
            </Link>{' '}
            has live numbers and formulas,{' '}
            <Link href="/app/vault" className="text-amber-500 hover:underline">
              Vault
            </Link>{' '}
            shows the raw treasury flow,{' '}
            <Link href="/app/leaderboard" className="text-amber-500 hover:underline">
              Leaderboard
            </Link>{' '}
            ranks operators by max level, sum of levels, and total production.
          </p>
          <p>
            This guide describes current behavior. Mechanics may change as the protocol evolves —
            we&rsquo;ll update this page first when they do.
          </p>
        </footer>
      </div>
    </PageShell>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4 text-sm leading-relaxed text-steel-300">
      <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 font-mono text-sm font-bold text-ink-900">
        {n}
      </span>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-steel-300">{children}</p>
      </div>
    </li>
  );
}

function NodeCard({
  accent,
  title,
  tagline,
  bullets,
}: {
  accent: string;
  title: string;
  tagline: string;
  bullets: React.ReactNode[];
}) {
  return (
    <div className="panel p-4" style={{ borderColor: `${accent}55` }}>
      <h3
        className="font-mono text-sm font-bold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {title}
      </h3>
      <p className="mt-1 text-xs text-steel-400">{tagline}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-steel-300">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span style={{ color: accent }}>›</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
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
