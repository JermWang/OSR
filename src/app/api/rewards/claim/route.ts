import type { NextRequest } from 'next/server';
import { handle, requireWallet } from '@/lib/api-util';
import { claimRewards } from '@/lib/game';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    return claimRewards(
      requireWallet(body.wallet),
      body.nodeId != null ? Number(body.nodeId) : undefined,
      body.mode === 'compound' ? 'compound' : 'claim'
    );
  });
}
