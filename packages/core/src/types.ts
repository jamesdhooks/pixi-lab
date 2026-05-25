/**
 * packages/core/src/types.ts
 *
 * Shared types for the pixi-lab core engine.
 * No framework imports — pure TypeScript.
 * Subsystem references use `import type` (erased at runtime, no circular dep).
 */
import type { Body as PlanckBody } from 'planck';
import type { PhysicsWorld } from './physics/World';
import type { PixiApp } from './render/PixiApp';
import type { SpriteFactory } from './render/Sprites';
import type { ParticleSystem } from './render/Particles';
import type { Audio } from './Audio';
import type { Settings } from './Settings';

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
export type RenderQuality = 'basic' | 'enhanced' | 'ultra';
export type ExperienceKind = 'game' | 'simulation' | 'toy';

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
  type: 'number' | 'boolean' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string }[];
  default: SettingsValue;
}

// ── Game Definition ───────────────────────────────────────────────────────────

export interface GameCapabilities {
  score: boolean;
  aiAutoplay: boolean;
  screensaver: boolean;
  tutorial: boolean;
  interactive?: boolean;
  ambient?: boolean;
  gestures?: boolean;
  directorMode?: boolean;
  stagnationRecovery?: boolean;
  debugOverlay?: boolean;
  styleExport?: boolean;
  proceduralTextures?: boolean;
  renderTargetPool?: boolean;
  qualityModes?: RenderQuality[];
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
  | 'director_event'
  | 'stagnation_recovery'
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
