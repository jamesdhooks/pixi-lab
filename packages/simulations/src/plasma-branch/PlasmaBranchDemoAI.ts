import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

const PARAM_PRESETS: Array<[number, number, number, number]> = [
  [220, 0.982, 0.95, 64],
  [160, 0.972, 0.7, 56],
  [280, 0.99, 1.15, 80],
  [120, 0.958, 1.3, 48],
  [340, 0.986, 0.85, 88],
];

export class PlasmaBranchDemoAI implements SimulationAI {
  private nextGestureIn = 0.28;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.nextGestureIn = 0.28;
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
    this.nextGestureIn = 0.45 + Math.random() * 1.05;
    const x = ctx.width * (0.15 + Math.random() * 0.7);
    const y = ctx.height * (0.15 + Math.random() * 0.7);
    const roll = Math.random();
    if (roll < 0.28) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.52) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.78) return [{ kind: 'drag', x, y, dx: -110 + Math.random() * 220, dy: -110 + Math.random() * 220, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -260 + Math.random() * 520, dy: -160 + Math.random() * 320, velocity: 2.3, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    const [maxBranches, chargeDecay, branchEnergy, fieldColumns] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('maxBranches', maxBranches);
    applyNumericSetting('chargeDecay', chargeDecay);
    applyNumericSetting('branchEnergy', branchEnergy);
    applyNumericSetting('resolution', fieldColumns);
    this.nextOverhaulIn = 16 + Math.random() * 14;
    this.elapsedSinceOverhaul = 0;
  }
}
