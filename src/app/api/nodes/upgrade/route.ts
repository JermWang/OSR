import type { NextRequest } from 'next/server';
import { handle, requireWallet } from '@/lib/api-util';
import { upgradeNode } from '@/lib/game';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    return upgradeNode(requireWallet(body.wallet), Number(body.nodeId));
  });
}
