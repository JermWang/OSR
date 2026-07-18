'use client';

// Uses the isolated previews rendered from the authored Blender slot models.

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

export const SLOT_IMAGES: Record<string, string> = Object.fromEntries(
  Object.keys(SLOT_GLYPHS).map((slot) => [slot, `/models/authored/previews/${slot}.png`])
);

interface ComponentTileProps {
  slot: string;
  rarity: Rarity;
  size?: number;
}

export default function ComponentTile({ slot, rarity, size = 86 }: ComponentTileProps) {
  const hex = rarityHex(rarity);
  const image = SLOT_IMAGES[slot];

  return (
    <div
      aria-hidden
      className="relative flex select-none items-center justify-center overflow-hidden rounded-md"
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
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          style={{
            width: '92%',
            height: '92%',
            objectFit: 'contain',
            filter: `drop-shadow(0 0 ${Math.round(size * 0.08)}px ${hex}aa)`,
          }}
        />
      ) : (
        <span style={{ filter: `drop-shadow(0 0 ${Math.round(size * 0.08)}px ${hex}aa)` }}>
          {SLOT_GLYPHS[slot] ?? '·'}
        </span>
      )}
    </div>
  );
}
