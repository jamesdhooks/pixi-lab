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

    this.angle += ctx.dt * 1.15;
    const cx = ctx.width * (0.5 + Math.sin(this.angle * 0.7) * 0.24);
    const cy = ctx.height * (0.5 + Math.cos(this.angle * 0.61) * 0.22);
    const dx = Math.cos(this.angle * 1.9) * ctx.width * 0.018;
    const dy = Math.sin(this.angle * 1.6) * ctx.height * 0.018;

    return [
      {
        kind: 'drag',
        id: this.pointerId,
        x: cx,
        y: cy,
        dx,
        dy,
        velocity: Math.hypot(dx, dy),
        timestamp: performance.now(),
      },
    ];
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
    ctx.applyNumericSetting('dyePersistence', 0.9992 + Math.random() * 0.0008);
    ctx.applySetting('ambient', true);
    ctx.applySetting('renderStyle', Math.random() > 0.72 ? 'voronoi' : 'cloud');
    this.nextOverhaulIn = this.options.liteMode ? 14 + Math.random() * 8 : 20 + Math.random() * 15;
    this.elapsedSinceOverhaul = 0;
  }
}
