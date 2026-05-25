import type { GestureEvent } from '../types';

export interface SimAIContext {
  width: number;
  height: number;
  dt: number;
  elapsedTime: number;
  /** Style IDs available in the simulation (excludes __random__). */
  styleIds: readonly string[];
  /** Apply a style change directly without going through gestures. */
  applyStyle: (styleId: string) => void;
  /** Update a numeric settings key directly (bypasses gesture system). */
  applyNumericSetting: (key: string, value: number) => void;
  /** Trigger a full scene reset — clears all emitters and re-initialises state. */
  resetScene: () => void;
  /** Clear emitters only, preserving the visual field. Falls back to resetScene if not implemented. */
  clearEmittersOnly?: () => void;
}

/** AI that operates a simulation in demo mode by generating synthetic gesture events. */
export interface SimulationAI {
  /**
   * Called once when demo mode is activated. Use this to set an initial random
   * style, settings, and emitter layout without waiting for the first tick.
   */
  onActivate?(ctx: SimAIContext): void;
  think(ctx: SimAIContext): GestureEvent[];
  reset(): void;
}
