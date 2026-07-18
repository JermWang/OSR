'use client';

// Crate-opening cinematic. Phase machine mirrors the original deployment
// (intro → rumble → peak → freeze → detonate → decel → reveal for legendary+;
// shorter track for low tiers), using the Blender-exported v2 crate for the
// rolled rarity. The v2 scene is rotated from Z-up into Three.js Y-up.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sparkles, useGLTF } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { cratePath, RARITIES, SLOT_LABELS, type Rarity } from '@/lib/rarity';
import { RARITY_COLOR, rarityTier } from './fx';
import { COMPONENT_RARITIES } from '@/lib/rarity';
import { RARITY_MULT } from '@/lib/economy';
import type { CrateResult } from '@/lib/api-client';

type Phase = 'intro' | 'rumble' | 'peak' | 'freeze' | 'detonate' | 'decel' | 'reveal';

const HIGH_TRACK: Array<[Phase, number]> = [
  ['intro', 450],
  ['rumble', 1200],
  ['peak', 400],
  ['freeze', 300],
  ['detonate', 400],
  ['decel', 2700],
  ['reveal', 2000],
];
const LOW_TRACK: Array<[Phase, number]> = [
  ['intro', 450],
  ['rumble', 900],
  ['detonate', 350],
  ['decel', 1400],
  ['reveal', 1500],
];

// Tiny WebAudio SFX so the cinematic has weight without shipping audio files.
function playTone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, sweepTo?: number) {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
    o.onended = () => ctx.close();
  } catch {
    /* audio optional */
  }
}

const LID_ROT: Record<string, [number, number, number]> = {
  lid_q1: [1.5, 0.4, -1.1],
  lid_q2: [1.5, -0.4, 1.1],
  lid_q3: [-1.5, 0.4, 1.1],
  lid_q4: [-1.5, -0.4, -1.1],
};

function CrateModel({ rarity, phase, phaseT }: { rarity: Rarity; phase: Phase; phaseT: number }) {
  const gltf = useGLTF(cratePath(rarity)) as unknown as { scene: THREE.Group };
  const color = RARITY_COLOR[rarity];
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.rotation.x = Math.PI / 2;
    return clone;
  }, [gltf.scene]);

  const parts = useMemo(() => {
    const lids: Array<{
      object: THREE.Object3D;
      home: THREE.Vector3;
      direction: THREE.Vector3;
      rotation: [number, number, number];
    }> = [];
    const seams: THREE.MeshStandardMaterial[] = [];
    const ownedMaterials = new Set<THREE.Material>();

    scene.traverse((object) => {
      if (/^lid_q[1-4]$/.test(object.name)) {
        const home = object.position.clone();
        // v2 is Z-up: X/Y point outward and -Z points upward after rotation.
        const direction = new THREE.Vector3(
          Math.sign(home.x || 0.5),
          Math.sign(home.y || 0.5),
          -0.9
        ).normalize();
        lids.push({
          object,
          home,
          direction,
          rotation: LID_ROT[object.name] ?? [1.5, 0.4, -1.1],
        });
      }

      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const materials = source.map((material) => {
        const cloned = (material as THREE.MeshStandardMaterial).clone();
        if (/^seam_|accent/i.test(`${object.name} ${cloned.name}`)) {
          cloned.color = new THREE.Color(color);
          cloned.emissive = new THREE.Color(color);
          cloned.toneMapped = false;
          seams.push(cloned);
        }
        ownedMaterials.add(cloned);
        return cloned;
      });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    return { lids, seams, ownedMaterials };
  }, [scene, color]);

  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    return () => parts.ownedMaterials.forEach((material) => material.dispose());
  }, [parts]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Seam glow ramp: 1.8 (intro) → 5 (rumble) → 6.5 (peak/freeze) → 12 (detonate+)
    const seamI =
      phase === 'intro' ? 1.8
      : phase === 'rumble' ? 1.8 + 3.2 * phaseT
      : phase === 'peak' || phase === 'freeze' ? 6.5
      : 12;
    const pulse = seamI * (0.9 + 0.1 * Math.sin(t * 14));
    parts.seams.forEach((material) => {
      material.emissiveIntensity = pulse;
    });

    // Shake during rumble/peak; explode on detonate; drift during decel/reveal.
    if (group.current) {
      if (phase === 'rumble' || phase === 'peak') {
        const amp = phase === 'peak' ? 0.05 : 0.02 + 0.02 * phaseT;
        group.current.position.set(amp * Math.sin(t * 61), amp * Math.sin(t * 53), amp * Math.sin(t * 47));
      } else {
        group.current.position.set(0, 0, 0);
      }
    }

    const explode =
      phase === 'detonate' ? easeOutCubic(phaseT)
      : phase === 'decel' || phase === 'reveal' ? 1 + 0.15 * phaseT
      : 0;
    parts.lids.forEach((lid) => {
      const d = explode * 1.4;
      lid.object.position.set(
        lid.home.x + lid.direction.x * d,
        lid.home.y + lid.direction.y * d,
        lid.home.z + lid.direction.z * d * 1.2
      );
      lid.object.rotation.set(
        lid.rotation[0] * explode,
        lid.rotation[1] * explode,
        lid.rotation[2] * explode
      );
    });
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}

function CinematicCamera({ phase, phaseT }: { phase: Phase; phaseT: number }) {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const cam = camera as THREE.PerspectiveCamera;
    // Dolly-zoom: fov 50 → 34 during rumble, back to 44 on reveal.
    let fov = 50;
    const pos = new THREE.Vector3(0, 2.4, 9.5);
    if (phase === 'rumble' || phase === 'peak' || phase === 'freeze') {
      const k = phase === 'rumble' ? phaseT : 1;
      fov = 50 - 16 * k;
      pos.lerp(new THREE.Vector3(0, 1.55, 5.1), k);
    } else if (phase === 'detonate') {
      fov = 34 + 4 * phaseT;
      pos.set(0, 1.55, 5.1);
      const s = 0.12 * (1 - phaseT);
      pos.x += s * Math.sin(clock.elapsedTime * 90);
      pos.y += s * Math.sin(clock.elapsedTime * 77);
    } else if (phase === 'decel' || phase === 'reveal') {
      fov = 34 + 10 * Math.min(1, phaseT * 1.5);
      pos.set(0, 1.8, 5.6 + phaseT);
    }
    cam.fov += (fov - cam.fov) * 0.15;
    cam.position.lerp(pos, 0.12);
    cam.lookAt(0, 0.8, 0);
    cam.updateProjectionMatrix();
  });
  return null;
}

const TICKER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine'] as const;

export default function CrateCinematic({
  result,
  onClose,
  onOpenAnother,
}: {
  result: CrateResult;
  onClose: () => void;
  onOpenAnother?: () => void;
}) {
  const rarity = (RARITIES.includes(result.rarity as Rarity) ? result.rarity : 'common') as Rarity;
  const tier = rarityTier(rarity);
  const track = tier >= 4 ? HIGH_TRACK : LOW_TRACK;

  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseT, setPhaseT] = useState(0);
  const [phase, dur] = track[Math.min(phaseIdx, track.length - 1)];
  const done = phaseIdx >= track.length - 1 && phaseT >= 1;

  useEffect(() => {
    let raf: number;
    const started = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - started) / dur);
      setPhaseT(t);
      if (t >= 1 && phaseIdx < track.length - 1) {
        setPhaseIdx((i) => i + 1);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phaseIdx, dur, track.length]);

  // SFX cues per phase entry.
  useEffect(() => {
    if (phase === 'intro') playTone(140, 0.4, 'sine', 0.05);
    if (phase === 'rumble') playTone(52, dur / 1000, 'sawtooth', 0.05, 110);
    if (phase === 'peak') playTone(220, 0.35, 'triangle', 0.07, 440);
    if (phase === 'detonate') {
      playTone(70, 0.5, 'square', 0.11, 36);
      playTone(880, 0.6, 'sine', 0.05, 1760);
    }
    if (phase === 'reveal') playTone(660, 0.8, 'sine', 0.05, 990);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Slot-machine rarity ticker during rumble.
  const tickerRarity =
    phase === 'intro' || phase === 'rumble'
      ? TICKER[Math.floor((phaseT * 14 + phaseIdx * 3) % TICKER.length)]
      : rarity;

  const color = RARITY_COLOR[rarity];
  const label = COMPONENT_RARITIES[rarity].label;
  const showCard = phase === 'reveal' || done;

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 2.4, 9.5], fov: 50 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={['#05060a']} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 8, 6]} intensity={1.6} color="#ffd9a0" />
        <pointLight position={[0, 2.5, 0]} color={color} intensity={phase === 'detonate' || showCard ? 14 : 3} distance={16} decay={2} />
        <Suspense fallback={null}>
          <CrateModel rarity={rarity} phase={phase} phaseT={phaseT} />
          {(phase === 'detonate' || phase === 'decel' || showCard) && (
            <Sparkles count={tier >= 4 ? 160 : 60} scale={[6, 4, 6]} size={3} speed={1.2} color={color} position={[0, 1.5, 0]} />
          )}
        </Suspense>
        <CinematicCamera phase={phase} phaseT={phaseT} />
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[8, 48]} />
          <meshStandardMaterial color="#0c0f16" roughness={0.9} />
        </mesh>
        <EffectComposer>
          <Bloom intensity={1.7} luminanceThreshold={0.9} mipmapBlur radius={0.9} />
          <ChromaticAberration offset={new THREE.Vector2(0.0018, 0.0018)} radialModulation={false} modulationOffset={0} />
          <Vignette offset={0.25} darkness={0.55} />
        </EffectComposer>
      </Canvas>

      {/* HUD overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-10 flex flex-col items-center gap-2">
        {result.pityTriggered && (
          <div className="rounded border border-amber-500 bg-ink-900/80 px-3 py-1 font-mono text-xs uppercase tracking-widest text-amber-400">
            {result.pityTriggered === 'divine'
              ? 'Divine Guaranteed'
              : result.pityTriggered === 'mythic'
                ? 'Mythic+ Guaranteed'
                : 'Legendary+ Guaranteed'}
          </div>
        )}
        {!showCard && (
          <div
            className="font-mono text-2xl font-bold uppercase tracking-[0.3em] transition-colors"
            style={{ color: RARITY_COLOR[tickerRarity as Rarity] }}
          >
            {COMPONENT_RARITIES[tickerRarity as Rarity].label}
          </div>
        )}
      </div>

      {showCard && (
        <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3">
          <div
            className="panel w-80 border-2 p-5 text-center"
            style={{ borderColor: color, boxShadow: `0 0 40px ${color}55` }}
          >
            <div className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color }}>
              {label}
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              {SLOT_LABELS[result.slot] ?? result.slot}
            </div>
            <div className="mt-1 text-sm text-steel-300">
              {RARITY_MULT[rarity].toLocaleString()}× multiplier
            </div>
            {result.isUpgrade && result.previousRarity && (
              <div className="mt-2 text-xs text-emerald-400">
                Upgrade vs current {COMPONENT_RARITIES[result.previousRarity as Rarity]?.label ?? result.previousRarity}
              </div>
            )}
            <div className="mt-2 text-xs text-steel-400">✓ Added to Inventory · equip from the Inventory page</div>
          </div>
          <div className="flex gap-3">
            {onOpenAnother && (
              <button className="btn-primary" onClick={onOpenAnother}>
                Open Another Crate
              </button>
            )}
            <button className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

RARITIES.forEach((rarity) => useGLTF.preload(cratePath(rarity)));
