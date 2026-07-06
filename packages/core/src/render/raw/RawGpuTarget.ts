import { type RawRenderTextureOptions, type RawTexturePrecision } from './RawWebGL2ResourceContext.js';

export interface RawGpuTargetOptions {
  width: number;
  height: number;
  internalFormat?: number;
  format?: number;
  type?: number;
  precision?: RawTexturePrecision;
  filter?: 'nearest' | 'linear';
}

export interface RawGpuTarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
  attach(unit: number): number;
  dispose(): void;
}

export interface RawGpuDoubleTarget {
  readonly read: RawGpuTarget;
  readonly write: RawGpuTarget;
  readonly width: number;
  readonly height: number;
  swap(): void;
  dispose(): void;
}

export function createRawGpuTarget(gl: WebGL2RenderingContext, options: RawGpuTargetOptions): RawGpuTarget {
  const width = Math.max(1, Math.floor(options.width));
  const height = Math.max(1, Math.floor(options.height));
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    if (texture) gl.deleteTexture(texture);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    throw new Error('Failed to allocate raw GPU target');
  }

  const precision = options.precision ?? 'half-float';
  const internalFormat = options.internalFormat ?? (precision === 'float' ? gl.RGBA32F : gl.RGBA16F);
  const format = options.format ?? gl.RGBA;
  const type = options.type ?? (precision === 'float' ? gl.FLOAT : gl.HALF_FLOAT);
  const filter = options.filter === 'linear' ? gl.LINEAR : gl.NEAREST;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    throw new Error(`Raw GPU target framebuffer incomplete: ${status}`);
  }

  return {
    texture,
    framebuffer,
    width,
    height,
    attach(unit: number): number {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return unit;
    },
    dispose(): void {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
    },
  };
}

export function createRawGpuDoubleTarget(gl: WebGL2RenderingContext, options: RawGpuTargetOptions): RawGpuDoubleTarget {
  let read = createRawGpuTarget(gl, options);
  let write = createRawGpuTarget(gl, options);
  return {
    get read(): RawGpuTarget {
      return read;
    },
    get write(): RawGpuTarget {
      return write;
    },
    width: read.width,
    height: read.height,
    swap(): void {
      const previous = read;
      read = write;
      write = previous;
    },
    dispose(): void {
      read.dispose();
      write.dispose();
    },
  };
}

export function rawRenderTextureOptionsFromTarget(options: RawGpuTargetOptions): RawRenderTextureOptions {
  const renderOptions: RawRenderTextureOptions = {
    width: options.width,
    height: options.height,
  };
  if (options.precision !== undefined) renderOptions.precision = options.precision;
  if (options.filter !== undefined) renderOptions.filter = options.filter;
  return renderOptions;
}
