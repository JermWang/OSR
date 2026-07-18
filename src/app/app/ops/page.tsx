'use client';

import { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/ui/PageShell';
import { api, type UserOperation } from '@/lib/api-client';
import { useWalletStore } from '@/lib/store';

export default function OpsPage() {
  const wallet = useWalletStore((s) => s.wallet);
  const [op, setOp] = useState<UserOperation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      setOp(await api.operation(wallet));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'API unreachable');
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell title="My Operations">
      {!wallet ? (
        <p className="text-sm text-steel-400">Connect a wallet from Command Center first.</p>
      ) : loading && !op ? (
        <p className="text-sm text-steel-400">Loading…</p>
      ) : error ? (
        <div className="panel border-red-500/40 p-4 text-sm text-red-400">
          <p>Couldn&rsquo;t load your operations: {error}</p>
          <button type="button" className="btn-secondary mt-3 text-xs" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : op ? (
        <div className="space-y-6">
          <section>
            <h2 className="stat-label mb-3">Summary</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Nodes" value={`${op.nodes.length}/${op.maxNodes}`} />
              <StatCard label="Max Level" value={String(op.level)} />
              <StatCard label="Total Rate/s" value={op.productionRate.toFixed(6)} />
              <StatCard label="Lifetime Produced" value={op.totalProduced.toFixed(4)} />
            </div>
          </section>

          <section>
            <h2 className="stat-label mb-3">Pending Rewards</h2>
            <div className="panel divide-y divide-ink-600 p-0">
              {Object.entries(op.pending).length === 0 ? (
                <p className="p-4 text-sm text-steel-400">No pending rewards</p>
              ) : (
                Object.entries(op.pending).map(([asset, amount]) => (
                  <div key={asset} className="flex items-center justify-between px-4 py-3">
                    <span className="font-mono text-xs uppercase tracking-widest text-steel-400">
                      {asset}
                    </span>
                    <span className="font-mono text-sm text-white">{amount.toFixed(6)}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="stat-label">{label}</p>
      <p className="mt-1 font-mono text-lg text-white">{value}</p>
    </div>
  );
}
