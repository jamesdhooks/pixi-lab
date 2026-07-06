import type { SimulationAI, SimAIContext } from '@hooksjam/pixi-lab-core';
import type { GestureEvent } from '@hooksjam/pixi-lab-core';
import {
  applyHarmonicSandPreviewCaps,
  HARMONIC_PREVIEW_PROFILES,
  pickRandomStyleId,
  randomizeHarmonicSandSettings,
} from './harmonicSandRandomization.js';

interface HarmonicSandDemoAIOptions {
  /** Preview tiles should use gentler settings so blobs are smaller and more squishy. */
  previewMode?: boolean;
}

/**
 * Demo AI for Harmonic Sand.
 *
 * On activation (and every 15–30 s thereafter):
 *   1. Resets the scene to clear all emitters
 *   2. Picks a random style, render style, and full settings profile
 *   3. Queues 2–6 taps spread across the canvas to place emitters
 *
 * Taps are drained one per ~1.2 s so the `isNearAnyEmitter` guard never fires.
 */
export class HarmonicSandDemoAI implements SimulationAI {
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;
  private readonly previewMode: boolean;

  constructor(options: HarmonicSandDemoAIOptions = {}) {
    this.previewMode = options.previewMode ?? false;
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx, /* isFirst */ true);
  }

  reset(): void {
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
  }

  // ── per-frame think ────────────────────────────────────────────────────────

  think(ctx: SimAIContext): GestureEvent[] {
    const { dt } = ctx;
    this.elapsedSinceOverhaul += dt;

    // Periodic full overhaul (self-triggers on first tick when nextOverhaulIn === 0)
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx, false);
    }

    return [];
  }

  // ── internal ───────────────────────────────────────────────────────────────

  private doOverhaul(ctx: SimAIContext, isFirst: boolean): void {
    const { width, height, styleIds, applyStyle, applySetting, applyNumericSetting, pushGestures, resetScene, clearEmittersOnly } = ctx;

    // 1. Full reset on first run; emitter-only clear on subsequent runs. The
    //    new emitter gestures are pushed synchronously below, so the renderer
    //    does not present an empty/half-configured transition frame.
    if (isFirst) {
      resetScene();
      clearEmittersOnly?.();
    } else {
      clearEmittersOnly?.();
    }

    // 2. Random color style, render style, and full settings profile.
    applyStyle(pickRandomStyleId(styleIds));
    const settings = randomizeHarmonicSandSettings(
      { applySetting, applyNumericSetting },
      this.previewMode ? HARMONIC_PREVIEW_PROFILES : undefined,
    );
    const previewSettings = this.previewMode ? applyHarmonicSandPreviewCaps(settings) : settings;

    // 4. Place emitter positions immediately — spread across the canvas avoiding edges
    const sourceLimit = Math.max(1, Math.round(previewSettings.rawEmitterLimit));
    const count = Math.max(1, Math.min(sourceLimit, 2 + Math.floor(Math.random() * Math.min(6, sourceLimit))));
    const now = Date.now();
    const gestures: Parameters<typeof pushGestures>[0] = [];
    for (let index = 0; index < count; index += 1) {
      gestures.push({
        kind: 'tap' as const,
        x: width * (0.15 + Math.random() * 0.7),
        y: height * (0.15 + Math.random() * 0.7),
        timestamp: now + index,
      });
    }
    pushGestures(gestures);

    if (this.previewMode) {
      if (previewSettings.rawParticleCount < settings.rawParticleCount) {
        applyNumericSetting('rawParticleCount', previewSettings.rawParticleCount);
      }
      if (previewSettings.rawParticleDensity < settings.rawParticleDensity) {
        applyNumericSetting('rawParticleDensity', previewSettings.rawParticleDensity);
      }
      if (previewSettings.rawEmitterLimit < settings.rawEmitterLimit) {
        applyNumericSetting('rawEmitterLimit', previewSettings.rawEmitterLimit);
      }
      if (previewSettings.rawLineSharpness < settings.rawLineSharpness) {
        applyNumericSetting('rawLineSharpness', previewSettings.rawLineSharpness);
      }
      if (previewSettings.rawGlow < settings.rawGlow) {
        applyNumericSetting('rawGlow', previewSettings.rawGlow);
      }
    }
    this.nextOverhaulIn = 14 + Math.random() * 10;
    this.elapsedSinceOverhaul = 0;
  }
}
