import Link from 'next/link';
import { CHAIN, X_URL } from '@/lib/config';

export default function Landing() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 120%, rgba(245,158,11,0.18), transparent 60%), linear-gradient(180deg, #0b0e14 0%, #1a1024 55%, #3a1d24 100%)',
        }}
      />
      <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="OSR" className="mb-5 h-16 w-16 rounded-xl shadow-lg shadow-amber-500/20" />
        <div className="mb-6 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 font-mono text-[11px] uppercase tracking-widest text-emerald-400">
          {CHAIN.name} · Mainnet
        </div>
        <h1 className="font-mono text-5xl font-bold tracking-tight text-white sm:text-6xl">
          <span className="text-amber-500">OSR</span> — Oil Strategic Reserve
        </h1>
        <p className="mt-4 text-lg text-steel-300">The on-chain oil empire.</p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-steel-400">
          Burn OSR, build rigs, mine strategic reserves on {CHAIN.name} — Robinhood’s EVM L2
          settling on Ethereum. Deploy oil rigs and mining shafts on your own 3D compound, open
          supply crates for rarity-tiered components, and compound your way up the leaderboard.
          Contract-backed balances are read directly from the connected wallet.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/app"
            className="rounded bg-amber-500 px-10 py-3 text-lg font-bold text-ink-900 transition hover:bg-amber-400"
          >
            Get Started
          </Link>
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-steel-500/60 px-6 py-3 font-semibold text-steel-200 transition hover:border-steel-400 hover:bg-ink-700/60"
          >
            Follow on 𝕏
          </a>
        </div>
        <div className="mt-10 grid w-full max-w-lg grid-cols-2 gap-4">
          <div className="panel flex flex-col items-center gap-2 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/oil rig.png" alt="Oil Rig" className="h-24 w-24 rounded object-cover" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-amber-400">Oil Rig</span>
          </div>
          <div className="panel flex flex-col items-center gap-2 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mining shaft.png" alt="Mining Shaft" className="h-24 w-24 rounded object-cover" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-steel-300">Mining Shaft</span>
          </div>
        </div>
        <p className="mt-6 text-xs text-steel-500">
          Sign in with email or Google for an instant Privy embedded wallet, or link MetaMask,
          Rabby, or Robinhood Wallet. {CHAIN.name} (chain {CHAIN.id}) is configured automatically.
        </p>
      </div>
    </main>
  );
}
