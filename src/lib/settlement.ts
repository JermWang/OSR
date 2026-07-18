// On-chain settlement bridge.
//
// Every action that costs an operator value follows the same two-phase shape:
//
//   1. QUOTE   the server prices the action from off-chain state, records a
//              settlement row, and returns an EIP-712 voucher signed by
//              OSR_VOUCHER_SIGNER_KEY.
//   2. SETTLE  the operator submits the voucher to OSRGame.execute(), then
//              hands the tx hash back. The server verifies the receipt against
//              the chain and only then applies the game-state change.
//
// The server picks the price but cannot fabricate the payment: the ERC-20
// movement is real and is proven by the mined ActionExecuted event. The client
// cannot alter the price either, because the voucher is signed and the contract
// enforces exactly the amounts it carries.

import { createPublicClient, http, decodeEventLog, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getDb } from './db';
import { GameError } from './game';
import { CHAIN, OSR_GAME_ADDRESS, OSR_VAULT_ADDRESS, isConfiguredAddress } from './config';

export type SettlementAction =
  | 'MintNode'
  | 'UpgradeNode'
  | 'OpenCrate'
  | 'UpgradeCompound'
  | 'ExpediteCompound';

/** Must match the Action enum ordering in contracts/src/OSRGame.sol. */
const ACTION_INDEX: Record<SettlementAction, number> = {
  MintNode: 0,
  UpgradeNode: 1,
  OpenCrate: 2,
  UpgradeCompound: 3,
  ExpediteCompound: 4,
};

export const ACTION_EXECUTED_ABI = parseAbi([
  'event ActionExecuted(address indexed operator, uint8 indexed action, bytes32 indexed detail, uint256 osrAmount, uint256 burned, uint256 toTreasury, uint256 toReserve, uint256 feeWei, uint256 nonce)',
]);

/** Confirmations required before a receipt is treated as final. */
export const MIN_CONFIRMATIONS = Number(process.env.OSR_MIN_CONFIRMATIONS ?? 2);

/** Voucher validity window. Short, so a stale quote cannot be settled later. */
const VOUCHER_TTL_SECONDS = 15 * 60;

const SIGNER_KEY = process.env.OSR_VOUCHER_SIGNER_KEY ?? '';

export const SETTLEMENT_CONFIGURED =
  isConfiguredAddress(OSR_GAME_ADDRESS) &&
  isConfiguredAddress(OSR_VAULT_ADDRESS) &&
  /^0x[0-9a-fA-F]{64}$/.test(SIGNER_KEY);

/**
 * Why writes stay locked. Surfaced verbatim by the API so the reason a player
 * cannot act is always the true one.
 */
export function settlementBlocker(): string | null {
  if (!isConfiguredAddress(OSR_GAME_ADDRESS)) return 'OSR game contract is not deployed yet';
  if (!isConfiguredAddress(OSR_VAULT_ADDRESS)) return 'OSR vault contract is not deployed yet';
  if (!/^0x[0-9a-fA-F]{64}$/.test(SIGNER_KEY)) return 'settlement signer is not configured';
  return null;
}

export function requireSettlement(): void {
  const blocker = settlementBlocker();
  if (blocker) {
    throw new GameError(`Mainnet transactions are locked: ${blocker}`, 503);
  }
}

const chain = {
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: CHAIN.nativeCurrency,
  rpcUrls: { default: { http: [CHAIN.rpcUrl] } },
} as const;

let clientRef: ReturnType<typeof createPublicClient> | null = null;
function publicClient() {
  if (!clientRef) {
    clientRef = createPublicClient({ chain, transport: http(CHAIN.rpcUrl) });
  }
  return clientRef;
}

export interface Quote {
  action: SettlementAction;
  /** Opaque 32-byte payload echoed into the event, binding receipt to intent. */
  detail: Hex;
  /** Whole OSR (not wei); converted to 18 decimals for the voucher. */
  osrAmount: number;
  burnBps: number;
  treasuryBps: number;
  feeEth: number;
}

export interface SignedVoucher {
  operator: string;
  action: number;
  detail: Hex;
  osrAmount: string;
  burnBps: number;
  treasuryBps: number;
  feeWei: string;
  nonce: string;
  deadline: number;
  signature: Hex;
  contract: string;
  chainId: number;
}

const toWei = (amount: number, decimals = 18): bigint => {
  // Route through a fixed-precision string: Number math on 1e18 loses cents.
  const [whole, frac = ''] = amount.toFixed(decimals).split('.');
  return BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals));
};

/** 32-byte detail payload from an arbitrary short identifier. */
export function encodeDetail(value: string): Hex {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 32) throw new GameError(`detail too long: ${value}`);
  const padded = new Uint8Array(32);
  padded.set(bytes);
  return `0x${Buffer.from(padded).toString('hex')}` as Hex;
}

function randomNonce(): bigint {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  // Clear the top byte so the value always fits comfortably in uint256.
  bytes[0] = 0;
  return BigInt(`0x${Buffer.from(bytes).toString('hex')}`);
}

/**
 * Price an action, persist it as an issued settlement, and return the signed
 * voucher the operator submits on-chain.
 */
export async function issueVoucher(wallet: string, quote: Quote): Promise<SignedVoucher> {
  requireSettlement();

  const account = privateKeyToAccount(SIGNER_KEY as Hex);
  const nonce = randomNonce();
  const deadline = Math.floor(Date.now() / 1000) + VOUCHER_TTL_SECONDS;
  const osrAmount = toWei(quote.osrAmount);
  const feeWei = toWei(quote.feeEth);
  const actionIndex = ACTION_INDEX[quote.action];

  const signature = await account.signTypedData({
    domain: {
      name: 'OSR Game',
      version: '1',
      chainId: CHAIN.id,
      verifyingContract: OSR_GAME_ADDRESS as Hex,
    },
    types: {
      ActionVoucher: [
        { name: 'operator', type: 'address' },
        { name: 'action', type: 'uint8' },
        { name: 'detail', type: 'bytes32' },
        { name: 'osrAmount', type: 'uint256' },
        { name: 'burnBps', type: 'uint16' },
        { name: 'treasuryBps', type: 'uint16' },
        { name: 'feeWei', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'ActionVoucher',
    message: {
      operator: wallet as Hex,
      action: actionIndex,
      detail: quote.detail,
      osrAmount,
      burnBps: quote.burnBps,
      treasuryBps: quote.treasuryBps,
      feeWei,
      nonce,
      deadline: BigInt(deadline),
    },
  });

  getDb()
    .prepare(
      `INSERT INTO settlements
         (nonce, wallet, action, detail, osr_amount, fee_wei, burn_bps, treasury_bps,
          deadline, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,'issued',?)`
    )
    .run(
      nonce.toString(),
      wallet,
      quote.action,
      quote.detail,
      osrAmount.toString(),
      feeWei.toString(),
      quote.burnBps,
      quote.treasuryBps,
      deadline,
      Date.now()
    );

  return {
    operator: wallet,
    action: actionIndex,
    detail: quote.detail,
    osrAmount: osrAmount.toString(),
    burnBps: quote.burnBps,
    treasuryBps: quote.treasuryBps,
    feeWei: feeWei.toString(),
    nonce: nonce.toString(),
    deadline,
    signature,
    contract: OSR_GAME_ADDRESS,
    chainId: CHAIN.id,
  };
}

export const CLAIMED_ABI = parseAbi([
  'event Claimed(address indexed operator, uint256 amount, uint256 indexed nonce)',
]);

/**
 * Issue a Vault claim voucher for `amount` OSR.
 *
 * Only one claim voucher may be outstanding per wallet. Without that rule an
 * operator could request several vouchers against the same unsettled accrual
 * and redeem them all, draining the reserve. The vault's per-voucher ceiling
 * and rolling window budget are the second line of defence.
 */
export async function issueClaimVoucher(wallet: string, amount: number) {
  requireSettlement();

  const db = getDb();
  const outstanding = db
    .prepare(
      `SELECT nonce, deadline FROM settlements
        WHERE wallet = ? AND action = 'Claim' AND status = 'issued'`
    )
    .all(wallet) as unknown as Array<{ nonce: string; deadline: number }>;
  const nowSec = Math.floor(Date.now() / 1000);
  const live = outstanding.filter((r) => r.deadline > nowSec);
  if (live.length > 0) {
    throw new GameError(
      'a claim voucher is already outstanding — redeem or let it expire first',
      409
    );
  }
  // Expired vouchers can never be redeemed on-chain, so release them.
  for (const stale of outstanding) {
    db.prepare("UPDATE settlements SET status = 'expired' WHERE nonce = ?").run(stale.nonce);
  }

  const account = privateKeyToAccount(SIGNER_KEY as Hex);
  const nonce = randomNonce();
  const deadline = Math.floor(Date.now() / 1000) + VOUCHER_TTL_SECONDS;
  const amountWei = toWei(amount);

  const signature = await account.signTypedData({
    domain: {
      name: 'OSR Vault',
      version: '1',
      chainId: CHAIN.id,
      verifyingContract: OSR_VAULT_ADDRESS as Hex,
    },
    types: {
      ClaimVoucher: [
        { name: 'operator', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'ClaimVoucher',
    message: {
      operator: wallet as Hex,
      amount: amountWei,
      nonce,
      deadline: BigInt(deadline),
    },
  });

  db.prepare(
    `INSERT INTO settlements
       (nonce, wallet, action, detail, osr_amount, fee_wei, burn_bps, treasury_bps,
        deadline, status, created_at)
     VALUES (?,?,'Claim','claim',?,'0',0,0,?,'issued',?)`
  ).run(nonce.toString(), wallet, amountWei.toString(), deadline, Date.now());

  return {
    operator: wallet,
    amount: amountWei.toString(),
    nonce: nonce.toString(),
    deadline,
    signature,
    contract: OSR_VAULT_ADDRESS,
    chainId: CHAIN.id,
  };
}

/** Verify a Vault redemption, then apply the off-chain accrual deduction once. */
export async function settleClaim<T>(
  wallet: string,
  nonce: string,
  txHash: string,
  apply: (amountOsrWei: string) => T
): Promise<T> {
  requireSettlement();
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new GameError('invalid transaction hash');

  const db = getDb();
  const row = db.prepare('SELECT * FROM settlements WHERE nonce = ?').get(nonce) as
    | unknown as SettlementRow | undefined;
  if (!row) throw new GameError('unknown settlement nonce', 404);
  if (row.wallet !== wallet) throw new GameError('settlement belongs to another wallet', 403);
  if (row.action !== 'Claim') throw new GameError('nonce is not a claim voucher', 400);
  if (row.status === 'settled') return JSON.parse(row.applied_result ?? 'null') as T;

  const receipt = await publicClient().getTransactionReceipt({ hash: txHash as Hex });
  if (!receipt) throw new GameError('transaction not found', 404);
  if (receipt.status !== 'success') throw new GameError('transaction reverted on-chain', 400);

  const head = await publicClient().getBlockNumber();
  const confirmations = head >= receipt.blockNumber ? head - receipt.blockNumber + 1n : 0n;
  if (confirmations < BigInt(MIN_CONFIRMATIONS)) {
    throw new GameError(`awaiting confirmations (${confirmations}/${MIN_CONFIRMATIONS})`, 425);
  }

  const vault = OSR_VAULT_ADDRESS.toLowerCase();
  let matched = false;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== vault) continue;
    try {
      const decoded = decodeEventLog({ abi: CLAIMED_ABI, data: log.data, topics: log.topics });
      const args = decoded.args as unknown as {
        operator: string;
        amount: bigint;
        nonce: bigint;
      };
      if (args.nonce.toString() !== nonce) continue;
      if (args.operator.toLowerCase() !== wallet.toLowerCase()) continue;
      if (args.amount.toString() !== row.osr_amount) continue;
      matched = true;
      break;
    } catch {
      // Not a Claimed log.
    }
  }
  if (!matched) throw new GameError('transaction does not contain a matching claim event', 400);

  const result = apply(row.osr_amount);
  const updated = db
    .prepare(
      `UPDATE settlements
          SET status = 'settled', tx_hash = ?, applied_result = ?, settled_at = ?
        WHERE nonce = ? AND status = 'issued'`
    )
    .run(txHash, JSON.stringify(result ?? null), Date.now(), nonce);
  if (updated.changes === 0) throw new GameError('settlement already applied', 409);
  return result;
}

interface SettlementRow {
  nonce: string;
  wallet: string;
  action: string;
  detail: string;
  osr_amount: string;
  fee_wei: string;
  status: string;
  tx_hash: string | null;
  applied_result: string | null;
}

/**
 * Verify that `txHash` really executed the quoted action on-chain, then hand
 * control to `apply` to mutate game state exactly once.
 *
 * Every check here is a way a caller could otherwise lie: wrong contract,
 * someone else's transaction, a reverted transaction, a replayed hash, a
 * mismatched amount, or a receipt that is not yet final.
 */
export async function settle<T>(
  wallet: string,
  nonce: string,
  txHash: string,
  apply: (row: SettlementRow) => T
): Promise<T> {
  requireSettlement();

  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new GameError('invalid transaction hash');
  const db = getDb();
  const row = db.prepare('SELECT * FROM settlements WHERE nonce = ?').get(nonce) as
    | unknown as SettlementRow | undefined;

  if (!row) throw new GameError('unknown settlement nonce', 404);
  if (row.wallet !== wallet) throw new GameError('settlement belongs to another wallet', 403);
  if (row.status === 'settled') {
    // Idempotent replay: return the stored result rather than applying twice.
    return JSON.parse(row.applied_result ?? 'null') as T;
  }

  const receipt = await publicClient().getTransactionReceipt({ hash: txHash as Hex });
  if (!receipt) throw new GameError('transaction not found', 404);
  if (receipt.status !== 'success') throw new GameError('transaction reverted on-chain', 400);
  if (receipt.from.toLowerCase() !== wallet.toLowerCase()) {
    throw new GameError('transaction was not sent by this wallet', 403);
  }

  const head = await publicClient().getBlockNumber();
  const confirmations = head >= receipt.blockNumber ? head - receipt.blockNumber + 1n : 0n;
  if (confirmations < BigInt(MIN_CONFIRMATIONS)) {
    throw new GameError(
      `awaiting confirmations (${confirmations}/${MIN_CONFIRMATIONS})`,
      425
    );
  }

  // Find the ActionExecuted log emitted by our game contract carrying our nonce.
  const game = OSR_GAME_ADDRESS.toLowerCase();
  let matched = false;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== game) continue;
    try {
      const decoded = decodeEventLog({
        abi: ACTION_EXECUTED_ABI,
        data: log.data,
        topics: log.topics,
      });
      const args = decoded.args as unknown as {
        operator: string;
        action: number;
        detail: string;
        osrAmount: bigint;
        feeWei: bigint;
        nonce: bigint;
      };
      if (args.nonce.toString() !== nonce) continue;
      if (args.operator.toLowerCase() !== wallet.toLowerCase()) continue;
      if (args.detail.toLowerCase() !== row.detail.toLowerCase()) continue;
      if (args.osrAmount.toString() !== row.osr_amount) continue;
      if (args.feeWei.toString() !== row.fee_wei) continue;
      matched = true;
      break;
    } catch {
      // Not an ActionExecuted log; keep scanning.
    }
  }
  if (!matched) {
    throw new GameError('transaction does not contain a matching settlement event', 400);
  }

  const result = apply(row);

  const updated = db
    .prepare(
      `UPDATE settlements
          SET status = 'settled', tx_hash = ?, applied_result = ?, settled_at = ?
        WHERE nonce = ? AND status = 'issued'`
    )
    .run(txHash, JSON.stringify(result ?? null), Date.now(), nonce);

  if (updated.changes === 0) {
    // Another request settled this nonce between our check and our write.
    throw new GameError('settlement already applied', 409);
  }

  return result;
}
