import type { NextRequest } from 'next/server';
import { handle, requireWallet } from '@/lib/api-util';
import { upgradeCompound } from '@/lib/game';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    return upgradeCompound(requireWallet(body.wallet), true);
  });
}
