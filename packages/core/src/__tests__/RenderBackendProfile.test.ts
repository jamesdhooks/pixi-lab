import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RENDER_QUALITY_MODES,
  LEGACY_RENDER_QUALITY_STORAGE_KEY,
  RENDER_SELECTION_STORAGE_KEY,
  createEngineConfigurations,
  formatRenderBackendProfileSelection,
  getSupportedEngineConfigurations,
  getSupportedRenderQualityModes,
  groupBackendProfileCandidates,
  groupQualityModesByBackend,
  isDefaultRenderBackendProfileSelection,
  isRenderProfile,
  isRenderQuality,
  isRendererBackend,
  mapQualityModesToBackendProfiles,
  parseRenderBackendProfileStorage,
  resolveEngineConfigurationQuerySelection,
  resolveRenderBackendProfileQuerySelection,
  resolveRenderBackendProfileSelection,
  resolveRenderBackendProfileStorageSelection,
  sanitizeLegacyRenderQuality,
  serializeRenderBackendProfileRoute,
  serializeRenderBackendProfileStorage,
  toEngineConfiguration,
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

  it('centralizes default supported modes as Pixi-safe runtime capabilities', () => {
    expect(DEFAULT_RENDER_QUALITY_MODES).toEqual(['basic', 'enhanced']);
    const readonlyRawModes = ['raw'] as const;

    expect(getSupportedRenderQualityModes(undefined)).toEqual(['basic', 'enhanced']);
    expect(getSupportedRenderQualityModes({ qualityModes: [] })).toEqual(['basic', 'enhanced']);
    expect(getSupportedRenderQualityModes({ qualityModes: readonlyRawModes })).toEqual(['raw']);
  });


  it('exposes host-facing engine configurations without requiring UI callers to format legacy quality labels', () => {
    expect(getSupportedEngineConfigurations({ qualityModes: ['basic', 'raw'] })).toEqual([
      {
        id: 'basic',
        backend: 'pixi',
        profile: 'standard',
        label: 'PixiJS / Standard · Basic',
        legacyQuality: 'basic',
      },
      {
        id: 'raw',
        backend: 'webgl2',
        profile: 'high',
        label: 'WebGL2 / High · Raw',
        legacyQuality: 'raw',
      },
    ]);
    expect(toEngineConfiguration('enhanced')).toEqual({
      id: 'enhanced',
      backend: 'pixi',
      profile: 'high',
      label: 'PixiJS / High · Enhanced',
      legacyQuality: 'enhanced',
    });
  });


  it('creates explicit engine configurations for raw-capable definitions without hand-written labels', () => {
    expect(createEngineConfigurations(['basic', 'enhanced', 'raw'])).toEqual([
      {
        id: 'basic',
        backend: 'pixi',
        profile: 'standard',
        label: 'PixiJS / Standard · Basic',
        legacyQuality: 'basic',
      },
      {
        id: 'enhanced',
        backend: 'pixi',
        profile: 'high',
        label: 'PixiJS / High · Enhanced',
        legacyQuality: 'enhanced',
      },
      {
        id: 'raw',
        backend: 'webgl2',
        profile: 'high',
        label: 'WebGL2 / High · Raw',
        legacyQuality: 'raw',
      },
    ]);

    expect(createEngineConfigurations(['raw'], { rawBackend: 'pixi' })).toEqual([
      {
        id: 'raw',
        backend: 'pixi',
        profile: 'high',
        label: 'PixiJS / High · Raw',
        legacyQuality: 'raw',
      },
    ]);
  });

  it('prefers explicit engine configuration declarations while preserving legacy quality compatibility', () => {
    const configurations = [
      { id: 'raw' as const, backend: 'webgl2' as const, profile: 'high' as const, label: 'Custom Raw', legacyQuality: 'raw' as const },
      { id: 'basic' as const, backend: 'pixi' as const, profile: 'standard' as const, label: 'Custom Basic', legacyQuality: 'basic' as const },
    ];

    expect(getSupportedEngineConfigurations({ engineConfigurations: configurations, qualityModes: ['enhanced'] })).toBe(configurations);
    expect(getSupportedRenderQualityModes({ engineConfigurations: configurations, qualityModes: ['enhanced'] })).toEqual(['raw', 'basic']);
  });

  it('centralizes host storage keys at the runtime boundary', () => {
    expect(LEGACY_RENDER_QUALITY_STORAGE_KEY).toBe('pixi-lab:quality');
    expect(RENDER_SELECTION_STORAGE_KEY).toBe('pixi-lab:renderSelection');
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

  it('resolves query params through explicit engine configurations before legacy quality mappings', () => {
    const configurations = createEngineConfigurations(['basic', 'enhanced', 'raw'], { rawBackend: 'pixi' });

    expect(
      resolveEngineConfigurationQuerySelection(
        { backend: 'webgl2', profile: 'high', quality: 'raw' },
        configurations,
      ),
    ).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'raw',
    });

    expect(
      resolveEngineConfigurationQuerySelection(
        { backend: 'pixi', profile: 'high', quality: 'basic' },
        configurations,
      ),
    ).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
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

  it('identifies the Pixi standard descriptor as the default route selection', () => {
    expect(
      isDefaultRenderBackendProfileSelection({
        backend: 'pixi',
        profile: 'standard',
        legacyQuality: 'basic',
      }),
    ).toBe(true);
    expect(
      isDefaultRenderBackendProfileSelection({
        backend: 'pixi',
        profile: 'high',
        legacyQuality: 'enhanced',
      }),
    ).toBe(false);
    expect(
      isDefaultRenderBackendProfileSelection({
        backend: 'webgl2',
        profile: 'high',
        legacyQuality: 'raw',
      }),
    ).toBe(false);
  });

  it('serializes backend/profile state for storage beside legacy quality', () => {
    expect(
      serializeRenderBackendProfileStorage({
        backend: 'pixi',
        profile: 'high',
        legacyQuality: 'enhanced',
      }),
    ).toEqual({ backend: 'pixi', profile: 'high', quality: 'enhanced' });
  });

  it('parses persisted backend/profile state without accepting unknown values', () => {
    expect(
      parseRenderBackendProfileStorage({
        backend: 'webgl2',
        profile: 'ultra',
        quality: 'raw',
      }),
    ).toEqual({ backend: 'webgl2', quality: 'raw' });
    expect(parseRenderBackendProfileStorage('raw')).toBeUndefined();
  });

  it('resolves persisted backend/profile state through experience-scoped capabilities', () => {
    expect(
      resolveRenderBackendProfileStorageSelection(
        { backend: 'webgl2', profile: 'high', quality: 'raw' },
        ['basic', 'enhanced'],
      ),
    ).toEqual({ backend: 'pixi', profile: 'standard', legacyQuality: 'basic' });

    expect(
      resolveRenderBackendProfileStorageSelection(
        { backend: 'webgl2', profile: 'high', quality: 'raw' },
        ['basic', 'enhanced', 'raw'],
      ),
    ).toEqual({ backend: 'webgl2', profile: 'high', legacyQuality: 'raw' });
  });
});

