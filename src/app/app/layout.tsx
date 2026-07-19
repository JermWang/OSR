'use client';

import Link from 'next/link';
import WalletButton from '@/components/ui/WalletButton';
import DisclaimerModal from '@/components/ui/DisclaimerModal';
import NavBar from '@/components/ui/NavBar';
import { useEvmWallet } from '@/lib/evm';
import { CHAIN, CONTRACTS_CONFIGURED } from '@/lib/config';

function OsrBalancePill() {
  const osrBalance = useEvmWallet((state) => state.osrBalance);
  const symbol = useEvmWallet((state) => state.osrSymbol);
  if (!CONTRACTS_CONFIGURED || osrBalance == null) return null;
  return (
    <div className="hidden items-center gap-2 rounded-[10px] border border-amber-500/30 bg-ink-800 px-3 py-2 font-mono text-xs text-amber-300 sm:flex">
      <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-amber-100 via-amber-400 to-amber-700 text-[7px] text-[#3a1e05]">◆</span>
      {Number(osrBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
      <span className="text-[10px] text-steel-500">{symbol}</span>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-surface flex min-h-screen flex-col">
      <div className="border-b border-emerald-500/20 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent py-[5px] text-center font-mono text-[10.5px] uppercase tracking-[.24em] text-emerald-400">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#00c805]" />
        {CHAIN.name} — Mainnet · chain {CHAIN.id} · gas ETH
      </div>
      <div className="sticky top-0 z-40 border-b border-white/[.07] bg-[#080808]/90 shadow-[0_18px_50px_-34px_rgba(0,0,0,.95)] backdrop-blur-xl">
        <header className="flex items-center gap-3 border-b border-white/[.07] px-4 py-2.5 md:px-[22px]">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="OSR" className="h-[34px] w-[34px] rounded-[10px] shadow-[0_0_0_1px_rgba(245,166,35,.4),0_6px_18px_-6px_rgba(245,166,35,.5)]" />
            <span className="leading-none">
              <span className="gold-text block font-mono text-[18px] font-bold tracking-[.28em]">OSR</span>
              <span className="mt-0.5 hidden font-mono text-[8.5px] uppercase tracking-[.34em] text-steel-500 sm:block">Oil Strategic Reserve</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <OsrBalancePill />
            <WalletButton />
          </div>
        </header>
        <NavBar />
      </div>
      <div className="flex-1">{children}</div>
      <DisclaimerModal />
    </div>
  );
}
