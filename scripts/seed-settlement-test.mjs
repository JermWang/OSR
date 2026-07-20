// Seed a known, small accrual onto a wallet so the first on-chain claim pays a
// predictable amount.
//
// The point is control over the number. A claim consumes accrual and transfers
// whatever it computes, so going into the first live payout without knowing the
// expected figure means having nothing to check the result against.
//
// Claims authenticate through Privy, so this has to target a wallet you can
// actually sign in with — seeding an invented address produces a row the API
// will never let you claim.
//
//   node scripts/seed-settlement-test.mjs 0xYourWallet --osr 25 --confirm
//   node scripts/seed-settlement-test.mjs 0xYourWallet --clear --confirm
//
// Touches the local SQLite database only. Sends nothing, signs nothing.

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const CLAIM_FEE_BPS = 200; // mirrors economy.ts
const CLAIM_COOLDOWN_MS = 3_600_000;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const wallet = argv.find((a) => /^0x[0-9a-fA-F]{40}$/.test(a));
const osr = Number(value('osr', '25'));
const clear = flag('clear');

if (!wallet) {
  console.error('\nUsage: node scripts/seed-settlement-test.mjs <0xWallet> [--osr 25] [--clear] --confirm');
  console.error('The wallet must be one you can sign in with — claims are authenticated.\n');
  process.exit(1);
}
if (!clear && !(osr > 0)) {
  console.error('--osr must be a positive number');
  process.exit(1);
}

const dir = process.env.OSR_DATA_DIR || 'data';
const file = path.join(dir, 'osr.db');
if (!fs.existsSync(file)) {
  console.error(`No database at ${file}. Start the app once to create it.`);
  process.exit(1);
}

const db = new DatabaseSync(file);
const now = Date.now();
const key = wallet.toLowerCase();

// The app stores whatever casing it authenticated with, so match case-insensitively
// rather than seeding a second row the API will never read.
const user = db
  .prepare('SELECT wallet, osr_balance FROM users WHERE LOWER(wallet) = ?')
  .get(key);

if (!user) {
  console.error(`\n${wallet} has no account yet.`);
  console.error('Sign in with it once so the app creates the row, then re-run.\n');
  process.exit(1);
}
const stored = user.wallet;

const nodes = db
  .prepare('SELECT id, family, level, accrued FROM nodes WHERE wallet = ? ORDER BY id')
  .all(stored);

if (!nodes.length) {
  console.error(`\n${stored} owns no nodes, so there is nothing to accrue rewards on.`);
  console.error('Mint one in the app first, then re-run.\n');
  process.exit(1);
}

const target = nodes[0];
const pending = nodes.reduce((sum, n) => sum + n.accrued, 0);

console.log(`\nwallet   ${stored}`);
console.log(`balance  ${user.osr_balance.toLocaleString()} OSR (local)`);
console.log(`nodes    ${nodes.length}, currently holding ${pending.toLocaleString()} OSR accrued`);

if (clear) {
  console.log(`\nwould zero accrual on all ${nodes.length} node(s)`);
} else {
  const gross = osr;
  const fee = (gross * CLAIM_FEE_BPS) / 10_000;
  console.log(`\nwould set node #${target.id} (${target.family}) accrual to ${gross} OSR`);
  console.log(`  claim fee  ${fee} OSR (${CLAIM_FEE_BPS / 100}%)`);
  console.log(`  payout     ${gross - fee} OSR should leave the treasury`);
  console.log('  (production keeps running, so the real figure may be a touch higher)');
}

if (!flag('confirm')) {
  console.log('\nDry run. Re-run with --confirm to write.\n');
  db.close();
  process.exit(0);
}

if (clear) {
  db.prepare('UPDATE nodes SET accrued = 0, accrued_updated_at = ? WHERE wallet = ?').run(now, stored);
  console.log('\nAccrual cleared.\n');
} else {
  // Zero the others so the claim total is exactly the seeded figure — claiming
  // without a nodeId sweeps every node the wallet owns.
  db.prepare('UPDATE nodes SET accrued = 0, accrued_updated_at = ? WHERE wallet = ?').run(now, stored);
  db.prepare('UPDATE nodes SET accrued = ?, accrued_updated_at = ? WHERE id = ?').run(osr, now, target.id);

  // The cooldown reads the newest 'claim' ledger row, so a recent test claim
  // would otherwise block the next one for an hour.
  const last = db
    .prepare("SELECT MAX(created_at) t FROM ledger WHERE wallet = ? AND kind = 'claim'").get(stored);
  if (last?.t && now - last.t < CLAIM_COOLDOWN_MS) {
    db.prepare("UPDATE ledger SET created_at = ? WHERE wallet = ? AND kind = 'claim'")
      .run(now - CLAIM_COOLDOWN_MS - 1000, stored);
    console.log('\nBackdated the claim cooldown so this can be claimed immediately.');
  }
  console.log(`\nSeeded. Claim in the app, then check the settlements table.\n`);
}

db.close();
