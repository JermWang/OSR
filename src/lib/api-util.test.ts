import { describe, expect, it } from 'vitest';
import { requireSettlementReady, requireWallet } from './api-util';

describe('API financial guards', () => {
  it('accepts only EVM addresses and normalizes their case', () => {
    expect(requireWallet('0x000000000000000000000000000000000000dEaD')).toBe(
      '0x000000000000000000000000000000000000dead'
    );
    expect(() => requireWallet('6sVZaZRvdU5X9W4SWckL7mxgPS4UYZtsgFjYMEwDCuGY')).toThrow(
      'invalid wallet address'
    );
  });

  it('keeps mainnet mutations locked without verified settlement', () => {
    expect(() => requireSettlementReady()).toThrow('Mainnet transactions are locked');
  });
});
