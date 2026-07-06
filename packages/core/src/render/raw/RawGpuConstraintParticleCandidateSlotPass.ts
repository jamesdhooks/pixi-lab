import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { type RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import { type RawFramebuffer } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleCandidateSlotOptions {
  state: RawGpuConstraintParticleState;
  gridKeys: RawFramebuffer;
  outputSlots: readonly RawFramebuffer[];
  particleCount?: number;
}

export interface RawGpuConstraintParticleCandidateSlotStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  slotCount: number;
  candidateSamples: number;
  broadphaseOwner: 'gpu';
  broadphase: 'gpu-grid-key-window';
  spatiallyComplete: false;
  producesCandidateSlots: true;
  suitableForAuthoritativeCollision: false;
  coverage: 'texture-window';
  limitation: 'samples-adjacent-texture-neighbors-only';
  requiredReplacement: 'gpu-spatial-bin-scatter-or-sort';
}

const CANDIDATE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const CANDIDATE_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D uPosition;
uniform sampler2D uGridKey;
uniform ivec2 uStateSize;
uniform int uParticleCount;
uniform int uSlotIndex;

out vec4 outSlot;

int candidateOffset(int slot, int width) {
  if (slot == 0) return -1;
  if (slot == 1) return 1;
  if (slot == 2) return -width;
  if (slot == 3) return width;
  if (slot == 4) return -width - 1;
  if (slot == 5) return -width + 1;
  if (slot == 6) return width - 1;
  return width + 1;
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int selfIndex = texel.y * uStateSize.x + texel.x;
  if (selfIndex >= uParticleCount) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  vec4 selfKey = texelFetch(uGridKey, texel, 0);
  if (selfKey.w <= 0.0) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  int otherIndex = selfIndex + candidateOffset(uSlotIndex, uStateSize.x);
  if (otherIndex < 0 || otherIndex >= uParticleCount) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  ivec2 otherTexel = ivec2(otherIndex % uStateSize.x, otherIndex / uStateSize.x);
  vec4 otherKey = texelFetch(uGridKey, otherTexel, 0);
  if (otherKey.w <= 0.0 || abs(otherKey.x - selfKey.x) > 1.0 || abs(otherKey.y - selfKey.y) > 1.0) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  vec4 selfPosition = texelFetch(uPosition, texel, 0);
  vec4 otherPosition = texelFetch(uPosition, otherTexel, 0);
  float radiusSum = max(0.0, selfPosition.z) + max(0.0, otherPosition.z);
  outSlot = vec4(float(otherIndex), radiusSum, 1.0, 1.0);
}
`;

export class RawGpuConstraintParticleCandidateSlotPass {
  private readonly pass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleCandidateSlotStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    slotCount: 0,
    candidateSamples: 0,
    broadphaseOwner: 'gpu',
    broadphase: 'gpu-grid-key-window',
    spatiallyComplete: false,
    producesCandidateSlots: true,
    suitableForAuthoritativeCollision: false,
    coverage: 'texture-window',
    limitation: 'samples-adjacent-texture-neighbors-only',
    requiredReplacement: 'gpu-spatial-bin-scatter-or-sort',
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: CANDIDATE_VERTEX,
      fragment: CANDIDATE_FRAGMENT,
    });
  }

  generate(options: RawGpuConstraintParticleCandidateSlotOptions): RawGpuConstraintParticleCandidateSlotStats {
    const state = options.state;
    const activeParticleCount = Math.max(0, Math.min(state.capacity, Math.floor(options.particleCount ?? state.capacity)));
    const activeRows = activeParticleCount > 0 ? Math.max(1, Math.min(state.height, Math.ceil(activeParticleCount / state.width))) : 0;
    const slotCount = Math.min(8, options.outputSlots.length);
    this.lastStats = {
      activeParticleCount,
      activeRows,
      fragmentTexels: state.width * activeRows * slotCount,
      slotCount,
      candidateSamples: slotCount,
      broadphaseOwner: 'gpu',
      broadphase: 'gpu-grid-key-window',
      spatiallyComplete: false,
      producesCandidateSlots: true,
      suitableForAuthoritativeCollision: false,
      coverage: 'texture-window',
      limitation: 'samples-adjacent-texture-neighbors-only',
      requiredReplacement: 'gpu-spatial-bin-scatter-or-sort',
    };
    if (activeParticleCount <= 0 || slotCount <= 0) return this.lastStats;

    for (let slot = 0; slot < slotCount; slot += 1) {
      const target = options.outputSlots[slot];
      if (!target) continue;
      this.pass.render({
        target,
        width: state.width,
        height: activeRows,
        bind: (gl, _program, uniform) => {
          gl.disable(gl.BLEND);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, state.positions.read.texture.texture);
          gl.uniform1i(uniform('uPosition'), 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, options.gridKeys.texture.texture);
          gl.uniform1i(uniform('uGridKey'), 1);
          gl.uniform2i(uniform('uStateSize'), state.width, state.height);
          gl.uniform1i(uniform('uParticleCount'), activeParticleCount);
          gl.uniform1i(uniform('uSlotIndex'), slot);
        },
      });
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.activeTexture(this.gl.TEXTURE0);
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleCandidateSlotStats {
    return this.lastStats;
  }

  capabilities(): Pick<
    RawGpuConstraintParticleCandidateSlotStats,
    'broadphase' | 'broadphaseOwner' | 'coverage' | 'limitation' | 'producesCandidateSlots' | 'requiredReplacement' | 'spatiallyComplete' | 'suitableForAuthoritativeCollision'
  > {
    return {
      broadphase: 'gpu-grid-key-window',
      broadphaseOwner: 'gpu',
      coverage: 'texture-window',
      limitation: 'samples-adjacent-texture-neighbors-only',
      producesCandidateSlots: true,
      requiredReplacement: 'gpu-spatial-bin-scatter-or-sort',
      spatiallyComplete: false,
      suitableForAuthoritativeCollision: false,
    };
  }

  destroy(): void {
    this.pass.destroy();
  }
}
