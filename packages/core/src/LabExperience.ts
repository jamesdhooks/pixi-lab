/**
 * lib/games/types.ts
 *
 * GameDefinition — the single record each game must export.
 * Registered in components/games/registry.ts.
 * React-free; used by both the engine and the React shell.
 */
import type {
  DirectorEvent,
  AmbientBehaviorConfig,
  AmbientDataBinding,
  AmbientStyle,
  ExperienceCapabilities,
  ExperienceKind,
  ExperienceMode,
  ExperienceRenderMode,
  GameContext,
  GestureActionMap,
  SettingsField,
  SimStyleManifest,
  StagnationReport,
} from './types.js';
import type { Scene } from './Scene.js';
import type { AIController } from './ai/AIController.js';
import type { SimulationAI } from './ai/SimulationAI.js';

export interface TutorialPage {
  icon: string;
  title: string;
  body: string;
}

export interface LabExperienceBase {
  /** Stable slug — used as route param, score gameId, settings key, PNG fallback path */
  id: string;
  /** Experience family. Determines launcher chrome and default runtime affordances. */
  kind: ExperienceKind;
  /** Supported canvas/layout render modes. */
  renderModes?: ExperienceRenderMode[];
  /** Display name */
  name: string;
  /** One-liner for the home tile */
  short: string;
  /** Longer description for intro card */
  long: string;
  /** Tags for search / filtering */
  tags: string[];
  /** Single emoji for fallback icon */
  icon: string;
  /** Preferred palette name (from Styles registry) */
  paletteHint?: string;
  /** Which engine features this experience uses */
  capabilities: ExperienceCapabilities;
  /** Zod-free settings field definitions — rendered by SettingsDrawer */
  settingsFields?: SettingsField[];
  /** Extra engine-internal defaults (e.g. screensaverMs) not shown as UI fields */
  configDefaults?: Record<string, unknown>;
  /**
   * Named interaction modes surfaced as a top-center pill toggle in the launcher.
   * When defined, the launcher calls GameApp.setInteractionMode(id) on every change.
   * Scenes receive the change via Scene.setMode(id).
   */
  modes?: ExperienceMode[];
  /** Factory for the main gameplay scene */
  factory: (ctx: GameContext) => Scene;
  /** Factory for the small preview scene shown in the home tile (low-FPS, no audio) */
  previewFactory: (ctx: GameContext) => Scene;
  /** Path to static PNG fallback if preview scene perf is too low */
  previewFallback?: string;
  /** Style manifest for simulations and style-aware games/toys */
  styleManifest?: SimStyleManifest;
  /** Maps shared gesture events onto experience-specific actions */
  gestureMap?: GestureActionMap;
  /** Ambient director events available while the experience is idle */
  directorEvents?: DirectorEvent[];
  /** Optional declaration used by tooling and docs to explain stagnation recovery */
  stagnationPolicy?: StagnationReport;
  /** Stable default seed for reproducible previews and demos */
  defaultSeed?: number;
  /** Tutorial pages shown before first play */
  tutorialPages?: TutorialPage[];
  /**
   * Optional mobile HUD override. When undefined, all controls move to the overflow
   * menu on portrait phone. Use this only for experiences that need specific items
   * pinned to the HUD regardless of screen size.
   */
  mobileHUD?: {
    /** Items to keep in the HUD on portrait phone (default: all go to overflow menu). */
    keepInHUD?: ('modes' | 'style' | 'quality' | 'reset')[];
  };
}

export interface GameExperience extends LabExperienceBase {
  kind: 'game';
  /** Factory for AI controller (required when capabilities.aiAutoplay = true) */
  aiFactory?: (ctx: GameContext) => AIController;
  /** Factory for screensaver scene (required when capabilities.screensaver = true) */
  screensaverFactory?: (ctx: GameContext) => Scene;
}

export interface SimulationExperience extends LabExperienceBase {
  kind: 'simulation';
  styleManifest: SimStyleManifest;
  directorEvents: DirectorEvent[];
  /** Factory for the demo-mode AI. Required when `capabilities.demo` is true. */
  demoAiFactory?: (ctx: GameContext) => SimulationAI;
}

export interface AmbientExperience extends LabExperienceBase {
  kind: 'ambient';
  renderModes: ExperienceRenderMode[];
  dataBindings: AmbientDataBinding[];
  behavior: AmbientBehaviorConfig;
  styles: AmbientStyle[];
}

export interface EffectExperience extends LabExperienceBase {
  kind: 'effect';
  renderModes: ExperienceRenderMode[];
}

export interface ToyExperience extends LabExperienceBase {
  kind: 'toy';
}

export type LabExperience =
  | GameExperience
  | SimulationExperience
  | AmbientExperience
  | EffectExperience
  | ToyExperience;

export type GameDefinition = GameExperience;
export type SimulationDefinition = SimulationExperience;
export type AmbientDefinition = AmbientExperience;
export type EffectDefinition = EffectExperience;
