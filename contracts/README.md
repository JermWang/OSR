# OSR contracts

On-chain settlement layer for the Oil Strategic Reserve on Robinhood Chain
(chain 4663, gas ETH).

```
npm run contracts:build     # compile to contracts/out/
```

## What is on-chain, and what is not

Value is on-chain. Game logic is not.

| On-chain (auditable, real) | Off-chain (`src/lib/game.ts`) |
| --- | --- |
| OSR balances, transfers, burns | Production accrual and the halving curve |
| Treasury and reserve splits | Network grow power and the share cap |
| ETH action fees | Crate RNG, pity, gear stats |
| Claim payouts from the vault | Node levels, compound levels, inventory |

Simulating accrual per block on-chain would cost far more gas than the rewards
are worth, so the server computes it and the contracts move the value. The two
are bound together by EIP-712 vouchers and receipt verification.

## Contracts

**`OSRToken.sol`** — Fixed-supply ERC-20. 229,000,000 OSR minted once in the
constructor; there is no mint function, so supply can only fall. Must equal
`TOTAL_SUPPLY` in `src/lib/economy.ts`.

**`OSRTreasury.sol`** — Sink for treasury OSR splits and ETH fees. Holds value,
no game logic. Owner-only withdrawals, all evented for reconciliation.

**`OSRVault.sol`** — Holds the undistributed emission reserve and pays operator
claims against backend-signed `ClaimVoucher`s. Payouts are bounded twice, by a
per-voucher ceiling and a rolling window budget, so a leaked signer key cannot
drain the reserve in one go.

**`OSRGame.sol`** — The action surface. `execute()` takes a signed
`ActionVoucher`, performs the real ERC-20 split (burn / treasury / reserve) plus
the ETH fee transfer, and emits `ActionExecuted`. The backend verifies that
event before applying any game-state change.

**Trust model.** The server sets prices, because prices depend on off-chain
state the contracts deliberately do not track. The server *cannot* fabricate a
payment: every unit burned or moved is a real token transfer, proven by a mined
event. A client cannot alter a price either — the voucher is signed, and the
contract enforces exactly the amounts it carries. Each voucher is redeemable
once, keyed by its EIP-712 digest.

## Deployment order

Deploy in this order; each step needs the previous addresses.

1. `OSRToken(distributor)` — `distributor` should be a multisig.
2. `OSRTreasury(owner)`
3. `OSRVault(owner, token, signer, maxClaim, windowBudget, windowSeconds)`
4. `OSRGame(owner, token, treasury, vault, signer)`

Then:

5. Transfer the emission reserve from the distributor to `OSRVault`.
6. Set vault limits to match the emission schedule. `GENESIS_RATE_PER_SEC` is
   262, so a one-hour window can legitimately need ~943,200 OSR across all
   operators. Set `windowBudget` above real demand but far below the reserve.
7. Point the app at the deployed addresses (below) and redeploy.

## Environment

```
NEXT_PUBLIC_OSR_TOKEN=0x...
NEXT_PUBLIC_OSR_GAME=0x...
NEXT_PUBLIC_OSR_VAULT=0x...
NEXT_PUBLIC_OSR_TREASURY=0x...
OSR_VOUCHER_SIGNER_KEY=0x...   # server-only; must match the signer passed to Vault and Game
OSR_MIN_CONFIRMATIONS=2
```

`OSR_VOUCHER_SIGNER_KEY` is the single most sensitive secret in the system. It
must never be a `NEXT_PUBLIC_` variable, and it should be rotated with
`setVoucherSigner()` on both Vault and Game if there is any doubt.

## Pre-token mode

Until those addresses are set the game runs **off-chain and fully playable**.
Actions go straight through the engine, and `users.osr_balance` is the ledger of
record. Setting the four addresses plus the signer flips every priced action to
quote -> on-chain execute -> receipt verification with no other code change:
`SETTLEMENT_CONFIGURED` in `src/lib/settlement.ts` is the single switch, and
both the server routes and the client honour it.

One thing to get right at that moment: balances accrued off-chain exist only in
SQLite. Migrating them means minting or transferring the matching OSR to each
holder, or explicitly deciding not to carry them over. Decide which before
flipping the switch, not after.

## Before mainnet

These are not optional, and none of them are done:

- [ ] **Contract unit tests.** There is no EVM harness in this repo yet. The
      splits, voucher replay protection, signature malleability rejection, and
      the vault's window accounting all need direct coverage.
- [ ] **External audit.** These contracts custody real value and have not been
      reviewed by anyone.
- [ ] **Testnet run** of the full quote to settle cycle against a live chain.
- [ ] **Durable server storage.** The engine still writes SQLite, which is
      per-invocation and ephemeral on Vercel. See `resolveDataDir()` in
      `src/lib/db.ts`. Game state will not survive a cold start as things
      stand.
- [ ] **End-to-end run with a real wallet.** The client flow
      (`src/lib/settlement-client.ts`) is wired but has only ever been exercised
      against the auth gate — no transaction has been submitted, because no
      contracts exist to submit to. The approval step, the fee value, the
      confirmation wait and the 425 retry loop are all unproven in practice.

Done since the settlement layer landed:

- [x] **Client wiring.** `api.mintNode` / `upgradeNode` / `openCrate` /
      `upgradeCompound` / `expediteCompound` now quote, submit on-chain through
      the connected wallet, and settle. `api.claim` redeems a vault voucher.
      Each accepts an `onStep` callback so the UI can narrate approval,
      submission, confirmation and settlement.
