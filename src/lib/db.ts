import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Local game database on Node's built-in SQLite (node:sqlite, Node >= 22.5).
// The original devnet deployment used a hosted API (devnet-api.osr.finance);
// this clone runs the whole economy locally so the game is fully playable
// offline / self-hosted.

let db: DatabaseSync | null = null;

/** Resolve the SQLite directory. Explicit override wins so tests can isolate. */
export function resolveDataDir(): string {
  if (process.env.OSR_DATA_DIR) return process.env.OSR_DATA_DIR;
  // Vercel functions run from a read-only /var/task bundle. NOTE: os.tmpdir()
  // there is per-invocation and ephemeral — fine while writes are locked and
  // this is only an empty compatibility read, but it is NOT durable storage.
  // Durable multi-instance persistence must land before writes are unlocked.
  if (process.env.VERCEL) return path.join(os.tmpdir(), 'osr');
  return path.join(process.cwd(), 'data');
}

export function getDb(): DatabaseSync {
  if (db) return db;
  const dir = resolveDataDir();
  fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, 'osr.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      wallet TEXT PRIMARY KEY,
      osr_balance REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      dripped INTEGER NOT NULL DEFAULT 0,
      compound_level INTEGER NOT NULL DEFAULT 1,
      compound_started_at INTEGER,
      compound_target_level INTEGER,
      compound_ready_at INTEGER,
      last_crate_at INTEGER,
      crates_opened_today INTEGER NOT NULL DEFAULT 0,
      crates_day INTEGER NOT NULL DEFAULT 0,
      pity_legendary INTEGER NOT NULL DEFAULT 0,
      pity_mythic INTEGER NOT NULL DEFAULT 0,
      pity_divine INTEGER NOT NULL DEFAULT 0,
      welcome_started_at INTEGER,
      xstock_xomx REAL NOT NULL DEFAULT 0,
      xstock_cvxx REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL REFERENCES users(wallet),
      family TEXT NOT NULL CHECK (family IN ('oil','mine')),
      name TEXT,
      level INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      last_claim_at INTEGER NOT NULL,
      accrued REAL NOT NULL DEFAULT 0,
      accrued_updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL REFERENCES users(wallet),
      slot TEXT NOT NULL,
      family TEXT NOT NULL,
      rarity TEXT NOT NULL,
      equipped_node_id INTEGER,
      acquired_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount REAL NOT NULL,
      meta TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS protocol (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency (
      wallet TEXT NOT NULL,
      action TEXT NOT NULL,
      request_key TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (wallet, action, request_key)
    );

    -- On-chain settlement records. One row per issued action voucher. The
    -- nonce is the primary key and is also emitted in the OSRGame
    -- ActionExecuted event, which is what binds a mined transaction back to
    -- the exact quote the server signed. status walks issued -> settled; a
    -- settled row can never be applied twice.
    CREATE TABLE IF NOT EXISTS settlements (
      nonce TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      osr_amount TEXT NOT NULL,
      fee_wei TEXT NOT NULL,
      burn_bps INTEGER NOT NULL,
      treasury_bps INTEGER NOT NULL,
      deadline INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'issued',
      tx_hash TEXT,
      applied_result TEXT,
      created_at INTEGER NOT NULL,
      settled_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_wallet ON nodes(wallet);
    CREATE INDEX IF NOT EXISTS idx_components_wallet ON components(wallet);
    CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON ledger(wallet, created_at);
    CREATE INDEX IF NOT EXISTS idx_settlements_wallet ON settlements(wallet, created_at);
    -- A mined transaction may only ever back one settlement.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_settlements_tx ON settlements(tx_hash)
      WHERE tx_hash IS NOT NULL;
  `);

  // These counters were split after the initial local schema shipped. Keep the
  // migration additive so existing development databases continue to work.
  ensureColumn(db, 'users', 'rig_crates_opened_today', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'users', 'shaft_crates_opened_today', 'INTEGER NOT NULL DEFAULT 0');
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getProtocolValue(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM protocol WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setProtocolValue(key: string, value: string) {
  getDb()
    .prepare(
      'INSERT INTO protocol (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    )
    .run(key, value);
}

/** Execute a synchronous game mutation once and replay its saved response on retry. */
export function runIdempotent<T>(
  wallet: string,
  action: string,
  requestKey: unknown,
  mutation: () => T
): T {
  // Preserve compatibility with older clients while current clients always
  // send a key. Invalid keys deliberately do not get persisted.
  if (typeof requestKey !== 'string' || requestKey.length < 8 || requestKey.length > 128) {
    return mutation();
  }

  const database = getDb();
  const read = () =>
    database
      .prepare(
        'SELECT response FROM idempotency WHERE wallet = ? AND action = ? AND request_key = ?'
      )
      .get(wallet, action, requestKey) as { response: string } | undefined;
  const cached = read();
  if (cached) return JSON.parse(cached.response) as T;

  database.exec('BEGIN IMMEDIATE');
  try {
    const raced = read();
    if (raced) {
      database.exec('COMMIT');
      return JSON.parse(raced.response) as T;
    }
    const result = mutation();
    database
      .prepare(
        'INSERT INTO idempotency (wallet, action, request_key, response, created_at) VALUES (?,?,?,?,?)'
      )
      .run(wallet, action, requestKey, JSON.stringify(result), Date.now());
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
