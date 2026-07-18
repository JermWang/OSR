'use client';

import Link from 'next/link';
import WalletButton from '@/components/ui/WalletButton';
import DisclaimerModal from '@/components/ui/DisclaimerModal';
import { useOperation } from '@/lib/useOperation';

function OsrBalancePill() {
  const op = useOperation((s) => s.op);
  if (!op) return null;
  return (
    <div className="hidden items-center gap-1 rounded border border-amber-500/40 bg-ink-800 px-3 py-1.5 font-mono text-xs text-amber-400 sm:flex">
      {Math.floor(op.osrBalance).toLocaleString()} <span className="text-steel-400">OSR</span>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-900">
      <div className="border-b border-amber-500/30 bg-amber-500/10 py-1 text-center font-mono text-[11px] uppercase tracking-widest text-amber-500">
        DEVNET — test tokens only, not real funds
      </div>
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-600 bg-ink-900/95 px-4 py-2 backdrop-blur">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold tracking-widest text-amber-500">OIL</span>
          <span className="text-xs uppercase tracking-widest text-steel-400">Strategic Reserve</span>
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
