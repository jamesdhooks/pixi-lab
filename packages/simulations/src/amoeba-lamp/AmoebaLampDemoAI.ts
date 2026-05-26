import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

/**
 * Demo AI for Amoeba Lamp.
 *
 * On activation (and every 18–30 s thereafter):
 *   1. Resets the scene to re-seed blob positions
 *   2. Picks a random style
 *   3. Applies a preset combination of all slider settings
 *   4. Generates a mix of taps, drags, holds, and fast swipes between overhuals
 */

// Preset tuples [buoyancy, surfaceTension, densityRadius, blobCount, particleBudget]
// chosen to produce visually distinct blob moods. Values stay within SettingsField ranges.
const PARAM_PRESETS: Array<[number, number, number, number, number]> = [
  [58,  0.72, 3.4,  8, 56],  // default — balanced
  [90,  0.35, 4.5,  6, 48],  // fast-rising, loose, wide halos
  [28,  1.10, 2.4, 10, 64],  // slow, cohesive, tight metaballs
  [75,  0.55, 5.2,  5, 40],  // quick spreading, few large blobs
  [42,  0.95, 3.0, 12, 72],  // dense, surface-tight colony
  [105, 0.28, 4.2,  7, 56],  // maximum buoyancy, very loose
];

export class AmoebaLampDemoAI implements SimulationAI {
  private nextGestureIn = 0.3;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0; // 0 triggers an overhaul on the very first tick

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
    this.nextGestureIn = 0.65 + Math.random() * 1.15;
    const x = ctx.width * (0.18 + Math.random() * 0.64);
    const y = ctx.height * (0.18 + Math.random() * 0.7);
    const roll = Math.random();
    if (roll < 0.22) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.58) return [{ kind: 'drag', x, y, dx: -70 + Math.random() * 140, dy: -40 + Math.random() * 80, timestamp: Date.now() }];
    if (roll < 0.82) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -160 + Math.random() * 320, dy: -30 + Math.random() * 60, velocity: 1.8, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;

    resetScene();

    if (styleIds.length > 0) {
      applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    }

    const [buoyancy, surfaceTension, densityRadius, blobCount, particleBudget] =
      PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('buoyancy', buoyancy);
    applyNumericSetting('surfaceTension', surfaceTension);
    applyNumericSetting('densityRadius', densityRadius);
    applyNumericSetting('blobCount', blobCount);
    applyNumericSetting('particleBudget', particleBudget);

    this.nextOverhaulIn = 18 + Math.random() * 12; // 18–30 s
    this.elapsedSinceOverhaul = 0;
  }
}
