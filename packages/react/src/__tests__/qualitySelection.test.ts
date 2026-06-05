import { describe, expect, it } from 'vitest';
import type { RenderQuality } from '@hooksjam/pixi-lab-core';
import { resolveRenderSelection, sanitizeRenderQuality } from '../qualitySelection.js';

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
});
