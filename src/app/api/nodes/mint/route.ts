import type { NextRequest } from 'next/server';
import { handle, requireWallet } from '@/lib/api-util';
import { mintNode } from '@/lib/game';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    return mintNode(requireWallet(body.wallet), String(body.familyKey));
  });
}
