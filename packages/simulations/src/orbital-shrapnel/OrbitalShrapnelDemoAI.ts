import type { GestureEvent, SettingsField, SimAIContext, SimulationAI } from '@hooksjam/pixi-lab-core';
import { ORBITAL_SHRAPNEL_SETTINGS_FIELDS } from './orbital-shrapnel.config.js';

const RAW_PARTICLE_TEXTURE_SIZE_PREVIEW_LIMIT = 256;

interface OrbitalShrapnelDemoAIOptions {
  liteMode?: boolean;
  rawParticleTextureSizeMax?: number;
}

export class OrbitalShrapnelDemoAI implements SimulationAI {
  private readonly liteMode: boolean;
  private readonly rawParticleTextureSizeMax: number;
  private nextGestureIn = 0.35;
  private elapsedSinceOverhaul = 0;
  private nextOverhaulIn = 0;

  constructor(options: OrbitalShrapnelDemoAIOptions = {}) {
    this.liteMode = options.liteMode ?? false;
    this.rawParticleTextureSizeMax =
      options.rawParticleTextureSizeMax !== undefined
        ? Math.max(64, options.rawParticleTextureSizeMax)
        : RAW_PARTICLE_TEXTURE_SIZE_PREVIEW_LIMIT;
    if (!this.liteMode) {
      this.rawParticleTextureSizeMax = Number.POSITIVE_INFINITY;
    }
  }

  onActivate(ctx: SimAIContext): void {
    this.doOverhaul(ctx);
  }

  reset(): void {
    this.nextGestureIn = 0.35;
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
    this.nextGestureIn = 0.55 + Math.random() * 1.1;
    const x = ctx.width * (0.2 + Math.random() * 0.6);
    const y = ctx.height * (0.18 + Math.random() * 0.64);
    const roll = Math.random();
    if (roll < 0.22) return [{ kind: 'tap', x, y, timestamp: Date.now() }];
    if (roll < 0.48) return [{ kind: 'hold', x, y, timestamp: Date.now() }];
    if (roll < 0.76) return [{ kind: 'drag', x, y, dx: -120 + Math.random() * 240, dy: -80 + Math.random() * 160, timestamp: Date.now() }];
    return [{ kind: 'fast_swipe', x, y, dx: -300 + Math.random() * 600, dy: -220 + Math.random() * 440, velocity: 2.6, timestamp: Date.now() }];
  }

  private doOverhaul(ctx: SimAIContext): void {
    const { styleIds, applyStyle, applySetting, applyNumericSetting, resetScene } = ctx;
    resetScene();
    if (styleIds.length > 0) applyStyle(styleIds[Math.floor(Math.random() * styleIds.length)]);

    for (const field of ORBITAL_SHRAPNEL_SETTINGS_FIELDS) {
      switch (field.type) {
        case 'number': {
          const value = pickRandomNumberForField(field);
          applyNumericSetting(field.key, value);
          break;
        }
        case 'boolean': {
          applySetting(field.key, Math.random() < 0.5);
          break;
        }
        case 'select': {
          const options = field.key === 'rawParticleTextureSize' && this.liteMode
            ? getLiteRawParticleTextureSizeOptions(field.options, this.rawParticleTextureSizeMax)
            : field.options ?? [];
          if (options.length === 0) break;
          const choice = options[Math.floor(Math.random() * options.length)]?.value;
          if (choice !== undefined) {
            applySetting(field.key, choice);
          }
          break;
        }
        default:
          break;
      }
    }
    this.nextOverhaulIn = 18 + Math.random() * 14;
    this.elapsedSinceOverhaul = 0;
  }
}

function getLiteRawParticleTextureSizeOptions(
  options: { label: string; value: string }[] = [],
  maxSize: number,
): { label: string; value: string }[] {
  if (options.length === 0) return [];
  const filtered = options.filter((option) => Number(option.value) <= maxSize);
  if (filtered.length > 0) return filtered;
  return options;
}

function pickRandomNumberForField(field: SettingsField): number {
  const min = typeof field.min === 'number' ? field.min : 0;
  const max = typeof field.max === 'number' ? field.max : min;
  const step = typeof field.step === 'number' && field.step > 0 ? field.step : 1;
  const span = Math.max(0, max - min);
  const base = min + Math.random() * span;
  const quantized = Math.round(base / step) * step;
  const snapped = Math.max(min, Math.min(max, quantized));
  const decimals = step < 1 ? step.toString().split('.')[1]?.length ?? 0 : 0;
  return Number(snapped.toFixed(Math.min(4, decimals)));
}
