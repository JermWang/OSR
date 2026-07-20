import { NextResponse } from 'next/server';
import { openListings, recentSales, type ItemKind } from '@/lib/market';
import { MARKET_FEE_BPS } from '@/lib/economy';

export const dynamic = 'force-dynamic';

/** Public board — anyone can read what is for sale and what things sold for. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const kindParam = url.searchParams.get('kind');
  const kind =
    kindParam === 'crate' || kindParam === 'component' || kindParam === 'node'
      ? (kindParam as ItemKind)
      : undefined;
  return NextResponse.json({
    listings: openListings(kind),
    sales: recentSales(),
    feeBps: MARKET_FEE_BPS,
  });
}
