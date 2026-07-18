import type { NextRequest } from 'next/server';
import { handle } from '@/lib/api-util';
import { treasuryEvents } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = Math.min(500, Number(req.nextUrl.searchParams.get('limit') ?? 100));
  return handle(() => treasuryEvents(limit));
}
