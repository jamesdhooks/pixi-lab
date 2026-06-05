import { describe, expect, it } from 'vitest';
import type { LabExperience } from '@hooksjam/pixi-lab-core';
import {
  buildExperienceBackendProfileRoute,
  findQueryExperience,
  parseQueryQuality,
  queryQualityForExperience,
  queryRenderSelectionForExperience,
} from '../App';

const EXPERIENCES = [
  { id: 'amoeba-lamp', name: 'Amoeba Lamp', capabilities: { qualityModes: ['basic', 'enhanced', 'raw'] } },
  { id: 'fluid-tank', name: 'Fluid Tank', capabilities: { qualityModes: ['basic', 'enhanced'] } },
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
    expect(findQueryExperience('missing-experience', EXPERIENCES)).toBeUndefined();
    expect(findQueryExperience('', EXPERIENCES)).toBeUndefined();
    expect(findQueryExperience(null, EXPERIENCES)).toBeUndefined();
  });

  it('sanitizes query quality against the selected experience before launch', () => {
    expect(queryQualityForExperience(EXPERIENCES[0], params('quality=raw'))).toBe('raw');
    expect(queryQualityForExperience(EXPERIENCES[1], params('quality=raw'))).toBe('basic');
    expect(queryQualityForExperience(EXPERIENCES[1], params('quality=enhanced'))).toBe('enhanced');
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
});
