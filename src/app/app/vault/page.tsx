'use client';

import { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/ui/PageShell';
import { api, type ProtocolOverview } from '@/lib/api-client';
import { CHAIN, CONTRACTS_CONFIGURED } from '@/lib/config';

interface ReserveRow {
  walletLabel: string;
  walletAddress: string;
  assetSymbol: string;
  balanceUi: number;
}

// Actual server response shape (api-client's declared type lags the route).
interface TreasuryEvent {
  id: number;
  createdAt: number;
  eventType: string;
  walletLabel: string;
  amount: number;
  assetSymbol: string;
}

export default function VaultPage() {
  const [overview, setOverview] = useState<ProtocolOverview | null>(null);
  const [reserves, setReserves] = useState<ReserveRow[]>([]);
  const [events, setEvents] = useState<TreasuryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, rs, ev] = await Promise.all([api.overview(), api.reserves(), api.treasuryEvents(50)]);
      setOverview(ov);
      setReserves(rs);
      setEvents(ev as unknown as TreasuryEvent[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'API unreachable';
      setError(msg.startsWith('429') ? 'Servers busy — try again in a moment.' : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell title="Reserve Vault" subtitle="Public transparency dashboard" maxWidth="max-w-6xl">
      {loading && !overview ? (
        <p className="text-sm text-steel-400">Loading…</p>
      ) : error ? (
        <div className="panel border-red-500/40 p-4 text-sm text-red-400">
          <p>{error}</p>
          <button type="button" className="btn-secondary mt-3 text-xs" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {overview && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="OSR Emission Reserve"
                value={overview.osrReserveBalance?.toLocaleString() ?? '—'}
                suffix="OSR"
              />
              <StatCard
                label="Total OSR Burned"
                value={overview.totalOsrBurned?.toLocaleString() ?? '—'}
                suffix="OSR"
              />
              <StatCard label="Total Nodes" value={String(overview.totalNodes ?? '0')} suffix="" />
              <StatCard
                label="Network Rate"
                value={
                  overview.networkProductionRate != null
                    ? overview.networkProductionRate.toFixed(2)
                    : '—'
                }
                suffix="OSR/s"
              />
              {overview.xomxReserveBalance > 0 && (
                <StatCard
                  label="XOMx Reserve"
                  value={overview.xomxReserveBalance.toFixed(4)}
                  suffix="XOMX"
                />
              )}
              {overview.cvxxReserveBalance > 0 && (
                <StatCard
                  label="CVXx Reserve"
                  value={overview.cvxxReserveBalance.toFixed(4)}
                  suffix="CVXX"
                />
              )}
            </div>
          )}

          <section>
            <h2 className="stat-label mb-3">Treasury Wallets</h2>
            {reserves.length === 0 ? (
              <p className="panel p-4 text-sm leading-relaxed text-steel-400">
                {CONTRACTS_CONFIGURED
                  ? 'No balances were returned by the configured reserve contracts.'
                  : 'No OSR reserve contracts are configured yet. Placeholder wallet addresses and balances are intentionally hidden.'}
              </p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="panel hidden overflow-hidden md:block">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-600">
                        <th className="stat-label px-4 py-3 font-normal">Label</th>
                        <th className="stat-label px-4 py-3 font-normal">Address</th>
                        <th className="stat-label px-4 py-3 font-normal">Asset</th>
                        <th className="stat-label px-4 py-3 text-right font-normal">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-600/60">
                      {reserves.map((r) => (
                        <tr key={r.walletAddress}>
                          <td className="px-4 py-3 text-steel-200">{r.walletLabel}</td>
                          <td className="px-4 py-3 font-mono text-xs text-steel-400">
                            {r.walletAddress.slice(0, 16)}…
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-amber-500">
                            {r.assetSymbol}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-white">
                            {r.balanceUi.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="space-y-2 md:hidden">
                  {reserves.map((r) => (
                    <div key={r.walletAddress} className="panel p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-steel-200">{r.walletLabel}</p>
                        <span className="rounded bg-ink-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-amber-500">
                          {r.assetSymbol}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-steel-400">
                        {r.walletAddress.slice(0, 12)}…{r.walletAddress.slice(-6)}
                      </p>
                      <p className="mt-1 font-mono text-sm text-white">
                        {r.balanceUi.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section>
            <h2 className="stat-label mb-3">Recent Treasury Events</h2>
            <div className="panel max-h-96 overflow-y-auto p-0">
              {events.length === 0 ? (
                <p className="p-4 text-sm text-steel-400">No treasury events yet</p>
              ) : (
                <ul className="divide-y divide-ink-600/60">
                  {events.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 font-mono text-[11px] text-steel-500">
                          {new Date(e.createdAt).toLocaleTimeString()}
                        </span>
                        <span className="shrink-0 rounded bg-ink-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-500">
                          {e.eventType}
                        </span>
                        <span className="truncate font-mono text-xs text-steel-400">
                          {e.walletLabel}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-white">
                        {e.amount.toLocaleString()}{' '}
                        <span className="text-steel-400">{e.assetSymbol}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <p className="border-t border-ink-600 pt-4 text-xs text-steel-500">
            Configured balances are read directly from {CHAIN.name} through JSON-RPC. Treasury
            activity will appear only after deployed contract logs are indexed; local development
            ledger entries are never presented as blockchain transactions.
          </p>
        </div>
      )}
    </PageShell>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="panel p-4">
      <p className="stat-label">{label}</p>
      <p className="mt-1 break-words font-mono text-lg text-white">
        {value} {suffix && <span className="text-xs text-steel-400">{suffix}</span>}
      </p>
    </div>
  );
}
