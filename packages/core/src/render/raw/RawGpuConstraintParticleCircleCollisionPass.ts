import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import type { RawFramebuffer } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleCircleCollisionOptions {
  state: RawGpuConstraintParticleState;
  neighborSlots?: readonly RawFramebuffer[];
  neighborSlotOffset?: number;
  particleCount?: number;
  radiusScale?: number;
  stiffness?: number;
  damping?: number;
  iterations?: number;
  neighborhood?: 'cross' | 'moore3x3';
  neighborSlotSource?: 'cpu-spatial-neighbor-slots' | 'gpu-grid-key-window' | 'gpu-sorted-cell-ranges' | 'gpu-resident-list';
  spatiallyComplete?: boolean;
  slotOverflowCount?: number;
}

export interface RawGpuConstraintParticleCircleCollisionStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  solverKind: 'local-texture-neighborhood' | 'spatial-neighbor-slots';
  neighborSamples: number;
  neighborSlotCount: number;
  providedNeighborSlotCount: number;
  neighborSlotOffset: number;
  ignoredNeighborSlotCount: number;
  remainingNeighborSlotCount: number;
  requiresBatchedNeighborSlots: boolean;
  iterations: number;
  spatiallyComplete: boolean;
  broadphase: 'texture-adjacency' | 'cpu-spatial-neighbor-slots' | 'gpu-grid-key-window' | 'gpu-sorted-cell-ranges' | 'gpu-resident-list';
  broadphaseOwner: 'texture-layout' | 'cpu' | 'gpu' | 'hybrid';
  slotOverflowCount: number;
}

export interface RawGpuConstraintParticleCircleCollisionCapabilities {
  spatiallyComplete: boolean;
  broadphase: 'texture-adjacency' | 'cpu-spatial-neighbor-slots' | 'gpu-grid-key-window' | 'gpu-sorted-cell-ranges' | 'gpu-resident-list';
  broadphaseOwner: 'texture-layout' | 'cpu' | 'gpu' | 'hybrid';
  suitableForAuthoritativeCollision: boolean;
  maxNeighborSamples: number;
  maxNeighborSlots: number;
  supportsIterations: boolean;
}

const COLLISION_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const COLLISION_FRAGMENT_SHADER = `#version 300 es
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
uniform float uRadiusScale;
uniform float uStiffness;
uniform float uDamping;
uniform int uNeighborhood;
uniform int uNeighborSlotCount;

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

void accumulateNeighbor(
  int selfIndex,
  int otherIndex,
  vec2 selfPosition,
  float selfRadius,
  float selfInverseMass,
  inout vec2 correction,
  inout float correctionWeight
) {
  if (otherIndex < 0 || otherIndex >= uCapacity || otherIndex == selfIndex) return;
  vec4 otherPosition = readPosition(otherIndex);
  vec4 otherVelocity = readVelocity(otherIndex);
  vec4 otherAttribute = readAttribute(otherIndex);
  float otherRadius = max(max(otherPosition.z, otherAttribute.x) * uRadiusScale, 0.0);
  float otherInverseMass = max(max(otherVelocity.z, otherAttribute.y), 0.0);
  float massSum = selfInverseMass + otherInverseMass;
  if (otherRadius <= 0.0 || massSum <= 0.0) return;

  vec2 delta = selfPosition - otherPosition.xy;
  float distance2 = dot(delta, delta);
  float minDistance = selfRadius + otherRadius;
  if (distance2 >= minDistance * minDistance) return;
  float distance = sqrt(max(distance2, 0.000001));
  vec2 normal = delta / distance;
  float penetration = minDistance - distance;
  correction += normal * penetration * clamp(uStiffness, 0.0, 1.0) * (selfInverseMass / massSum);
  correctionWeight += 1.0;
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

  float radius = max(max(position.z, particleAttr.x) * uRadiusScale, 0.0);
  float inverseMass = max(max(velocity.z, particleAttr.y), 0.0);
  if (radius <= 0.0 || inverseMass <= 0.0) {
    outPosition = position;
    outVelocity = velocity;
    return;
  }

  vec2 correction = vec2(0.0);
  float correctionWeight = 0.0;
  if (uNeighborSlotCount > 0) {
    int slotLimit = min(uNeighborSlotCount, 8);
    for (int slot = 0; slot < 8; slot += 1) {
      if (slot >= slotLimit) continue;
      vec4 neighbor = readNeighborSlot(slot, texel);
      if (neighbor.w <= 0.0 || neighbor.x < 0.0) continue;
      accumulateNeighbor(index, int(neighbor.x + 0.5), position.xy, radius, inverseMass, correction, correctionWeight);
    }
  } else {
    accumulateNeighbor(index, index - 1, position.xy, radius, inverseMass, correction, correctionWeight);
    accumulateNeighbor(index, index + 1, position.xy, radius, inverseMass, correction, correctionWeight);
    accumulateNeighbor(index, index - uStateSize.x, position.xy, radius, inverseMass, correction, correctionWeight);
    accumulateNeighbor(index, index + uStateSize.x, position.xy, radius, inverseMass, correction, correctionWeight);
    if (uNeighborhood > 0) {
      accumulateNeighbor(index, index - uStateSize.x - 1, position.xy, radius, inverseMass, correction, correctionWeight);
      accumulateNeighbor(index, index - uStateSize.x + 1, position.xy, radius, inverseMass, correction, correctionWeight);
      accumulateNeighbor(index, index + uStateSize.x - 1, position.xy, radius, inverseMass, correction, correctionWeight);
      accumulateNeighbor(index, index + uStateSize.x + 1, position.xy, radius, inverseMass, correction, correctionWeight);
    }
  }

  vec2 nextPosition = position.xy;
  vec2 nextVelocity = velocity.xy;
  if (correctionWeight > 0.0) {
    vec2 applied = correction / correctionWeight;
    nextPosition += applied;
    nextVelocity += applied * uDamping;
  }

  outPosition = vec4(nextPosition, position.zw);
  outVelocity = vec4(nextVelocity, velocity.zw);
}`;

export class RawGpuConstraintParticleCircleCollisionPass {
  private readonly pass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleCircleCollisionStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    solverKind: 'local-texture-neighborhood',
    neighborSamples: 4,
    neighborSlotCount: 0,
    providedNeighborSlotCount: 0,
    neighborSlotOffset: 0,
    ignoredNeighborSlotCount: 0,
    remainingNeighborSlotCount: 0,
    requiresBatchedNeighborSlots: false,
    iterations: 0,
    spatiallyComplete: false,
    broadphase: 'texture-adjacency',
    broadphaseOwner: 'texture-layout',
    slotOverflowCount: 0,
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: COLLISION_VERTEX_SHADER,
      fragment: COLLISION_FRAGMENT_SHADER,
    });
  }

  solve(options: RawGpuConstraintParticleCircleCollisionOptions): void {
    const state = options.state;
    const activeCount = activeParticleCount(options.particleCount, state.capacity);
    const activeRows = activeTextureRows(activeCount, state.width, state.height);
    const iterations = activeCount > 0 ? Math.max(1, Math.min(16, Math.floor(finiteOr(options.iterations, 1)))) : 0;
    const providedNeighborSlotCount = options.neighborSlots?.length ?? 0;
    const neighborSlotOffset = Math.max(0, Math.min(providedNeighborSlotCount, Math.floor(finiteOr(options.neighborSlotOffset, 0))));
    const remainingNeighborSlotCount = Math.max(0, providedNeighborSlotCount - neighborSlotOffset);
    const neighborSlotCount = Math.min(8, remainingNeighborSlotCount);
    const neighborSlotSource = options.neighborSlotSource ?? 'cpu-spatial-neighbor-slots';
    const neighborSamples = neighborSlotCount > 0 ? neighborSlotCount : options.neighborhood === 'moore3x3' ? 8 : 4;
    this.lastStats = {
      activeParticleCount: activeCount,
      activeRows,
      fragmentTexels: state.width * activeRows * iterations,
      solverKind: neighborSlotCount > 0 ? 'spatial-neighbor-slots' : 'local-texture-neighborhood',
      neighborSamples,
      neighborSlotCount,
      providedNeighborSlotCount,
      neighborSlotOffset,
      ignoredNeighborSlotCount: Math.max(0, remainingNeighborSlotCount - neighborSlotCount),
      remainingNeighborSlotCount,
      requiresBatchedNeighborSlots: remainingNeighborSlotCount > neighborSlotCount,
      iterations,
      spatiallyComplete: neighborSlotCount > 0 && options.spatiallyComplete === true,
      broadphase: neighborSlotCount > 0 ? neighborSlotSource : 'texture-adjacency',
      broadphaseOwner: neighborSlotCount > 0 ? broadphaseOwnerForNeighborSlotSource(neighborSlotSource) : 'texture-layout',
      slotOverflowCount: Math.max(0, Math.floor(finiteOr(options.slotOverflowCount, 0))),
    };
    if (activeCount <= 0 || iterations <= 0) return;

    for (let iteration = 0; iteration < iterations; iteration += 1) {
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
            const neighbor = options.neighborSlots?.[neighborSlotOffset + slot] ?? options.neighborSlots?.[neighborSlotOffset] ?? options.neighborSlots?.[0];
            if (!neighbor) continue;
            gl.activeTexture(gl.TEXTURE3 + slot);
            gl.bindTexture(gl.TEXTURE_2D, neighbor.texture.texture);
            gl.uniform1i(uniform(`uNeighbor${slot}`), 3 + slot);
          }
          gl.uniform2i(uniform('uStateSize'), state.width, state.height);
          gl.uniform1i(uniform('uCapacity'), activeCount);
          gl.uniform1f(uniform('uRadiusScale'), Math.max(0, finiteOr(options.radiusScale, 1)));
          gl.uniform1f(uniform('uStiffness'), clamp(finiteOr(options.stiffness, 0.72), 0, 1));
          gl.uniform1f(uniform('uDamping'), finiteOr(options.damping, 0));
          gl.uniform1i(uniform('uNeighborhood'), options.neighborhood === 'moore3x3' ? 1 : 0);
          gl.uniform1i(uniform('uNeighborSlotCount'), neighborSlotCount);
        },
      });
      state.unbindDynamicWriteFramebuffer();
      state.swap();
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.activeTexture(this.gl.TEXTURE0);
  }

  stats(): RawGpuConstraintParticleCircleCollisionStats {
    return this.lastStats;
  }

  capabilities(): RawGpuConstraintParticleCircleCollisionCapabilities {
    return {
      spatiallyComplete: false,
      broadphase: 'texture-adjacency',
      broadphaseOwner: 'texture-layout',
      suitableForAuthoritativeCollision: false,
      maxNeighborSamples: 8,
      maxNeighborSlots: 8,
      supportsIterations: true,
    };
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

function broadphaseOwnerForNeighborSlotSource(source: 'cpu-spatial-neighbor-slots' | 'gpu-grid-key-window' | 'gpu-sorted-cell-ranges' | 'gpu-resident-list'): 'cpu' | 'gpu' | 'hybrid' {
  if (source === 'cpu-spatial-neighbor-slots') return 'cpu';
  if (source === 'gpu-sorted-cell-ranges') return 'hybrid';
  return 'gpu';
}
