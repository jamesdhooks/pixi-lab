/**
 * lib/games/types.ts
 *
 * GameDefinition — the single record each game must export.
 * Registered in components/games/registry.ts.
 * React-free; used by both the engine and the React shell.
 */
import type { GameContext, GameCapabilities, SettingsField } from './types';
import type { Scene } from './Scene';
import type { AIController } from './ai/AIController';

export interface TutorialPage {
  icon: string;
  title: string;
  body: string;
}

export interface GameDefinition {
  /** Stable slug — used as route param, score gameId, settings key, PNG fallback path */
  id: string;
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
  /** Which engine features this game uses */
  capabilities: GameCapabilities;
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
  /** Factory for AI controller (required when capabilities.aiAutoplay = true) */
  aiFactory?: (ctx: GameContext) => AIController;
  /** Factory for screensaver scene (required when capabilities.screensaver = true) */
  screensaverFactory?: (ctx: GameContext) => Scene;
  /** Tutorial pages shown before first play */
  tutorialPages?: TutorialPage[];
}
