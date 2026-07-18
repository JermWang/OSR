'use client';

// Styled 2D stand-in for the original runtime-captured WebGL component sprites.
// Kept as a single clean component so a 3D capture pipeline can swap in later
// without touching the pages that render tiles.

import { rarityHex, type Rarity } from '@/lib/rarity';

export const SLOT_GLYPHS: Record<string, string> = {
  derrick: '⛰',
  pump_jack: '⚡',
  pipeline: '⛓',
  flare_stack: '🔥',
  drill_bit: '⛏',
  ore_cart: '🚲',
  rail_track: '═',
  elevator: '↕',
};

interface ComponentTileProps {
  slot: string;
  rarity: Rarity;
  size?: number;
}

export default function ComponentTile({ slot, rarity, size = 86 }: ComponentTileProps) {
  const hex = rarityHex(rarity);
  return (
    <div
      aria-hidden
      className="flex select-none items-center justify-center rounded-md"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 35%, ${hex}38 0%, ${hex}12 55%, transparent 100%)`,
        border: `1px solid ${hex}44`,
        boxShadow: `inset 0 0 ${Math.round(size * 0.25)}px ${hex}22`,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      }}
    >
      <span style={{ filter: `drop-shadow(0 0 ${Math.round(size * 0.08)}px ${hex}aa)` }}>
        {SLOT_GLYPHS[slot] ?? '·'}
      </span>
    </div>
  );
}
