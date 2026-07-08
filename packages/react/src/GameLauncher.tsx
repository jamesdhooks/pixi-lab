/**
 * packages/react/src/GameLauncher.tsx
 *
 * Full-screen game shell. Intro → gameplay → game over.
 * Settings button pauses the engine and opens the settings drawer.
 */
import { useState, useCallback, useRef, useEffect, useMemo, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Eye, EyeOff, HelpCircle, Play, Settings as SettingsIcon, X } from 'lucide-react';
import { GameRuntime } from './GameRuntime.js';
import { IntroCard } from './ui/IntroCard.js';
import { GameOverModal } from './ui/GameOverModal.js';
import { HUD } from './ui/HUD.js';
import { ModeToggle } from './ui/ModeToggle.js';
import { SettingsDrawer, type SettingsDefaultsSaveRequest } from './ui/SettingsDrawer.js';
import { DebugPanel } from './ui/DebugPanel.js';
import { SimControlPanel } from './ui/SimControlPanel.js';
import { TopbarSelect } from './ui/TopbarSelect.js';
import { OverflowMenu } from './ui/OverflowMenu.js';
import { ViewportProvider, useViewportContext } from './ViewportProvider.js';
import { resolveRenderSelection, resolveStoredRenderSelection } from './engineConfigurationSelection.js';
import {
  LEGACY_RENDER_QUALITY_STORAGE_KEY,
  RENDER_SELECTION_STORAGE_KEY,
  isEngineConfigurationVisible,
  serializeRenderBackendProfileStorage,
  nameSuggestions,
  withCommonSimulationSettings,
} from '@hooksjam/pixi-lab-core';
import type { LabExperience, SimulationExperience } from '@hooksjam/pixi-lab-core';
import type { GameEvent, RenderBackendProfileSelection, RenderQuality, ScoreEntry } from '@hooksjam/pixi-lab-core';
import type { GameApp } from '@hooksjam/pixi-lab-core';
import type { IntroHint } from './ui/IntroCard.js';

type Shell = 'playing' | 'gameover';

function readStoredRenderSelection(): unknown {
  try {
    const storedSelection = localStorage.getItem(RENDER_SELECTION_STORAGE_KEY);
    return storedSelection ? JSON.parse(storedSelection) : undefined;
  } catch {
    return undefined;
  }
}

function readStoredLegacyRenderQuality(): string | null {
  try {
    return localStorage.getItem(LEGACY_RENDER_QUALITY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredRenderSelection(selection: RenderBackendProfileSelection): void {
  try {
    localStorage.setItem(LEGACY_RENDER_QUALITY_STORAGE_KEY, selection.legacyQuality);
    localStorage.setItem(RENDER_SELECTION_STORAGE_KEY, JSON.stringify(serializeRenderBackendProfileStorage(selection)));
  } catch {
    /* ignore */
  }
}

function styleStorageKey(definition: LabExperience): string {
  return `pixi-lab:style:${definition.id}`;
}

function defaultStyleId(definition: LabExperience): string {
  return definition.styleManifest?.defaultStyleId ?? definition.styleManifest?.styles[0]?.id ?? '';
}

function readStoredStyleId(definition: LabExperience): string {
  const fallback = defaultStyleId(definition);
  if (!definition.styleManifest) return fallback;
  try {
    const stored = localStorage.getItem(styleStorageKey(definition));
    if (stored && definition.styleManifest.styles.some((style) => style.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return fallback;
}

function writeStoredStyleId(definition: LabExperience, styleId: string): void {
  if (!definition.styleManifest?.styles.some((style) => style.id === styleId)) return;
  try {
    localStorage.setItem(styleStorageKey(definition), styleId);
  } catch {
    /* ignore */
  }
}

const RENDER_STYLE_FIELD_KEY = 'renderStyle';
const FLUID_BASIC_STYLE_ID = 'bounded-cyan';
const FLUID_ENHANCED_STYLE_ID = 'webgl-fluid-glow';
const FLUID_VISUAL_STYLE_MODES = [
  { id: FLUID_BASIC_STYLE_ID, label: 'Basic', description: 'Default fluid rendering' },
  { id: FLUID_ENHANCED_STYLE_ID, label: 'Enhanced', description: 'Bloom, sun rays, and stronger surface shading' },
];
const FLUID_VISUAL_PRESETS: Record<string, Record<string, number>> = {
  [FLUID_BASIC_STYLE_ID]: {
    shadingStrength: 0.42,
    bloomStrength: 0.22,
    bloomThreshold: 0.72,
    sunraysStrength: 0,
  },
  [FLUID_ENHANCED_STYLE_ID]: {
    shadingStrength: 0.68,
    bloomStrength: 1.22,
    bloomThreshold: 0.34,
    sunraysStrength: 0.94,
  },
};

function getRenderStyleField(definition: LabExperience): NonNullable<LabExperience['settingsFields']>[number] | undefined {
  return definition.settingsFields?.find((field) => field.key === RENDER_STYLE_FIELD_KEY && field.type === 'select');
}

function defaultRenderStyleId(definition: LabExperience): string {
  const configured = definition.configDefaults?.[RENDER_STYLE_FIELD_KEY];
  if (typeof configured === 'string') return configured;
  const field = getRenderStyleField(definition);
  if (typeof field?.default === 'string') return field.default;
  return field?.options?.[0]?.value ?? '';
}

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
  /** Optional host-selected startup engine configuration, sanitized before launch. */
  initialRenderSelection?: RenderBackendProfileSelection;
  /** Optional host-selected startup legacy token, sanitized against the active experience. */
  initialQuality?: RenderQuality;
  /** Dev/test-only raw-engine experiment switch; public hosts should leave false. */
  experimentalRawEngine?: boolean;
  /**
   * Called whenever the launcher resolves renderer backend/profile state.
   * Hosts can observe this backend-neutral descriptor while scenes continue to
   * receive the legacy RenderQuality value during migration.
   */
  onRenderSelectionChange?: (selection: RenderBackendProfileSelection) => void;
  /** Remove the black shell background so the launcher floats as a transparent overlay. */
  transparent?: boolean;
  /** Host callback for persisting the current scene tuning as disk-backed defaults. */
  onSaveDefaults?: (payload: SceneDefaultsSavePayload) => Promise<void> | void;
}

export interface SceneDefaultsSavePayload {
  definitionId: string;
  section: string | null;
  defaults: Record<string, unknown>;
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
  initialRenderSelection,
  initialQuality,
  experimentalRawEngine = false,
  onRenderSelectionChange,
  transparent = false,
  onSaveDefaults,
}: GameLauncherProps) {
  // ViewportProvider is mounted by GameLauncher wrapper; child components read context directly.
  const { isMobile, isLandscape } = useViewportContext();
  const mobilePortrait = isMobile && !isLandscape;
  const [shell, setShell] = useState<Shell>('playing');
  const [infoCardVisible, setInfoCardVisible] = useState(!autoDemo);
  const [infoAutoDismiss, setInfoAutoDismiss] = useState(true);
  const [playKey, setPlayKey] = useState(0);
  const [score, setScore] = useState(0);
  const [gameStats, setGameStats] = useState<{ dropsRemaining?: number; phase?: string; combo?: number }>({});
  const [lives, setLives] = useState<number | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageUrlEditorOpen, setImageUrlEditorOpen] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [uiHidden, setUiHidden] = useState(autoDemo);
  const [isDemo, setIsDemo] = useState(autoDemo);
  const [screensaverActive, setScreensaverActive] = useState(false);
  const [styleId, setStyleId] = useState(() => readStoredStyleId(definition));
  const [renderStyleId, setRenderStyleId] = useState(() => defaultRenderStyleId(definition));
  const resolveStartupRenderSelection = useCallback(() => {
    if (initialRenderSelection !== undefined) {
      return resolveStoredRenderSelection(
        serializeRenderBackendProfileStorage(initialRenderSelection),
        initialRenderSelection.legacyQuality,
        definition.capabilities,
      );
    }
    if (initialQuality !== undefined) return resolveRenderSelection(initialQuality, definition.capabilities);
    const storedQuality = readStoredLegacyRenderQuality();
    const storedSelection = readStoredRenderSelection();
    return resolveStoredRenderSelection(storedSelection, storedQuality, definition.capabilities);
  }, [definition.capabilities, initialQuality, initialRenderSelection]);

  const [renderSelection, setRenderSelection] = useState<RenderBackendProfileSelection>(() => resolveStartupRenderSelection());

  useEffect(() => {
    onRenderSelectionChange?.(renderSelection);
  }, [onRenderSelectionChange, renderSelection]);

  const sceneLegacyQuality = renderSelection.legacyQuality;
  const [localMaxPixels, setLocalMaxPixels] = useState<number | undefined>(() => {
    try {
      const stored = parseInt(localStorage.getItem('pixi-lab:maxPixels') ?? '');
      return (isNaN(stored) || stored === 0) ? maxPixels : stored;
    } catch { return maxPixels; }
  });
  /** Tracks the legacy quality tier actually being rendered (may differ from `sceneLegacyQuality` on fallback). */
  const [, setRenderedLegacyQuality] = useState<RenderQuality | undefined>(undefined);
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

  useEffect(() => {
    const nextSelection = resolveStartupRenderSelection();
    setRenderSelection(nextSelection);
    setRenderedLegacyQuality(undefined);
    setStyleId(readStoredStyleId(definition));
    setRenderStyleId(defaultRenderStyleId(definition));
    appRef.current = null;
    setAppInstance(null);
    if (initialRenderSelection === undefined && initialQuality === undefined) {
      writeStoredRenderSelection(nextSelection);
    }
  }, [definition, initialQuality, initialRenderSelection, resolveStartupRenderSelection]);

  const handleEvent = useCallback((event: GameEvent) => {
    switch (event.kind) {
      case 'score_update':
        if (typeof event.value === 'number') setScore(event.value);
        if (event.payload) {
          setGameStats((current) => ({
            ...current,
            ...(typeof event.payload?.dropsRemaining === 'number' ? { dropsRemaining: event.payload.dropsRemaining as number } : {}),
            ...(typeof event.payload?.combo === 'number' ? { combo: event.payload.combo as number } : {}),
            ...(typeof event.payload?.phase === 'string' ? { phase: event.payload.phase as string } : {}),
          }));
        }
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
          setRenderedLegacyQuality(event.payload.quality as RenderQuality);
        }
        break;
      case 'style_change':
        if (event.payload && 'styleId' in event.payload) {
          const nextStyleId = event.payload.styleId as string;
          setStyleId(nextStyleId);
          writeStoredStyleId(definition, nextStyleId);
        }
        break;
      case 'setting_change':
        if (event.payload && event.payload.key === RENDER_STYLE_FIELD_KEY && typeof event.payload.value === 'string') {
          setRenderStyleId(event.payload.value);
        }
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
    setGameStats({});
    setLives(undefined);
    const initialMode = definition.modes?.[0]?.id ?? '';
    setModeId(initialMode);
    setInfoCardVisible(false);
    setInfoAutoDismiss(true);
    setPlayKey((k) => k + 1);
    setShell('playing');
    if (initialMode) {
      appRef.current?.setInteractionMode(initialMode);
    }
    appRef.current?.resetScene();
  }, [definition.modes]);

  const handleModeChange = useCallback((id: string) => {
    setModeId(id);
    appRef.current?.setInteractionMode(id);
  }, [definition]);

  const handleRenderStyleChange = useCallback((id: string) => {
    const renderOptions = getRenderStyleField(definition)?.options?.map((option) => ({ id: option.value, label: option.label })) ?? [];
    const nextId = definition.id === 'fluid-tank' && id === 'random'
      ? pickRandomRenderStyle(renderOptions)
      : id;
    setRenderStyleId(nextId);
    appRef.current?.settings.set(RENDER_STYLE_FIELD_KEY, nextId);
    if (definition.id === 'fluid-tank') appRef.current?.resetScene();
  }, [definition]);

  const handleStyleChange = useCallback((nextStyleId: string) => {
    const resolvedStyleId = nextStyleId === '__random__'
      ? pickRandomStyleId(definition.styleManifest?.styles ?? [])
      : nextStyleId;
    setStyleId(resolvedStyleId);
    writeStoredStyleId(definition, resolvedStyleId);
    appRef.current?.setStyle(resolvedStyleId);
    if (definition.id === 'fluid-tank') {
      const preset = FLUID_VISUAL_PRESETS[resolvedStyleId];
      if (preset) {
        for (const [key, value] of Object.entries(preset)) {
          appRef.current?.settings.set(key, value);
        }
        setSettingsVersion((v) => v + 1);
      }
    }
    if (definition.kind !== 'simulation') appRef.current?.settings.set('style', resolvedStyleId);
    if (definition.id === 'fluid-tank') appRef.current?.resetScene();
  }, [definition]);

  const handleImageUrlPrompt = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    const currentValue = app.settings.get('initImageUrl');
    const current = typeof currentValue === 'string' ? currentValue : '';
    setImageUrlDraft(current);
    setImageUrlEditorOpen(true);
  }, []);

  const applyImageUrlDraft = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    app.settings.set('initImageUrl', imageUrlDraft.trim());
    app.resetScene();
    setSettingsVersion((v) => v + 1);
    setImageUrlEditorOpen(false);
  }, [imageUrlDraft]);

  const handleOpenSettings = useCallback((event?: ReactMouseEvent) => {
    event?.stopPropagation();
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

  const randomizeWithDemoAi = useCallback(() => {
    appRef.current?.randomizeFromDemoAi();
    setSettingsVersion((v) => v + 1);
  }, []);

  const handleSaveDefaults = useCallback(async (request: SettingsDefaultsSaveRequest) => {
    const app = appRef.current;
    if (!app || !onSaveDefaults) return;
    const defaults: Record<string, unknown> = request.section === null
      ? { ...app.settings.getAll() }
      : { ...request.values };
    if (request.section === null) {
      if (definition.styleManifest) defaults.style = styleId;
      const renderStyle = app.settings.get(RENDER_STYLE_FIELD_KEY);
      if (typeof renderStyle === 'string') defaults[RENDER_STYLE_FIELD_KEY] = renderStyle;
      if (definition.id === 'fluid-tank') {
        const injectPalette = app.settings.get('injectPalette');
        if (typeof injectPalette === 'string') defaults.injectPalette = injectPalette;
      }
    }
    app.settings.setDefaults(defaults);
    await onSaveDefaults({
      definitionId: definition.id,
      section: request.section,
      defaults,
    });
    setSettingsVersion((v) => v + 1);
  }, [definition.id, definition.styleManifest, onSaveDefaults, styleId]);

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
  const settingsFields = useMemo(() => withCommonSimulationSettings(definition), [definition]);
  const renderStyleField = useMemo(() => getRenderStyleField(definition), [definition]);
  const renderStyleModes = useMemo(
    () => (renderStyleField?.options ?? []).map((option) => ({ id: option.value, label: option.label })),
    [renderStyleField],
  );
  const injectPaletteField = useMemo(
    () => definition.id === 'fluid-tank'
      ? settingsFields.find((field) => field.key === 'injectPalette' && field.type === 'select')
      : undefined,
    [definition.id, settingsFields],
  );
  const hasRenderStylePicker = renderStyleModes.length > 1;
  const isSimulation = definition.kind === 'simulation';
  const hasDemoRandomizer = isSimulation && Boolean((definition as SimulationExperience).demoAiFactory);
  const colorSchemeOptions = useMemo(
    () => (definition.styleManifest?.styles ?? []).map((style) => ({
      id: style.id,
      label: style.name,
      chipColors: style.id === '__random__' ? undefined : style.palette.slice(0, 4),
    })),
    [definition.styleManifest],
  );
  const colorSchemeControl = definition.styleManifest ? (
    <TopbarSelect
      label={definition.id === 'fluid-tank' ? 'Palette' : 'Color'}
      value={styleId}
      options={colorSchemeOptions}
      onChange={handleStyleChange}
    />
  ) : null;
  const fluidVisualStyleControl = definition.id === 'fluid-tank' ? (
    <ModeToggle
      modes={FLUID_VISUAL_STYLE_MODES}
      value={styleId === FLUID_ENHANCED_STYLE_ID ? FLUID_ENHANCED_STYLE_ID : FLUID_BASIC_STYLE_ID}
      onChange={handleStyleChange}
    />
  ) : null;
  const isFieldVisible = useCallback(
    (f: NonNullable<LabExperience['settingsFields']>[number]) =>
      (!f.visibleModes || f.visibleModes.includes(modeId))
      && (!f.visibleRenderStyles || f.visibleRenderStyles.includes(renderStyleId))
      && isEngineConfigurationVisible(f, renderSelection),
    [modeId, renderSelection, renderStyleId],
  );
  const visibleSettingsFields = useMemo(
    () => settingsFields.filter((field) => {
      if (field.key === RENDER_STYLE_FIELD_KEY) return false;
      if (definition.id === 'fluid-tank' && field.key === 'injectPalette') return false;
      return isFieldVisible(field);
    }),
    [definition.id, settingsFields, isFieldVisible],
  );
  const injectPaletteValue = appInstance?.settings.get('injectPalette');
  const injectPaletteId = typeof injectPaletteValue === 'string'
    ? injectPaletteValue
    : String(injectPaletteField?.default ?? 'style');
  const handleInjectPaletteChange = useCallback((value: string) => {
    appRef.current?.settings.set('injectPalette', value);
    setSettingsVersion((v) => v + 1);
  }, []);
  const hasImageInitUrlField = settingsFields.some((field) => field.key === 'initImageUrl');
  const imageUrlValue = appInstance?.settings.get('initImageUrl');
  const imageUrlIsSet = typeof imageUrlValue === 'string' && imageUrlValue.trim().length > 0;
  const imageSourceButton = definition.id === 'fluid-tank' && renderStyleId === 'image' && hasImageInitUrlField ? (
    <button
      type="button"
      onClick={handleImageUrlPrompt}
      className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
        imageUrlIsSet
          ? 'bg-emerald-300/18 text-emerald-50 hover:bg-emerald-300/26'
          : 'bg-white/10 text-white/55 hover:bg-white/16 hover:text-white/85'
      }`}
      aria-label="Set fluid image URL"
      title={imageUrlIsSet ? 'Image URL set' : 'Using random public image'}
    >
      <span>Image URL</span>
      <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[9px]">{imageUrlIsSet ? 'Set' : 'Random'}</span>
    </button>
  ) : null;
  const renderStyleControl = hasRenderStylePicker ? (
    definition.id === 'fluid-tank' ? (
      <TopbarSelect
        label="Texture"
        value={renderStyleId}
        options={renderStyleModes}
        onChange={handleRenderStyleChange}
      />
    ) : (
      <ModeToggle modes={renderStyleModes} value={renderStyleId} onChange={handleRenderStyleChange} />
    )
  ) : null;
  const injectPaletteControl = definition.id === 'fluid-tank' && injectPaletteField?.options?.length ? (
    <TopbarSelect
      label="Inject"
      value={injectPaletteId}
      options={injectPaletteField.options.map((option) => ({ id: option.value, label: option.label, chipStyle: fluidInjectChipStyle(option.value) }))}
      onChange={handleInjectPaletteChange}
    />
  ) : null;
  // Settings fields belong in the gear drawer. The runtime canvas should not get
  // duplicate top-of-scene tuning controls that compete with the experience.

  // On mobile portrait, style + mode are shown at the top of SimControlPanel instead of HUD/OverflowMenu.
  const controlsHeaderSlot =
    mobilePortrait && (definition.styleManifest || hasRenderStylePicker || hasModes) ? (
      <>
        {fluidVisualStyleControl}
        {colorSchemeControl}
        {renderStyleControl}
        {imageSourceButton}
        {injectPaletteControl}
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
  const defaultNumericFields = visibleSettingsFields.filter((f) => f.type === 'number');
  if (defaultNumericFields.length > 0) {
    introHints.push({ label: 'Settings', action: 'use the gear to tune physics and visual settings' });
  }

  return (
    <div className={`pixi-lab-runtime-shell fixed top-0 left-0 w-full h-full z-50 overflow-hidden${transparent ? '' : ' bg-black'}`}>
      <style>{RUNTIME_PERF_CSS}</style>
      {/* Game canvas — always mounted */}
      <GameRuntime
        definition={definition}
        userId={userId}
        mode={autoDemo && definition.capabilities.demo ? 'demo' : 'play'}
        renderSelection={renderSelection}
        quality={sceneLegacyQuality}
        experimentalRawEngine={experimentalRawEngine}
        transparent={transparent}
        maxPixels={localMaxPixels}
        onEvent={handleEvent}
        onReady={(app) => {
          appRef.current = app;
          setAppInstance(app);
          const storedRenderStyle = app.settings.get(RENDER_STYLE_FIELD_KEY);
          if (typeof storedRenderStyle === 'string' && renderStyleModes.some((mode) => mode.id === storedRenderStyle)) {
            setRenderStyleId(storedRenderStyle);
          } else if (renderStyleId) {
            app.settings.set(RENDER_STYLE_FIELD_KEY, renderStyleId);
          }
          const storedStyleId = readStoredStyleId(definition);
          if (storedStyleId) {
            setStyleId(storedStyleId);
            app.setStyle(storedStyleId);
          }
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
                attributions={definition.attributions}
                autoDismiss={infoAutoDismiss}
                onDismiss={() => setInfoCardVisible(false)}
              />
            )}
          </AnimatePresence>

          {/* HUD: quit + score/controls · score badge when controls present */}
          <HUD
            score={definition.capabilities.score ? score : undefined}
            gameStats={definition.capabilities.score ? gameStats : undefined}
            lives={lives}
            onQuit={handleQuit}
            controls={
              (definition.styleManifest && !mobilePortrait) || (hasRenderStylePicker && !mobilePortrait) || (hasModes && !mobilePortrait) ? (
                <div className="flex items-center gap-1.5">
                  {fluidVisualStyleControl}
                  {definition.styleManifest && !mobilePortrait && colorSchemeControl}
                  {hasRenderStylePicker && !mobilePortrait && renderStyleControl}
                  {imageSourceButton}
                  {injectPaletteControl}
                  {hasModes && (
                    <ModeToggle modes={definition.modes!} value={modeId} onChange={handleModeChange} />
                  )}
                </div>
              ) : undefined
            }
          />

          {/* Top-right controls: engine configuration, reset, settings, hide-ui, demo — adaptive via OverflowMenu */}
          <OverflowMenu
            items={[
              // On mobile portrait, color scheme + mode move from HUD center into the overflow sheet.
              {
                key: 'color-scheme',
                label: 'Color scheme',
                hidden: !definition.styleManifest || !mobilePortrait || !!controlsHeaderSlot,
                fullWidth: true,
                sectionLabel: 'Color scheme',
                node: definition.styleManifest ? (
                  <TopbarSelect
                    label="Color"
                    value={styleId}
                    options={colorSchemeOptions}
                    listMode
                    onChange={handleStyleChange}
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
                key: 'engine-configuration',
                label: 'Engine configuration',
                hidden: true,
                node: null,
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
                key: 'randomize',
                label: 'Randomize',
                hidden: !hasDemoRandomizer,
                node: (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={randomizeWithDemoAi}
                    aria-label="Randomize settings"
                    title="Randomize settings"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white/70 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
                  >
                    <Dices size={15} />
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
              fields={visibleSettingsFields}
              settingsVersion={settingsVersion}
              maxPixels={localMaxPixels}
              onMaxPixelsChange={handleMaxPixelsChange}
              onSaveDefaults={onSaveDefaults ? handleSaveDefaults : undefined}
            />
          )}

          <AnimatePresence>
            {imageUrlEditorOpen && (
              <motion.div
                className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/72 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setImageUrlEditorOpen(false);
                }}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Fluid image URL"
                  className="w-full max-w-xl rounded-2xl bg-zinc-950 p-4 shadow-2xl ring-1 ring-white/15"
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">Fluid image URL</h4>
                      <p className="mt-1 text-xs text-white/45">Paste a direct image URL. Leave blank to use a random public image.</p>
                    </div>
                    <button type="button" onClick={() => setImageUrlEditorOpen(false)} className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white" aria-label="Close URL editor">
                      <X size={16} />
                    </button>
                  </div>
                  <textarea
                    autoFocus
                    value={imageUrlDraft}
                    onChange={(event) => setImageUrlDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') applyImageUrlDraft();
                      if (event.key === 'Escape') setImageUrlEditorOpen(false);
                    }}
                    placeholder="https://example.com/image.png"
                    className="min-h-28 w-full resize-y rounded-xl bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 placeholder:text-white/30 focus:outline-none focus:ring-cyan-200/50"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => setImageUrlDraft('')} className="rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white">Clear</button>
                    <button type="button" onClick={() => setImageUrlEditorOpen(false)} className="rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white">Cancel</button>
                    <button type="button" onClick={applyImageUrlDraft} className="rounded-xl bg-cyan-200 px-3 py-2 text-sm font-bold text-black hover:bg-cyan-100">Apply URL</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile-only style/mode affordance; tweakable settings live in the gear drawer. */}
          {controlsHeaderSlot && (
            <SimControlPanel
              app={appInstance}
              fields={[]}
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

function pickRandomRenderStyle(options: Array<{ id: string; label: string }>): string {
  const candidates = options.filter((option) => option.id !== 'random');
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return pick?.id ?? options[0]?.id ?? '';
}

function pickRandomStyleId(styles: Array<{ id: string }>): string {
  const candidates = styles.filter((style) => style.id !== '__random__');
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return pick?.id ?? styles[0]?.id ?? '';
}

function fluidInjectChipStyle(value: string): CSSProperties {
  if (value === 'cyan') return { background: 'rgb(26, 255, 233)' };
  if (value === 'magenta') return { background: 'rgb(255, 31, 223)' };
  if (value === 'amber') return { background: 'rgb(255, 157, 21)' };
  if (value === 'green') return { background: 'rgb(31, 255, 59)' };
  if (value === 'blue') return { background: 'rgb(41, 92, 255)' };
  if (value === 'red') return { background: 'rgb(255, 41, 20)' };
  if (value === 'white') return { background: 'rgb(255, 255, 230)' };
  if (value === 'rainbow') {
    return {
      background:
        'conic-gradient(from 210deg, rgb(255, 77, 77), rgb(255, 184, 77), rgb(248, 255, 77), rgb(77, 255, 142), rgb(77, 216, 255), rgb(130, 77, 255), rgb(255, 77, 227), rgb(255, 77, 77))',
    };
  }
  return {
    background:
      'linear-gradient(135deg, rgb(53, 255, 229) 0%, rgb(77, 216, 255) 33%, rgb(255, 65, 220) 66%, rgb(255, 190, 74) 100%)',
  };
}
