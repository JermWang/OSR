'use client';

// Site-wide deploy banner.
//
// Mounted once in the app layout. Starts the status poller and shows a fixed
// bar while a release is rolling out, then confirms and reloads onto the new
// build. Deliberately fixed to the top and above everything: a player who does
// not see it is a player who starts an action that gets cut in half.

import { useEffect } from 'react';
import { useDeployStatus } from '@/lib/useDeployStatus';

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function DeployNotice() {
  const start = useDeployStatus((s) => s.start);
  const stop = useDeployStatus((s) => s.stop);
  const deploying = useDeployStatus((s) => s.deploying);
  const secondsLeft = useDeployStatus((s) => s.secondsLeft);
  const stale = useDeployStatus((s) => s.stale);

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  if (!deploying && !stale) return null;

  // Stale wins: the new build is already serving, so the countdown is moot.
  if (stale) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[200] flex items-center justify-center gap-2.5 border-b border-emerald-400/40 bg-emerald-500/15 px-4 py-2 backdrop-blur"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
        <span className="font-mono text-[11px] uppercase tracking-[.14em] text-emerald-200">
          Update complete — reloading
        </span>
      </div>
    );
  }

  const overdue = secondsLeft != null && secondsLeft <= 0;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[200] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-400/45 bg-amber-500/15 px-4 py-2 backdrop-blur"
    >
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
      <span className="font-mono text-[11px] font-bold uppercase tracking-[.14em] text-amber-200">
        Server update in progress
      </span>
      <span className="text-[11px] text-amber-100/80">
        Actions are paused so nothing is interrupted mid-transaction.
      </span>
      <span className="font-mono text-[11px] tabular-nums text-amber-300">
        {overdue
          ? 'finishing up…'
          : secondsLeft != null
            ? `~${mmss(secondsLeft)} remaining`
            : ''}
      </span>
    </div>
  );
}
