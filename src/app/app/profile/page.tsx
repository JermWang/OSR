'use client';

import { useCallback, useEffect, useState } from 'react';
import PageShell from '@/components/ui/PageShell';
import { useWalletStore } from '@/lib/store';
import { api, type ActivityItem, type GlobalProfile } from '@/lib/api-client';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { CHAIN } from '@/lib/config';

const eventLabels: Record<string, string> = {
  profile_created: 'Operator profile created',
  session_started: 'New session started',
  node_minted: 'Node deployed',
  node_upgraded: 'Node upgraded',
  crate_opened: 'Supply crate opened',
  rewards_claimed: 'Rewards claimed',
  compound_upgraded: 'Compound upgraded',
  component_equipped: 'Component equipped',
  component_unequipped: 'Component unequipped',
};

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 8)}…${wallet.slice(-6)}`;
}

function displayNumber(value: number, digits = 2) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function ProfilePage() {
  const wallet = useWalletStore((state) => state.wallet);
  const [profile, setProfile] = useState<GlobalProfile | null>(null);
  const [history, setHistory] = useState<ActivityItem[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.profile(wallet);
      setConfigured(result.configured);
      setProfile(result.profile);
      setHistory(result.history);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Profile service unavailable');
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!wallet) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const normalized = wallet.toLowerCase();
    const channel = supabase
      .channel(`osr-profile-${normalized}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `wallet=eq.${normalized}` },
        () => void load()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_history',
          filter: `wallet=eq.${normalized}`,
        },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [wallet, load]);

  return (
    <PageShell title="Operator Profile" subtitle="Your persistent identity, progression, and transaction history." maxWidth="max-w-6xl">
      {!wallet ? (
        <div className="panel p-6 text-sm text-steel-300">
          Sign in with Privy or link an external wallet to load your persistent online profile.
        </div>
      ) : !configured ? (
        <div className="panel border-amber-500/40 p-6 text-sm text-amber-300">
          The global profile database has not been configured for this environment yet.
        </div>
      ) : error ? (
        <div className="panel border-red-500/40 p-6 text-sm text-red-400">{error}</div>
      ) : loading && !profile ? (
        <p className="text-sm text-steel-400">Loading global profile…</p>
      ) : profile ? (
        <div className="space-y-6">
          <section className="panel overflow-hidden">
            <div className="border-b border-ink-600 bg-gradient-to-r from-amber-500/15 to-transparent p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-mono text-lg font-bold text-white">
                      {profile.displayName || shortWallet(profile.wallet)}
                    </h2>
                    <span className={profile.online ? 'text-emerald-400' : 'text-steel-500'}>
                      ● {profile.online ? 'online' : 'offline'}
                    </span>
                  </div>
                  <p className="mt-1 break-all font-mono text-[11px] text-steel-400">
                    {profile.wallet}
                  </p>
                </div>
                <a
                  href={`${CHAIN.explorer}/address/${profile.wallet}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-steel-500/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-steel-300 hover:border-amber-500 hover:text-amber-400"
                >
                  View wallet ↗
                </a>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-ink-600 sm:grid-cols-4">
              <Stat label="Compound" value={`L${profile.compoundLevel}`} />
              <Stat label="Nodes" value={String(profile.nodeCount)} />
              <Stat label="Produced" value={`${displayNumber(profile.totalProduced)} OSR`} />
              <Stat label="Sessions" value={displayNumber(profile.totalSessions, 0)} />
            </div>
            <div className="grid grid-cols-1 gap-3 border-t border-ink-600 p-4 text-xs text-steel-400 sm:grid-cols-2">
              <p>
                Joined <span className="text-steel-200">{new Date(profile.joinedAt).toLocaleString()}</span>
              </p>
              <p>
                Last seen{' '}
                <span className="text-steel-200">{new Date(profile.lastSeenAt).toLocaleString()}</span>
              </p>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-white">
                Global history
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                Live
              </span>
            </div>
            <div className="panel divide-y divide-ink-600 overflow-hidden">
              {history.length === 0 ? (
                <p className="p-5 text-sm text-steel-400">No activity has been recorded yet.</p>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-steel-100">
                        {eventLabels[item.eventType] || item.eventType.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-steel-500">
                        {item.source === 'onchain' ? 'Verified on-chain' : 'OSR network'}{' '}
                        ·{' '}
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {item.amount != null && (
                      <span className="font-mono text-sm text-amber-400">
                        {displayNumber(item.amount)} {item.assetSymbol || ''}
                      </span>
                    )}
                    {item.txHash && (
                      <a
                        href={`${CHAIN.explorer}/tx/${item.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[10px] text-emerald-400 hover:underline"
                      >
                        Receipt ↗
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="panel p-6 text-sm text-steel-300">
          Your profile is being initialized. Return to the Command Center once, then refresh this page.
        </div>
      )}
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-800 p-4">
      <p className="font-mono text-[9px] uppercase tracking-widest text-steel-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
