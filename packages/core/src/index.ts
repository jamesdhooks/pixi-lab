/**
 * packages/core/src/index.ts
 *
 * Public API barrel for @hooksjam/pixi-lab-core.
 */

// Core runtime
export { GameApp, type GameAppOptions } from './GameApp.js';
export { Scene } from './Scene.js';
export { Ticker, PHYSICS_HZ } from './Ticker.js';
export { Input } from './Input.js';
export { Audio } from './Audio.js';
export { Settings } from './Settings.js';
export { Telemetry } from './Telemetry.js';

// Experience definition
export type {
  GameDefinition,
  GameExperience,
  LabExperience,
  LabExperienceBase,
  AmbientDefinition,
  AmbientExperience,
  EffectDefinition,
  EffectExperience,
  SimulationDefinition,
  SimulationExperience,
  ToyExperience,
  TutorialPage,
} from './LabExperience.js';

// Types
export type {
  Vec2,
  Rect,
  RGBA,
  GameMode,
  RendererBackend,
  RenderProfile,
  RenderQuality,
  ExperienceKind,
  ExperienceRenderMode,
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
  EngineConfiguration,
  ExperienceMode,
  AmbientDataSource,
  AmbientDataBinding,
  AmbientBehaviorConfig,
  AmbientStyle,
  AmbientDataSnapshot,
  AmbientDataAdapter,
  BurstEffectKind,
  BurstEffectMode,
  BurstEffect,
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
} from './types.js';
export { DEFAULT_AMBIENT_BEHAVIOR, DEFAULT_FOREGROUND_BEHAVIOR } from './types.js';

// Physics
export { PhysicsWorld } from './physics/World.js';
export { Categories, Masks } from './physics/Categories.js';
export { Pool } from './physics/Pool.js';
export {
  createCircleBody,
  createBoxBody,
  createEdgeWall,
  createBoundaryWalls,
  destroyBody,
  PHYSICS_SCALE,
  PX_TO_M,
  M_TO_PX,
} from './physics/Bodies.js';

// Render
export { PixiApp } from './render/PixiApp.js';
export { Graphics } from 'pixi.js';
export { SpriteFactory } from './render/Sprites.js';
export { ParticleSystem } from './render/Particles.js';
export { styleRegistry, PALETTES, DEFAULT_STYLE } from './render/Styles.js';
export { RenderTargetPool, type RenderTargetRequest, type RenderTargetStats } from './render/RenderTargetPool.js';
export { PingPong } from './render/PingPong.js';
export { RenderStyleManager } from './render/RenderStyleManager.js';
export {
  createEngineConfigurations,
  DEFAULT_RENDER_QUALITY_MODES,
  LEGACY_RENDER_QUALITY_STORAGE_KEY,
  RENDER_SELECTION_STORAGE_KEY,
  formatRenderBackendProfileSelection,
  getSupportedEngineConfigurations,
  getSupportedLegacyRenderQualities,
  getSupportedRenderQualityModes,
  groupBackendProfileCandidates,
  groupLegacyQualitiesByBackend,
  groupQualityModesByBackend,
  isDefaultRenderBackendProfileSelection,
  isEngineConfigurationVisible,
  isRenderProfile,
  isRenderQuality,
  isRendererBackend,
  mapLegacyQualitiesToBackendProfileCandidates,
  mapQualityModesToBackendProfiles,
  parseRenderBackendProfileStorage,
  resolveEngineConfigurationQuerySelection,
  resolveEngineConfigurationStorageSelection,
  resolveEngineConfigurationSelection,
  resolveRenderBackendProfileQuerySelection,
  resolveRenderBackendProfileSelection,
  resolveRenderBackendProfileStorageSelection,
  sanitizeLegacyQualityForEngineConfigurations,
  sanitizeLegacyRenderQuality,
  serializeRenderBackendProfileRoute,
  serializeRenderBackendProfileStorage,
  toEngineConfiguration,
  toRenderBackendProfileCandidate,
  type RenderBackendProfileCandidate,
  type RenderBackendProfileGroup,
  type RenderBackendProfileQueryRequest,
  type RenderBackendProfileRouteParams,
  type RenderBackendProfileSelection,
  type RenderBackendProfileSelectionLabel,
  type RenderBackendProfileStorageSnapshot,
  type SerializeRenderBackendProfileRouteOptions,
} from './runtime/RenderBackendProfile.js';
export { SimulationCanvasLayer } from './render/SimulationCanvasLayer.js';
export type { EmitterMarker } from './render/SimulationCanvasLayer.js';
export { FieldPaletteRenderer, type FieldPaletteRenderOptions } from './render/FieldPaletteRenderer.js';
export { ParticlePointRenderer, type ParticlePointRenderOptions } from './render/ParticlePointRenderer.js';
export { TrailFeedbackRenderer, type TrailFeedbackRenderOptions } from './render/TrailFeedbackRenderer.js';
export { DensityMetaballRenderer, type DensityMetaballRenderOptions } from './render/DensityMetaballRenderer.js';
export { MeshLatticeRenderer, type MeshLatticeRenderOptions } from './render/MeshLatticeRenderer.js';
export { ArcLineRenderer, type ArcLineRenderOptions } from './render/ArcLineRenderer.js';
export { EmitterMarkerRenderer } from './render/EmitterMarkerRenderer.js';
export { ProceduralTextureLibrary, type ProceduralTextureId } from './render/procedural/ProceduralTextureLibrary.js';
export { createSharedPass, SHARED_RENDER_PASS_IDS } from './render/passes/SharedPasses.js';
export { NoopRenderPass, type RenderPass, type RenderPassContext } from './render/passes/RenderPass.js';
export {
  RawWebGL2Scene,
  colorNumberToRgb,
  compileRawWebGL2Shader,
  finiteNumberSetting,
  linkRawWebGL2Program,
  type RawWebGL2ProgramSources,
  type RawWebGL2RenderState,
  type RawWebGL2SceneOptions,
} from './render/raw/RawWebGL2Scene.js';

// Simulation primitives
export { SimulationScene } from './sim/SimulationScene.js';
export {
  DomScriptScene,
  type DomSceneOptions,
  type DomMountContext,
  type DomStylePayload,
} from './sim/DomScriptScene.js';
export {
  DomScriptQualityAdapter,
  type DomScriptQualityAdapterOptions,
  type DomScriptQualitySwitchResult,
} from './sim/DomScriptQualityAdapter.js';
export { ScalarField } from './sim/fields/ScalarField.js';
export { DensityField } from './sim/fields/DensityField.js';
export { TrailField } from './sim/fields/TrailField.js';
export { VectorField } from './sim/fields/VectorField.js';
export { TriangularGrid, type TriangularGridCell } from './sim/grids/TriangularGrid.js';
export { SpringSystem, type SpringEdge, type SpringNode } from './sim/springs/SpringSystem.js';
export { SimParticleSystem, type SimParticle } from './sim/particles/SimParticleSystem.js';
export { GestureInterpreter, type GestureInterpreterOptions } from './gestures/GestureInterpreter.js';
export { PerformanceGovernor, type PerformanceGovernorOptions } from './performance/PerformanceGovernor.js';
export { DirectorMode } from './director/DirectorMode.js';
export { StagnationRecovery, type StagnationAware } from './stagnation/StagnationRecovery.js';
export { DebugOverlay, type DebugOverlayState } from './debug/DebugOverlay.js';
export { StyleExporter } from './style/StyleExporter.js';
export { SeededRng } from './utils/SeededRng.js';

// Ambient and reusable effects
export { AmbientDataManager } from './ambient/AmbientDataManager.js';
export { BurstEmitterSystem } from './fx/BurstEmitterSystem.js';
export type { EffectEmitter } from './fx/EffectEmitter.js';
export { BaseEffectEmitter } from './fx/EffectEmitter.js';
export { SparkEmitter } from './fx/emitters/SparkEmitter.js';
export { FireworkEmitter } from './fx/emitters/FireworkEmitter.js';
export { EmberEmitter } from './fx/emitters/EmberEmitter.js';
export { ConfettiEmitter } from './fx/emitters/ConfettiEmitter.js';
export { FireflyEmitter } from './fx/emitters/FireflyEmitter.js';
export { SmokeEmitter } from './fx/emitters/SmokeEmitter.js';
export { ArcSparkEmitter } from './fx/emitters/ArcSparkEmitter.js';

// AI
export type { AIController, AIContext } from './ai/AIController.js';
export type { SimulationAI, SimAIContext } from './ai/SimulationAI.js';
export { BasicAI } from './ai/BasicAI.js';
export { DemoAI } from './ai/DemoAI.js';

// Screensaver
export { ScreensaverManager } from './screensaver/ScreensaverManager.js';

// Scoring
export type { HighScoreProvider, SubmitScoreInput } from './scoring/HighScoreProvider.js';
export { ApiHighScoreProvider, NoopHighScoreProvider } from './scoring/HighScoreProvider.js';
export { NameSuggestions, nameSuggestions } from './scoring/NameSuggestions.js';
