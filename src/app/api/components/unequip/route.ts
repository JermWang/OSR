import { handle, requireAuthenticatedWallet } from '@/lib/api-util';
import { GameError, unequipComponent } from '@/lib/game';

export const dynamic = 'force-dynamic';

/** Free action, same reasoning as equip: authenticate, no settlement. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const wallet = await requireAuthenticatedWallet(request, body.wallet);

    const nodeId = Number(body.nodeId);
    const slot = typeof body.slot === 'string' ? body.slot : '';
    if (!Number.isInteger(nodeId) || nodeId <= 0) {
      throw new GameError('valid nodeId is required');
    }
    if (!slot) throw new GameError('slot is required');
    return unequipComponent(wallet, nodeId, slot);
  });
}
