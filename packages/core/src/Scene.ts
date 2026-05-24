/**
 * packages/core/src/Scene.ts
 *
 * Abstract base class for all game scenes.
 * Scenes are the unit of gameplay — one scene per game state
 * (e.g. BallPitScene, IntroScene, GameOverScene).
 *
 * Lifecycle:
 *   onEnter → [update* + fixedUpdate* + resize*] → onExit
 */
import type { GameContext } from './types';
import type { Input } from './Input';

export abstract class Scene {
  /** Display name shown in the dev overlay */
  abstract readonly name: string;

  /** GameApp sets this before calling onEnter */
  protected ctx!: GameContext;
  protected input!: Input;

  /**
   * Called by GameApp when this scene becomes active.
   * Perform setup: add sprites, start physics, etc.
   */
  abstract onEnter(ctx: GameContext, input: Input): void;

  /**
   * Called by GameApp when this scene is being replaced.
   * Perform teardown: remove sprites, clear listeners.
   */
  abstract onExit(): void;

  /**
   * Called once per render frame (variable dt).
   * Use for visual effects, animations, AI ticks.
   */
  update(_dt: number): void {
    // Optional override
  }

  /**
   * Called at fixed PHYSICS_HZ rate (60 Hz by default).
   * Use for physics integration and game logic that depends on physics.
   */
  fixedUpdate(_dt: number): void {
    // Optional override
  }

  /**
   * Called after update when the Pixi stage needs to be synced.
   * Use for physics body → sprite sync.
   */
  render(_alpha: number): void {
    // Optional override
  }

  /**
   * Called when the canvas is resized.
   */
  resize(_width: number, _height: number): void {
    // Optional override
  }
}
