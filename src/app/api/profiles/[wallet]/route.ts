import { handle, requireWallet } from '@/lib/api-util';
import { profileBundle } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ wallet: string }> }) {
  return handle(async () => {
    const { wallet } = await ctx.params;
    return profileBundle(requireWallet(wallet));
  });
}
