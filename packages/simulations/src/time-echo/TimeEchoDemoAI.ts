import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number, number]> = [
  [240, 30, 8, 0.72, 0.948],
  [360, 42, 12, 1.15, 0.962],
  [520, 58, 20, 1.9, 0.982],
  [180, 22, 5, 2.35, 0.936],
  [680, 76, 26, 0.48, 0.99],
];

export class TimeEchoDemoAI implements SimulationAI {
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
    this.nextGestureIn = 0.45 + Math.random() * 0.95;
    const x = ctx.width * (0.16 + Math.random() * 0.68);
    const y = ctx.height * (0.18 + Math.random() * 0.64);
    const roll = Math.random();
    if (roll < 0.28) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.5) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.82) return [{ kind: 'drag', x, y, dx: -170 + Math.random() * 340, dy: -120 + Math.random() * 240, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -360 + Math.random() * 720, dy: -240 + Math.random() * 480, velocity: 2.8, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    const [particleCount, historyLength, echoDelay, memoryPull, trailFade] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('particleCount', particleCount);
    applyNumericSetting('historyLength', historyLength);
    applyNumericSetting('echoDelay', echoDelay);
    applyNumericSetting('memoryPull', memoryPull);
    applyNumericSetting('trailFade', trailFade);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
