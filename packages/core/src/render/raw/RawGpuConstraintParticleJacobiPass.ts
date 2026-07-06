import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import type { RawFramebuffer } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleJacobiOptions {
  state: RawGpuConstraintParticleState;
  neighborSlots: readonly RawFramebuffer[];
  stiffnessScale?: number;
  damping?: number;
  particleCount?: number;
}

export interface RawGpuConstraintParticleJacobiStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  neighborSlotCount: number;
}

const MAX_NEIGHBOR_SLOTS = 4;

const JACOBI_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const JACOBI_FRAGMENT_SHADER = `#version 300 es
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
uniform ivec2 uStateSize;
uniform int uCapacity;
uniform int uNeighborSlotCount;
uniform float uStiffnessScale;
uniform float uDamping;

vec4 readNeighborSlot(int slot, ivec2 texel) {
  if (slot == 0) return texelFetch(uNeighbor0, texel, 0);
  if (slot == 1) return texelFetch(uNeighbor1, texel, 0);
  if (slot == 2) return texelFetch(uNeighbor2, texel, 0);
  return texelFetch(uNeighbor3, texel, 0);
}

vec4 readParticlePosition(float rawIndex) {
  int index = int(rawIndex + 0.5);
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  return texelFetch(uPosition, texel, 0);
}

float readParticleInverseMass(float rawIndex) {
  int index = int(rawIndex + 0.5);
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  vec4 velocity = texelFetch(uVelocity, texel, 0);
  vec4 particleAttr = texelFetch(uAttribute, texel, 0);
  return max(max(velocity.z, particleAttr.y), 0.0);
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
  if (inverseMass <= 0.0) {
    outPosition = position;
    outVelocity = velocity;
    return;
  }

  vec2 correction = vec2(0.0);
  float correctionWeight = 0.0;
  int slotLimit = min(uNeighborSlotCount, 4);
  for (int slot = 0; slot < 4; slot += 1) {
    if (slot >= slotLimit) continue;
    vec4 neighbor = readNeighborSlot(slot, texel);
    float neighborIndex = neighbor.x;
    float restLength = max(neighbor.y, 0.0);
    float stiffness = clamp(neighbor.z * uStiffnessScale, 0.0, 1.0);
    float enabled = neighbor.w;
    if (enabled <= 0.0 || neighborIndex < 0.0 || stiffness <= 0.0) continue;

    vec4 otherPosition = readParticlePosition(neighborIndex);
    float otherInverseMass = readParticleInverseMass(neighborIndex);
    float massSum = inverseMass + otherInverseMass;
    if (massSum <= 0.0) continue;

    vec2 delta = otherPosition.xy - position.xy;
    float distance2 = dot(delta, delta);
    if (distance2 <= 0.000001) continue;
    float distance = sqrt(distance2);
    float signedError = distance - restLength;
    vec2 direction = delta / distance;
    correction += direction * signedError * stiffness * (inverseMass / massSum);
    correctionWeight += 1.0;
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

export class RawGpuConstraintParticleJacobiPass {
  private readonly pass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleJacobiStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    neighborSlotCount: 0,
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: JACOBI_VERTEX_SHADER,
      fragment: JACOBI_FRAGMENT_SHADER,
    });
  }

  solve(options: RawGpuConstraintParticleJacobiOptions): void {
    const state = options.state;
    const neighborSlotCount = Math.min(MAX_NEIGHBOR_SLOTS, options.neighborSlots.length);
    const activeCount = activeParticleCount(options.particleCount, state.capacity);
    const activeRows = activeTextureRows(activeCount, state.width, state.height);
    this.lastStats = {
      activeParticleCount: activeCount,
      activeRows,
      fragmentTexels: neighborSlotCount <= 0 ? 0 : state.width * activeRows,
      neighborSlotCount,
    };
    if (neighborSlotCount <= 0) return;

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
        for (let slot = 0; slot < MAX_NEIGHBOR_SLOTS; slot += 1) {
          const neighbor = options.neighborSlots[slot] ?? options.neighborSlots[0];
          gl.activeTexture(gl.TEXTURE3 + slot);
          gl.bindTexture(gl.TEXTURE_2D, neighbor.texture.texture);
          gl.uniform1i(uniform(`uNeighbor${slot}`), 3 + slot);
        }
        gl.uniform2i(uniform('uStateSize'), state.width, state.height);
        gl.uniform1i(uniform('uCapacity'), activeCount);
        gl.uniform1i(uniform('uNeighborSlotCount'), neighborSlotCount);
        gl.uniform1f(uniform('uStiffnessScale'), clamp(finiteOr(options.stiffnessScale, 1), 0, 2));
        gl.uniform1f(uniform('uDamping'), finiteOr(options.damping, 0));
      },
    });
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.activeTexture(this.gl.TEXTURE0);
    state.unbindDynamicWriteFramebuffer();
    state.swap();
  }

  stats(): RawGpuConstraintParticleJacobiStats {
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
