import type { NextRequest } from 'next/server';
import { handle } from '@/lib/api-util';
import { leaderboard } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const metric = req.nextUrl.searchParams.get('metric') ?? 'production';
  return handle(() => leaderboard(metric));
}
