import { describe, expect, it } from 'vitest';
import type { LabExperience } from '@hooksjam/pixi-lab-core';
import { LEGACY_RENDER_QUALITY_STORAGE_KEY, RENDER_SELECTION_STORAGE_KEY } from '@hooksjam/pixi-lab-core';
import {
  applyCompatibilityRouteRenderSelection,
  buildExperienceBackendProfileRoute,
  buildExperienceRuntimeViewModel,
  findQueryExperience,
  parseQueryQuality,
  queryQualityForExperience,
  queryRenderSelectionForExperience,
  shouldExposeExperienceBackendProfileRoute,
  writeCompatibilityRenderSelection,
} from '../demoRuntime';

const EXPERIENCES = [
  { id: 'amoeba-lamp', name: 'Amoeba Lamp', capabilities: { qualityModes: ['basic', 'enhanced', 'raw'] } },
  { id: 'fluid-tank', name: 'Fluid Tank', capabilities: { qualityModes: ['basic', 'enhanced'] } },
  { id: 'harmonic-sand', name: 'Harmonic Sand Plate', capabilities: { qualityModes: ['basic', 'enhanced'], settings: true } },
] as LabExperience[];

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe('demo query routing helpers', () => {
  it('accepts only supported render quality query values', () => {
    expect(parseQueryQuality('basic')).toBe('basic');
    expect(parseQueryQuality('enhanced')).toBe('enhanced');
    expect(parseQueryQuality('raw')).toBe('raw');
    expect(parseQueryQuality('RAW')).toBeUndefined();
    expect(parseQueryQuality('ultra')).toBeUndefined();
    expect(parseQueryQuality(null)).toBeUndefined();
  });

  it('finds an experience by id without enabling unknown raw routes globally', () => {
    expect(findQueryExperience('amoeba-lamp', EXPERIENCES)?.id).toBe('amoeba-lamp');
    expect(findQueryExperience(' AMOEBA-LAMP ', EXPERIENCES)?.id).toBe('amoeba-lamp');
    expect(findQueryExperience('harmonic-sand', EXPERIENCES)?.name).toBe('Harmonic Sand Plate');
    expect(findQueryExperience('missing-experience', EXPERIENCES)).toBeUndefined();
    expect(findQueryExperience('', EXPERIENCES)).toBeUndefined();
    expect(findQueryExperience(null, EXPERIENCES)).toBeUndefined();
  });

  it('sanitizes query quality against the selected experience before launch', () => {
    expect(queryQualityForExperience(EXPERIENCES[0], params('quality=raw'))).toBe('raw');
    expect(queryQualityForExperience(EXPERIENCES[1], params('quality=raw'))).toBe('basic');
    expect(queryQualityForExperience(EXPERIENCES[1], params('quality=enhanced'))).toBe('enhanced');
    expect(queryQualityForExperience(EXPERIENCES[2], params('quality=raw'))).toBe('basic');
    expect(queryQualityForExperience(EXPERIENCES[2], params('quality=enhanced'))).toBe('enhanced');
    expect(queryQualityForExperience(EXPERIENCES[0], params(''))).toBeUndefined();
  });

  it('uses shared Pixi-safe default capabilities when an experience has no quality modes', () => {
    const legacyExperience = { id: 'legacy-toy', name: 'Legacy Toy', capabilities: {} } as LabExperience;

    expect(queryQualityForExperience(legacyExperience, params('quality=raw'))).toBe('basic');
    expect(queryRenderSelectionForExperience(legacyExperience, params('backend=pixi&profile=high'))).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });

  it('prefers supported backend/profile params while preserving legacy quality launch values', () => {
    expect(queryRenderSelectionForExperience(EXPERIENCES[0], params('backend=webgl2&profile=high'))).toEqual({
      backend: 'webgl2',
      profile: 'high',
      legacyQuality: 'raw',
    });
    expect(queryRenderSelectionForExperience(EXPERIENCES[1], params('backend=webgl2&profile=high'))).toEqual({
      backend: 'pixi',
      profile: 'standard',
      legacyQuality: 'basic',
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
    ).toBe('?experience=amoeba-lamp&backend=webgl2&profile=high');
  });

  it('keeps default Pixi standard routes legacy-clean and hides the explicit migration link', () => {
    const selection = {
      backend: 'pixi',
      profile: 'standard',
      legacyQuality: 'basic',
    } as const;

    expect(shouldExposeExperienceBackendProfileRoute(selection)).toBe(false);
    expect(buildExperienceBackendProfileRoute(EXPERIENCES[1], selection)).toBe('?experience=fluid-tank');
    expect(buildExperienceBackendProfileRoute(EXPERIENCES[2], selection)).toBe('?experience=harmonic-sand');
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
      backendProfileRoute: '?experience=harmonic-sand&backend=pixi&profile=high',
    });

    expect(
      buildExperienceRuntimeViewModel(EXPERIENCES[0], {
        backend: 'webgl2',
        profile: 'high',
        legacyQuality: 'raw',
      }),
    ).toEqual({
      label: 'WebGL2 / High',
      backendProfileRoute: '?experience=amoeba-lamp&backend=webgl2&profile=high',
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

  it('applies compatibility route render selection through one demo runtime action', () => {
    const stored = new Map<string, string>();
    const selection = applyCompatibilityRouteRenderSelection(
      EXPERIENCES[0],
      params('backend=webgl2&profile=high'),
      { setItem: (key, value) => { stored.set(key, value); } },
    );

    expect(selection).toEqual({ backend: 'webgl2', profile: 'high', legacyQuality: 'raw' });
    expect(stored.get(LEGACY_RENDER_QUALITY_STORAGE_KEY)).toBe('raw');
    expect(stored.get(RENDER_SELECTION_STORAGE_KEY)).toBe(
      JSON.stringify({ backend: 'webgl2', profile: 'high', quality: 'raw' }),
    );
  });
});
