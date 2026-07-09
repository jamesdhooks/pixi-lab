import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number, number, number, number, number, number]> = [
  [16384, 64, 72, 2.8, 0.14, 0.92, 780, 2.4, 0.66, 430],
  [32768, 128, 86, 3.2, 0.18, 0.88, 920, 2.2, 0.72, 520],
  [49152, 128, 114, 3.8, 0.24, 0.82, 1080, 1.9, 0.78, 740],
  [65536, 256, 146, 4.6, 0.3, 0.76, 1220, 1.7, 0.84, 920],
];

const PREVIEW_PRESETS: Array<[number, number, number, number, number, number, number, number, number, number]> = [
  [3072, 32, 42, 2.6, 0.1, 0.78, 520, 2.6, 0.62, 120],
  [4096, 32, 54, 2.9, 0.12, 0.74, 620, 2.8, 0.66, 160],
  [6144, 64, 62, 3.1, 0.14, 0.72, 700, 2.4, 0.7, 190],
];

const RENDER_STYLES = ['basic', 'enhanced', 'ultra'] as const;

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
    const dx = Math.cos(this.phase * 1.4) * ctx.width * (this.options.liteMode ? 0.0045 : 0.015);
    const dy = ctx.height * (this.options.liteMode ? 0.004 : 0.01 + Math.sin(this.phase * 1.12) * 0.01);
    return [{
      kind: 'drag',
      id: this.pointerId,
      x,
      y,
      dx,
      dy,
      strength: this.options.liteMode ? 0.55 + Math.max(0, Math.sin(this.phase * 0.7)) * 0.18 : 1 + Math.max(0, Math.sin(this.phase * 0.7)) * 0.65,
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
    const presets = this.options.liteMode ? PREVIEW_PRESETS : PARAM_PRESETS;
    const preset = presets[Math.floor(Math.random() * presets.length)] ?? fallback;
    const [maxParticles, resolution, stiffness, restDensity, viscosity, flipness, gravity, particleRadius, surfaceSmoothing, emitRate] = preset;
    ctx.applySetting('renderStyle', this.options.liteMode ? 'enhanced' : RENDER_STYLES[Math.floor(Math.random() * RENDER_STYLES.length)] ?? 'ultra');
    ctx.applyNumericSetting('maxParticles', maxParticles);
    ctx.applyNumericSetting('resolution', resolution);
    ctx.applyNumericSetting('stiffness', stiffness);
    ctx.applyNumericSetting('restDensity', restDensity);
    ctx.applyNumericSetting('viscosity', viscosity);
    ctx.applyNumericSetting('flipness', flipness);
    ctx.applyNumericSetting('gravity', gravity);
    ctx.applyNumericSetting('particleRadius', this.options.liteMode ? Math.max(2.2, particleRadius) : particleRadius);
    ctx.applyNumericSetting('surfaceSmoothing', surfaceSmoothing);
    ctx.applyNumericSetting('opacity', 0.68 + Math.random() * 0.24);
    ctx.applyNumericSetting('inputRadius', this.options.liteMode ? 26 + Math.random() * 24 : 42 + Math.random() * 62);
    ctx.applyNumericSetting('inputForce', this.options.liteMode ? 4 + Math.random() * 7 : 12 + Math.random() * 22);
    ctx.applyNumericSetting('emitRate', emitRate);
    ctx.applyNumericSetting('pourRadius', this.options.liteMode ? 9 + Math.random() * 10 : 22 + Math.random() * 44);
    ctx.applyNumericSetting('buildRadius', this.options.liteMode ? 6 + Math.random() * 4 : 12 + Math.random() * 18);
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = this.options.liteMode ? 10 + Math.random() * 8 : 18 + Math.random() * 17;
  }
}
