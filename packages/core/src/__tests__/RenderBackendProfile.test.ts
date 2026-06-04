import { describe, expect, it } from 'vitest';
import {
  mapQualityModesToBackendProfiles,
  sanitizeLegacyRenderQuality,
  toRenderBackendProfileCandidate,
} from '../runtime/RenderBackendProfile.js';

import type { RenderQuality } from '../types.js';

describe('RenderBackendProfile', () => {
  it('maps legacy Pixi qualities to backend/profile candidates', () => {
    expect(mapQualityModesToBackendProfiles(['basic', 'enhanced'])).toEqual([
      { quality: 'basic', backend: 'pixi', profile: 'standard', legacyLabel: 'Basic' },
      { quality: 'enhanced', backend: 'pixi', profile: 'high', legacyLabel: 'Enhanced' },
    ]);
  });

  it('keeps raw modeled as an opt-in WebGL2 high profile candidate', () => {
    expect(toRenderBackendProfileCandidate('raw')).toEqual({
      quality: 'raw',
      backend: 'webgl2',
      profile: 'high',
      legacyLabel: 'Raw',
    });
  });

  it('sanitizes unsupported raw requests back to a supported Pixi-safe quality', () => {
    expect(sanitizeLegacyRenderQuality('raw', ['basic', 'enhanced'])).toBe('basic');
  });

  it('honors experience-scoped raw support when advertised', () => {
    expect(sanitizeLegacyRenderQuality('raw', ['basic', 'raw'])).toBe('raw');
  });

  it('uses the first supported quality when the configured fallback is unavailable', () => {
    const supported: RenderQuality[] = ['enhanced'];

    expect(sanitizeLegacyRenderQuality(undefined, supported, 'basic')).toBe('enhanced');
  });
});
