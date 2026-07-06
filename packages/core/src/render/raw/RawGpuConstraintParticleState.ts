import {
  RawPingPongRenderTarget,
  type RawFramebuffer,
  type RawPingPongRenderTargetOptions,
  type RawTexturePrecision,
  type RawWebGL2ResourceContext,
} from './RawWebGL2ResourceContext.js';
import { createRawGpuSimulationMetrics, type RawGpuSimulationMetrics } from './RawGpuMetrics.js';

export interface RawGpuConstraintParticleStateOptions {
  capacity: number;
  width?: number;
  height?: number;
  maxConstraints?: number;
  constraintWidth?: number;
  constraintHeight?: number;
  precision?: RawTexturePrecision;
}

export interface RawGpuConstraintParticleSeed {
  positions?: Float32Array;
  velocities?: Float32Array;
  attributes?: Float32Array;
  constraints?: Float32Array;
  uploadWriteTargets?: boolean;
  particleCount?: number;
  constraintCount?: number;
}

export interface RawGpuConstraintParticleStateMetricsOptions {
  engine?: string;
  passesPerFrame?: number;
  cpuUploadBytesPerFrame?: number;
}

export class RawGpuConstraintParticleState {
  readonly capacity: number;
  readonly width: number;
  readonly height: number;
  readonly constraintCapacity: number;
  readonly constraintWidth: number;
  readonly constraintHeight: number;
  readonly precision: RawTexturePrecision;
  readonly positions: RawPingPongRenderTarget;
  readonly velocities: RawPingPongRenderTarget;
  readonly attributes: RawFramebuffer;
  readonly constraints: RawFramebuffer;
  private readonly dynamicWriteFramebuffer: WebGLFramebuffer;
  private dynamicFramebufferChecked = false;
  private uploadScratch = new Float32Array(0);
  private lastSeedUploadFloats = 0;
  private lastDynamicUploadFloats = 0;
  private lastAttributeUploadFloats = 0;
  private lastDirectUploadFloats = 0;
  private lastPaddedUploadFloats = 0;
  private lastParticleActiveRows = 0;
  private lastParticleUploadedRows = 0;
  private lastParticleReservedRows = 0;
  private lastConstraintActiveRows = 0;
  private lastConstraintUploadedRows = 0;
  private lastConstraintReservedRows = 0;

  constructor(private readonly resources: RawWebGL2ResourceContext, options: RawGpuConstraintParticleStateOptions) {
    const particleSize = resolveTextureSize({
      capacity: options.capacity,
      width: options.width,
      height: options.height,
    });
    const constraintSize = resolveTextureSize({
      capacity: options.maxConstraints ?? Math.max(1, options.capacity * 2),
      width: options.constraintWidth,
      height: options.constraintHeight,
    });
    this.capacity = particleSize.capacity;
    this.width = particleSize.width;
    this.height = particleSize.height;
    this.constraintCapacity = constraintSize.capacity;
    this.constraintWidth = constraintSize.width;
    this.constraintHeight = constraintSize.height;
    this.precision = options.precision ?? 'float';

    const particleTargetOptions: RawPingPongRenderTargetOptions = {
      width: this.width,
      height: this.height,
      precision: this.precision,
    };
    this.positions = new RawPingPongRenderTarget(resources, particleTargetOptions);
    this.velocities = new RawPingPongRenderTarget(resources, particleTargetOptions);
    this.attributes = resources.createFramebuffer(resources.createRenderTexture({
      width: this.width,
      height: this.height,
      precision: this.precision,
    }));
    this.constraints = resources.createFramebuffer(resources.createRenderTexture({
      width: this.constraintWidth,
      height: this.constraintHeight,
      precision: this.precision,
    }));

    const dynamicWriteFramebuffer = resources.gl.createFramebuffer();
    if (!dynamicWriteFramebuffer) {
      this.positions.destroy();
      this.velocities.destroy();
      resources.destroyFramebuffer(this.attributes);
      resources.destroyFramebuffer(this.constraints);
      throw new Error('Unable to allocate raw GPU constraint-particle framebuffer');
    }
    this.dynamicWriteFramebuffer = dynamicWriteFramebuffer;
  }

  swap(): void {
    this.positions.swap();
    this.velocities.swap();
  }

  bindDynamicWriteFramebuffer(): void {
    const gl = this.resources.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.dynamicWriteFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.positions.write.texture.texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.velocities.write.texture.texture, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (!this.dynamicFramebufferChecked) {
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        throw new Error(`Raw GPU constraint-particle framebuffer incomplete: ${status}`);
      }
      this.dynamicFramebufferChecked = true;
    }
  }

  unbindDynamicWriteFramebuffer(): void {
    this.resources.gl.bindFramebuffer(this.resources.gl.FRAMEBUFFER, null);
  }

  clear(): void {
    this.clearPingPong(this.positions);
    this.clearPingPong(this.velocities);
    this.clearFramebuffer(this.attributes);
    this.clearFramebuffer(this.constraints);
  }

  uploadSeed(seed: RawGpuConstraintParticleSeed): void {
    if (this.precision !== 'float') {
      throw new Error('RawGpuConstraintParticleState seed uploads require float precision');
    }
    const uploadWriteTargets = seed.uploadWriteTargets ?? true;
    const particleRows = activeRows(seed.particleCount ?? this.capacity, this.width, this.height);
    const constraintRows = activeRows(seed.constraintCount ?? this.constraintCapacity, this.constraintWidth, this.constraintHeight);
    this.lastSeedUploadFloats = 0;
    this.resetUploadPathStats();
    this.recordParticleRows(particleRows);
    this.recordConstraintRows(constraintRows);
    if (seed.positions) this.lastSeedUploadFloats += this.uploadFloatTexture(this.positions.read.texture.texture, seed.positions, this.width, particleRows);
    if (seed.positions && uploadWriteTargets) this.lastSeedUploadFloats += this.uploadFloatTexture(this.positions.write.texture.texture, seed.positions, this.width, particleRows);
    if (seed.velocities) this.lastSeedUploadFloats += this.uploadFloatTexture(this.velocities.read.texture.texture, seed.velocities, this.width, particleRows);
    if (seed.velocities && uploadWriteTargets) this.lastSeedUploadFloats += this.uploadFloatTexture(this.velocities.write.texture.texture, seed.velocities, this.width, particleRows);
    if (seed.attributes) this.lastSeedUploadFloats += this.uploadFloatTexture(this.attributes.texture.texture, seed.attributes, this.width, particleRows);
    if (seed.constraints) this.lastSeedUploadFloats += this.uploadFloatTexture(this.constraints.texture.texture, seed.constraints, this.constraintWidth, constraintRows);
  }

  uploadDynamicState(seed: Pick<RawGpuConstraintParticleSeed, 'positions' | 'velocities' | 'particleCount' | 'uploadWriteTargets'>): void {
    if (this.precision !== 'float') {
      throw new Error('RawGpuConstraintParticleState dynamic uploads require float precision');
    }
    const uploadWriteTargets = seed.uploadWriteTargets ?? false;
    const particleRows = activeRows(seed.particleCount ?? this.capacity, this.width, this.height);
    this.lastDynamicUploadFloats = 0;
    this.resetUploadPathStats();
    this.recordParticleRows(particleRows);
    if (seed.positions) this.lastDynamicUploadFloats += this.uploadFloatTexture(this.positions.read.texture.texture, seed.positions, this.width, particleRows);
    if (seed.positions && uploadWriteTargets) this.lastDynamicUploadFloats += this.uploadFloatTexture(this.positions.write.texture.texture, seed.positions, this.width, particleRows);
    if (seed.velocities) this.lastDynamicUploadFloats += this.uploadFloatTexture(this.velocities.read.texture.texture, seed.velocities, this.width, particleRows);
    if (seed.velocities && uploadWriteTargets) this.lastDynamicUploadFloats += this.uploadFloatTexture(this.velocities.write.texture.texture, seed.velocities, this.width, particleRows);
  }

  uploadAttributes(seed: Pick<RawGpuConstraintParticleSeed, 'attributes' | 'particleCount'>): void {
    if (this.precision !== 'float') {
      throw new Error('RawGpuConstraintParticleState attribute uploads require float precision');
    }
    const particleRows = activeRows(seed.particleCount ?? this.capacity, this.width, this.height);
    this.lastAttributeUploadFloats = 0;
    this.resetUploadPathStats();
    this.recordParticleRows(particleRows);
    if (seed.attributes) this.lastAttributeUploadFloats += this.uploadFloatTexture(this.attributes.texture.texture, seed.attributes, this.width, particleRows);
  }

  uploadAttributeRange(attributes: Float32Array, startParticle: number, particleCount: number): void {
    if (this.precision !== 'float') {
      throw new Error('RawGpuConstraintParticleState attribute range uploads require float precision');
    }
    this.lastAttributeUploadFloats = 0;
    this.resetUploadPathStats();
    const first = Math.max(0, Math.min(this.capacity, Math.floor(startParticle)));
    const count = Math.max(0, Math.floor(particleCount));
    if (count <= 0 || first >= this.capacity) return;
    const end = Math.max(first, Math.min(this.capacity, first + count));
    const rowStart = Math.floor(first / this.width);
    const rowEnd = Math.ceil(end / this.width);
    const rows = Math.max(0, Math.min(this.height, rowEnd) - Math.max(0, rowStart));
    if (rows <= 0) return;
    this.recordParticleRows(rows);
    this.lastAttributeUploadFloats = this.uploadFloatTextureRows(this.attributes.texture.texture, attributes, this.width, rowStart, rows);
  }

  seedUploadFloats(): number {
    return this.lastSeedUploadFloats;
  }

  dynamicUploadFloats(): number {
    return this.lastDynamicUploadFloats;
  }

  attributeUploadFloats(): number {
    return this.lastAttributeUploadFloats;
  }

  directUploadFloats(): number {
    return this.lastDirectUploadFloats;
  }

  paddedUploadFloats(): number {
    return this.lastPaddedUploadFloats;
  }

  particleActiveRows(): number {
    return this.lastParticleActiveRows;
  }

  particleUploadedRows(): number {
    return this.lastParticleUploadedRows;
  }

  particleReservedRows(): number {
    return this.lastParticleReservedRows || this.height;
  }

  constraintActiveRows(): number {
    return this.lastConstraintActiveRows;
  }

  constraintUploadedRows(): number {
    return this.lastConstraintUploadedRows;
  }

  constraintReservedRows(): number {
    return this.lastConstraintReservedRows || this.constraintHeight;
  }

  metrics(options: RawGpuConstraintParticleStateMetricsOptions = {}): RawGpuSimulationMetrics {
    return createRawGpuSimulationMetrics({
      engine: options.engine ?? 'raw-gpu-constraint-particles',
      stateWidth: this.width,
      stateHeight: this.height,
      stateTextures: 4,
      precision: this.precision,
      passesPerFrame: options.passesPerFrame ?? 0,
      cpuUploadBytesPerFrame: options.cpuUploadBytesPerFrame,
      capabilities: this.resources.capabilities,
    });
  }

  destroy(): void {
    this.resources.gl.deleteFramebuffer(this.dynamicWriteFramebuffer);
    this.positions.destroy();
    this.velocities.destroy();
    this.resources.destroyFramebuffer(this.attributes);
    this.resources.destroyFramebuffer(this.constraints);
  }

  private clearPingPong(target: RawPingPongRenderTarget): void {
    this.clearFramebuffer(target.read);
    this.clearFramebuffer(target.write);
  }

  private clearFramebuffer(target: RawFramebuffer): void {
    const gl = this.resources.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.texture.width, target.texture.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private uploadFloatTexture(texture: WebGLTexture, source: Float32Array, width: number, height: number): number {
    const gl = this.resources.gl;
    const dataLength = width * height * 4;
    if (source.length >= dataLength) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, source, 0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.lastDirectUploadFloats += dataLength;
      return dataLength;
    }

    const data = this.ensureUploadScratch(dataLength);
    this.lastPaddedUploadFloats += dataLength;
    {
      data.fill(0);
      const copyLength = Math.min(source.length, dataLength);
      for (let index = 0; index < copyLength; index += 1) data[index] = source[index] ?? 0;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return dataLength;
  }

  private uploadFloatTextureRows(texture: WebGLTexture, source: Float32Array, width: number, rowStart: number, rows: number): number {
    const gl = this.resources.gl;
    const uploadRowStart = Math.max(0, Math.floor(rowStart));
    const uploadRows = Math.max(0, Math.floor(rows));
    const dataLength = width * uploadRows * 4;
    const sourceOffset = uploadRowStart * width * 4;
    if (dataLength <= 0) return 0;
    if (source.length >= sourceOffset + dataLength) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, uploadRowStart, width, uploadRows, gl.RGBA, gl.FLOAT, source, sourceOffset);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.lastDirectUploadFloats += dataLength;
      return dataLength;
    }

    const data = this.ensureUploadScratch(dataLength);
    this.lastPaddedUploadFloats += dataLength;
    data.fill(0);
    const copyLength = Math.max(0, Math.min(source.length - sourceOffset, dataLength));
    for (let index = 0; index < copyLength; index += 1) data[index] = source[sourceOffset + index] ?? 0;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, uploadRowStart, width, uploadRows, gl.RGBA, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return dataLength;
  }

  private resetUploadPathStats(): void {
    this.lastDirectUploadFloats = 0;
    this.lastPaddedUploadFloats = 0;
  }

  private recordParticleRows(rows: number): void {
    const safeRows = Math.max(0, Math.min(this.height, Math.floor(rows)));
    this.lastParticleActiveRows = safeRows;
    this.lastParticleUploadedRows = safeRows;
    this.lastParticleReservedRows = this.height;
  }

  private recordConstraintRows(rows: number): void {
    const safeRows = Math.max(0, Math.min(this.constraintHeight, Math.floor(rows)));
    this.lastConstraintActiveRows = safeRows;
    this.lastConstraintUploadedRows = safeRows;
    this.lastConstraintReservedRows = this.constraintHeight;
  }

  private ensureUploadScratch(length: number): Float32Array {
    if (this.uploadScratch.length < length) this.uploadScratch = new Float32Array(length);
    return this.uploadScratch;
  }
}

function activeRows(count: number, width: number, height: number): number {
  return Math.max(1, Math.min(height, Math.ceil(Math.max(1, Math.floor(count)) / Math.max(1, width))));
}

interface TextureSizeInput {
  capacity: number;
  width?: number;
  height?: number;
}

interface ResolvedTextureSize {
  capacity: number;
  width: number;
  height: number;
}

function resolveTextureSize(input: TextureSizeInput): ResolvedTextureSize {
  const requestedCapacity = Math.max(1, Math.floor(input.capacity));
  if (input.width !== undefined || input.height !== undefined) {
    const width = Math.max(1, Math.floor(input.width ?? Math.ceil(Math.sqrt(requestedCapacity))));
    const height = Math.max(1, Math.floor(input.height ?? Math.ceil(requestedCapacity / width)));
    return {
      capacity: Math.min(requestedCapacity, width * height),
      width,
      height,
    };
  }

  const width = Math.max(1, Math.ceil(Math.sqrt(requestedCapacity)));
  const height = Math.max(1, Math.ceil(requestedCapacity / width));
  return {
    capacity: requestedCapacity,
    width,
    height,
  };
}
