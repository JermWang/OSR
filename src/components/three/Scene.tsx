'use client';

// Main 3D canvas: smooth rig-focused camera controls and crisp direct PBR
// rendering of the authored Blender compound.

import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, useProgress } from '@react-three/drei';
import { Compound, type LightingPreset, nodePosition } from './Compound';
import type { RigNodeData } from './NodeRig';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

/**
 * Landing framing.
 *
 * A perspective camera's FOV is vertical, so a portrait viewport keeps the
 * same height and squeezes the width. The wide desktop shot spans roughly 37
 * world units and comfortably holds both the oil rig (x -13) and the mining
 * shaft (x +9); at a 390px-wide viewport the same camera sees under 10 units
 * and frames the empty sand between them instead of either rig.
 *
 * Portrait therefore gets its own shot: pushed in on the oil rig with a wider
 * FOV, so the hero of the scene is actually on screen behind the copy.
 */
const LANDING_WIDE = {
  target: new THREE.Vector3(-2, 2.6, -11),
  position: new THREE.Vector3(1, 9.5, 15),
  fov: 42,
};
const LANDING_NARROW = {
  target: new THREE.Vector3(-13, 3, -12),
  position: new THREE.Vector3(-7, 9.5, 9),
  fov: 55,
};
/**
 * Aspect below which the wide shot stops holding both rigs.
 *
 * The wide camera sits ~27 units from its target at a 42 degree vertical FOV,
 * so its visible half-width is about 10.3 * aspect. The rigs sit 11 units
 * either side of that target and need roughly 14 units of half-width to clear
 * their own footprints, which only happens above ~1.35. Tablets in portrait
 * (0.75) and even 1024x768 (1.33) fall short, so they get the single-rig shot
 * rather than a framing of the sand between them.
 */
const NARROW_ASPECT = 1.35;

function CameraRig({ focus, landing = false }: { focus: [number, number, number] | null; landing?: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const narrow = landing && size.width / size.height < NARROW_ASPECT;
  const shot = narrow ? LANDING_NARROW : LANDING_WIDE;
  const desiredTarget = useRef(new THREE.Vector3(-2, landing ? 2.6 : 2, landing ? -11 : -6));
  const desiredPosition = useRef(new THREE.Vector3(landing ? 1 : 1, landing ? 9.5 : 22, landing ? 15 : 36));
  const transitioning = useRef(false);

  // Widen the lens on narrow viewports so the rig can be framed from closer in
  // without its platform spilling out of the sides.
  useEffect(() => {
    if (!landing) return;
    const perspective = camera as THREE.PerspectiveCamera;
    if (perspective.fov === shot.fov) return;
    perspective.fov = shot.fov;
    perspective.updateProjectionMatrix();
  }, [camera, landing, shot.fov]);

  useEffect(() => {
    if (focus) {
      desiredTarget.current.set(focus[0], 3.2, focus[2]);
      desiredPosition.current.set(focus[0] + 12, 10, focus[2] + 14);
    } else if (landing) {
      desiredTarget.current.copy(shot.target);
      desiredPosition.current.copy(shot.position);
    } else {
      desiredTarget.current.set(-2, 2, -6);
      desiredPosition.current.set(1, 22, 36);
    }
    transitioning.current = true;
  }, [focus, landing, shot]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c || !transitioning.current) return;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredPosition.current.x, 7, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredPosition.current.y, 7, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredPosition.current.z, 7, delta);
    c.target.x = THREE.MathUtils.damp(c.target.x, desiredTarget.current.x, 9, delta);
    c.target.y = THREE.MathUtils.damp(c.target.y, desiredTarget.current.y, 9, delta);
    c.target.z = THREE.MathUtils.damp(c.target.z, desiredTarget.current.z, 9, delta);
    c.update();
    if (
      camera.position.distanceTo(desiredPosition.current) < 0.04 &&
      c.target.distanceTo(desiredTarget.current) < 0.03
    ) {
      transitioning.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={7}
      maxDistance={80}
      minPolarAngle={0.15 * Math.PI}
      maxPolarAngle={0.47 * Math.PI}
      enableDamping
      dampingFactor={0.06}
    />
  );
}

function LoadingCompound() {
  const { progress } = useProgress();
  const percentage = Math.max(4, Math.round(progress));
  return (
    <Html center>
      <div
        style={{
          width: 230,
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: 10,
          background: 'rgba(12, 14, 18, 0.92)',
          padding: '14px 16px',
          boxShadow: '0 18px 50px rgba(0, 0, 0, 0.45)',
          color: '#f59e0b',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: '0.18em' }}>PREPARING COMPOUND</div>
        <div style={{ marginTop: 10, height: 3, overflow: 'hidden', borderRadius: 3, background: '#27272a' }}>
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              borderRadius: 3,
              background: 'linear-gradient(90deg, #b45309, #f59e0b, #fde68a)',
              transition: 'width 180ms ease-out',
            }}
          />
        </div>
        <div style={{ marginTop: 7, textAlign: 'right', color: '#a1a1aa', fontSize: 10 }}>{percentage}%</div>
      </div>
    </Html>
  );
}

export default function Scene({
  nodes,
  preset,
  selectedNodeId,
  onSelect,
  focusNodeId,
  variant = 'default',
}: {
  nodes: RigNodeData[];
  preset: LightingPreset;
  selectedNodeId?: string | null;
  onSelect?: (id: string) => void;
  focusNodeId?: string | null;
  variant?: 'default' | 'landing';
}) {
  const landing = variant === 'landing';
  const focus = (() => {
    const requestedId = focusNodeId === undefined ? selectedNodeId : focusNodeId;
    if (!requestedId) return null;
    const oil = nodes.filter((n) => n.type === 'oil');
    const mine = nodes.filter((n) => n.type !== 'oil');
    const oi = oil.findIndex((n) => n.id === requestedId);
    if (oi >= 0) return nodePosition(oi, 'oil', Number(requestedId) || oi);
    const mi = mine.findIndex((n) => n.id === requestedId);
    if (mi >= 0) return nodePosition(mi, 'mine', Number(requestedId) || mi);
    return null;
  })();

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ position: landing ? [1, 9.5, 15] : [1, 22, 36], fov: landing ? 42 : 44, near: 0.1, far: 260 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: landing ? 1.28 : 1.08,
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      onPointerMissed={() => onSelect?.('')}
    >
      <Suspense fallback={<LoadingCompound />}>
        <Compound nodes={nodes} preset={preset} selectedNodeId={selectedNodeId} onSelect={onSelect} />
        <CameraRig focus={focus} landing={landing} />
      </Suspense>
    </Canvas>
  );
}
