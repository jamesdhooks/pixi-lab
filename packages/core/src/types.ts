/**
 * packages/core/src/types.ts
 *
 * Shared types for the pixi-lab core engine.
 * No framework imports — pure TypeScript.
 * Subsystem references use `import type` (erased at runtime, no circular dep).
 */
import type { Body as PlanckBody } from 'planck';
import type { PhysicsWorld } from './physics/World.js';
import type { PixiApp } from './render/PixiApp.js';
import type { SpriteFactory } from './render/Sprites.js';
import type { ParticleSystem } from './render/Particles.js';
import type { Audio } from './Audio.js';
import type { Settings } from './Settings.js';

// ── Primitives ────────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

// ── Runtime mode ──────────────────────────────────────────────────────────────

export type GameMode = 'play' | 'screensaver' | 'demo' | 'paused';

/**
 * Rendering backend selected by the host or an experience-specific adapter.
 * Pixi remains the default backend for the shared Lab Runtime; higher-powered
 * backends are opt-in per experience rather than global quality levels.
 */
export type RendererBackend = 'pixi' | 'webgl2' | 'three' | 'webgpu';

/**
 * Budget/profile hint within a backend. Profiles describe runtime cost/intent;
 * they should not imply a different rendering engine by themselves.
 */
export type RenderProfile = 'preview' | 'standard' | 'high';

/**
 * Legacy quality selector used by existing scenes and demo routes. Keep `raw`
 * scoped to experiences that explicitly advertise it while migration moves new
 * runtime-facing code toward RendererBackend + RenderProfile terminology.
 */
export type RenderQuality = 'basic' | 'enhanced' | 'raw';
export type ExperienceKind = 'game' | 'simulation' | 'ambient' | 'effect' | 'toy';
export type ExperienceRenderMode =
  | 'fullscreen'
  | 'background'
  | 'foregroundOverlay'
  | 'widget'
  | 'previewTile';

// ── Input ─────────────────────────────────────────────────────────────────────

export type InputSourceKind = 'human' | 'ai';

export interface PointerEvent {
  id: number; // touch/pointer identifier
  x: number;
  y: number;
  type: 'down' | 'move' | 'up' | 'cancel';
  source: InputSourceKind;
  timestamp: number;
}

export interface InputSnapshot {
  pointers: Map<number, PointerEvent>;
  justDown: Set<number>;
  justUp: Set<number>;
}

export type GestureKind =
  | 'tap'
  | 'drag'
  | 'hold'
  | 'fast_swipe'
  | 'double_tap'
  | 'pinch'
  | 'spread';

export interface GestureEvent {
  kind: GestureKind;
  x: number;
  y: number;
  id?: number;
  x2?: number;
  y2?: number;
  dx?: number;
  dy?: number;
  velocity?: number;
  durationMs?: number;
  strength?: number;
  timestamp: number;
}

export type GestureActionMap = Partial<Record<GestureKind, string>>;

// ── Physics ───────────────────────────────────────────────────────────────────

export interface BodyUserData {
  id: string;
  kind: 'ball' | 'wall' | 'bumper' | 'sensor' | 'player' | 'custom';
  isSensor?: boolean;
  [key: string]: unknown;
}

export interface BodyHandle {
  id: string;
  /** Underlying planck body */
  body: PlanckBody;
  userData: BodyUserData;
  /** If true this handle is back in the pool and should not be used */
  pooled: boolean;
  /** Sync position/angle of this body to a Pixi container */
  sync: (sprite: PixiDisplayObject) => void;
}

export type PixiDisplayObject = {
  x: number;
  y: number;
  rotation: number;
};

// ── AI ────────────────────────────────────────────────────────────────────────

export type IntentKind = 'tap' | 'drag_start' | 'drag_move' | 'drag_end' | 'hold' | 'release';

export interface Intent {
  kind: IntentKind;
  /**
   * Stable pointer id for multi-frame AI gestures. Omit for one-shot intents
   * like tap; drag_start/drag_move/drag_end should share the same id.
   */
  id?: number;
  x: number;
  y: number;
  /** Optional second point for drag operations */
  x2?: number;
  y2?: number;
  /** Meta payload for game-specific intents */
  meta?: Record<string, unknown>;
}

// ── Styles ────────────────────────────────────────────────────────────────────

export interface GamePalette {
  name: string;
  background: number; // 0xRRGGBB
  ballColors: number[];
  accentColor: number;
  textColor: string; // CSS color for HTML overlays
}

export type ShaderPreset = 'none' | 'bloom' | 'crt' | 'scanlines';

export type RenderPassId =
  | 'primitive'
  | 'paletteMap'
  | 'densityMetaball'
  | 'gpuFluid'
  | 'edgeGlow'
  | 'trailFeedback'
  | 'fieldVisualize'
  | 'bloom'
  | 'distortion'
  | 'chromaticAberration'
  | 'normalLighting'
  | 'contourBands'
  | 'shockwave'
  | 'colorGrade'
  | 'composite';

export interface StyleConfig {
  palette: GamePalette;
  shader: ShaderPreset;
  particleOpacity: number; // 0-1
}

export interface StyleUniform {
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
}

export interface SimStyle {
  id: string;
  name: string;
  description?: string;
  palette: number[];
  background: number;
  passes: RenderPassId[];
  uniforms: Record<string, number | string | boolean>;
  uniformSchema?: StyleUniform[];
}

export interface SimRenderCapabilities {
  renderLayers: Array<keyof SimRenderLayers>;
  passes: RenderPassId[];
  qualities: RenderQuality[];
}

export interface SimStyleManifest {
  defaultStyleId: string;
  capabilities: SimRenderCapabilities;
  styles: SimStyle[];
}

export interface SimRenderLayers {
  primitive?: unknown;
  particles?: unknown;
  density?: unknown;
  fluid?: unknown;
  trails?: unknown;
  field?: unknown;
  mask?: unknown;
  glow?: unknown;
  debug?: unknown;
}

export interface DirectorEvent {
  id: string;
  label: string;
  minIntervalMs: number;
  maxIntervalMs: number;
  intensity?: number;
}

export interface StagnationReport {
  stagnant: boolean;
  reason?: string;
  severity: number;
  observedForMs?: number;
}

export interface StyleExportSnapshot {
  experienceId: string;
  styleId: string;
  seed: number;
  quality: RenderQuality;
  uniforms: Record<string, number | string | boolean>;
}

// ── Ambient Experiences ──────────────────────────────────────────────────────

export type AmbientDataSource =
  | 'time'
  | 'weather'
  | 'calendar'
  | 'homeAssistant'
  | 'media'
  | 'photos'
  | 'tasks'
  | 'presence'
  | 'synthetic';

export interface AmbientDataBinding {
  source: AmbientDataSource;
  optional: boolean;
  fallback: 'synthetic' | 'idle' | 'disabled';
}

export interface AmbientBehaviorConfig {
  idleSafe: boolean;
  supportsLowMotion: boolean;
  supportsSleepMode: boolean;
  supportsTransparency: boolean;
  maxBrightness: number;
  maxParticleCount: number;
  maxUpdateHz: number;
  allowForeground: boolean;
  allowBackground: boolean;
}

export type AmbientStyle = SimStyle;

export interface AmbientDataSnapshot {
  source: AmbientDataSource;
  timestamp: number;
  values: Record<string, number | string | boolean>;
}

export interface AmbientDataAdapter {
  readonly source: AmbientDataSource;
  getSnapshot(): AmbientDataSnapshot;
}

export const DEFAULT_AMBIENT_BEHAVIOR: AmbientBehaviorConfig = {
  idleSafe: true,
  supportsLowMotion: true,
  supportsSleepMode: true,
  supportsTransparency: true,
  maxBrightness: 0.65,
  maxParticleCount: 3000,
  maxUpdateHz: 30,
  allowForeground: false,
  allowBackground: true,
};

export const DEFAULT_FOREGROUND_BEHAVIOR: AmbientBehaviorConfig = {
  idleSafe: true,
  supportsLowMotion: true,
  supportsSleepMode: true,
  supportsTransparency: true,
  maxBrightness: 0.45,
  maxParticleCount: 1000,
  maxUpdateHz: 30,
  allowForeground: true,
  allowBackground: false,
};

// ── Reusable FX / Burst Emitters ─────────────────────────────────────────────

export type BurstEffectKind =
  | 'spark'
  | 'firework'
  | 'ember'
  | 'confetti'
  | 'plasma'
  | 'ash'
  | 'smoke'
  | 'firefly'
  | 'arcSpark';

export type BurstEffectMode = 'foreground' | 'background' | 'simulationLayer';

export interface BurstEffect {
  id?: string;
  kind: BurstEffectKind;
  x: number;
  y: number;
  count: number;
  energy: number;
  duration?: number;
  paletteId?: string;
  palette?: number[];
  seed?: number;
  mode?: BurstEffectMode;
  options?: Record<string, number | string | boolean>;
}

// ── Score ─────────────────────────────────────────────────────────────────────

export interface ScoreEntry {
  gameId: string;
  userId?: string;
  playerName?: string;
  score: number;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export type SettingsValue = string | number | boolean;

export interface SettingsField {
  key: string;
  label: string;
  description?: string;
  type: 'number' | 'boolean' | 'select' | 'string';
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
  default: SettingsValue;
  /** If set, the field is only shown when the active interaction mode is in this list. */
  visibleModes?: string[];
}

// ── Game Definition ───────────────────────────────────────────────────────────

/** A named interaction mode advertised by a game or simulation. */
export interface ExperienceMode {
  id: string;
  /** Short display label shown in the mode toggle pill */
  label: string;
  /** Emoji or unicode glyph shown in the pill button */
  icon?: string;
  /** Tooltip / aria description */
  description?: string;
}

export interface GameCapabilities {
  score?: boolean;
  aiAutoplay?: boolean;
  screensaver?: boolean;
  tutorial?: boolean;
  interactive?: boolean;
  ambient?: boolean;
  gestures?: boolean;
  directorMode?: boolean;
  stagnationRecovery?: boolean;
  debugOverlay?: boolean;
  styleExport?: boolean;
  proceduralTextures?: boolean;
  renderTargetPool?: boolean;
  ambientLayer?: boolean;
  foregroundOverlay?: boolean;
  burstEmitters?: boolean;
  lowMotion?: boolean;
  sleepMode?: boolean;
  qualityModes?: RenderQuality[];
  /** Scene supports a reset action (drain + restart cycle). */
  reset?: boolean;
  /** Simulation supports a demo mode with an AI controller. */
  demo?: boolean;
  /** Set to false to hide the settings button (e.g. when all settings are visible in the top bar). */
  settings?: boolean;
}

export type ExperienceCapabilities = GameCapabilities;

export interface UISlot {
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  center?: React.ReactNode;
  bottomBanner?: React.ReactNode;
}

// ── GameContext ────────────────────────────────────────────────────────────────

/**
 * The shared context passed to every Scene. Never null inside a mounted game.
 * Populated by GameApp on first Scene.onEnter.
 */
export interface GameSystems {
  world: PhysicsWorld;
  pixi: PixiApp;
  sprites: SpriteFactory;
  particles: ParticleSystem;
  audio: Audio;
  settings: Settings;
  renderTargets?: import('./render/RenderTargetPool').RenderTargetPool;
  styleManager?: import('./render/RenderStyleManager').RenderStyleManager;
  gestures?: import('./gestures/GestureInterpreter').GestureInterpreter;
  governor?: import('./performance/PerformanceGovernor').PerformanceGovernor;
  director?: import('./director/DirectorMode').DirectorMode;
  stagnation?: import('./stagnation/StagnationRecovery').StagnationRecovery;
  debug?: import('./debug/DebugOverlay').DebugOverlay;
  procedural?: import('./render/procedural/ProceduralTextureLibrary').ProceduralTextureLibrary;
  burstEmitters?: import('./fx/BurstEmitterSystem').BurstEmitterSystem;
  ambientData?: import('./ambient/AmbientDataManager').AmbientDataManager;
}

export interface GameContext {
  mode: GameMode;
  seed: number;
  quality: RenderQuality;
  /** Canvas dimensions in logical pixels */
  width: number;
  height: number;
  /** Engine subsystems — set by GameApp after init() */
  systems: GameSystems;
  /** Emits game events upward to the React shell */
  emit: (event: GameEvent) => void;
}

export type GameEventKind =
  | 'score_update'
  | 'lives_update'
  | 'game_over'
  | 'paused'
  | 'resumed'
  | 'screensaver_enter'
  | 'screensaver_exit'
  | 'quality_change'
  | 'style_change'
  | 'setting_change'
  | 'director_event'
  | 'stagnation_recovery'
  | 'burst_effect'
  | 'error';

export interface GameEvent {
  kind: GameEventKind;
  value?: number;
  payload?: Record<string, unknown>;
}

// ── React declarations (kept minimal so engine stays React-free) ─────────────

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace React {
  type ReactNode = unknown;
}
