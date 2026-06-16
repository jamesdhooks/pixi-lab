import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

// [ringCount, spokeCount, springTension, damping, pulseStrength, resonance, resolution]
const PARAM_PRESETS: Array<[number, number, number, number, number, number, number]> = [
  [5, 16, 0.42, 0.965, 95, 1.15, 96],
  [4, 20, 0.68, 0.94, 135, 1.65, 112],
  [7, 14, 0.28, 0.985, 70, 0.75, 80],
  [6, 22, 0.52, 0.955, 160, 2.05, 128],
  [3, 12, 0.82, 0.925, 190, 1.35, 64],
];

export class JellyWebDemoAI implements SimulationAI {
  private nextGestureIn = 0.35;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  onActivate(ctx: SimAIContext): void { this.doOverhaul(ctx); }

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
    this.nextGestureIn = 0.45 + Math.random() * 0.95;
    const x = ctx.width * (0.18 + Math.random() * 0.64);
    const y = ctx.height * (0.2 + Math.random() * 0.6);
    const roll = Math.random();
    if (roll < 0.28) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.66) return [{ kind: 'drag', x, y, dx: -80 + Math.random() * 160, dy: -60 + Math.random() * 120, timestamp: Date.now() }];
    if (roll < 0.86) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -220 + Math.random() * 440, dy: -90 + Math.random() * 180, velocity: 2.2, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    const [ringCount, spokeCount, springTension, damping, pulseStrength, resonance, resolution] = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('ringCount', ringCount);
    applyNumericSetting('spokeCount', spokeCount);
    applyNumericSetting('springTension', springTension);
    applyNumericSetting('damping', damping);
    applyNumericSetting('pulseStrength', pulseStrength);
    applyNumericSetting('resonance', resonance);
    applyNumericSetting('resolution', resolution);
    this.nextOverhaulIn = 18 + Math.random() * 16;
    this.elapsedSinceOverhaul = 0;
  }
}
