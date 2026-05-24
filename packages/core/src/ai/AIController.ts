/**
 * packages/core/src/ai/AIController.ts
 *
 * Interface for all AI auto-play controllers.
 * Games implement this to provide heuristic players.
 * The engine calls think() each update tick, then injects returned intents
 * into Input — so game logic sees no difference between human and AI input.
 */
import type { Intent } from '../types';

export interface AIContext {
  /** Current game-world width in pixels */
  width: number;
  /** Current game-world height in pixels */
  height: number;
  /** Elapsed seconds since last call */
  dt: number;
  /** Arbitrary game state the controller can read */
  state: Record<string, unknown>;
}

export interface AIController {
  /** Called every update tick. Return intents to inject into the input queue. */
  think(ctx: AIContext): Intent[];
  /** Called when the game resets; clear any internal state. */
  reset(): void;
}
