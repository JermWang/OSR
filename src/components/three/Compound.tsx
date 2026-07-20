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

const MOUNTAIN_RIDGE = [
  [-52, -76, 18, 20], [-37, -78, 11, 15], [-21, -77, 16, 19], [-4, -79, 12, 16],
  [16, -77, 19, 23], [39, -78, 13, 18], [57, -76, 21, 24],
] as const;

const ROCK_SCATTER = [
  [-34, -24, 1.1], [-28, 13, 0.75], [-20, 18, 0.95], [-10, -25, 0.65], [-4, 13, 1.2],
  [4, -20, 0.82], [12, 15, 0.62], [24, -21, 1.1], [29, 6, 0.72], [36, -12, 0.9],
  [-39, 22, 1.3], [40, 18, 1.15],
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

function UtilityPole({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.6, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 5.2, 8]} />
        <meshStandardMaterial color="#352d28" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 4.75, 0]} castShadow>
        <boxGeometry args={[2.1, 0.12, 0.12]} />
        <meshStandardMaterial color="#4a3b2c" metalness={0.65} roughness={0.4} />
      </mesh>
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 4.68, 0]}>
          <sphereGeometry args={[0.11, 8, 6]} />
          <meshStandardMaterial color="#c49a62" roughness={0.35} />
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
  const mountainColor = preset === 'night' ? '#111827' : preset === 'neutral' ? '#45505e' : '#3a2524';
  const roadColor = preset === 'night' ? '#171518' : '#4b382b';

  return (
    <group>
      <group position={[0, -0.3, 0]}>
        {MOUNTAIN_RIDGE.map(([x, z, radius, height], index) => (
          <mesh key={index} position={[x, height * 0.32, z]} rotation={[0, index * 0.37, 0]} receiveShadow>
            <coneGeometry args={[radius, height, 6]} />
            <meshStandardMaterial color={mountainColor} roughness={0.98} flatShading />
          </mesh>
        ))}
      </group>

      <mesh position={[-4, 0.004, 4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[88, 3.3]} />
        <meshStandardMaterial color={roadColor} roughness={0.95} />
      </mesh>
      <mesh position={[-31, 0.006, -4]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
        <planeGeometry args={[31, 2.6]} />
        <meshStandardMaterial color={roadColor} roughness={0.95} />
      </mesh>

      <group position={[-33, 0, 11]}>
        <Tank position={[0, 0, 0]} radius={2.3} height={4.4} />
        <Tank position={[-5.3, 0, 1.1]} radius={1.7} height={3.1} />
        <FlareStack position={[5.4, 0, -1.8]} />
      </group>
      <Pipe position={[-27.5, 1.05, 9.2]} length={12} />
      <Pipe position={[-21.5, 1.05, 2.6]} length={13.2} axis="z" />
      <Pipe position={[-18.1, 1.05, -4]} length={6.6} />
      {[-30, -21, -12, -3, 6, 15, 24].map((x) => <UtilityPole key={x} position={[x, 0, 17]} />)}

      <group position={[19, 0.03, 7]}>
        <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[17, 2.1]} />
          <meshStandardMaterial color="#2b2525" metalness={0.5} roughness={0.62} />
        </mesh>
        {[-0.45, 0.45].map((z) => (
          <mesh key={z} position={[0, 0.13, z]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[17, 0.09, 0.09]} />
            <meshStandardMaterial color="#16191b" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
        {[-7, -4, -1, 2, 5, 8].map((x) => (
          <mesh key={x} position={[x, 0.16, 0]}>
            <boxGeometry args={[0.12, 0.09, 1.7]} />
            <meshStandardMaterial color="#5d4530" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {ROCK_SCATTER.map(([x, z, size], index) => (
        <mesh key={index} position={[x, size * 0.32, z]} rotation={[0.15 * index, index * 0.61, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[size, 0]} />
          <meshStandardMaterial color={index % 2 ? '#5a412e' : '#3c302a'} roughness={0.96} flatShading />
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
      <WorldSetDressing preset={preset} />
      <Sea
        color={preset === 'night' ? '#16334a' : '#286b7f'}
        glint={preset === 'night' ? '#9fc4e8' : '#ffd194'}
      />
      <OilSlicks />

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
