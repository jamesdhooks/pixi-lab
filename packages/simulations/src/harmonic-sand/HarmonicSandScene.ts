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
import { HARMONIC_SAND_DEFAULTS } from './harmonic-sand.config';
import { HarmonicSandModel } from './HarmonicSandModel';
import { chladniGoldStyle } from './styles/chladni-gold';
import { ghostFrequencyStyle } from './styles/ghost-frequency';
import { laserPlateStyle } from './styles/laser-plate';

export const harmonicSandStyleManifest: SimStyleManifest = {
  defaultStyleId: 'chladni-gold',
  capabilities: {
    renderLayers: ['particles', 'field', 'glow', 'debug'],
    passes: ['primitive', 'paletteMap', 'contourBands', 'fieldVisualize', 'trailFeedback', 'bloom'],
    qualities: ['basic', 'enhanced'],
  },
  styles: [chladniGoldStyle, laserPlateStyle, ghostFrequencyStyle],
};

export class HarmonicSandScene extends SimulationScene {
  readonly name = 'HarmonicSandPlate';
  private layer: SimulationCanvasLayer | null = null;
  private model: HarmonicSandModel | null = null;
  private stagnationReport: StagnationReport = { stagnant: false, severity: 0 };

  constructor(private readonly previewParticleCap?: number) {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    this.layer = new SimulationCanvasLayer(ctx.systems.pixi.app);
    const settings = ctx.systems.settings;
    this.model = new HarmonicSandModel({
      seed: ctx.seed,
      width: ctx.width,
      height: ctx.height,
      quality: ctx.quality,
      particleCount: this.previewParticleCap ?? ((settings.get('particleCount') as number) ?? (HARMONIC_SAND_DEFAULTS.particleCount as number)),
      emitterCount: this.previewParticleCap ? 1 : ((settings.get('emitterCount') as number) ?? (HARMONIC_SAND_DEFAULTS.emitterCount as number)),
      baseFrequency: (settings.get('baseFrequency') as number) ?? (HARMONIC_SAND_DEFAULTS.baseFrequency as number),
    });
    const style = settings.get('style') as string | undefined;
    if (style) this.setStyle(style);
    ctx.systems.debug?.setEnabled(settings.get('debug') === true);
  }

  override onExit(): void {
    this.layer?.destroy();
    this.layer = null;
    this.model = null;
  }

  override update(dt: number): void {
    if (!this.model) return;
    for (const gesture of this.consumeGestures()) {
      this.model.handleGesture(gesture);
    }
    this.model.update(dt);
    this.stagnationReport = this.model.detectStagnation(dt);
  }

  override render(_alpha: number): void {
    if (!this.layer || !this.model) return;
    const style = this.ctx_.systems.styleManager?.getStyle() ?? chladniGoldStyle;
    this.layer.clear();
    this.layer.renderField(this.model.field, this.ctx_.width, this.ctx_.height, style);
    this.layer.renderParticles(this.model.particles.particles, style);
    this.ctx_.systems.debug?.update({
      fps: 0,
      quality: this.quality,
      particleCount: this.model.particles.particles.length,
      fieldVariance: this.model.field.stats().variance,
    });
  }

  override resize(width: number, height: number): void {
    this.softReset(this.ctx_.seed + Math.floor(width + height));
  }

  getRenderLayers(): SimRenderLayers {
    return this.layer?.getRenderLayers() ?? {};
  }

  getStyleManifest(): SimStyleManifest {
    return harmonicSandStyleManifest;
  }

  override setQuality(quality: RenderQuality): void {
    super.setQuality(quality);
    this.model?.setQuality(quality);
  }

  detectStagnation(): StagnationReport {
    return this.stagnationReport;
  }

  stabilize(): void {
    this.model?.stabilize();
  }

  softReset(seed = this.ctx_.seed): void {
    this.model?.reset(seed);
  }
}
