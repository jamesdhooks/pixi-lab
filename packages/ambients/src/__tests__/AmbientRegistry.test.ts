import { describe, expect, it } from 'vitest';
import type { AmbientDefinition, EffectDefinition, LabExperience, SettingsField } from '@hooksjam/pixi-lab-core';
import { AMBIENT_REGISTRY, getAmbient } from '../index.js';

const REQUIRED_BACKGROUND_MODES = new Set(['fullscreen', 'background', 'previewTile']);
const REQUIRED_FOREGROUND_MODES = new Set(['foregroundOverlay', 'fullscreen', 'previewTile']);

function assertNumericField(definition: LabExperience, field: SettingsField): void {
  expect(field.default, `${definition.id}.${field.key} default`).toEqual(expect.any(Number));
  expect(field.min, `${definition.id}.${field.key} min`).toEqual(expect.any(Number));
  expect(field.max, `${definition.id}.${field.key} max`).toEqual(expect.any(Number));
  expect(field.step, `${definition.id}.${field.key} step`).toEqual(expect.any(Number));

  const defaultValue = field.default as number;
  expect(defaultValue, `${definition.id}.${field.key} default >= min`).toBeGreaterThanOrEqual(field.min ?? defaultValue);
  expect(defaultValue, `${definition.id}.${field.key} default <= max`).toBeLessThanOrEqual(field.max ?? defaultValue);
}

function assertSettingsDefaults(definition: LabExperience): void {
  const defaults = definition.configDefaults ?? {};

  expect(definition.settingsFields?.length ?? 0, `${definition.id}.settingsFields`).toBeGreaterThan(0);

  for (const field of definition.settingsFields ?? []) {
    expect(defaults, `${definition.id}.configDefaults.${field.key}`).toHaveProperty(field.key);
    expect(defaults[field.key], `${definition.id}.${field.key} default matches config`).toBe(field.default);

    if (field.type === 'number') {
      assertNumericField(definition, field);
    }

    if (field.type === 'select') {
      expect(field.options?.length ?? 0, `${definition.id}.${field.key}.options`).toBeGreaterThan(0);
      expect(
        field.options?.some((option) => option.value === field.default),
        `${definition.id}.${field.key}.default option`,
      ).toBe(true);
    }
  }
}

function assertPassiveBehavior(definition: AmbientDefinition | EffectDefinition): void {
  const behavior = definition.behavior;
  const bindings = definition.dataBindings ?? [];

  expect(behavior, `${definition.id}.behavior`).toBeDefined();
  expect(behavior?.idleSafe, `${definition.id}.behavior.idleSafe`).toBe(true);
  expect(behavior?.supportsLowMotion, `${definition.id}.behavior.supportsLowMotion`).toBe(true);
  expect(behavior?.supportsSleepMode, `${definition.id}.behavior.supportsSleepMode`).toBe(true);
  expect(behavior?.supportsTransparency, `${definition.id}.behavior.supportsTransparency`).toBe(true);
  expect(behavior?.maxBrightness, `${definition.id}.behavior.maxBrightness`).toBeGreaterThan(0);
  expect(behavior?.maxBrightness, `${definition.id}.behavior.maxBrightness`).toBeLessThanOrEqual(0.75);
  expect(behavior?.maxParticleCount, `${definition.id}.behavior.maxParticleCount`).toBeGreaterThan(0);
  expect(behavior?.maxUpdateHz, `${definition.id}.behavior.maxUpdateHz`).toBeGreaterThan(0);
  expect(behavior?.maxUpdateHz, `${definition.id}.behavior.maxUpdateHz`).toBeLessThanOrEqual(60);

  expect(bindings.length, `${definition.id}.dataBindings`).toBeGreaterThan(0);
  expect(
    bindings.some((binding) => binding.source === 'synthetic' || binding.fallback === 'synthetic'),
    `${definition.id}.syntheticFallback`,
  ).toBe(true);
}

describe('AMBIENT_REGISTRY', () => {
  it('exports uniquely discoverable ambient and effect definitions', () => {
    const ids = AMBIENT_REGISTRY.map((definition) => definition.id);

    expect(AMBIENT_REGISTRY.length).toBe(14);
    expect(new Set(ids).size).toBe(ids.length);

    for (const definition of AMBIENT_REGISTRY) {
      expect(['ambient', 'effect'], `${definition.id}.kind`).toContain(definition.kind);
      expect(definition.name.length, `${definition.id}.name`).toBeGreaterThan(0);
      expect(definition.short.length, `${definition.id}.short`).toBeGreaterThan(0);
      expect(definition.long.length, `${definition.id}.long`).toBeGreaterThan(0);
      expect(definition.tags.length, `${definition.id}.tags`).toBeGreaterThan(0);
      expect(definition.icon.length, `${definition.id}.icon`).toBeGreaterThan(0);
      expect(definition.factory, `${definition.id}.factory`).toEqual(expect.any(Function));
      expect(definition.previewFactory, `${definition.id}.previewFactory`).toEqual(expect.any(Function));
      expect(definition.defaultSeed, `${definition.id}.defaultSeed`).toEqual(expect.any(Number));
    }
  });

  it('keeps ambient backgrounds wired for dashboard usage', () => {
    const ambients = AMBIENT_REGISTRY.filter((definition): definition is AmbientDefinition => definition.kind === 'ambient');

    expect(ambients.length).toBe(8);

    for (const definition of ambients) {
      expect(getAmbient(definition.id), `${definition.id}.getAmbient`).toBe(definition);
      for (const mode of REQUIRED_BACKGROUND_MODES) {
        expect(definition.renderModes, `${definition.id}.renderModes`).toContain(mode);
      }

      expect(definition.capabilities.ambient, `${definition.id}.capabilities.ambient`).toBe(true);
      expect(definition.capabilities.ambientLayer, `${definition.id}.capabilities.ambientLayer`).toBe(true);
      expect(definition.capabilities.lowMotion, `${definition.id}.capabilities.lowMotion`).toBe(true);
      expect(definition.capabilities.sleepMode, `${definition.id}.capabilities.sleepMode`).toBe(true);
      expect(definition.styles.length, `${definition.id}.styles`).toBeGreaterThanOrEqual(2);
      expect(new Set(definition.styles.map((style) => style.id)).size, `${definition.id}.styleIds`).toBe(definition.styles.length);
      expect(definition.behavior.allowBackground, `${definition.id}.behavior.allowBackground`).toBe(true);
      expect(definition.behavior.allowForeground, `${definition.id}.behavior.allowForeground`).toBe(false);
      assertPassiveBehavior(definition);
      assertSettingsDefaults(definition);
    }
  });

  it('keeps foreground overlays foreground-safe and demoable', () => {
    const effects = AMBIENT_REGISTRY.filter((definition): definition is EffectDefinition => definition.kind === 'effect');

    expect(effects.length).toBe(6);

    for (const definition of effects) {
      expect(getAmbient(definition.id), `${definition.id}.getAmbient should ignore effects`).toBeUndefined();
      for (const mode of REQUIRED_FOREGROUND_MODES) {
        expect(definition.renderModes, `${definition.id}.renderModes`).toContain(mode);
      }

      expect(definition.capabilities.lowMotion, `${definition.id}.capabilities.lowMotion`).toBe(true);
      expect(definition.capabilities.sleepMode, `${definition.id}.capabilities.sleepMode`).toBe(true);
      expect(definition.styleManifest?.styles.length ?? 0, `${definition.id}.styleManifest.styles`).toBeGreaterThanOrEqual(2);
      expect(definition.behavior?.allowForeground, `${definition.id}.behavior.allowForeground`).toBe(true);
      expect(definition.behavior?.allowBackground, `${definition.id}.behavior.allowBackground`).toBe(false);
      assertPassiveBehavior(definition);
      assertSettingsDefaults(definition);
    }
  });
});
