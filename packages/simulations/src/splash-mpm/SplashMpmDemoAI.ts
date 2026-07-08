import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number, number, number, number, number]> = [
  [16384, 64, 72, 2.8, 0.14, 0.92, 780, 2.4, 0.66, 430],
  [32768, 128, 86, 3.2, 0.18, 0.88, 920, 2.2, 0.72, 520],
  [49152, 128, 114, 3.8, 0.24, 0.82, 1080, 1.9, 0.78, 740],
  [65536, 256, 146, 4.6, 0.3, 0.76, 1220, 1.7, 0.84, 920],
];

const RENDER_STYLES = ['basic', 'enhanced', 'raw'] as const;

export class SplashMpmDemoAI implements SimulationAI {
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;
  private phase = 0;
  private pointerId = -8701;

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

    this.phase += ctx.dt;
    const x = ctx.width * (0.5 + Math.sin(this.phase * 0.84) * 0.28);
    const y = ctx.height * (0.22 + Math.sin(this.phase * 0.37) * 0.08);
    const dx = Math.cos(this.phase * 1.8) * ctx.width * 0.015;
    const dy = ctx.height * (0.01 + Math.sin(this.phase * 1.12) * 0.01);
    return [{
      kind: 'drag',
      id: this.pointerId,
      x,
      y,
      dx,
      dy,
      strength: 1 + Math.max(0, Math.sin(this.phase * 0.7)) * 0.65,
      velocity: Math.hypot(dx, dy),
      timestamp: performance.now(),
    }];
  }

  reset(): void {
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
    this.phase = 0;
    this.pointerId -= 1;
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    const style = ctx.styleIds[Math.floor(Math.random() * Math.max(1, ctx.styleIds.length))];
    if (style) ctx.applyStyle(style);
    const fallback: [number, number, number, number, number, number, number, number, number, number] = [32768, 128, 86, 3.2, 0.18, 0.88, 920, 2.2, 0.72, 520];
    const preset = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)] ?? fallback;
    const [maxParticles, resolution, stiffness, restDensity, viscosity, flipness, gravity, particleRadius, surfaceSmoothing, emitRate] = preset;
    ctx.applySetting('renderStyle', RENDER_STYLES[Math.floor(Math.random() * RENDER_STYLES.length)] ?? 'raw');
    ctx.applyNumericSetting('maxParticles', this.options.liteMode ? Math.min(8192, maxParticles) : maxParticles);
    ctx.applyNumericSetting('resolution', this.options.liteMode ? Math.min(64, resolution) : resolution);
    ctx.applyNumericSetting('stiffness', stiffness);
    ctx.applyNumericSetting('restDensity', restDensity);
    ctx.applyNumericSetting('viscosity', viscosity);
    ctx.applyNumericSetting('flipness', flipness);
    ctx.applyNumericSetting('gravity', gravity);
    ctx.applyNumericSetting('particleRadius', this.options.liteMode ? Math.max(2.2, particleRadius) : particleRadius);
    ctx.applyNumericSetting('surfaceSmoothing', surfaceSmoothing);
    ctx.applyNumericSetting('opacity', 0.68 + Math.random() * 0.24);
    ctx.applyNumericSetting('inputRadius', 42 + Math.random() * 62);
    ctx.applyNumericSetting('inputForce', 12 + Math.random() * 22);
    ctx.applyNumericSetting('emitRate', this.options.liteMode ? Math.min(260, emitRate) : emitRate);
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = this.options.liteMode ? 10 + Math.random() * 8 : 18 + Math.random() * 17;
  }
}
