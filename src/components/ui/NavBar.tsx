'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X_URL } from '@/lib/config';

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const LINKS: Array<{ href: string; label: string; glyph: string }> = [
  { href: '/app', label: 'Command', glyph: '⌂' },
  { href: '/app/inventory', label: 'Inventory', glyph: '🎒' },
  { href: '/app/vault', label: 'Vault', glyph: '🏦' },
  { href: '/app/ops', label: 'Ops', glyph: '⛽' },
  { href: '/app/market', label: 'Market', glyph: '📈' },
  { href: '/app/tokenomics', label: 'Tokenomics', glyph: '🪙' },
  { href: '/app/leaderboard', label: 'Leaderboard', glyph: '🏆' },
  { href: '/app/profile', label: 'Profile', glyph: '◉' },
  { href: '/app/docs', label: 'Guide', glyph: '📖' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop pill nav */}
      <nav className="hidden items-center gap-1 rounded-md border border-steel-500/50 bg-ink-800/90 p-1 backdrop-blur md:flex">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`rounded px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest transition ${
                active ? 'bg-amber-500 text-ink-900' : 'text-steel-300 hover:text-amber-500'
              }`}
            >
              {label}
            </Link>
          );
        })}
        <a
          href={X_URL}
          target="_blank"
          rel="noreferrer"
          title="Follow OSR on X"
          className="ml-1 rounded px-2.5 py-1.5 text-steel-300 transition hover:text-amber-500"
        >
          <XLogo className="h-3.5 w-3.5" />
        </a>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-600 bg-ink-900/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch overflow-x-auto">
          {LINKS.map(({ href, label, glyph }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-w-[64px] flex-1 flex-col items-center gap-0.5 py-2 ${
                  active ? 'text-amber-500' : 'text-steel-400'
                }`}
              >
                <span aria-hidden className="text-sm leading-none">
                  {glyph}
                </span>
                <span className="truncate font-mono text-[8px] uppercase tracking-wider">
                  {label}
                </span>
              </Link>
            );
          })}
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-[54px] flex-1 flex-col items-center gap-0.5 py-2 text-steel-400"
          >
            <XLogo className="h-3.5 w-3.5" />
            <span className="truncate font-mono text-[8px] uppercase tracking-wider">X</span>
          </a>
        </div>
      </nav>
    </>
  );
}
