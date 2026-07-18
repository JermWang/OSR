-- Private mapping between Privy identities and their verified EVM wallets.
-- RLS intentionally has no public policies: only the server service role can
-- read or write this table.

create table if not exists public.privy_identities (
  privy_user_id text primary key,
  wallet text not null unique references public.profiles(wallet) on delete cascade,
  privy_wallet_id text,
  wallet_client_type text not null,
  created_at timestamptz not null default now(),
  last_authenticated_at timestamptz not null default now(),
  constraint privy_identity_wallet_evm check (wallet ~ '^0x[0-9a-f]{40}$'),
  constraint privy_identity_user_id check (privy_user_id like 'did:privy:%')
);

alter table public.privy_identities enable row level security;
revoke all on public.privy_identities from anon, authenticated;
create index if not exists privy_identity_wallet on public.privy_identities(wallet);
