import { PrivyClient } from '@privy-io/node';
import { GameError } from './game';

let client: PrivyClient | null = null;

export function privyServerConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
}

function getPrivyClient() {
  if (client) return client;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) throw new GameError('Privy server credentials are not configured', 503);
  client = new PrivyClient({
    appId,
    appSecret,
    jwtVerificationKey: process.env.PRIVY_JWT_VERIFICATION_KEY || undefined,
  });
  return client;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

export async function verifyPrivyWalletOwner(request: Request, wallet: string) {
  if (!privyServerConfigured()) {
    throw new GameError('Privy authentication is not configured', 503);
  }
  const accessToken = bearerToken(request);
  const identityToken = request.headers.get('privy-id-token') ?? '';
  if (!accessToken || !identityToken) throw new GameError('Privy authentication required', 401);

  try {
    const privy = getPrivyClient();
    const [claims, user] = await Promise.all([
      privy.utils().auth().verifyAccessToken(accessToken),
      privy.users().get({ id_token: identityToken }),
    ]);
    if (claims.user_id !== user.id) throw new GameError('Privy session identity mismatch', 401);

    const normalized = wallet.toLowerCase();
    const linkedWallet = user.linked_accounts.find(
      (account) =>
        account.type === 'wallet' &&
        account.chain_type === 'ethereum' &&
        account.address.toLowerCase() === normalized
    );
    if (!linkedWallet || linkedWallet.type !== 'wallet') {
      throw new GameError('Wallet is not linked to this Privy account', 403);
    }

    return {
      userId: user.id,
      wallet: normalized,
      walletId: 'id' in linkedWallet ? linkedWallet.id : null,
      walletClientType:
        'wallet_client_type' in linkedWallet && linkedWallet.wallet_client_type
          ? linkedWallet.wallet_client_type
          : 'external',
    };
  } catch (error) {
    if (error instanceof GameError) throw error;
    throw new GameError('Invalid or expired Privy session', 401);
  }
}
