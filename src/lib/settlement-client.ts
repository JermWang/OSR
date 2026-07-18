'use client';

// Browser half of the settlement flow.
//
// The server prices an action and signs a voucher; this module gets that
// voucher on-chain and hands the resulting transaction hash back so the server
// can verify the receipt. Nothing here is trusted by the server — it only
// produces a transaction, and the server independently checks what that
// transaction actually did.

import { createPublicClient, createWalletClient, custom, erc20Abi, parseAbi, type Hex } from 'viem';
import { requireSettlementProvider, robinhoodChain } from './evm';
import { OSR_TOKEN_ADDRESS, OSR_GAME_ADDRESS } from './config';

export const GAME_ABI = parseAbi([
  'function execute(uint8 action, bytes32 detail, uint256 osrAmount, uint16 burnBps, uint16 treasuryBps, uint256 feeWei, uint256 nonce, uint256 deadline, bytes signature) payable',
]);

export const VAULT_ABI = parseAbi([
  'function claim(address operator, uint256 amount, uint256 nonce, uint256 deadline, bytes signature)',
]);

/** Progress states surfaced to the UI so a multi-transaction flow is legible. */
export type SettlementStep =
  | 'quoting'
  | 'approving'
  | 'submitting'
  | 'confirming'
  | 'settling';

export type StepHandler = (step: SettlementStep) => void;

export interface ActionVoucher {
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

export interface ClaimVoucher {
  operator: string;
  amount: string;
  nonce: string;
  deadline: number;
  signature: Hex;
  contract: string;
  chainId: number;
}

async function clients() {
  const provider = await requireSettlementProvider();
  const transport = custom(provider);
  return {
    wallet: createWalletClient({ chain: robinhoodChain, transport }),
    pub: createPublicClient({ chain: robinhoodChain, transport }),
  };
}

/**
 * Ensure the game contract may pull `amount` OSR.
 *
 * Approves the exact amount rather than an unlimited allowance: a bug or
 * compromise in the game contract should never be able to reach further into
 * an operator's balance than the action they just agreed to.
 */
async function ensureAllowance(owner: Hex, amount: bigint, onStep?: StepHandler): Promise<void> {
  if (amount === 0n) return;
  const { wallet, pub } = await clients();

  const allowance = await pub.readContract({
    address: OSR_TOKEN_ADDRESS as Hex,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, OSR_GAME_ADDRESS as Hex],
  });
  if (allowance >= amount) return;

  onStep?.('approving');
  const hash = await wallet.writeContract({
    account: owner,
    chain: robinhoodChain,
    address: OSR_TOKEN_ADDRESS as Hex,
    abi: erc20Abi,
    functionName: 'approve',
    args: [OSR_GAME_ADDRESS as Hex, amount],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('OSR approval failed');
}

/** Submit a priced action to OSRGame.execute() and return its transaction hash. */
export async function submitAction(
  voucher: ActionVoucher,
  onStep?: StepHandler
): Promise<Hex> {
  const operator = voucher.operator as Hex;
  const osrAmount = BigInt(voucher.osrAmount);
  await ensureAllowance(operator, osrAmount, onStep);

  const { wallet, pub } = await clients();
  onStep?.('submitting');
  const hash = await wallet.writeContract({
    account: operator,
    chain: robinhoodChain,
    address: voucher.contract as Hex,
    abi: GAME_ABI,
    functionName: 'execute',
    args: [
      voucher.action,
      voucher.detail,
      osrAmount,
      voucher.burnBps,
      voucher.treasuryBps,
      BigInt(voucher.feeWei),
      BigInt(voucher.nonce),
      BigInt(voucher.deadline),
      voucher.signature,
    ],
    value: BigInt(voucher.feeWei),
  });

  onStep?.('confirming');
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain');
  return hash;
}

/** Redeem a claim voucher at OSRVault and return its transaction hash. */
export async function submitClaim(
  voucher: ClaimVoucher,
  onStep?: StepHandler
): Promise<Hex> {
  const { wallet, pub } = await clients();
  onStep?.('submitting');
  const hash = await wallet.writeContract({
    account: voucher.operator as Hex,
    chain: robinhoodChain,
    address: voucher.contract as Hex,
    abi: VAULT_ABI,
    functionName: 'claim',
    args: [
      voucher.operator as Hex,
      BigInt(voucher.amount),
      BigInt(voucher.nonce),
      BigInt(voucher.deadline),
      voucher.signature,
    ],
  });

  onStep?.('confirming');
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Claim transaction reverted on-chain');
  return hash;
}
