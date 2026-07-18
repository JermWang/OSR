'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS: Array<{ href: string; label: string; glyph: string }> = [
  { href: '/app', label: 'Command', glyph: '⌂' },
  { href: '/app/inventory', label: 'Inventory', glyph: '🎒' },
  { href: '/app/vault', label: 'Vault', glyph: '🏦' },
  { href: '/app/ops', label: 'Ops', glyph: '⛽' },
  { href: '/app/market', label: 'Market', glyph: '📈' },
  { href: '/app/tokenomics', label: 'Tokenomics', glyph: '🪙' },
  { href: '/app/leaderboard', label: 'Leaderboard', glyph: '🏆' },
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
      </nav>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-600 bg-ink-900/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {LINKS.map(({ href, label, glyph }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 ${
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
        </div>
      </nav>
    </>
  );
}
