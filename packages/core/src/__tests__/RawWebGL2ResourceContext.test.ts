import { describe, expect, it, vi } from 'vitest';
import { RawWebGL2ResourceContext, linkRawWebGL2Program } from '../render/raw/RawWebGL2ResourceContext.js';

function createFakeGl(overrides: Partial<WebGL2RenderingContext> = {}): WebGL2RenderingContext {
  const constants = {
    MAX_TEXTURE_SIZE: 0x0d33,
    FRAMEBUFFER: 0x8d40,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    COLOR_ATTACHMENT0: 0x8ce0,
    RGBA: 0x1908,
    RGBA16F: 0x881a,
    RGBA32F: 0x8814,
    HALF_FLOAT: 0x140b,
    FLOAT: 0x1406,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    CLAMP_TO_EDGE: 0x812f,
    NEAREST: 0x2600,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
  };

  return {
    ...constants,
    canvas: { width: 64, height: 32 } as HTMLCanvasElement,
    getParameter: vi.fn((key: number) => (key === constants.MAX_TEXTURE_SIZE ? 4096 : 0)),
    getExtension: vi.fn((name: string) => ({
      EXT_color_buffer_float: {},
      OES_texture_float_linear: {},
      EXT_float_blend: {},
    })[name] ?? null),
    createTexture: vi.fn(() => ({}) as WebGLTexture),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    deleteTexture: vi.fn(),
    createFramebuffer: vi.fn(() => ({}) as WebGLFramebuffer),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => constants.FRAMEBUFFER_COMPLETE),
    deleteFramebuffer: vi.fn(),
    createShader: vi.fn(() => ({}) as WebGLShader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({}) as WebGLProgram),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: vi.fn(),
    getError: vi.fn(() => 0),
    ...overrides,
  } as unknown as WebGL2RenderingContext;
}

describe('RawWebGL2ResourceContext', () => {
  it('reports supported float framebuffer capabilities', () => {
    const gl = createFakeGl();
    const resources = new RawWebGL2ResourceContext(gl);

    expect(resources.capabilities.supported).toBe(true);
    expect(resources.capabilities.maxTextureSize).toBe(4096);
    expect(resources.capabilities.floatColorBuffer).toBe(true);
    expect(resources.capabilities.fallbackReasons).toEqual([]);
  });

  it('reports fallback reasons when float color buffers are unavailable', () => {
    const gl = createFakeGl({ getExtension: vi.fn(() => null) });
    const resources = new RawWebGL2ResourceContext(gl);

    expect(resources.capabilities.supported).toBe(false);
    expect(resources.capabilities.floatColorBuffer).toBe(false);
    expect(resources.capabilities.fallbackReasons).toContain('EXT_color_buffer_float unavailable');
  });

  it('creates and tracks a float render texture', () => {
    const gl = createFakeGl();
    const resources = new RawWebGL2ResourceContext(gl);

    const texture = resources.createRenderTexture({ width: 32, height: 16, precision: 'half-float' });

    expect(texture.width).toBe(32);
    expect(texture.height).toBe(16);
    expect(texture.precision).toBe('half-float');
    expect(gl.createTexture).toHaveBeenCalledTimes(1);
    expect(gl.texImage2D).toHaveBeenCalled();

    resources.destroy();
    expect(gl.deleteTexture).toHaveBeenCalledWith(texture.texture);
  });

  it('creates a framebuffer and validates completeness', () => {
    const gl = createFakeGl();
    const resources = new RawWebGL2ResourceContext(gl);
    const texture = resources.createRenderTexture({ width: 8, height: 8, precision: 'float' });

    const framebuffer = resources.createFramebuffer(texture);

    expect(framebuffer.texture).toBe(texture);
    expect(gl.checkFramebufferStatus).toHaveBeenCalledWith(gl.FRAMEBUFFER);

    resources.destroy();
    expect(gl.deleteFramebuffer).toHaveBeenCalledWith(framebuffer.framebuffer);
  });

  it('throws a structured error for incomplete framebuffers', () => {
    const gl = createFakeGl({ checkFramebufferStatus: vi.fn(() => 0) });
    const resources = new RawWebGL2ResourceContext(gl);
    const texture = resources.createRenderTexture({ width: 8, height: 8, precision: 'float' });

    expect(() => resources.createFramebuffer(texture)).toThrow('Raw WebGL2 framebuffer incomplete');
  });

  it('deletes already-created shaders when program linking fails during shader compilation', () => {
    const vertexShader = { kind: 'vertex' } as WebGLShader;
    const gl = createFakeGl({
      createShader: vi
        .fn()
        .mockReturnValueOnce(vertexShader)
        .mockReturnValueOnce({ kind: 'fragment' } as WebGLShader),
      getShaderParameter: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false),
      getShaderInfoLog: vi.fn(() => 'fragment failed'),
    });

    expect(() =>
      linkRawWebGL2Program(gl, {
        vertex: 'void main() {}',
        fragment: 'void main() {}',
      }),
    ).toThrow('Raw WebGL2 shader compile failed');
    expect(gl.deleteShader).toHaveBeenCalledWith(vertexShader);
    expect(gl.deleteProgram).toHaveBeenCalled();
  });

  it('tracks resize generation metadata without reallocating resources', () => {
    const gl = createFakeGl();
    const resources = new RawWebGL2ResourceContext(gl);

    expect(resources.size).toEqual({ width: 64, height: 32 });
    expect(resources.generation).toBe(0);

    resources.resize(128, 64);
    expect(resources.size).toEqual({ width: 128, height: 64 });
    expect(resources.generation).toBe(1);

    resources.resize(128, 64);
    expect(resources.generation).toBe(1);
  });
});
