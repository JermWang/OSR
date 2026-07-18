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

function Water({ color = '#286b7f' }: { color?: string }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.uniforms.uTime.value = clock.elapsedTime;
  });
  const uniforms = useMemo(() => {
    const deep = new THREE.Color(color);
    return {
      uTime: { value: 0 },
      uDeep: { value: deep },
      uShallow: { value: deep.clone().lerp(new THREE.Color('#2f7891'), 0.48) },
    };
  }, [color]);
  return (
    <mesh position={[-33, -0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[46, 130, 80, 80]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorldPosition;
void main(){
  vUv = uv;
  vec3 p = position;
  float broad = sin(p.x * 0.24 + uTime * 0.55) * 0.07 + cos(p.y * 0.19 + uTime * 0.42) * 0.06;
  float detail = sin((p.x + p.y) * 0.72 - uTime * 0.8) * 0.025;
  float w = broad + detail;
  p.z += w;
  vWorldPosition = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`}
        fragmentShader={`
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorldPosition;
void main(){
  vec3 dx = dFdx(vWorldPosition);
  vec3 dy = dFdy(vWorldPosition);
  vec3 normal = normalize(cross(dx, dy));
  if (!gl_FrontFacing) normal *= -1.0;
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 sunDir = normalize(vec3(0.42, 0.78, -0.34));
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.2);
  float specular = pow(max(dot(reflect(-sunDir, normal), viewDir), 0.0), 96.0);
  float bands = 0.5 + 0.5 * sin(vUv.x * 58.0 + vUv.y * 37.0 + uTime * 0.45);
  vec3 water = mix(uDeep, uShallow, 0.16 + fresnel * 0.42 + bands * 0.025);
  water += vec3(1.0, 0.82, 0.58) * specular * 0.55;
  gl_FragColor = vec4(water, 0.96);
}`}
      />
    </mesh>
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
      <Water color={preset === 'night' ? '#16334a' : '#286b7f'} />

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
