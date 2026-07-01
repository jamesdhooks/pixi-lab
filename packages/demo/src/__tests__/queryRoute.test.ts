import { describe, expect, it } from 'vitest';
import type { LabExperience } from '@hooksjam/pixi-lab-core';
import { createEngineConfigurations, LEGACY_RENDER_QUALITY_STORAGE_KEY, RENDER_SELECTION_STORAGE_KEY } from '@hooksjam/pixi-lab-core';
import {
  applyCompatibilityRouteRenderSelection,
  buildExperienceBackendProfileRoute,
  buildExperienceRuntimeViewModel,
  findQueryExperience,
  findQueryExperienceFromParams,
  parseLegacyQualityRouteValue,
  parseQueryQuality,
  queryLegacyQualityForExperience,
  queryQualityForExperience,
  queryRenderSelectionForExperience,
  shouldExposeExperienceBackendProfileRoute,
  writeCompatibilityRenderSelection,
} from '../demoRuntime';

const RESET_ENGINE_CONFIGURATIONS = createEngineConfigurations(['basic', 'enhanced', 'raw']);
const PIXI_RAW_ENGINE_CONFIGURATIONS = createEngineConfigurations(['basic', 'enhanced', 'raw'], { rawBackend: 'pixi' });
const WEBGL_RAW_ENGINE_CONFIGURATIONS = createEngineConfigurations(['basic', 'enhanced', 'raw'], { rawBackend: 'webgl2' });

const EXPERIENCES = [
  {
    id: 'ball-pit',
    name: 'Ball Pit',
    capabilities: { engineConfigurations: PIXI_RAW_ENGINE_CONFIGURATIONS },
  },
  {
    id: 'harmonic-sand',
    name: 'Harmonic Sand Plate',
    capabilities: { engineConfigurations: RESET_ENGINE_CONFIGURATIONS, settings: true },
  },
  {
    id: 'orbital-shrapnel',
    name: 'Orbital Shrapnel',
    capabilities: { engineConfigurations: WEBGL_RAW_ENGINE_CONFIGURATIONS, settings: true },
  },
] as LabExperience[];

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe('demo query routing helpers', () => {
  it('accepts only supported legacy quality route values', () => {
    expect(parseLegacyQualityRouteValue('basic')).toBe('basic');
    expect(parseLegacyQualityRouteValue('enhanced')).toBe('enhanced');
    expect(parseLegacyQualityRouteValue('raw')).toBe('raw');
    expect(parseLegacyQualityRouteValue('RAW')).toBeUndefined();
    expect(parseLegacyQualityRouteValue('ultra')).toBeUndefined();
    expect(parseLegacyQualityRouteValue(null)).toBeUndefined();
  });

  it('keeps query quality helpers as compatibility aliases', () => {
    expect(parseQueryQuality('raw')).toBe(parseLegacyQualityRouteValue('raw'));
    expect(queryQualityForExperience(EXPERIENCES[1], params('quality=raw'))).toBe(
      queryLegacyQualityForExperience(EXPERIENCES[1], params('quality=raw')),
    );
  });

  it('finds an experience by id without enabling unknown raw routes globally', () => {
    expect(findQueryExperience('ball-pit', EXPERIENCES)?.id).toBe('ball-pit');
    expect(findQueryExperience(' BALL-PIT ', EXPERIENCES)?.id).toBe('ball-pit');
    expect(findQueryExperience('orbital-shrapnel', EXPERIENCES)?.name).toBe('Orbital Shrapnel');
    expect(findQueryExperience('missing-experience', EXPERIENCES)).toBeUndefined();
    expect(findQueryExperience('', EXPERIENCES)).toBeUndefined();
    expect(findQueryExperience(null, EXPERIENCES)).toBeUndefined();
  });

  it('resolves canonical experience routes before legacy lab aliases', () => {
    expect(findQueryExperienceFromParams(params('experience=harmonic-sand'), EXPERIENCES)?.id).toBe('harmonic-sand');
    expect(findQueryExperienceFromParams(params('lab=harmonic-sand'), EXPERIENCES)?.id).toBe('harmonic-sand');
    expect(findQueryExperienceFromParams(params('experience=orbital-shrapnel&lab=harmonic-sand'), EXPERIENCES)?.id).toBe('orbital-shrapnel');
    expect(findQueryExperienceFromParams(params('experience=&lab=harmonic-sand'), EXPERIENCES)?.id).toBe('harmonic-sand');
    expect(findQueryExperienceFromParams(params('experience=missing-experience&lab=harmonic-sand'), EXPERIENCES)).toBeUndefined();
  });

  it('sanitizes query quality against the selected experience before launch', () => {
    expect(queryLegacyQualityForExperience(EXPERIENCES[0], params('quality=raw'))).toBe('raw');
    expect(queryLegacyQualityForExperience(EXPERIENCES[1], params('quality=raw'))).toBe('raw');
    expect(queryLegacyQualityForExperience(EXPERIENCES[1], params('quality=enhanced'))).toBe('enhanced');
    expect(queryLegacyQualityForExperience(EXPERIENCES[2], params('quality=raw'))).toBe('raw');
    expect(queryLegacyQualityForExperience(EXPERIENCES[2], params('quality=enhanced'))).toBe('enhanced');
    expect(queryLegacyQualityForExperience(EXPERIENCES[0], params(''))).toBeUndefined();
  });

  it('uses shared Pixi-safe default capabilities when an experience has no quality modes', () => {
    const legacyExperience = { id: 'legacy-toy', name: 'Legacy Toy', capabilities: {} } as LabExperience;

    expect(queryLegacyQualityForExperience(legacyExperience, params('quality=raw'))).toBe('basic');
    expect(queryRenderSelectionForExperience(legacyExperience, params('backend=pixi&profile=high'))).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });

  it('prefers supported backend/profile params while preserving legacy quality launch values', () => {
    expect(queryRenderSelectionForExperience(EXPERIENCES[0], params('backend=webgl2&profile=high&quality=raw'))).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'raw',
    });
    expect(queryRenderSelectionForExperience(EXPERIENCES[1], params('backend=webgl2&profile=high'))).toEqual({
      backend: 'webgl2',
      profile: 'high',
      legacyQuality: 'raw',
    });
    expect(queryRenderSelectionForExperience(EXPERIENCES[1], params('backend=raw&profile=raw'))).toEqual({
      backend: 'webgl2',
      profile: 'high',
      legacyQuality: 'raw',
    });
    expect(queryRenderSelectionForExperience(EXPERIENCES[1], params('backend=raw'))).toEqual({
      backend: 'webgl2',
      profile: 'high',
      legacyQuality: 'raw',
    });
    expect(queryRenderSelectionForExperience(EXPERIENCES[1], params('backend=pixi&profile=high&quality=basic'))).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });

  it('builds internal backend/profile experience routes without globally serializing legacy quality', () => {
    expect(
      buildExperienceBackendProfileRoute(EXPERIENCES[0], {
        backend: 'webgl2',
        profile: 'high',
        legacyQuality: 'raw',
      }),
    ).toBe('?experience=ball-pit&backend=webgl2&profile=high');
  });

  it('keeps default Pixi standard routes legacy-clean and hides the explicit migration link', () => {
    const selection = {
      backend: 'pixi',
      profile: 'standard',
      legacyQuality: 'basic',
    } as const;

    expect(shouldExposeExperienceBackendProfileRoute(selection)).toBe(false);
    expect(buildExperienceBackendProfileRoute(EXPERIENCES[1], selection)).toBe('?experience=harmonic-sand');
    expect(buildExperienceBackendProfileRoute(EXPERIENCES[2], selection)).toBe('?experience=orbital-shrapnel');
  });

  it('exposes the explicit backend/profile link for non-default profiles', () => {
    expect(
      shouldExposeExperienceBackendProfileRoute({
        backend: 'pixi',
        profile: 'high',
        legacyQuality: 'enhanced',
      }),
    ).toBe(true);
    expect(
      shouldExposeExperienceBackendProfileRoute({
        backend: 'webgl2',
        profile: 'high',
        legacyQuality: 'raw',
      }),
    ).toBe(true);
  });

  it('builds a host runtime view model without leaking backend/profile params for defaults', () => {
    expect(
      buildExperienceRuntimeViewModel(EXPERIENCES[1], {
        backend: 'pixi',
        profile: 'standard',
        legacyQuality: 'basic',
      }),
    ).toEqual({
      label: 'PixiJS / Standard',
      backendProfileRoute: null,
    });

    expect(
      buildExperienceRuntimeViewModel(EXPERIENCES[2], {
        backend: 'pixi',
        profile: 'high',
        legacyQuality: 'enhanced',
      }),
    ).toEqual({
      label: 'PixiJS / High',
      backendProfileRoute: '?experience=orbital-shrapnel&backend=pixi&profile=high',
    });

    expect(
      buildExperienceRuntimeViewModel(EXPERIENCES[0], {
        backend: 'pixi',
        profile: 'high',
        legacyQuality: 'raw',
      }),
    ).toEqual({
      label: 'PixiJS / High',
      backendProfileRoute: '?experience=ball-pit&backend=pixi&profile=high',
    });
  });

  it('persists compatibility routes through legacy quality and backend/profile storage', () => {
    const stored = new Map<string, string>();

    writeCompatibilityRenderSelection(
      {
        backend: 'webgl2',
        profile: 'high',
        legacyQuality: 'raw',
      },
      { setItem: (key, value) => { stored.set(key, value); } },
    );

    expect(stored.get(LEGACY_RENDER_QUALITY_STORAGE_KEY)).toBe('raw');
    expect(stored.get(RENDER_SELECTION_STORAGE_KEY)).toBe(
      JSON.stringify({ backend: 'webgl2', profile: 'high', quality: 'raw' }),
    );
  });

  it('applies Harmonic Sand raw compatibility route render selection through one demo runtime action', () => {
    const stored = new Map<string, string>();
    const selection = applyCompatibilityRouteRenderSelection(
      EXPERIENCES[1],
      params('backend=webgl2&profile=high'),
      { setItem: (key, value) => { stored.set(key, value); } },
    );

    expect(selection).toEqual({ backend: 'webgl2', profile: 'high', legacyQuality: 'raw' });
    expect(stored.get(LEGACY_RENDER_QUALITY_STORAGE_KEY)).toBe('raw');
    expect(stored.get(RENDER_SELECTION_STORAGE_KEY)).toBe(
      JSON.stringify({ backend: 'webgl2', profile: 'high', quality: 'raw' }),
    );
  });

  it('bridges legacy Harmonic Sand lab quality routes to supported engine configurations', () => {
    const routeParams = params('experience=&lab=harmonic-sand&quality=raw');
    const harmonicSandExperience = findQueryExperienceFromParams(routeParams, EXPERIENCES);
    const stored = new Map<string, string>();

    expect(harmonicSandExperience?.id).toBe('harmonic-sand');

    const selection = applyCompatibilityRouteRenderSelection(
      harmonicSandExperience!,
      routeParams,
      { setItem: (key, value) => { stored.set(key, value); } },
    );

    expect(selection).toEqual({ backend: 'webgl2', profile: 'high', legacyQuality: 'raw' });
    expect(stored.get(LEGACY_RENDER_QUALITY_STORAGE_KEY)).toBe('raw');
    expect(stored.get(RENDER_SELECTION_STORAGE_KEY)).toBe(
      JSON.stringify({ backend: 'webgl2', profile: 'high', quality: 'raw' }),
    );
  });

  it('scopes unsupported backend/profile compatibility routes through explicit engine configurations', () => {
    const stored = new Map<string, string>();
    const selection = applyCompatibilityRouteRenderSelection(
      EXPERIENCES[0],
      params('backend=webgl2&profile=high'),
      { setItem: (key, value) => { stored.set(key, value); } },
    );

    expect(selection).toEqual({ backend: 'pixi', profile: 'standard', legacyQuality: 'basic' });
    expect(stored.get(LEGACY_RENDER_QUALITY_STORAGE_KEY)).toBe('basic');
    expect(stored.get(RENDER_SELECTION_STORAGE_KEY)).toBe(
      JSON.stringify({ backend: 'pixi', profile: 'standard', quality: 'basic' }),
    );
  });

  it('bridges legacy raw quality routes to Pixi-owned raw engine configurations', () => {
    const stored = new Map<string, string>();
    const selection = applyCompatibilityRouteRenderSelection(
      EXPERIENCES[0],
      params('backend=webgl2&profile=high&quality=raw'),
      { setItem: (key, value) => { stored.set(key, value); } },
    );

    expect(selection).toEqual({ backend: 'pixi', profile: 'high', legacyQuality: 'raw' });
    expect(stored.get(LEGACY_RENDER_QUALITY_STORAGE_KEY)).toBe('raw');
    expect(stored.get(RENDER_SELECTION_STORAGE_KEY)).toBe(
      JSON.stringify({ backend: 'pixi', profile: 'high', quality: 'raw' }),
    );
  });
});
