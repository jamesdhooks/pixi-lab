import { describe, expect, it } from 'vitest';
import type { RenderQuality } from '@hooksjam/pixi-lab-core';
import { sanitizeRenderQuality } from '../qualitySelection.js';

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
