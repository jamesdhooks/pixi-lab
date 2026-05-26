import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number]> = [
  [260, 0.986, 0.75, 72],
  [140, 0.974, 1.05, 56],
  [360, 0.99, 0.6, 88],
  [460, 0.994, 1.25, 104],
  [200, 0.962, 0.9, 64],
];

export class CrystalPlasmaDemoAI implements SimulationAI {
  private nextGestureIn = 0.25;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.nextGestureIn = 0.25;
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
    this.nextGestureIn = 0.5 + Math.random() * 1.2;
    const x = ctx.width * (0.16 + Math.random() * 0.68);
    const y = ctx.height * (0.15 + Math.random() * 0.7);
    const roll = Math.random();
    if (roll < 0.3) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.52) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.76) return [{ kind: 'drag', x, y, dx: -80 + Math.random() * 160, dy: -80 + Math.random() * 160, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -240 + Math.random() * 480, dy: -160 + Math.random() * 320, velocity: 2.4, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    const [maxCrystals, stressDecay, growthBias, fieldColumns] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('maxCrystals', maxCrystals);
    applyNumericSetting('stressDecay', stressDecay);
    applyNumericSetting('growthBias', growthBias);
    applyNumericSetting('fieldColumns', fieldColumns);
    this.nextOverhaulIn = 17 + Math.random() * 14;
    this.elapsedSinceOverhaul = 0;
  }
}
