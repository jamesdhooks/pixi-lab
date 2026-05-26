import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

/**
 * Demo AI for Mycelium Prism.
 *
 * On activation (and every 20–35 s thereafter):
 *   1. Resets the scene to re-seed colony positions
 *   2. Picks a random style
 *   3. Applies a preset combination of all slider settings
 *   4. Generates taps, drags, and fast swipes between overhuals to seed new colonies
 */

// Preset tuples [growthRate, nutrientDiffusion, gridColumns]
// chosen to produce visually distinct mycelium behaviors. Values stay within SettingsField ranges.
const PARAM_PRESETS: Array<[number, number, number]> = [
  [0.62, 0.18, 56],  // default — balanced tendrils
  [1.0,  0.08, 64],  // aggressive, tight — dense vein networks
  [0.30, 0.40, 48],  // slow, diffuse — soft gradient halos
  [0.80, 0.25, 72],  // medium-fast with fine detail at high resolution
  [0.45, 0.12, 40],  // cautious, precise branching at low resolution
  [1.10, 0.35, 56],  // explosive growth with wide nutrient spread
];

export class MyceliumPrismDemoAI implements SimulationAI {
  private elapsed = 0;
  private nextGestureIn = 0.4;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0; // 0 triggers an overhaul on the very first tick

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.elapsed = 0;
    this.nextGestureIn = 0.4;
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsed += ctx.dt;
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;

    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx);
      return [];
    }

    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.75 + Math.random() * 1.4;
    const x = ctx.width * (0.15 + Math.random() * 0.7);
    const y = ctx.height * (0.15 + Math.random() * 0.7);
    const roll = Math.random();
    if (roll < 0.42) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.84) return [{ kind: 'drag', x, y, dx: -30 + Math.random() * 60, dy: -30 + Math.random() * 60, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -90 + Math.random() * 180, dy: -90 + Math.random() * 180, velocity: 1.2, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;

    resetScene();

    if (styleIds.length > 0) {
      applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    }

    const [growthRate, nutrientDiffusion, gridColumns] =
      PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('growthRate', growthRate);
    applyNumericSetting('nutrientDiffusion', nutrientDiffusion);
    applyNumericSetting('gridColumns', gridColumns);

    this.nextOverhaulIn = 20 + Math.random() * 15; // 20–35 s
    this.elapsedSinceOverhaul = 0;
  }
}
