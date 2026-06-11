import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GameContext, SettingsField, SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { DomScriptScene } from '@hooksjam/pixi-lab-core';
import { RawOrbitalShrapnelReferenceScene } from '../orbital-shrapnel/RawOrbitalShrapnelReferenceScene.js';
import { AmoebaLampPreviewScene, AmoebaLampScene, FluidTankPreviewScene, FluidTankScene, OrbitalShrapnelExperimentalRawEngineScene, OrbitalShrapnelPreviewScene, OrbitalShrapnelScene, RawFluidTankScene, SIMULATION_REGISTRY, getSimulation } from '../index.js';

const REQUIRED_DEMO_CAPABILITIES = [
  'interactive',
  'ambient',
  'gestures',
  'directorMode',
  'stagnationRecovery',
  'debugOverlay',
  'styleExport',
  'proceduralTextures',
  'renderTargetPool',
  'demo',
] as const;

const FORBIDDEN_RESOLUTION_SETTING_KEYS = new Set([
  'gridColumns',
  'fieldColumns',
  'trailColumns',
  'fieldResolution',
]);

function assertNumericField(definition: SimulationDefinition, field: SettingsField): void {
  expect(field.default, `${definition.id}.${field.key} default`).toEqual(expect.any(Number));
  expect(field.min, `${definition.id}.${field.key} min`).toEqual(expect.any(Number));
  expect(field.max, `${definition.id}.${field.key} max`).toEqual(expect.any(Number));
  expect(field.step, `${definition.id}.${field.key} step`).toEqual(expect.any(Number));

  const defaultValue = field.default as number;
  expect(defaultValue, `${definition.id}.${field.key} default >= min`).toBeGreaterThanOrEqual(field.min ?? defaultValue);
  expect(defaultValue, `${definition.id}.${field.key} default <= max`).toBeLessThanOrEqual(field.max ?? defaultValue);
}

describe('SIMULATION_REGISTRY', () => {
  it('exports uniquely discoverable simulation definitions', () => {
    const ids = SIMULATION_REGISTRY.map((definition) => definition.id);

    expect(SIMULATION_REGISTRY.length).toBeGreaterThanOrEqual(21);
    expect(new Set(ids).size).toBe(ids.length);

    for (const definition of SIMULATION_REGISTRY) {
      expect(definition.kind).toBe('simulation');
      expect(getSimulation(definition.id)).toBe(definition);
      expect(definition.name.length).toBeGreaterThan(0);
      expect(definition.short.length).toBeGreaterThan(0);
      expect(definition.long.length).toBeGreaterThan(0);
      expect(definition.tags.length).toBeGreaterThan(0);
      expect(definition.icon.length).toBeGreaterThan(0);
      expect(definition.defaultSeed, `${definition.id}.defaultSeed`).toEqual(expect.any(Number));
      expect(definition.factory, `${definition.id}.factory`).toEqual(expect.any(Function));
      expect(definition.previewFactory, `${definition.id}.previewFactory`).toEqual(expect.any(Function));
    }
  });

  it('keeps every demo simulation wired for gallery discovery', () => {
    for (const definition of SIMULATION_REGISTRY) {
      if (!definition.capabilities.demo) {
        continue;
      }

      for (const capability of REQUIRED_DEMO_CAPABILITIES) {
        expect(definition.capabilities[capability], `${definition.id}.capabilities.${capability}`).toBe(true);
      }

      expect(definition.demoAiFactory, `${definition.id}.demoAiFactory`).toEqual(expect.any(Function));
      expect(definition.gestureMap, `${definition.id}.gestureMap`).toBeDefined();
      expect(Object.keys(definition.gestureMap ?? {}).length, `${definition.id}.gestureMap`).toBeGreaterThan(0);
      expect(definition.directorEvents.length, `${definition.id}.directorEvents`).toBeGreaterThan(0);
      expect(definition.stagnationPolicy, `${definition.id}.stagnationPolicy`).toBeDefined();
      expect(definition.settingsFields, `${definition.id}.settingsFields`).toBeDefined();
      expect(definition.settingsFields?.length ?? 0, `${definition.id}.settingsFields`).toBeGreaterThan(0);
      expect(definition.capabilities.settings, `${definition.id}.capabilities.settings`).toBe(true);
      expect(definition.configDefaults, `${definition.id}.configDefaults`).toBeDefined();
    }
  });

  it('declares complete style manifests with render layers, passes, and quality support', () => {
    for (const definition of SIMULATION_REGISTRY) {
      const manifest = definition.styleManifest;
      const styleIds = manifest.styles.map((style) => style.id);

      expect(manifest.styles.length, `${definition.id}.styles`).toBeGreaterThanOrEqual(2);
      expect(styleIds, `${definition.id}.defaultStyleId`).toContain(manifest.defaultStyleId);
      expect(new Set(styleIds).size, `${definition.id}.styleIds`).toBe(styleIds.length);
      expect(manifest.capabilities.renderLayers.length, `${definition.id}.renderLayers`).toBeGreaterThan(0);
      expect(manifest.capabilities.passes.length, `${definition.id}.passes`).toBeGreaterThan(0);
      expect(manifest.capabilities.qualities, `${definition.id}.qualities`).toContain('basic');
      expect(manifest.capabilities.qualities, `${definition.id}.qualities`).toContain('enhanced');

      for (const style of manifest.styles.filter((style) => style.id !== '__random__')) {
        expect(style.name.length, `${definition.id}.${style.id}.name`).toBeGreaterThan(0);
        expect(style.palette.length, `${definition.id}.${style.id}.palette`).toBeGreaterThanOrEqual(2);
        expect(style.passes.length, `${definition.id}.${style.id}.passes`).toBeGreaterThan(0);
        expect(typeof style.background, `${definition.id}.${style.id}.background`).toBe('number');
      }
    }
  });

  it('keeps user settings aligned with defaults and the canonical resolution key', () => {
    for (const definition of SIMULATION_REGISTRY) {
      const defaults = definition.configDefaults ?? {};

      for (const field of definition.settingsFields ?? []) {
        expect(FORBIDDEN_RESOLUTION_SETTING_KEYS.has(field.key), `${definition.id}.${field.key}`).toBe(false);
        expect(defaults, `${definition.id}.configDefaults.${field.key}`).toHaveProperty(field.key);

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
  });

  it('keeps Fluid Tank basic/enhanced on the Pixi scene path and raw on the dedicated raw scene path', () => {
    const definition = getSimulation('fluid-tank');

    expect(definition?.capabilities.engineConfigurations?.map((configuration) => configuration.legacyQuality)).toEqual(['basic', 'enhanced', 'raw']);
    expect(definition?.capabilities.qualityModes).toBeUndefined();
    expect(definition?.styleManifest.capabilities.qualities).toEqual(['basic', 'enhanced', 'raw']);

    const basicScene = definition?.factory({ quality: 'basic' } as unknown as GameContext);
    const enhancedScene = definition?.factory({ quality: 'enhanced' } as unknown as GameContext);
    const rawScene = definition?.factory({ quality: 'raw' } as unknown as GameContext);
    const preview = definition?.previewFactory?.({ quality: 'raw' } as unknown as GameContext);

    expect(basicScene).toBeInstanceOf(FluidTankScene);
    expect(basicScene).not.toBeInstanceOf(DomScriptScene);
    expect(enhancedScene).toBeInstanceOf(FluidTankScene);
    expect(enhancedScene).not.toBeInstanceOf(DomScriptScene);
    expect(rawScene).toBeInstanceOf(RawFluidTankScene);
    expect(rawScene).toBeInstanceOf(DomScriptScene);
    expect(preview).toBeInstanceOf(FluidTankPreviewScene);
    expect(preview).not.toBeInstanceOf(DomScriptScene);
  });

  it('advertises Amoeba Lamp raw only after its Pixi-owned adapter is selectable', () => {
    const definition = getSimulation('amoeba-lamp');

    expect(definition?.capabilities.engineConfigurations?.map((configuration) => configuration.legacyQuality)).toEqual(['basic', 'enhanced', 'raw']);
    expect(definition?.capabilities.qualityModes).toBeUndefined();
    expect(definition?.styleManifest.capabilities.qualities).toEqual(['basic', 'enhanced', 'raw']);

    const factoryContext = {} as unknown as GameContext;
    const scene = definition?.factory(factoryContext);
    const preview = definition?.previewFactory?.(factoryContext);

    expect(scene).toBeInstanceOf(AmoebaLampScene);
    expect(scene).not.toBeInstanceOf(DomScriptScene);
    expect(preview).toBeInstanceOf(AmoebaLampPreviewScene);
    expect(preview).not.toBeInstanceOf(DomScriptScene);
  });

  it('keeps Orbital Shrapnel raw on the WebGL reference-parity scene path', () => {
    const definition = getSimulation('orbital-shrapnel');

    expect(definition?.capabilities.engineConfigurations?.map((configuration) => configuration.legacyQuality)).toEqual(['basic', 'enhanced', 'raw']);
    expect(definition?.capabilities.qualityModes).toBeUndefined();
    expect(definition?.styleManifest.capabilities.qualities).toEqual(['basic', 'enhanced', 'raw']);

    const pixiScene = definition?.factory({ quality: 'enhanced' } as unknown as GameContext);
    const rawScene = definition?.factory({ backend: 'webgl2', profile: 'high', quality: 'raw' } as unknown as GameContext);
    const experimentalRawScene = definition?.factory({
      backend: 'webgl2',
      profile: 'high',
      quality: 'raw',
      experimentalRawEngine: true,
    } as unknown as GameContext);
    const preview = definition?.previewFactory?.({ quality: 'raw' } as unknown as GameContext);

    expect(pixiScene).toBeInstanceOf(OrbitalShrapnelScene);
    expect(pixiScene).not.toBeInstanceOf(DomScriptScene);
    expect(rawScene).toBeInstanceOf(RawOrbitalShrapnelReferenceScene);
    expect(rawScene).not.toBeInstanceOf(OrbitalShrapnelScene);
    expect(rawScene).not.toBeInstanceOf(DomScriptScene);
    expect(experimentalRawScene).toBeInstanceOf(OrbitalShrapnelExperimentalRawEngineScene);
    expect(experimentalRawScene).toBeInstanceOf(DomScriptScene);
    expect(experimentalRawScene).not.toBeInstanceOf(RawOrbitalShrapnelReferenceScene);
    expect(preview).toBeInstanceOf(OrbitalShrapnelPreviewScene);
    expect(preview).not.toBeInstanceOf(DomScriptScene);
  });

  it('keeps Orbital Shrapnel raw off the downgraded Pixi texture bridge until semantic WebGL reaches reference parity', () => {
    const orbitalDir = join(process.cwd(), 'packages/simulations/src/orbital-shrapnel');
    const definitionSource = readFileSync(join(orbitalDir, 'orbital-shrapnel.definition.ts'), 'utf8');
    const referenceSceneSource = readFileSync(join(orbitalDir, 'RawOrbitalShrapnelReferenceScene.ts'), 'utf8');
    const experimentalSceneSource = readFileSync(join(orbitalDir, 'OrbitalShrapnelExperimentalRawEngineScene.ts'), 'utf8');

    expect(existsSync(join(orbitalDir, 'RawOrbitalShrapnelReferenceScene.ts')), 'reference parity scene must stay available for raw').toBe(true);
    expect(definitionSource).toContain('RawOrbitalShrapnelReferenceScene');
    expect(referenceSceneSource).toContain('Orbital Shrapnel Field Fidelity Lab');
    expect(referenceSceneSource).toContain('pixiLabOrbitalRendererHost');
    expect(referenceSceneSource).toContain('pixi-lab:raw-debug-stats');
    expect(referenceSceneSource).toContain("renderer: 'raw-webgl2-reference'");
    expect(referenceSceneSource).toContain('fps: ui.fps.textContent');
    expect(referenceSceneSource).toContain('display: none !important');
    expect(referenceSceneSource).toContain("sandbox', 'allow-scripts'");

    for (const key of ['renderer', 'fps', 'gpu', 'particles', 'drawn', 'state', 'trailRt', 'vram', 'caps', 'status']) {
      expect(experimentalSceneSource, `experimental raw stats should include ${key}`).toContain(`${key}:`);
    }
    expect(experimentalSceneSource).toContain("renderer: 'raw-webgl2-engine-experimental'");
    expect(experimentalSceneSource).toContain('pushGestures(gestures: GestureEvent[])');
    expect(experimentalSceneSource).toContain('onDestroy: ({ gl })');
    expect(experimentalSceneSource).toContain('destroyRuntime(gl, this.runtime)');
    expect(experimentalSceneSource).toContain('resources.destroy();');
    expect(experimentalSceneSource).toContain('gl.deleteProgram(program)');
    expect(experimentalSceneSource).toContain('gl.deleteProgram(runtime.program)');
  });

  it('keeps raw opt-in scoped to simulations that explicitly support it', () => {
    const rawCapableIds = SIMULATION_REGISTRY
      .filter((definition) => (definition.capabilities.engineConfigurations ?? []).some((configuration) => configuration.legacyQuality === 'raw'))
      .map((definition) => definition.id)
      .sort();

    expect(rawCapableIds).toEqual(['amoeba-lamp', 'fluid-tank', 'harmonic-sand', 'orbital-shrapnel']);
  });

  it('keeps raw-capable simulation engine configuration declarations explicit', () => {
    for (const id of ['amoeba-lamp', 'fluid-tank', 'harmonic-sand', 'orbital-shrapnel'] as const) {
      const definition = getSimulation(id);
      const engineConfigurations = definition?.capabilities.engineConfigurations ?? [];
      const engineModes = engineConfigurations.map((configuration) => configuration.legacyQuality);

      expect(engineModes, `${id}.engineConfigurations.legacyQuality`).toEqual(['basic', 'enhanced', 'raw']);
      expect(definition?.capabilities.qualityModes, `${id}.qualityModes converted`).toBeUndefined();
      const rawBackend = id === 'amoeba-lamp' ? 'pixi' : 'webgl2';
      const rawLabel = rawBackend === 'pixi' ? 'PixiJS / High · Raw' : 'WebGL2 / High · Raw';

      expect(engineConfigurations.map((configuration) => configuration.label), `${id}.engineConfigurations.label`).toEqual([
        'PixiJS / Standard · Basic',
        'PixiJS / High · Enhanced',
        rawLabel,
      ]);
      expect(engineConfigurations.map((configuration) => configuration.backend), `${id}.engineConfigurations.backend`).toEqual([
        'pixi',
        'pixi',
        rawBackend,
      ]);
    }
  });
});
