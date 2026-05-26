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
import { HARMONIC_SAND_DEFAULTS } from './harmonic-sand.config.js';
import { HarmonicSandModel, type HarmonicSandModelOptions } from './HarmonicSandModel.js';
import { biolumOceanStyle } from './styles/biolum-ocean.js';
import { chladniGoldStyle } from './styles/chladni-gold.js';
import { deepVoidStyle } from './styles/deep-void.js';
import { emberPulseStyle } from './styles/ember-pulse.js';
import { ghostFrequencyStyle } from './styles/ghost-frequency.js';
import { laserPlateStyle } from './styles/laser-plate.js';
import { neonCoralStyle } from './styles/neon-coral.js';

export const harmonicSandStyleManifest: SimStyleManifest = {
  defaultStyleId: 'chladni-gold',
  capabilities: {
    renderLayers: ['particles', 'field', 'glow', 'debug'],
    passes: ['primitive', 'paletteMap', 'contourBands', 'fieldVisualize', 'trailFeedback', 'bloom'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [chladniGoldStyle, laserPlateStyle, ghostFrequencyStyle, neonCoralStyle, deepVoidStyle, biolumOceanStyle, emberPulseStyle, {
    id: '__random__',
    name: 'Random',
    description: 'Picks a random style each time.',
    background: 0x000000,
    palette: [0x334455, 0x6677aa, 0xaabbdd, 0xffffff],
    passes: [],
    uniforms: {},
    uniformSchema: [],
  }],
};

export class HarmonicSandScene extends SimulationScene {
  readonly name: string = 'HarmonicSandPlate';
  private layer: SimulationCanvasLayer | null = null;
  private model: HarmonicSandModel | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };
  /** Cached options used to recreate the model when quality or dimensions change. */
  private modelOptions: HarmonicSandModelOptions | null = null;
  /** Cached settings values — detect changes each update tick. */
  private lastFieldResolution = 0;
  private lastBaseFrequency = 0;

  constructor(private readonly previewFieldColumns?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    this.layer.setQuality(ctx.quality);
    const settings = ctx.systems.settings;
    this.modelOptions = {
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      quality: ctx.quality,
      fieldColumns: this.previewFieldColumns ?? ((settings.get('resolution') as number) ?? (HARMONIC_SAND_DEFAULTS.resolution as number)),
      emitterCount: (HARMONIC_SAND_DEFAULTS.emitterCount as number),
      baseFrequency: (settings.get('baseFrequency') as number) ?? (HARMONIC_SAND_DEFAULTS.baseFrequency as number),
    };
    this.model = new HarmonicSandModel(this.modelOptions);
    this.lastFieldResolution = this.modelOptions.fieldColumns;
    this.lastBaseFrequency = this.modelOptions.baseFrequency;
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    // Debug overlay is controlled by the DebugPanel React component, not by persisted settings.
    ctx.systems.debug?.setEnabled(false);
  }

  override onExit(): void {
    this.layer?.destroy();
    this.layer = null;
    this.model = null;
    this.modelOptions = null;
  }

  override onUIHidden(hidden: boolean): void {
    this.layer?.setEmittersVisible(!hidden);
  }

  override update(dt: number): void {
    if (!this.model || !this.modelOptions) return;

    // Poll every live-editable setting and apply the change immediately so
    // adjusting a slider takes effect without restarting the simulation.
    const settings = this.ctx_.systems.settings;

    const newRes = (settings.get('resolution') as number | undefined)
      ?? (HARMONIC_SAND_DEFAULTS.resolution as number);
    if (newRes !== this.lastFieldResolution) {
      this.lastFieldResolution = newRes;
      this.modelOptions = { ...this.modelOptions, fieldColumns: newRes };
      this.model.setFieldResolution(newRes);
    }

    const newFreq = (settings.get('baseFrequency') as number | undefined)
      ?? (HARMONIC_SAND_DEFAULTS.baseFrequency as number);
    if (newFreq !== this.lastBaseFrequency) {
      this.lastBaseFrequency = newFreq;
      this.modelOptions = { ...this.modelOptions, baseFrequency: newFreq };
      this.model.setBaseFrequency(newFreq);
    }

    for (const gesture of this.consumeGestures()) {
      this.model.handleGesture(gesture);
    }
    this.model.update(dt);
    this.stagnationReport = this.model.detectStagnation(dt);
  }

  override reset(): void {
    if (!this.modelOptions) return;
    // Randomise the seed so each reset produces a fresh pattern
    this.modelOptions = { ...this.modelOptions, seed: this.modelOptions.seed + Math.round(this.model?.elapsedTime ?? 0) + 1 };
    this.model = new HarmonicSandModel(this.modelOptions);
    this.lastFieldResolution = this.modelOptions.fieldColumns;
    this.lastBaseFrequency = this.modelOptions.baseFrequency;
  }

  override render(_alpha: number): void {
    if (!this.layer || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? chladniGoldStyle;
    this.layer.clear();
    this.layer.renderField(this.model.field, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderEmitters(this.model.emitters, this.model.elapsedTime);
    this.ctx_.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      fieldVariance: this.model.field.stats().variance,
    });
  }

  override resize(width: number, height: number): void {
    if (!this.modelOptions) return;
    this.modelOptions = {
      ...this.modelOptions,
      width,
      height,
      seed: this.modelOptions.seed + Math.floor(width + height),
    };
    this.model = new HarmonicSandModel(this.modelOptions);
  }

  getRenderLayers(): SimRenderLayers {
    return this.layer?.getRenderLayers() ?? {};
  }

  getStyleManifest(): SimStyleManifest {
    return harmonicSandStyleManifest;
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    if (!this.modelOptions) return;
    // Quality is purely a rendering concern — update stored options and the
    // canvas layer; the physics model is untouched.
    this.modelOptions = { ...this.modelOptions, quality };
    this.layer?.setQuality(quality);
  }

  detectStagnation(): StagnationReport {
    return this.stagnationReport;
  }

  stabilize(): void {
    this.model?.stabilize();
  }

  softReset(): void {
    this.reset();
  }

  override clearEmitters(): void {
    this.model?.clearEmitters();
  }
}
