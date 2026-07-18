'use client';

import { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/ui/PageShell';
import { api, type ProtocolOverview } from '@/lib/api-client';

export default function MarketPage() {
  const [overview, setOverview] = useState<ProtocolOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await api.overview());
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        msg.startsWith('429') ? 'Servers busy — try again in a moment.' : "Couldn't load market data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell title="Market Room" subtitle="Live reserve and production signals from Robinhood Chain." maxWidth="max-w-6xl">
      {loading && !overview ? (
        <p className="text-sm text-steel-400">Loading…</p>
      ) : error ? (
        <div className="panel border-red-500/40 p-4 text-sm text-red-400">
          <p>{error}</p>
          <button type="button" className="btn-secondary mt-3 text-xs" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard label="Total Nodes" value={String(overview.totalNodes)} />
          <StatCard label="Oil Rigs" value={String(overview.totalOilRigs)} />
          <StatCard label="Mining Shafts" value={String(overview.totalMiningShafts)} />
          <StatCard label="Total OSR Burned" value={overview.totalOsrBurned.toLocaleString()} />
          <StatCard
            label="Protocol ETH Revenue"
            value={`${overview.totalCreatorRewardsProcessed.toFixed(4)} ETH`}
          />
          <StatCard label="OSR Reserve" value={overview.osrReserveBalance.toLocaleString()} />
        </div>
      ) : null}
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="stat-label">{label}</p>
      <p className="mt-1 break-words font-mono text-lg text-white">{value}</p>
    </div>
  );
}
