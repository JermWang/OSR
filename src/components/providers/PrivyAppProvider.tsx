'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { defineChain } from 'viem';
import {
  APP_NAME,
  CHAIN,
  PRIVY_APP_ID,
  PRIVY_CLIENT_ID,
  PRIVY_CONFIGURED,
} from '@/lib/config';

const robinhoodChain = defineChain({
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: CHAIN.nativeCurrency,
  rpcUrls: { default: { http: [CHAIN.rpcUrl] } },
  blockExplorers: { default: { name: 'Blockscout', url: CHAIN.explorer } },
});

export default function PrivyAppProvider({ children }: { children: React.ReactNode }) {
  if (!PRIVY_CONFIGURED) return children;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID || undefined}
      config={{
        defaultChain: robinhoodChain,
        supportedChains: [robinhoodChain],
        loginMethods: ['email', 'google', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#f59e0b',
          logo: '/logo.jpg',
          showWalletLoginFirst: false,
          walletChainType: 'ethereum-only',
          walletList: [
            'robinhood_wallet',
            'metamask',
            'detected_ethereum_wallets',
            'wallet_connect_qr',
          ],
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'all-users' },
          showWalletUIs: true,
          priceDisplay: { primary: 'native-token', secondary: null },
        },
        mfa: { noPromptOnMfaRequired: false },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
