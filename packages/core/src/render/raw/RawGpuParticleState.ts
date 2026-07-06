import {
  RawPingPongRenderTarget,
  type RawPingPongRenderTargetOptions,
  type RawTexturePrecision,
  type RawWebGL2ResourceContext,
} from './RawWebGL2ResourceContext.js';

export interface RawGpuParticleStateOptions {
  capacity: number;
  width?: number;
  height?: number;
  precision?: RawTexturePrecision;
}

export interface RawGpuParticleStateSeed {
  positions?: Float32Array;
  velocities?: Float32Array;
  uploadWriteTargets?: boolean;
}

export class RawGpuParticleState {
  readonly capacity: number;
  readonly width: number;
  readonly height: number;
  readonly precision: RawTexturePrecision;
  readonly positions: RawPingPongRenderTarget;
  readonly velocities: RawPingPongRenderTarget;
  private readonly writeFramebuffer: WebGLFramebuffer;
  private writeFramebufferChecked = false;
  private uploadScratch = new Float32Array(0);
  private lastSeedUploadFloats = 0;

  constructor(private readonly resources: RawWebGL2ResourceContext, options: RawGpuParticleStateOptions) {
    const size = resolveParticleTextureSize(options);
    this.capacity = size.capacity;
    this.width = size.width;
    this.height = size.height;
    this.precision = options.precision ?? 'float';

    const targetOptions: RawPingPongRenderTargetOptions = {
      width: this.width,
      height: this.height,
      precision: this.precision,
    };
    this.positions = new RawPingPongRenderTarget(resources, targetOptions);
    this.velocities = new RawPingPongRenderTarget(resources, targetOptions);

    const writeFramebuffer = resources.gl.createFramebuffer();
    if (!writeFramebuffer) {
      this.positions.destroy();
      this.velocities.destroy();
      throw new Error('Unable to allocate raw GPU particle framebuffer');
    }
    this.writeFramebuffer = writeFramebuffer;
  }

  swap(): void {
    this.positions.swap();
    this.velocities.swap();
  }

  bindWriteFramebuffer(): void {
    const gl = this.resources.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.writeFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.positions.write.texture.texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.velocities.write.texture.texture, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (!this.writeFramebufferChecked) {
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        throw new Error(`Raw GPU particle framebuffer incomplete: ${status}`);
      }
      this.writeFramebufferChecked = true;
    }
  }

  unbindWriteFramebuffer(): void {
    this.resources.gl.bindFramebuffer(this.resources.gl.FRAMEBUFFER, null);
  }

  clear(): void {
    this.clearTarget(this.positions);
    this.clearTarget(this.velocities);
  }

  uploadSeed(seed: RawGpuParticleStateSeed): void {
    if (this.precision !== 'float') {
      throw new Error('RawGpuParticleState seed uploads require float precision');
    }
    const uploadWriteTargets = seed.uploadWriteTargets ?? true;
    this.lastSeedUploadFloats = 0;
    if (seed.positions) this.lastSeedUploadFloats += this.uploadFloatState(this.positions, seed.positions, uploadWriteTargets);
    if (seed.velocities) this.lastSeedUploadFloats += this.uploadFloatState(this.velocities, seed.velocities, uploadWriteTargets);
  }

  seedUploadFloats(): number {
    return this.lastSeedUploadFloats;
  }

  destroy(): void {
    this.resources.gl.deleteFramebuffer(this.writeFramebuffer);
    this.positions.destroy();
    this.velocities.destroy();
  }

  private clearTarget(target: RawPingPongRenderTarget): void {
    const gl = this.resources.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.read.framebuffer);
    gl.viewport(0, 0, target.width, target.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.write.framebuffer);
    gl.viewport(0, 0, target.width, target.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private uploadFloatState(target: RawPingPongRenderTarget, source: Float32Array, uploadWriteTarget: boolean): number {
    const gl = this.resources.gl;
    const dataLength = this.width * this.height * 4;
    const data = source.length === dataLength ? source : this.ensureUploadScratch(dataLength);
    if (data !== source) {
      data.fill(0);
      const copyLength = Math.min(source.length, dataLength);
      for (let index = 0; index < copyLength; index += 1) data[index] = source[index] ?? 0;
    }

    gl.bindTexture(gl.TEXTURE_2D, target.read.texture.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, data);
    let uploadedFloats = dataLength;
    if (uploadWriteTarget) {
      gl.bindTexture(gl.TEXTURE_2D, target.write.texture.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.FLOAT, data);
      uploadedFloats += dataLength;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    return uploadedFloats;
  }

  private ensureUploadScratch(length: number): Float32Array {
    if (this.uploadScratch.length < length) this.uploadScratch = new Float32Array(length);
    return this.uploadScratch;
  }
}

interface ResolvedParticleTextureSize {
  capacity: number;
  width: number;
  height: number;
}

function resolveParticleTextureSize(options: RawGpuParticleStateOptions): ResolvedParticleTextureSize {
  const requestedCapacity = Math.max(1, Math.floor(options.capacity));
  if (options.width !== undefined || options.height !== undefined) {
    const width = Math.max(1, Math.floor(options.width ?? Math.ceil(Math.sqrt(requestedCapacity))));
    const height = Math.max(1, Math.floor(options.height ?? Math.ceil(requestedCapacity / width)));
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
