import { describe, expect, it } from 'vitest';
import type { RenderQuality } from '@hooksjam/pixi-lab-core';
import {
  resolveRenderSelection,
  resolveStoredRenderSelection,
  sanitizeRenderQuality,
} from '../engineConfigurationSelection.js';
import {
  resolveRenderSelection as resolveLegacyRenderSelection,
  sanitizeRenderQuality as sanitizeLegacyRenderQuality,
} from '../qualitySelection.js';

describe('qualitySelection compatibility shim', () => {
  it('forwards legacy quality helpers to the engine configuration implementation', () => {
    expect(sanitizeLegacyRenderQuality('raw', ['basic', 'enhanced'])).toBe(sanitizeRenderQuality('raw', ['basic', 'enhanced']));
    expect(resolveLegacyRenderSelection('enhanced', ['basic', 'enhanced'])).toEqual(
      resolveRenderSelection('enhanced', ['basic', 'enhanced']),
    );
  });
});

describe('sanitizeRenderQuality', () => {
  it('keeps raw only when the active experience advertises raw', () => {
    expect(sanitizeRenderQuality('raw', ['basic', 'enhanced', 'raw'])).toBe('raw');
    expect(sanitizeRenderQuality('raw', ['basic', 'enhanced'])).toBe('basic');
  });

  it('falls back to basic for missing, invalid, or unsupported quality values', () => {
    expect(sanitizeRenderQuality(null, ['basic', 'enhanced'])).toBe('basic');
    expect(sanitizeRenderQuality('ultra', ['basic', 'enhanced'])).toBe('basic');
    expect(sanitizeRenderQuality('enhanced', ['basic'])).toBe('basic');
  });

  it('uses the first advertised mode when basic is not advertised', () => {
    const rawOnly = ['raw'] satisfies RenderQuality[];
    expect(sanitizeRenderQuality('basic', rawOnly)).toBe('raw');
  });

  it('delegates unsupported raw fallback through the shared runtime bridge', () => {
    const standardOnly = ['enhanced'] satisfies RenderQuality[];
    expect(sanitizeRenderQuality('raw', standardOnly)).toBe('enhanced');
  });

  it('uses the shared Pixi-safe default modes when capabilities omit quality modes', () => {
    expect(sanitizeRenderQuality('enhanced', undefined)).toBe('enhanced');
    expect(sanitizeRenderQuality('raw', undefined)).toBe('basic');
  });
});

describe('resolveRenderSelection', () => {
  it('exposes the backend/profile descriptor while preserving legacy quality', () => {
    expect(resolveRenderSelection('enhanced', ['basic', 'enhanced'])).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });

  it('keeps unsupported raw requests scoped out of React runtime state', () => {
    expect(resolveRenderSelection('raw', ['basic', 'enhanced'])).toEqual({
      backend: 'pixi',
      profile: 'standard',
      legacyQuality: 'basic',
    });
  });

  it('keeps opt-in raw routes represented as WebGL2 high profile selections', () => {
    expect(resolveRenderSelection('raw', ['basic', 'enhanced', 'raw'])).toEqual({
      backend: 'webgl2',
      profile: 'high',
      legacyQuality: 'raw',
    });
  });

  it('resolves omitted quality capabilities through the shared Pixi default selection', () => {
    expect(resolveRenderSelection('enhanced', undefined)).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });
});

describe('resolveStoredRenderSelection', () => {
  it('sanitizes persisted backend/profile state against the active experience capabilities with stored quality fallback', () => {
    expect(
      resolveStoredRenderSelection(
        { backend: 'webgl2', profile: 'high', quality: 'raw' },
        'enhanced',
        ['basic', 'enhanced'],
      ),
    ).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });

  it('keeps persisted raw selections only for experiences that explicitly advertise raw', () => {
    expect(
      resolveStoredRenderSelection(
        { backend: 'webgl2', profile: 'high', quality: 'raw' },
        'basic',
        ['basic', 'enhanced', 'raw'],
      ),
    ).toEqual({
      backend: 'webgl2',
      profile: 'high',
      legacyQuality: 'raw',
    });
  });

  it('falls back to the legacy quality key when the backend/profile snapshot is invalid', () => {
    expect(resolveStoredRenderSelection('raw', 'enhanced', ['basic', 'enhanced'])).toEqual({
      backend: 'pixi',
      profile: 'high',
      legacyQuality: 'enhanced',
    });
  });
});
