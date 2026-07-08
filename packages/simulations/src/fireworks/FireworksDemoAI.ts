import type { GestureEvent, SettingsField, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';
import { FIREWORKS_SETTINGS_FIELDS } from './fireworks.config.js';

const PARAM_PRESETS: Array<{
  launchPower: number;
  launchSpread: number;
  shellFuse: number;
  gravity: number;
  airDrag: number;
  burstParticles: number;
  explosionPower: number;
  secondaryChance: number;
  secondaryDepth: number;
  secondaryScale: number;
  crackleIntensity: number;
  particleSize: number;
  trailFade: number;
  bloomStrength: number;
  autoFinaleRate: number;
}> = [
  { launchPower: 880, launchSpread: 0.12, shellFuse: 1.12, gravity: 320, airDrag: 0.22, burstParticles: 256, explosionPower: 330, secondaryChance: 0.34, secondaryDepth: 1, secondaryScale: 0.5, crackleIntensity: 0.54, particleSize: 1.28, trailFade: 0.92, bloomStrength: 1.58, autoFinaleRate: 2.1 },
  { launchPower: 1160, launchSpread: 0.28, shellFuse: 1.52, gravity: 410, airDrag: 0.42, burstParticles: 512, explosionPower: 440, secondaryChance: 0.56, secondaryDepth: 2, secondaryScale: 0.58, crackleIntensity: 0.9, particleSize: 1.62, trailFade: 0.944, bloomStrength: 2.05, autoFinaleRate: 3.2 },
  { launchPower: 1380, launchSpread: 0.42, shellFuse: 1.84, gravity: 520, airDrag: 0.72, burstParticles: 1024, explosionPower: 570, secondaryChance: 0.72, secondaryDepth: 3, secondaryScale: 0.44, crackleIntensity: 1.22, particleSize: 1.96, trailFade: 0.965, bloomStrength: 2.72, autoFinaleRate: 4.6 },
  { launchPower: 720, launchSpread: 0.08, shellFuse: 0.9, gravity: 260, airDrag: 0.16, burstParticles: 256, explosionPower: 260, secondaryChance: 0.24, secondaryDepth: 1, secondaryScale: 0.62, crackleIntensity: 0.42, particleSize: 1.06, trailFade: 0.89, bloomStrength: 1.34, autoFinaleRate: 1.5 },
];

interface FireworksDemoAIOptions {
  liteMode?: boolean;
  rawParticleTextureSizeMax?: number;
}

export class FireworksDemoAI implements SimulationAI {
  private readonly liteMode: boolean;
  private readonly rawParticleTextureSizeMax: number;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;
  private nextGestureIn = 0.2;
  private pointerId = -4000;

  constructor(options: FireworksDemoAIOptions = {}) {
    this.liteMode = options.liteMode ?? false;
    this.rawParticleTextureSizeMax = options.rawParticleTextureSizeMax ?? 256;
  }

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
    this.nextGestureIn = 0.2;
    this.pointerId = -4000;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    this.nextGestureIn -= ctx.dt;

    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx);
      return [];
    }

    if (this.nextGestureIn > 0) return [];
    this.nextGestureIn = 0.28 + Math.random() * 0.95;
    const x = ctx.width * (0.12 + Math.random() * 0.76);
    const y = ctx.height * (0.1 + Math.random() * 0.42);
    const timestamp = Date.now();
    const roll = Math.random();
    if (roll < 0.48) return [{ kind: 'tap', id: this.nextPointerId(), x, y, timestamp }];
    if (roll < 0.72) return [{ kind: 'double_tap', id: this.nextPointerId(), x, y, timestamp }];
    return [{
      kind: 'fast_swipe',
      id: this.nextPointerId(),
      x,
      y,
      dx: -220 + Math.random() * 440,
      dy: -180 + Math.random() * 120,
      velocity: 2 + Math.random() * 2.2,
      timestamp,
    }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)] ?? ctx.styleIds[0]);
    const preset = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)] ?? PARAM_PRESETS[0];
    for (const field of FIREWORKS_SETTINGS_FIELDS) {
      if (field.type === 'number') {
        ctx.applyNumericSetting(field.key, preset[field.key as keyof typeof preset] ?? pickRandomNumberForField(field));
      } else if (field.type === 'select') {
        const options = field.key === 'rawParticleTextureSize' && this.liteMode
          ? (field.options ?? []).filter((option) => Number(option.value) <= this.rawParticleTextureSizeMax)
          : field.options ?? [];
        const choice = options[Math.floor(Math.random() * Math.max(1, options.length))]?.value ?? field.default;
        ctx.applySetting(field.key, choice);
      } else if (field.type === 'boolean') {
        ctx.applySetting(field.key, Math.random() < 0.5);
      }
    }
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 18 + Math.random() * 17;
    this.nextGestureIn = 0.1;
  }

  private nextPointerId(): number {
    this.pointerId -= 1;
    if (this.pointerId < -4999) this.pointerId = -4000;
    return this.pointerId;
  }
}

function pickRandomNumberForField(field: SettingsField): number {
  const min = typeof field.min === 'number' ? field.min : 0;
  const max = typeof field.max === 'number' ? field.max : min;
  const step = typeof field.step === 'number' && field.step > 0 ? field.step : 1;
  const snapped = Math.round((min + Math.random() * (max - min)) / step) * step;
  const decimals = step < 1 ? step.toString().split('.')[1]?.length ?? 0 : 0;
  return Number(Math.max(min, Math.min(max, snapped)).toFixed(Math.min(4, decimals)));
}
