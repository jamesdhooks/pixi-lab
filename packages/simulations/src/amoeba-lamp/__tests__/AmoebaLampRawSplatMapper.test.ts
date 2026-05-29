import { describe, expect, it } from 'vitest';
import { mapAmoebaParticlesToRawSplats } from '../AmoebaLampRawSplatMapper.js';

describe('mapAmoebaParticlesToRawSplats', () => {
  it('maps model particles into bounded normalized density and heat splats', () => {
    const splats = mapAmoebaParticlesToRawSplats(
      [
        { x: 120, y: 75 },
        { x: -20, y: 340 },
        { x: 500, y: 150 },
      ],
      {
        width: 480,
        height: 300,
        textureWidth: 96,
        textureHeight: 60,
        densityRadius: 3.5,
      },
    );

    expect(splats).toHaveLength(3);
    expect(splats[0]).toEqual({
      x: 0.25,
      y: 0.25,
      texelX: 24,
      texelY: 15,
      radius: 8.4,
      density: 1,
      heat: 0.48,
    });
    for (const splat of splats) {
      expect(splat.x).toBeGreaterThanOrEqual(0);
      expect(splat.x).toBeLessThanOrEqual(1);
      expect(splat.y).toBeGreaterThanOrEqual(0);
      expect(splat.y).toBeLessThanOrEqual(1);
      expect(splat.texelX).toBeGreaterThanOrEqual(0);
      expect(splat.texelX).toBeLessThanOrEqual(95);
      expect(splat.texelY).toBeGreaterThanOrEqual(0);
      expect(splat.texelY).toBeLessThanOrEqual(59);
      expect(splat.radius).toBeGreaterThan(0);
      expect(splat.density).toBeGreaterThan(0);
      expect(splat.heat).toBeGreaterThanOrEqual(0.15);
      expect(splat.heat).toBeLessThanOrEqual(1);
    }
  });

  it('caps splats to a raw upload budget deterministically', () => {
    const particles = Array.from({ length: 12 }, (_, index) => ({ x: index * 10, y: 20 + index }));

    const splats = mapAmoebaParticlesToRawSplats(particles, {
      width: 120,
      height: 80,
      textureWidth: 64,
      textureHeight: 64,
      densityRadius: 4,
      maxSplats: 5,
    });

    expect(splats).toHaveLength(5);
    expect(splats.map((s) => s.texelX)).toEqual([0, 5, 11, 16, 21]);
  });
});
