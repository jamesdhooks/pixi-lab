/**
 * components/games/GameRuntime.tsx
 *
 * React wrapper that owns the GameApp lifecycle.
 * Mounts a canvas into a container div, inits GameApp, starts/stops on mount/unmount.
 */
import { useEffect, useRef, useCallback } from 'react';
import { GameApp, type GameAppOptions } from '@hooksjam/pixi-lab-core';
import type { LabExperience } from '@hooksjam/pixi-lab-core';
import type { AmbientDataAdapter, GameEvent, RenderQuality } from '@hooksjam/pixi-lab-core';

export interface GameRuntimeProps {
  definition: LabExperience;
  userId?: string;
  palette?: string;
  seed?: number;
  mode?: 'play' | 'screensaver' | 'demo';
  quality?: RenderQuality;
  transparent?: boolean;
  sleepMode?: boolean;
  lowMotion?: boolean;
  globalIntensity?: number;
  ambientDataAdapters?: AmbientDataAdapter[];
  onEvent?: (event: GameEvent) => void;
  className?: string;
  /** Called when the GameApp instance is ready */
  onReady?: (app: GameApp) => void;
}

export type ExperienceRuntimeProps = GameRuntimeProps;

export function GameRuntime({
  definition,
  userId,
  palette,
  seed,
  mode = 'play',
  quality,
  transparent,
  sleepMode,
  lowMotion,
  globalIntensity,
  ambientDataAdapters,
  onEvent,
  className,
  onReady,
}: GameRuntimeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<GameApp | null>(null);

  const handleEvent = useCallback(
    (event: GameEvent) => {
      onEvent?.(event);
    },
    [onEvent],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let rafId = 0;

    // Defer to the next animation frame for two reasons:
    // 1. Ensures the browser has performed a layout pass so getBoundingClientRect()
    //    returns correct dimensions (clientWidth can be 0 before the first paint
    //    for elements whose size is derived from inset:0 constraints).
    // 2. React 18 StrictMode double-invokes effects — the first RAF is cancelled
    //    by the cleanup before it fires, so only the second (real) mount runs init.
    rafId = requestAnimationFrame(() => {
      if (cancelled) return;

      const options: GameAppOptions = {
        container,
        definition,
        userId,
        mode,
        palette,
        seed,
        quality,
        transparent,
        sleepMode,
        lowMotion,
        globalIntensity,
        ambientDataAdapters,
        onEvent: handleEvent,
      };

      const app = new GameApp(options);
      appRef.current = app;

      void app.init().then(() => {
        if (cancelled) {
          // Cleanup fired while init was in-flight (unlikely after the rAF guard,
          // but handled defensively). GameApp.destroy() already set destroyed=true
          // so this second call is a safe no-op if destroy was already called, but
          // we call it here in case init resolved before cleanup ran.
          app.destroy();
          return;
        }
        app.start();
        onReady?.(app);
      });

      // The rAF guarantees the browser has painted at least once so
      // clientWidth/clientHeight inside GameApp.init() will be non-zero.
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      const app = appRef.current;
      if (app) {
        app.destroy();
        appRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.id]); // Only re-create when game changes

  useEffect(() => {
    appRef.current?.setSleepMode((sleepMode ?? false) || (lowMotion ?? false));
  }, [sleepMode, lowMotion]);

  useEffect(() => {
    if (typeof globalIntensity === 'number') appRef.current?.setGlobalIntensity(globalIntensity);
  }, [globalIntensity]);

  useEffect(() => {
    if (quality) appRef.current?.setQuality(quality);
  }, [quality]);

  return (
    <div
      ref={containerRef}
      className={className}
      // className fully controls positioning and sizing.
      // When used in GameLauncher, className="w-full h-full" — the parent has
      // explicit w-screen h-screen so percentage sizing resolves correctly.
      style={{ overflow: 'hidden' }}
    />
  );
}

export const ExperienceRuntime = GameRuntime;
export const SimulationRuntime = GameRuntime;
