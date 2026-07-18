'use client';

import { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/ui/PageShell';
import { api } from '@/lib/api-client';
import { getBrowserSupabase } from '@/lib/supabase-browser';

type Metric = 'compound_level' | 'total_produced' | 'total_burned';

interface Row {
  rank: number;
  wallet: string;
  displayName?: string | null;
  online?: boolean;
  compoundLevel?: number;
  maxLevel: number;
  sumLevel: number;
  totalProduced: number;
  totalBurned: number;
}

const METRICS: Array<{ key: Metric; label: string }> = [
  { key: 'compound_level', label: 'Compound Level' },
  { key: 'total_produced', label: 'Total Produced' },
  { key: 'total_burned', label: 'OSR Burned' },
];

function metricValue(row: Row, metric: Metric): number {
  if (metric === 'total_produced') return row.totalProduced;
  if (metric === 'total_burned') return row.totalBurned;
  return row.compoundLevel ?? row.maxLevel;
}

const short = (w: string, head = 8) => `${w.slice(0, head)}…${w.slice(-4)}`;

export default function LeaderboardPage() {
  const [metric, setMetric] = useState<Metric>('compound_level');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (m: Metric) => {
    setLoading(true);
    setError(null);
    try {
      setRows((await api.leaderboard(m)) as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'API unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(metric);
  }, [metric, load]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      const timer = window.setInterval(() => void load(metric), 30_000);
      return () => window.clearInterval(timer);
    }
    const channel = supabase
      .channel('osr-global-leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => void load(metric)
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [metric, load]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3, 100);

  return (
    <PageShell title="Leaderboard" subtitle="Global operator rankings · updates in real time." maxWidth="max-w-7xl">
      <div className="space-y-6">
        {/* Metric tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {METRICS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              className={`shrink-0 rounded px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest transition ${
                metric === key
                  ? 'bg-amber-500 text-ink-900'
                  : 'border border-steel-500/50 text-steel-300 hover:text-amber-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="panel border-red-500/40 p-4 text-sm text-red-400">{error}</div>
        )}

        {loading && rows.length === 0 && !error ? (
          <p className="text-sm text-steel-400">Loading…</p>
        ) : (
          <>
            {/* Podium — mobile */}
            {podium.length > 0 && (
              <div className="space-y-3 sm:hidden">
                <div className="panel border-amber-500/60 p-5 text-center shadow-[0_0_24px_rgba(245,158,11,0.15)]">
                  <p className="font-mono text-4xl font-bold text-amber-500">#{podium[0].rank}</p>
                  <p className="mt-1 font-mono text-sm text-steel-200">{short(podium[0].wallet)}</p>
                  <p className="mt-1 font-mono text-lg text-white">
                    {metricValue(podium[0], metric).toLocaleString()}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {podium.slice(1).map((r) => (
                    <div key={r.rank} className="panel p-4 text-center">
                      <p className="font-mono text-2xl font-bold text-amber-500">#{r.rank}</p>
                      <p className="mt-1 font-mono text-xs text-steel-300">{short(r.wallet, 6)}</p>
                      <p className="mt-1 font-mono text-sm text-white">
                        {metricValue(r, metric).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Podium — desktop */}
            {podium.length > 0 && (
              <div className="hidden gap-3 sm:grid sm:grid-cols-3">
                {podium.map((r) => (
                  <div key={r.rank} className="panel p-5 text-center">
                    <p className="font-mono text-3xl font-bold text-amber-500">#{r.rank}</p>
                    <p className="mt-1 font-mono text-sm text-steel-300">{short(r.wallet)}</p>
                    <p className="mt-1 font-mono text-lg text-white">
                      {metricValue(r, metric).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Table — desktop */}
            <div className="panel hidden overflow-hidden md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-600">
                    <th className="stat-label px-4 py-3 font-normal">#</th>
                    <th className="stat-label px-4 py-3 font-normal">Wallet</th>
                    <th className="stat-label px-4 py-3 text-right font-normal">Max L</th>
                    <th className="stat-label px-4 py-3 text-right font-normal">Σ L</th>
                    <th className="stat-label px-4 py-3 text-right font-normal">Produced</th>
                    <th className="stat-label px-4 py-3 text-right font-normal">Burned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/60">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-steel-400">
                        No operators yet
                      </td>
                    </tr>
                  ) : (
                    rest.map((r) => (
                      <tr key={r.rank}>
                        <td className="px-4 py-2.5 font-mono text-steel-400">{r.rank}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-steel-200">
                          {short(r.wallet)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-white">{r.maxLevel}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-white">{r.sumLevel}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-white">
                          {r.totalProduced.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-white">
                          {r.totalBurned.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Card list — mobile */}
            <div className="space-y-2 md:hidden">
              {rows.length === 0 ? (
                <p className="panel p-4 text-center text-sm text-steel-400">No operators yet</p>
              ) : (
                rest.map((r) => (
                  <div key={r.rank} className="panel p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-amber-500">#{r.rank}</span>
                      <span className="font-mono text-xs text-steel-300">{short(r.wallet)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <MiniStat
                        label="Compound"
                        value={`L${r.compoundLevel ?? r.maxLevel}`}
                        hot={metric === 'compound_level'}
                      />
                      <MiniStat
                        label="Produced"
                        value={r.totalProduced.toFixed(1)}
                        hot={metric === 'total_produced'}
                      />
                      <MiniStat
                        label="Burned"
                        value={r.totalBurned.toLocaleString()}
                        hot={metric === 'total_burned'}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}

function MiniStat({ label, value, hot }: { label: string; value: string; hot: boolean }) {
  return (
    <div
      className={`rounded border px-2 py-1.5 text-center ${
        hot ? 'border-amber-500/70 ring-1 ring-amber-500/40' : 'border-ink-600'
      }`}
    >
      <p className="font-mono text-[9px] uppercase tracking-widest text-steel-500">{label}</p>
      <p className="mt-0.5 truncate font-mono text-xs text-white">{value}</p>
    </div>
  );
}
