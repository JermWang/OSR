'use client';

import { usePathname } from 'next/navigation';
import { useWalletStore } from '@/lib/store';

export default function DisclaimerModal() {
  const pathname = usePathname();
  const termsAcceptedAt = useWalletStore((s) => s.termsAcceptedAt);
  const acceptTerms = useWalletStore((s) => s.acceptTerms);
  const wallet = useWalletStore((s) => s.wallet);

  if (pathname === '/' || pathname?.startsWith('/rarity-test') || termsAcceptedAt) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/95 p-6">
      <div className="max-w-lg rounded-lg border border-amber-500/50 bg-ink-800 p-6">
        <h2 className="mb-3 font-mono text-sm uppercase tracking-widest text-amber-500">
          DEVNET — Test tokens only
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-steel-300">
          You’re about to try OSR on Solana <strong>devnet</strong>. All tokens here are test
          tokens with no real value. We’ll auto-drip 0.05 devnet SOL and 2500 starter OSR to your
          wallet on first connect so you can start immediately — no external faucet needed. Phantom
          must be set to <strong>Devnet</strong> (Settings → Developer Settings). Or use{' '}
          <strong>Play as Guest</strong> — no wallet needed, same game.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="w-full rounded border border-steel-500/60 py-3 font-semibold text-steel-200 hover:border-steel-400 hover:bg-ink-700/60 sm:w-1/3"
            onClick={() => window.location.replace('/')}
          >
            Decline
          </button>
          <button
            className="w-full rounded bg-amber-500 py-3 font-semibold text-ink-900 hover:bg-amber-400 sm:flex-1"
            onClick={() => acceptTerms()}
          >
            {wallet ? 'I understand and accept' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
