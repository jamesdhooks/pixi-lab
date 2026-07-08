/**
 * components/games/GameTile.tsx
 *
 * Rich animated tile for the Kids home page.
 * Renders a live preview scene at ≤30 FPS inside a small canvas.
 * Automatically falls back to a static PNG if:
 *   - The definition has no previewFactory
 *   - The preview fails to initialize
 *   - sessionStorage records a previous failure for this game
 * The PNG fallback is a gradient with the game icon.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DomScriptScene,
  GameApp,
  Input,
  NoopHighScoreProvider,
  RenderStyleManager,
  Settings,
  withCommonSimulationSettings,
} from '@hooksjam/pixi-lab-core';
import type { GameContext, LabExperience, SettingsField, SimAIContext, SimulationAI, SimulationExperience } from '@hooksjam/pixi-lab-core';

/** Preview tiles should run at display refresh unless the browser itself throttles them.
 *  Passing a 60fps cap through Ticker can accidentally halve a 60Hz rAF stream
 *  when timestamps land just under 16.667ms, which made game previews read ~30–35fps
 *  while fullscreen scenes stayed at 60. */
const PREVIEW_FPS_CAP: number | undefined = undefined;
/** Stagger tile start-up so previews don't all create WebGL contexts at once. */
const INIT_STAGGER_MS = 420;
/**
 * GPU budget for live preview tiles.
 * Caps the rendered pixel count to reduce memory and fill-rate pressure when
 * a gallery renders many tiles simultaneously.  Tweak here to trade quality
 * for performance — 200 k px ≈ DPR 1.5× on a 180 px tile, DPR 1.05× on a
 * 450 px tile.  Set to `undefined` to disable.
 */
const PREVIEW_MAX_PIXELS: number | undefined = 90_000;

const PREVIEW_NUMERIC_LIMITS: Record<string, { min?: number; max: number; default: number }> = {
  resolution: { min: 32, max: 128, default: 128 },
  maxParticles: { min: 1, max: 1600, default: 1200 },
  maxNodes: { min: 512, max: 2048, default: 1024 },
  rawParticleCount: { min: 1000, max: 100_000, default: 60_000 },
  burstParticles: { min: 16, max: 512, default: 256 },
  fluidGridResolution: { min: 32, max: 128, default: 64 },
  pressureIterations: { min: 4, max: 24, default: 18 },
  solverIterations: { min: 1, max: 3, default: 2 },
  substeps: { min: 1, max: 2, default: 1 },
  rawParticleDensity: { min: 0.1, max: 1.4, default: 0.8 },
  fieldSpread: { min: 0.4, max: 2.8, default: 1.4 },
};

function previewDefinitionId(definition: LabExperience): string {
  return definition.id.endsWith(':preview') ? definition.id : `${definition.id}:preview`;
}

function clampPreviewNumber(value: number, min: number | undefined, max: number): number {
  return Math.max(min ?? -Infinity, Math.min(max, value));
}

function createPreviewField(field: SettingsField): SettingsField {
  if (field.type === 'select' && field.key === 'rawParticleTextureSize') {
    const options = (field.options ?? []).filter((option) => {
      const edge = Number(option.value);
      return Number.isFinite(edge) ? edge <= 256 : true;
    });
    const fallback = options.find((option) => option.value === '128')?.value ?? options[0]?.value ?? field.default;
    return { ...field, options: options.length > 0 ? options : field.options, default: fallback };
  }
  if (field.type !== 'number') return { ...field };
  const limit = PREVIEW_NUMERIC_LIMITS[field.key];
  if (!limit) return { ...field };
  const min = Math.max(field.min ?? -Infinity, limit.min ?? -Infinity);
  const max = Math.max(min, Math.min(field.max ?? limit.max, limit.max));
  return {
    ...field,
    min,
    max,
    default: clampPreviewNumber(limit.default, min, max),
  };
}

function createPreviewDefinition(definition: LabExperience): LabExperience {
  const settingsFields = definition.settingsFields?.map(createPreviewField);
  const configDefaults = { ...(definition.configDefaults ?? {}) };
  for (const field of settingsFields ?? []) {
    configDefaults[field.key] = field.default;
  }
  if (configDefaults.timeScale !== undefined) configDefaults.timeScale = 1;
  return {
    ...definition,
    id: previewDefinitionId(definition),
    settingsFields,
    configDefaults,
  } as LabExperience;
}

function resetPreviewSettings(settings: Settings): void {
  settings.reset(settings.getFields().map((field) => field.key));
}

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
  /**
   * When false the live preview is not started (or destroyed if running).
   * Defaults to true. Pass false for off-screen carousel tiles to save GPU.
   */
  active?: boolean;
  /** Shows a tiny bottom-right FPS readout for diagnosing preview performance. */
  showFps?: boolean;
}

export type PreviewTileProps = GameTileProps;

export function GameTile({ definition, onPress, size = 180, index = 0, active = true, showFps = false }: GameTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<GameApp | null>(null);
  const domPreviewCleanupRef = useRef<(() => void) | null>(null);
  // Always attempt the live preview — clear any stale failure recorded by a previous bug.
  // The in-session FPS check below will still fall back on genuinely slow devices.
  const [useFallback, setUseFallback] = useState(!definition.previewFactory);
  const frameCountRef = useRef(0);
  const elapsedRef = useRef(0);
  const measuringRef = useRef(true);
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const readyRafRef = useRef(0);
  const [previewReady, setPreviewReady] = useState(useFallback);
  const [previewFps, setPreviewFps] = useState(0);

  const startPreview = useCallback(() => {
    const container = containerRef.current;
    if (!container || useFallback || appRef.current) return false;
    setPreviewReady(false);

    if (!definition.previewFactory) return false;
    const previewDefinition = createPreviewDefinition(definition);
    const hostCanvas = document.createElement('canvas');
    hostCanvas.style.position = 'absolute';
    hostCanvas.style.inset = '0';
    hostCanvas.style.width = '100%';
    hostCanvas.style.height = '100%';
    hostCanvas.style.opacity = '0';
    hostCanvas.style.pointerEvents = 'none';
    const settings = new Settings(previewDefinition.id, withCommonSimulationSettings(previewDefinition));
    resetPreviewSettings(settings);
    const styleManager = new RenderStyleManager();
    if (previewDefinition.styleManifest) styleManager.setManifest(previewDefinition.styleManifest);
    const input = new Input();
    const width = Math.max(1, container.clientWidth || size);
    const height = Math.max(1, container.clientHeight || size);
    const simDefinition = previewDefinition.kind === 'simulation' ? previewDefinition as SimulationExperience : null;
    const ctx: GameContext = {
      mode: 'demo',
      seed: 0,
      quality: 'basic',
      isPreview: true,
      width,
      height,
      systems: {
        pixi: { canvas: hostCanvas },
        settings,
        styleManager,
      } as unknown as GameContext['systems'],
      emit: () => undefined,
    };
    const directPreviewScene = previewDefinition.previewFactory(ctx);
    if (directPreviewScene instanceof DomScriptScene) {
      try {
        container.appendChild(hostCanvas);
        directPreviewScene.onEnter(ctx, input);
        directPreviewScene.setMode('demo');
        let demoAi: SimulationAI | null = null;
        let demoElapsed = 0;
        let demoLastTime = performance.now();
        let demoRaf = 0;
        const buildDemoContext = (dt: number): SimAIContext => {
          const styleIds = (simDefinition?.styleManifest?.styles ?? [])
            .filter((style) => style.id !== '__random__')
            .map((style) => style.id);
          return {
            width,
            height,
            dt,
            elapsedTime: demoElapsed,
            isPreview: true,
            styleIds,
            applyStyle: (id) => {
              styleManager.setStyle(id);
              directPreviewScene.setStyle(id);
            },
            applySetting: (key, value) => {
              settings.set(key, value);
            },
            applyNumericSetting: (key, value) => {
              settings.set(key, value);
            },
            pushGestures: () => undefined,
            resetScene: () => directPreviewScene.reset(),
            clearEmittersOnly: () => directPreviewScene.clearEmitters(),
          };
        };
        if (simDefinition?.demoAiFactory) {
          demoAi = simDefinition.demoAiFactory(ctx);
          demoAi.onActivate?.(buildDemoContext(0));
          const tickDemoAi = (now: number) => {
            const dt = Math.min(0.1, Math.max(0, (now - demoLastTime) / 1000));
            demoLastTime = now;
            demoElapsed += dt;
            demoAi?.think(buildDemoContext(dt));
            demoRaf = requestAnimationFrame(tickDemoAi);
          };
          demoRaf = requestAnimationFrame(tickDemoAi);
        }
        domPreviewCleanupRef.current = () => {
          if (demoRaf) cancelAnimationFrame(demoRaf);
          demoAi?.reset();
          directPreviewScene.onExit();
          input.unmount();
          hostCanvas.remove();
        };
        readyRafRef.current = requestAnimationFrame(() => {
          readyRafRef.current = requestAnimationFrame(() => {
            setPreviewReady(true);
          });
        });
      } catch {
        domPreviewCleanupRef.current?.();
        domPreviewCleanupRef.current = null;
        recordFailure(definition.id);
        setUseFallback(true);
        setPreviewReady(true);
        return false;
      }
    } else {
      const overrideDef = {
        ...previewDefinition,
        factory: definition.previewFactory,
        // Game preview scenes own their tiny demo/reset cadence. Do not attach
        // the full game AI here: it runs every rAF in demo mode and kept simple
        // preview tiles hot even when no render work was needed.
        aiFactory: undefined,
        capabilities: { ...definition.capabilities, screensaver: false, aiAutoplay: false, demo: true },
      };

      const app = new GameApp({
        container,
        definition: overrideDef,
        scoreProvider: new NoopHighScoreProvider(),
        mode: 'play',
        quality: 'basic',
        maxFps: PREVIEW_FPS_CAP,
        maxPixels: PREVIEW_MAX_PIXELS,
      });
      appRef.current = app;

      void app.init().then(() => {
        // Guard: cleanup may have fired while init was in-flight (React StrictMode
        // double-invoke). appRef is nulled by cleanup, so this catches that case.
        if (appRef.current !== app) return;
        resetPreviewSettings(app.settings);
        app.start();
        app.setInteractionMode('demo');
        app.setMode('demo');
        readyRafRef.current = requestAnimationFrame(() => {
          readyRafRef.current = requestAnimationFrame(() => {
            if (appRef.current === app) setPreviewReady(true);
          });
        });
      }).catch(() => {
        if (appRef.current === app) {
          recordFailure(definition.id);
          app.destroy();
          appRef.current = null;
          setUseFallback(true);
          setPreviewReady(true);
        }
      });
    }

    // Perf measuring loop: keep telemetry lightweight. A slow but visible preview
    // is still better than a tile that appears to "crash" after warm-up.
    if (measuringRef.current) {
      const measure = (now: number) => {
        if (!measuringRef.current) return;
        if (lastTimeRef.current !== null) {
          const dt = (now - lastTimeRef.current) / 1000;
          elapsedRef.current += dt;
          frameCountRef.current++;

          if (elapsedRef.current > 0.75) {
            const stats = appRef.current?.getDebugStats();
            setPreviewFps(stats ? stats.fps : Math.round(frameCountRef.current / elapsedRef.current));
            elapsedRef.current = 0;
            frameCountRef.current = 0;
          }
        }
        lastTimeRef.current = now;
        rafRef.current = requestAnimationFrame(measure);
      };
      rafRef.current = requestAnimationFrame(measure);
    }
    return true;
  }, [definition, useFallback]);

  useEffect(() => {
    if (!active) {
      // Out of view — tear down to free GPU resources.
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(readyRafRef.current);
      appRef.current?.destroy();
      appRef.current = null;
      domPreviewCleanupRef.current?.();
      domPreviewCleanupRef.current = null;
      setPreviewReady(true);
      if (measuringRef.current) {
        frameCountRef.current = 0;
        elapsedRef.current = 0;
        lastTimeRef.current = null;
      }
      setPreviewFps(0);
      return;
    }
    // Stagger tile start-up so all tiles don't init WebGL contexts simultaneously.
    const timerId = window.setTimeout(startPreview, index * INIT_STAGGER_MS);
    return () => {
      window.clearTimeout(timerId);
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(readyRafRef.current);
      appRef.current?.destroy();
      appRef.current = null;
      domPreviewCleanupRef.current?.();
      domPreviewCleanupRef.current = null;
      setPreviewReady(false);
      if (measuringRef.current) {
        frameCountRef.current = 0;
        elapsedRef.current = 0;
        lastTimeRef.current = null;
      }
      setPreviewFps(0);
    };
  }, [active, startPreview, index]);

  return (
    <motion.button
      onClick={onPress}
      whileTap={{ scale: 0.95 }}
      className="relative cursor-pointer select-none overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      style={{ width: size, height: size }}
      aria-label={`Play ${definition.name}`}
    >
      {useFallback || !active ? (
        <FallbackTile definition={definition} size={size} />
      ) : (
        <div
          ref={containerRef}
          data-pixi-lab-context-label={`${definition.name} preview`}
          style={{ width: '100%', height: '100%', background: '#1a1a2e' }}
        />
      )}
      <AnimatePresence>
        {!useFallback && active && !previewReady && (
          <motion.div
            key="preview-loading"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-2xl bg-[#080b13]"
          >
            <motion.div
              className="h-6 w-6 rounded-full border border-white/10 border-t-white/45"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Glass border overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-2xl"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.13) 0%, transparent 42%, transparent 58%, rgba(0,0,0,0.2) 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.2), inset 1px 0 rgba(255,255,255,0.13), inset -1px 0 rgba(0,0,0,0.08)',
        }}
      />
      {showFps && (
        <div className="pointer-events-none absolute bottom-1.5 right-1.5 z-30 rounded-md bg-black/45 px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums text-white/65">
          {previewFps > 0 ? `${previewFps} fps` : '-- fps'}
        </div>
      )}
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
