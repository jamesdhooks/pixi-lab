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
export type {
  GameDefinition,
  GameExperience,
  LabExperience,
  LabExperienceBase,
  SimulationDefinition,
  SimulationExperience,
  ToyExperience,
  TutorialPage,
} from './LabExperience';

// Types
export type {
  Vec2,
  Rect,
  RGBA,
  GameMode,
  RenderQuality,
  ExperienceKind,
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
  ExperienceCapabilities,
  GestureActionMap,
  GestureEvent,
  GestureKind,
  RenderPassId,
  SimRenderCapabilities,
  SimRenderLayers,
  SimStyle,
  SimStyleManifest,
  StagnationReport,
  DirectorEvent,
  StyleExportSnapshot,
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
export { RenderTargetPool, type RenderTargetRequest, type RenderTargetStats } from './render/RenderTargetPool';
export { PingPong } from './render/PingPong';
export { RenderStyleManager } from './render/RenderStyleManager';
export { SimulationCanvasLayer } from './render/SimulationCanvasLayer';
export { ProceduralTextureLibrary, type ProceduralTextureId } from './render/procedural/ProceduralTextureLibrary';
export { createSharedPass, SHARED_RENDER_PASS_IDS } from './render/passes/SharedPasses';
export { NoopRenderPass, type RenderPass, type RenderPassContext } from './render/passes/RenderPass';

// Simulation primitives
export { SimulationScene } from './sim/SimulationScene';
export { ScalarField } from './sim/fields/ScalarField';
export { DensityField } from './sim/fields/DensityField';
export { TrailField } from './sim/fields/TrailField';
export { VectorField } from './sim/fields/VectorField';
export { TriangularGrid, type TriangularGridCell } from './sim/grids/TriangularGrid';
export { SpringSystem, type SpringEdge, type SpringNode } from './sim/springs/SpringSystem';
export { SimParticleSystem, type SimParticle } from './sim/particles/SimParticleSystem';
export { GestureInterpreter, type GestureInterpreterOptions } from './gestures/GestureInterpreter';
export { PerformanceGovernor, type PerformanceGovernorOptions } from './performance/PerformanceGovernor';
export { DirectorMode } from './director/DirectorMode';
export { StagnationRecovery, type StagnationAware } from './stagnation/StagnationRecovery';
export { DebugOverlay, type DebugOverlayState } from './debug/DebugOverlay';
export { StyleExporter } from './style/StyleExporter';
export { SeededRng } from './utils/SeededRng';

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
