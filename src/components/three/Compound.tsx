'use client';

// The compound world: sand terrain with a water quadrant (oil side), node
// placement, lighting presets, and environment.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Environment, useGLTF } from '@react-three/drei';
import { NodeRig, type RigNodeData } from './NodeRig';

export type LightingPreset = 'sunset' | 'dusk' | 'neutral' | 'night';

export const LIGHTING_PRESETS: Record<
  LightingPreset,
  { sun: [number, number, number]; sunColor: string; sunIntensity: number; ambient: number; sky: string; fog: string; envIntensity: number }
> = {
  sunset: { sun: [40, 22, -30], sunColor: '#ffb066', sunIntensity: 2, ambient: 0.45, sky: '#2b1a3a', fog: '#54303a', envIntensity: 0.7 },
  dusk: { sun: [30, 12, -40], sunColor: '#ff8a5c', sunIntensity: 1.4, ambient: 0.36, sky: '#1c1430', fog: '#3a2440', envIntensity: 0.5 },
  neutral: { sun: [35, 45, 20], sunColor: '#ffffff', sunIntensity: 2.2, ambient: 0.55, sky: '#20304a', fog: '#44546a', envIntensity: 1 },
  night: { sun: [-20, 18, -40], sunColor: '#7a9fff', sunIntensity: 0.6, ambient: 0.22, sky: '#070a18', fog: '#0c1226', envIntensity: 0.25 },
};

/** Oil rigs on the water (left/west), mines on the land (right/east). */
export function nodePosition(index: number, family: 'oil' | 'mine', seed: number): [number, number, number] {
  const col = family === 'oil' ? -1 : 1;
  const row = Math.floor(index / 2);
  const inner = index % 2;
  const x = col * ((family === 'oil' ? 13 : 9) + inner * 10);
  const z = -12 + row * 12 + ((seed % 7) - 3) * 0.3;
  return [x, 0, z];
}

/** Visual-only source models shown for any node family the wallet is missing. */
export const SHOWROOM_NODES: RigNodeData[] = [
  {
    id: 'showroom-oil',
    type: 'oil',
    level: 7,
    isActive: true,
    components: [
      { slot: 'derrick', rarity: 'legendary' },
      { slot: 'pump_jack', rarity: 'legendary' },
      { slot: 'pipeline', rarity: 'legendary' },
      { slot: 'flare_stack', rarity: 'legendary' },
    ],
  },
  {
    id: 'showroom-mine',
    type: 'mine',
    level: 7,
    isActive: true,
    components: [
      { slot: 'drill_bit', rarity: 'legendary' },
      { slot: 'ore_cart', rarity: 'legendary' },
      { slot: 'rail_track', rarity: 'legendary' },
      { slot: 'elevator', rarity: 'legendary' },
    ],
  },
];

/**
 * Water pools scattered across the map by seeded grid-jitter, rather than one
 * slab on the west edge. The terrain is divided into a coarse grid; each cell
 * gets one jittered pool (a few cells left dry for natural gaps), so water is
 * spread evenly-but-irregularly over the whole compound. Deterministic — the
 * seeded RNG makes the layout stable across renders instead of jumping around.
 */
const WATER_POOLS: Array<{ x: number; z: number; size: number; y: number; rot: number }> = (() => {
  let s = 0x9e3779b9 >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pools: Array<{ x: number; z: number; size: number; y: number; rot: number }> = [];
  const cols = 4;
  const rows = 3;
  const x0 = -46;
  const x1 = 40;
  const z0 = -44;
  const z1 = 26;
  const cw = (x1 - x0) / cols;
  const cd = (z1 - z0) / rows;
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (rnd() < 0.18) continue; // leave the odd cell dry for natural sand gaps
      const x = x0 + (c + 0.5) * cw + (rnd() - 0.5) * cw * 0.5;
      const z = z0 + (r + 0.5) * cd + (rnd() - 0.5) * cd * 0.5;
      const size = 13 + rnd() * 15;
      pools.push({ x, z, size, y: -0.33 + (rnd() - 0.5) * 0.03, rot: rnd() * Math.PI });
    }
  }
  return pools;
})();

/**
 * Stylised procedural water. All "texture" is generated in-shader — layered
 * value-noise ripples perturbing the normal, a drifting voronoi sparkle field,
 * a sun-glitter path and crest foam — so there are no texture assets and no
 * reflection render targets (mobile-safe). One shared material drives every
 * pool; the ripple/caustic fields are world-space, so adjacent pools stay
 * visually continuous.
 */
const WATER_VERT = `
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vWave;
void main(){
  vUv = uv;
  vec3 p = position;
  float broad = sin(p.x * 0.24 + uTime * 0.55) * 0.07 + cos(p.y * 0.19 + uTime * 0.42) * 0.06;
  float mid = sin(p.x * 0.11 - p.y * 0.23 + uTime * 0.31) * 0.045;
  float detail = sin((p.x + p.y) * 0.72 - uTime * 0.8) * 0.025;
  float w = broad + mid + detail;
  p.z += w;
  vWave = w;
  vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const WATER_FRAG = `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uGlint;
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vWave;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}
// Two scrolling octave pairs; the ripple "texture" of the surface.
float ripple(vec2 q){
  float h = 0.0;
  h += vnoise(q * 0.55 + vec2(uTime * 0.10,  uTime * 0.06)) * 0.55;
  h += vnoise(q * 1.35 - vec2(uTime * 0.14, -uTime * 0.05)) * 0.30;
  h += vnoise(q * 3.10 + vec2(-uTime * 0.22, uTime * 0.16)) * 0.15;
  return h;
}
// Animated cell field for the caustic-style shimmer web.
float cells(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float m = 1.5;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(hash(i + g), hash(i + g + 11.3));
    o = 0.5 + 0.42 * sin(uTime * 0.55 + 6.2831 * o);
    m = min(m, length(g + o - f));
  }
  return m;
}

void main(){
  vec3 dx = dFdx(vWorldPosition);
  vec3 dy = dFdy(vWorldPosition);
  vec3 facet = normalize(cross(dx, dy));
  if (!gl_FrontFacing) facet *= -1.0;

  // Perturb the facet normal with the procedural ripple heightfield so the
  // surface picks up fine detail the 80x80 grid cannot carry.
  vec2 q = vWorldPosition.xz;
  float e = 0.35;
  float hC = ripple(q);
  float hX = ripple(q + vec2(e, 0.0));
  float hZ = ripple(q + vec2(0.0, e));
  vec3 normal = normalize(facet + vec3(-(hX - hC), 0.0, -(hZ - hC)) * 2.8);

  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 sunDir = normalize(vec3(0.42, 0.78, -0.34));

  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.2);
  vec3 reflDir = reflect(-sunDir, normal);
  float specular = pow(max(dot(reflDir, viewDir), 0.0), 96.0);
  // Broad glitter path under the sun: same reflection, looser exponent,
  // broken up by the ripple field so it sparkles instead of smearing.
  float glitter = pow(max(dot(reflDir, viewDir), 0.0), 18.0) * (0.35 + 0.65 * hC);

  // Caustic web, faded with camera distance so the horizon stays calm.
  float dist = length(cameraPosition - vWorldPosition);
  float causticFade = 1.0 - smoothstep(26.0, 95.0, dist);
  float web = pow(clamp(cells(q * 0.6), 0.0, 1.0), 2.4) * causticFade;

  // Foam only on wave crests, broken by noise so it flecks rather than bands.
  float crest = smoothstep(0.07, 0.13, vWave) * smoothstep(0.42, 0.72, vnoise(q * 2.2 + uTime * 0.12));

  float depthMix = 0.18 + fresnel * 0.42 + (hC - 0.5) * 0.30;
  vec3 water = mix(uDeep, uShallow, clamp(depthMix, 0.0, 1.0));
  water += uShallow * web * 0.55;
  water += uGlint * glitter * 0.45;
  water += uGlint * specular * 0.60;
  water = mix(water, vec3(0.92, 0.95, 0.94), crest * 0.35);

  // Circular pool mask: fade the square plane into a soft round pool edge so
  // scattered pools read as water bodies, not tiles.
  float edge = length(vUv - 0.5) * 2.0;
  float mask = 1.0 - smoothstep(0.82, 0.99, edge);
  if (mask < 0.01) discard;
  gl_FragColor = vec4(water, 0.94 * mask);
}`;

function Water({ color = '#286b7f', glint = '#ffd194' }: { color?: string; glint?: string }) {
  // One shared material for every pool: the ripple/caustic fields are computed
  // in world space, so a single material keeps all pools looking like the same
  // body of water sampled at different spots, and animates them in one place.
  const material = useMemo(() => {
    const deep = new THREE.Color(color);
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: deep },
        uShallow: { value: deep.clone().lerp(new THREE.Color('#2f7891'), 0.48) },
        uGlint: { value: new THREE.Color(glint) },
      },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
    });
  }, [color, glint]);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <group>
      {WATER_POOLS.map((pool, i) => (
        <mesh
          key={i}
          position={[pool.x, pool.y, pool.z]}
          rotation={[-Math.PI / 2, 0, pool.rot]}
          material={material}
        >
          <planeGeometry args={[pool.size, pool.size, 40, 40]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One copy of the delivered square OSR_sand.glb terrain, uniformly enlarged
 * to cover the entire compound while preserving its exact 1:1 proportions.
 */
function Ground() {
  const sand = useGLTF('/models/runtime/OSR_sand.glb', false, true) as unknown as { scene: THREE.Group };
  const terrain = useMemo(() => {
    const s = sand.scene.clone(true);
    s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.receiveShadow = true;
        mesh.castShadow = false;
      }
    });
    return s;
  }, [sand.scene]);

  return (
    <primitive object={terrain} position={[-5, -0.55, 0]} scale={7} />
  );
}

export function Compound({
  nodes,
  preset,
  selectedNodeId,
  onSelect,
}: {
  nodes: RigNodeData[];
  preset: LightingPreset;
  selectedNodeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const p = LIGHTING_PRESETS[preset];
  const byFamily = useMemo(() => {
    const deployedOil = nodes.filter((n) => n.type === 'oil');
    const deployedMine = nodes.filter((n) => n.type !== 'oil');
    return {
      oil: deployedOil.length > 0 ? deployedOil : [SHOWROOM_NODES[0]],
      mine: deployedMine.length > 0 ? deployedMine : [SHOWROOM_NODES[1]],
    };
  }, [nodes]);

  return (
    <group>
      {preset === 'night' && <color attach="background" args={[p.sky]} />}
      <fog attach="fog" args={[p.fog, 70, 200]} />
      <hemisphereLight
        color={preset === 'night' ? '#273a66' : '#9cb8d2'}
        groundColor={preset === 'night' ? '#070912' : '#72513a'}
        intensity={p.ambient * 1.55}
      />
      <ambientLight intensity={p.ambient * 0.22} />
      <directionalLight
        position={p.sun}
        color={p.sunColor}
        intensity={p.sunIntensity}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-intensity={0.68}
        shadow-bias={-0.00012}
        shadow-normalBias={0.025}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={1}
        shadow-camera-far={120}
      />
      <directionalLight
        position={[-35, 20, 35]}
        color={preset === 'night' ? '#536fba' : '#93b9d6'}
        intensity={p.ambient * 1.6}
      />
      {/* Delivered HDRI (cape_hill_2k) lights the scene and, outside night
          mode, is the visible sky. */}
      <Environment
        files="/env/cape_hill_2k.hdr"
        environmentIntensity={p.envIntensity}
        background={preset !== 'night'}
        backgroundBlurriness={0.04}
        backgroundIntensity={preset === 'dusk' ? 0.35 : preset === 'sunset' ? 0.6 : 1}
      />

      <Ground />
      <Water
        color={preset === 'night' ? '#16334a' : '#286b7f'}
        glint={preset === 'night' ? '#9fc4e8' : '#ffd194'}
      />

      {byFamily.oil.map((n, i) => (
        <group key={n.id} position={nodePosition(i, 'oil', Number(n.id) || i)}>
          <NodeRig node={n} targetSize={9} onClick={n.id.startsWith('showroom-') ? undefined : onSelect} />
          {selectedNodeId === n.id && <SelectionRing />}
        </group>
      ))}
      {byFamily.mine.map((n, i) => (
        <group key={n.id} position={nodePosition(i, 'mine', Number(n.id) || i)}>
          <NodeRig node={n} targetSize={9} onClick={n.id.startsWith('showroom-') ? undefined : onSelect} />
          {selectedNodeId === n.id && <SelectionRing />}
        </group>
      ))}
    </group>
  );
}

function SelectionRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = clock.elapsedTime * 0.6;
      const s = 1 + 0.03 * Math.sin(clock.elapsedTime * 3);
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <mesh ref={ref} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[4.6, 4.9, 64]} />
      <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

useGLTF.preload('/models/runtime/OSR_sand.glb', false, true);
