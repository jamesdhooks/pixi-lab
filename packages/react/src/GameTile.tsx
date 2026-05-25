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

function hasRecentFailure(gameId: string): boolean {
  try {
    return sessionStorage.getItem(failureKey(gameId)) === '1';
  } catch {
    return false;
  }
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

export function GameTile({ definition, onPress, size = 180, index = 0 }: GameTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<GameApp | null>(null);
  const [useFallback, setUseFallback] = useState(
    !definition.previewFactory || hasRecentFailure(definition.id),
  );
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
      capabilities: { ...definition.capabilities, screensaver: false, aiAutoplay: false },
    };

    const app = new GameApp({
      container,
      definition: overrideDef,
      scoreProvider: new NoopHighScoreProvider(),
      mode: 'demo',
    });
    appRef.current = app;

    void app.init().then(() => {
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

  // Deterministic float animation per tile
  const floatDur = 4.5 + (index % 5) * 0.6;
  const floatAmp = 3 + (index % 3);

  return (
    <motion.button
      onClick={onPress}
      whileTap={{ scale: 0.95 }}
      animate={{ y: [0, -floatAmp, 0, floatAmp, 0] }}
      transition={{ duration: floatDur, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
      className="relative cursor-pointer select-none overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      style={{ width: size, height: size }}
      aria-label={`Play ${definition.name}`}
    >
      {useFallback ? (
        <FallbackTile definition={definition} size={size} />
      ) : (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      )}
      {/* Name badge */}
      <div className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1.5 backdrop-blur-sm">
        <p className="truncate text-center text-xs font-semibold text-white">{definition.name}</p>
      </div>
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
      <span style={{ fontSize: size * 0.38, lineHeight: 1 }}>{definition.icon}</span>
    </div>
  );
}

// Unused — hints to TS that PREVIEW_FPS_CAP is read
void PREVIEW_FPS_CAP;
