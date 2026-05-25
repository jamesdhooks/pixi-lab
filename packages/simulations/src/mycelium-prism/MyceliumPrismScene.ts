import {
  SimulationCanvasLayer,
  SimulationScene,
  type GameContext,
  type Input,
  type RenderQuality,
  type SimRenderLayers,
  type SimStyleManifest,
  type StagnationReport,
} from '@hooksjam/pixi-lab-core';
import { MYCELIUM_PRISM_DEFAULTS } from './mycelium-prism.config.js';
import { MyceliumPrismModel, type MyceliumPrismModelOptions } from './MyceliumPrismModel.js';
import { neonMoldStyle } from './styles/neon-mold.js';
import { rotBloomStyle } from './styles/rot-bloom.js';
import { synapticFungusStyle } from './styles/synaptic-fungus.js';

export const myceliumPrismStyleManifest: SimStyleManifest = {
  defaultStyleId: 'neon-mold',
  capabilities: {
    renderLayers: ['primitive', 'field', 'glow', 'debug'],
    passes: ['primitive', 'paletteMap', 'contourBands', 'edgeGlow', 'trailFeedback', 'bloom'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [neonMoldStyle, rotBloomStyle, synapticFungusStyle],
};

export class MyceliumPrismScene extends SimulationScene {
  readonly name: string = 'MyceliumPrism';
  private layer: SimulationCanvasLayer | null = null;
  private model: MyceliumPrismModel | null = null;
  private modelOptions: MyceliumPrismModelOptions | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };

  constructor(private readonly previewColumns?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    this.layer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    const columns = this.previewColumns ?? ((settings.get('gridColumns') as number | undefined) ?? (MYCELIUM_PRISM_DEFAULTS.gridColumns as number));
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      columns,
      rows: Math.max(12, Math.round(columns * ctx.height / Math.max(1, ctx.width))),
      strainCount: MYCELIUM_PRISM_DEFAULTS.strainCount as number,
      initialColonies: MYCELIUM_PRISM_DEFAULTS.initialColonies as number,
      growthRate: (settings.get('growthRate') as number | undefined) ?? (MYCELIUM_PRISM_DEFAULTS.growthRate as number),
      nutrientDiffusion: (settings.get('nutrientDiffusion') as number | undefined) ?? (MYCELIUM_PRISM_DEFAULTS.nutrientDiffusion as number),
    };
    this.model = new MyceliumPrismModel(this.modelOptions);
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.layer?.destroy();
    this.layer = null;
    this.model = null;
    this.modelOptions = null;
  }

  override update(dt: number): void {
    if (!this.model) return;
    for (const gesture of this.consumeGestures()) this.model.handleGesture(gesture);
    this.model.update(dt);
    this.stagnationReport = this.model.detectStagnation(dt);
    if (this.stagnationReport.stagnant) this.stabilize();
  }

  override render(_alpha: number): void {
    if (!this.layer || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? neonMoldStyle;
    this.layer.clear();
    this.layer.renderField(this.model.field, this.ctx_.width, this.ctx_.height, style);
    const stats = this.model.stats();
    this.ctx_.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: stats.activeCells,
      fieldVariance: stats.meanEnergy,
    });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = {
      ...this.modelOptions,
      width,
      height,
      rows: Math.max(12, Math.round(this.modelOptions.columns * height / Math.max(1, width))),
      seed: this.modelOptions.seed + Math.floor(width + height),
    };
    this.model = new MyceliumPrismModel(this.modelOptions);
  }

  override reset(): void {
    if (!this.modelOptions) return;
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + Math.round(this.model?.stats().veinPulse ?? 0) + 1 };
    this.model = new MyceliumPrismModel(this.modelOptions);
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.layer?.setQuality(quality);
  }

  getRenderLayers(): SimRenderLayers {
    return this.layer?.getRenderLayers() ?? {};
  }

  getStyleManifest(): SimStyleManifest {
    return myceliumPrismStyleManifest;
  }

  detectStagnation(): StagnationReport {
    return this.stagnationReport;
  }

  stabilize(): void {
    this.model?.stabilize();
    this.stagnationReport = { stagnant: false, severity: 0 };
  }

  softReset(seed?: number): void {
    if (seed !== undefined && this.modelOptions) {
      this.modelOptions = { ...this.modelOptions, seed };
      this.model = new MyceliumPrismModel(this.modelOptions);
      return;
    }
    this.reset();
  }
}
