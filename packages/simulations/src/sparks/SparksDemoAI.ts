import type { GestureEvent, SettingsField, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';
import { SPARKS_SETTINGS_FIELDS } from './sparks.config.js';

const PARAM_PRESETS: Array<{
  emissionRate: number;
  sparkPower: number;
  torchRadius: number;
  contactHeat: number;
  coreFlashRate: number;
  coreFlashSize: number;
  coreFlashVariability: number;
  coreAfterglow: number;
  bounceRestitution: number;
  splitChance: number;
  maxSplits: number;
  gravity: number;
  airDrag: number;
  surfaceFriction: number;
  particleSize: number;
  trailFade: number;
  bloomStrength: number;
  heatRadius: number;
  coreIntensity: number;
}> = [
  { emissionRate: 620, sparkPower: 320, torchRadius: 14, contactHeat: 1.0, coreFlashRate: 2.4, coreFlashSize: 0.82, coreFlashVariability: 0.38, coreAfterglow: 0.28, bounceRestitution: 0.44, splitChance: 0.32, maxSplits: 1, gravity: 540, airDrag: 1.15, surfaceFriction: 0.24, particleSize: 1.22, trailFade: 0.86, bloomStrength: 1.8, heatRadius: 24, coreIntensity: 1.55 },
  { emissionRate: 940, sparkPower: 430, torchRadius: 18, contactHeat: 1.35, coreFlashRate: 3.1, coreFlashSize: 0.96, coreFlashVariability: 0.5, coreAfterglow: 0.34, bounceRestitution: 0.58, splitChance: 0.48, maxSplits: 2, gravity: 640, airDrag: 0.86, surfaceFriction: 0.18, particleSize: 1.45, trailFade: 0.91, bloomStrength: 2.45, heatRadius: 34, coreIntensity: 2.2 },
  { emissionRate: 1480, sparkPower: 620, torchRadius: 22, contactHeat: 1.72, coreFlashRate: 4.2, coreFlashSize: 1.08, coreFlashVariability: 0.62, coreAfterglow: 0.42, bounceRestitution: 0.66, splitChance: 0.62, maxSplits: 3, gravity: 760, airDrag: 0.62, surfaceFriction: 0.12, particleSize: 1.72, trailFade: 0.944, bloomStrength: 3.1, heatRadius: 48, coreIntensity: 2.85 },
  { emissionRate: 2100, sparkPower: 820, torchRadius: 26, contactHeat: 2.05, coreFlashRate: 5.4, coreFlashSize: 1.24, coreFlashVariability: 0.72, coreAfterglow: 0.48, bounceRestitution: 0.74, splitChance: 0.78, maxSplits: 4, gravity: 920, airDrag: 0.42, surfaceFriction: 0.08, particleSize: 1.95, trailFade: 0.966, bloomStrength: 4.0, heatRadius: 68, coreIntensity: 3.55 },
];

const RENDER_STYLES = ['basic', 'enhanced', 'ultra'] as const;

interface SparksDemoAIOptions {
  liteMode?: boolean;
  rawParticleTextureSizeMax?: number;
}

export class SparksDemoAI implements SimulationAI {
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;
  private phase = 0;
  private pointerId = -7600;

  constructor(private readonly options: SparksDemoAIOptions = {}) {}

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = 0;
    this.phase = 0;
    this.pointerId = -7600;
  }

  think(ctx: SimAIContext): GestureEvent[] {
    this.elapsedSinceOverhaul += ctx.dt;
    if (this.elapsedSinceOverhaul >= this.nextOverhaulIn) {
      this.doOverhaul(ctx);
      return [];
    }

    this.phase += ctx.dt;
    const x = ctx.width * (0.5 + Math.sin(this.phase * 0.85) * 0.32);
    const y = ctx.height * (0.58 + Math.sin(this.phase * 1.2) * 0.11);
    const dx = Math.cos(this.phase * 1.45) * ctx.width * (this.options.liteMode ? 0.004 : 0.012);
    const dy = Math.sin(this.phase * 2.2) * ctx.height * 0.006;
    return [{
      kind: 'drag',
      id: this.pointerId,
      x,
      y,
      dx,
      dy,
      strength: this.options.liteMode ? 0.7 : 1.0,
      velocity: Math.hypot(dx, dy),
      timestamp: Date.now(),
    }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    ctx.resetScene();
    if (ctx.styleIds.length > 0) ctx.applyStyle(ctx.styleIds[Math.floor(Math.random() * ctx.styleIds.length)] ?? ctx.styleIds[0]);
    const preset = PARAM_PRESETS[Math.floor(Math.random() * PARAM_PRESETS.length)] ?? PARAM_PRESETS[1];
    for (const field of SPARKS_SETTINGS_FIELDS) {
      if (field.type === 'number') {
        const value = preset[field.key as keyof typeof preset] ?? pickRandomNumberForField(field);
        ctx.applyNumericSetting(field.key, this.options.liteMode && field.key === 'emissionRate' ? Math.min(value, 940) : value);
      } else if (field.type === 'select') {
        if (field.key === 'rawParticleTextureSize') {
          const maxEdge = this.options.rawParticleTextureSizeMax ?? (this.options.liteMode ? 256 : 768);
          const options = (field.options ?? []).filter((option) => Number(option.value) <= maxEdge);
          ctx.applySetting(field.key, options[Math.floor(Math.random() * Math.max(1, options.length))]?.value ?? field.default);
        } else if (field.key === 'renderStyle') {
          ctx.applySetting(field.key, this.options.liteMode ? 'enhanced' : RENDER_STYLES[Math.floor(Math.random() * RENDER_STYLES.length)] ?? 'enhanced');
        }
      }
    }
    this.elapsedSinceOverhaul = 0;
    this.nextOverhaulIn = this.options.liteMode ? 10 + Math.random() * 8 : 18 + Math.random() * 17;
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
