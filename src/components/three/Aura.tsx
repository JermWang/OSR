'use client';

// Aura particle/ring stack — ground glow, light beams, motes, and the tiered
// RarityAura composition (rings → orbits → runes → halo → divine beam).

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import { RARITY_ORDER, RARITY_COLOR, rarityTier } from './fx';
import type { Rarity } from '@/lib/rarity';

/**
 * Flat 2D highlight circle under each rig — a game-style selection/range ring.
 * A single bold ring on the ground with a faint interior wash (to read as a
 * "radius"), a thin outer ring, and slowly rotating dash segments for a digital
 * feel. No torus, no 3D geometry: it is a flat decal that always faces up.
 */
export function GroundGlow({ color, radius, opacity = 0.85 }: { color: string; radius: number; opacity?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.uniforms.uTime.value = clock.elapsedTime;
  });
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: { value: 0 } }),
    [color, opacity]
  );
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * 2.0;
  float d = length(p);
  if (d > 1.0) discard;
  float aa = fwidth(d) * 1.5;

  // Faint interior wash so the circle reads as a covered radius.
  float fill = (1.0 - smoothstep(0.86 - aa, 0.86, d)) * 0.09;
  // The bold main highlight ring.
  float ring = smoothstep(0.030 + aa, 0.030, abs(d - 0.86));
  // Thin outer perimeter ring.
  float outer = smoothstep(0.012 + aa, 0.012, abs(d - 0.965)) * 0.55;
  // Rotating dash segments sitting on the main ring — the "digital" read.
  float ang = atan(p.y, p.x) + uTime * 0.5;
  float dash = step(0.5, fract(ang / 6.28318 * 40.0));
  float dashes = smoothstep(0.055 + aa, 0.055, abs(d - 0.86)) * dash * 0.5;

  float glow = fill + ring + outer + dashes;
  float pulse = 0.9 + 0.1 * sin(uTime * 1.6);
  gl_FragColor = vec4(uColor, clamp(glow * pulse * uOpacity, 0.0, 0.9));
}`}
      />
    </mesh>
  );
}

export function LightBeam({ color, height, radius, opacity = 0.16 }: { color: string; height: number; radius?: number; opacity?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const R = radius ?? 0.07 * height;
  useFrame(({ clock }) => {
    if (mat.current) mat.current.uniforms.uTime.value = clock.elapsedTime;
  });
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: { value: 0 } }),
    [color, opacity]
  );
  return (
    <mesh position={[0, height / 2, 0]} renderOrder={6}>
      <cylinderGeometry args={[0.25 * R, R, height, 28, 1, true]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
void main(){
  float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float vertical = 1.0 - vUv.y * 0.9;
  float shimmer = 0.9 + 0.1 * sin(vUv.y * 6.0 - uTime * 1.6);
  float a = pow(radial, 2.4) * vertical * shimmer * uOpacity;
  gl_FragColor = vec4(uColor, a);
}`}
      />
    </mesh>
  );
}

export function Motes({ color, count, area, size = 4, speed = 0.3 }: { color: string; count: number; area: [number, number, number]; size?: number; speed?: number }) {
  if (count <= 0) return null;
  return (
    <Sparkles
      count={count}
      scale={area}
      position={[0, area[1] / 2, 0]}
      size={size}
      speed={speed}
      color={color}
      opacity={0.8}
    />
  );
}

function HaloCylinder({ radius, height, color, intensity }: { radius: number; height: number; color: string; intensity: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current)
      mat.current.uniforms.uIntensity.value = intensity * (0.82 + 0.18 * Math.sin(0.8 * clock.elapsedTime * Math.PI));
  });
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity } }),
    [color, intensity]
  );
  return (
    <mesh position={[0, 0.5 + height / 2, 0]} renderOrder={5}>
      <cylinderGeometry args={[radius, 0.7 * radius, height, 32, 1, true]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv;
void main(){
  float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float vertical = 1.0 - vUv.y * 0.85;
  float alpha = pow(radial, 2.0) * vertical * 0.20;
  gl_FragColor = vec4(uColor * min(uIntensity, 2.5), alpha);
}`}
      />
    </mesh>
  );
}

function DivineBeam({ color }: { color: string }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.uniforms.uTime.value = clock.elapsedTime;
  });
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } }), [color]);
  return (
    <mesh position={[0, 4.5, 0]} renderOrder={7}>
      <cylinderGeometry args={[0.15, 0.35, 8, 20, 1, true]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
void main(){
  float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float vertical = 1.0 - vUv.y * 0.9;
  float shimmer = 0.88 + 0.12 * sin(vUv.y * 8.0 - uTime * 2.0);
  float alpha = pow(radial, 2.5) * vertical * shimmer * 0.30;
  gl_FragColor = vec4(uColor * 1.6, alpha);
}`}
      />
    </mesh>
  );
}

export function RarityAura({
  components,
  tierOverride,
  isActive = true,
  lowPerf = false,
}: {
  components: Array<{ rarity: string }>;
  tierOverride?: number;
  isActive?: boolean;
  lowPerf?: boolean;
}) {
  const tier = tierOverride ?? components.reduce((m, c) => Math.max(m, rarityTier(c.rarity)), 0);
  if (tier <= 0) return null;
  const rarity = RARITY_ORDER[tier] as Rarity;
  const color = RARITY_COLOR[rarity];
  const d = lowPerf ? Math.floor((10 + 10 * tier) / 2) : 10 + 12 * tier;

  // No ground rings here — the flat highlight circle (GroundGlow) is the only
  // ring under a rig now. RarityAura contributes rarity flair *above* the rig
  // (drifting sparkles, and a light column / beam at the top tiers) so higher
  // rarities still feel special without stacking 3D rings on the base.
  return (
    <group>
      {tier >= 3 && isActive && (
        <Sparkles count={Math.floor(0.4 * d)} scale={[4, 1.5, 4]} size={1.3} speed={0.3} position={[0, 0.7, 0]} color={color} opacity={0.18} />
      )}
      {tier >= 4 && isActive && !lowPerf && (
        <Sparkles count={Math.floor(0.6 * d)} scale={[2.2, 4, 2.2]} size={1} speed={0.6} position={[0, 2, 0]} color={color} opacity={0.16} />
      )}
      {tier === 5 && <HaloCylinder radius={1.2} height={3.2} color={color} intensity={2.2} />}
      {tier >= 6 && <DivineBeam color={color} />}
    </group>
  );
}
