import { NextResponse } from 'next/server';
import { GameError } from './game';

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

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function requireWallet(w: unknown): string {
  if (typeof w !== 'string' || !BASE58.test(w)) {
    throw new GameError('invalid wallet address', 400);
  }
  return w;
}
