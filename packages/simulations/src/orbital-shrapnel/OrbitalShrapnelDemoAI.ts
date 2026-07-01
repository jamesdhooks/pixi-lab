import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number]> = [
  [180, 82, 1200, 0.976],
  [240, 58, 780, 0.965],
  [320, 104, 1450, 0.982],
  [140, 44, 610, 0.955],
  [280, 92, 1680, 0.988],
];

export class OrbitalShrapnelDemoAI implements SimulationAI {
  private nextGestureIn = 0.35;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.nextGestureIn = 0.35;
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;

    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx);
      return [];
    }

    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.55 + Math.random() * 1.1;
    const x = ctx.width * (0.2 + Math.random() * 0.6);
    const y = ctx.height * (0.18 + Math.random() * 0.64);
    const roll = Math.random();
    if (roll < 0.22) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.48) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.76) return [{ kind: 'drag', x, y, dx: -120 + Math.random() * 240, dy: -80 + Math.random() * 160, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -300 + Math.random() * 600, dy: -220 + Math.random() * 440, velocity: 2.6, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    const [particleCount, planetRadius, gravity, trailFade] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('particleCount', particleCount);
    applyNumericSetting('planetRadius', planetRadius);
    applyNumericSetting('gravity', gravity);
    applyNumericSetting('trailFade', trailFade);
    this.nextOverhaulIn = 18 + Math.random() * 14;
    this.elapsedSinceOverhaul = 0;
  }
}
