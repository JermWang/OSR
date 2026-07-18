// OSR rarity system — 7 component tiers + 10 node aura levels.
// Multipliers/colors match the original game spec (ORS MODELS/rarity_system.js).

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'divine';

export const RARITIES: Rarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
  'divine',
];

export interface RarityDef {
  multiplier: number;
  tint: number;
  emissive: number;
  emitStrength: number;
  bloom: number;
  aura: number | null;
  label: string;
}

export const COMPONENT_RARITIES: Record<Rarity, RarityDef> = {
  common:    { multiplier: 1.0,  tint: 0xb0b0b0, emissive: 0x000000, emitStrength: 0,    bloom: 0,    aura: null,     label: 'Common' },
  uncommon:  { multiplier: 1.3,  tint: 0x4dd94d, emissive: 0x1a5c1a, emitStrength: 0.2,  bloom: 0.08, aura: 0x44ff44, label: 'Uncommon' },
  rare:      { multiplier: 1.6,  tint: 0x4d80ff, emissive: 0x2244aa, emitStrength: 0.4,  bloom: 0.15, aura: 0x4488ff, label: 'Rare' },
  epic:      { multiplier: 2.0,  tint: 0xb34dff, emissive: 0x6611a0, emitStrength: 0.7,  bloom: 0.3,  aura: 0xaa44ff, label: 'Epic' },
  legendary: { multiplier: 2.5,  tint: 0xffd900, emissive: 0xff8800, emitStrength: 1.0,  bloom: 0.5,  aura: 0xffd700, label: 'Legendary' },
  mythic:    { multiplier: 3.5,  tint: 0xff3333, emissive: 0xff2200, emitStrength: 1.5,  bloom: 0.75, aura: 0xff4400, label: 'Mythic' },
  divine:    { multiplier: 5.0,  tint: 0xffffff, emissive: 0xeeeeff, emitStrength: 2.5,  bloom: 1.2,  aura: 0xfffff0, label: 'Divine' },
};

export const AURA_LEVELS: Record<number, { name: string; color: number; bloom: number }> = {
  1:  { name: 'Rust',       color: 0x8b4513, bloom: 0.05 },
  2:  { name: 'Bronze',     color: 0xcd7f32, bloom: 0.1 },
  3:  { name: 'Copper',     color: 0xb87333, bloom: 0.15 },
  4:  { name: 'Steel',      color: 0x71797e, bloom: 0.2 },
  5:  { name: 'Silver',     color: 0xc0c0c0, bloom: 0.3 },
  6:  { name: 'Platinum',   color: 0xe5e4e2, bloom: 0.4 },
  7:  { name: 'Amber',      color: 0xffbf00, bloom: 0.55 },
  8:  { name: 'Hot-Orange', color: 0xff6600, bloom: 0.7 },
  9:  { name: 'White-Hot',  color: 0xfffaf0, bloom: 0.9 },
  10: { name: 'Gold',       color: 0xffd700, bloom: 1.2 },
};

export type NodeFamily = 'oil' | 'mine';

export const NODE_SLOTS: Record<NodeFamily, string[]> = {
  oil: ['derrick', 'pump_jack', 'pipeline', 'flare_stack'],
  mine: ['drill_bit', 'ore_cart', 'rail_track', 'elevator'],
};

export const SLOT_LABELS: Record<string, string> = {
  derrick: 'Derrick Tower',
  pump_jack: 'Pump Jack',
  pipeline: 'Pipeline',
  flare_stack: 'Flare Stack',
  drill_bit: 'Drill Bit',
  ore_cart: 'Ore Cart',
  rail_track: 'Rail Track',
  elevator: 'Shaft Elevator',
};

/** Average multiplier across 4 slots; empty slots count as 1.0x. */
export function computeNodeMultiplier(slotRarities: (Rarity | null | undefined)[]): number {
  const filled = [...slotRarities];
  while (filled.length < 4) filled.push(null);
  return (
    filled.reduce<number>((sum, r) => sum + (r ? COMPONENT_RARITIES[r].multiplier : 1.0), 0) / 4
  );
}

export function rarityHex(r: Rarity): string {
  return `#${COMPONENT_RARITIES[r].tint.toString(16).padStart(6, '0')}`;
}

export function modelPath(family: NodeFamily, slot: string, rarity: Rarity): string {
  return `/models/${family}/${slot}/${slot}_${rarity}.glb`;
}

export function basePath(family: NodeFamily): string {
  return `/models/${family}/base.glb`;
}

export function cratePath(rarity: Rarity): string {
  return `/models/crates/crate_${rarity}.glb`;
}
