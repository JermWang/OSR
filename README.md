# OSR — Oil Strategic Reserve

A Solana devnet idle-mining strategy game. Deploy oil rigs and mining shafts,
equip rarity-tiered components, open crates, compound your operation, and climb
the leaderboard.

This repo is a ground-up rebuild ("v2") of the original devnet deployment at
`devnet.osr.finance/app`, upgraded with:

- **Real 3D compound** — the full `deliverables_v3` asset set (56 rarity-tiered
  components, 2 bases, 7 crates) rendered with react-three-fiber, rarity
  tint/emissive/aura shaders, animated pump jacks, drills, carts, elevators and
  flare flames.
- **Self-contained backend** — the original game talked to a hosted API
  (`devnet-api.osr.finance`). This rebuild ships the whole economy as Next.js
  route handlers + SQLite, so the game runs entirely locally.
- **Optional on-chain mode** — wallet connect (Phantom / Solflare / Backpack)
  on Solana devnet; the original Token-2022 OSR mint is preserved in config.

## Run

```bash
npm install
npm run dev   # http://localhost:3000
```

## Layout

- `src/app` — Next.js App Router pages + API route handlers (the game backend)
- `src/lib` — game rules: rarity system, economy constants, DB
- `src/components` — UI (tabs, HUD) and the three.js scene
- `public/models` — web-ready GLBs (v3 deliverables); `public/env` — HDR
- `ORS MODELS/` — source art (git-ignored; kept locally)
