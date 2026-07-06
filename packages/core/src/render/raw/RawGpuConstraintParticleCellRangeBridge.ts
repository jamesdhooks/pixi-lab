import type { RawFramebuffer, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleCellRangeBridgeStats {
  width: number;
  height: number;
  cellCount: number;
  uploadFloats: number;
  activeRows: number;
  uploadedRows: number;
  reservedRows: number;
  uploadRowStart: number;
  activeCellStart: number;
  activeCellCount: number;
  maxCellOccupancy: number;
}

export interface RawGpuConstraintParticleCellRangeUploadOptions {
  sortedKeys: ArrayLike<number>;
  particleCount: number;
  columns: number;
  rows: number;
}

export interface RawGpuConstraintParticleCellRangeUploadResult extends RawGpuConstraintParticleCellRangeBridgeStats {
  framebuffer: RawFramebuffer;
}

export class RawGpuConstraintParticleCellRangeBridge {
  private rangeFramebuffer?: RawFramebuffer;
  private rangeData?: Float32Array;
  private residentRowStart = 0;
  private residentRowEnd = 0;
  private lastStats: RawGpuConstraintParticleCellRangeBridgeStats = {
    width: 0,
    height: 0,
    cellCount: 0,
    uploadFloats: 0,
    activeRows: 0,
    uploadedRows: 0,
    reservedRows: 0,
    uploadRowStart: 0,
    activeCellStart: 0,
    activeCellCount: 0,
    maxCellOccupancy: 0,
  };

  constructor(private readonly resources: RawWebGL2ResourceContext) {}

  upload(options: RawGpuConstraintParticleCellRangeUploadOptions): RawGpuConstraintParticleCellRangeUploadResult {
    const columns = Math.max(1, Math.floor(options.columns));
    const rows = Math.max(1, Math.floor(options.rows));
    const cellCount = columns * rows;
    const framebuffer = this.ensureFramebuffer(cellCount);
    const width = framebuffer.texture.width;
    const height = framebuffer.texture.height;
    const requiredLength = width * height * 4;
    const data = this.rangeData && this.rangeData.length === requiredLength
      ? this.rangeData
      : new Float32Array(requiredLength);
    this.rangeData = data;

    const count = Math.max(0, Math.floor(options.particleCount));
    let maxCellOccupancy = 0;
    let activeCellStart = cellCount;
    let activeCellEnd = 0;
    if (count > 0) {
      const sortStride = count + 1;
      let index = 0;
      while (index < count) {
        const rawCellKey = options.sortedKeys[index] ?? 0;
        const cellId = Math.max(0, Math.min(cellCount - 1, Math.floor(rawCellKey / sortStride)));
        const start = index;
        index += 1;
        while (index < count) {
          const nextRawCellKey = options.sortedKeys[index] ?? 0;
          if (Math.floor(nextRawCellKey / sortStride) !== cellId) break;
          index += 1;
        }
        const occupancy = index - start;
        activeCellStart = Math.min(activeCellStart, cellId);
        activeCellEnd = Math.max(activeCellEnd, cellId + 1);
        if (occupancy > maxCellOccupancy) maxCellOccupancy = occupancy;
      }
    }

    const activeRows = activeCellEnd > activeCellStart
      ? Math.max(0, Math.ceil(activeCellEnd / width) - Math.floor(activeCellStart / width))
      : 0;
    const activeRowStart = activeRows > 0 ? Math.floor(activeCellStart / width) : 0;
    const activeRowEnd = activeRows > 0 ? Math.ceil(activeCellEnd / width) : 0;
    const hadResidentRows = this.residentRowEnd > this.residentRowStart;
    const uploadRowStart = activeRows > 0 && hadResidentRows
      ? Math.min(activeRowStart, this.residentRowStart)
      : activeRows > 0
        ? activeRowStart
        : this.residentRowStart;
    const uploadRowEnd = activeRows > 0 && hadResidentRows
      ? Math.max(activeRowEnd, this.residentRowEnd)
      : activeRows > 0
        ? activeRowEnd
        : this.residentRowEnd;
    const uploadedRows = Math.max(0, uploadRowEnd - uploadRowStart);
    const uploadOffset = uploadRowStart * width * 4;
    const uploadFloats = uploadedRows * width * 4;
    if (uploadedRows > 0) {
      data.fill(0, uploadOffset, uploadOffset + uploadFloats);
    }

    if (count > 0 && activeRows > 0) {
      const sortStride = count + 1;
      let index = 0;
      while (index < count) {
        const rawCellKey = options.sortedKeys[index] ?? 0;
        const cellId = Math.max(0, Math.min(cellCount - 1, Math.floor(rawCellKey / sortStride)));
        const start = index;
        index += 1;
        while (index < count) {
          const nextRawCellKey = options.sortedKeys[index] ?? 0;
          if (Math.floor(nextRawCellKey / sortStride) !== cellId) break;
          index += 1;
        }
        const cellOffset = cellId * 4;
        const occupancy = index - start;
        data[cellOffset] = start;
        data[cellOffset + 1] = index;
        data[cellOffset + 2] = occupancy;
        data[cellOffset + 3] = 1;
      }
    }

    const gl = this.resources.gl;
    if (uploadedRows > 0) {
      gl.bindTexture(gl.TEXTURE_2D, framebuffer.texture.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, uploadRowStart, width, uploadedRows, gl.RGBA, gl.FLOAT, data, uploadOffset);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    this.residentRowStart = activeRowStart;
    this.residentRowEnd = activeRowEnd;
    this.lastStats = {
      width,
      height,
      cellCount,
      uploadFloats,
      activeRows,
      uploadedRows,
      reservedRows: height,
      uploadRowStart,
      activeCellStart: activeRows > 0 ? activeCellStart : 0,
      activeCellCount: activeRows > 0 ? activeCellEnd - activeCellStart : 0,
      maxCellOccupancy,
    };
    return {
      ...this.lastStats,
      framebuffer,
    };
  }

  get framebuffer(): RawFramebuffer | undefined {
    return this.rangeFramebuffer;
  }

  stats(): RawGpuConstraintParticleCellRangeBridgeStats {
    return this.lastStats;
  }

  destroy(): void {
    if (this.rangeFramebuffer) this.resources.destroyFramebuffer(this.rangeFramebuffer);
    this.rangeFramebuffer = undefined;
    this.rangeData = undefined;
    this.residentRowStart = 0;
    this.residentRowEnd = 0;
    this.lastStats = {
      width: 0,
      height: 0,
      cellCount: 0,
      uploadFloats: 0,
      activeRows: 0,
      uploadedRows: 0,
      reservedRows: 0,
      uploadRowStart: 0,
      activeCellStart: 0,
      activeCellCount: 0,
      maxCellOccupancy: 0,
    };
  }

  private ensureFramebuffer(cellCount: number): RawFramebuffer {
    const width = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, cellCount))));
    const height = Math.max(1, Math.ceil(Math.max(1, cellCount) / width));
    if (this.rangeFramebuffer && this.rangeFramebuffer.texture.width === width && this.rangeFramebuffer.texture.height === height) {
      return this.rangeFramebuffer;
    }
    if (this.rangeFramebuffer) this.resources.destroyFramebuffer(this.rangeFramebuffer);
    this.rangeFramebuffer = this.resources.createFramebuffer(this.resources.createRenderTexture({
      width,
      height,
      precision: 'float',
    }));
    this.rangeData = undefined;
    this.residentRowStart = 0;
    this.residentRowEnd = 0;
    return this.rangeFramebuffer;
  }
}
