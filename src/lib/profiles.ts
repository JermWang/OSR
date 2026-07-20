import type { UserOperation } from './api-client';
import {
  getPublicServerSupabase,
  getServerSupabase,
  publicSupabaseConfigured,
  supabaseConfigured,
} from './supabase';

export type LeaderboardMetric = 'compound_level' | 'total_produced' | 'total_burned';

export interface GlobalProfile {
  wallet: string;
  displayName: string | null;
  avatarUrl: string | null;
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
  avatar_url?: string | null;
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
    avatarUrl: row.avatar_url ?? null,
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
  if (!publicSupabaseConfigured()) return null;
  const { data, error } = await getPublicServerSupabase()
    .from('profiles')
    .select('*')
    .eq('wallet', wallet.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(`Supabase profile read failed: ${error.message}`);
  return data ? profileFromRow(data as ProfileRow) : null;
}

export async function getActivityHistory(wallet: string, limit = 50): Promise<ActivityItem[]> {
  if (!publicSupabaseConfigured()) return [];
  const { data, error } = await getPublicServerSupabase()
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
  if (!publicSupabaseConfigured()) return null;
  const column =
    metric === 'total_produced'
      ? 'total_produced'
      : metric === 'total_burned'
        ? 'total_burned'
        : 'compound_level';
  const { data, error } = await getPublicServerSupabase()
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
      avatarUrl: row.avatarUrl,
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
    configured: publicSupabaseConfigured(),
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

/**
 * Player-editable identity fields — the only profile columns a player may
 * write. Everything else on the row is a projection of game state and is
 * owned by the sync path, so this update deliberately cannot touch it.
 *
 * The display name mirrors the DB constraint (2-28 chars) so the caller gets
 * a readable error instead of a check-violation string; the constraint stays
 * as the backstop.
 */
export async function updateProfileIdentity(
  wallet: string,
  fields: { displayName?: string | null; avatarUrl?: string | null }
): Promise<GlobalProfile> {
  if (!supabaseConfigured()) throw new Error('profile database is not configured');

  const patch: Record<string, string | null> = {};
  if (fields.displayName !== undefined) {
    const name = fields.displayName?.trim() || null;
    if (name != null) {
      if (name.length < 2 || name.length > 28) {
        throw new Error('display name must be 2-28 characters');
      }
      // Printable, no control characters; the game renders these everywhere.
      if (!/^[\p{L}\p{N}\p{P}\p{S} ]+$/u.test(name)) {
        throw new Error('display name contains unsupported characters');
      }
    }
    patch.display_name = name;
  }
  if (fields.avatarUrl !== undefined) patch.avatar_url = fields.avatarUrl;
  if (Object.keys(patch).length === 0) throw new Error('nothing to update');

  // The session sync creates the row on first sign-in, so a missing row means
  // the wallet has never authenticated — reject rather than invent a profile.
  const { data, error } = await getServerSupabase()
    .from('profiles')
    .update(patch)
    .eq('wallet', wallet.toLowerCase())
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`profile update failed: ${error.message}`);
  if (!data) throw new Error('profile not found — sign in once before editing it');
  return profileFromRow(data as ProfileRow);
}

/**
 * Store an avatar image and point the profile at it.
 *
 * One object per wallet (`<wallet>.<ext>`, upsert) so re-uploads replace the
 * old file instead of accumulating orphans. The public bucket URL is written
 * to the profile row, which is what every reader actually uses.
 */
export async function saveAvatar(
  wallet: string,
  bytes: Uint8Array,
  contentType: string
): Promise<GlobalProfile> {
  if (!supabaseConfigured()) throw new Error('profile database is not configured');
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${wallet.toLowerCase()}.${ext}`;
  const supabase = getServerSupabase();

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { contentType, upsert: true });
  if (uploadError) throw new Error(`avatar upload failed: ${uploadError.message}`);

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  // Cache-bust: the path is stable across re-uploads, so browsers would keep
  // showing the old image forever without a version marker.
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  return updateProfileIdentity(wallet, { avatarUrl: url });
}
