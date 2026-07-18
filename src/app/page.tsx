import Link from 'next/link';

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
        <div className="mb-6 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1 font-mono text-[11px] uppercase tracking-widest text-amber-500">
          Solana Devnet · Test Tokens Only
        </div>
        <h1 className="font-mono text-5xl font-bold tracking-tight text-white sm:text-6xl">
          <span className="text-amber-500">OSR</span> — Oil Strategic Reserve
        </h1>
        <p className="mt-4 text-lg text-steel-300">Try OSR — free, no risk.</p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-steel-400">
          Burn OSR, build rigs, mine strategic reserves. This is a live devnet build — everything
          is test tokens with no real value. We’ll drip you 0.05 devnet SOL and 2500 starter OSR
          automatically on first connect. Setup takes about 90 seconds.
        </p>
        <Link
          href="/app"
          className="mt-8 rounded bg-amber-500 px-10 py-3 text-lg font-bold text-ink-900 transition hover:bg-amber-400"
        >
          Get Started
        </Link>
        <p className="mt-6 text-xs text-steel-500">
          You’ll need a Solana wallet (Phantom recommended) on the devnet network — or just play as
          a guest. Test tokens only — no real money at risk.
        </p>
      </div>
    </main>
  );
}
