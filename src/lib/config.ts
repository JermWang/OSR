// Central app config — Robinhood Chain (EVM, Arbitrum Orbit L2).

export const APP_NAME = 'OSR — Oil Strategic Reserve';
export const X_URL = 'https://x.com/OSRRHOOD';

export const CHAIN = {
  id: 4663,
  hexId: '0x1237',
  name: 'Robinhood Chain',
  rpcUrl: process.env.NEXT_PUBLIC_RH_RPC ?? 'https://rpc.mainnet.chain.robinhood.com',
  explorer: 'https://robinhoodchain.blockscout.com',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
} as const;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Application contracts must be supplied after audited deployments. */
export const OSR_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_OSR_TOKEN ?? ZERO_ADDRESS;
export const OSR_GAME_ADDRESS = process.env.NEXT_PUBLIC_OSR_GAME ?? ZERO_ADDRESS;
export const OSR_VAULT_ADDRESS = process.env.NEXT_PUBLIC_OSR_VAULT ?? ZERO_ADDRESS;
export const OSR_TREASURY_ADDRESS = process.env.NEXT_PUBLIC_OSR_TREASURY ?? ZERO_ADDRESS;
export const XOMX_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_XOMX_TOKEN ?? ZERO_ADDRESS;
export const CVXX_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_CVXX_TOKEN ?? ZERO_ADDRESS;

export function isConfiguredAddress(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(value) && value.toLowerCase() !== ZERO_ADDRESS;
}

export const CONTRACTS_CONFIGURED =
  isConfiguredAddress(OSR_TOKEN_ADDRESS) &&
  isConfiguredAddress(OSR_GAME_ADDRESS) &&
  isConfiguredAddress(OSR_VAULT_ADDRESS) &&
  isConfiguredAddress(OSR_TREASURY_ADDRESS);

export const ONCHAIN_ENABLED = process.env.NEXT_PUBLIC_ONCHAIN === '1' && CONTRACTS_CONFIGURED;

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
export const PRIVY_CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? '';
export const PRIVY_CONFIGURED = PRIVY_APP_ID.length > 0;
