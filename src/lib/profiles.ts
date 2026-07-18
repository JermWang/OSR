import type { UserOperation } from './api-client';
import { getServerSupabase, supabaseConfigured } from './supabase';

export type LeaderboardMetric = 'compound_level' | 'total_produced' | 'total_burned';

export interface GlobalProfile {
  wallet: string;
  displayName: string | null;
  joinedAt: number;
  lastSeenAt: number;
  totalSessions: number;
  compoundLevel: number;
  nodeCount: number;
  maxNodeLevel: number;
  sumNodeLevels: number;
  productionRate: number;
  totalProduced: number;
  totalBurned: number;
  online: boolean;
}

export interface ActivityItem {
  id: number;
  wallet: string;
  eventType: string;
  source: 'app' | 'onchain';
  amount: number | null;
  assetSymbol: string | null;
  txHash: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

type ProfileRow = {
  wallet: string;
  display_name: string | null;
  joined_at: number | string;
  last_seen_at: number | string;
  total_sessions: number;
  compound_level: number;
  node_count: number;
  max_node_level: number;
  sum_node_levels: number;
  production_rate: number;
  total_produced: number;
  total_burned: number;
};

function profileFromRow(row: ProfileRow): GlobalProfile {
  const lastSeenAt = Number(row.last_seen_at);
  return {
    wallet: row.wallet,
    displayName: row.display_name,
    joinedAt: Number(row.joined_at),
    lastSeenAt,
    totalSessions: Number(row.total_sessions),
    compoundLevel: Number(row.compound_level),
    nodeCount: Number(row.node_count),
    maxNodeLevel: Number(row.max_node_level),
    sumNodeLevels: Number(row.sum_node_levels),
    productionRate: Number(row.production_rate),
    totalProduced: Number(row.total_produced),
    totalBurned: Number(row.total_burned),
    online: Date.now() - lastSeenAt < 5 * 60_000,
  };
}

function activityFromRow(row: Record<string, unknown>): ActivityItem {
  return {
    id: Number(row.id),
    wallet: String(row.wallet),
    eventType: String(row.event_type),
    source: row.source as ActivityItem['source'],
    amount: row.amount == null ? null : Number(row.amount),
    assetSymbol: row.asset_symbol == null ? null : String(row.asset_symbol),
    txHash: row.tx_hash == null ? null : String(row.tx_hash),
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: String(row.created_at),
  };
}

export async function touchGlobalProfile(wallet: string, operation?: UserOperation) {
  if (!supabaseConfigured()) return null;
  const nodes = operation?.nodes ?? [];
  const { data, error } = await getServerSupabase().rpc('touch_profile', {
    p_wallet: wallet.toLowerCase(),
    p_compound_level: operation?.level ?? 1,
    p_node_count: nodes.length,
    p_max_node_level: nodes.reduce((max, node) => Math.max(max, node.level), 0),
    p_sum_node_levels: nodes.reduce((sum, node) => sum + node.level, 0),
    p_production_rate: operation?.productionRate ?? 0,
    p_total_produced: operation?.totalProduced ?? 0,
    p_total_burned: 0,
  });
  if (error) throw new Error(`Supabase profile sync failed: ${error.message}`);
  return profileFromRow(data as ProfileRow);
}

export async function getGlobalProfile(wallet: string): Promise<GlobalProfile | null> {
  if (!supabaseConfigured()) return null;
  const { data, error } = await getServerSupabase()
    .from('profiles')
    .select('*')
    .eq('wallet', wallet.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Supabase profile read failed: ${error.message}`);
  return data ? profileFromRow(data as ProfileRow) : null;
}

export async function getActivityHistory(wallet: string, limit = 50): Promise<ActivityItem[]> {
  if (!supabaseConfigured()) return [];
  const { data, error } = await getServerSupabase()
    .from('activity_history')
    .select('id,wallet,event_type,source,amount,asset_symbol,tx_hash,metadata,created_at')
    .eq('wallet', wallet.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) throw new Error(`Supabase activity read failed: ${error.message}`);
  return (data ?? []).map((row) => activityFromRow(row));
}

export async function recordActivity(
  wallet: string,
  eventType: string,
  details: {
    source?: ActivityItem['source'];
    amount?: number;
    assetSymbol?: string;
    txHash?: string;
    idempotencyKey?: string;
    metadata?: Record<string, unknown>;
  } = {}
) {
  if (!supabaseConfigured()) return;
  await touchGlobalProfile(wallet);
  const { error } = await getServerSupabase().from('activity_history').insert({
    wallet: wallet.toLowerCase(),
    event_type: eventType,
    source: details.source ?? 'app',
    amount: details.amount ?? null,
    asset_symbol: details.assetSymbol ?? null,
    tx_hash: details.txHash ?? null,
    idempotency_key: details.idempotencyKey ?? null,
    metadata: details.metadata ?? {},
  });
  if (error && error.code !== '23505') {
    throw new Error(`Supabase activity write failed: ${error.message}`);
  }
}

export async function globalLeaderboard(metric: LeaderboardMetric) {
  if (!supabaseConfigured()) return null;
  const column =
    metric === 'total_produced'
      ? 'total_produced'
      : metric === 'total_burned'
        ? 'total_burned'
        : 'compound_level';
  const { data, error } = await getServerSupabase()
    .from('profiles')
    .select('*')
    .order(column, { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(`Supabase leaderboard read failed: ${error.message}`);
  return (data ?? []).map((raw, index) => {
    const row = profileFromRow(raw as ProfileRow);
    return {
      rank: index + 1,
      wallet: row.wallet,
      displayName: row.displayName,
      online: row.online,
      compoundLevel: row.compoundLevel,
      maxLevel: row.maxNodeLevel,
      sumLevel: row.sumNodeLevels,
      nodes: row.nodeCount,
      productionRate: row.productionRate,
      totalProduced: row.totalProduced,
      totalBurned: row.totalBurned,
    };
  });
}

export async function profileBundle(wallet: string) {
  const profile = await getGlobalProfile(wallet);
  return {
    configured: supabaseConfigured(),
    profile,
    history: profile ? await getActivityHistory(wallet) : [],
  };
}

export async function linkPrivyIdentity(identity: {
  userId: string;
  wallet: string;
  walletId: string | null;
  walletClientType: string;
}) {
  if (!supabaseConfigured()) return;
  await touchGlobalProfile(identity.wallet);
  const { error } = await getServerSupabase().from('privy_identities').upsert(
    {
      privy_user_id: identity.userId,
      wallet: identity.wallet.toLowerCase(),
      privy_wallet_id: identity.walletId,
      wallet_client_type: identity.walletClientType,
      last_authenticated_at: new Date().toISOString(),
    },
    { onConflict: 'privy_user_id' }
  );
  if (error) throw new Error(`Supabase Privy identity sync failed: ${error.message}`);
}
