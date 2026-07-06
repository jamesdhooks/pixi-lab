import type { RawFramebuffer, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleBodyMetadataUploadOptions {
  bodyCount: number;
  centerX: ArrayLike<number>;
  centerY: ArrayLike<number>;
  restArea?: ArrayLike<number>;
  restRadius?: ArrayLike<number>;
}

export interface RawGpuConstraintParticleBodyMetadataStats {
  width: number;
  height: number;
  bodyCount: number;
  uploadFloats: number;
}

export interface RawGpuConstraintParticleBodyMetadataUploadResult extends RawGpuConstraintParticleBodyMetadataStats {
  framebuffer: RawFramebuffer;
}

export class RawGpuConstraintParticleBodyMetadataBridge {
  private metadataFramebuffer?: RawFramebuffer;
  private data?: Float32Array;
  private lastStats: RawGpuConstraintParticleBodyMetadataStats = {
    width: 0,
    height: 0,
    bodyCount: 0,
    uploadFloats: 0,
  };

  constructor(private readonly resources: RawWebGL2ResourceContext) {}

  upload(options: RawGpuConstraintParticleBodyMetadataUploadOptions): RawGpuConstraintParticleBodyMetadataUploadResult {
    const bodyCount = Math.max(0, Math.floor(options.bodyCount));
    const width = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, bodyCount))));
    const height = Math.max(1, Math.ceil(Math.max(1, bodyCount) / width));
    const framebuffer = this.ensureFramebuffer(width, height);
    const requiredLength = width * height * 4;
    const data = this.data && this.data.length === requiredLength
      ? this.data
      : new Float32Array(requiredLength);
    this.data = data;
    data.fill(0);

    for (let body = 0; body < bodyCount; body += 1) {
      const offset = body * 4;
      const area = options.restArea ? finiteOr(options.restArea[body], 0) : 0;
      const radius = options.restRadius
        ? finiteOr(options.restRadius[body], 0)
        : area > 0 ? Math.sqrt(area / Math.PI) : 0;
      data[offset] = finiteOr(options.centerX[body], 0);
      data[offset + 1] = finiteOr(options.centerY[body], 0);
      data[offset + 2] = Math.max(0, radius);
      data[offset + 3] = radius > 0 ? 1 : 0;
    }

    const gl = this.resources.gl;
    gl.bindTexture(gl.TEXTURE_2D, framebuffer.texture.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.lastStats = {
      width,
      height,
      bodyCount,
      uploadFloats: requiredLength,
    };
    return {
      ...this.lastStats,
      framebuffer,
    };
  }

  get framebuffer(): RawFramebuffer | undefined {
    return this.metadataFramebuffer;
  }

  stats(): RawGpuConstraintParticleBodyMetadataStats {
    return this.lastStats;
  }

  destroy(): void {
    if (this.metadataFramebuffer) this.resources.destroyFramebuffer(this.metadataFramebuffer);
    this.metadataFramebuffer = undefined;
    this.data = undefined;
    this.lastStats = {
      width: 0,
      height: 0,
      bodyCount: 0,
      uploadFloats: 0,
    };
  }

  private ensureFramebuffer(width: number, height: number): RawFramebuffer {
    if (this.metadataFramebuffer && this.metadataFramebuffer.texture.width === width && this.metadataFramebuffer.texture.height === height) {
      return this.metadataFramebuffer;
    }
    if (this.metadataFramebuffer) this.resources.destroyFramebuffer(this.metadataFramebuffer);
    this.metadataFramebuffer = this.resources.createFramebuffer(this.resources.createRenderTexture({
      width,
      height,
      precision: 'float',
    }));
    this.data = undefined;
    return this.metadataFramebuffer;
  }
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
