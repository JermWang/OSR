import { handle, requireAuthenticatedWallet } from '@/lib/api-util';
import { GameError, equipComponent } from '@/lib/game';

export const dynamic = 'force-dynamic';

/**
 * Equipping moves gear the operator already owns between their own nodes. It
 * costs nothing, so it needs authentication but no on-chain settlement.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const wallet = await requireAuthenticatedWallet(request, body.wallet);

    const itemId = Number(body.inventoryItemId);
    const nodeId = Number(body.targetNodeId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new GameError('valid inventoryItemId is required');
    }
    if (!Number.isInteger(nodeId) || nodeId <= 0) {
      throw new GameError('valid targetNodeId is required');
    }
    return equipComponent(wallet, itemId, nodeId);
  });
}
