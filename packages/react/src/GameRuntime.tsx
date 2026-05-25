/**
 * components/games/GameRuntime.tsx
 *
 * React wrapper that owns the GameApp lifecycle.
 * Mounts a canvas into a container div, inits GameApp, starts/stops on mount/unmount.
 */
import { useEffect, useRef, useCallback } from 'react';
import { GameApp, type GameAppOptions } from '@hooksjam/pixi-lab-core';
import type { LabExperience } from '@hooksjam/pixi-lab-core';
import type { GameEvent } from '@hooksjam/pixi-lab-core';

export interface GameRuntimeProps {
  definition: LabExperience;
  userId?: string;
  palette?: string;
  mode?: 'play' | 'screensaver' | 'demo';
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
  mode = 'play',
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

    const options: GameAppOptions = {
      container,
      definition,
      userId,
      mode,
      palette,
      onEvent: handleEvent,
    };

    const app = new GameApp(options);
    appRef.current = app;

    void app.init().then(() => {
      app.start();
      onReady?.(app);
    });

    return () => {
      app.destroy();
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.id]); // Only re-create when game changes

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
    />
  );
}

export const ExperienceRuntime = GameRuntime;
export const SimulationRuntime = GameRuntime;
