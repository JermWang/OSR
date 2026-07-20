'use client';

// Small live crate render, used wherever a crate needs a picture — inventory
// rows, marketplace listings, the mined-crate notice.
//
// Live geometry rather than a sprite so the crate carries its rarity colour and
// stays consistent with the opening cinematic. It is a handful of boxes, so the
// cost is far closer to an image than to loading a rig model.

import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import CrateModel from './CrateModel';
import type { Rarity } from '@/lib/rarity';

export default function CrateThumb({
  rarity = 'legendary',
  size = 44,
  animate = true,
  className = '',
}: {
  rarity?: Rarity;
  size?: number;
  animate?: boolean;
  className?: string;
}) {
  return (
    <div style={{ width: size, height: size }} className={`shrink-0 ${className}`} aria-hidden>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [3.4, 2.6, 3.8], fov: 34 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
        style={{ width: size, height: size }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 5]} intensity={2.2} />
        <directionalLight position={[-4, 2, -3]} intensity={0.7} />
        <CrateModel rarity={rarity} animate={animate} scale={0.62} />
      </Canvas>
    </div>
  );
}
