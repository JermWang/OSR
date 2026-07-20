import { NextResponse } from 'next/server';
import { requireAuthenticatedWallet } from '@/lib/api-util';
import { GameError } from '@/lib/game';
import { updateProfileIdentity } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

/** Set or clear the display name. Only the authenticated owner may edit. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const wallet = await requireAuthenticatedWallet(request, body.wallet);
    if (typeof body.displayName !== 'string' && body.displayName !== null) {
      throw new GameError('displayName must be a string or null', 400);
    }
    const profile = await updateProfileIdentity(wallet, {
      displayName: body.displayName as string | null,
    });
    return NextResponse.json({ profile });
  } catch (e) {
    if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: e.status });
    const message = e instanceof Error ? e.message : 'internal error';
    // Validation errors from the lib arrive as plain Errors with readable text.
    const status = /must be|unsupported|not found|nothing to update/.test(message) ? 400 : 500;
    if (status === 500) console.error('[profiles/update]', e);
    return NextResponse.json({ error: status === 500 ? 'internal error' : message }, { status });
  }
}
