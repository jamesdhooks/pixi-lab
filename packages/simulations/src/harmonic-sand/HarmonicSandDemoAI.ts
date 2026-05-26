import type { SimulationAI, SimAIContext } from '@hooksjam/pixi-lab-core';
import type { GestureEvent } from '@hooksjam/pixi-lab-core';

// Frequency presets that produce visually distinct Chladni patterns
const FREQ_PRESETS = [0.8, 1.2, 1.6, 2.0, 2.4, 3.0, 3.6, 4.2, 5.0, 6.0, 7.2];

/**
 * Demo AI for Harmonic Sand.
 *
 * On activation (and every 15–30 s thereafter):
 *   1. Resets the scene to clear all emitters
 *   2. Picks a random style and baseFrequency preset
 *   3. Queues 2–6 taps spread across the canvas to place emitters
 *
 * Taps are drained one per ~1.2 s so the `isNearAnyEmitter` guard never fires.
 */
export class HarmonicSandDemoAI implements SimulationAI {
  /** Positions queued to be tapped in one per ~1.2 s */
  private pendingTaps: Array<{ x: number; y: number }> = [];
  private tapCooldown = 0;

  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  // ── lifecycle ──────────────────────────────────────────────────────────────

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx, /* isFirst */ true);
  }

  reset(): void {
    this.pendingTaps = [];
    this.tapCooldown = 0;
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  // ── per-frame think ────────────────────────────────────────────────────────

  think(ctx: SimAIContext): GestureEvent[] {
    const { dt } = ctx;
    this.elapsedSinceOverhaul += dt;
    this.tapCooldown = Math.max(0, this.tapCooldown - dt);

    // Periodic full overhaul (self-triggers on first tick when nextOverhaulIn === 0)
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn && this.pendingTaps.length === 0) {
      this.doOverhaul(ctx, false);
      return [];
    }

    // Dispatch ALL pending taps at once so emitters appear together
    if (this.tapCooldown <= 0 && this.pendingTaps.length > 0) {
      const gestures = this.pendingTaps.splice(0).map((pos) => ({
        kind: 'tap' as const,
        x: pos.x,
        y: pos.y,
        timestamp: Date.now(),
      }));
      return gestures;
    }

    return [];
  }

  // ── internal ───────────────────────────────────────────────────────────────

  private doOverhaul(ctx: SimAIContext, isFirst: boolean): void {
    const { width, height, styleIds, applyStyle, applyNumericSetting, resetScene, clearEmittersOnly } = ctx;

    // 1. Full reset on first run; emitter-only clear on subsequent runs to avoid
    //    recreating the scalar field (which would flash black).
    if (isFirst) {
      resetScene();
    } else {
      clearEmittersOnly?.();
    }

    // 2. Random style
    const styles = styleIds.length ? styleIds : ['chladni-gold'];
    applyStyle(styles[Math.floor(Math.random() * styles.length)]);

    // 3. Random frequency preset
    const freq = FREQ_PRESETS[Math.floor(Math.random() * FREQ_PRESETS.length)];
    applyNumericSetting('baseFrequency', freq);

    // 4. Random field resolution — only on first run; changing it mid-session
    //    replaces the ScalarField with an all-zero field, causing a black flash.
    if (isFirst) {
      const resOptions = [128, 192, 256];
      applyNumericSetting('resolution', resOptions[Math.floor(Math.random() * resOptions.length)]);
    }

    // 5. Queue 1–3 tap positions — spread across the canvas avoiding edges
    const count = 1 + Math.floor(Math.random() * 3);
    this.pendingTaps = Array.from({ length: count }, () => ({
      x: width * (0.15 + Math.random() * 0.7),
      y: height * (0.15 + Math.random() * 0.7),
    }));

    // Full reset needs settle time; emitter-only clear can place immediately.
    this.tapCooldown = isFirst ? 1.0 : 0;
    this.nextOverhaulIn = 5;
    this.elapsedSinceOverhaul = 0;
  }
}
