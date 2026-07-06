import type { RawFramebuffer, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleIndexMapBridgeStats {
  width: number;
  height: number;
  particleCount: number;
  activeRows: number;
  uploadedRows: number;
  reservedRows: number;
  uploadFloats: number;
}

export interface RawGpuConstraintParticleIndexMapUploadOptions {
  sortedToOriginal: ArrayLike<number>;
  particleCount: number;
  sortedTextureWidth: number;
  targetWidth: number;
  targetHeight: number;
}

export interface RawGpuConstraintParticleIndexMapUploadFromSortedKeysOptions {
  sortedKeys: ArrayLike<number>;
  particleCount: number;
  sortStride: number;
  sortedTextureWidth: number;
  targetWidth: number;
  targetHeight: number;
}

export interface RawGpuConstraintParticleIndexMapUploadResult extends RawGpuConstraintParticleIndexMapBridgeStats {
  framebuffer: RawFramebuffer;
}

export class RawGpuConstraintParticleIndexMapBridge {
  private mapFramebuffer?: RawFramebuffer;
  private mapData?: Float32Array;
  private lastStats: RawGpuConstraintParticleIndexMapBridgeStats = {
    width: 0,
    height: 0,
    particleCount: 0,
    activeRows: 0,
    uploadedRows: 0,
    reservedRows: 0,
    uploadFloats: 0,
  };

  constructor(private readonly resources: RawWebGL2ResourceContext) {}

  upload(options: RawGpuConstraintParticleIndexMapUploadOptions): RawGpuConstraintParticleIndexMapUploadResult {
    return this.uploadMapped({
      particleCount: options.particleCount,
      sortedTextureWidth: options.sortedTextureWidth,
      targetWidth: options.targetWidth,
      targetHeight: options.targetHeight,
      originalForSortedIndex: (sortedIndex) => Math.floor(options.sortedToOriginal[sortedIndex] ?? -1),
    });
  }

  uploadFromSortedKeys(options: RawGpuConstraintParticleIndexMapUploadFromSortedKeysOptions): RawGpuConstraintParticleIndexMapUploadResult {
    const sortStride = Math.max(1, Math.floor(options.sortStride));
    return this.uploadMapped({
      particleCount: options.particleCount,
      sortedTextureWidth: options.sortedTextureWidth,
      targetWidth: options.targetWidth,
      targetHeight: options.targetHeight,
      originalForSortedIndex: (sortedIndex) => Math.floor((options.sortedKeys[sortedIndex] ?? -1) % sortStride),
    });
  }

  private uploadMapped(options: {
    particleCount: number;
    sortedTextureWidth: number;
    targetWidth: number;
    targetHeight: number;
    originalForSortedIndex: (sortedIndex: number) => number;
  }): RawGpuConstraintParticleIndexMapUploadResult {
    const width = Math.max(1, Math.floor(options.targetWidth));
    const height = Math.max(1, Math.floor(options.targetHeight));
    const framebuffer = this.ensureFramebuffer(width, height);
    const count = Math.max(0, Math.min(width * height, Math.floor(options.particleCount)));
    const activeRows = count > 0 ? Math.max(1, Math.min(height, Math.ceil(count / width))) : 0;
    const previousRows = this.lastStats.width === width && this.lastStats.height === height ? this.lastStats.uploadedRows : 0;
    const uploadedRows = Math.max(activeRows, previousRows);
    const requiredLength = width * uploadedRows * 4;
    const data = this.mapData && this.mapData.length === requiredLength
      ? this.mapData
      : new Float32Array(requiredLength);
    this.mapData = data;
    data.fill(0);

    const sortedTextureWidth = Math.max(1, Math.floor(options.sortedTextureWidth));
    for (let sortedIndex = 0; sortedIndex < count; sortedIndex += 1) {
      const originalIndex = options.originalForSortedIndex(sortedIndex);
      if (originalIndex < 0 || originalIndex >= count) continue;
      const offset = originalIndex * 4;
      data[offset] = sortedIndex % sortedTextureWidth;
      data[offset + 1] = Math.floor(sortedIndex / sortedTextureWidth);
      data[offset + 2] = sortedIndex;
      data[offset + 3] = 1;
    }

    const gl = this.resources.gl;
    if (uploadedRows > 0) {
      gl.bindTexture(gl.TEXTURE_2D, framebuffer.texture.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, uploadedRows, gl.RGBA, gl.FLOAT, data);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    this.lastStats = {
      width,
      height,
      particleCount: count,
      activeRows,
      uploadedRows,
      reservedRows: height,
      uploadFloats: requiredLength,
    };
    return {
      ...this.lastStats,
      framebuffer,
    };
  }

  get framebuffer(): RawFramebuffer | undefined {
    return this.mapFramebuffer;
  }

  stats(): RawGpuConstraintParticleIndexMapBridgeStats {
    return this.lastStats;
  }

  destroy(): void {
    if (this.mapFramebuffer) this.resources.destroyFramebuffer(this.mapFramebuffer);
    this.mapFramebuffer = undefined;
    this.mapData = undefined;
    this.lastStats = {
      width: 0,
      height: 0,
      particleCount: 0,
      activeRows: 0,
      uploadedRows: 0,
      reservedRows: 0,
      uploadFloats: 0,
    };
  }

  private ensureFramebuffer(width: number, height: number): RawFramebuffer {
    if (this.mapFramebuffer && this.mapFramebuffer.texture.width === width && this.mapFramebuffer.texture.height === height) {
      return this.mapFramebuffer;
    }
    if (this.mapFramebuffer) this.resources.destroyFramebuffer(this.mapFramebuffer);
    this.mapFramebuffer = this.resources.createFramebuffer(this.resources.createRenderTexture({
      width,
      height,
      precision: 'float',
    }));
    this.mapData = undefined;
    return this.mapFramebuffer;
  }
}
