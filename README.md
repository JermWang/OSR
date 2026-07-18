# OSR — Oil Strategic Reserve

An idle-mining strategy game on Robinhood Chain — an EVM L2 settling on
Ethereum (mainnet, chain ID 4663, gas token ETH). Deploy oil rigs and mining
shafts, equip rarity-tiered components, open crates, compound your operation,
and climb the leaderboard.

This repo is a ground-up rebuild ("v2") of the original deployment at
`devnet.osr.finance/app`, migrated to Robinhood Chain and upgraded with:

- **Original Blender models** — deployed nodes use byte-for-byte copies of the
  authoritative full-size `OSR_oil_rig.glb` and `OSR_mining_shaft.glb` source
  exports. The matching `OSR_sand.glb` remains the compound terrain. Rarity
  changes materials and effects without replacing or fabricating geometry.
- **Privy embedded wallets** — email, Google, or wallet login provisions a
  persistent embedded EVM hot wallet for every player. MetaMask, Rabby, and
  Robinhood Wallet can still be linked. Every server-side write verifies both
  the Privy access token and the wallet contained in the signed identity token.
- **No pretend settlement** — generated guest wallets, starter credits,
  simulated network participation, fabricated reserve addresses, and local
  transaction signatures are removed. Financial mutation
  routes remain locked until audited OSR token, game, vault, and treasury
  deployments are configured.
- **Mainnet safety lock** — the legacy local mutation escape path is removed.
  Financial routes remain unavailable until audited mainnet contracts and
  server-side transaction receipt verification are deployed.
- **Global player network** — Supabase stores persistent wallet-keyed profiles,
  session and game activity history, online presence, and the shared leaderboard.
  Public clients have read-only access; all writes use server-only credentials,
  row-level security, idempotency keys, and rate-limited session heartbeats.

The default Privy integration is an embedded user-wallet flow, not regulated
third-party custody. Privy custodial wallets currently require its Enterprise
plan, a supported custody partner such as Bridge, and beneficiary KYC. Do not
describe embedded wallets as licensed custody unless that separate program has
been approved and configured.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

Copy `.env.example` to `.env.local` and configure a production Robinhood Chain
RPC plus the deployed contract addresses. Never put private keys in a `NEXT_PUBLIC_*`
variable or commit them to the repository.

Create a Supabase project, link it with the Supabase CLI, and apply the checked-in
schema before starting the app:

```bash
npx supabase login
npx supabase link
npx supabase db push
```

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the
server-only `SUPABASE_SECRET_KEY`. The migration in `supabase/migrations` enables
RLS plus Realtime for profiles and activity history.

## Verification

```bash
npm test             # wallet discovery, switching, balance, and API guards
npm run test:rpc     # live mainnet chain ID/block verification
npm run typecheck
npm run build
```

## Layout

- `src/app` — Next.js App Router pages + API route handlers (the game backend)
- `src/lib` — game rules: rarity system, economy constants, DB
- `src/components` — UI (tabs, HUD) and the Three.js scene
- `public/models/authored` — exact authored hero rigs and individually exported parts
- `public/models/crates` — the retained v2 crate models
- `public/models/original` — the original Blender-exported sand/source GLBs
- `public/models/runtime` — derived Meshopt/WebP copies used by the live scene
- `ORS MODELS/` — source art and delivery packages (kept locally)

## Rebuild optimized model copies

The runtime assets can be regenerated without modifying the authoritative
exports. The script imports each source into a clean Blender scene and only
writes to `public/models/runtime`:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python scripts\optimize-authored-models.py
```
