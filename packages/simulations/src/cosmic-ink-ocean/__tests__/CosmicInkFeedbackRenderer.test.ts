import { describe, expect, it } from 'vitest';
import { buildCosmicInkFeedbackStamps } from '../CosmicInkFeedbackRenderer.js';

const particles = [
  {
    position: { x: 50, y: 25 },
    velocity: { x: 30, y: -10 },
    size: 3,
    color: 0xffffff,
    alpha: 0.5,
  },
  {
    position: { x: -20, y: 240 },
    velocity: { x: 0, y: 0 },
    size: 1,
    color: 0xffffff,
    alpha: 0.1,
  },
];

describe('buildCosmicInkFeedbackStamps', () => {
  it('maps particles into bounded feedback stamps with quality-scaled budget', () => {
    const basic = buildCosmicInkFeedbackStamps(particles, {
      width: 100,
      height: 200,
      quality: 'basic',
      palette: [0x102030, 0x405060],
    });
    const enhanced = buildCosmicInkFeedbackStamps(particles, {
      width: 100,
      height: 200,
      quality: 'enhanced',
      palette: [0x102030, 0x405060],
    });

    expect(basic).toHaveLength(1);
    expect(enhanced).toHaveLength(2);
    expect(enhanced[0]).toMatchObject({
      x: 50,
      y: 25,
      dx: 30,
      dy: -10,
      color: 0x102030,
    });
    expect(enhanced[0].radius).toBeGreaterThan(5);
    expect(enhanced[0].alpha).toBeGreaterThan(0.1);
    expect(enhanced[1].x).toBe(0);
    expect(enhanced[1].y).toBe(200);
    expect(enhanced[1].color).toBe(0x405060);
  });

  it('returns no stamps for unusable dimensions or an empty particle list', () => {
    expect(buildCosmicInkFeedbackStamps([], { width: 100, height: 100, quality: 'basic', palette: [] })).toEqual([]);
    expect(buildCosmicInkFeedbackStamps(particles, { width: 0, height: 100, quality: 'basic', palette: [] })).toEqual([]);
  });
});
