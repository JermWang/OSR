'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpenText,
  Buildings,
  ChartLineUp,
  Coins,
  Command,
  GasPump,
  Medal,
  Package,
  UserCircle,
  XLogo,
  type Icon,
} from '@phosphor-icons/react';
import { X_URL } from '@/lib/config';

const LINKS: Array<{ href: string; label: string; Icon: Icon }> = [
  { href: '/app', label: 'Command', Icon: Command },
  { href: '/app/inventory', label: 'Inventory', Icon: Package },
  { href: '/app/vault', label: 'Vault', Icon: Buildings },
  { href: '/app/ops', label: 'Ops', Icon: GasPump },
  { href: '/app/market', label: 'Market', Icon: ChartLineUp },
  { href: '/app/tokenomics', label: 'Tokenomics', Icon: Coins },
  { href: '/app/leaderboard', label: 'Leaderboard', Icon: Medal },
  { href: '/app/profile', label: 'Profile', Icon: UserCircle },
  { href: '/app/docs', label: 'Guide', Icon: BookOpenText },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden items-center gap-1 overflow-x-auto px-[22px] py-2 md:flex" aria-label="Primary navigation">
        {LINKS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-1.5 rounded-[9px] border px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[.12em] transition ${
                active
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-transparent text-steel-300 hover:text-amber-300'
              }`}
            >
              <Icon size={14} weight={active ? 'fill' : 'duotone'} aria-hidden />
              {label}
            </Link>
          );
        })}
        <a
          href={X_URL}
          target="_blank"
          rel="noreferrer"
          title="Follow OSR on X"
          className="ml-auto shrink-0 rounded-[9px] border border-transparent px-2.5 py-2 text-steel-300 transition hover:border-amber-500/30 hover:text-amber-300"
        >
          <XLogo size={15} weight="fill" aria-hidden />
        </a>
      </nav>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[.08] bg-ink-950/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch overflow-x-auto">
          {LINKS.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2 ${
                  active ? 'text-amber-300' : 'text-steel-400'
                }`}
              >
                <Icon size={16} weight={active ? 'fill' : 'duotone'} aria-hidden />
                <span className="truncate font-mono text-[8px] uppercase tracking-wider">{label}</span>
              </Link>
            );
          })}
          <a href={X_URL} target="_blank" rel="noreferrer" className="flex min-w-[54px] flex-1 flex-col items-center gap-0.5 py-2 text-steel-400">
            <XLogo size={15} weight="fill" aria-hidden />
            <span className="font-mono text-[8px] uppercase tracking-wider">X</span>
          </a>
        </div>
      </nav>
    </>
  );
}
