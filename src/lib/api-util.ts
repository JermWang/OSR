import { NextResponse } from 'next/server';
import { GameError } from './game';
import { verifyPrivyWalletOwner } from './privy-server';

export function ok(data: unknown) {
  return NextResponse.json(data);
}

export async function handle(fn: () => unknown | Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof GameError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error('[api]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

// Robinhood Chain uses standard 20-byte EVM addresses.
const EVM = /^0x[0-9a-fA-F]{40}$/;

export function requireWallet(w: unknown): string {
  if (typeof w !== 'string' || !EVM.test(w)) {
    throw new GameError('invalid wallet address', 400);
  }
  return w.toLowerCase();
}

export async function requireAuthenticatedWallet(request: Request, value: unknown): Promise<string> {
  const wallet = requireWallet(value);
  if (process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    await verifyPrivyWalletOwner(request, wallet);
  }
  return wallet;
}

/** Mainnet writes stay locked until audited contracts and receipt verification ship. */
export function requireSettlementReady(): never {
  throw new GameError(
    'Mainnet transactions are locked until the audited OSR contracts and receipt verifier are deployed',
    503
  );
}
