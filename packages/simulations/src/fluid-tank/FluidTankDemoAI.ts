import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number, number]> = [
  [1.05, 18, 0.05, 0.18, 30, 0.02, 26],
  [1.45, 24, 0.056, 0.12, 42, 0.12, 30],
  [2.35, 14, 0.045, 0.36, 24, 0.05, 18],
  [0.95, 30, 0.052, 0.06, 52, 0.2, 32],
];

export class FluidTankDemoAI implements SimulationAI {
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;
  private liteEmitAccumulator = 0;
  private angle = 0;
  private pointerId = -7301;
  private previousX: number | null = null;
  private previousY: number | null = null;

  constructor(private readonly options: { liteMode?: boolean } = {}) {}

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    if (this.options.liteMode) {
      this.liteEmitAccumulator += ctx.dt;
    }
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx);
      return [];
    }
    if (this.options.liteMode && this.liteEmitAccumulator < 0.085) return [];
    this.liteEmitAccumulator = 0;

    this.angle += ctx.dt * (this.options.liteMode ? 1.85 : 1.25);
    const cx = ctx.width * (0.5 + Math.sin(this.angle * 0.7) * 0.24);
    const cy = ctx.height * (0.5 + Math.cos(this.angle * 0.61) * 0.22);
    const startX = this.previousX ?? cx - Math.cos(this.angle * 1.9) * ctx.width * 0.026;
    const startY = this.previousY ?? cy - Math.sin(this.angle * 1.6) * ctx.height * 0.026;
    const totalDx = cx - startX;
    const totalDy = cy - startY;
    const distance = Math.hypot(totalDx, totalDy);
    const stepSize = this.options.liteMode ? 28 : 14;
    const steps = Math.max(1, Math.min(this.options.liteMode ? 3 : 7, Math.ceil(distance / stepSize)));
    const gestures: GestureEvent[] = [];

    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const x = startX + totalDx * t;
      const y = startY + totalDy * t;
      gestures.push({
        kind: 'drag',
        id: this.pointerId,
        x,
        y,
        dx: totalDx / steps,
        dy: totalDy / steps,
        velocity: distance / steps,
        timestamp: performance.now(),
      });
    }

    this.previousX = cx;
    this.previousY = cy;
    return gestures;
  }

  reset(): void {
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
    this.liteEmitAccumulator = 0;
    this.angle = 0;
    this.pointerId -= 1;
    this.previousX = null;
    this.previousY = null;
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    const style = ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
    if (style) ctx.applyStyle(style);
    const fallback: [number, number, number, number, number, number, number] = [1.45, 18, 0.05, 0.18, 30, 0.04, 20];
    const preset = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)] ?? fallback;
    const [cellSize, fingerForce, fingerRadius, viscosity, curl, eddyAssist, pressureIterations] = preset;
    ctx.applyNumericSetting('cellSize', this.options.liteMode ? Math.max(2.05, cellSize) : cellSize);
    ctx.applyNumericSetting('fingerForce', this.options.liteMode ? 5.5 : fingerForce);
    ctx.applyNumericSetting('fingerRadius', this.options.liteMode ? 0.026 : fingerRadius);
    ctx.applyNumericSetting('viscosity', viscosity);
    ctx.applyNumericSetting('curl', curl);
    ctx.applyNumericSetting('eddyAssist', eddyAssist);
    ctx.applyNumericSetting('pressureIterations', this.options.liteMode ? Math.min(16, pressureIterations) : pressureIterations);
    ctx.applyNumericSetting('velocityPersistence', this.options.liteMode ? 0.32 : 0.12 + Math.random() * 0.26);
    ctx.applyNumericSetting('dyePersistence', this.options.liteMode ? 0.96 : 0.82 + Math.random() * 0.42);
    ctx.applyNumericSetting('injectAmount', this.options.liteMode ? 0.62 : 0.82 + Math.random() * 0.46);
    ctx.applyNumericSetting('injectTurbulence', this.options.liteMode ? 0.32 : 0.25 + Math.random() * 0.75);
    ctx.applySetting('ambient', false);
    ctx.applySetting('renderStyle', this.options.liteMode ? 'blank' : Math.random() > 0.72 ? 'voronoi' : 'cloud');
    ctx.applySetting('injectPalette', this.options.liteMode ? 'rainbow' : Math.random() > 0.68 ? 'rainbow' : 'style');
    this.nextOverhaulIn = this.options.liteMode ? 14 + Math.random() * 8 : 20 + Math.random() * 15;
    this.elapsedSinceOverhaul = 0;
    this.liteEmitAccumulator = 0;
    this.previousX = this.options.liteMode ? ctx.width * 0.26 : null;
    this.previousY = this.options.liteMode ? ctx.height * 0.54 : null;
  }
}
