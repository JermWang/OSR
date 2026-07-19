import { describe, expect, it } from 'vitest';
import {
  CHAIN,
  TOKEN_LIVE,
  ZERO_ADDRESS,
  isConfiguredAddress,
} from './config';

describe('Robinhood Chain configuration', () => {
  it('uses the official Robinhood Chain mainnet identifiers', () => {
    expect(CHAIN.id).toBe(4663);
    expect(CHAIN.hexId).toBe('0x1237');
    expect(CHAIN.rpcUrl).toContain('mainnet');
  });

  it('treats the zero address as unconfigured so the token cannot read as live', () => {
    expect(isConfiguredAddress(ZERO_ADDRESS)).toBe(false);
    expect(TOKEN_LIVE).toBe(false);
  });
});
