'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useIdentityToken, usePrivy, useWallets } from '@privy-io/react-auth';
import { api } from '@/lib/api-client';
import { CHAIN, TOKEN_LIVE } from '@/lib/config';
import { type Eip1193Provider, shortAddress, useEvmWallet } from '@/lib/evm';
import { useWalletStore } from '@/lib/store';
import { useOperation } from '@/lib/useOperation';

function displayBalance(value: string | null, digits = 5) {
  if (value == null) return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, { maximumFractionDigits: digits })
    : value;
}

export default function PrivyWalletButton() {
  const { ready, authenticated, user, login, logout, linkWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { identityToken } = useIdentityToken();
  const attachProvider = useEvmWallet((state) => state.attachProvider);
  const disconnectProvider = useEvmWallet((state) => state.disconnect);
  const nativeBalance = useEvmWallet((state) => state.nativeBalance);
  const osrBalance = useEvmWallet((state) => state.osrBalance);
  const osrSymbol = useEvmWallet((state) => state.osrSymbol);
  const walletError = useEvmWallet((state) => state.error);
  const setStoreWallet = useWalletStore((state) => state.setWallet);
  const setOperationWallet = useOperation((state) => state.setWallet);
  const [open, setOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const synced = useRef<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const managedWallet = useMemo(
    () =>
      wallets.find(
        (wallet) =>
          wallet.walletClientType === 'privy' || wallet.walletClientType === 'privy-v2'
      ) ?? wallets[0],
    [wallets]
  );

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!ready || !walletsReady || !authenticated || !managedWallet) return;
    let cancelled = false;
    void (async () => {
      try {
        await managedWallet.switchChain(CHAIN.id);
        const provider = await managedWallet.getEthereumProvider();
        const address = await attachProvider(
          provider as unknown as Eip1193Provider,
          managedWallet.address,
          `privy:${managedWallet.walletClientType}`
        );
        if (cancelled || !address) return;
        setStoreWallet(address);
        setOperationWallet(address);
      } catch (error) {
        if (!cancelled) {
          setSyncError(error instanceof Error ? error.message : 'Privy wallet initialization failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    ready,
    walletsReady,
    authenticated,
    managedWallet,
    attachProvider,
    setStoreWallet,
    setOperationWallet,
  ]);

  useEffect(() => {
    if (!authenticated || !identityToken || !managedWallet) return;
    const key = `${user?.id ?? ''}:${managedWallet.address.toLowerCase()}`;
    if (synced.current === key) return;
    synced.current = key;
    void api.privySession(managedWallet.address).catch((error) => {
      synced.current = null;
      setSyncError(error instanceof Error ? error.message : 'Privy session sync failed');
    });
  }, [authenticated, identityToken, managedWallet, user?.id]);

  if (!ready || (authenticated && !walletsReady)) {
    return <button className="btn-primary !py-1.5 text-sm" disabled>Loading wallet…</button>;
  }

  if (!authenticated) {
    return (
      <button className="btn-primary !py-1.5 text-sm" onClick={() => login()}>
        Connect wallet
      </button>
    );
  }

  if (!managedWallet) {
    return <button className="btn-primary !py-1.5 text-sm" disabled>Connecting wallet…</button>;
  }

  // Wallet is the only login route, so the account is normally the operator's
  // own. Only label it as embedded when it genuinely is one.
  const isEmbedded =
    managedWallet.walletClientType === 'privy' || managedWallet.walletClientType === 'privy-v2';

  return (
    <div className="relative flex items-center gap-2" ref={menuRef}>
      <span className="hidden rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-violet-300 sm:block">
        {isEmbedded ? 'Privy hot wallet' : 'Connected wallet'}
      </span>
      <button
        className="rounded border border-steel-500/60 bg-ink-800 px-3 py-1.5 font-mono text-xs text-steel-200 hover:border-amber-500"
        onClick={() => setOpen((value) => !value)}
      >
        {shortAddress(managedWallet.address)}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded border border-ink-600 bg-ink-800 p-2 shadow-xl">
          <div className="rounded border border-ink-600 bg-ink-900/60 p-2.5">
            <p className="truncate text-xs text-steel-300">
              {shortAddress(managedWallet.address)}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-violet-300">
              {isEmbedded ? 'Managed embedded wallet' : 'Self-custodied wallet'} · mainnet
            </p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-steel-400">ETH balance</span>
              <span className="font-mono text-white">{displayBalance(nativeBalance)} ETH</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-steel-400">Token balance</span>
              <span className="font-mono text-white">
                {TOKEN_LIVE
                  ? `${displayBalance(osrBalance, 3)} ${osrSymbol}`
                  : 'Not live yet'}
              </span>
            </div>
          </div>
          {(syncError || walletError) && (
            <p className="px-2 py-2 text-[11px] text-red-400">{syncError || walletError}</p>
          )}
          <button
            className="mt-1 w-full rounded px-3 py-2 text-left text-xs text-steel-300 hover:bg-ink-700"
            onClick={() => void navigator.clipboard.writeText(managedWallet.address)}
          >
            Copy deposit address
          </button>
          <button
            className="w-full rounded px-3 py-2 text-left text-xs text-steel-300 hover:bg-ink-700"
            onClick={() => linkWallet()}
          >
            Link MetaMask / Robinhood Wallet
          </button>
          <a
            className="block w-full rounded px-3 py-2 text-left text-xs text-steel-300 hover:bg-ink-700"
            href={`${CHAIN.explorer}/address/${managedWallet.address}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Blockscout ↗
          </a>
          <button
            className="w-full rounded px-3 py-2 text-left text-xs text-steel-300 hover:bg-ink-700"
            onClick={() => {
              setOpen(false);
              synced.current = null;
              disconnectProvider();
              setStoreWallet(null);
              setOperationWallet(null);
              void logout();
            }}
          >
            Sign out
          </button>
          <p className="mt-1 border-t border-ink-600 px-3 py-2 text-[10px] leading-relaxed text-steel-500">
            OSR never stores raw private keys. Privy secures wallet key material and session recovery.
          </p>
        </div>
      )}
    </div>
  );
}
