import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

// [cellCount, membranePoints, membraneTension, viscosity, pulseStrength, driftStrength, resolution]
const PARAM_PRESETS: Array<[number, number, number, number, number, number, number]> = [
  [10, 16, 0.38, 0.965, 85, 0.55, 96],
  [14, 18, 0.24, 0.985, 65, 0.95, 112],
  [7, 20, 0.58, 0.94, 130, 0.35, 80],
  [16, 12, 0.44, 0.955, 110, 1.2, 128],
  [5, 24, 0.72, 0.925, 155, 0.7, 64],
];

export class CellularOceanDemoAI implements SimulationAI {
  private nextGestureIn = 0.4;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

  reset(): void {
    this.nextGestureIn = 0.4;
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
    this.nextGestureIn = 0.5 + Math.random() * 0.9;
    const x = ctx.width * (0.16 + Math.random() * 0.68);
    const y = ctx.height * (0.18 + Math.random() * 0.64);
    const roll = Math.random();
    if (roll < 0.3) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.64) return [{ kind: 'drag', x, y, dx: -70 + Math.random() * 140, dy: -70 + Math.random() * 140, timestamp: Date.now() }];
    if (roll < 0.84) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -260 + Math.random() * 520, dy: -160 + Math.random() * 320, velocity: 2.4, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)]);
    const [cellCount, membranePoints, membraneTension, viscosity, pulseStrength, driftStrength, resolution] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    ctx.applyNumericSetting('cellCount', cellCount);
    ctx.applyNumericSetting('membranePoints', membranePoints);
    ctx.applyNumericSetting('membraneTension', membraneTension);
    ctx.applyNumericSetting('viscosity', viscosity);
    ctx.applyNumericSetting('pulseStrength', pulseStrength);
    ctx.applyNumericSetting('driftStrength', driftStrength);
    ctx.applyNumericSetting('resolution', resolution);
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.elapsedSinceOverhaul = 0;
  }
}
