import { NextResponse } from 'next/server';
import { requireAuthenticatedWallet } from '@/lib/api-util';
import { GameError } from '@/lib/game';
import { markCratesSeen } from '@/lib/crates';

export const dynamic = 'force-dynamic';

/** Acknowledge the "you mined a crate" notice so it stops being shown. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const wallet = await requireAuthenticatedWallet(request, body.wallet);
    markCratesSeen(wallet);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[crates/seen]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
