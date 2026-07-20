'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Play, Wallet } from '@phosphor-icons/react';
import { CHAIN } from '@/lib/config';
import { SHOWROOM_NODES } from '@/components/three/Compound';
import CopyContract from '@/components/ui/CopyContract';
import { RARITIES } from '@/lib/rarity';

const Scene = dynamic(() => import('@/components/three/Scene'), { ssr: false });

/** Compact figure: 1000000000 -> 1B, 12847 -> 12,847. */
function compact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M`;
  return Math.round(n).toLocaleString();
}

const MOTES = [
  { left: '12%', bottom: '24%', size: 4, alpha: 0.8, anim: 'drift 9s linear infinite' },
  { left: '82%', bottom: '20%', size: 3, alpha: 0.7, anim: 'drift 11s linear infinite 2s' },
  { left: '74%', bottom: '30%', size: 5, alpha: 0.6, anim: 'drift 13s linear infinite 4s' },
];

export default function Landing() {
  // Live protocol figures. Nothing here is invented: supply, deployed nodes and
  // the share cap all come from the running protocol, so the landing never
  // advertises a network larger than the one that exists.
  const [stats, setStats] = useState<Array<[string, string]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Plain fetch, not the shared api client: this endpoint is public, and the
    // client pulls in Privy to attach auth headers. The landing renders outside
    // the Privy provider, so that dependency buys nothing and can stall the
    // request before it is ever sent.
    void (async () => {
      try {
        const res = await fetch('/api/protocol/overview', { cache: 'no-store' });
        if (!res.ok) throw new Error(`overview ${res.status}`);
        const o = (await res.json()) as {
          totalSupply: number;
          totalNodes: number;
          emissionFactors: { shareCap: number };
        };
        if (cancelled) return;
        setStats([
          [compact(o.totalSupply), 'OSR supply'],
          [compact(o.totalNodes), o.totalNodes === 1 ? 'node deployed' : 'nodes deployed'],
          [String(RARITIES.length), 'rarity tiers'],
          [`${Math.round(o.emissionFactors.shareCap * 100)}%`, 'share cap'],
        ]);
      } catch (e) {
        // Keep the strip hidden rather than showing invented numbers, but never
        // swallow the reason — a silent catch here hid a real failure once.
        console.error('[landing] protocol overview unavailable', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="relative min-h-[max(100vh,760px)] overflow-hidden bg-[#080808] md:h-screen md:min-h-[680px]">
      <div className="absolute inset-0 z-[3]">
        <Scene nodes={SHOWROOM_NODES} preset="sunset" selectedNodeId={null} focusNodeId={null} variant="landing" />
      </div>

      {/* Dust motes sit above the compound but below the scrim. */}
      {MOTES.map((m, i) => (
        <div
          key={`mote-${i}`}
          aria-hidden
          className="pointer-events-none absolute z-[5] rounded-full blur-[1px]"
          style={{
            left: m.left,
            bottom: m.bottom,
            width: m.size,
            height: m.size,
            background: `rgba(255,214,150,${m.alpha})`,
            animation: m.anim,
          }}
        />
      ))}

      <div className="pointer-events-none absolute inset-0 z-[6] bg-[radial-gradient(ellipse_70%_60%_at_50%_44%,rgba(6,8,13,.16),rgba(6,8,13,.48)_76%),linear-gradient(180deg,rgba(169,181,174,.30),transparent_34%,rgba(184,105,42,.10)_66%,rgba(6,8,13,.46))]" />
      <div className="pointer-events-none absolute inset-0 z-[6] shadow-[inset_0_0_180px_50px_rgba(6,8,13,.58)]" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3.5 p-5 md:px-[26px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="OSR" className="h-10 w-10 rounded-[11px] shadow-[0_0_0_1px_rgba(245,166,35,.5),0_8px_22px_-6px_rgba(245,166,35,.6)]" />
        <div className="leading-none">
          <div className="gold-text font-mono text-[19px] font-bold tracking-[.3em]">OSR</div>
          <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[.32em] text-amber-100/70">Oil Strategic Reserve</div>
        </div>
        <div className="ml-auto hidden items-center gap-3 sm:flex">
          <div className="glass-control flex items-center gap-2 rounded-full border-emerald-400/35 px-4 py-2 font-mono text-[10px] uppercase tracking-[.14em] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#00c805]" />
            Season 1 · Halving live
          </div>
          <Link href="/app" className="glass-control pointer-events-auto flex items-center gap-2 rounded-full border-amber-400/40 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-amber-300 transition hover:bg-amber-500/15">
            <Wallet size={14} weight="duotone" aria-hidden />
            Connect wallet
          </Link>
        </div>
      </header>

      <section className="pointer-events-none absolute inset-x-0 top-1/2 z-10 mx-auto w-[min(94%,860px)] -translate-y-[62%] text-center">
        <div className="glass-control inline-flex rounded-full border-amber-400/35 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[.22em] text-amber-100/85">Build · Mine · Compound</div>
        <h1 className="landing-title mt-4 text-[clamp(50px,9vw,108px)] font-bold leading-[.96] tracking-[-.04em] text-white">
          The on-chain<br />
          <span className="bg-gradient-to-br from-[#ffe0a3] via-[#f5a623] to-[#ff7a29] bg-clip-text text-transparent">oil empire.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[520px] text-[15px] leading-relaxed text-[#fff0e1]/85 [text-shadow:0_2px_12px_rgba(0,0,0,.5)] md:text-base">
          Deploy rigs and mining shafts across your 3D compound. Open crates, equip rarity gear, and climb the reserve on {CHAIN.name}.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link href="/app" className="btn-hero pointer-events-auto relative flex w-[min(390px,86vw)] items-center justify-center gap-2 overflow-hidden px-10 py-4 text-lg">
            <span className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-transparent via-white/55 to-transparent [animation:sweep_3.2s_ease-in-out_infinite]" />
            <Play size={19} weight="fill" aria-hidden />
            Enter the Reserve
          </Link>
          <span className="landing-blink font-mono text-[11px] uppercase tracking-[.18em] text-amber-100/75">Deploy your first rig to start earning</span>
          {/* Self-hiding until the token exists — see CopyContract. */}
          <CopyContract />
        </div>
      </section>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap justify-center gap-2.5 bg-gradient-to-b from-transparent to-ink-950/55 px-[26px] pb-[26px] pt-5">
        {(stats ?? []).map(([value, label]) => (
          <div key={label} className="glass-control flex items-center gap-2.5 rounded-xl border-amber-400/25 px-[18px] py-2.5">
            <span className="whitespace-nowrap font-mono text-[19px] font-bold text-amber-300">{value}</span>
            <span className="whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[.16em] text-amber-100/65">{label}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
