'use client';

// The compound world: sand terrain with a water quadrant (oil side), node
// placement, lighting presets, and environment.

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Environment, Grid } from '@react-three/drei';
import { NodeRig, type RigNodeData } from './NodeRig';

export type LightingPreset = 'sunset' | 'dusk' | 'neutral' | 'night';

export const LIGHTING_PRESETS: Record<
  LightingPreset,
  { sun: [number, number, number]; sunColor: string; sunIntensity: number; ambient: number; sky: string; fog: string; envIntensity: number }
> = {
  sunset: { sun: [40, 22, -30], sunColor: '#ffb066', sunIntensity: 2.4, ambient: 0.35, sky: '#2b1a3a', fog: '#54303a', envIntensity: 0.7 },
  dusk: { sun: [30, 12, -40], sunColor: '#ff8a5c', sunIntensity: 1.6, ambient: 0.28, sky: '#1c1430', fog: '#3a2440', envIntensity: 0.5 },
  neutral: { sun: [35, 45, 20], sunColor: '#ffffff', sunIntensity: 2.6, ambient: 0.45, sky: '#20304a', fog: '#44546a', envIntensity: 1 },
  night: { sun: [-20, 18, -40], sunColor: '#7a9fff', sunIntensity: 0.7, ambient: 0.14, sky: '#070a18', fog: '#0c1226', envIntensity: 0.25 },
};

/** Oil rigs on the water (left/west), mines on the land (right/east). */
export function nodePosition(index: number, family: 'oil' | 'mine', seed: number): [number, number, number] {
  const col = family === 'oil' ? -1 : 1;
  const row = Math.floor(index / 2);
  const inner = index % 2;
  const x = col * ((family === 'oil' ? 17 : 10) + inner * 11);
  const z = -12 + row * 12 + ((seed % 7) - 3) * 0.3;
  return [x, 0, z];
}

function Water({ color = '#123a52' }: { color?: string }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.uniforms.uTime.value = clock.elapsedTime;
  });
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color(color) } }), [color]);
  return (
    <mesh position={[-33, -0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[46, 130, 48, 48]} />
      <shaderMaterial
        ref={mat}
        transparent
        uniforms={uniforms}
        vertexShader={`
uniform float uTime;
varying vec2 vUv;
varying float vWave;
void main(){
  vUv = uv;
  vec3 p = position;
  float w = sin(p.x * 0.35 + uTime * 0.8) * 0.08 + cos(p.y * 0.3 + uTime * 0.6) * 0.08;
  p.z += w;
  vWave = w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`}
        fragmentShader={`
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
varying float vWave;
void main(){
  float sparkle = smoothstep(0.13, 0.16, vWave) * 0.12;
  vec3 c = uColor + vec3(sparkle) + vec3(0.008, 0.02, 0.028) * sin(vUv.x * 40.0 + uTime);
  gl_FragColor = vec4(c, 0.92);
}`}
      />
    </mesh>
  );
}

function Shoreline() {
  return (
    <mesh position={[-11, -0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 130]} />
      <meshStandardMaterial color="#8a7355" roughness={1} metalness={0} transparent opacity={0.85} />
    </mesh>
  );
}

function Ground() {
  return (
    <>
      <mesh position={[24, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 130]} />
        <meshStandardMaterial color="#b88d5a" roughness={0.95} metalness={0.02} />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[160, 160]}
        cellSize={4}
        cellThickness={0.4}
        cellColor="#6b5a3e"
        sectionSize={16}
        sectionThickness={0.8}
        sectionColor="#7d6a48"
        fadeDistance={90}
        infiniteGrid={false}
      />
    </>
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
    const oil = nodes.filter((n) => n.type === 'oil');
    const mine = nodes.filter((n) => n.type !== 'oil');
    return { oil, mine };
  }, [nodes]);

  return (
    <group>
      <color attach="background" args={[p.sky]} />
      <fog attach="fog" args={[p.fog, 60, 160]} />
      <ambientLight intensity={p.ambient} />
      <directionalLight
        position={p.sun}
        color={p.sunColor}
        intensity={p.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <Environment files="/env/cape_hill_2k.hdr" environmentIntensity={p.envIntensity} />

      <Ground />
      <Shoreline />
      <Water color={preset === 'night' ? '#0a2033' : '#123a52'} />

      {byFamily.oil.map((n, i) => (
        <group key={n.id} position={nodePosition(i, 'oil', Number(n.id) || i)}>
          <NodeRig node={n} onClick={onSelect} />
          {selectedNodeId === n.id && <SelectionRing />}
        </group>
      ))}
      {byFamily.mine.map((n, i) => (
        <group key={n.id} position={nodePosition(i, 'mine', Number(n.id) || i)}>
          <NodeRig node={n} onClick={onSelect} />
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
