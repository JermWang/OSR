'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Play, Wallet } from '@phosphor-icons/react';
import { CHAIN } from '@/lib/config';
import { SHOWROOM_NODES } from '@/components/three/Compound';

const Scene = dynamic(() => import('@/components/three/Scene'), { ssr: false });

const STATS = [
  ['229M', 'OSR supply', 'sm:w-[22%]'],
  ['12,847', 'nodes deployed', 'sm:w-[28%]'],
  ['7', 'rarity tiers', 'sm:w-[20%]'],
  ['30%', 'share cap', 'sm:w-[22%]'],
];

export default function Landing() {
  return (
    <main className="relative min-h-[max(100vh,760px)] overflow-hidden bg-[#0a0a1e] md:h-screen md:min-h-[680px]">
      <div className="absolute inset-0">
        <Scene nodes={SHOWROOM_NODES} preset="sunset" selectedNodeId={null} focusNodeId={null} variant="landing" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_44%,rgba(6,8,13,.16),rgba(6,8,13,.48)_76%),linear-gradient(180deg,rgba(169,181,174,.30),transparent_34%,rgba(184,105,42,.10)_66%,rgba(6,8,13,.46))]" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_50px_rgba(6,8,13,.58)]" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-3 p-5 md:px-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="OSR" className="h-10 w-10 rounded-[11px] shadow-[0_0_0_1px_rgba(245,166,35,.5),0_8px_22px_-6px_rgba(245,166,35,.6)]" />
        <div className="leading-none">
          <div className="gold-text font-mono text-[19px] font-bold tracking-[.3em]">OSR</div>
          <div className="mt-1 font-mono text-[8px] uppercase tracking-[.32em] text-amber-100/70">Oil Strategic Reserve</div>
        </div>
        <div className="ml-auto hidden items-center gap-3 sm:flex">
          <div className="glass-control flex items-center gap-2 rounded-full border-emerald-400/35 px-4 py-2 font-mono text-[10px] uppercase tracking-[.14em] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
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
        <p className="mx-auto mt-5 max-w-[560px] text-[15px] leading-7 text-[#fff0e1]/85 md:text-base">
          Deploy rigs and mining shafts across your 3D compound. Open crates, equip rarity gear, and climb the reserve on {CHAIN.name}.
        </p>
        <div className="mt-11 flex flex-col items-center gap-3">
          <Link href="/app" className="btn-primary pointer-events-auto relative flex w-[min(390px,86vw)] items-center justify-center gap-2 overflow-hidden px-10 py-4 text-lg">
            <span className="absolute inset-y-0 left-0 w-2/5 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent [animation:sweep_3.2s_ease-in-out_infinite]" />
            <Play size={19} weight="fill" aria-hidden />
            Enter the Reserve
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[.2em] text-amber-100/70">Deploy your first rig to begin</span>
        </div>
      </section>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[1000px] flex-wrap justify-center gap-2 bg-gradient-to-t from-ink-950/65 to-transparent px-4 pb-6 pt-16">
        {STATS.map(([value, label, width]) => (
          <div key={label} className={`glass-control flex items-center justify-center gap-2 rounded-xl border-amber-400/20 px-5 py-2 ${width}`}>
            <span className="font-mono text-lg font-bold text-amber-300">{value}</span>
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-100/60">{label}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
