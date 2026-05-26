import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number]> = [
  [160, 5, 0.982, 64],
  [90, 3, 0.972, 48],
  [260, 8, 0.988, 80],
  [330, 10, 0.99, 96],
  [120, 6, 0.958, 56],
];

export class AntSignalDemoAI implements SimulationAI {
  private nextGestureIn = 0.3;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.nextGestureIn = 0.3;
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
    const x = ctx.width * (0.14 + Math.random() * 0.72);
    const y = ctx.height * (0.16 + Math.random() * 0.68);
    const roll = Math.random();
    if (roll < 0.28) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.48) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.82) return [{ kind: 'drag', x, y, dx: -110 + Math.random() * 220, dy: -70 + Math.random() * 140, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -240 + Math.random() * 480, dy: -180 + Math.random() * 360, velocity: 2.1, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    const [antCount, foodCount, pheromoneDecay, fieldColumns] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('antCount', antCount);
    applyNumericSetting('foodCount', foodCount);
    applyNumericSetting('pheromoneDecay', pheromoneDecay);
    applyNumericSetting('resolution', fieldColumns);
    this.nextOverhaulIn = 18 + Math.random() * 13;
    this.elapsedSinceOverhaul = 0;
  }
}
