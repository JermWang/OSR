// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from 'vitest';
import type { Eip1193Provider } from './evm';

const account = '0x000000000000000000000000000000000000dEaD';

class MockProvider implements Eip1193Provider {
  chainId = '0x1';
  requests: string[] = [];
  listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  async request({ method, params }: { method: string; params?: readonly unknown[] | object }) {
    this.requests.push(method);
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
    if (method === 'eth_chainId') return this.chainId;
    if (method === 'wallet_switchEthereumChain') {
      this.chainId = ((params as Array<{ chainId: string }>)[0]).chainId;
      return null;
    }
    if (method === 'eth_getBalance') return '0xde0b6b3a7640000';
    throw new Error(`Unexpected method ${method}`);
  }

  on(event: string, callback: (...args: unknown[]) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]);
  }

  removeListener(event: string, callback: (...args: unknown[]) => void) {
    this.listeners.set(event, (this.listeners.get(event) ?? []).filter((item) => item !== callback));
  }
}

describe('EIP-6963 wallet flow', () => {
  const provider = new MockProvider();
  let walletStore: typeof import('./evm').useEvmWallet;
  let expectedChainId: number;
  let expectedHexId: string;

  beforeAll(async () => {
    const evm = await import('./evm');
    const config = await import('./config');
    walletStore = evm.useEvmWallet;
    expectedChainId = config.CHAIN.id;
    expectedHexId = config.CHAIN.hexId;
    walletStore.getState().initialize();
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: {
          info: { uuid: 'mock-wallet', name: 'Mock Wallet', icon: '', rdns: 'test.mock' },
          provider,
        },
      })
    );
  });

  it('discovers, connects, switches network, and reads the real provider balance', async () => {
    const connected = await walletStore.getState().connect('mock-wallet');
    const state = walletStore.getState();
    expect(connected?.toLowerCase()).toBe(account.toLowerCase());
    expect(state.chainId).toBe(expectedChainId);
    expect(provider.chainId).toBe(expectedHexId);
    expect(state.nativeBalance).toBe('1');
    expect(provider.requests).toContain('wallet_switchEthereumChain');
    expect(provider.requests).toContain('eth_getBalance');
  });
});
