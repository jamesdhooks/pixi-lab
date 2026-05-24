/**
 * packages/core/src/index.ts
 *
 * Public API barrel for @hooksjam/pixi-lab-core.
 */

// Core runtime
export { GameApp, type GameAppOptions } from './GameApp';
export { Scene } from './Scene';
export { Ticker, PHYSICS_HZ } from './Ticker';
export { Input } from './Input';
export { Audio } from './Audio';
export { Settings } from './Settings';
export { Telemetry } from './Telemetry';

// Experience definition
export type { GameDefinition, TutorialPage } from './LabExperience';

// Types
export type {
  Vec2,
  Rect,
  RGBA,
  GameMode,
  GameEvent,
  GameEventKind,
  GameContext,
  InputSnapshot,
  PointerEvent as GamePointerEvent,
  InputSourceKind,
  BodyUserData,
  BodyHandle,
  PixiDisplayObject,
  IntentKind,
  Intent,
  GamePalette,
  StyleConfig,
  ShaderPreset,
  ScoreEntry,
  SettingsValue,
  SettingsField,
  GameCapabilities,
} from './types';

// Physics
export { PhysicsWorld } from './physics/World';
export { Categories, Masks } from './physics/Categories';
export { Pool } from './physics/Pool';
export {
  createCircleBody,
  createBoxBody,
  createEdgeWall,
  createBoundaryWalls,
  destroyBody,
  PHYSICS_SCALE,
  PX_TO_M,
  M_TO_PX,
} from './physics/Bodies';

// Render
export { PixiApp } from './render/PixiApp';
export { SpriteFactory } from './render/Sprites';
export { ParticleSystem } from './render/Particles';
export { styleRegistry, PALETTES, DEFAULT_STYLE } from './render/Styles';

// AI
export type { AIController, AIContext } from './ai/AIController';
export { BasicAI } from './ai/BasicAI';
export { DemoAI } from './ai/DemoAI';

// Screensaver
export { ScreensaverManager } from './screensaver/ScreensaverManager';

// Scoring
export type { HighScoreProvider, SubmitScoreInput } from './scoring/HighScoreProvider';
export { ApiHighScoreProvider, NoopHighScoreProvider } from './scoring/HighScoreProvider';
export { NameSuggestions, nameSuggestions } from './scoring/NameSuggestions';
