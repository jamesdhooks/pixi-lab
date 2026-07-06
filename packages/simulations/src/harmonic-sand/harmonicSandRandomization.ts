export const HARMONIC_FREQ_PRESETS = [0.8, 1.2, 1.6, 2.0, 2.4, 3.0, 3.6, 4.2, 5.0, 6.0, 7.2] as const;
export const HARMONIC_RENDER_STYLE_PRESETS = ['basic', 'enhanced', 'ultra'] as const;

export type HarmonicRenderStylePreset = (typeof HARMONIC_RENDER_STYLE_PRESETS)[number];

export interface HarmonicSandProfile {
  resolution: number;
  wavePeriod: number;
  rawParticleCount: number;
  rawParticleDensity: number;
  rawEmitterLimit: number;
  rawLineSharpness: number;
  rawGlow: number;
}

export interface HarmonicSandAppliedSettings extends HarmonicSandProfile {
  renderStyle: HarmonicRenderStylePreset;
  baseFrequency: number;
}

export interface HarmonicSandSettingsWriter {
  applySetting: (key: string, value: string) => void;
  applyNumericSetting: (key: string, value: number) => void;
}

export const HARMONIC_DEMO_PROFILES: readonly HarmonicSandProfile[] = [
  { resolution: 32, wavePeriod: 1.0, rawParticleCount: 25_000, rawParticleDensity: 0.35, rawEmitterLimit: 2, rawLineSharpness: 0.15, rawGlow: 0.3 },
  { resolution: 128, wavePeriod: 0.8, rawParticleCount: 180_000, rawParticleDensity: 1.25, rawEmitterLimit: 6, rawLineSharpness: 1.8, rawGlow: 1.35 },
  { resolution: 384, wavePeriod: 1.35, rawParticleCount: 360_000, rawParticleDensity: 2.2, rawEmitterLimit: 8, rawLineSharpness: 2.45, rawGlow: 3.5 },
  { resolution: 1024, wavePeriod: 2.4, rawParticleCount: 900_000, rawParticleDensity: 4.6, rawEmitterLimit: 12, rawLineSharpness: 3.1, rawGlow: 9 },
  { resolution: 2048, wavePeriod: 5.8, rawParticleCount: 1_850_000, rawParticleDensity: 7.4, rawEmitterLimit: 16, rawLineSharpness: 1.25, rawGlow: 26 },
];

export const HARMONIC_PREVIEW_PROFILES: readonly HarmonicSandProfile[] = [
  { resolution: 32, wavePeriod: 1.0, rawParticleCount: 25_000, rawParticleDensity: 0.45, rawEmitterLimit: 2, rawLineSharpness: 0.25, rawGlow: 0.35 },
  { resolution: 96, wavePeriod: 0.9, rawParticleCount: 52_000, rawParticleDensity: 0.76, rawEmitterLimit: 3, rawLineSharpness: 0.58, rawGlow: 0.68 },
  { resolution: 128, wavePeriod: 1.15, rawParticleCount: 64_000, rawParticleDensity: 0.94, rawEmitterLimit: 3, rawLineSharpness: 0.72, rawGlow: 0.9 },
  { resolution: 160, wavePeriod: 1.45, rawParticleCount: 72_000, rawParticleDensity: 1.02, rawEmitterLimit: 4, rawLineSharpness: 0.66, rawGlow: 1.05 },
  { resolution: 196, wavePeriod: 1.8, rawParticleCount: 78_000, rawParticleDensity: 1.18, rawEmitterLimit: 4, rawLineSharpness: 0.78, rawGlow: 1.18 },
];

export const HARMONIC_PREVIEW_PROFILE_LIMITS = {
  rawParticleCount: 90_000,
  rawParticleDensity: 1.25,
  rawEmitterLimit: 4,
  rawLineSharpness: 0.82,
  rawGlow: 1.2,
} as const;

export function pickRandom<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

export function pickRandomStyleId(styleIds: readonly string[], fallback = 'chladni-gold'): string {
  return styleIds.length > 0 ? pickRandom(styleIds) : fallback;
}

export function randomizeHarmonicSandSettings(
  writer: HarmonicSandSettingsWriter,
  profiles: readonly HarmonicSandProfile[] = HARMONIC_DEMO_PROFILES,
): HarmonicSandAppliedSettings {
  const profile = pickRandom(profiles);
  const applied: HarmonicSandAppliedSettings = {
    renderStyle: pickRandom(HARMONIC_RENDER_STYLE_PRESETS),
    resolution: jitterStepped(profile.resolution, 0.35, 32, 32, 2048),
    baseFrequency: jitterStepped(pickRandom(HARMONIC_FREQ_PRESETS), 0.16, 0.1, 0.1, 10),
    wavePeriod: jitterStepped(profile.wavePeriod, 0.22, 0.1, 1.0, 6),
    rawParticleCount: jitterStepped(profile.rawParticleCount, 0.22, 25_000, 25_000, 2_000_000),
    rawParticleDensity: jitterStepped(profile.rawParticleDensity, 0.18, 0.05, 0.35, 8),
    rawEmitterLimit: jitterStepped(profile.rawEmitterLimit, 0.25, 1, 1, 16),
    rawLineSharpness: jitterStepped(profile.rawLineSharpness, 0.28, 0.05, 0, 3.5),
    rawGlow: jitterStepped(profile.rawGlow, 0.3, 0.05, 0.25, 30),
  };

  writer.applySetting('renderStyle', applied.renderStyle);
  writer.applyNumericSetting('resolution', applied.resolution);
  writer.applyNumericSetting('baseFrequency', applied.baseFrequency);
  writer.applyNumericSetting('wavePeriod', applied.wavePeriod);
  writer.applyNumericSetting('rawParticleCount', applied.rawParticleCount);
  writer.applyNumericSetting('rawParticleDensity', applied.rawParticleDensity);
  writer.applyNumericSetting('rawEmitterLimit', applied.rawEmitterLimit);
  writer.applyNumericSetting('rawLineSharpness', applied.rawLineSharpness);
  writer.applyNumericSetting('rawGlow', applied.rawGlow);

  return applied;
}

export function applyHarmonicSandPreviewCaps(settings: HarmonicSandAppliedSettings): HarmonicSandAppliedSettings {
  return {
    ...settings,
    rawParticleCount: Math.min(settings.rawParticleCount, HARMONIC_PREVIEW_PROFILE_LIMITS.rawParticleCount),
    rawParticleDensity: Math.min(settings.rawParticleDensity, HARMONIC_PREVIEW_PROFILE_LIMITS.rawParticleDensity),
    rawEmitterLimit: Math.min(settings.rawEmitterLimit, HARMONIC_PREVIEW_PROFILE_LIMITS.rawEmitterLimit),
    rawLineSharpness: Math.min(settings.rawLineSharpness, HARMONIC_PREVIEW_PROFILE_LIMITS.rawLineSharpness),
    rawGlow: Math.min(settings.rawGlow, HARMONIC_PREVIEW_PROFILE_LIMITS.rawGlow),
  };
}

function jitterStepped(value: number, amount: number, step: number, min: number, max: number): number {
  const jitter = value * (1 + (Math.random() * 2 - 1) * amount);
  const stepped = Math.round(jitter / step) * step;
  const clamped = Math.max(min, Math.min(max, stepped));
  return Number(clamped.toFixed(step < 1 ? 2 : 0));
}
