import { linkRawWebGL2Program } from './RawWebGL2ResourceContext.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';

export interface RawGpuConstraintParticleDensityRenderOptions {
  state: RawGpuConstraintParticleState;
  target: WebGLFramebuffer | null;
  width: number;
  height: number;
  worldMinX: number;
  worldMinY: number;
  worldMaxX: number;
  worldMaxY: number;
  radiusScale?: number;
  fieldScale?: number;
  opacity?: number;
  particleCount?: number;
}

export interface RawGpuConstraintParticleDensityStats {
  activeParticleCount: number;
  pointDraws: number;
}

const DENSITY_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uPosition;
uniform sampler2D uAttribute;
uniform ivec2 uStateSize;
uniform vec4 uWorldBounds;
uniform vec2 uCanvasSize;
uniform float uRadiusScale;
uniform float uFieldScale;

out float vEnabled;

void main() {
  int index = gl_VertexID;
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  vec4 position = texelFetch(uPosition, texel, 0);
  vec4 particleAttr = texelFetch(uAttribute, texel, 0);
  float rawRadius = max(position.z, particleAttr.x);
  float radius = max(rawRadius * uRadiusScale * uFieldScale, 0.0);
  vec2 worldSize = max(uWorldBounds.zw - uWorldBounds.xy, vec2(0.0001));
  vec2 normalized = (position.xy - uWorldBounds.xy) / worldSize;
  float diameterPixels = radius * 2.0 * min(uCanvasSize.x / worldSize.x, uCanvasSize.y / worldSize.y);

  vEnabled = rawRadius > 0.00001 ? 1.0 : 0.0;
  gl_Position = vEnabled > 0.0 ? vec4(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0, 0.0, 1.0) : vec4(2.0, 2.0, 0.0, 1.0);
  gl_PointSize = max(diameterPixels, 1.0);
}`;

const DENSITY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float vEnabled;
out vec4 outColor;

uniform float uOpacity;

void main() {
  if (vEnabled <= 0.0) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float density = exp(-d2 * 3.15) * (1.0 - smoothstep(0.82, 1.0, d2)) * uOpacity;
  outColor = vec4(density, density, density, density);
}`;

export class RawGpuConstraintParticleDensityRenderer {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private lastStats: RawGpuConstraintParticleDensityStats = {
    activeParticleCount: 0,
    pointDraws: 0,
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    const program = linkRawWebGL2Program(gl, {
      vertex: DENSITY_VERTEX_SHADER,
      fragment: DENSITY_FRAGMENT_SHADER,
    });
    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(program);
      throw new Error('Unable to allocate raw GPU constraint-particle density renderer geometry');
    }
    this.program = program;
    this.vao = vao;
  }

  render(options: RawGpuConstraintParticleDensityRenderOptions): void {
    const gl = this.gl;
    const opacity = clamp(finiteOr(options.opacity, 1), 0, 4);
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

    gl.bindFramebuffer(gl.FRAMEBUFFER, options.target);
    gl.viewport(0, 0, Math.max(1, Math.floor(options.width)), Math.max(1, Math.floor(options.height)));
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, options.state.positions.read.texture.texture);
    gl.uniform1i(this.uniform('uPosition'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, options.state.attributes.texture.texture);
    gl.uniform1i(this.uniform('uAttribute'), 1);
    gl.uniform2i(this.uniform('uStateSize'), options.state.width, options.state.height);
    gl.uniform4f(this.uniform('uWorldBounds'), options.worldMinX, options.worldMinY, options.worldMaxX, options.worldMaxY);
    gl.uniform2f(this.uniform('uCanvasSize'), Math.max(1, options.width), Math.max(1, options.height));
    gl.uniform1f(this.uniform('uRadiusScale'), Math.max(0, finiteOr(options.radiusScale, 1)));
    gl.uniform1f(this.uniform('uFieldScale'), Math.max(0, finiteOr(options.fieldScale, 2.35)));
    gl.uniform1f(this.uniform('uOpacity'), opacity);

    gl.drawArrays(gl.POINTS, 0, activeCount);
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

  stats(): RawGpuConstraintParticleDensityStats {
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
