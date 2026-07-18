'use client';

// Main 3D canvas: camera, controls, postprocessing (threshold bloom feeds the
// toneMapped:false HDR emissives — the "selective bloom" trick from the
// original), and the compound world.

import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing';
import { Compound, type LightingPreset, nodePosition } from './Compound';
import type { RigNodeData } from './NodeRig';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

function CameraRig({ focus }: { focus: [number, number, number] | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 2, 0));

  useEffect(() => {
    if (focus) {
      target.current.set(focus[0], 3, focus[2]);
      const dir = new THREE.Vector3(focus[0] + 12, 10, focus[2] + 14);
      camera.position.lerp(dir, 0.9);
    }
  }, [focus, camera]);

  useEffect(() => {
    const c = controls.current;
    if (c) {
      const t = target.current;
      const tick = () => c.target.lerp(t, 0.08);
      c.addEventListener('change', tick);
      return () => c.removeEventListener('change', tick);
    }
  }, []);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={8}
      maxDistance={70}
      minPolarAngle={0.15 * Math.PI}
      maxPolarAngle={0.47 * Math.PI}
      target={focus ? new THREE.Vector3(focus[0], 3, focus[2]) : new THREE.Vector3(0, 1, -6)}
    />
  );
}

export default function Scene({
  nodes,
  preset,
  selectedNodeId,
  onSelect,
  maxLevel,
}: {
  nodes: RigNodeData[];
  preset: LightingPreset;
  selectedNodeId?: string | null;
  onSelect?: (id: string) => void;
  maxLevel?: number;
}) {
  const focus = (() => {
    if (!selectedNodeId) return null;
    const oil = nodes.filter((n) => n.type === 'oil');
    const mine = nodes.filter((n) => n.type !== 'oil');
    const oi = oil.findIndex((n) => n.id === selectedNodeId);
    if (oi >= 0) return nodePosition(oi, 'oil', Number(selectedNodeId) || oi);
    const mi = mine.findIndex((n) => n.id === selectedNodeId);
    if (mi >= 0) return nodePosition(mi, 'mine', Number(selectedNodeId) || mi);
    return null;
  })();

  // Bloom intensity scales with compound level, like the original.
  const bloomIntensity = 1.4 + Math.min(10, maxLevel ?? 1) * 0.06;

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [4, 20, 28], fov: 46 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => onSelect?.('')}
    >
      <Suspense
        fallback={
          <Html center>
            <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.2em' }}>
              LOADING COMPOUND…
            </div>
          </Html>
        }
      >
        <Compound nodes={nodes} preset={preset} selectedNodeId={selectedNodeId} onSelect={onSelect} />
        <CameraRig focus={focus} />
        <EffectComposer>
          <Bloom intensity={bloomIntensity} luminanceThreshold={0.9} mipmapBlur radius={0.9} />
          <ChromaticAberration offset={new THREE.Vector2(0.0018, 0.0018)} radialModulation={false} modulationOffset={0} />
          <Vignette offset={0.25} darkness={0.55} />
          <Noise opacity={0.06} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
