'use client';

// The compound world: a drilling island — sea at the outskirts, oil slicks
// around the pads, node placement, lighting presets, and environment.

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

/** Oil rigs west, mines east — all on the island; the sea is scenery. */
export function nodePosition(index: number, family: 'oil' | 'mine', seed: number): [number, number, number] {
  const col = family === 'oil' ? -1 : 1;
  const row = Math.floor(index / 2);
  const inner = index % 2;
  const x = col * ((family === 'oil' ? 13 : 9) + inner * 10);
  const z = -12 + row * 12 + ((seed % 7) - 3) * 0.3;
  return [x, 0, z];
}

/**
 * Landing-page hero rigs ONLY. Never rendered inside the app: the in-game
 * compound shows exactly what the wallet owns, and nothing it does not.
 */
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
 * Oil slicks pooled around the drilling pads. Water no longer sits inside the
 * sand — the compound is an island (the sea is the horizon, drawn separately) —
 * so what collects around working rigs is what would actually collect there:
 * crude. Placement is deterministic, clustered a few units off each pad site
 * rather than gridded across the map, weighted toward the oil-rig side.
 */
const OIL_PUDDLES: Array<{ x: number; z: number; size: number; y: number }> = (() => {
  let s = 0x9e3779b9 >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Pad sites from nodePosition(): oil west at x=-13/-23, mines east at 9/19,
  // rows every 12 in z. Oil pads seep 2 slicks each, mine pads only 1 — crude
  // belongs to the drilling side.
  const oilPads: Array<[number, number]> = [[-13, -12], [-23, -12], [-13, 0], [-23, 0]];
  const minePads: Array<[number, number]> = [[9, -12], [19, 0]];
  const puddles: Array<{ x: number; z: number; size: number; y: number }> = [];
  const seep = (px: number, pz: number, count: number) => {
    for (let i = 0; i < count; i += 1) {
      const ang = rnd() * Math.PI * 2;
      const dist = 5.5 + rnd() * 3.5; // clear of the pad, close enough to read as its runoff
      puddles.push({
        x: px + Math.cos(ang) * dist,
        z: pz + Math.sin(ang) * dist,
        size: 4.5 + rnd() * 4,
        // Just above the flattened pad plane; puddles hug the pads, so the
        // surrounding dunes never rise through them.
        y: 0.015 + rnd() * 0.01,
      });
    }
  };
  oilPads.forEach(([x, z]) => seep(x, z, 2));
  minePads.forEach(([x, z]) => seep(x, z, 1));
  return puddles;
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

  // The sea exists only OUTSIDE the island. Rounded-rectangle SDF around the
  // playfield — negative inland (discarded), positive offshore — with a
  // noise-wobbled coastline and a surf band so sand meets foam, not a line.
  vec2 dRect = abs(q - vec2(-3.0, -8.0)) - vec2(38.0, 32.0);
  float sdf = length(max(dRect, 0.0)) + min(max(dRect.x, dRect.y), 0.0) - 14.0;
  sdf += (vnoise(q * 0.06) - 0.5) * 7.0;
  if (sdf < 0.0) discard;
  float shore = smoothstep(0.0, 5.0, sdf);
  float surf = (1.0 - smoothstep(0.4, 4.5, sdf))
             * smoothstep(0.35, 0.75, vnoise(q * 1.4 + uTime * 0.18));
  water = mix(water, vec3(0.93, 0.96, 0.95), surf * 0.55);
  gl_FragColor = vec4(water, 0.94 * max(shore, surf * 0.8));
}`;

/**
 * Crude, not water: a puddle has no swell, so there is no vertex displacement —
 * the surface is a glossy static film whose life comes from a slow-creeping
 * normal, a tight hot specular, and the thin-film petrol rainbow at glancing
 * angles. Blob outlines are wobbled by world-space noise so every puddle is
 * irregular while all of them share one material.
 */
const OIL_VERT = `
varying vec2 vUv;
varying vec3 vWorldPosition;
void main(){
  vUv = uv;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const OIL_FRAG = `
uniform float uTime;
uniform vec3 uSheen;
varying vec2 vUv;
varying vec3 vWorldPosition;

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
float film(vec2 q, float t){
  return vnoise(q * 1.1 + t * 0.016) * 0.6 + vnoise(q * 2.6 - t * 0.011) * 0.4;
}

void main(){
  vec2 q = vWorldPosition.xz;

  // Irregular blob mask: radial falloff warped by world-space noise, so each
  // puddle's outline differs without per-puddle uniforms.
  float edge = length(vUv - 0.5) * 2.0 + (vnoise(q * 0.55) - 0.5) * 0.5;
  float mask = 1.0 - smoothstep(0.68, 0.95, edge);
  if (mask < 0.01) discard;

  // Barely-moving surface — oil creeps, it does not lap. Time factors are an
  // order of magnitude below the sea's.
  float e = 0.3;
  float h  = film(q, uTime);
  float hX = film(q + vec2(e, 0.0), uTime);
  float hZ = film(q + vec2(0.0, e), uTime);
  vec3 normal = normalize(vec3(-(hX - h) * 1.2, 1.0, -(hZ - h) * 1.2));

  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 sunDir = normalize(vec3(0.42, 0.78, -0.34));
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.6);
  vec3 reflDir = reflect(-sunDir, normal);
  // Oil is far glossier than water — tight hot highlight.
  float specular = pow(max(dot(reflDir, viewDir), 0.0), 180.0);

  vec3 oil = mix(vec3(0.016, 0.012, 0.008), vec3(0.055, 0.038, 0.02), h * 0.6);
  // Thin-film interference: hue cycles with height and viewing angle — the
  // petrol-rainbow signature, kept subtle and mostly at glancing angles.
  vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (h * 1.6 + fresnel * 2.1) + vec3(0.0, 2.1, 4.2));
  oil += rainbow * uSheen * fresnel * 0.22;
  oil += vec3(1.0, 0.96, 0.88) * specular * 0.85;
  oil += vec3(0.35, 0.33, 0.30) * fresnel * 0.10; // sky sheen so the film reads wet

  // Darker rim where the crude has soaked into the sand.
  float rim = smoothstep(0.52, 0.9, edge);
  oil = mix(oil, vec3(0.03, 0.022, 0.014), rim * 0.35);

  gl_FragColor = vec4(oil, mask * 0.96);
}`;

/**
 * The sea, drawn as one large sheet whose fragment shader cuts out the island —
 * the compound reads as a drilling island with surf at its outskirts rather
 * than sand with lakes in it.
 */
function Sea({ color = '#286b7f', glint = '#ffd194' }: { color?: string; glint?: string }) {
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
    <mesh position={[-3, -0.42, -8]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[640, 640, 128, 128]} />
    </mesh>
  );
}

function OilSlicks() {
  // One shared static-film material (see OIL_FRAG): oil must not wave or glint
  // like the sea, so it deliberately does NOT reuse the water shader.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uSheen: { value: new THREE.Color('#6f5fd4') },
        },
        vertexShader: OIL_VERT,
        fragmentShader: OIL_FRAG,
      }),
    []
  );
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <group>
      {OIL_PUDDLES.map((puddle, i) => (
        <mesh
          key={i}
          position={[puddle.x, puddle.y, puddle.z]}
          rotation={[-Math.PI / 2, 0, i * 1.73]}
          scale={[1, 0.62 + (i % 3) * 0.1, 1]}
          material={material}
        >
          <planeGeometry args={[puddle.size, puddle.size]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Distant ranges across the water — the island's horizon. Grouped into massifs
 * of overlapping peaks (never a row of lone cones) and pushed far enough out
 * that the scene fog reduces them to layered silhouettes, which is what sells
 * the depth. [x, z, radius, height] per peak.
 */
const RANGES: ReadonlyArray<readonly (readonly [number, number, number, number])[]> = [
  // North massif — the big backdrop behind the compound.
  [[-46, -128, 34, 26], [-18, -138, 42, 32], [8, -126, 30, 22], [30, -140, 38, 27], [55, -128, 26, 18]],
  // East range, lower and farther between the peaks.
  [[118, -48, 30, 20], [132, -14, 38, 26], [122, 22, 26, 16]],
  // Western mesas — two flat-topped forms so the skyline is not all triangles.
  [[-122, -30, 26, 14], [-136, 8, 34, 18]],
] as const;

/** Soft sand dunes inside the coast, keeping the island edge from being flat. */
const DUNES = [
  [-38, -34, 9, 1.9], [-24, -40, 12, 2.4], [6, -40, 10, 2.0], [26, -36, 8, 1.6],
  [36, -18, 9, 1.8], [38, 8, 7, 1.4], [30, 24, 10, 2.0], [-40, 20, 8, 1.6],
  [-44, -6, 7, 1.3], [8, 27, 9, 1.6],
] as const;

const ROCK_SCATTER = [
  [-34, -24, 1.1], [-28, 15, 0.75], [-20, 21, 0.95], [-10, -25, 0.65], [-6, 15, 1.2],
  [4, -22, 0.82], [14, 19, 0.62], [24, -21, 1.1], [29, 8, 0.72], [36, -12, 0.9],
  [-41, 24, 1.3], [40, 18, 1.15], [-44, -14, 0.85], [18, 26, 0.7],
] as const;

/** Dry desert brush — squashed low-poly tufts, the only "vegetation" out here. */
const BRUSH_SCATTER = [
  [-31, -28, 0.55], [-16, 22, 0.4], [-42, 12, 0.6], [-8, -27, 0.45], [10, 24, 0.5],
  [27, -26, 0.42], [38, 2, 0.55], [33, 15, 0.38], [-45, -20, 0.5], [20, 22, 0.44],
] as const;

function Pipe({ position, length, axis = 'x' }: { position: [number, number, number]; length: number; axis?: 'x' | 'z' }) {
  return (
    <mesh position={position} rotation={axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.22, 0.22, length, 10]} />
      <meshStandardMaterial color="#44362b" metalness={0.8} roughness={0.34} />
    </mesh>
  );
}

function Tank({ position, radius, height }: { position: [number, number, number]; radius: number; height: number }) {
  return (
    <group position={position}>
      <mesh position={[0, height * 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 16]} />
        <meshStandardMaterial color="#393334" metalness={0.75} roughness={0.44} />
      </mesh>
      <mesh position={[0, height + 0.1, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.92, radius, 0.24, 16]} />
        <meshStandardMaterial color="#5b4735" metalness={0.7} roughness={0.34} />
      </mesh>
      <mesh position={[0, height * 0.7, 0]}>
        <torusGeometry args={[radius * 1.01, 0.07, 6, 16]} />
        <meshStandardMaterial color="#a56c2a" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * A pole line WITH its wires. Poles without wires read as fence posts; the sag
 * between crossarms is what makes a power line a power line. Wires are thin
 * quadratic-bezier tubes drooping between consecutive crossarm tips.
 */
function PoleLine({ x, zs }: { x: number; zs: readonly number[] }) {
  const wires = useMemo(() => {
    const geoms: THREE.TubeGeometry[] = [];
    for (let i = 0; i < zs.length - 1; i += 1) {
      for (const arm of [-0.85, 0.85]) {
        const a = new THREE.Vector3(x + arm, 4.62, zs[i]);
        const b = new THREE.Vector3(x + arm, 4.62, zs[i + 1]);
        const mid = a.clone().lerp(b, 0.5);
        mid.y -= 0.55; // catenary sag
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        geoms.push(new THREE.TubeGeometry(curve, 14, 0.022, 4, false));
      }
    }
    return geoms;
  }, [x, zs]);
  return (
    <group>
      {zs.map((z) => (
        <group key={z} position={[x, 0, z]}>
          <mesh position={[0, 2.6, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.16, 5.2, 8]} />
            <meshStandardMaterial color="#3b3129" roughness={0.9} />
          </mesh>
          {/* crossarm perpendicular to the run so the wires pass along it */}
          <mesh position={[0, 4.68, 0]} castShadow>
            <boxGeometry args={[2.0, 0.11, 0.11]} />
            <meshStandardMaterial color="#4a3b2c" roughness={0.8} />
          </mesh>
          {[-0.85, 0.85].map((ax) => (
            <mesh key={ax} position={[ax, 4.58, 0]}>
              <sphereGeometry args={[0.07, 6, 5]} />
              <meshStandardMaterial color="#b7c0c4" metalness={0.4} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
      {wires.map((geom, i) => (
        <mesh key={i} geometry={geom}>
          <meshStandardMaterial color="#1c1a18" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A dirt track with wheel ruts: a bed of disturbed sand plus two darker
 * parallel strips where tyres run. Ruts are what make it read as a road driven
 * on daily rather than a painted stripe.
 */
function DirtRoad({
  position,
  length,
  width = 3.4,
  axis = 'z',
}: {
  position: [number, number, number];
  length: number;
  width?: number;
  axis?: 'x' | 'z';
}) {
  const rot: [number, number, number] = axis === 'z' ? [-Math.PI / 2, 0, 0] : [-Math.PI / 2, 0, Math.PI / 2];
  const rutOffset = width * 0.22;
  return (
    <group position={position}>
      <mesh rotation={rot} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#6b5138" roughness={0.98} />
      </mesh>
      {[-rutOffset, rutOffset].map((o) => (
        <mesh
          key={o}
          position={axis === 'z' ? [o, 0.006, 0] : [0, 0.006, o]}
          rotation={rot}
        >
          <planeGeometry args={[0.5, length]} />
          <meshStandardMaterial color="#4e3a27" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Gathering pipeline: a long line on regular support saddles, with end risers. */
function PipeRun({ from, to, y = 0.9 }: { from: [number, number]; to: [number, number]; y?: number }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const supports = Math.max(2, Math.floor(length / 4));
  return (
    <group position={[mid[0], 0, mid[1]]} rotation={[0, -angle, 0]}>
      <mesh position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, length, 10]} />
        <meshStandardMaterial color="#4c3d2e" metalness={0.75} roughness={0.4} />
      </mesh>
      {Array.from({ length: supports }, (_, i) => {
        const t = supports === 1 ? 0 : i / (supports - 1);
        const sx = (t - 0.5) * (length - 1.2);
        return (
          <group key={i} position={[sx, 0, 0]}>
            <mesh position={[0, y * 0.5 - 0.05, 0]} castShadow>
              <boxGeometry args={[0.3, y - 0.1, 0.3]} />
              <meshStandardMaterial color="#3a322b" roughness={0.85} />
            </mesh>
            <mesh position={[0, y - 0.12, 0]}>
              <boxGeometry args={[0.44, 0.14, 0.5]} />
              <meshStandardMaterial color="#2c2622" metalness={0.6} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
      {/* end risers dropping into the ground at both ends */}
      {[-1, 1].map((end) => (
        <mesh key={end} position={[end * (length / 2 - 0.1), y * 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, y, 8]} />
          <meshStandardMaterial color="#4c3d2e" metalness={0.75} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function FlareStack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 3.4, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.42, 6.8, 10]} />
        <meshStandardMaterial color="#312c2c" metalness={0.82} roughness={0.34} />
      </mesh>
      <mesh position={[0, 6.9, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.28, 0.35, 10]} />
        <meshStandardMaterial color="#b66f27" metalness={0.6} roughness={0.28} />
      </mesh>
      <pointLight position={[0, 7.25, 0]} color="#ff9d42" intensity={1.5} distance={12} decay={2} />
      <mesh position={[0, 7.3, 0]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color="#ff9d42" emissive="#ff6500" emissiveIntensity={3.5} />
      </mesh>
    </group>
  );
}

function WorldSetDressing({ preset }: { preset: LightingPreset }) {
  const night = preset === 'night';
  // Farther massifs are lighter (atmospheric perspective); fog does the rest.
  const rangeNear = night ? '#101724' : preset === 'neutral' ? '#3e4a58' : '#402a2c';
  const rangeFar = night ? '#131c2c' : preset === 'neutral' ? '#4c5866' : '#4e3438';
  const duneColor = night ? '#241d15' : '#8a6a45';

  return (
    <group>
      {/* Horizon: massifs rising from the sea beyond the coast, never a row of
          lone cones. Each massif overlaps 2-5 peaks; the western pair are
          flat-topped mesas so the whole skyline is not triangles. */}
      {RANGES.map((massif, m) => (
        <group key={m} position={[0, -0.6, 0]}>
          {massif.map(([x, z, radius, height], i) => {
            const mesa = m === 2;
            return (
              <mesh key={i} position={[x, height * (mesa ? 0.5 : 0.42), z]} rotation={[0, i * 0.9 + m, 0]}>
                {mesa ? (
                  <cylinderGeometry args={[radius * 0.55, radius, height, 9]} />
                ) : (
                  <coneGeometry args={[radius, height, 8]} />
                )}
                <meshStandardMaterial color={m === 0 ? rangeNear : rangeFar} roughness={1} flatShading fog />
              </mesh>
            );
          })}
        </group>
      ))}

      {/* Island-edge dunes: smooth low mounds (deliberately NOT flat-shaded) so
          the ground swells before it meets the surf. */}
      {DUNES.map(([x, z, r, h], i) => (
        <mesh key={i} position={[x, -0.35, z]} scale={[1, h / r, 0.72]} rotation={[0, i * 1.3, 0]} receiveShadow>
          <sphereGeometry args={[r, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={duneColor} roughness={1} />
        </mesh>
      ))}

      {/* Haul road: north-south through the corridor between the oil and mine
          pad rows, with a spur west to the tank farm through the row gap. */}
      <DirtRoad position={[-2, 0.008, -6]} length={68} axis="z" />
      <DirtRoad position={[-20.5, 0.01, 6]} length={31} width={2.4} axis="x" />

      {/* Tank farm on a concrete pad inside a containment berm — where the
          gathering line ends up. */}
      <group position={[-38, 0, 6]}>
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <cylinderGeometry args={[7.6, 7.6, 0.12, 24]} />
          <meshStandardMaterial color="#55504a" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.22, 0]} scale={[1, 0.42, 1]}>
          <torusGeometry args={[7.9, 0.55, 8, 28]} />
          <meshStandardMaterial color="#6d5438" roughness={1} />
        </mesh>
        <Tank position={[-2.2, 0.12, -1.8]} radius={2.3} height={4.4} />
        <Tank position={[2.8, 0.12, 1.6]} radius={1.7} height={3.1} />
        <Tank position={[2.4, 0.12, -2.6]} radius={1.15} height={2.3} />
        <FlareStack position={[-4.6, 0.12, 3.4]} />
        {/* farm manifold linking the tanks */}
        <Pipe position={[0.4, 0.5, -0.4]} length={5.6} />
        <Pipe position={[2.6, 0.5, -0.6]} length={3.6} axis="z" />
      </group>

      {/* Gathering line from the western pad row into the farm. */}
      <PipeRun from={[-30, -6]} to={[-33.5, 4]} />

      {/* Power line following the haul road. */}
      <PoleLine x={1.4} zs={[-38, -26, -14, -2, 10, 22]} />

      {/* Mine-side laydown yard: crate stack + cable spools where the rail
          strip used to float. */}
      <group position={[27, 0, 2]}>
        {([[0, 0, 0.9], [1.7, 0.2, 0.7], [0.7, 0.9, 0.75]] as const).map(([x, z, s], i) => (
          <mesh key={i} position={[x, s * 0.5, z]} rotation={[0, i * 0.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[s * 1.5, s, s * 1.5]} />
            <meshStandardMaterial color={i === 1 ? '#4c3b28' : '#5d4a32'} roughness={0.9} />
          </mesh>
        ))}
        {([[-2.4, 1.4], [-2.1, -0.9]] as const).map(([x, z], i) => (
          <mesh key={i} position={[x, 0.55, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 0.5, 12]} />
            <meshStandardMaterial color="#6b4326" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Rocks: non-uniform scales and three tones so no two read identical,
          with pebbles at the base of the larger ones. */}
      {ROCK_SCATTER.map(([x, z, size], index) => (
        <group key={index} position={[x, 0, z]}>
          <mesh
            position={[0, size * 0.3, 0]}
            scale={[1, 0.62 + (index % 3) * 0.16, 0.82 + (index % 2) * 0.2]}
            rotation={[0.15 * index, index * 0.61, 0.08 * index]}
            castShadow
            receiveShadow
          >
            <dodecahedronGeometry args={[size, 0]} />
            <meshStandardMaterial
              color={index % 3 === 0 ? '#5a412e' : index % 3 === 1 ? '#4a3a2c' : '#3c302a'}
              roughness={0.96}
              flatShading
            />
          </mesh>
          {size > 0.9 && (
            <mesh position={[size * 0.9, 0.1, size * 0.4]} rotation={[0, index, 0]} receiveShadow>
              <dodecahedronGeometry args={[size * 0.28, 0]} />
              <meshStandardMaterial color="#4a3a2c" roughness={1} flatShading />
            </mesh>
          )}
        </group>
      ))}

      {/* Dry brush — sparse, squashed, olive-dead. The only vegetation. */}
      {BRUSH_SCATTER.map(([x, z, s], i) => (
        <mesh key={i} position={[x, s * 0.4, z]} scale={[1, 0.68, 1]} rotation={[0, i * 2.1, 0]} castShadow>
          <icosahedronGeometry args={[s, 0]} />
          <meshStandardMaterial color={i % 2 ? '#5d5433' : '#4f4a30'} roughness={1} flatShading />
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
      oil: deployedOil,
      mine: deployedMine,
    };
  }, [nodes]);

  return (
    <group>
      {preset === 'night' && <color attach="background" args={[p.sky]} />}
      <fog attach="fog" args={[p.fog, 70, 265]} />
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
      <WorldSetDressing preset={preset} />
      <Sea
        color={preset === 'night' ? '#16334a' : '#286b7f'}
        glint={preset === 'night' ? '#9fc4e8' : '#ffd194'}
      />
      <OilSlicks />

      {byFamily.oil.map((n, i) => (
        <group key={n.id} position={nodePosition(i, 'oil', Number(n.id) || i)}>
          <NodeRig node={n} targetSize={9} onClick={onSelect} />
          {selectedNodeId === n.id && <SelectionRing />}
        </group>
      ))}
      {byFamily.mine.map((n, i) => (
        <group key={n.id} position={nodePosition(i, 'mine', Number(n.id) || i)}>
          <NodeRig node={n} targetSize={9} onClick={onSelect} />
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
