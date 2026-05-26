import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

// [voltage, osmoticPressure, membraneElasticity, ionDiffusion, cellCount, particleBudget, resolution]
const PARAM_PRESETS: Array<[number, number, number, number, number, number, number]> = [
  [0.45, 0.75, 0.62, 0.28, 9, 96, 96],
  [1.05, 0.35, 0.38, 0.55, 6, 84, 128],
  [-0.8, 1.35, 1.05, 0.18, 12, 132, 96],
  [0.25, 1.6, 0.82, 0.36, 15, 150, 128],
  [-1.05, 0.55, 0.24, 0.68, 7, 108, 64],
  [0.82, 1.05, 1.22, 0.24, 10, 120, 160],
];

export class ElectroOsmoticAmoebaDemoAI implements SimulationAI {
  private nextGestureIn = 0.25;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

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
    this.nextGestureIn = 0.55 + Math.random() * 1.1;
    const x = ctx.width * (0.16 + Math.random() * 0.68);
    const y = ctx.height * (0.16 + Math.random() * 0.72);
    const roll = Math.random();
    if (roll < 0.2) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.56) return [{ kind: 'drag', x, y, dx: -90 + Math.random() * 180, dy: -50 + Math.random() * 100, timestamp: Date.now() }];
    if (roll < 0.82) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -190 + Math.random() * 380, dy: -60 + Math.random() * 120, velocity: 2, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    const [voltage, osmoticPressure, membraneElasticity, ionDiffusion, cellCount, particleBudget, resolution] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('voltage', voltage);
    applyNumericSetting('osmoticPressure', osmoticPressure);
    applyNumericSetting('membraneElasticity', membraneElasticity);
    applyNumericSetting('ionDiffusion', ionDiffusion);
    applyNumericSetting('cellCount', cellCount);
    applyNumericSetting('particleBudget', particleBudget);
    applyNumericSetting('resolution', resolution);
    this.nextOverhaulIn = 18 + Math.random() * 14;
    this.elapsedSinceOverhaul = 0;
  }
}
