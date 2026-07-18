import { describe, expect, it } from 'vitest';
import {
  CHAIN,
  CONTRACTS_CONFIGURED,
  ZERO_ADDRESS,
  isConfiguredAddress,
} from './config';

describe('Robinhood Chain configuration', () => {
  it('uses the official Robinhood Chain mainnet identifiers', () => {
    expect(CHAIN.id).toBe(4663);
    expect(CHAIN.hexId).toBe('0x1237');
    expect(CHAIN.rpcUrl).toContain('mainnet');
  });

  it('keeps financial actions locked for zero-address deployments', () => {
    expect(isConfiguredAddress(ZERO_ADDRESS)).toBe(false);
    expect(CONTRACTS_CONFIGURED).toBe(false);
  });
});
