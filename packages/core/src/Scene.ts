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
import type { GameContext } from './types.js';
import type { Input } from './Input.js';

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
   * Return true when the scene has custom visual work that still needs a frame
   * even if the engine has no active physics bodies, particles, or pointers.
   *
   * Game scenes default to idle-until-active so future physics-driven scenes
   * automatically stop presenting frames once the world settles.
   */
  shouldRender(): boolean {
    return false;
  }

  /**
   * Called when the canvas is resized.
   */
  resize(_width: number, _height: number): void {
    // Optional override
  }

  /**
   * Called when the shell requests a scene reset (e.g. user taps the Reset button).
   * Override to drain/clear content and restart the scene cycle.
   * Default: no-op.
   */
  reset(): void {
    // Optional override
  }

  /**
   * Soft-clear simulation entities (e.g. emitters) without resetting visual or
   * field state. Override in simulation scenes to avoid black-flash on config
   * transitions. Default: no-op.
   */
  clearEmitters(): void {
    // Optional override
  }

  /**
   * Called when the active interaction mode changes (e.g. single → rapid → explode).
   * Default: no-op. Override to switch scene behaviour.
   */
  setMode(_id: string): void {
    // Optional override
  }

  /**
   * Called when the active style changes (e.g. rainbow → neon).
   * Default: no-op. Override to recolour content.
   */
  setStyle(_id: string): void {
    // Optional override
  }

  /**
   * Hint for how the host canvas should be filtered when the browser has to
   * upscale it back to CSS size (for example when maxPixels lowers resolution).
   */
  getCanvasImageRendering(): 'auto' | 'pixelated' {
    return 'auto';
  }
}
