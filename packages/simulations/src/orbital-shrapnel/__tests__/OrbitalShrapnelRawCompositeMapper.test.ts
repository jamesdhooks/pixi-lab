import { describe, expect, it } from 'vitest';
import { TrailField } from '@hooksjam/pixi-lab-core';
import { compositeOrbitalShrapnelRawTrailToRgba } from '../OrbitalShrapnelRawCompositeMapper.js';
import { iceRingStyle } from '../styles/ice-ring.js';

describe('compositeOrbitalShrapnelRawTrailToRgba', () => {
  it('maps trail density into bounded RGBA pixels with palette colors', () => {
    const field = new TrailField(2, 2);
    field.set(0, 0, 0);
    field.set(1, 0, 0.5);
    field.set(0, 1, 1);
    field.set(1, 1, 2);
    const out = new Uint8Array(4 * 4);

    const result = compositeOrbitalShrapnelRawTrailToRgba(field, iceRingStyle, out);

    expect(result).toBe(out);
    expect(Array.from(out.slice(0, 4))).toEqual([2, 8, 23, 0]);
    expect(out[7]).toBeGreaterThan(0);
    expect(out[11]).toBe(255);
    expect(out[15]).toBe(255);
    expect(Math.max(...out)).toBeLessThanOrEqual(255);
  });

  it('reuses a caller buffer when explicit output dimensions match', () => {
    const field = new TrailField(2, 2);
    field.set(1, 1, 1);
    const out = new Uint8Array(4 * 4 * 4);

    const result = compositeOrbitalShrapnelRawTrailToRgba(field, iceRingStyle, out, { width: 4, height: 4 });

    expect(result).toBe(out);
    expect(result).toHaveLength(64);
    expect(out[63]).toBe(255);
  });

  it('allocates a matching output buffer when the caller buffer is the wrong size', () => {
    const field = new TrailField(3, 1);
    const tooSmall = new Uint8Array(4);

    const result = compositeOrbitalShrapnelRawTrailToRgba(field, iceRingStyle, tooSmall);

    expect(result).not.toBe(tooSmall);
    expect(result).toHaveLength(12);
  });
});
