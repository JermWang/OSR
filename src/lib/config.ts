// Central app config. The clone runs its own local API (Next.js route handlers)
// and keeps Solana devnet integration optional — set NEXT_PUBLIC_ONCHAIN=1 to
// route payments through the devnet OSR mint like the original deployment.

export const APP_NAME = 'OSR — Oil Strategic Reserve';

export const SOLANA_CLUSTER = 'devnet' as const;
export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.devnet.solana.com';

/** Token-2022 OSR mint used by the original devnet deployment. */
export const OSR_MINT = '6mXGTQZYKZtsiRUCh6K7CBkBbfn9WAdmb9GWf9obuX3R';

export const ONCHAIN_ENABLED = process.env.NEXT_PUBLIC_ONCHAIN === '1';

/** Starter drip granted on first connect (mirrors original devnet behavior). */
export const STARTER_OSR = 2500;
export const STARTER_SOL = 0.05;
