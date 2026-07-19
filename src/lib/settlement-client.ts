'use client';

// Browser half of settlement.
//
// The server quotes an action and returns payment instructions; this module
// sends the operator's OSR to the protocol treasury as a plain ERC-20 transfer
// and hands the tx hash back. Nothing here is trusted — the server verifies the
// Transfer event on-chain before applying anything.
//
// No token approval is needed: the operator transfers directly from their own
// wallet, so this is a single signature rather than approve-then-spend.

import { createPublicClient, createWalletClient, custom, erc20Abi, type Hex } from 'viem';
import { requireSettlementProvider, robinhoodChain } from './evm';

/** Progress states surfaced to the UI so a multi-step action reads clearly. */
export type SettlementStep = 'quoting' | 'submitting' | 'confirming' | 'settling';
export type StepHandler = (step: SettlementStep) => void;

export interface PaymentRequest {
  action: string;
  /** ERC-20 to send. */
  token: string;
  /** Protocol treasury that must receive it. */
  to: string;
  /** Base units, decimal string. */
  amount: string;
  osrAmount: number;
  decimals: number;
  nonce: string;
  deadline: number;
  chainId: number;
}

/**
 * Send the quoted OSR to the treasury and return the transaction hash.
 */
export async function submitPayment(
  payment: PaymentRequest,
  onStep?: StepHandler
): Promise<Hex> {
  const provider = await requireSettlementProvider();
  const transport = custom(provider);
  const wallet = createWalletClient({ chain: robinhoodChain, transport });
  const pub = createPublicClient({ chain: robinhoodChain, transport });

  const [account] = await wallet.getAddresses();
  if (!account) throw new Error('No wallet account available');

  onStep?.('submitting');
  const hash = await wallet.writeContract({
    account,
    chain: robinhoodChain,
    address: payment.token as Hex,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [payment.to as Hex, BigInt(payment.amount)],
  });

  onStep?.('confirming');
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Payment transaction reverted on-chain');
  return hash;
}
