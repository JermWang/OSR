import type { NextRequest } from 'next/server';
import { handle } from '@/lib/api-util';
import { leaderboard } from '@/lib/game';
import { globalLeaderboard, type LeaderboardMetric } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requested = req.nextUrl.searchParams.get('metric');
  const metric: LeaderboardMetric =
    requested === 'total_produced' || requested === 'total_burned'
      ? requested
      : 'compound_level';
  return handle(async () => (await globalLeaderboard(metric)) ?? leaderboard(metric));
}
