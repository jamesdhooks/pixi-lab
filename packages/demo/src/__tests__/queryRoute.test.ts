import { describe, expect, it } from 'vitest';
import type { LabExperience } from '@hooksjam/pixi-lab-core';
import { findQueryExperience, parseQueryQuality } from '../App';

const EXPERIENCES = [
  { id: 'amoeba-lamp', name: 'Amoeba Lamp' },
  { id: 'fluid-tank', name: 'Fluid Tank' },
] as LabExperience[];

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
});
