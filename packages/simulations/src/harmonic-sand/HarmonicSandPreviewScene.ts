import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { harmonicSandStyleManifest } from './harmonicSandStyleManifest.js';
import {
  applyHarmonicSandPreviewCaps,
  HARMONIC_PREVIEW_PROFILES,
  pickRandomStyleId,
  randomizeHarmonicSandSettings,
} from './harmonicSandRandomization.js';
import { RawHarmonicSandScene } from './RawHarmonicSandScene.js';

export class HarmonicSandPreviewScene extends RawHarmonicSandScene {
  override readonly name = 'HarmonicSandPreview';

  constructor() {
    super();
    this.setQuality('basic');
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const { width, height } = ctx;

    const styleIds = harmonicSandStyleManifest.styles
      .filter((style) => style.id !== '__random__')
      .map((style) => style.id);
    const styleId = pickRandomStyleId(styleIds);
    ctx.systems.styleManager?.setStyle(styleId);
    this.setStyle(styleId);

    const settings = randomizeHarmonicSandSettings(
      {
        applySetting: (key, value) => ctx.systems.settings.set(key, value),
        applyNumericSetting: (key, value) => ctx.systems.settings.set(key, value),
      },
      HARMONIC_PREVIEW_PROFILES,
    );
    const previewSettings = applyHarmonicSandPreviewCaps(settings);
    if (previewSettings.rawParticleCount < settings.rawParticleCount) {
      ctx.systems.settings.set('rawParticleCount', previewSettings.rawParticleCount);
    }
    if (previewSettings.rawParticleDensity < settings.rawParticleDensity) {
      ctx.systems.settings.set('rawParticleDensity', previewSettings.rawParticleDensity);
    }
    if (previewSettings.rawEmitterLimit < settings.rawEmitterLimit) {
      ctx.systems.settings.set('rawEmitterLimit', previewSettings.rawEmitterLimit);
    }
    if (previewSettings.rawLineSharpness < settings.rawLineSharpness) {
      ctx.systems.settings.set('rawLineSharpness', previewSettings.rawLineSharpness);
    }
    if (previewSettings.rawGlow < settings.rawGlow) {
      ctx.systems.settings.set('rawGlow', previewSettings.rawGlow);
    }

    const count = Math.max(2, Math.min(5, Math.round(previewSettings.rawEmitterLimit)));
    const now = Date.now();
    const gestures: Parameters<this['pushGestures']>[0] = [];
    for (let index = 0; index < count; index += 1) {
      gestures.push({
        kind: 'tap' as const,
        x: width * (0.12 + Math.random() * 0.76),
        y: height * (0.14 + Math.random() * 0.72),
        timestamp: now + index,
      });
    }
    this.pushGestures(gestures);
  }
}
