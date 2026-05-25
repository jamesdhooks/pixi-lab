/**
 * lib/games/types.ts
 *
 * GameDefinition — the single record each game must export.
 * Registered in components/games/registry.ts.
 * React-free; used by both the engine and the React shell.
 */
import type {
  DirectorEvent,
  ExperienceCapabilities,
  ExperienceKind,
  GameContext,
  GestureActionMap,
  SettingsField,
  SimStyleManifest,
  StagnationReport,
} from './types';
import type { Scene } from './Scene';
import type { AIController } from './ai/AIController';

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
  settingsFields: SettingsField[];
  /** Default values for settings fields (keyed by field.key) */
  configDefaults: Record<string, unknown>;
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
}

export interface ToyExperience extends LabExperienceBase {
  kind: 'toy';
}

export type LabExperience = GameExperience | SimulationExperience | ToyExperience;

export type GameDefinition = GameExperience;
export type SimulationDefinition = SimulationExperience;
