import type { GameContext, Input } from '@hooksjam/pixi-lab-core';
import { RawOrbitalShrapnelReferenceScene } from './RawOrbitalShrapnelReferenceScene.js';

export class OrbitalShrapnelPreviewScene extends RawOrbitalShrapnelReferenceScene {
  override readonly name = 'OrbitalShrapnelPreview';

  constructor() {
    super();
  }

  override onEnter(ctx: GameContext, input: Input): void {
    ctx.systems.settings.set('rawParticleTextureSize', '64');
    ctx.systems.settings.set('trailFade', 0.72);
    ctx.systems.settings.set('bloomStrength', 0.12);
    ctx.systems.settings.set('streakStrength', 0.05);
    ctx.systems.settings.set('debrisSize', 0.12);
    ctx.systems.settings.set('debrisOpacity', 0.68);
    ctx.systems.settings.set('secondaryBodyCount', 1);
    ctx.systems.settings.set('secondaryBodyStrength', 0.12);
    ctx.systems.settings.set('planetRadius', 42);
    ctx.systems.settings.set('gravity', 780);
    super.onEnter(ctx, input);
    this.setMode('demo');
    const now = Date.now();
    this.pushGestures([
      { kind: 'hold', x: ctx.width * 0.72, y: ctx.height * 0.55, timestamp: now },
      { kind: 'drag', x: ctx.width * 0.5, y: ctx.height * 0.45, dx: 70, dy: -22, timestamp: now + 1 },
      { kind: 'fast_swipe', x: ctx.width * 0.42, y: ctx.height * 0.52, dx: 150, dy: 18, velocity: 1.9, timestamp: now + 2 },
    ]);
  }
}
