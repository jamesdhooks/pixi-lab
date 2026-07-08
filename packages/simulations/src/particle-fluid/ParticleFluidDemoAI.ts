import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number, number, number, number, number, number, number]> = [
  [65536, 5, 1, 14, 32, 0.998, 1, 0.015, 0.6, 1, 1, 4],
  [262144, 4, 1, 18, 32, 0.999, 1, 0.015, 0.6, 1, 1, 4],
  [1048576, 4, 1.15, 20, 32, 0.999, 1, 0.013, 0.6, 1.08, 1, 4],
  [1048576, 2, 0.9, 30, 32, 0.999, 1, 0.015, 0.6, 1, 1, 4],
];

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
    const fallback: [number, number, number, number, number, number, number, number, number, number, number, number] = [262144, 4, 1, 18, 32, 0.999, 1, 0.015, 0.6, 1, 1, 4];
    const preset = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)] ?? fallback;
    const [maxParticles, fieldCellSize, simulationScale, solverIterations, cellSize, velocityDecay, particleDrag, forceRadius, forceTaper, forceStrength, pointSize, colorSpeedScale] = preset;
    ctx.applyNumericSetting('maxParticles', this.options.liteMode ? Math.min(8192, maxParticles) : maxParticles);
    ctx.applyNumericSetting('fieldCellSize', this.options.liteMode ? Math.max(5, fieldCellSize) : fieldCellSize);
    ctx.applyNumericSetting('simulationScale', simulationScale);
    ctx.applyNumericSetting('solverIterations', this.options.liteMode ? Math.min(10, solverIterations) : solverIterations);
    ctx.applyNumericSetting('cellSize', cellSize);
    ctx.applyNumericSetting('velocityDecay', velocityDecay);
    ctx.applyNumericSetting('particleDrag', particleDrag);
    ctx.applyNumericSetting('forceRadius', forceRadius);
    ctx.applyNumericSetting('forceTaper', forceTaper);
    ctx.applyNumericSetting('forceStrength', forceStrength);
    ctx.applyNumericSetting('pointSize', pointSize);
    ctx.applyNumericSetting('colorSpeedScale', colorSpeedScale);
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = this.options.liteMode ? 10 + Math.random() * 8 : 18 + Math.random() * 17;
  }
}
