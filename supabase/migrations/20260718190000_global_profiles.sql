-- OSR global player identity, activity history, and leaderboard source.
-- Game settlement remains on Robinhood Chain; these tables hold public,
-- off-chain social/progression projections keyed by a verified EVM address.

create table if not exists public.profiles (
  wallet text primary key,
  display_name text,
  joined_at bigint not null,
  last_seen_at bigint not null,
  total_sessions integer not null default 1,
  compound_level integer not null default 1,
  node_count integer not null default 0,
  max_node_level integer not null default 0,
  sum_node_levels integer not null default 0,
  production_rate double precision not null default 0,
  total_produced double precision not null default 0,
  total_burned double precision not null default 0,
  updated_at timestamptz not null default now(),
  constraint profiles_wallet_evm check (wallet ~ '^0x[0-9a-f]{40}$'),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 2 and 28)
);

create table if not exists public.activity_history (
  id bigint generated always as identity primary key,
  wallet text not null references public.profiles(wallet) on delete cascade,
  event_type text not null,
  source text not null default 'app',
  amount double precision,
  asset_symbol text,
  tx_hash text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_event_type_length check (char_length(event_type) between 2 and 64),
  constraint activity_source check (source in ('app', 'onchain')),
  constraint activity_tx_hash check (tx_hash is null or tx_hash ~ '^0x[0-9a-fA-F]{64}$')
);

create index if not exists profiles_compound_rank
  on public.profiles (compound_level desc, total_produced desc);
create index if not exists profiles_produced_rank
  on public.profiles (total_produced desc, compound_level desc);
create index if not exists profiles_burned_rank
  on public.profiles (total_burned desc, compound_level desc);
create index if not exists activity_wallet_created
  on public.activity_history (wallet, created_at desc);
create unique index if not exists activity_idempotency
  on public.activity_history (wallet, event_type, idempotency_key)
  where idempotency_key is not null;

alter table public.profiles enable row level security;
alter table public.activity_history enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable"
  on public.profiles for select to anon, authenticated using (true);

drop policy if exists "Public activity is readable" on public.activity_history;
create policy "Public activity is readable"
  on public.activity_history for select to anon, authenticated using (true);

grant select on public.profiles to anon, authenticated;
grant select on public.activity_history to anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.activity_history from anon, authenticated;

-- A server-only RPC performs an atomic profile heartbeat. A new activity row
-- is added only for a genuinely new session (30+ minutes since last seen), so
-- normal polling cannot flood player history.
create or replace function public.touch_profile(
  p_wallet text,
  p_compound_level integer default 1,
  p_node_count integer default 0,
  p_max_node_level integer default 0,
  p_sum_node_levels integer default 0,
  p_production_rate double precision default 0,
  p_total_produced double precision default 0,
  p_total_burned double precision default 0
) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  existing public.profiles;
  saved public.profiles;
  new_session boolean := false;
begin
  if p_wallet !~ '^0x[0-9a-f]{40}$' then
    raise exception 'invalid wallet address';
  end if;

  select * into existing from public.profiles where wallet = p_wallet for update;
  if not found then
    insert into public.profiles (
      wallet, joined_at, last_seen_at, compound_level, node_count,
      max_node_level, sum_node_levels, production_rate, total_produced, total_burned
    ) values (
      p_wallet, now_ms, now_ms, greatest(1, p_compound_level), greatest(0, p_node_count),
      greatest(0, p_max_node_level), greatest(0, p_sum_node_levels),
      greatest(0, p_production_rate), greatest(0, p_total_produced), greatest(0, p_total_burned)
    ) returning * into saved;

    insert into public.activity_history (wallet, event_type, source, metadata)
    values (p_wallet, 'profile_created', 'app', jsonb_build_object('compoundLevel', saved.compound_level));
    return saved;
  end if;

  new_session := now_ms - existing.last_seen_at >= 1800000;
  update public.profiles set
    last_seen_at = now_ms,
    total_sessions = total_sessions + case when new_session then 1 else 0 end,
    compound_level = greatest(compound_level, p_compound_level),
    node_count = greatest(0, p_node_count),
    max_node_level = greatest(0, p_max_node_level),
    sum_node_levels = greatest(0, p_sum_node_levels),
    production_rate = greatest(0, p_production_rate),
    total_produced = greatest(total_produced, p_total_produced),
    total_burned = greatest(total_burned, p_total_burned),
    updated_at = now()
  where wallet = p_wallet
  returning * into saved;

  if new_session then
    insert into public.activity_history (wallet, event_type, source)
    values (p_wallet, 'session_started', 'app');
  end if;
  return saved;
end;
$$;

revoke all on function public.touch_profile(text, integer, integer, integer, integer, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.touch_profile(text, integer, integer, integer, integer, double precision, double precision, double precision) to service_role;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.activity_history;
exception when duplicate_object then null;
end $$;
