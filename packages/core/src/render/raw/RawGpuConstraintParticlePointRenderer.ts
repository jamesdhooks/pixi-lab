import { linkRawWebGL2Program } from './RawWebGL2ResourceContext.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';

export interface RawGpuConstraintParticlePointRenderOptions {
  state: RawGpuConstraintParticleState;
  target?: WebGLFramebuffer | null;
  width: number;
  height: number;
  worldMinX: number;
  worldMinY: number;
  worldMaxX: number;
  worldMaxY: number;
  colorR?: number;
  colorG?: number;
  colorB?: number;
  opacity?: number;
  pointScale?: number;
  radiusScale?: number;
  palette?: readonly number[];
  particleCount?: number;
}

export interface RawGpuConstraintParticlePointStats {
  activeParticleCount: number;
  pointDraws: number;
}

const POINT_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uPosition;
uniform sampler2D uAttribute;
uniform ivec2 uStateSize;
uniform vec4 uWorldBounds;
uniform vec2 uCanvasSize;
uniform float uPointScale;
uniform float uRadiusScale;

out float vAlpha;
flat out int vId;

void main() {
  int index = gl_VertexID;
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  vec4 position = texelFetch(uPosition, texel, 0);
  vec4 particleAttr = texelFetch(uAttribute, texel, 0);
  vec2 worldSize = max(uWorldBounds.zw - uWorldBounds.xy, vec2(0.0001));
  vec2 normalized = (position.xy - uWorldBounds.xy) / worldSize;
  float rawRadius = max(position.z, particleAttr.x);
  float radius = max(rawRadius * uRadiusScale, 0.0);
  float diameterPixels = radius * 2.0 * uPointScale * min(uCanvasSize.x / worldSize.x, uCanvasSize.y / worldSize.y);

  vAlpha = rawRadius > 0.00001 ? 1.0 : 0.0;
  vId = index + int(position.w * 17.0 + particleAttr.w * 31.0);
  gl_Position = vAlpha > 0.0 ? vec4(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0, 0.0, 1.0) : vec4(2.0, 2.0, 0.0, 1.0);
  gl_PointSize = max(diameterPixels, 1.0);
}`;

const POINT_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float vAlpha;
flat in int vId;
out vec4 outColor;

uniform vec4 uColor;
uniform vec3 uPalette[8];
uniform int uPaletteCount;

uint hashId(int id) {
  uint x = uint(id) * 747796405u + 2891336453u;
  x = ((x >> 16) ^ x) * 2246822519u;
  x = ((x >> 13) ^ x) * 3266489917u;
  return (x >> 16) ^ x;
}

vec3 particleColor(int id) {
  if (uPaletteCount <= 0) return uColor.rgb;
  int index = int(hashId(id) % uint(uPaletteCount));
  return uPalette[index];
}

void main() {
  if (vAlpha <= 0.0) discard;
  vec2 centered = gl_PointCoord * 2.0 - 1.0;
  float distance2 = dot(centered, centered);
  if (distance2 > 1.0) discard;
  float edge = smoothstep(1.0, 0.86, distance2);
  outColor = vec4(particleColor(vId), uColor.a * edge);
}`;

export class RawGpuConstraintParticlePointRenderer {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly paletteData = new Float32Array(8 * 3);
  private lastStats: RawGpuConstraintParticlePointStats = {
    activeParticleCount: 0,
    pointDraws: 0,
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    const program = linkRawWebGL2Program(gl, {
      vertex: POINT_VERTEX_SHADER,
      fragment: POINT_FRAGMENT_SHADER,
    });
    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(program);
      throw new Error('Unable to allocate raw GPU constraint-particle point renderer geometry');
    }
    this.program = program;
    this.vao = vao;
  }

  render(options: RawGpuConstraintParticlePointRenderOptions): void {
    const gl = this.gl;
    const opacity = clamp(finiteOr(options.opacity, 1), 0, 1);
    if (opacity <= 0) {
      this.lastStats = {
        activeParticleCount: 0,
        pointDraws: 0,
      };
      return;
    }
    const activeCount = activeParticleCount(options.particleCount, options.state.capacity);
    this.lastStats = {
      activeParticleCount: activeCount,
      pointDraws: activeCount,
    };

    gl.bindFramebuffer(gl.FRAMEBUFFER, options.target ?? null);
    gl.viewport(0, 0, Math.max(1, Math.floor(options.width)), Math.max(1, Math.floor(options.height)));
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, options.state.positions.read.texture.texture);
    gl.uniform1i(this.uniform('uPosition'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, options.state.attributes.texture.texture);
    gl.uniform1i(this.uniform('uAttribute'), 1);
    gl.uniform2i(this.uniform('uStateSize'), options.state.width, options.state.height);
    gl.uniform4f(this.uniform('uWorldBounds'), options.worldMinX, options.worldMinY, options.worldMaxX, options.worldMaxY);
    gl.uniform2f(this.uniform('uCanvasSize'), Math.max(1, options.width), Math.max(1, options.height));
    gl.uniform1f(this.uniform('uPointScale'), Math.max(0, finiteOr(options.pointScale, 1)));
    gl.uniform1f(this.uniform('uRadiusScale'), Math.max(0, finiteOr(options.radiusScale, 1)));
    gl.uniform4f(
      this.uniform('uColor'),
      clamp(finiteOr(options.colorR, 1), 0, 1),
      clamp(finiteOr(options.colorG, 1), 0, 1),
      clamp(finiteOr(options.colorB, 1), 0, 1),
      opacity,
    );
    const paletteCount = writePalette(this.paletteData, options.palette);
    gl.uniform3fv(this.uniform('uPalette[0]'), this.paletteData);
    gl.uniform1i(this.uniform('uPaletteCount'), paletteCount);

    gl.drawArrays(gl.POINTS, 0, activeCount);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
  }

  destroy(): void {
    this.uniforms.clear();
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }

  stats(): RawGpuConstraintParticlePointStats {
    return this.lastStats;
  }

  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.uniforms.get(name) ?? null;
  }
}

function activeParticleCount(count: number | undefined, capacity: number): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return capacity;
  return Math.max(0, Math.min(capacity, Math.floor(count)));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function writePalette(target: Float32Array, palette: readonly number[] | undefined): number {
  if (!palette || palette.length === 0) return 0;
  const count = Math.min(8, palette.length);
  for (let index = 0; index < count; index += 1) {
    const color = palette[index] ?? 0xffffff;
    const offset = index * 3;
    target[offset] = ((color >> 16) & 255) / 255;
    target[offset + 1] = ((color >> 8) & 255) / 255;
    target[offset + 2] = (color & 255) / 255;
  }
  return count;
}
