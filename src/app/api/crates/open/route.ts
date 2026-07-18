import type { NextRequest } from 'next/server';
import { handle, requireWallet } from '@/lib/api-util';
import { openCrate } from '@/lib/game';

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    return openCrate(
      requireWallet(body.wallet),
      body.crateType === 'shaft_crate' ? 'shaft_crate' : 'rig_crate',
      body.targetNodeId != null ? Number(body.targetNodeId) : null,
      { forceSlot: body.forceSlot, forceRarity: body.forceRarity }
    );
  });
}
