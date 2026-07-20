// Preflight for the on-chain settlement path.
//
// Setting NEXT_PUBLIC_OSR_TOKEN flips every claim, mint, upgrade and crate from
// a local balance update to a real ERC-20 transfer, with no other code change.
// This script answers "is that switch safe to flip yet" before anyone finds out
// the hard way — a claim consumes the operator's accrual before it attempts the
// payout, so a treasury that cannot pay costs them real rewards.
//
//   node scripts/check-settlement-config.mjs
//
// Reads only. Never sends a transaction, and never prints a secret's value.

import fs from 'fs';

// A plain node script gets no .env.local, unlike the Next runtime.
for (const file of ['.env.local', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

const RPC = process.env.NEXT_PUBLIC_RH_RPC || 'https://rpc.mainnet.chain.robinhood.com';
const EXPECTED_CHAIN = 4663;
const ZERO = '0x0000000000000000000000000000000000000000';
const TOKEN = (process.env.NEXT_PUBLIC_OSR_TOKEN ?? '').trim();
const TREASURY = (process.env.NEXT_PUBLIC_OSR_TREASURY_WALLET ?? '').trim();

const problems = [];
const warnings = [];
const fail = (m) => problems.push(m);
const warn = (m) => warnings.push(m);

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${method} returned HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.error) throw new Error(`${method}: ${payload.error.message}`);
  return payload.result;
}

const call = (to, data) => rpc('eth_call', [{ to, data }, 'latest']);
const configured = (a) => /^0x[0-9a-fA-F]{40}$/.test(a) && a.toLowerCase() !== ZERO;
const padAddress = (a) => a.replace(/^0x/, '').toLowerCase().padStart(64, '0');
const big = (hex) => (hex && hex !== '0x' ? BigInt(hex) : 0n);

/** Format base units as a human amount without floating-point rounding. */
function units(value, decimals) {
  const s = value.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, '');
  return (Number(whole).toLocaleString() + (frac ? `.${frac.slice(0, 4)}` : ''));
}

/** ERC-20 string getters may return a dynamic string or a legacy bytes32. */
function decodeString(hex) {
  const body = (hex ?? '').replace(/^0x/, '');
  if (!body) return null;
  if (body.length === 64) {
    const text = Buffer.from(body, 'hex').toString('utf8').replace(/\0+$/, '');
    return text.trim() || null;
  }
  const length = Number(BigInt(`0x${body.slice(64, 128)}`));
  return Buffer.from(body.slice(128, 128 + length * 2), 'hex').toString('utf8') || null;
}

console.log(`\nRPC   ${RPC}`);

// --- chain ---------------------------------------------------------------
let head = 0;
try {
  const [chainHex, blockHex] = await Promise.all([rpc('eth_chainId'), rpc('eth_blockNumber')]);
  const chainId = Number.parseInt(chainHex, 16);
  head = Number.parseInt(blockHex, 16);
  if (chainId !== EXPECTED_CHAIN) fail(`RPC is chain ${chainId}, expected ${EXPECTED_CHAIN}`);
  console.log(`chain ${chainId}, head block ${head.toLocaleString()}`);
} catch (e) {
  fail(`RPC unreachable: ${e.message}`);
  console.log('chain UNREACHABLE');
}

// --- token ---------------------------------------------------------------
let decimals = 18;
console.log(`\ntoken    ${TOKEN || '(unset)'}`);
if (!configured(TOKEN)) {
  console.log('         settlement is OFF — claims credit the local balance only');
  warn('NEXT_PUBLIC_OSR_TOKEN is unset or zero, so nothing settles on-chain yet');
} else if (problems.length === 0) {
  const code = await rpc('eth_getCode', [TOKEN, 'latest']).catch(() => '0x');
  if (!code || code === '0x') {
    fail(`no contract deployed at ${TOKEN} — check the address and the chain`);
  } else {
    const [decHex, symRaw, supplyHex] = await Promise.all([
      call(TOKEN, '0x313ce567').catch(() => null),
      call(TOKEN, '0x95d89b41').catch(() => null),
      call(TOKEN, '0x18160ddd').catch(() => null),
    ]);

    if (decHex == null) {
      // settlement.ts caches a failed decimals() read as 18 for the process
      // lifetime, so a token that is not 18 decimals would be mis-priced by
      // orders of magnitude with no second attempt.
      fail('decimals() did not respond — do NOT start until this reads cleanly');
    } else {
      decimals = Number(big(decHex));
      if (decimals !== 18) {
        warn(`token has ${decimals} decimals, not 18 — verify amounts carefully on the first claim`);
      }
    }
    console.log(`         symbol ${decodeString(symRaw) ?? '?'}, decimals ${decimals}`);
    if (supplyHex) console.log(`         total supply ${units(big(supplyHex), decimals)}`);
  }
}

// --- treasury ------------------------------------------------------------
console.log(`\ntreasury ${TREASURY || '(unset)'}`);
if (!configured(TREASURY)) {
  fail('NEXT_PUBLIC_OSR_TREASURY_WALLET is unset or zero — payouts have no source');
} else if (problems.length === 0) {
  // Gas is checked even in off-chain mode: an unfunded treasury is worth
  // discovering now rather than on the first claim after the token goes live.
  const eth = big(await rpc('eth_getBalance', [TREASURY, 'latest']).catch(() => null));
  console.log(`         holds ${units(eth, 18)} ETH (gas for payouts)`);
  if (eth === 0n) {
    const note = 'treasury holds no ETH — payouts cannot pay gas';
    configured(TOKEN) ? fail(note) : warn(`${note} (fund it before setting the token)`);
  } else if (eth < 10n ** 15n) {
    warn('treasury ETH is under 0.001 — top it up before testing');
  }

  if (configured(TOKEN)) {
    const osr = big(await call(TOKEN, `0x70a08231${padAddress(TREASURY)}`).catch(() => null));
    console.log(`         holds ${units(osr, decimals)} OSR`);
    if (osr === 0n) fail('treasury holds no OSR — every claim will consume accrual and then fail');
  }
}

// --- server config -------------------------------------------------------
// Presence only. These are secrets; their values are never printed.
console.log('\nserver');
for (const [name, label] of [
  ['OSR_TREASURY_WALLET_ID', 'Privy wallet id'],
  ['PRIVY_APP_SECRET', 'Privy app secret'],
  ['NEXT_PUBLIC_PRIVY_APP_ID', 'Privy app id'],
]) {
  const present = (process.env[name] ?? '').trim().length > 0;
  console.log(`         ${present ? 'set  ' : 'MISSING'} ${label}`);
  if (!present) fail(`${name} is not set — the treasury cannot sign payouts`);
}

const perEth = Number(process.env.OSR_PER_ETH ?? '0');
const minConf = Number(process.env.OSR_MIN_CONFIRMATIONS ?? 2);
console.log(`         OSR_PER_ETH ${perEth || '0 (protocol absorbs payout gas)'}`);
console.log(`         OSR_MIN_CONFIRMATIONS ${minConf}`);

// --- verdict -------------------------------------------------------------
console.log('');
for (const w of warnings) console.log(`  warn  ${w}`);
for (const p of problems) console.log(`  FAIL  ${p}`);

if (problems.length) {
  console.log(`\n${problems.length} blocking problem(s). Do not claim against this config.\n`);
  process.exit(1);
}
console.log(
  configured(TOKEN)
    ? '\nSettlement config looks sane. Claims will move real tokens.\n'
    : '\nOff-chain mode. Nothing will touch the chain.\n'
);
