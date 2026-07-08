import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number, number]> = [
  [1.05, 9, 0.026, 0.18, 8, 0.02, 26],
  [1.45, 14, 0.034, 0.12, 15, 0.12, 30],
  [2.35, 7, 0.042, 0.36, 5, 0.05, 18],
  [0.95, 5, 0.02, 0.06, 20, 0.2, 32],
];

export class FluidTankDemoAI implements SimulationAI {
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;
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
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx);
      return [];
    }

    this.angle += ctx.dt * (this.options.liteMode ? 1.85 : 1.25);
    const cx = ctx.width * (0.5 + Math.sin(this.angle * 0.7) * 0.24);
    const cy = ctx.height * (0.5 + Math.cos(this.angle * 0.61) * 0.22);
    const startX = this.previousX ?? cx - Math.cos(this.angle * 1.9) * ctx.width * 0.026;
    const startY = this.previousY ?? cy - Math.sin(this.angle * 1.6) * ctx.height * 0.026;
    const totalDx = cx - startX;
    const totalDy = cy - startY;
    const distance = Math.hypot(totalDx, totalDy);
    const stepSize = this.options.liteMode ? 10 : 14;
    const steps = Math.max(2, Math.min(this.options.liteMode ? 9 : 7, Math.ceil(distance / stepSize)));
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
    this.angle = 0;
    this.pointerId -= 1;
    this.previousX = null;
    this.previousY = null;
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    const style = ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
    if (style) ctx.applyStyle(style);
    const fallback: [number, number, number, number, number, number, number] = [1.45, 8, 0.03, 0.18, 8, 0.04, 20];
    const preset = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)] ?? fallback;
    const [cellSize, fingerForce, fingerRadius, viscosity, curl, eddyAssist, pressureIterations] = preset;
    ctx.applyNumericSetting('cellSize', this.options.liteMode ? Math.max(2.05, cellSize) : cellSize);
    ctx.applyNumericSetting('fingerForce', this.options.liteMode ? Math.min(8, fingerForce) : fingerForce);
    ctx.applyNumericSetting('fingerRadius', fingerRadius);
    ctx.applyNumericSetting('viscosity', viscosity);
    ctx.applyNumericSetting('curl', curl);
    ctx.applyNumericSetting('eddyAssist', eddyAssist);
    ctx.applyNumericSetting('pressureIterations', this.options.liteMode ? Math.min(16, pressureIterations) : pressureIterations);
    ctx.applyNumericSetting('velocityPersistence', this.options.liteMode ? 0.986 : 0.978 + Math.random() * 0.018);
    ctx.applyNumericSetting('dyePersistence', this.options.liteMode ? 0.9925 : 0.99 + Math.random() * 0.007);
    ctx.applyNumericSetting('injectAmount', this.options.liteMode ? 0.48 : 0.52 + Math.random() * 0.55);
    ctx.applyNumericSetting('injectTurbulence', this.options.liteMode ? 0.38 : 0.25 + Math.random() * 0.75);
    ctx.applySetting('ambient', false);
    ctx.applySetting('renderStyle', this.options.liteMode ? 'blank' : Math.random() > 0.72 ? 'voronoi' : 'cloud');
    ctx.applySetting('injectPalette', Math.random() > 0.68 ? 'rainbow' : 'style');
    this.nextOverhaulIn = this.options.liteMode ? 14 + Math.random() * 8 : 20 + Math.random() * 15;
    this.elapsedSinceOverhaul = 0;
    this.previousX = null;
    this.previousY = null;
  }
}
