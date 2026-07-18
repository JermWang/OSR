import type { NextRequest } from 'next/server';
import { handle, requireWallet } from '@/lib/api-util';
import { getOrCreateUser } from '@/lib/game';
import { getDb } from '@/lib/db';
import { STARTER_OSR } from '@/lib/economy';

// Local faucet: tops the in-game OSR balance back up to the starter amount.
// (The original granted devnet SOL; locally there's no SOL to grant.)
export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await req.json();
    const wallet = requireWallet(body.wallet);
    const user = getOrCreateUser(wallet);
    if (user.osr_balance >= STARTER_OSR) {
      return { ok: false, reason: 'balance_sufficient' };
    }
    getDb()
      .prepare('UPDATE users SET osr_balance = ? WHERE wallet = ?')
      .run(STARTER_OSR, wallet);
    return { ok: true, granted: STARTER_OSR - user.osr_balance };
  });
}
