'use client';

// Resilient HDRI environment.
//
// The environment map is a multi-megabyte file. On a slow connection — or in dev, where
// a recompile aborts the in-flight request — the fetch fails, and an
// unhandled loader error inside a Canvas takes the WHOLE 3D scene down with a
// runtime error. That is an acceptable outcome for a decorative sky and an
// unacceptable one for the game underneath it.
//
// So the environment is loaded behind an error boundary and a Suspense
// fallback. If it never arrives, the scene keeps its lights (hemisphere,
// ambient and two directionals are all set up independently) and falls back to
// a flat sky colour. The player gets a slightly flatter-looking compound
// instead of a blank error page.

import { Component, Suspense, type ReactNode } from 'react';
import { Environment } from '@react-three/drei';

interface Props {
  files: string;
  environmentIntensity: number;
  background: boolean;
  backgroundBlurriness?: number;
  backgroundIntensity?: number;
  /** Drawn instead of the HDRI backdrop when loading fails. */
  fallbackSky: string;
}

class EnvironmentBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Logged, not swallowed silently: a persistently failing environment map is
    // worth knowing about even though the scene recovers from it.
    console.warn('[scene] environment map failed to load; falling back to flat sky', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function SafeEnvironment({
  files,
  environmentIntensity,
  background,
  backgroundBlurriness,
  backgroundIntensity,
  fallbackSky,
}: Props) {
  const fallback = background ? <color attach="background" args={[fallbackSky]} /> : null;
  return (
    <EnvironmentBoundary fallback={fallback}>
      {/* Suspense keeps the rest of the scene mounted while the HDRI streams;
          without it the sibling geometry would be suspended too. */}
      <Suspense fallback={fallback}>
        <Environment
          files={files}
          environmentIntensity={environmentIntensity}
          background={background}
          backgroundBlurriness={backgroundBlurriness}
          backgroundIntensity={backgroundIntensity}
        />
      </Suspense>
    </EnvironmentBoundary>
  );
}
