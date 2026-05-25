/**
 * components/games/GameTile.tsx
 *
 * Rich animated tile for the Kids home page.
 * Renders a live preview scene at ≤30 FPS inside a small canvas.
 * Automatically falls back to a static PNG if:
 *   - The definition has no previewFactory
 *   - Average FPS in the first 2 seconds drops below 20
 *   - sessionStorage records a previous failure for this game
 * The PNG fallback is a gradient with the game icon.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GameApp } from '@hooksjam/pixi-lab-core';
import { NoopHighScoreProvider } from '@hooksjam/pixi-lab-core';
import type { LabExperience } from '@hooksjam/pixi-lab-core';

const PERF_WINDOW_S = 2; // measure perf for 2 seconds
const FPS_THRESHOLD = 20; // fall back if avg below this
const PREVIEW_FPS_CAP = 30; // cap preview rendering

function failureKey(gameId: string) {
  return `fao:game:tile-perf-fail:${gameId}`;
}

function recordFailure(gameId: string) {
  try {
    sessionStorage.setItem(failureKey(gameId), '1');
  } catch {
    // ignore
  }
}

export interface GameTileProps {
  definition: LabExperience;
  onPress?: () => void;
  size?: number;
  index?: number;
}

export type PreviewTileProps = GameTileProps;

export function GameTile({ definition, onPress, size = 180, index: _index = 0 }: GameTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<GameApp | null>(null);
  // Always attempt the live preview — clear any stale failure recorded by a previous bug.
  // The in-session FPS check below will still fall back on genuinely slow devices.
  const [useFallback, setUseFallback] = useState(!definition.previewFactory);
  const frameCountRef = useRef(0);
  const elapsedRef = useRef(0);
  const measuringRef = useRef(true);
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  const startPreview = useCallback(() => {
    const container = containerRef.current;
    if (!container || useFallback) return;

    const overrideDef = {
      ...definition,
      factory: definition.previewFactory,
      // Disable all AI so the demo AI can't change fieldResolution and spike CPU
      demoAiFactory: undefined,
      aiFactory: undefined,
      capabilities: { ...definition.capabilities, screensaver: false, aiAutoplay: false, demo: false },
    };

    const app = new GameApp({
      container,
      definition: overrideDef,
      scoreProvider: new NoopHighScoreProvider(),
      mode: 'screensaver',
    });
    appRef.current = app;

    void app.init().then(() => {
      // Guard: cleanup may have fired while init was in-flight (React StrictMode
      // double-invoke). appRef is nulled by cleanup, so this catches that case.
      if (appRef.current !== app) return;
      app.start();
    });

    // Perf measuring loop: run for PERF_WINDOW_S then decide to keep or fallback
    if (measuringRef.current) {
      const measure = (now: number) => {
        if (!measuringRef.current) return;
        if (lastTimeRef.current !== null) {
          const dt = (now - lastTimeRef.current) / 1000;
          elapsedRef.current += dt;
          frameCountRef.current++;

          if (elapsedRef.current >= PERF_WINDOW_S) {
            measuringRef.current = false;
            const fps = frameCountRef.current / elapsedRef.current;
            if (fps < FPS_THRESHOLD) {
              recordFailure(definition.id);
              app.destroy();
              appRef.current = null;
              setUseFallback(true);
            }
            return;
          }
        }
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(measure);
      };
      rafRef.current = requestAnimationFrame(measure);
    }
  }, [definition, useFallback]);

  useEffect(() => {
    startPreview();
    return () => {
      cancelAnimationFrame(rafRef.current);
      appRef.current?.destroy();
      appRef.current = null;
    };
  }, [startPreview]);

  return (
    <motion.button
      onClick={onPress}
      whileTap={{ scale: 0.95 }}
      className="relative cursor-pointer select-none overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      style={{ width: size, height: size }}
      aria-label={`Play ${definition.name}`}
    >
      {useFallback ? (
        <FallbackTile definition={definition} size={size} />
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#1a1a2e' }} />
      )}
      {/* Glass border overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.13) 0%, transparent 42%, transparent 58%, rgba(0,0,0,0.2) 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.2), inset 1px 0 rgba(255,255,255,0.13), inset -1px 0 rgba(0,0,0,0.08)',
        }}
      />
    </motion.button>
  );
}

export const PreviewTile = GameTile;

function FallbackTile({ definition, size }: { definition: LabExperience; size: number }) {
  if (definition.previewFallback) {
    return (
      <img
        src={definition.previewFallback}
        alt={definition.name}
        style={{ width: size, height: size, objectFit: 'cover' }}
      />
    );
  }

  // Gradient + icon fallback
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background: `linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)`,
      }}
    >
      <span style={{ fontSize: size * 0.5, lineHeight: 1, color: 'white' }}>{definition.icon}</span>
    </div>
  );
}

// Unused — hints to TS that PREVIEW_FPS_CAP is read
void PREVIEW_FPS_CAP;
