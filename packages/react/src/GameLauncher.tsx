/**
 * packages/react/src/GameLauncher.tsx
 *
 * Full-screen game shell. Intro → gameplay → game over.
 * Settings button pauses the engine and opens the settings drawer.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, HelpCircle, Play, Settings as SettingsIcon, X } from 'lucide-react';
import { GameRuntime } from './GameRuntime.js';
import { IntroCard } from './ui/IntroCard.js';
import { GameOverModal } from './ui/GameOverModal.js';
import { HUD } from './ui/HUD.js';
import { ModeToggle } from './ui/ModeToggle.js';
import { SettingsDrawer } from './ui/SettingsDrawer.js';
import { StylePicker } from './ui/StylePicker.js';
import { QualitySelector } from './ui/QualitySelector.js';
import { DebugPanel } from './ui/DebugPanel.js';
import { SimControlPanel } from './ui/SimControlPanel.js';
import { OverflowMenu } from './ui/OverflowMenu.js';
import { ViewportProvider, useViewportContext } from './ViewportProvider.js';
import { nameSuggestions } from '@hooksjam/pixi-lab-core';
import type { LabExperience, SimulationExperience } from '@hooksjam/pixi-lab-core';
import type { GameEvent, RenderQuality, ScoreEntry } from '@hooksjam/pixi-lab-core';
import type { GameApp } from '@hooksjam/pixi-lab-core';
import type { IntroHint } from './ui/IntroCard.js';

type Shell = 'playing' | 'gameover';

const RUNTIME_PERF_CSS = `
.pixi-lab-runtime-shell [class*="backdrop-blur"] {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}

.pixi-lab-runtime-shell [class*="shadow"] {
  box-shadow: none !important;
}

.pixi-lab-runtime-shell [class*="drop-shadow"] {
  filter: none !important;
}

.pixi-lab-runtime-shell [class*="transition"] {
  transition-property: none !important;
  transition-duration: 0ms !important;
}
`;

export interface GameLauncherProps {
  definition: LabExperience;
  userId?: string;
  /** Top scores for the leaderboard — fetched by the host app */
  topScores?: ScoreEntry[];
  /** Called when the user submits a score — host app persists it */
  onSubmitScore?: (score: number, name: string) => Promise<void>;
  /** Called when the user quits — host app handles navigation */
  onQuit?: () => void;
  /** Cap rendered pixel count — see GameAppOptions.maxPixels */
  maxPixels?: number;
  /** Start this experience in unattended demo mode as soon as the runtime is ready. */
  autoDemo?: boolean;
  /** Called when the active demo surface is clicked; defaults to shuffling the current scene. */
  onDemoAdvance?: () => void;
  /** Called when an unattended demo is manually exited from the launcher overlay. */
  onDemoExit?: () => void;
  /** Called after the Pixi runtime is ready and the launcher's initial mode is applied. */
  onRuntimeReady?: () => void;
}

export function GameLauncher(props: GameLauncherProps) {
  return (
    <ViewportProvider>
      <GameLauncherInner {...props} />
    </ViewportProvider>
  );
}

function GameLauncherInner({
  definition,
  userId,
  topScores = [],
  onSubmitScore,
  onQuit,
  maxPixels,
  autoDemo = false,
  onDemoAdvance,
  onDemoExit,
  onRuntimeReady,
}: GameLauncherProps) {
  // ViewportProvider is mounted by GameLauncher wrapper; child components read context directly.
  const { isMobile, isLandscape } = useViewportContext();
  const mobilePortrait = isMobile && !isLandscape;
  const [shell, setShell] = useState<Shell>('playing');
  const [infoCardVisible, setInfoCardVisible] = useState(!autoDemo);
  const [infoAutoDismiss, setInfoAutoDismiss] = useState(true);
  const [playKey, setPlayKey] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(autoDemo);
  const [isDemo, setIsDemo] = useState(autoDemo);
  const [screensaverActive, setScreensaverActive] = useState(false);
  const [styleId, setStyleId] = useState(definition.styleManifest?.defaultStyleId ?? '');
  const [quality, setQuality] = useState<RenderQuality>(() => {
    try { return (localStorage.getItem('pixi-lab:quality') as RenderQuality) ?? 'basic'; } catch { return 'basic'; }
  });
  const [localMaxPixels, setLocalMaxPixels] = useState<number | undefined>(() => {
    try {
      const stored = parseInt(localStorage.getItem('pixi-lab:maxPixels') ?? '');
      return (isNaN(stored) || stored === 0) ? maxPixels : stored;
    } catch { return maxPixels; }
  });
  /** Tracks the quality tier actually being rendered (may differ from `quality` on fallback). */
  const [renderedQuality, setRenderedQuality] = useState<RenderQuality | undefined>(undefined);
  const [modeId, setModeId] = useState(() => definition.modes?.[0]?.id ?? '');
  const appRef = useRef<GameApp | null>(null);
  /** State mirror of appRef — triggers a re-render when the engine is ready so
   *  SimControlPanel reads the correct stored settings before the intro card is dismissed. */
  const [appInstance, setAppInstance] = useState<GameApp | null>(null);
  /** Bumped each time the demo AI changes a setting — causes SimControlPanel to re-sync. */
  const [settingsVersion, setSettingsVersion] = useState(0);

  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Demo mode: X button only appears on interaction, fades out after 3 s of inactivity.
  const [demoHintVisible, setDemoHintVisible] = useState(false);
  const demoHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hiddenUiHintVisible, setHiddenUiHintVisible] = useState(false);
  const hiddenUiHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Propagate UI visibility to the simulation canvas layer (hides emitter markers).
  useEffect(() => {
    appRef.current?.setUIHidden(uiHidden);
  }, [uiHidden]);

  useEffect(() => {
    nameSuggestions.load().then(setSuggestions).catch(() => {});
  }, []);

  const handleEvent = useCallback((event: GameEvent) => {
    switch (event.kind) {
      case 'score_update':
        if (typeof event.value === 'number') setScore(event.value);
        break;
      case 'lives_update':
        if (typeof event.value === 'number') setLives(event.value);
        break;
      case 'game_over':
        setShell('gameover');
        break;
      case 'screensaver_enter':
        setScreensaverActive(true);
        break;
      case 'screensaver_exit':
        setScreensaverActive(false);
        break;
      case 'quality_change':
        // Governor-triggered fallback — track actual rendered quality separately.
        if (event.payload && 'quality' in event.payload) {
          setRenderedQuality(event.payload.quality as RenderQuality);
        }
        break;
      case 'style_change':
        if (event.payload && 'styleId' in event.payload) {
          setStyleId(event.payload.styleId as string);
        }
        break;
      case 'setting_change':
        setSettingsVersion((v) => v + 1);
        break;
      default:
        break;
    }
  }, []);
  const openInfoCard = useCallback(() => {
    setInfoCardVisible(true);
    setInfoAutoDismiss(false);
  }, []);

  const handleQuit = useCallback(() => {
    onQuit?.();
  }, [onQuit]);

  const handleRestart = useCallback(() => {
    setScore(0);
    setLives(undefined);
    setModeId(definition.modes?.[0]?.id ?? '');
    setInfoCardVisible(true);
    setInfoAutoDismiss(true);
    setPlayKey((k) => k + 1);
    setShell('playing');
  }, [definition.modes]);

  const handleModeChange = useCallback((id: string) => {
    setModeId(id);
    appRef.current?.setInteractionMode(id);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleScoreSubmit = useCallback(
    async (name: string) => {
      await onSubmitScore?.(score, name);
    },
    [onSubmitScore, score],
  );

  const handleMaxPixelsChange = useCallback((v: number | undefined) => {
    setLocalMaxPixels(v);
    appRef.current?.setMaxPixels(v);
    try { localStorage.setItem('pixi-lab:maxPixels', String(v ?? '')); } catch { /* ignore */ }
  }, []);

  const handleQualityChange = useCallback(
    (nextQuality: RenderQuality) => {
      setQuality(nextQuality);
      setRenderedQuality(undefined); // user picked explicitly; clear any fallback indicator
      appRef.current?.setQuality(nextQuality);
      try { localStorage.setItem('pixi-lab:quality', nextQuality); } catch { /* ignore */ }
    },
    [],
  );

  const enterDemoMode = useCallback((app: GameApp | null = appRef.current) => {
    if (!app || !definition.capabilities.demo) return;
    setShell('playing');
    setSettingsOpen(false);
    setInfoCardVisible(false);
    setIsDemo(true);
    setUiHidden(true);
    app.setUIHidden(true);
    app.setInteractionMode('demo');
    app.setMode('demo');
  }, [definition.capabilities.demo]);

  const exitDemoMode = useCallback(() => {
    if (onDemoExit) {
      onDemoExit();
      return;
    }
    setIsDemo(false);
    setUiHidden(false);
    appRef.current?.setUIHidden(false);
    appRef.current?.setInteractionMode(modeId);
    appRef.current?.setMode('play');
  }, [modeId, onDemoExit]);

  useEffect(() => {
    if (!autoDemo || !appInstance) return;
    enterDemoMode(appInstance);
  }, [autoDemo, appInstance, enterDemoMode]);

  useEffect(() => {
    if (!autoDemo) return;
    setShell('playing');
    setSettingsOpen(false);
    setInfoCardVisible(false);
    setIsDemo(true);
    setUiHidden(true);
  }, [autoDemo]);

  const showDemoHint = useCallback(() => {
    setDemoHintVisible(true);
    if (demoHintTimerRef.current !== null) clearTimeout(demoHintTimerRef.current);
    demoHintTimerRef.current = setTimeout(() => setDemoHintVisible(false), 3000);
  }, []);

  const advanceDemo = useCallback(() => {
    showDemoHint();
    if (onDemoAdvance) {
      onDemoAdvance();
      return;
    }
    appRef.current?.demoShuffle();
  }, [onDemoAdvance, showDemoHint]);

  const showHiddenUiHint = useCallback(() => {
    if (!uiHidden || isDemo) return;
    setHiddenUiHintVisible(true);
    if (hiddenUiHintTimerRef.current !== null) clearTimeout(hiddenUiHintTimerRef.current);
    hiddenUiHintTimerRef.current = setTimeout(() => setHiddenUiHintVisible(false), 3000);
  }, [uiHidden, isDemo]);

  // Clean up timer and hide button when demo mode exits.
  useEffect(() => {
    if (isDemo) return;
    if (demoHintTimerRef.current !== null) {
      clearTimeout(demoHintTimerRef.current);
      demoHintTimerRef.current = null;
    }
    setDemoHintVisible(false);
  }, [isDemo]);

  useEffect(() => {
    if (!uiHidden || isDemo) {
      if (hiddenUiHintTimerRef.current !== null) {
        clearTimeout(hiddenUiHintTimerRef.current);
        hiddenUiHintTimerRef.current = null;
      }
      setHiddenUiHintVisible(false);
      return;
    }

    const reveal = () => showHiddenUiHint();
    window.addEventListener('pointerdown', reveal, { passive: true });
    window.addEventListener('pointermove', reveal, { passive: true });
    window.addEventListener('keydown', reveal);

    return () => {
      window.removeEventListener('pointerdown', reveal);
      window.removeEventListener('pointermove', reveal);
      window.removeEventListener('keydown', reveal);
    };
  }, [uiHidden, isDemo, showHiddenUiHint]);

  useEffect(() => {
    if (!screensaverActive) return;

    const exitScreensaver = () => {
      appRef.current?.exitScreensaver();
    };

    window.addEventListener('pointerdown', exitScreensaver, { passive: true });
    window.addEventListener('pointermove', exitScreensaver, { passive: true });
    window.addEventListener('keydown', exitScreensaver);

    return () => {
      window.removeEventListener('pointerdown', exitScreensaver);
      window.removeEventListener('pointermove', exitScreensaver);
      window.removeEventListener('keydown', exitScreensaver);
    };
  }, [screensaverActive]);

  const hasModes = (definition.modes?.length ?? 0) > 1;
  const hasQualityModes = (definition.capabilities.qualityModes?.length ?? 0) > 0;
  const isSimulation = definition.kind === 'simulation';
  const topNumericFields = (definition.settingsFields ?? []).filter(
    (f) => f.type === 'number' && (!f.visibleModes || f.visibleModes.includes(modeId)),
  );

  // On mobile portrait, style + mode are shown at the top of SimControlPanel instead of HUD/OverflowMenu.
  const controlsHeaderSlot =
    mobilePortrait && (definition.styleManifest || hasModes) ? (
      <>
        {definition.styleManifest && (
          <StylePicker
            manifest={definition.styleManifest}
            value={styleId}
            onChange={(nextStyleId) => {
              setStyleId(nextStyleId);
              appRef.current?.setStyle(nextStyleId);
              if (!isSimulation) appRef.current?.settings.set('style', nextStyleId);
            }}
          />
        )}
        {hasModes && (
          <ModeToggle modes={definition.modes!} value={modeId} onChange={handleModeChange} />
        )}
      </>
    ) : undefined;

  // Build compact gesture → action hints for the IntroCard
  const gestureMap = isSimulation
    ? (definition as SimulationExperience).gestureMap
    : undefined;
  const GESTURE_LABELS: Record<string, string> = {
    tap: 'Tap', drag: 'Drag', double_tap: 'Dbl-tap',
    hold: 'Hold', fast_swipe: 'Swipe', pinch: 'Pinch', spread: 'Spread',
  };
  const introHints: IntroHint[] = gestureMap
    ? (Object.entries(gestureMap) as [string, string][])
        .filter(([k]) => k !== 'pinch' && k !== 'spread')
        .slice(0, 4)
        .map(([k, v]) => ({ label: GESTURE_LABELS[k] ?? k, action: v }))
    : (definition.modes ?? [])
        .slice(0, 3)
        .filter((m) => m.description)
        .map((m) => ({ label: m.label, action: m.description! }));

  // Append a slider hint if the experience has numeric settings visible at default mode
  const defaultNumericFields = (definition.settingsFields ?? []).filter(
    (f) => f.type === 'number' && (!f.visibleModes || f.visibleModes.includes(modeId)),
  );
  if (defaultNumericFields.length > 0) {
    introHints.push({ label: 'Sliders', action: 'adjust physics and visual settings at the top' });
  }

  return (
    <div className="pixi-lab-runtime-shell fixed top-0 left-0 w-full h-full z-50 overflow-hidden bg-black">
      <style>{RUNTIME_PERF_CSS}</style>
      {/* Game canvas — always mounted */}
      <GameRuntime
        definition={definition}
        userId={userId}
        mode={autoDemo && definition.capabilities.demo ? 'demo' : 'play'}
        quality={quality}
        maxPixels={localMaxPixels}
        onEvent={handleEvent}
        onReady={(app) => {
          appRef.current = app;
          setAppInstance(app);
          const initMode = definition.modes?.[0]?.id ?? '';
          if (autoDemo && definition.capabilities.demo) {
            enterDemoMode(app);
          } else if (initMode) {
            app.setInteractionMode(initMode);
          }
          onRuntimeReady?.();
        }}
        className="w-full h-full"
      />

      {/* ── Playing shell ─────────────────────────────────────────────────────────── */}
      {shell === 'playing' && (
        <div
          className={`transition-opacity duration-300 ${uiHidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        >
          {/* Intro card */}
          <AnimatePresence>
            {infoCardVisible && (
              <IntroCard
                key={playKey}
                icon={definition.icon}
                name={definition.name}
                short={definition.short}
                hints={introHints}
                autoDismiss={infoAutoDismiss}
                onDismiss={() => setInfoCardVisible(false)}
              />
            )}
          </AnimatePresence>

          {/* HUD: quit + score/controls · score badge when controls present */}
          <HUD
            score={definition.capabilities.score ? score : undefined}
            lives={lives}
            onQuit={handleQuit}
            controls={
              (definition.styleManifest && !mobilePortrait) || (hasModes && !mobilePortrait) ? (
                <div className="flex items-center gap-1.5">
                  {definition.styleManifest && !mobilePortrait && (
                    <StylePicker
                      manifest={definition.styleManifest}
                      value={styleId}
                      onChange={(nextStyleId) => {
                        setStyleId(nextStyleId);
                        appRef.current?.setStyle(nextStyleId);
                        if (!isSimulation) appRef.current?.settings.set('style', nextStyleId);
                      }}
                    />
                  )}
                  {hasModes && (
                    <ModeToggle modes={definition.modes!} value={modeId} onChange={handleModeChange} />
                  )}
                </div>
              ) : undefined
            }
          />

          {/* Top-right controls: quality, reset, settings, hide-ui, demo — adaptive via OverflowMenu */}
          <OverflowMenu
            items={[
              // On mobile portrait, style + mode move from HUD center into the overflow sheet.
              {
                key: 'style',
                label: 'Style',
                hidden: !definition.styleManifest || !mobilePortrait || !!controlsHeaderSlot,
                fullWidth: true,
                sectionLabel: 'Style',
                node: definition.styleManifest ? (
                  <StylePicker
                    manifest={definition.styleManifest}
                    value={styleId}
                    listMode
                    onChange={(nextStyleId) => {
                      setStyleId(nextStyleId);
                      appRef.current?.setStyle(nextStyleId);
                      if (!isSimulation) appRef.current?.settings.set('style', nextStyleId);
                    }}
                  />
                ) : null,
              },
              {
                key: 'modes',
                label: 'Mode',
                hidden: true, // ModeToggle is shown directly in the HUD center
                fullWidth: true,
                sectionLabel: 'Mode',
                node: hasModes ? (
                  <ModeToggle
                    modes={definition.modes!}
                    value={modeId}
                    onChange={handleModeChange}
                    listRows
                  />
                ) : null,
              },
              {
                key: 'quality',
                label: 'Quality',
                hidden: !hasQualityModes,
                node: (
                  <QualitySelector
                    value={quality}
                    renderedValue={renderedQuality}
                    options={definition.capabilities.qualityModes!}
                    onChange={handleQualityChange}
                  />
                ),
              },
              {
                key: 'reset',
                label: 'Reset',
                hidden: !definition.capabilities.reset,
                node: (
                  <button
                    className="flex h-8 items-center rounded-xl bg-black/30 px-3 text-xs font-semibold text-white/70 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
                    onClick={() => appRef.current?.resetScene()}
                  >
                    Reset
                  </button>
                ),
              },
              {
                key: 'settings',
                label: 'Settings',
                hidden: false,
                node: (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleOpenSettings}
                    aria-label="Settings"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white/70 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
                  >
                    <SettingsIcon size={15} />
                  </motion.button>
                ),
              },
              {
                key: 'hide-ui',
                label: 'Hide UI',
                node: (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setUiHidden(true)}
                    aria-label="Hide UI"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white/40 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white/70"
                  >
                    <EyeOff size={14} />
                  </motion.button>
                ),
              },
              {
                key: 'demo',
                label: 'Demo mode',
                hidden: !definition.capabilities.demo,
                node: (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      enterDemoMode();
                    }}
                    aria-label="Demo mode"
                    className="flex h-8 items-center gap-1.5 rounded-xl bg-black/30 px-2.5 text-white/40 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white/70"
                  >
                    <Play size={11} />
                    <span className="text-[10px] uppercase tracking-widest">Demo</span>
                  </motion.button>
                ),
              },
              {
                key: 'info',
                label: 'How to play',
                node: (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={openInfoCard}
                    aria-label="Info"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white/40 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white/70"
                  >
                    <HelpCircle size={15} />
                  </motion.button>
                ),
              },
            ]}
          />

          {appRef.current && (
            <SettingsDrawer
              open={settingsOpen}
              onClose={handleCloseSettings}
              settings={appRef.current.settings}
              fields={definition.settingsFields ?? []}
              maxPixels={localMaxPixels}
              onMaxPixelsChange={handleMaxPixelsChange}
            />
          )}

          {/* Top: numeric sliders for any experience that exposes number settings */}
          {(topNumericFields.length > 0 || controlsHeaderSlot) && (
            <SimControlPanel
              app={appInstance}
              fields={topNumericFields}
              settingsVersion={settingsVersion}
              headerSlot={controlsHeaderSlot}
            />
          )}

          {/* Bottom-right: debug panel — hidden with the rest of the UI */}
          <div className="pointer-events-none absolute bottom-3 right-3 z-40">
            <DebugPanel app={appInstance} />
          </div>
        </div>
      )}

      {/* ── Demo mode overlay ─────────────────────────────────────────────────────── */}
      {isDemo && (
        <>
          {/* Tap-anywhere-to-shuffle transparent capture layer */}
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onPointerMove={showDemoHint}
            onClick={advanceDemo}
          />
          {/* Close button — fades in on interaction, auto-hides after 3 s of inactivity */}
          <AnimatePresence>
            {demoHintVisible && (
              <motion.button
                key="demo-x"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute right-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white/60 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
                aria-label="Exit demo"
                onClick={(e) => {
                  e.stopPropagation();
                  exitDemoMode();
                }}
              >
                <X size={14} />
              </motion.button>
            )}
          </AnimatePresence>
        </>
      )}

      {uiHidden && !isDemo && (
        <AnimatePresence>
          {hiddenUiHintVisible && (
            <motion.button
              key="hidden-ui-eye"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute right-3 top-3 z-40 flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white/60 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
              aria-label="Restore UI"
              onClick={(e) => {
                e.stopPropagation();
                setUiHidden(false);
              }}
            >
              <Eye size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      )}

      {/* ── Game-over shell ────────────────────────────────────────────────────────── */}
      {shell === 'gameover' && (
        definition.kind === 'game' ? (
          <GameOverModal
            score={score}
            suggestions={suggestions}
            topScores={topScores}
            onSubmit={handleScoreSubmit}
            onRestart={handleRestart}
            onQuit={handleQuit}
          />
        ) : null
      )}
    </div>
  );
}
