import type { NextRequest } from 'next/server';
import { handle, requireWallet } from '@/lib/api-util';
import { verifyPrivyWalletOwner } from '@/lib/privy-server';
import { linkPrivyIdentity, touchGlobalProfile } from '@/lib/profiles';

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = await request.json();
    const wallet = requireWallet(body.wallet);
    const identity = await verifyPrivyWalletOwner(request, wallet);
    await linkPrivyIdentity(identity);
    const profile = await touchGlobalProfile(wallet);
    return {
      authenticated: true,
      userId: identity.userId,
      wallet: identity.wallet,
      walletType: identity.walletClientType,
      profile,
    };
  });
}
