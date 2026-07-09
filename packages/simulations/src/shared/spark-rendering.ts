import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const SPARK_SIZE_VARIABILITY_KEY = 'sparkSizeVariability';

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
