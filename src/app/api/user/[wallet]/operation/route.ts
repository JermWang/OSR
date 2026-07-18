import { handle, requireWallet } from '@/lib/api-util';
import { userOperation } from '@/lib/game';
import { privyServerConfigured, verifyPrivyWalletOwner } from '@/lib/privy-server';
import { touchGlobalProfile } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ wallet: string }> }) {
  return handle(async () => {
    const { wallet } = await ctx.params;
    const normalizedWallet = requireWallet(wallet);
    if (privyServerConfigured()) {
      await verifyPrivyWalletOwner(request, normalizedWallet);
    }
    const operation = userOperation(normalizedWallet);
    await touchGlobalProfile(normalizedWallet, operation);
    return operation;
  });
}
