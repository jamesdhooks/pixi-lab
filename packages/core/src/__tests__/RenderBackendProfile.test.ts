import { describe, expect, it } from 'vitest';
import {
  formatRenderBackendProfileSelection,
  groupBackendProfileCandidates,
  groupQualityModesByBackend,
  isRenderProfile,
  isRenderQuality,
  isRendererBackend,
  mapQualityModesToBackendProfiles,
  resolveRenderBackendProfileQuerySelection,
  resolveRenderBackendProfileSelection,
  sanitizeLegacyRenderQuality,
  serializeRenderBackendProfileRoute,
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

  it('groups advertised qualities by backend without changing legacy route order', () => {
    expect(groupQualityModesByBackend(['basic', 'enhanced', 'raw'])).toEqual([
      {
        backend: 'pixi',
        candidates: [
          { quality: 'basic', backend: 'pixi', profile: 'standard', legacyLabel: 'Basic' },
          { quality: 'enhanced', backend: 'pixi', profile: 'high', legacyLabel: 'Enhanced' },
        ],
      },
      {
        backend: 'webgl2',
        candidates: [{ quality: 'raw', backend: 'webgl2', profile: 'high', legacyLabel: 'Raw' }],
      },
    ]);
  });

  it('preserves explicitly provided backend candidate order when grouping', () => {
    const raw = toRenderBackendProfileCandidate('raw');
    const basic = toRenderBackendProfileCandidate('basic');

    expect(groupBackendProfileCandidates([raw, basic])).toEqual([
      { backend: 'webgl2', candidates: [raw] },
      { backend: 'pixi', candidates: [basic] },
    ]);
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

  it('resolves a backend/profile selection descriptor from legacy startup quality', () => {
    expect(resolveRenderBackendProfileSelection('enhanced', ['basic', 'enhanced'])).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });

  it('keeps unsupported raw startup quality out of the selection descriptor', () => {
    expect(resolveRenderBackendProfileSelection('raw', ['basic', 'enhanced'])).toEqual({
      backend: 'pixi',
      profile: 'standard',
      legacyQuality: 'basic',
    });
  });

  it('validates backend and profile query values without accepting arbitrary strings', () => {
    expect(isRendererBackend('webgl2')).toBe(true);
    expect(isRendererBackend('canvas2d')).toBe(false);
    expect(isRenderProfile('preview')).toBe(true);
    expect(isRenderProfile('ultra')).toBe(false);
  });

  it('validates legacy render quality values at the shared runtime boundary', () => {
    expect(isRenderQuality('basic')).toBe(true);
    expect(isRenderQuality('enhanced')).toBe(true);
    expect(isRenderQuality('raw')).toBe(true);
    expect(isRenderQuality('RAW')).toBe(false);
    expect(isRenderQuality('ultra')).toBe(false);
    expect(isRenderQuality(undefined)).toBe(false);
  });

  it('prefers supported backend/profile query params over legacy quality fallback', () => {
    expect(
      resolveRenderBackendProfileQuerySelection(
        { backend: 'pixi', profile: 'high', quality: 'basic' },
        ['basic', 'enhanced', 'raw'],
      ),
    ).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });

  it('keeps unsupported backend/profile query params scoped out and falls back to legacy quality', () => {
    expect(
      resolveRenderBackendProfileQuerySelection(
        { backend: 'webgl2', profile: 'high', quality: 'enhanced' },
        ['basic', 'enhanced'],
      ),
    ).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });

  it('falls back to Pixi-safe default when query params request unsupported raw globally', () => {
    expect(
      resolveRenderBackendProfileQuerySelection(
        { backend: 'webgpu', profile: 'high', quality: 'raw' },
        ['basic', 'enhanced'],
      ),
    ).toEqual({
      backend: 'pixi',
      profile: 'standard',
      legacyQuality: 'basic',
    });
  });

  it('serializes backend/profile route params without legacy quality by default', () => {
    expect(
      serializeRenderBackendProfileRoute({
        backend: 'webgl2',
        profile: 'high',
        legacyQuality: 'raw',
      }),
    ).toEqual({ backend: 'webgl2', profile: 'high' });
  });

  it('can mirror legacy quality for compatibility test links', () => {
    expect(
      serializeRenderBackendProfileRoute(
        {
          backend: 'pixi',
          profile: 'high',
          legacyQuality: 'enhanced',
        },
        { includeLegacyQuality: true },
      ),
    ).toEqual({ backend: 'pixi', profile: 'high', quality: 'enhanced' });
  });

  it('formats host-visible backend/profile labels without exposing legacy quality terminology', () => {
    expect(
      formatRenderBackendProfileSelection({
        backend: 'webgl2',
        profile: 'high',
        legacyQuality: 'raw',
      }),
    ).toEqual({
      backendLabel: 'WebGL2',
      profileLabel: 'High',
      summary: 'WebGL2 / High',
    });
  });
});
