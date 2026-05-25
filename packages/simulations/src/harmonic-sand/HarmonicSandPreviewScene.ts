import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { HarmonicSandScene, harmonicSandStyleManifest } from './HarmonicSandScene';

const PREVIEW_FREQS = [1.2, 2.0, 3.0, 4.2, 6.0];

export class HarmonicSandPreviewScene extends HarmonicSandScene {
  override readonly name = 'HarmonicSandPreview';

  constructor() {
    // Low-resolution field for a preview tile — keeps CPU low.
    super(48);
  }

  override onEnter(ctx: GameContext, input: Input): void {
    super.onEnter(ctx, input);
    const { width, height } = ctx;

    // Randomise style and base frequency so each tile looks different.
    const styles = harmonicSandStyleManifest.styles.filter((s) => s.id !== '__random__');
    const style = styles[Math.floor(Math.random() * styles.length)];
    this.setStyle(style.id);
    const freq = PREVIEW_FREQS[Math.floor(Math.random() * PREVIEW_FREQS.length)];
    ctx.systems.settings.set('baseFrequency', freq);

    // Pre-queue 3 taps at randomised positions spread across the canvas.
    const now = Date.now();
    this.pushGestures([
      { kind: 'tap', x: width * (0.15 + Math.random() * 0.25), y: height * (0.15 + Math.random() * 0.25), timestamp: now },
      { kind: 'tap', x: width * (0.55 + Math.random() * 0.25), y: height * (0.15 + Math.random() * 0.25), timestamp: now + 1 },
      { kind: 'tap', x: width * (0.25 + Math.random() * 0.40), y: height * (0.60 + Math.random() * 0.20), timestamp: now + 2 },
    ]);
  }
}
