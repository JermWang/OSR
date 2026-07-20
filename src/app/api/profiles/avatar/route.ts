import { NextResponse } from 'next/server';
import { requireAuthenticatedWallet } from '@/lib/api-util';
import { GameError } from '@/lib/game';
import { saveAvatar } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 1_000_000; // 1MB is plenty for a square avatar
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * Upload a profile picture. Multipart form with a `file` field and the wallet
 * in the `wallet` field; the server stores it and rewrites the profile's
 * avatar_url, so the client never writes to storage directly.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => null);
    if (!form) throw new GameError('multipart form data required', 400);
    const wallet = await requireAuthenticatedWallet(request, form.get('wallet'));

    const file = form.get('file');
    if (!(file instanceof File)) throw new GameError('file field is required', 400);
    if (!ALLOWED.has(file.type)) {
      throw new GameError('avatar must be a PNG, JPEG or WebP image', 400);
    }
    if (file.size > MAX_BYTES) {
      throw new GameError('avatar must be 1MB or smaller', 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Magic-byte check so a renamed non-image cannot land in a public bucket:
    // PNG 89 50 4E 47 · JPEG FF D8 FF · WebP 52 49 46 46 ... 57 45 42 50
    const magicOk =
      (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
      (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
      (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);
    if (!magicOk) throw new GameError('file does not look like a valid image', 400);

    const profile = await saveAvatar(wallet, bytes, file.type);
    return NextResponse.json({ profile });
  } catch (e) {
    if (e instanceof GameError) return NextResponse.json({ error: e.message }, { status: e.status });
    const message = e instanceof Error ? e.message : 'internal error';
    const status = /failed|not found/.test(message) ? 400 : 500;
    if (status === 500) console.error('[profiles/avatar]', e);
    return NextResponse.json({ error: status === 500 ? 'internal error' : message }, { status });
  }
}
