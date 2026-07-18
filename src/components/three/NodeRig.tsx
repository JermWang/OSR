'use client';

// Modular node rig — assembles a base + 4 per-rarity slot components from the
// v3 asset set. This is the big visual upgrade over the original (which used a
// single hero GLB with material swaps): each rarity tier has real geometry.

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  RARITY_COLOR,
  BODY_TINT,
  MOTION_SPEED,
  PULSE_AMP,
  PULSE_SPEED,
  RIM_INTENSITY,
  RIM_POWER,
  SLOT_BODY_TINT,
  STRUCT_BODY_TINT,
  SWEEP_INTENSITY,
  METAL,
  ROUGH,
  STRUCT_FACTORS,
  rarityTier,
  rimColor,
  rarityFx,
  levelTheme,
  levelUnlocks,
} from './fx';
import { applyRarityRim, applyRarityToMaterial, applyLevelEra, type RimUniforms } from './materials';
import { GroundGlow, LightBeam, Motes, RarityAura } from './Aura';
import { NODE_SLOTS, modelPath, basePath, type NodeFamily, type Rarity, RARITIES } from '@/lib/rarity';

export interface RigNodeData {
  id: string;
  type: NodeFamily;
  level: number;
  isActive?: boolean;
  components: Array<{ slot: string; rarity: string }>;
}

/** Socket positions on the 8m base deck (from the v3 base builders). */
const SOCKETS: Record<NodeFamily, Record<string, [number, number, number]>> = {
  oil: {
    derrick: [-2.5, 0.22, -2.5],
    pump_jack: [2.5, 0.22, -2.5],
    pipeline: [-2.5, 0.22, 2.5],
    flare_stack: [2.5, 0.22, 2.5],
  },
  mine: {
    drill_bit: [-2.5, 0.24, -2.5],
    elevator: [2.5, 0.24, -2.5],
    rail_track: [-2.5, 0.24, 2.5],
    ore_cart: [2.5, 0.24, 2.5],
  },
};

type AnimFn = (t: number) => void;

interface ThemedPiece {
  scene: THREE.Group;
  uniforms: RimUniforms[];
  anims: AnimFn[];
}

function findByName(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!found && o.name === name) found = o;
  });
  return found;
}

/** Clone + theme one slot component GLB for its rarity. */
function themeSlotPiece(
  src: THREE.Group,
  slot: string,
  rarity: Rarity,
  level: number
): ThemedPiece {
  const scene = src.clone(true);
  const tier = rarityTier(rarity);
  const fx = rarityFx(rarity);
  const uniforms: RimUniforms[] = [];
  const anims: AnimFn[] = [];
  const matCache = new Map<THREE.Material, THREE.MeshStandardMaterial>();

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = mats.map((m) => {
      const std = m as THREE.MeshStandardMaterial;
      if (matCache.has(std)) return matCache.get(std)!;
      const c = std.clone();
      applyRarityToMaterial(c, {
        color: fx.color,
        glow: fx.glow,
        metal: fx.metal,
        rough: fx.rough,
        bodyTint: SLOT_BODY_TINT[tier],
        finish: BODY_TINT[tier],
      });
      const flow =
        (slot === 'pipeline' || slot === 'flare_stack') && tier >= 3
          ? 0.25 + (tier - 3) * 0.12
          : 0;
      const u = applyRarityRim(c, {
        color: rimColor(rarity),
        rimPower: RIM_POWER[tier] ?? 2.5,
        rimIntensity: RIM_INTENSITY[tier] ?? 0,
        flow,
        flowColor: fx.accent,
        pulseAmp: PULSE_AMP[tier] ?? 0.15,
        pulseSpeed: PULSE_SPEED[tier] ?? 1.6,
        sweep: SWEEP_INTENSITY[tier] ?? 0,
        tierKey: `${slot}:${rarity}`,
      });
      if (u) uniforms.push(u);
      matCache.set(std, c);
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  // White-hot core for mythic+ flame/drill hotspots.
  if ((slot === 'flare_stack' || slot === 'drill_bit') && tier >= 5) {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial;
        const sum = std.emissive ? std.emissive.r + std.emissive.g + std.emissive.b : 0;
        if (/flame|drill|accent|glow/i.test(std.name || '') || sum > 0.05) {
          std.emissive.lerp(new THREE.Color('#fff6e8'), 0.6);
          std.emissiveIntensity = 7;
          std.toneMapped = false;
        }
      }
    });
  }

  // Animations — v3 moving children: pump_jack/beam, flare_stack/flame,
  // elevator/cage; drill_bit spins whole; ore_cart shuttles.
  const speed = MOTION_SPEED[tier] ?? 1;
  if (slot === 'pump_jack') {
    const beam = findByName(scene, 'beam');
    if (beam) anims.push((t) => (beam.rotation.z = 0.2 * Math.sin(t * speed * 1.6)));
  } else if (slot === 'drill_bit') {
    const bit = findByName(scene, 'drill_bit') ?? scene;
    anims.push((t) => (bit.rotation.y = t * speed * 2.2));
  } else if (slot === 'ore_cart') {
    const cart = findByName(scene, 'ore_cart') ?? scene;
    const z0 = cart.position.z;
    anims.push((t) => (cart.position.z = z0 + 0.144 * Math.sin(t * speed * 1.3)));
  } else if (slot === 'elevator') {
    const cage = findByName(scene, 'cage');
    if (cage) {
      const y0 = cage.position.y;
      anims.push((t) => (cage.position.y = y0 + 0.5 + 0.5 * Math.sin(t * speed * 0.7)));
    }
  } else if (slot === 'flare_stack') {
    const flame = findByName(scene, 'flame');
    if (flame) {
      const s0 = flame.scale.clone();
      anims.push((t) => {
        const f = 1 + 0.18 * Math.sin(t * 9) + 0.1 * Math.sin(t * 23 + 1.7);
        flame.scale.set(s0.x * f, s0.y * (1 + 0.3 * (f - 1)), s0.z * f);
      });
    }
  }

  // Level era on any leftover untinted structure inside the slot piece.
  const theme = levelTheme(level);
  void theme;

  return { scene, uniforms, anims };
}

function themeBase(src: THREE.Group, topRarity: Rarity, level: number): ThemedPiece {
  const scene = src.clone(true);
  const tier = rarityTier(topRarity);
  const fx = rarityFx(topRarity);
  const theme = levelTheme(level);
  const uniforms: RimUniforms[] = [];
  const factors = STRUCT_FACTORS.base;
  const matCache = new Map<THREE.Material, THREE.MeshStandardMaterial>();

  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = mats.map((m) => {
      const std = m as THREE.MeshStandardMaterial;
      if (matCache.has(std)) return matCache.get(std)!;
      const c = std.clone();
      applyLevelEra(c, theme);
      if (tier >= 1) {
        applyRarityToMaterial(c, {
          color: fx.color,
          glow: 0,
          metal: METAL[tier],
          rough: ROUGH[tier],
          bodyTint: STRUCT_BODY_TINT[tier] * factors.tint,
          finish: BODY_TINT[tier] * 0.5 * factors.tint,
          bodyEmissive: factors.emissive,
        });
        const u = applyRarityRim(c, {
          color: rimColor(topRarity),
          rimPower: RIM_POWER[tier] ?? 2.5,
          rimIntensity: (RIM_INTENSITY[tier] ?? 0) * factors.rim,
          sweep: (SWEEP_INTENSITY[tier] ?? 0) * 0.6,
          tierKey: `base:${topRarity}:${level}`,
        });
        if (u) uniforms.push(u);
      }
      matCache.set(std, c);
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  return { scene, uniforms, anims: [] };
}

/** Level-unlock decorations: helipad (L2), crown beacon (L3), banner (L10). */
function Unlocks({ level, family, color }: { level: number; family: NodeFamily; color: string }) {
  const u = levelUnlocks(level, family);
  return (
    <group>
      {u.helipad && (
        <group position={[0, 0.32, 0]}>
          <mesh position={[3.2, 0, 3.2]}>
            <cylinderGeometry args={[0.9, 0.9, 0.08, 24]} />
            <meshStandardMaterial color="#3b4252" metalness={0.4} roughness={0.6} />
          </mesh>
          <mesh position={[3.2, 0.05, 3.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.55, 0.7, 24]} />
            <meshStandardMaterial emissive="#ffd24d" emissiveIntensity={1.2} color="#000" toneMapped={false} />
          </mesh>
        </group>
      )}
      {u.derrickCrown && (
        <mesh position={[-2.5, 8.2, -2.5]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial emissive="#ff4444" emissiveIntensity={3} color="#000" toneMapped={false} />
        </mesh>
      )}
      {u.secondShaft && (
        <mesh position={[0, 0.9, -3.4]}>
          <boxGeometry args={[1.4, 1.4, 1.4]} />
          <meshStandardMaterial color="#4a4238" metalness={0.3} roughness={0.7} />
        </mesh>
      )}
      {u.banner && (
        <group position={[0, 5.4, 0]}>
          <mesh>
            <cylinderGeometry args={[0.03, 0.03, 4, 8]} />
            <meshStandardMaterial color="#d9a93a" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0.5, 1.6, 0]}>
            <planeGeometry args={[1, 0.6]} />
            <meshStandardMaterial emissive={color} emissiveIntensity={1.4} color="#111" side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function NodeRig({
  node,
  targetSize = 6,
  onClick,
}: {
  node: RigNodeData;
  targetSize?: number;
  onClick?: (id: string) => void;
}) {
  const family = node.type === 'mine' ? 'mine' : 'oil';
  const slots = NODE_SLOTS[family];
  const rarityOf = (slot: string): Rarity =>
    (node.components.find((c) => c.slot === slot)?.rarity as Rarity) ?? 'common';

  const base = useGLTF(basePath(family)) as unknown as { scene: THREE.Group };
  const slotGltfs = [
    useGLTF(modelPath(family, slots[0], rarityOf(slots[0]))) as unknown as { scene: THREE.Group },
    useGLTF(modelPath(family, slots[1], rarityOf(slots[1]))) as unknown as { scene: THREE.Group },
    useGLTF(modelPath(family, slots[2], rarityOf(slots[2]))) as unknown as { scene: THREE.Group },
    useGLTF(modelPath(family, slots[3], rarityOf(slots[3]))) as unknown as { scene: THREE.Group },
  ];

  const raritySig = slots.map(rarityOf).join(',');
  const level = node.level ?? 1;
  const theme = levelTheme(level);

  const assembled = useMemo(() => {
    const basePiece = themeBase(base.scene, topRarity(), level);
    const pieces = slots.map((slot, i) => {
      const piece = themeSlotPiece(slotGltfs[i].scene, slot, rarityOf(slot), level);
      const socket = SOCKETS[family][slot];
      piece.scene.position.set(...socket);
      return piece;
    });
    return { basePiece, pieces };
    function topRarity(): Rarity {
      let top = 0;
      for (const s of slots) top = Math.max(top, rarityTier(rarityOf(s)));
      return RARITIES[top];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base.scene, slotGltfs[0].scene, slotGltfs[1].scene, slotGltfs[2].scene, slotGltfs[3].scene, raritySig, level, family]);

  const allUniforms = useMemo(
    () => [
      ...assembled.basePiece.uniforms,
      ...assembled.pieces.flatMap((p) => p.uniforms),
    ],
    [assembled]
  );
  const allAnims = useMemo(() => assembled.pieces.flatMap((p) => p.anims), [assembled]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const u of allUniforms) u.uTime.value = t;
    for (const a of allAnims) a(t);
  });

  // Dispose cloned materials on unmount / reassembly.
  useEffect(() => {
    const groups = [assembled.basePiece.scene, ...assembled.pieces.map((p) => p.scene)];
    return () => {
      for (const g of groups) {
        g.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => m.dispose());
          }
        });
      }
    };
  }, [assembled]);

  const top = slots.reduce((m, s) => Math.max(m, rarityTier(rarityOf(s))), 0);
  const topR = RARITIES[top];
  const active = node.isActive ?? true;
  const moteCount = top >= 6 ? 90 : top >= 5 ? 60 : top >= 4 ? 38 : 0;
  const scale = (targetSize / 9) * theme.scale;
  const flareSlot = family === 'oil' ? 'flare_stack' : 'drill_bit';
  const flareTier = rarityTier(rarityOf(flareSlot));
  const flarePos = SOCKETS[family][flareSlot];

  return (
    <group
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick(node.id);
            }
          : undefined
      }
    >
      <group scale={scale}>
        <primitive object={assembled.basePiece.scene} />
        {assembled.pieces.map((p, i) => (
          <primitive key={`${slots[i]}:${raritySig}`} object={p.scene} />
        ))}
        <Unlocks level={level} family={family} color={RARITY_COLOR[topR]} />
        {theme.ring > 0 && (
          <GroundGlow color={theme.pigment} radius={5.2} opacity={0.1 + 0.14 * theme.ring} />
        )}
        <group scale={2.2}>
          <RarityAura components={node.components} isActive={active} />
        </group>
        {flareTier >= 4 && (
          <group position={flarePos}>
            <LightBeam color={rimColor(RARITIES[flareTier])} height={12} opacity={0.1 + 0.03 * flareTier} />
          </group>
        )}
      </group>
      {active && moteCount > 0 && (
        <Motes
          color={rimColor(topR)}
          count={moteCount}
          area={[1.6 * targetSize, 1.35 * targetSize, 1.6 * targetSize]}
          size={0.5 * targetSize}
          speed={0.35}
        />
      )}
      {active && top >= 2 && (
        <pointLight
          color={rimColor(topR)}
          intensity={0.6 * rarityFx(topR).light}
          distance={1.9 * targetSize}
          decay={2}
          position={[0, 0.55 * targetSize, 0]}
        />
      )}
    </group>
  );
}

// Preload bases (slot GLBs load on demand per rarity).
useGLTF.preload('/models/oil/base.glb');
useGLTF.preload('/models/mine/base.glb');
