'use client';

// Deployed nodes use byte-for-byte copies of the authoritative full-size
// Blender exports. Rarity changes materials and effects only; it never
// substitutes procedural geometry for the player's models.

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useCursor, useGLTF } from '@react-three/drei';
import { GroundGlow, Motes, RarityAura } from './Aura';
import {
  BODY_TINT,
  MOTION_SPEED,
  PULSE_AMP,
  PULSE_SPEED,
  RARITY_COLOR,
  RIM_INTENSITY,
  RIM_POWER,
  SLOT_BODY_TINT,
  SWEEP_INTENSITY,
  levelTheme,
  rarityFx,
  rarityTier,
  rimColor,
} from './fx';
import { applyRarityRim, applyRarityToMaterial, type RimUniforms } from './materials';
import { NODE_SLOTS, RARITIES, type NodeFamily, type Rarity } from '@/lib/rarity';

export interface RigNodeData {
  id: string;
  type: NodeFamily;
  level: number;
  isActive?: boolean;
  components: Array<{ slot: string; rarity: string }>;
}

const RUNTIME_MODEL: Record<NodeFamily, string> = {
  oil: '/models/runtime/OSR_oil_rig.glb',
  mine: '/models/runtime/OSR_mining_shaft.glb',
};

/** Object names exactly as authored in the authoritative full-size GLBs. */
const AUTHORED_SLOT_OBJECTS: Record<NodeFamily, Record<string, string>> = {
  oil: {
    'derrick tower': 'derrick',
    rig: 'pump_jack',
  },
  mine: {
    cart: 'ore_cart',
    tracks: 'rail_track',
  },
};

type Animate = (time: number) => void;

interface ThemedRig {
  scene: THREE.Group;
  sourceWidth: number;
  uniforms: RimUniforms[];
  animations: Animate[];
}

function asRarity(value: string | undefined): Rarity {
  return RARITIES.includes(value as Rarity) ? (value as Rarity) : 'common';
}

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (!found && object.name === name) found = object;
  });
  return found;
}

function owningSlot(object: THREE.Object3D, scene: THREE.Object3D, family: NodeFamily): string | null {
  const slots = NODE_SLOTS[family];
  let current: THREE.Object3D | null = object;
  while (current && current !== scene) {
    if (slots.includes(current.name)) return current.name;
    const authoredSlot = AUTHORED_SLOT_OBJECTS[family][current.name.toLowerCase()];
    if (authoredSlot) return authoredSlot;
    current = current.parent;
  }
  return null;
}

function themeAuthoredRig(
  source: THREE.Group,
  family: NodeFamily,
  level: number,
  rarityOf: (slot: string) => Rarity,
  anisotropy: number
): ThemedRig {
  const scene = source.clone(true);
  const theme = levelTheme(level);
  const uniforms: RimUniforms[] = [];
  const animations: Animate[] = [];
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const slot = owningSlot(mesh, scene, family);
    const rarity = slot ? rarityOf(slot) : null;
    const tier = rarity ? rarityTier(rarity) : 0;
    const fx = rarity ? rarityFx(rarity) : null;
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    const materials = sourceMaterials.map((material) => {
      const key = `${slot ?? 'structure'}:${material.uuid}`;
      const cached = materialCache.get(key);
      if (cached) return cached;

      const cloned = (material as THREE.MeshStandardMaterial).clone();
      const textureKeys: Array<keyof THREE.MeshStandardMaterial> = [
        'map',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'aoMap',
        'emissiveMap',
        'alphaMap',
      ];
      textureKeys.forEach((textureKey) => {
        const texture = cloned[textureKey];
        if (texture instanceof THREE.Texture) texture.anisotropy = anisotropy;
      });
      if (rarity && fx && slot) {
        // Keep the authored texture readable; rarity is an accent, not a repaint.
        applyRarityToMaterial(cloned, {
          color: fx.color,
          glow: fx.glow,
          metal: fx.metal * 0.45,
          rough: fx.rough * 0.35,
          bodyTint: SLOT_BODY_TINT[tier] * 0.28,
          finish: BODY_TINT[tier] * 0.18,
        });
        const rim = applyRarityRim(cloned, {
          color: rimColor(rarity),
          rimPower: RIM_POWER[tier] ?? 2.5,
          rimIntensity: (RIM_INTENSITY[tier] ?? 0) * 0.55,
          flow: (slot === 'pipeline' || slot === 'flare_stack') && tier >= 3 ? 0.12 + (tier - 3) * 0.05 : 0,
          flowColor: fx.accent,
          pulseAmp: PULSE_AMP[tier] ?? 0.15,
          pulseSpeed: PULSE_SPEED[tier] ?? 1.6,
          sweep: (SWEEP_INTENSITY[tier] ?? 0) * 0.35,
          tierKey: `authored:${family}:${slot}:${rarity}`,
        });
        if (rim) uniforms.push(rim);
      } else if (cloned.color && theme.pigmentTint > 0) {
        cloned.color.lerp(new THREE.Color(theme.pigment), theme.pigmentTint * 0.18);
        cloned.needsUpdate = true;
      }

      materialCache.set(key, cloned);
      return cloned;
    });

    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  const flame = findNamed(scene, 'flame');
  if (flame) {
    const home = flame.scale.clone();
    animations.push((time) => {
      const flicker = 1 + 0.12 * Math.sin(time * 9) + 0.07 * Math.sin(time * 21 + 1.4);
      flame.scale.set(home.x * flicker, home.y * (1 + 0.4 * (flicker - 1)), home.z * flicker);
    });
  }

  const drill = findNamed(scene, 'drill_bit');
  if (drill) {
    const speed = MOTION_SPEED[rarityTier(rarityOf('drill_bit'))] ?? 1;
    const home = drill.rotation.y;
    animations.push((time) => {
      drill.rotation.y = home + time * speed * 0.8;
    });
  }

  const cart = findNamed(scene, 'cart');
  if (cart) {
    const home = cart.position.z;
    animations.push((time) => {
      cart.position.z = home + 0.08 * Math.sin(time * 0.9);
    });
  }

  const elevator = findNamed(scene, 'elevator');
  if (elevator) {
    const home = elevator.position.y;
    animations.push((time) => {
      elevator.position.y = home + 0.2 * Math.sin(time * 0.65);
    });
  }

  ['Gear2_Gear_0', 'Gear2_Gear_0.001', 'Gear2_Gear_0.002', 'Gear2_Gear_0.003'].forEach((name, index) => {
    const gear = findNamed(scene, name);
    if (!gear) return;
    const home = gear.rotation.x;
    const direction = index % 2 === 0 ? 1 : -1;
    animations.push((time) => {
      gear.rotation.x = home + direction * time * 0.75;
    });
  });

  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  scene.position.set(-center.x, -bounds.min.y, -center.z);

  return {
    scene,
    sourceWidth: Math.max(size.x, size.z, 0.001),
    uniforms,
    animations,
  };
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
  const family: NodeFamily = node.type === 'mine' ? 'mine' : 'oil';
  const source = useGLTF(RUNTIME_MODEL[family], false, true) as unknown as { scene: THREE.Group };
  const anisotropy = useThree((state) => Math.min(16, state.gl.capabilities.getMaxAnisotropy()));
  const interaction = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && Boolean(onClick));
  const slots = NODE_SLOTS[family];
  const rarityOf = (slot: string): Rarity =>
    asRarity(node.components.find((component) => component.slot === slot)?.rarity);
  const raritySignature = slots.map(rarityOf).join(',');
  const level = node.level ?? 1;

  const themed = useMemo(
    () => themeAuthoredRig(source.scene, family, level, rarityOf, anisotropy),
    // raritySignature captures every material selection used by rarityOf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source.scene, family, level, raritySignature, anisotropy]
  );

  useFrame(({ clock }, delta) => {
    const time = clock.elapsedTime;
    if (interaction.current) {
      const target = hovered && onClick ? 1.018 : 1;
      const next = THREE.MathUtils.damp(interaction.current.scale.x, target, 10, delta);
      interaction.current.scale.setScalar(next);
    }
    themed.uniforms.forEach((uniform) => {
      uniform.uTime.value = time;
    });
    themed.animations.forEach((animate) => animate(time));
  });

  useEffect(() => {
    return () => {
      const materials = new Set<THREE.Material>();
      themed.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        meshMaterials.forEach((material) => materials.add(material));
      });
      materials.forEach((material) => material.dispose());
    };
  }, [themed]);

  const topTier = slots.reduce((top, slot) => Math.max(top, rarityTier(rarityOf(slot))), 0);
  const topRarity = RARITIES[topTier];
  const active = node.isActive ?? true;
  const theme = levelTheme(level);
  const scale = (targetSize / themed.sourceWidth) * theme.scale;
  const moteCount = topTier >= 6 ? 70 : topTier >= 5 ? 45 : topTier >= 4 ? 24 : 0;

  return (
    <group
      ref={interaction}
      onPointerOver={onClick ? () => setHovered(true) : undefined}
      onPointerOut={onClick ? () => setHovered(false) : undefined}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick(node.id);
            }
          : undefined
      }
    >
      <group scale={scale}>
        <primitive object={themed.scene} />
      </group>
      {/* Flat 2D yellow highlight circle — the single ground ring under a rig.
          Sized to clear the wider mine platform so it reads around both types. */}
      <GroundGlow color="#ffc23d" radius={targetSize * 0.74} opacity={0.85} />
      <group scale={targetSize / 4.8}>
        <RarityAura components={node.components} isActive={active} />
      </group>
      {active && moteCount > 0 && (
        <Motes
          color={rimColor(topRarity)}
          count={moteCount}
          area={[1.3 * targetSize, 1.15 * targetSize, 1.3 * targetSize]}
          size={0.36 * targetSize}
          speed={0.28}
        />
      )}
      {active && topTier >= 2 && (
        <pointLight
          color={RARITY_COLOR[topRarity]}
          intensity={0.3 * rarityFx(topRarity).light}
          distance={1.6 * targetSize}
          decay={2}
          position={[0, 0.55 * targetSize, 0]}
        />
      )}
    </group>
  );
}

useGLTF.preload(RUNTIME_MODEL.oil, false, true);
useGLTF.preload(RUNTIME_MODEL.mine, false, true);
