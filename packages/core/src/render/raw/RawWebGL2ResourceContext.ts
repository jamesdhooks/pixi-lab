export interface RawWebGL2ProgramSources {
  vertex: string;
  fragment: string;
}

export function compileRawWebGL2Shader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate WebGL2 shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(`Raw WebGL2 shader compile failed: ${info}`);
  }
  return shader;
}

export function linkRawWebGL2Program(gl: WebGL2RenderingContext, sources: RawWebGL2ProgramSources): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to allocate WebGL2 shader program');

  let vertex: WebGLShader | null = null;
  let fragment: WebGLShader | null = null;

  try {
    vertex = compileRawWebGL2Shader(gl, gl.VERTEX_SHADER, sources.vertex);
    fragment = compileRawWebGL2Shader(gl, gl.FRAGMENT_SHADER, sources.fragment);

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? 'unknown shader link error';
      throw new Error(`Raw WebGL2 shader link failed: ${info}`);
    }

    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
  }
}

export interface RawWebGL2Capabilities {
  supported: boolean;
  maxTextureSize: number;
  floatColorBuffer: boolean;
  floatTextureLinear: boolean;
  floatBlend: boolean;
  fallbackReasons: string[];
}

export interface RawResourceSize {
  width: number;
  height: number;
}

export type RawTexturePrecision = 'float' | 'half-float';

export interface RawRenderTexture {
  texture: WebGLTexture;
  width: number;
  height: number;
  precision: RawTexturePrecision;
}

export interface RawFramebuffer {
  framebuffer: WebGLFramebuffer;
  texture: RawRenderTexture;
}

export interface RawRenderTextureOptions {
  width: number;
  height: number;
  precision?: RawTexturePrecision;
}

export class RawWebGL2ResourceContext {
  readonly gl: WebGL2RenderingContext;
  readonly capabilities: RawWebGL2Capabilities;

  private readonly textures = new Set<WebGLTexture>();
  private readonly framebuffers = new Set<WebGLFramebuffer>();
  private currentSize: RawResourceSize;
  private currentGeneration = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.currentSize = {
      width: Math.max(1, Math.floor(gl.canvas.width || 1)),
      height: Math.max(1, Math.floor(gl.canvas.height || 1)),
    };
    this.capabilities = this.detectCapabilities();
  }

  get size(): RawResourceSize {
    return this.currentSize;
  }

  get generation(): number {
    return this.currentGeneration;
  }

  resize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (this.currentSize.width === nextWidth && this.currentSize.height === nextHeight) return;
    this.currentSize = { width: nextWidth, height: nextHeight };
    this.currentGeneration += 1;
  }

  compileShader(type: number, source: string): WebGLShader {
    return compileRawWebGL2Shader(this.gl, type, source);
  }

  linkProgram(sources: RawWebGL2ProgramSources): WebGLProgram {
    return linkRawWebGL2Program(this.gl, sources);
  }

  createRenderTexture(options: RawRenderTextureOptions): RawRenderTexture {
    const width = Math.max(1, Math.floor(options.width));
    const height = Math.max(1, Math.floor(options.height));
    const precision = options.precision ?? 'half-float';
    const texture = this.gl.createTexture();
    if (!texture) throw new Error('Unable to allocate raw WebGL2 texture');

    const internalFormat = precision === 'float' ? this.gl.RGBA32F : this.gl.RGBA16F;
    const type = precision === 'float' ? this.gl.FLOAT : this.gl.HALF_FLOAT;

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, internalFormat, width, height, 0, this.gl.RGBA, type, null);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.textures.add(texture);

    return { texture, width, height, precision };
  }

  createFramebuffer(texture: RawRenderTexture): RawFramebuffer {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) throw new Error('Unable to allocate raw WebGL2 framebuffer');

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture.texture, 0);
    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      this.gl.deleteFramebuffer(framebuffer);
      throw new Error(`Raw WebGL2 framebuffer incomplete: ${status}`);
    }

    this.framebuffers.add(framebuffer);
    return { framebuffer, texture };
  }

  destroy(): void {
    for (const framebuffer of this.framebuffers) this.gl.deleteFramebuffer(framebuffer);
    for (const texture of this.textures) this.gl.deleteTexture(texture);
    this.framebuffers.clear();
    this.textures.clear();
  }

  private detectCapabilities(): RawWebGL2Capabilities {
    const maxTextureSize = Number(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) ?? 0);
    const floatColorBuffer = this.gl.getExtension('EXT_color_buffer_float') !== null;
    const floatTextureLinear = this.gl.getExtension('OES_texture_float_linear') !== null;
    const floatBlend = this.gl.getExtension('EXT_float_blend') !== null;
    const fallbackReasons: string[] = [];

    if (!floatColorBuffer) fallbackReasons.push('EXT_color_buffer_float unavailable');
    if (maxTextureSize < 1024) fallbackReasons.push(`MAX_TEXTURE_SIZE too small: ${maxTextureSize}`);

    return {
      supported: fallbackReasons.length === 0,
      maxTextureSize,
      floatColorBuffer,
      floatTextureLinear,
      floatBlend,
      fallbackReasons,
    };
  }
}
