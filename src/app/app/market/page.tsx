'use client';

// Market — player-to-player trading, plus the protocol signal strip that used
// to be the whole page.
//
// Prices are set entirely by sellers. The protocol takes a fee and nothing
// else: no floor, no ceiling, no listings of its own.

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import PageShell from '@/components/ui/PageShell';
import ComponentTile from '@/components/ui/ComponentTile';
import {
  api,
  type InventoryItem,
  type MarketItemKind,
  type MarketListing,
  type MarketSale,
  type ProtocolOverview,
  type StepHandler,
} from '@/lib/api-client';
import { useOperation } from '@/lib/useOperation';
import { COMPONENT_RARITIES, SLOT_LABELS, rarityHex, type Rarity } from '@/lib/rarity';
import { auraHex, auraLabel } from '@/lib/aura';

const CrateThumb = dynamic(() => import('@/components/three/CrateThumb'), { ssr: false });

const KINDS: Array<{ key: MarketItemKind | 'all'; label: string }> = [
  { key: 'all', label: 'Everything' },
  { key: 'crate', label: 'Crates' },
  { key: 'component', label: 'Components' },
  { key: 'node', label: 'Rigs & Shafts' },
];

const fmtOsr = (n: number) => Math.round(n).toLocaleString();

export default function MarketPage() {
  const { wallet, op, refresh } = useOperation();
  const [overview, setOverview] = useState<ProtocolOverview | null>(null);
  const [listings, setListings] = useState<MarketListing[] | null>(null);
  const [sales, setSales] = useState<MarketSale[]>([]);
  const [feeBps, setFeeBps] = useState(250);
  const [kind, setKind] = useState<MarketItemKind | 'all'>('all');
  const [tab, setTab] = useState<'browse' | 'sell'>('browse');
  const [busy, setBusy] = useState<number | 'list' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const say = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3600);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [board, ov] = await Promise.all([
        api.marketListings(kind === 'all' ? undefined : kind),
        api.overview().catch(() => null),
      ]);
      setListings(board.listings);
      setSales(board.sales);
      setFeeBps(board.feeBps);
      if (ov) setOverview(ov);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the market.");
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const buy = async (listing: MarketListing) => {
    if (!wallet) return say('Connect your wallet first');
    setBusy(listing.id);
    try {
      const onStep: StepHandler = (step) =>
        say(step === 'submitting' ? 'Confirm in your wallet…' : 'Working…');
      const res = await api.marketBuy(wallet, listing.id, onStep);
      await Promise.all([load(), refresh()]);
      // Don't claim a clean sale when the seller's payout has not landed.
      say(res.sellerPaid === false ? 'Bought — seller payout is pending' : 'Bought');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (listing: MarketListing) => {
    if (!wallet) return;
    setBusy(listing.id);
    try {
      await api.marketCancel(wallet, listing.id);
      await load();
      say('Listing cancelled');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Could not cancel');
    } finally {
      setBusy(null);
    }
  };

  const mine = useMemo(
    () => (listings ?? []).filter((l) => wallet && l.seller.toLowerCase() === wallet.toLowerCase()),
    [listings, wallet]
  );
  const others = useMemo(
    () => (listings ?? []).filter((l) => !wallet || l.seller.toLowerCase() !== wallet.toLowerCase()),
    [listings, wallet]
  );

  return (
    <PageShell
      title="Market"
      subtitle="Trade crates, components and whole operations with other players."
      maxWidth="max-w-6xl"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {(['browse', 'sell'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest transition ${
                tab === t
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-ink-600 bg-ink-800 text-steel-400 hover:border-steel-500'
              }`}
            >
              {t === 'browse' ? 'Browse' : 'Sell'}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-steel-500">
            Protocol fee {(feeBps / 100).toFixed(2)}% · prices set by sellers
          </span>
        </div>

        {toast && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {toast}
          </div>
        )}
        {error && (
          <div className="panel border-red-500/40 p-4 text-sm text-red-400">
            <p>{error}</p>
            <button className="btn-secondary mt-3 text-xs" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}

        {tab === 'browse' ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => setKind(k.key)}
                  className={`rounded border px-2.5 py-1 text-[11px] transition ${
                    kind === k.key
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                      : 'border-ink-600 bg-ink-800 text-steel-400 hover:border-steel-500'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            {listings == null ? (
              <p className="text-sm text-steel-400">Loading…</p>
            ) : listings.length === 0 ? (
              <div className="panel p-6 text-center">
                <p className="text-sm font-semibold text-steel-200">Nothing listed yet</p>
                <p className="mt-1 text-xs text-steel-500">
                  The market is entirely player-supplied — when someone lists a crate or a rig, it
                  shows up here.
                </p>
              </div>
            ) : (
              <>
                {mine.length > 0 && (
                  <section className="space-y-2">
                    <h2 className="stat-label">Your listings</h2>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {mine.map((l) => (
                        <ListingCard
                          key={l.id}
                          listing={l}
                          busy={busy === l.id}
                          feeBps={feeBps}
                          action="cancel"
                          onAction={() => void cancel(l)}
                        />
                      ))}
                    </div>
                  </section>
                )}
                <section className="space-y-2">
                  {mine.length > 0 && <h2 className="stat-label">Everyone else</h2>}
                  {others.length === 0 ? (
                    <p className="text-xs text-steel-500">No other listings right now.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {others.map((l) => (
                        <ListingCard
                          key={l.id}
                          listing={l}
                          busy={busy === l.id}
                          feeBps={feeBps}
                          action="buy"
                          onAction={() => void buy(l)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {sales.length > 0 && (
              <section className="space-y-2">
                <h2 className="stat-label">Recent sales</h2>
                <div className="panel overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-600">
                        <th className="stat-label px-4 py-2.5 font-normal">Item</th>
                        <th className="stat-label px-4 py-2.5 text-right font-normal">Price</th>
                        <th className="stat-label px-4 py-2.5 text-right font-normal">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-600/60">
                      {sales.slice(0, 12).map((s, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-xs capitalize text-steel-300">
                            {s.item_kind}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-white">
                            {fmtOsr(s.sold_price_osr)} OSR
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[11px] text-steel-500">
                            {new Date(s.sold_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        ) : (
          <SellPanel
            wallet={wallet}
            crates={op?.crates ?? []}
            busy={busy === 'list'}
            feeBps={feeBps}
            onList={async (itemKind, itemId, price) => {
              if (!wallet) return say('Connect your wallet first');
              setBusy('list');
              try {
                await api.marketList(wallet, itemKind, itemId, price);
                await Promise.all([load(), refresh()]);
                setTab('browse');
                say('Listed');
              } catch (e) {
                say(e instanceof Error ? e.message : 'Could not list that');
              } finally {
                setBusy(null);
              }
            }}
          />
        )}

        {/* Protocol signals — kept from the original Market Room. */}
        {overview && (
          <section className="space-y-2 border-t border-ink-600 pt-5">
            <h2 className="stat-label">Protocol signals</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard label="Total Nodes" value={String(overview.totalNodes)} />
              <StatCard label="Oil Rigs" value={String(overview.totalOilRigs)} />
              <StatCard label="Mining Shafts" value={String(overview.totalMiningShafts)} />
              <StatCard label="Total OSR Burned" value={fmtOsr(overview.totalOsrBurned)} />
              <StatCard
                label="Protocol ETH Revenue"
                value={`${overview.totalCreatorRewardsProcessed.toFixed(4)} ETH`}
              />
              <StatCard label="OSR Reserve" value={fmtOsr(overview.osrReserveBalance)} />
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function ListingCard({
  listing,
  busy,
  feeBps,
  action,
  onAction,
}: {
  listing: MarketListing;
  busy: boolean;
  feeBps: number;
  action: 'buy' | 'cancel';
  onAction: () => void;
}) {
  const item = (listing.item ?? {}) as Record<string, string | number>;
  const rarity = (item.rarity as Rarity | undefined) ?? undefined;
  const accent =
    listing.itemKind === 'node'
      ? auraHex(Number(item.level) || 1)
      : rarity
        ? rarityHex(rarity)
        : '#f5a623';
  const net = listing.priceOsr - Math.floor((listing.priceOsr * feeBps) / 10_000);

  return (
    <div className="panel flex flex-col gap-2 p-3" style={{ borderColor: `${accent}44` }}>
      <div className="flex items-center gap-2.5">
        {listing.itemKind === 'crate' ? (
          <CrateThumb size={44} rarity="legendary" />
        ) : listing.itemKind === 'component' && rarity ? (
          <ComponentTile slot={String(item.slot)} rarity={rarity} size={44} />
        ) : (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-xl"
            style={{ background: `${accent}18`, border: `1px solid ${accent}44` }}
          >
            {item.family === 'mine' ? '⛏' : '⛽'}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-white">{title(listing)}</div>
          <div className="truncate font-mono text-[10px] uppercase" style={{ color: accent }}>
            {subtitle(listing)}
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-baseline justify-between">
        <span className="font-mono text-sm font-bold text-amber-400">
          {fmtOsr(listing.priceOsr)} OSR
        </span>
        <span className="font-mono text-[10px] text-steel-500">seller nets {fmtOsr(net)}</span>
      </div>
      <button
        className={action === 'buy' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
        disabled={busy}
        onClick={onAction}
      >
        {busy ? 'Working…' : action === 'buy' ? 'Buy' : 'Cancel listing'}
      </button>
      <div className="font-mono text-[9px] text-steel-600">
        {listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}
      </div>
    </div>
  );
}

function title(l: MarketListing): string {
  const item = (l.item ?? {}) as Record<string, string | number>;
  if (l.itemKind === 'crate') {
    return item.crate_type === 'shaft_crate' ? 'Shaft Crate' : 'Rig Crate';
  }
  if (l.itemKind === 'component') return SLOT_LABELS[String(item.slot)] ?? String(item.slot);
  return item.family === 'mine' ? 'Mining Shaft' : 'Oil Rig';
}

function subtitle(l: MarketListing): string {
  const item = (l.item ?? {}) as Record<string, string | number>;
  if (l.itemKind === 'crate') return 'Unopened';
  if (l.itemKind === 'component') {
    const r = item.rarity as Rarity;
    return `${COMPONENT_RARITIES[r]?.label ?? r} · ${COMPONENT_RARITIES[r]?.multiplier ?? 1}×`;
  }
  const lvl = Number(item.level) || 1;
  return `L${lvl} · ${auraLabel(lvl)}`;
}

function SellPanel({
  wallet,
  crates,
  busy,
  feeBps,
  onList,
}: {
  wallet: string | null;
  crates: Array<{ id: number; crateType: 'rig_crate' | 'shaft_crate'; foundAt: number }>;
  busy: boolean;
  feeBps: number;
  onList: (kind: MarketItemKind, itemId: number, price: number) => Promise<void>;
}) {
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [selected, setSelected] = useState<{ kind: MarketItemKind; id: number } | null>(null);
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (!wallet) return;
    api
      .inventory(wallet)
      .then((r) => setInventory(r.items))
      .catch(() => setInventory([]));
  }, [wallet]);

  if (!wallet) {
    return (
      <div className="panel p-6 text-center text-sm text-steel-400">
        Connect your wallet to list items for sale.
      </div>
    );
  }

  // Equipped gear is excluded: it has to come off the rig before it can be sold,
  // and offering it here would only produce a server rejection.
  const sellableComponents = (inventory ?? []).filter((i) => i.equippedNodeId == null);
  const priceNum = Number(price);
  const valid = selected != null && Number.isFinite(priceNum) && priceNum > 0;
  const net = valid ? priceNum - Math.floor((priceNum * feeBps) / 10_000) : 0;

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="stat-label">Unopened crates</h2>
        {crates.length === 0 ? (
          <p className="text-xs text-steel-500">No crates to sell — they turn up as you mine.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {crates.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected({ kind: 'crate', id: c.id })}
                className={`flex items-center gap-2 rounded border p-2 transition ${
                  selected?.kind === 'crate' && selected.id === c.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-ink-600 bg-ink-800 hover:border-steel-500'
                }`}
              >
                <CrateThumb size={36} rarity="legendary" animate={false} />
                <span className="text-[11px] text-steel-300">
                  {c.crateType === 'rig_crate' ? 'Rig Crate' : 'Shaft Crate'}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="stat-label">Unequipped components</h2>
        {inventory == null ? (
          <p className="text-xs text-steel-500">Loading…</p>
        ) : sellableComponents.length === 0 ? (
          <p className="text-xs text-steel-500">
            Nothing spare — unequip a component from a rig to sell it.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sellableComponents.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected({ kind: 'component', id: c.id })}
                className={`flex items-center gap-2 rounded border p-2 transition ${
                  selected?.kind === 'component' && selected.id === c.id
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-ink-600 bg-ink-800 hover:border-steel-500'
                }`}
              >
                <ComponentTile slot={c.slot} rarity={c.rarity as Rarity} size={36} />
                <span className="text-[11px] text-steel-300">
                  {SLOT_LABELS[c.slot] ?? c.slot}
                  <span className="ml-1 font-mono" style={{ color: rarityHex(c.rarity as Rarity) }}>
                    {COMPONENT_RARITIES[c.rarity as Rarity]?.label}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel space-y-2 p-4">
        <label className="stat-label" htmlFor="market-price">
          Ask price (OSR)
        </label>
        <input
          id="market-price"
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 25000"
          className="w-full rounded border border-ink-600 bg-ink-900 px-3 py-2 font-mono text-sm text-white outline-none focus:border-amber-500"
        />
        <p className="text-[11px] text-steel-500">
          You set the price — the protocol takes {(feeBps / 100).toFixed(2)}% and nothing else.
          {valid && (
            <>
              {' '}
              You would receive <span className="font-mono text-amber-400">{fmtOsr(net)} OSR</span>.
            </>
          )}
        </p>
        <button
          className="btn-primary w-full text-sm"
          disabled={!valid || busy}
          onClick={() => selected && void onList(selected.kind, selected.id, priceNum)}
        >
          {busy ? 'Listing…' : selected ? 'List for sale' : 'Pick an item above'}
        </button>
      </section>
    </div>
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
