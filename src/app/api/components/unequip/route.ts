import type { NextRequest } from 'next/server';
import { handle, requireWallet } from '@/lib/api-util';
import { unequipComponent } from '@/lib/game';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    return unequipComponent(requireWallet(body.wallet), Number(body.nodeId), String(body.slot));
  });
}
