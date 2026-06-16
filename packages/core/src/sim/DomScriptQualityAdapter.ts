import type { Input } from '../Input.js';
import type { GameContext, RenderQuality } from '../types.js';
import { DomScriptScene, type DomSceneOptions } from './DomScriptScene.js';

export interface DomScriptQualityAdapterOptions extends DomSceneOptions {
  isActiveQuality: (quality: RenderQuality) => boolean;
}

export interface DomScriptQualitySwitchResult {
  mounted: boolean;
  unmounted: boolean;
  active: boolean;
}

/**
 * Reusable quality-gated bridge for DomScriptScene-backed render adapters.
 *
 * Scenes can keep one instance and call sync() whenever quality changes.
 */
export class DomScriptQualityAdapter {
  private scene: DomScriptScene | null = null;

  constructor(private readonly options: DomScriptQualityAdapterOptions) {}

  isMounted(): boolean {
    return this.scene !== null;
  }

  sync(quality: RenderQuality, ctx: GameContext, input: Input): DomScriptQualitySwitchResult {
    const shouldBeActive = this.options.isActiveQuality(quality);

    if (shouldBeActive && !this.scene) {
      this.scene = new DomScriptScene({
        name: this.options.name,
        markup: this.options.markup,
        mount: this.options.mount,
      });
      this.scene.onEnter(ctx, input);
      return { mounted: true, unmounted: false, active: true };
    }

    if (!shouldBeActive && this.scene) {
      this.scene.onExit();
      this.scene = null;
      return { mounted: false, unmounted: true, active: false };
    }

    return { mounted: false, unmounted: false, active: this.scene !== null };
  }

  unmount(): void {
    if (!this.scene) return;
    this.scene.onExit();
    this.scene = null;
  }

  update(dt: number): void {
    this.scene?.update(dt);
  }

  render(alpha: number): void {
    this.scene?.render(alpha);
  }

  resize(width: number, height: number): void {
    this.scene?.resize(width, height);
  }

  reset(): void {
    this.scene?.reset();
  }

  setStyle(styleId: string): void {
    this.scene?.setStyle(styleId);
  }

  setMode(modeId: string): void {
    this.scene?.setMode(modeId);
  }
}
