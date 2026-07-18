'use client';

import Link from 'next/link';
import WalletButton from '@/components/ui/WalletButton';
import DisclaimerModal from '@/components/ui/DisclaimerModal';
import { useEvmWallet } from '@/lib/evm';
import { CHAIN, CONTRACTS_CONFIGURED } from '@/lib/config';

function OsrBalancePill() {
  const osrBalance = useEvmWallet((state) => state.osrBalance);
  const symbol = useEvmWallet((state) => state.osrSymbol);
  if (!CONTRACTS_CONFIGURED || osrBalance == null) return null;
  return (
    <div className="hidden items-center gap-1 rounded border border-amber-500/40 bg-ink-800 px-3 py-1.5 font-mono text-xs text-amber-400 sm:flex">
      {Number(osrBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
      <span className="text-steel-400">{symbol}</span>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-900">
      <div className="border-b border-emerald-500/30 bg-emerald-500/10 py-1 text-center font-mono text-[11px] uppercase tracking-widest text-emerald-400">
        {CHAIN.name} — Mainnet · chain {CHAIN.id}
      </div>
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-600 bg-ink-900/95 px-4 py-2 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="OSR" className="h-7 w-7 rounded" />
          <span className="font-mono text-lg font-bold tracking-widest text-amber-500">OSR</span>
          <span className="hidden text-xs uppercase tracking-widest text-steel-400 sm:inline">
            Oil Strategic Reserve
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <OsrBalancePill />
          <WalletButton />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <DisclaimerModal />
    </div>
  );
}
