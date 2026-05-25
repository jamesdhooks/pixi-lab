import type { AmbientDataAdapter, AmbientExperience, GameEvent, RenderQuality } from '@hooksjam/pixi-lab-core';
import type { GameApp } from '@hooksjam/pixi-lab-core';
import { useEffect, useRef } from 'react';
import { GameRuntime } from './GameRuntime';

export interface ForegroundAmbientOverlayProps {
  definition: AmbientExperience;
  opacity?: number;
  intensity?: number;
  sleepMode?: boolean;
  lowMotion?: boolean;
  paused?: boolean;
  seed?: number;
  quality?: RenderQuality;
  ambientDataAdapters?: AmbientDataAdapter[];
  className?: string;
  zIndex?: number;
  onEvent?: (event: GameEvent) => void;
}

export function ForegroundAmbientOverlay({
  definition,
  opacity = 1,
  intensity = 1,
  sleepMode = false,
  lowMotion = false,
  paused = false,
  seed,
  quality,
  ambientDataAdapters,
  className,
  zIndex = 40,
  onEvent,
}: ForegroundAmbientOverlayProps) {
  const appRef = useRef<GameApp | null>(null);

  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    if (paused) app.pause();
    else app.resume();
  }, [paused]);

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, opacity, pointerEvents: 'none', overflow: 'hidden', zIndex }}
    >
      <GameRuntime
        definition={definition}
        seed={seed}
        mode="play"
        quality={quality}
        transparent
        sleepMode={sleepMode}
        lowMotion={lowMotion}
        globalIntensity={intensity}
        ambientDataAdapters={ambientDataAdapters}
        onEvent={onEvent}
        onReady={(app) => {
          appRef.current = app;
          if (paused) app.pause();
        }}
      />
    </div>
  );
}
