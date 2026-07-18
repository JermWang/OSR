'use client';

// Wallet connect button. Supports real Solana wallets (Phantom/Solflare/
// Backpack via wallet-adapter) plus a Guest mode that generates a local
// keypair-style address — the whole game economy is local, so guests get the
// full experience without a wallet extension.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletStore } from '@/lib/store';
import { useOperation } from '@/lib/useOperation';

function randomBase58(len = 44): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let out = '';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export default function WalletButton() {
  const { wallets, select, connect, disconnect, publicKey, connected, connecting, wallet } = useWallet();
  const storeWallet = useWalletStore((s) => s.wallet);
  const setStoreWallet = useWalletStore((s) => s.setWallet);
  const setOpWallet = useOperation((s) => s.setWallet);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeWallet = connected && publicKey ? publicKey.toBase58() : storeWallet;

  // Propagate the active wallet into the game store/poller.
  useEffect(() => {
    if (connected && publicKey) {
      const w = publicKey.toBase58();
      setStoreWallet(w);
      setOpWallet(w);
    } else if (storeWallet) {
      setOpWallet(storeWallet);
    } else {
      setOpWallet(null);
    }
  }, [connected, publicKey, storeWallet, setStoreWallet, setOpWallet]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const installed = useMemo(
    () => wallets.filter((w) => w.readyState === 'Installed'),
    [wallets]
  );

  if (activeWallet) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          className="rounded border border-steel-500/60 bg-ink-800 px-3 py-1.5 font-mono text-xs text-steel-200 hover:border-amber-500"
          onClick={() => setOpen((o) => !o)}
        >
          {activeWallet.slice(0, 4)}…{activeWallet.slice(-4)}
        </button>
        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded border border-ink-600 bg-ink-800 p-1 shadow-xl">
            <button
              className="w-full rounded px-3 py-2 text-left text-xs text-steel-300 hover:bg-ink-700"
              onClick={async () => {
                setOpen(false);
                if (connected) await disconnect().catch(() => undefined);
                setStoreWallet(null);
                setOpWallet(null);
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button className="btn-primary !py-1.5 text-sm" onClick={() => setOpen((o) => !o)} disabled={connecting}>
        {connecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-60 rounded border border-ink-600 bg-ink-800 p-1 shadow-xl">
          {installed.map((w) => (
            <button
              key={w.adapter.name}
              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-steel-200 hover:bg-ink-700"
              onClick={async () => {
                setOpen(false);
                try {
                  select(w.adapter.name);
                  await connect();
                } catch {
                  /* user rejected */
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.adapter.icon} alt="" className="h-5 w-5" />
              {w.adapter.name}
              <span className="ml-auto text-[10px] uppercase tracking-wider text-emerald-400">Detected</span>
            </button>
          ))}
          {installed.length === 0 && (
            <div className="px-3 py-2 text-xs text-steel-400">
              No Solana wallet detected. Install Phantom, Solflare, or Backpack — or play as a guest.
            </div>
          )}
          <div className="my-1 border-t border-ink-600" />
          <button
            className="w-full rounded px-3 py-2 text-left text-sm text-amber-400 hover:bg-ink-700"
            onClick={() => {
              setOpen(false);
              const w = randomBase58();
              setStoreWallet(w);
              setOpWallet(w);
            }}
          >
            ⚡ Play as Guest
            <div className="text-[11px] font-normal text-steel-400">local test wallet, instant start</div>
          </button>
          {wallet && <div className="hidden">{wallet.adapter.name}</div>}
        </div>
      )}
    </div>
  );
}
