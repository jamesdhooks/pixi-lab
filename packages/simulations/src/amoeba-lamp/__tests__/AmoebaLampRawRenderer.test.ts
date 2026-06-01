import { describe, expect, it } from 'vitest';
import { resolveAmoebaRawTextureSize } from '../AmoebaLampRawTextureSizing.js';

describe('AmoebaLampRawRenderer sizing', () => {
  it('preserves scene aspect ratio while staying inside the raw texture budget', () => {
    const size = resolveAmoebaRawTextureSize({ width: 1920, height: 1080, quality: 'raw' });

    expect(size.width).toBe(256);
    expect(size.height).toBe(144);
    expect(size.width * size.height).toBeLessThanOrEqual(256 * 256);
  });

  it('keeps raw texture dimensions bounded for tiny or invalid viewports', () => {
    expect(resolveAmoebaRawTextureSize({ width: 0, height: 0, quality: 'raw' })).toEqual({ width: 64, height: 64 });
    expect(resolveAmoebaRawTextureSize({ width: Number.NaN, height: 90, quality: 'raw' })).toEqual({ width: 64, height: 64 });
  });

  it('uses a smaller enhanced-equivalent budget when raw is accidentally passed through a non-raw path', () => {
    const size = resolveAmoebaRawTextureSize({ width: 1000, height: 1000, quality: 'enhanced' });

    expect(size).toEqual({ width: 192, height: 192 });
  });
});
