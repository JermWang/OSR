'use client';

import Link from 'next/link';
import NavBar from './NavBar';

interface PageShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  /** Tailwind max-width class for the header + main content column. */
  maxWidth?: string;
  children: React.ReactNode;
}

export default function PageShell({
  title,
  subtitle,
  backHref = '/',
  backLabel = '← OSR',
  maxWidth = 'max-w-5xl',
  children,
}: PageShellProps) {
  return (
    <div className="min-h-screen bg-ink-900 text-steel-200">
      <header className="sticky top-0 z-40 border-b border-ink-600 bg-ink-900/95 backdrop-blur">
        <div className={`mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 md:px-6 ${maxWidth}`}>
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href={backHref}
              className="shrink-0 font-mono text-xs uppercase tracking-widest text-steel-400 transition hover:text-amber-500"
            >
              {backLabel}
            </Link>
            <div className="min-w-0">
              <h1 className="truncate font-mono text-sm font-bold uppercase tracking-widest text-steel-200 md:text-base">
                {title}
              </h1>
              {subtitle && <p className="truncate text-xs text-steel-400">{subtitle}</p>}
            </div>
          </div>
          <NavBar />
        </div>
      </header>
      <main
        className={`mx-auto w-full p-4 pb-[calc(env(safe-area-inset-bottom)+72px)] md:p-6 md:pb-6 ${maxWidth}`}
      >
        {children}
      </main>
    </div>
  );
}
