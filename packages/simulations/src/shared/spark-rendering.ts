import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const SPARK_SIZE_VARIABILITY_KEY = 'sparkSizeVariability';

export type SparkProfileSettingKey =
  | 'rate'
  | 'size'
  | 'length'
  | 'lengthVariability'
  | 'sizeVariability'
  | 'lifespan'
  | 'lifespanVariability'
  | 'speedScale'
  | 'speedVariability'
  | 'intensity'
  | 'afterglow';

export type SparkParticleProfileDefaults = Partial<Record<SparkProfileSettingKey, number>>;

export interface SparkParticleProfileDefinition {
  prefix: string;
  label: string;
  description: string;
  defaults: SparkParticleProfileDefaults;
  controls?: SparkProfileSettingKey[];
}

const SPARK_PROFILE_SETTING_LABELS: Record<SparkProfileSettingKey, string> = {
  rate: 'Rate',
  size: 'Size',
  length: 'Length',
  lengthVariability: 'Length Variability',
  sizeVariability: 'Size Variability',
  lifespan: 'Lifespan',
  lifespanVariability: 'Lifespan Variability',
  speedScale: 'Speed Scale',
  speedVariability: 'Speed Variability',
  intensity: 'Intensity',
  afterglow: 'Afterglow',
};

const SPARK_PROFILE_SETTING_DESCRIPTIONS: Record<SparkProfileSettingKey, string> = {
  rate: 'Controls how often this profile emits or flashes.',
  size: 'Scales this particle profile without changing other spark families.',
  length: 'Controls how elongated this particle profile renders in point and trail passes.',
  lengthVariability: 'Varies rendered spark length per particle without changing size.',
  sizeVariability: 'Varies size per particle from the packed GPU particle seed.',
  lifespan: 'Scales how long this particle profile survives before fading out.',
  lifespanVariability: 'Varies this profile lifetime from particle to particle.',
  speedScale: 'Scales this particle profile speed from the scene emitter power.',
  speedVariability: 'Randomly scales each particle speed around its profile speed.',
  intensity: 'Scales this profile brightness without changing particle size.',
  afterglow: 'Controls how long this profile leaves a hot glow after ignition.',
};

const SPARK_PROFILE_FIELD_RANGES: Record<SparkProfileSettingKey, { min: number; max: number; step: number }> = {
  rate: { min: 0, max: 18, step: 0.05 },
  size: { min: 0.02, max: 10, step: 0.01 },
  length: { min: 0, max: 12, step: 0.01 },
  lengthVariability: { min: 0, max: 2, step: 0.01 },
  sizeVariability: { min: 0, max: 2, step: 0.01 },
  lifespan: { min: 0, max: 4, step: 0.01 },
  lifespanVariability: { min: 0, max: 1, step: 0.01 },
  speedScale: { min: 0, max: 3, step: 0.01 },
  speedVariability: { min: 0, max: 2, step: 0.01 },
  intensity: { min: 0, max: 8, step: 0.05 },
  afterglow: { min: 0, max: 1, step: 0.01 },
};

export function sparkParticleProfileSettingKey(prefix: string, key: SparkProfileSettingKey): string {
  return `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

export function sparkParticleProfileFields(profile: SparkParticleProfileDefinition): SettingsField[] {
  const section = `Spark Profile: ${profile.label}`;
  const controls = profile.controls ?? (Object.keys(profile.defaults) as SparkProfileSettingKey[]);
  return controls.map((settingKey) => {
    const range = SPARK_PROFILE_FIELD_RANGES[settingKey];
    return {
      key: sparkParticleProfileSettingKey(profile.prefix, settingKey),
      label: SPARK_PROFILE_SETTING_LABELS[settingKey],
      section,
      description: `${profile.description} ${SPARK_PROFILE_SETTING_DESCRIPTIONS[settingKey]}`,
      type: 'number',
      min: range.min,
      max: range.max,
      step: range.step,
      default: profile.defaults[settingKey] ?? 0,
    };
  });
}

export function sparkSizeVariabilityField(defaultValue: number): SettingsField {
  return {
    key: SPARK_SIZE_VARIABILITY_KEY,
    label: 'Size Variability',
    section: 'Rendering',
    description: 'Varies spark size per particle from the packed GPU particle seed. Values above 1 exaggerate the spread.',
    type: 'number',
    min: 0,
    max: 2,
    step: 0.01,
    default: defaultValue,
  };
}

export const SPARK_SIZE_VARIABILITY_GLSL = `
float sparkRenderHash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float sparkSizeVariation(float seed, float variability) {
  float spread = clamp(variability, 0.0, 2.0);
  float spreadT = spread * 0.5;
  float primary = sparkRenderHash(seed + 103.0) * 2.0 - 1.0;
  float base = exp(primary * mix(0.0, 1.18, spreadT));
  float largeRoll = smoothstep(0.58, 1.0, sparkRenderHash(seed + 211.0));
  float smallRoll = smoothstep(0.66, 1.0, sparkRenderHash(seed + 401.0));
  float rareLarge = largeRoll * mix(0.35, 2.35, sparkRenderHash(seed + 307.0)) * spreadT;
  float rareSmall = smallRoll * mix(0.18, 0.78, sparkRenderHash(seed + 503.0)) * spreadT;
  return clamp(base + rareLarge - rareSmall, 0.08, 4.2);
}
`;
