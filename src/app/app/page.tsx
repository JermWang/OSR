'use client';

// Command Center — the main game screen: 3D compound + sidebar HUD.

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOperation } from '@/lib/useOperation';
import { api, type CrateResult, type NodeInfo } from '@/lib/api-client';
import { useWalletStore } from '@/lib/store';
import NavBar from '@/components/ui/NavBar';
import { COMPONENT_RARITIES, NODE_SLOTS, SLOT_LABELS, type Rarity } from '@/lib/rarity';
import { RARITY_MULT, getCrateCost, WELCOME_BOOST_WINDOW_S } from '@/lib/economy';
import type { LightingPreset } from '@/components/three/Compound';

const Scene = dynamic(() => import('@/components/three/Scene'), { ssr: false });
const CrateCinematic = dynamic(() => import('@/components/three/CrateCinematic'), { ssr: false });

const SLOT_GLYPH: Record<string, string> = {
  derrick: '⛰',
  pump_jack: '⚡',
  pipeline: '⛓',
  flare_stack: '🔥',
  drill_bit: '⛏',
  ore_cart: '🚲',
  rail_track: '═',
  elevator: '↕',
};

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(digits);
}

function Countdown({ ms }: { ms: number }) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return <>{h > 0 ? `${h}h ${m}m` : `${m}m`}</>;
}

export default function CommandPage() {
  const { op, overview, error, selectedNodeId, selectNode, refresh, wallet } = useOperation();
  const storeWallet = useWalletStore((s) => s.wallet);
  const [preset, setPreset] = useState<LightingPreset>('sunset');
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deployOpen, setDeployOpen] = useState(false);
  const [crateOpen, setCrateOpen] = useState(false);
  const [crateResult, setCrateResult] = useState<CrateResult | null>(null);
  const [lastCrateType, setLastCrateType] = useState<'rig_crate' | 'shaft_crate'>('rig_crate');

  useEffect(() => {
    const stored = localStorage.getItem('osr:lighting-preset') as LightingPreset | null;
    if (stored && ['sunset', 'dusk', 'neutral', 'night'].includes(stored)) setPreset(stored);
  }, []);
  const changePreset = (p: LightingPreset) => {
    setPreset(p);
    localStorage.setItem('osr:lighting-preset', p);
  };

  const say = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const nodes = useMemo(() => op?.nodes ?? [], [op]);
  const selected = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const pendingTotal = Object.values(op?.pending ?? {}).reduce((a, b) => a + b, 0);
  const dailyOsr = (op?.productionRate ?? 0) * 86400;
  const networkShare =
    op && overview && overview.halving.currentRatePerSec > 0
      ? (op.productionRate / (overview.halving.currentRatePerSec * op.welcomeBoostFactor || 1)) * 100
      : 0;

  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>, success?: string) => {
      if (!wallet) return say('Connect your wallet first');
      setBusy(label);
      try {
        await fn();
        await refresh();
        if (success) say(success);
      } catch (e) {
        say(e instanceof Error ? e.message : `${label} failed`);
      } finally {
        setBusy(null);
      }
    },
    [wallet, refresh, say]
  );

  const claimAll = () =>
    run('claim', async () => {
      const r = await api.claim(wallet!);
      const n = r.claims.length;
      say(n > 0 ? `Rewards claimed (${n})` : 'Nothing to claim');
    });

  const openCrate = (crateType: 'rig_crate' | 'shaft_crate') =>
    run('crate', async () => {
      setLastCrateType(crateType);
      const res = await api.openCrate(wallet!, crateType, selected?.id);
      setCrateOpen(false);
      setCrateResult(res);
    });

  const boostActive = op && op.welcomeBoostFactor > 1.001;
  const boostPct = op ? Math.max(0, (op.welcomeBoostFactor - 1) / 7) : 0;

  if (!storeWallet) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-4"><NavBar /></div>
        <div className="panel flex flex-col items-center gap-3 p-10 text-center">
          <div className="font-mono text-sm uppercase tracking-widest text-amber-500">
            Connect your wallet to begin
          </div>
          <p className="text-sm text-steel-400">
            Use the wallet button in the top bar to connect Phantom, Solflare, or Backpack — or
            play instantly as a guest.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-92px)] flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full flex-col gap-3 overflow-y-auto border-r border-ink-600 p-3 md:w-[360px]">
        <NavBar />

        {error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            API unreachable — retrying…
          </div>
        )}

        {/* Compound header */}
        <div className="panel p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="stat-label">Compound Level</div>
              <div className="text-3xl font-bold text-white">
                L<span className="text-amber-500">{op?.level ?? 1}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="stat-label">Capacity</div>
              <div className="text-sm text-steel-300">
                {op?.maxNodes ?? 2} nodes · {op?.compound.cratesPerDay ?? 3} crates
              </div>
            </div>
          </div>
        </div>

        {/* Earnings */}
        <div className="panel p-4">
          <div className="stat-label">Estimated Daily Earnings</div>
          <div className="mt-1 text-2xl font-bold text-amber-400">
            {nodes.length ? fmt(dailyOsr) : '—'} <span className="text-sm text-steel-400">OSR / day</span>
          </div>
          <p className="mt-1 text-[11px] text-steel-500">
            Based on current production rate across all your nodes.
          </p>
          <div className="mt-3">
            <div className="flex justify-between text-[11px]">
              <span className="stat-label">Network Share</span>
              <span className="font-mono text-amber-500">Halving Active</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-ink-700">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${Math.min(100, networkShare)}%` }}
              />
            </div>
            <div className="mt-0.5 text-right font-mono text-[11px] text-steel-400">
              {networkShare.toFixed(1)} %
            </div>
          </div>
          {overview && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-steel-400">
              <span>Halving #{overview.halving.cycleIndex + 2} in</span>
              <span className="font-mono text-amber-500">
                <Countdown ms={Math.max(0, overview.halving.nextHalvingMs - Date.now())} />
              </span>
            </div>
          )}
          {boostActive && (
            <div className="mt-3 rounded border border-purple-400/40 bg-purple-500/10 p-2">
              <div className="flex justify-between text-[11px]">
                <span className="font-mono uppercase tracking-wider text-purple-300">
                  Welcome Boost {op!.welcomeBoostFactor.toFixed(2)}×
                </span>
                <span className="text-steel-400">{Math.round(WELCOME_BOOST_WINDOW_S / 3600)}h window</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-ink-700">
                <div className="h-full bg-purple-400" style={{ width: `${boostPct * 100}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-steel-500">
                Your share is multiplied — accrual is larger during the boost window
              </p>
            </div>
          )}
          <button
            className="btn-primary mt-3 w-full"
            disabled={pendingTotal <= 0 || busy === 'claim' || (op?.claimCooldownRemainingMs ?? 0) > 0}
            onClick={claimAll}
          >
            {busy === 'claim'
              ? 'Claiming…'
              : (op?.claimCooldownRemainingMs ?? 0) > 0
                ? `Claim ready in ${Math.ceil((op!.claimCooldownRemainingMs) / 60000)}m`
                : `Claim Rewards${pendingTotal > 0 ? ` · ${fmt(pendingTotal)} OSR` : ''}`}
          </button>
        </div>

        {/* Nodes */}
        <div className="panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="stat-label">Your Nodes</div>
            <span className="font-mono text-[11px] text-steel-400">
              {nodes.length} / {op?.maxNodes ?? 2}
            </span>
          </div>
          {nodes.length === 0 && (
            <p className="text-xs text-steel-500">No nodes — tap Deploy to ignite your first rig.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {nodes.map((n) => (
              <button
                key={n.id}
                onClick={() => selectNode(n.id === selectedNodeId ? null : n.id)}
                className={`flex items-center gap-2 rounded border px-2.5 py-2 text-left text-xs transition ${
                  n.id === selectedNodeId
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-ink-600 bg-ink-800 hover:border-steel-500'
                }`}
              >
                <span className="text-base">{n.type === 'oil' ? '⛽' : '⛏'}</span>
                <span className="font-semibold text-steel-200">
                  {n.type === 'oil' ? 'Oil Rig' : 'Mining Shaft'} · L{n.level}
                </span>
                <span className="ml-auto font-mono text-amber-400">{fmt(n.pendingOsr)} OSR</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="btn-primary"
              disabled={nodes.length >= (op?.maxNodes ?? 2) + (op?.shaftBonusSlots ?? 0)}
              onClick={() => setDeployOpen(true)}
              title={nodes.length >= (op?.maxNodes ?? 2) ? 'Capacity full · upgrade compound to add more' : undefined}
            >
              Deploy Node {nodes.length}/{(op?.maxNodes ?? 2) + (op?.shaftBonusSlots ?? 0)}
            </button>
            <button className="btn-secondary" onClick={() => setCrateOpen(true)}>
              Open Crate
            </button>
          </div>
        </div>

        {/* Compound upgrade */}
        <CompoundPanel busy={busy} run={run} />

        {/* xStock teaser */}
        <div className="panel p-4 text-[11px] leading-relaxed text-steel-500">
          Oil rig owners at compound level 5+ earn a share of tokenized Exxon (XOMx) and Chevron
          (CVXx) dividends purchased with protocol revenue.
        </div>

        {/* Node detail */}
        {selected && <NodeDetail node={selected} busy={busy} run={run} onOpenCrate={() => setCrateOpen(true)} />}
      </aside>

      {/* 3D scene */}
      <div className="relative min-h-[360px] flex-1">
        <Scene
          nodes={nodes.map((n) => ({
            id: n.id,
            type: n.type,
            level: n.level,
            isActive: n.isActive,
            components: n.components,
          }))}
          preset={preset}
          selectedNodeId={selectedNodeId}
          onSelect={(id) => selectNode(id || null)}
          maxLevel={op?.level ?? 1}
        />
        {/* Lighting selector */}
        <div className="absolute right-3 top-3 flex gap-1 rounded border border-ink-600 bg-ink-900/80 p-1 backdrop-blur">
          {(
            [
              ['sunset', '🌅'],
              ['dusk', '🌆'],
              ['neutral', '☀️'],
              ['night', '🌙'],
            ] as [LightingPreset, string][]
          ).map(([p, icon]) => (
            <button
              key={p}
              title={p}
              onClick={() => changePreset(p)}
              className={`rounded px-2 py-1 text-sm ${preset === p ? 'bg-amber-500/20' : 'hover:bg-ink-700'}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Modals */}
      {deployOpen && (
        <DeployModal
          onClose={() => setDeployOpen(false)}
          busy={busy}
          onDeploy={(familyKey) =>
            run('mint', async () => {
              await api.mintNode(wallet!, familyKey);
              setDeployOpen(false);
              say('Node deployed — production started');
            })
          }
        />
      )}
      {crateOpen && (
        <CratePicker
          onClose={() => setCrateOpen(false)}
          busy={busy}
          op={op}
          onOpen={openCrate}
        />
      )}
      {crateResult && (
        <CrateCinematic
          result={crateResult}
          onClose={() => setCrateResult(null)}
          onOpenAnother={() => {
            setCrateResult(null);
            openCrate(lastCrateType);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-steel-200 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function CompoundPanel({
  busy,
  run,
}: {
  busy: string | null;
  run: (label: string, fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const { op, wallet } = useOperation();
  if (!op) return null;
  const c = op.compound;
  const next = c.nextUpgradeCost;
  const cooling = c.cooldownRemainingMs > 0;
  return (
    <div className="panel p-4">
      <div className="mb-1 flex items-center justify-between">
        <div className="stat-label">Compound Upgrade</div>
        {next && <span className="font-mono text-[11px] text-steel-400">L{c.level} → L{next.targetLevel}</span>}
      </div>
      {next ? (
        <>
          <div className="text-sm text-steel-300">
            {next.totalOsr.toLocaleString()} OSR
            <span className="text-[11px] text-steel-500"> · 50/30/20 burn/reserve/treasury · +0.001 SOL</span>
          </div>
          {cooling && (
            <div className="mt-1 text-[11px] text-amber-500">
              Ready in <Countdown ms={c.cooldownRemainingMs} />
            </div>
          )}
          <div className="mt-2 grid grid-cols-1 gap-2">
            <button
              className="btn-primary"
              disabled={busy === 'upgrade' || cooling}
              onClick={() =>
                run('upgrade', async () => {
                  await api.upgradeCompound(wallet!);
                }, 'Compound upgraded!')
              }
            >
              {busy === 'upgrade' ? 'Upgrading…' : 'Confirm Upgrade'}
            </button>
            {cooling && (
              <button
                className="btn-secondary"
                title="Pay 1 SOL to skip the cooldown and upgrade now"
                disabled={busy === 'expedite'}
                onClick={() => {
                  if (confirm('Skip cooldown for 1 SOL (~$170)?'))
                    run('expedite', async () => {
                      await api.expediteCompound(wallet!);
                    }, 'Compound expedited!');
                }}
              >
                Skip Cooldown (1 SOL)
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] text-steel-500">12h cooldown applies after upgrade</p>
        </>
      ) : (
        <div className="text-sm text-steel-400">
          Max Level · {c.maxNodes} nodes · {c.cratesPerDay} crates/day
        </div>
      )}
    </div>
  );
}

function NodeDetail({
  node,
  busy,
  run,
  onOpenCrate,
}: {
  node: NodeInfo;
  busy: string | null;
  run: (label: string, fn: () => Promise<unknown>, success?: string) => Promise<void>;
  onOpenCrate: () => void;
}) {
  const { wallet } = useOperation();
  const slots = NODE_SLOTS[node.type === 'oil' ? 'oil' : 'mine'];
  const fill = node.storageCap > 0 ? Math.min(1, node.pendingOsr / node.storageCap) : 0;
  const fillColor = fill >= 0.999 ? '#dc2626' : fill >= 0.85 ? '#ea580c' : fill >= 0.5 ? '#f59e0b' : '#71717a';
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="stat-label">
          {node.type === 'oil' ? 'Oil Rig' : 'Mining Shaft'} · L{node.level}
        </div>
        <span className="font-mono text-[11px] text-amber-400">
          {node.componentMultiplier.toFixed(2)}× GP
        </span>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-[11px] text-steel-400">
          <span>Storage {fill >= 0.999 ? '· FULL' : ''}</span>
          <span className="font-mono">
            {fmt(node.pendingOsr)} / {fmt(node.storageCap)}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded bg-ink-700">
          <div className="h-full transition-all" style={{ width: `${fill * 100}%`, background: fillColor }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {slots.map((slot) => {
          const comp = node.components.find((c) => c.slot === slot);
          const rarity = (comp?.rarity ?? null) as Rarity | null;
          return (
            <div
              key={slot}
              className="rounded border border-ink-600 bg-ink-800 p-2"
              style={rarity ? { borderColor: `${'#' + COMPONENT_RARITIES[rarity].tint.toString(16).padStart(6, '0')}66` } : undefined}
            >
              <div className="flex items-center gap-1 text-[11px] text-steel-300">
                <span>{SLOT_GLYPH[slot]}</span> {SLOT_LABELS[slot]}
              </div>
              {rarity ? (
                <div
                  className="mt-0.5 font-mono text-[11px] font-bold uppercase"
                  style={{ color: '#' + COMPONENT_RARITIES[rarity].tint.toString(16).padStart(6, '0') }}
                >
                  {COMPONENT_RARITIES[rarity].label} · {RARITY_MULT[rarity]}×
                </div>
              ) : (
                <div className="mt-0.5 text-[11px] text-steel-500">— empty —</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn-secondary text-xs" onClick={onOpenCrate}>
          Open Supply Crate
        </button>
        <button
          className="btn-secondary text-xs"
          disabled={busy === 'nodeUp'}
          onClick={() =>
            run('nodeUp', async () => {
              await api.upgradeNode(wallet!, node.id);
            }, `Node leveled up!`)
          }
        >
          Level Up · {node.nextLevelCost.toLocaleString()} OSR
        </button>
      </div>
      {node.type === 'mine' && node.pendingOsr > 0 && (
        <button
          className="btn-secondary mt-2 w-full text-xs"
          disabled={busy === 'compound'}
          onClick={() =>
            run('compound', async () => {
              await api.claim(wallet!, node.id, 'compound');
            }, 'Compounded at 0.75% fee')
          }
        >
          Compound Pending → Balance (0.75% fee)
        </button>
      )}
    </div>
  );
}

function DeployModal({
  onClose,
  onDeploy,
  busy,
}: {
  onClose: () => void;
  onDeploy: (familyKey: string) => void;
  busy: string | null;
}) {
  const [families, setFamilies] = useState<Awaited<ReturnType<typeof api.families>> | null>(null);
  const [sel, setSel] = useState<string>('oil_rig');
  useEffect(() => {
    api.families().then(setFamilies).catch(() => setFamilies(null));
  }, []);
  return (
    <Modal onClose={onClose} title="Deploy Node">
      <div className="flex flex-col gap-2">
        {(families ?? []).map((f) => (
          <button
            key={f.key}
            onClick={() => setSel(f.key)}
            className={`rounded border p-3 text-left transition ${
              sel === f.key ? 'border-amber-500 bg-amber-500/10' : 'border-ink-600 bg-ink-800 hover:border-steel-500'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{f.family === 'oil' ? '⛽' : '⛏'}</span>
              <span className="font-semibold text-white">{f.name}</span>
              <span className="ml-auto font-mono text-sm text-amber-400">
                {f.burnCostOsr.toLocaleString()} OSR
              </span>
            </div>
            <p className="mt-1 text-xs text-steel-400">{f.description}</p>
            <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-steel-500">
              <span>→ burned {(f.burnCostOsr * f.burnShareBps) / 10000}</span>
              <span>→ treasury {(f.burnCostOsr * f.treasuryShareBps) / 10000}</span>
              <span>+ {(f.solMintFeeLamports / 1e9).toFixed(2)} SOL fee</span>
            </div>
          </button>
        ))}
        {!families && <div className="text-sm text-steel-400">Loading families…</div>}
        <button className="btn-primary mt-2" disabled={busy === 'mint'} onClick={() => onDeploy(sel)}>
          {busy === 'mint' ? 'Igniting…' : 'Deploy · Starting level L1'}
        </button>
      </div>
    </Modal>
  );
}

function CratePicker({
  onClose,
  onOpen,
  busy,
  op,
}: {
  onClose: () => void;
  onOpen: (t: 'rig_crate' | 'shaft_crate') => void;
  busy: string | null;
  op: ReturnType<typeof useOperation.getState>['op'];
}) {
  const wallet = useOperation((s) => s.wallet);
  const [odds, setOdds] = useState<Awaited<ReturnType<typeof api.crateOdds>> | null>(null);
  useEffect(() => {
    if (wallet) api.crateOdds(wallet).then(setOdds).catch(() => setOdds(null));
  }, [wallet]);
  const cost = getCrateCost(op?.level ?? 1);
  return (
    <Modal onClose={onClose} title="Supply Crates">
      {odds && (
        <>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {odds.odds.map(({ rarity, chance }) => (
              <div key={rarity} className="rounded bg-ink-800 p-1 text-center">
                <div
                  className="font-mono text-[9px] font-bold uppercase"
                  style={{ color: '#' + COMPONENT_RARITIES[rarity as Rarity].tint.toString(16).padStart(6, '0') }}
                >
                  {rarity.slice(0, 3)}
                </div>
                <div className="text-[10px] text-steel-400">{(chance * 100).toFixed(chance < 0.01 ? 1 : 0)}%</div>
              </div>
            ))}
          </div>
          <p className="mb-3 text-[10px] leading-relaxed text-steel-500">
            Bad-Luck Protection (free): Legendary+ within {odds.guarantees.legendaryPlus} · Mythic+
            within {odds.guarantees.mythicPlus} · Divine within {odds.guarantees.divine}.
            {odds.pity && <> Streak: {odds.pity.sinceLegendaryPlus} since Legendary+.</>}
          </p>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <CrateCard
          tone="amber"
          title="Rig Crate"
          remaining={op?.crateCooldown.rigCratesRemaining ?? 0}
          perDay={op?.compound.cratesPerDay ?? 3}
          cost={cost}
          disabled={busy === 'crate' || (op?.crateCooldown.rigCratesRemaining ?? 0) <= 0}
          onOpen={() => onOpen('rig_crate')}
        />
        <CrateCard
          tone="steel"
          title="Shaft Crate"
          remaining={op?.crateCooldown.shaftCratesRemaining ?? 0}
          perDay={op?.compound.cratesPerDay ?? 3}
          cost={cost}
          disabled={busy === 'crate' || (op?.crateCooldown.shaftCratesRemaining ?? 0) <= 0}
          onOpen={() => onOpen('shaft_crate')}
        />
      </div>
    </Modal>
  );
}

function CrateCard({
  tone,
  title,
  remaining,
  perDay,
  cost,
  disabled,
  onOpen,
}: {
  tone: 'amber' | 'steel';
  title: string;
  remaining: number;
  perDay: number;
  cost: number;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      className={`rounded border p-3 ${tone === 'amber' ? 'border-amber-500/40 bg-amber-500/5' : 'border-steel-500/40 bg-steel-500/5'}`}
    >
      <div className="text-2xl">{tone === 'amber' ? '🛢️' : '⚒️'}</div>
      <div className="mt-1 font-semibold text-white">{title}</div>
      <div className="text-[11px] text-steel-400">
        {remaining}/{perDay} remaining today
      </div>
      <button className="btn-primary mt-2 w-full text-sm" disabled={disabled} onClick={onOpen}>
        Open · {cost.toLocaleString()} OSR
      </button>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-ink-900/85 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-ink-600 bg-ink-800 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-sm uppercase tracking-widest text-amber-500">{title}</h2>
          <button className="text-steel-400 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
