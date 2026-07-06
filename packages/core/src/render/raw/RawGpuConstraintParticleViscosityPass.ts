import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import type { RawFramebuffer } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleViscosityOptions {
  state: RawGpuConstraintParticleState;
  neighborSlots?: readonly RawFramebuffer[];
  neighborSlotOffset?: number;
  particleCount?: number;
  radiusScale?: number;
  strength?: number;
  damping?: number;
  spatiallyComplete?: boolean;
  slotOverflowCount?: number;
}

export interface RawGpuConstraintParticleViscosityStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  neighborSlotCount: number;
  providedNeighborSlotCount: number;
  neighborSlotOffset: number;
  ignoredNeighborSlotCount: number;
  remainingNeighborSlotCount: number;
  requiresBatchedNeighborSlots: boolean;
  spatiallyComplete: boolean;
  slotOverflowCount: number;
}

const VISCOSITY_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const VISCOSITY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uAttribute;
uniform sampler2D uNeighbor0;
uniform sampler2D uNeighbor1;
uniform sampler2D uNeighbor2;
uniform sampler2D uNeighbor3;
uniform sampler2D uNeighbor4;
uniform sampler2D uNeighbor5;
uniform sampler2D uNeighbor6;
uniform sampler2D uNeighbor7;
uniform ivec2 uStateSize;
uniform int uCapacity;
uniform int uNeighborSlotCount;
uniform float uRadiusScale;
uniform float uStrength;
uniform float uDamping;

vec4 readNeighborSlot(int slot, ivec2 texel) {
  if (slot == 0) return texelFetch(uNeighbor0, texel, 0);
  if (slot == 1) return texelFetch(uNeighbor1, texel, 0);
  if (slot == 2) return texelFetch(uNeighbor2, texel, 0);
  if (slot == 3) return texelFetch(uNeighbor3, texel, 0);
  if (slot == 4) return texelFetch(uNeighbor4, texel, 0);
  if (slot == 5) return texelFetch(uNeighbor5, texel, 0);
  if (slot == 6) return texelFetch(uNeighbor6, texel, 0);
  return texelFetch(uNeighbor7, texel, 0);
}

vec4 readPosition(int index) {
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  return texelFetch(uPosition, texel, 0);
}

vec4 readVelocity(int index) {
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  return texelFetch(uVelocity, texel, 0);
}

vec4 readAttribute(int index) {
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  return texelFetch(uAttribute, texel, 0);
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int index = texel.y * uStateSize.x + texel.x;
  vec4 position = texelFetch(uPosition, texel, 0);
  vec4 velocity = texelFetch(uVelocity, texel, 0);
  vec4 particleAttr = texelFetch(uAttribute, texel, 0);

  if (index >= uCapacity || uNeighborSlotCount <= 0) {
    outPosition = position;
    outVelocity = velocity;
    return;
  }

  float radius = max(max(position.z, particleAttr.x) * uRadiusScale, 0.0);
  float inverseMass = max(max(velocity.z, particleAttr.y), 0.0);
  if (radius <= 0.0 || inverseMass <= 0.0) {
    outPosition = position;
    outVelocity = velocity;
    return;
  }

  vec2 velocityDelta = vec2(0.0);
  float weight = 0.0;
  int slotLimit = min(uNeighborSlotCount, 8);
  for (int slot = 0; slot < 8; slot += 1) {
    if (slot >= slotLimit) continue;
    vec4 neighbor = readNeighborSlot(slot, texel);
    if (neighbor.w <= 0.0 || neighbor.x < 0.0) continue;
    int otherIndex = int(neighbor.x + 0.5);
    if (otherIndex < 0 || otherIndex >= uCapacity || otherIndex == index) continue;
    vec4 otherPosition = readPosition(otherIndex);
    vec4 otherVelocity = readVelocity(otherIndex);
    vec4 otherAttribute = readAttribute(otherIndex);
    float otherRadius = max(max(otherPosition.z, otherAttribute.x) * uRadiusScale, 0.0);
    float otherInverseMass = max(max(otherVelocity.z, otherAttribute.y), 0.0);
    if (otherRadius <= 0.0 || otherInverseMass <= 0.0) continue;
    float reach = max(radius + otherRadius, 0.0001);
    vec2 delta = otherPosition.xy - position.xy;
    float distance = length(delta);
    if (distance >= reach) continue;
    float falloff = 1.0 - distance / reach;
    velocityDelta += (otherVelocity.xy - velocity.xy) * falloff;
    weight += falloff;
  }

  vec2 nextVelocity = velocity.xy;
  if (weight > 0.0) {
    nextVelocity += velocityDelta / max(weight, 0.0001) * clamp(uStrength, 0.0, 1.0);
    nextVelocity *= clamp(uDamping, 0.0, 1.0);
  }

  outPosition = position;
  outVelocity = vec4(nextVelocity, velocity.zw);
}`;

export class RawGpuConstraintParticleViscosityPass {
  private readonly pass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleViscosityStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    neighborSlotCount: 0,
    providedNeighborSlotCount: 0,
    neighborSlotOffset: 0,
    ignoredNeighborSlotCount: 0,
    remainingNeighborSlotCount: 0,
    requiresBatchedNeighborSlots: false,
    spatiallyComplete: false,
    slotOverflowCount: 0,
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: VISCOSITY_VERTEX_SHADER,
      fragment: VISCOSITY_FRAGMENT_SHADER,
    });
  }

  solve(options: RawGpuConstraintParticleViscosityOptions): void {
    const state = options.state;
    const activeCount = activeParticleCount(options.particleCount, state.capacity);
    const activeRows = activeTextureRows(activeCount, state.width, state.height);
    const neighborSlotOffset = Math.max(0, Math.floor(options.neighborSlotOffset ?? 0));
    const providedNeighborSlotCount = options.neighborSlots?.length ?? 0;
    const remainingNeighborSlotCount = Math.max(0, providedNeighborSlotCount - neighborSlotOffset);
    const neighborSlotCount = Math.min(8, remainingNeighborSlotCount);
    this.lastStats = {
      activeParticleCount: activeCount,
      activeRows,
      fragmentTexels: state.width * activeRows,
      neighborSlotCount,
      providedNeighborSlotCount,
      neighborSlotOffset,
      ignoredNeighborSlotCount: Math.max(0, remainingNeighborSlotCount - neighborSlotCount),
      remainingNeighborSlotCount,
      requiresBatchedNeighborSlots: remainingNeighborSlotCount > neighborSlotCount,
      spatiallyComplete: options.spatiallyComplete === true,
      slotOverflowCount: Math.max(0, Math.floor(options.slotOverflowCount ?? 0)),
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
        for (let slot = 0; slot < 8; slot += 1) {
          gl.activeTexture(gl.TEXTURE3 + slot);
          const framebuffer = options.neighborSlots?.[neighborSlotOffset + slot];
          gl.bindTexture(gl.TEXTURE_2D, framebuffer?.texture.texture ?? null);
          gl.uniform1i(uniform(`uNeighbor${slot}`), 3 + slot);
        }
        gl.uniform2i(uniform('uStateSize'), state.width, state.height);
        gl.uniform1i(uniform('uCapacity'), activeCount);
        gl.uniform1i(uniform('uNeighborSlotCount'), neighborSlotCount);
        gl.uniform1f(uniform('uRadiusScale'), Math.max(0, finiteOr(options.radiusScale, 1)));
        gl.uniform1f(uniform('uStrength'), clamp(finiteOr(options.strength, 0.12), 0, 1));
        gl.uniform1f(uniform('uDamping'), clamp(finiteOr(options.damping, 0.995), 0, 1));
      },
    });
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    state.unbindDynamicWriteFramebuffer();
    state.swap();
  }

  stats(): RawGpuConstraintParticleViscosityStats {
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
