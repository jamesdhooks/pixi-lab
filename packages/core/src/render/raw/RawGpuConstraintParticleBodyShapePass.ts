import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import type { RawFramebuffer } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleBodyShapeOptions {
  state: RawGpuConstraintParticleState;
  bodyMetadata: RawFramebuffer;
  particleCount?: number;
  bodyCount?: number;
  minRadiusScale?: number;
  maxRadiusScale?: number;
  stiffness?: number;
  velocityBlend?: number;
}

export interface RawGpuConstraintParticleBodyShapeStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  bodyCount: number;
  bodyMetadataWidth: number;
  bodyMetadataHeight: number;
  minRadiusScale: number;
  maxRadiusScale: number;
}

const BODY_SHAPE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const BODY_SHAPE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uAttribute;
uniform sampler2D uBodyMetadata;
uniform ivec2 uStateSize;
uniform ivec2 uBodyMetadataSize;
uniform int uCapacity;
uniform int uBodyCount;
uniform float uMinRadiusScale;
uniform float uMaxRadiusScale;
uniform float uStiffness;
uniform float uVelocityBlend;

vec4 readBody(int body) {
  ivec2 texel = ivec2(body % uBodyMetadataSize.x, body / uBodyMetadataSize.x);
  return texelFetch(uBodyMetadata, texel, 0);
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int index = texel.y * uStateSize.x + texel.x;
  vec4 position = texelFetch(uPosition, texel, 0);
  vec4 velocity = texelFetch(uVelocity, texel, 0);
  vec4 particleAttr = texelFetch(uAttribute, texel, 0);

  if (index >= uCapacity) {
    outPosition = position;
    outVelocity = velocity;
    return;
  }

  float inverseMass = max(max(velocity.z, particleAttr.y), 0.0);
  int body = int(floor(particleAttr.z + 0.5));
  if (inverseMass <= 0.0 || body < 0 || body >= uBodyCount) {
    outPosition = position;
    outVelocity = velocity;
    return;
  }

  vec4 metadata = readBody(body);
  if (metadata.w <= 0.0 || metadata.z <= 0.0) {
    outPosition = position;
    outVelocity = velocity;
    return;
  }

  vec2 center = metadata.xy;
  float restRadius = metadata.z;
  vec2 delta = position.xy - center;
  float distance = length(delta);
  vec2 normal = distance > 0.0001 ? delta / distance : vec2(1.0, 0.0);
  float inner = restRadius * max(0.0, uMinRadiusScale);
  float outer = restRadius * max(inner / max(restRadius, 0.0001), uMaxRadiusScale);
  float signedError = 0.0;
  if (distance > outer) {
    signedError = outer - distance;
  } else if (distance < inner) {
    signedError = inner - distance;
  }

  vec2 nextPosition = position.xy;
  vec2 nextVelocity = velocity.xy;
  if (abs(signedError) > 0.0001) {
    vec2 offset = normal * signedError * clamp(uStiffness, 0.0, 1.0);
    nextPosition += offset;
    nextVelocity += offset * clamp(uVelocityBlend, 0.0, 1.0);
  }

  outPosition = vec4(nextPosition, position.zw);
  outVelocity = vec4(nextVelocity, velocity.zw);
}`;

export class RawGpuConstraintParticleBodyShapePass {
  private readonly pass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleBodyShapeStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    bodyCount: 0,
    bodyMetadataWidth: 0,
    bodyMetadataHeight: 0,
    minRadiusScale: 0,
    maxRadiusScale: 0,
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: BODY_SHAPE_VERTEX_SHADER,
      fragment: BODY_SHAPE_FRAGMENT_SHADER,
    });
  }

  solve(options: RawGpuConstraintParticleBodyShapeOptions): void {
    const state = options.state;
    const activeCount = activeParticleCount(options.particleCount, state.capacity);
    const activeRows = activeTextureRows(activeCount, state.width, state.height);
    const bodyCount = Math.max(0, Math.floor(options.bodyCount ?? options.bodyMetadata.texture.width * options.bodyMetadata.texture.height));
    const minRadiusScale = Math.max(0, finiteOr(options.minRadiusScale, 0.16));
    const maxRadiusScale = Math.max(minRadiusScale, finiteOr(options.maxRadiusScale, 1.12));
    this.lastStats = {
      activeParticleCount: activeCount,
      activeRows,
      fragmentTexels: state.width * activeRows,
      bodyCount,
      bodyMetadataWidth: options.bodyMetadata.texture.width,
      bodyMetadataHeight: options.bodyMetadata.texture.height,
      minRadiusScale,
      maxRadiusScale,
    };

    state.bindDynamicWriteFramebuffer();
    this.pass.render({
      width: state.width,
      height: activeRows,
      preserveFramebuffer: true,
      bind: (gl, _program, uniform) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, state.positions.read.texture.texture);
        gl.uniform1i(uniform('uPosition'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, state.velocities.read.texture.texture);
        gl.uniform1i(uniform('uVelocity'), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, state.attributes.texture.texture);
        gl.uniform1i(uniform('uAttribute'), 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, options.bodyMetadata.texture.texture);
        gl.uniform1i(uniform('uBodyMetadata'), 3);
        gl.uniform2i(uniform('uStateSize'), state.width, state.height);
        gl.uniform2i(uniform('uBodyMetadataSize'), options.bodyMetadata.texture.width, options.bodyMetadata.texture.height);
        gl.uniform1i(uniform('uCapacity'), activeCount);
        gl.uniform1i(uniform('uBodyCount'), bodyCount);
        gl.uniform1f(uniform('uMinRadiusScale'), minRadiusScale);
        gl.uniform1f(uniform('uMaxRadiusScale'), maxRadiusScale);
        gl.uniform1f(uniform('uStiffness'), clamp(finiteOr(options.stiffness, 0.08), 0, 1));
        gl.uniform1f(uniform('uVelocityBlend'), clamp(finiteOr(options.velocityBlend, 0.12), 0, 1));
      },
    });
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    state.unbindDynamicWriteFramebuffer();
    state.swap();
  }

  stats(): RawGpuConstraintParticleBodyShapeStats {
    return this.lastStats;
  }

  destroy(): void {
    this.pass.destroy();
  }
}

function activeParticleCount(count: number | undefined, capacity: number): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return capacity;
  return Math.max(0, Math.min(capacity, Math.floor(count)));
}

function activeTextureRows(count: number, width: number, height: number): number {
  return Math.max(1, Math.min(height, Math.ceil(Math.max(1, count) / Math.max(1, width))));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
