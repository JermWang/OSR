// Node aura tiers — emissive color + label per compound level (L1 → L10).
// Mirrors the original deployment's module 39692 AURA_TIERS table.

export interface AuraTier {
  color: string;
  label: string;
}

/** Clamp any level to a real aura tier — levels run 1..10 and can exceed it. */
export function auraTier(level: number): AuraTier {
  return AURA_TIERS[Math.min(10, Math.max(1, Math.floor(level) || 1))];
}

/** Aura colour for a level, as a CSS/three-friendly hex string. */
export function auraHex(level: number): string {
  return auraTier(level).color;
}

/** Display label for a level's aura, title-cased ("Hot-Orange"). */
export function auraLabel(level: number): string {
  return auraTier(level)
    .label.split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('-');
}

export const AURA_TIERS: Record<number, AuraTier> = {
  1: { color: '#6b3410', label: 'rust' },
  2: { color: '#8a5a2b', label: 'bronze' },
  3: { color: '#b8732e', label: 'copper' },
  4: { color: '#9ba3ad', label: 'steel' },
  5: { color: '#d4d8de', label: 'silver' },
  6: { color: '#c8e0f0', label: 'platinum' },
  7: { color: '#ffb347', label: 'amber' },
  8: { color: '#ff7a1a', label: 'hot-orange' },
  9: { color: '#fff5cc', label: 'white-hot' },
  10: { color: '#ffd24d', label: 'gold' },
};
