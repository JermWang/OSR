'use client';

import Link from 'next/link';

interface PageShellProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
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
    <div className="min-h-full text-steel-200">
      <main className={`mx-auto w-full p-5 pb-[calc(env(safe-area-inset-bottom)+76px)] md:px-[22px] md:py-8 md:pb-10 ${maxWidth}`}>
        <div className="mb-6 flex min-w-0 items-start gap-4">
          <Link
            href={backHref}
            className="mt-1 hidden shrink-0 font-mono text-[10px] uppercase tracking-[.16em] text-steel-500 transition hover:text-amber-300 lg:block"
          >
            {backLabel}
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-[-.025em] text-steel-100 md:text-[28px]">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-steel-400">{subtitle}</p>}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
