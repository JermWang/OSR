'use client';

// Aura particle/ring stack — ground glow, light beams, motes, and the tiered
// RarityAura composition (rings → orbits → runes → halo → divine beam).

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sparkles, Float } from '@react-three/drei';
import { RARITY_ORDER, RARITY_COLOR, rarityTier } from './fx';
import type { Rarity } from '@/lib/rarity';

export function GroundGlow({ color, radius, opacity = 0.22 }: { color: string; radius: number; opacity?: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.uniforms.uOpacity.value = opacity * (0.85 + 0.15 * Math.sin(clock.elapsedTime));
  });
  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } }),
    [color, opacity]
  );
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`}
        fragmentShader={`uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
void main(){ float d=distance(vUv,vec2(0.5)); float a=smoothstep(0.5,0.0,d)*uOpacity; gl_FragColor=vec4(uColor,a); }`}
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

function OrbitRing({ radius, tube, y, speed, color, intensity, active }: { radius: number; tube: number; y: number; speed: number; color: string; intensity: number; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current && active) group.current.rotation.y += dt * speed;
  });
  return (
    <group ref={group} position={[0, y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, tube, 8, 64]} />
        <meshStandardMaterial
          emissive={color}
          emissiveIntensity={intensity}
          color="#000000"
          metalness={0.1}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function makeRuneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 2048, 256);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyphs = ['◆', '◇', '▲', '△', '○', '◎', '★', '☆', '✦', '✧', '⧫', '✶', 'Ω', '∞', 'Ψ', 'Δ'];
  glyphs.forEach((g, i) => ctx.fillText(g, (i + 0.5) * (2048 / glyphs.length), 128));
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 4;
  for (const dy of [-90, 90]) {
    ctx.beginPath();
    ctx.moveTo(0, 128 + dy);
    ctx.lineTo(2048, 128 + dy);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 32; i++) {
    const x = (i + 0.5) * (2048 / 32);
    ctx.beginPath();
    ctx.moveTo(x, 128 - 60);
    ctx.lineTo(x, 128 + 60);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

function RuneRing({ radius, y, color, intensity, active }: { radius: number; y: number; color: string; intensity: number; active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const tex = useMemo(makeRuneTexture, []);
  const hdrColor = useMemo(
    () => new THREE.Color(color).multiplyScalar(Math.max(1, 2.2 * intensity)),
    [color, intensity]
  );
  useFrame((_, dt) => {
    if (group.current && active) group.current.rotation.y += dt * 0.08;
  });
  const flat: [number, number, number] = [-Math.PI / 2, 0, 0];
  return (
    <group ref={group} position={[0, y, 0]}>
      <mesh rotation={flat} renderOrder={2}>
        <ringGeometry args={[radius - 0.35, radius, 64]} />
        <meshBasicMaterial map={tex} color={hdrColor} transparent opacity={0.5} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={flat} renderOrder={2}>
        <ringGeometry args={[radius - 0.02, radius, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={flat} renderOrder={2}>
        <ringGeometry args={[radius - 0.38, radius - 0.35, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
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

  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <ringGeometry args={[1.6, 2.2, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {tier >= 2 && <OrbitRing radius={2} tube={0.04} y={0.1} speed={isActive ? 0.25 : 0} color={color} intensity={1.6} active={isActive} />}
      {tier >= 3 && (
        <>
          <OrbitRing radius={2.35} tube={0.035} y={0.15} speed={isActive ? -0.18 : 0} color={color} intensity={1.8} active={isActive} />
          {isActive && <Sparkles count={Math.floor(0.4 * d)} scale={[4, 1.5, 4]} size={1.3} speed={0.3} position={[0, 0.7, 0]} color={color} opacity={0.18} />}
        </>
      )}
      {tier >= 4 && (
        <>
          <RuneRing radius={1.95} y={0.025} color={color} intensity={1.8} active={isActive} />
          {isActive && !lowPerf && <Sparkles count={Math.floor(0.6 * d)} scale={[2.2, 4, 2.2]} size={1} speed={0.6} position={[0, 2, 0]} color={color} opacity={0.16} />}
        </>
      )}
      {tier === 5 && (
        <>
          <HaloCylinder radius={1.2} height={3.2} color={color} intensity={2.2} />
          <mesh position={[0, 1.8, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={6}>
            <torusGeometry args={[1.85, 0.035, 8, 64]} />
            <meshStandardMaterial emissive={color} emissiveIntensity={2.2} color="#000000" metalness={0} roughness={0.2} toneMapped={false} />
          </mesh>
        </>
      )}
      {tier >= 6 && (
        <>
          <DivineBeam color={color} />
          <group position={[0, 3, 0]}>
            <Float speed={0.6} floatIntensity={0.3} rotationIntensity={0.2}>
              <mesh rotation={[Math.PI / 2 + 0.25, 0, 0]}>
                <torusGeometry args={[1.1, 0.03, 10, 64]} />
                <meshStandardMaterial emissive={color} emissiveIntensity={2.4} color="#000000" metalness={0} roughness={0.2} toneMapped={false} />
              </mesh>
            </Float>
            <Float speed={0.5} floatIntensity={0.3} rotationIntensity={0.25}>
              <mesh position={[0, 0.6, 0]} rotation={[Math.PI / 2 - 0.18, 0, 0.12]}>
                <torusGeometry args={[0.75, 0.025, 10, 48]} />
                <meshStandardMaterial emissive={color} emissiveIntensity={2.6} color="#000000" metalness={0} roughness={0.2} toneMapped={false} />
              </mesh>
            </Float>
          </group>
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
            <ringGeometry args={[2.45, 2.55, 64]} />
            <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  );
}
