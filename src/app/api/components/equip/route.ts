import type { NextRequest } from 'next/server';
import { handle, requireWallet } from '@/lib/api-util';
import { equipComponent } from '@/lib/game';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    return equipComponent(
      requireWallet(body.wallet),
      Number(body.inventoryItemId),
      Number(body.targetNodeId)
    );
  });
}
