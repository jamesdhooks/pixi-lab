import type { Input } from '../Input';
import { Scene } from '../Scene';
import type {
  GameContext,
  GestureEvent,
  RenderQuality,
  SimRenderLayers,
  SimStyleManifest,
  StagnationReport,
} from '../types';

export abstract class SimulationScene extends Scene {
  protected ctx_!: GameContext;
  protected input_!: Input;
  protected quality: RenderQuality = 'basic';
  protected styleId = '';
  protected gesturesThisFrame: GestureEvent[] = [];

  abstract getRenderLayers(): SimRenderLayers;
  abstract getStyleManifest(): SimStyleManifest;
  abstract detectStagnation(): StagnationReport;
  abstract stabilize(): void;
  abstract softReset(seed?: number): void;

  onEnter(ctx: GameContext, input: Input): void {
    this.ctx_ = ctx;
    this.input_ = input;
    const manifest = this.getStyleManifest();
    this.styleId = manifest.defaultStyleId;
    ctx.systems.styleManager?.setManifest(manifest);
    ctx.systems.styleManager?.setQuality(ctx.quality);
    this.setQuality(ctx.quality);
  }

  setStyle(styleId: string): void {
    this.styleId = styleId;
    this.ctx_.systems.styleManager?.setStyle(styleId);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
    this.ctx_.systems.styleManager?.setQuality(quality);
  }

  consumeGestures(): GestureEvent[] {
    const gestures = this.gesturesThisFrame;
    this.gesturesThisFrame = [];
    return gestures;
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.gesturesThisFrame.push(...gestures);
  }

  /**
   * Called when the host UI visibility changes. Override to hide canvas-level
   * UI elements (e.g. emitter markers) when the HUD is hidden.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onUIHidden(_hidden: boolean): void {
    // default no-op
  }
}
