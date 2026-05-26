import type { GestureEvent, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';

/**
 * Demo AI for Mycelium Lattice.
 *
 * Every 18–32 s it resets the scene, picks a random style, and applies a
 * preset combination of probability-focused settings.  Between overhuals it
 * generates taps and drags to seed new colonies across the grid.
 */

// [growthProbability, branchChance, generationHueStep, resolution]
const PARAM_PRESETS: Array<[number, number, number, number]> = [
  [0.52, 0.10, 13, 96],   // default — balanced organic spread
  [0.80, 0.05, 20, 80],   // fast, straight-running — tight corridors
  [0.30, 0.35, 8,  64],   // slow, highly branched — dense bushy clusters
  [0.65, 0.20, 28, 96],   // medium probability, vivid generation colour shift
  [0.90, 0.02, 5,  128],  // explosive probability, minimal branching
  [0.40, 0.45, 35, 64],   // moderate probability, max branching, wide hue drift
  [0.55, 0.15, 13, 128],  // default probability at high resolution
];

export class MyceliumLatticeDemoAI implements SimulationAI {
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0; // triggers immediately on first tick
  private nextGestureIn = 0.5;

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
    this.nextGestureIn = 0.5;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn        -= ctx.dt;

    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx);
      return [];
    }

    if (this.nextGestureIn > 0) return [];

    this.nextGestureIn = 0.8 + Math.random() * 1.6;
    const x = ctx.width  * (0.12 + Math.random() * 0.76);
    const y = ctx.height * (0.12 + Math.random() * 0.76);
    const roll = Math.random();
    if (roll < 0.55) return [{ kind: 'tap',  x, y, timestamp: Date.now() }];
    return [{ kind: 'drag', x, y, dx: -40 + Math.random() * 80, dy: -40 + Math.random() * 80, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);
    const [growthProb, branchChance, genHueStep, resolution] =
      PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)];
    applyNumericSetting('growthProbability', growthProb);
    applyNumericSetting('branchChance',      branchChance);
    applyNumericSetting('generationHueStep', genHueStep);
    applyNumericSetting('resolution',        resolution);
    this.nextOverhaulIn       = 18 + Math.random() * 14;
    this.elapsedSinceOverhaul = 0;
  }
}
