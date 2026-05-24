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

export interface StyleConfig {
  palette: GamePalette;
  shader: ShaderPreset;
  particleOpacity: number; // 0-1
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
}

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
}

export interface GameContext {
  mode: GameMode;
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
