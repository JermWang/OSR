import type { NextRequest } from 'next/server';
import { handle } from '@/lib/api-util';
import { crateOdds, getOrCreateUser } from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  return handle(() => crateOdds(wallet ? getOrCreateUser(wallet) : null));
}
