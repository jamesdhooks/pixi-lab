import type {
  RawFramebuffer,
  RawTexturePrecision,
  RawWebGL2ResourceContext,
} from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleNeighborSlotsOptions {
  width: number;
  height: number;
  slots: number;
  precision?: RawTexturePrecision;
}

export interface RawGpuConstraintParticleNeighborSlotSeed {
  slot: number;
  data: Float32Array;
}

export class RawGpuConstraintParticleNeighborSlots {
  readonly width: number;
  readonly height: number;
  readonly slotCount: number;
  readonly precision: RawTexturePrecision;
  readonly framebuffers: readonly RawFramebuffer[];
  private readonly mutableFramebuffers: RawFramebuffer[];
  private uploadScratch = new Float32Array(0);
  private lastSeedUploadFloats = 0;
  private lastDirectUploadFloats = 0;
  private lastPaddedUploadFloats = 0;
  private lastActiveRows = 0;
  private lastUploadedRows = 0;
  private lastReservedRows = 0;
  private residentRows = 0;

  constructor(private readonly resources: RawWebGL2ResourceContext, options: RawGpuConstraintParticleNeighborSlotsOptions) {
    this.width = Math.max(1, Math.floor(options.width));
    this.height = Math.max(1, Math.floor(options.height));
    this.slotCount = Math.max(1, Math.floor(options.slots));
    this.precision = options.precision ?? 'float';
    this.mutableFramebuffers = [];
    try {
      for (let slot = 0; slot < this.slotCount; slot += 1) {
        this.mutableFramebuffers.push(resources.createFramebuffer(resources.createRenderTexture({
          width: this.width,
          height: this.height,
          precision: this.precision,
        })));
      }
    } catch (error) {
      this.destroy();
      throw error;
    }
    this.framebuffers = this.mutableFramebuffers;
  }

  clear(): void {
    const gl = this.resources.gl;
    for (const framebuffer of this.mutableFramebuffers) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);
      gl.viewport(0, 0, framebuffer.texture.width, framebuffer.texture.height);
      gl.clearColor(-1, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.lastActiveRows = 0;
    this.lastUploadedRows = this.height;
    this.lastReservedRows = this.height;
    this.residentRows = 0;
  }

  uploadSeed(seeds: readonly RawGpuConstraintParticleNeighborSlotSeed[]): void {
    if (this.precision !== 'float') {
      throw new Error('RawGpuConstraintParticleNeighborSlots seed uploads require float precision');
    }
    this.lastSeedUploadFloats = 0;
    this.resetUploadPathStats();
    this.lastActiveRows = this.height;
    this.lastUploadedRows = this.height;
    this.lastReservedRows = this.height;
    this.residentRows = this.height;
    for (const seed of seeds) {
      if (seed.slot < 0 || seed.slot >= this.mutableFramebuffers.length) continue;
      this.lastSeedUploadFloats += this.uploadSlot(seed.slot, seed.data);
    }
    this.resources.gl.bindTexture(this.resources.gl.TEXTURE_2D, null);
  }

  uploadSlots(slots: readonly Float32Array[]): void {
    if (this.precision !== 'float') {
      throw new Error('RawGpuConstraintParticleNeighborSlots slot uploads require float precision');
    }
    this.lastSeedUploadFloats = 0;
    this.resetUploadPathStats();
    this.lastActiveRows = this.height;
    this.lastUploadedRows = this.height;
    this.lastReservedRows = this.height;
    this.residentRows = this.height;
    const count = Math.min(slots.length, this.mutableFramebuffers.length);
    for (let slot = 0; slot < count; slot += 1) this.lastSeedUploadFloats += this.uploadSlot(slot, slots[slot]);
    this.resources.gl.bindTexture(this.resources.gl.TEXTURE_2D, null);
  }

  uploadActiveSlots(slots: readonly Float32Array[], particleCount: number): void {
    if (this.precision !== 'float') {
      throw new Error('RawGpuConstraintParticleNeighborSlots slot uploads require float precision');
    }
    this.lastSeedUploadFloats = 0;
    this.resetUploadPathStats();
    const count = Math.min(slots.length, this.mutableFramebuffers.length);
    const activeCount = Math.max(0, Math.min(this.width * this.height, Math.floor(particleCount)));
    const activeRows = activeCount > 0 ? Math.max(1, Math.min(this.height, Math.ceil(activeCount / Math.max(1, this.width)))) : 0;
    const uploadRows = Math.max(activeRows, this.residentRows);
    this.lastActiveRows = activeRows;
    this.lastUploadedRows = uploadRows;
    this.lastReservedRows = this.height;
    this.residentRows = activeRows;
    for (let slot = 0; slot < count; slot += 1) this.lastSeedUploadFloats += this.uploadSlotRows(slot, slots[slot], uploadRows);
    this.resources.gl.bindTexture(this.resources.gl.TEXTURE_2D, null);
  }

  uploadActiveSlotRange(slots: readonly Float32Array[], startParticle: number, particleCount: number): void {
    if (this.precision !== 'float') {
      throw new Error('RawGpuConstraintParticleNeighborSlots slot range uploads require float precision');
    }
    this.lastSeedUploadFloats = 0;
    this.resetUploadPathStats();
    const first = Math.max(0, Math.min(this.width * this.height, Math.floor(startParticle)));
    const count = Math.max(0, Math.floor(particleCount));
    if (count <= 0 || first >= this.width * this.height) return;
    const end = Math.max(first, Math.min(this.width * this.height, first + count));
    const rowStart = Math.floor(first / this.width);
    const rowEnd = Math.ceil(end / this.width);
    const rows = Math.max(0, Math.min(this.height, rowEnd) - Math.max(0, rowStart));
    if (rows <= 0) return;
    this.lastActiveRows = Math.max(this.lastActiveRows, rows);
    this.lastUploadedRows = rows;
    this.lastReservedRows = this.height;
    this.residentRows = Math.max(this.residentRows, rowStart + rows);
    const slotCount = Math.min(slots.length, this.mutableFramebuffers.length);
    for (let slot = 0; slot < slotCount; slot += 1) {
      this.lastSeedUploadFloats += this.uploadSlotRowRange(slot, slots[slot], rowStart, rows);
    }
    this.resources.gl.bindTexture(this.resources.gl.TEXTURE_2D, null);
  }

  seedUploadFloats(): number {
    return this.lastSeedUploadFloats;
  }

  directUploadFloats(): number {
    return this.lastDirectUploadFloats;
  }

  paddedUploadFloats(): number {
    return this.lastPaddedUploadFloats;
  }

  activeRows(): number {
    return this.lastActiveRows;
  }

  uploadedRows(): number {
    return this.lastUploadedRows;
  }

  reservedRows(): number {
    return this.lastReservedRows || this.height;
  }

  private uploadSlot(slot: number, source: Float32Array): number {
    const gl = this.resources.gl;
    const requiredLength = this.width * this.height * 4;
    const data = source.length === requiredLength ? source : this.ensureUploadScratch(requiredLength);
    if (data !== source) {
      data.fill(0);
      const copyLength = Math.min(source.length, requiredLength);
      for (let index = 0; index < copyLength; index += 1) data[index] = source[index] ?? 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.mutableFramebuffers[slot].texture.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, data);
    return requiredLength;
  }

  private uploadSlotRows(slot: number, source: Float32Array, rows: number): number {
    const gl = this.resources.gl;
    const uploadRows = Math.max(0, Math.min(this.height, rows));
    if (uploadRows <= 0) return 0;
    const requiredLength = this.width * uploadRows * 4;
    if (source.length >= requiredLength) {
      gl.bindTexture(gl.TEXTURE_2D, this.mutableFramebuffers[slot].texture.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, uploadRows, gl.RGBA, gl.FLOAT, source, 0);
      this.lastDirectUploadFloats += requiredLength;
      return requiredLength;
    }

    const data = this.ensureUploadScratch(requiredLength);
    this.lastPaddedUploadFloats += requiredLength;
    {
      data.fill(0);
      const copyLength = Math.min(source.length, requiredLength);
      for (let index = 0; index < copyLength; index += 1) data[index] = source[index] ?? 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.mutableFramebuffers[slot].texture.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, uploadRows, gl.RGBA, gl.FLOAT, data);
    return requiredLength;
  }

  private uploadSlotRowRange(slot: number, source: Float32Array, rowStart: number, rows: number): number {
    const gl = this.resources.gl;
    const uploadRowStart = Math.max(0, Math.floor(rowStart));
    const uploadRows = Math.max(0, Math.min(this.height - uploadRowStart, Math.floor(rows)));
    const requiredLength = this.width * uploadRows * 4;
    const sourceOffset = uploadRowStart * this.width * 4;
    if (requiredLength <= 0) return 0;
    gl.bindTexture(gl.TEXTURE_2D, this.mutableFramebuffers[slot].texture.texture);
    if (source.length >= sourceOffset + requiredLength) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, uploadRowStart, this.width, uploadRows, gl.RGBA, gl.FLOAT, source, sourceOffset);
      this.lastDirectUploadFloats += requiredLength;
      return requiredLength;
    }

    const data = this.ensureUploadScratch(requiredLength);
    this.lastPaddedUploadFloats += requiredLength;
    data.fill(0);
    const copyLength = Math.max(0, Math.min(source.length - sourceOffset, requiredLength));
    for (let index = 0; index < copyLength; index += 1) data[index] = source[sourceOffset + index] ?? 0;
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, uploadRowStart, this.width, uploadRows, gl.RGBA, gl.FLOAT, data);
    return requiredLength;
  }

  private ensureUploadScratch(length: number): Float32Array {
    if (this.uploadScratch.length < length) this.uploadScratch = new Float32Array(length);
    return this.uploadScratch;
  }

  private resetUploadPathStats(): void {
    this.lastDirectUploadFloats = 0;
    this.lastPaddedUploadFloats = 0;
  }

  destroy(): void {
    while (this.mutableFramebuffers.length > 0) {
      const framebuffer = this.mutableFramebuffers.pop();
      if (framebuffer) this.resources.destroyFramebuffer(framebuffer);
    }
  }
}
