import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number, number, number, number, number, number, number]> = [
  [65536, 1.45, 8, 14, 0.82, 0.16, 0.62, 0.035, 1, 0.76, 0.72, 260],
  [131072, 1.25, 7, 18, 1.0, 0.12, 0.48, 0.025, 1, 0.86, 0.92, 360],
  [262144, 1.15, 7, 22, 1.08, 0.08, 0.36, 0.02, 1, 0.92, 0.84, 520],
  [524288, 0.95, 6, 26, 1.16, 0.06, 0.28, 0.018, 1, 0.96, 0.58, 640],
];

const RENDER_STYLES = ['dye', 'plasma', 'droplets'] as const;

export class ParticleFluidDemoAI implements SimulationAI {
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;
  private angle = 0;
  private pointerId = -8401;

  constructor(private readonly options: { liteMode?: boolean } = {}) {}

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx);
      return [];
    }

    this.angle += ctx.dt * 1.1;
    const sweep = Math.sin(this.angle * 0.37);
    const x = ctx.width * (0.5 + Math.sin(this.angle * 0.74) * 0.28);
    const y = ctx.height * (0.5 + Math.cos(this.angle * 0.58) * 0.24);
    const dx = Math.cos(this.angle * 1.7) * ctx.width * 0.018;
    const dy = Math.sin(this.angle * 1.35) * ctx.height * 0.016;
    return [{
      kind: 'drag',
      id: this.pointerId,
      x,
      y,
      dx,
      dy,
      strength: sweep > 0.62 ? 1.55 : 1,
      velocity: Math.hypot(dx, dy),
      timestamp: performance.now(),
    }];
  }

  reset(): void {
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
    this.angle = 0;
    this.pointerId -= 1;
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    const style = ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
    if (style) ctx.applyStyle(style);
    const fallback: [number, number, number, number, number, number, number, number, number, number, number, number] = [262144, 1.25, 7, 18, 1, 0.12, 0.48, 0.025, 1, 0.86, 0.92, 360];
    const preset = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)] ?? fallback;
    const [maxParticles, particleRadius, fieldCellSize, solverIterations, fluidTightness, viscosity, vorticity, drag, substeps, metaballBlend, opacity, injectRate] = preset;
    ctx.applySetting('renderStyle', RENDER_STYLES[Math.floor(Math.random() * RENDER_STYLES.length)] ?? 'dye');
    ctx.applyNumericSetting('maxParticles', this.options.liteMode ? Math.min(8192, maxParticles) : maxParticles);
    ctx.applyNumericSetting('particleRadius', this.options.liteMode ? Math.max(1.4, particleRadius) : particleRadius);
    ctx.applyNumericSetting('fieldCellSize', this.options.liteMode ? Math.max(10, fieldCellSize) : fieldCellSize);
    ctx.applyNumericSetting('solverIterations', this.options.liteMode ? Math.min(10, solverIterations) : solverIterations);
    ctx.applyNumericSetting('fluidTightness', fluidTightness);
    ctx.applyNumericSetting('viscosity', viscosity);
    ctx.applyNumericSetting('vorticity', vorticity);
    ctx.applyNumericSetting('drag', drag);
    ctx.applyNumericSetting('substeps', this.options.liteMode ? 1 : substeps);
    ctx.applyNumericSetting('metaballBlend', metaballBlend);
    ctx.applyNumericSetting('opacity', opacity);
    ctx.applyNumericSetting('inputRadius', 58 + Math.random() * 70);
    ctx.applyNumericSetting('inputForce', 12 + Math.random() * 28);
    ctx.applyNumericSetting('injectRate', this.options.liteMode ? Math.min(220, injectRate) : injectRate);
    ctx.applyNumericSetting('dyeSpread', 0.08 + Math.random() * 0.22);
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = this.options.liteMode ? 10 + Math.random() * 8 : 18 + Math.random() * 17;
  }
}
