import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import type { RawFramebuffer } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleSortedCellCandidateOptions {
  state: RawGpuConstraintParticleState;
  gridKeys: RawFramebuffer;
  cellRanges: RawFramebuffer;
  outputSlots: readonly RawFramebuffer[];
  particleCount?: number;
  gridColumns: number;
  gridRows: number;
  residentScanLimit: number;
  cellRangeTextureWidth: number;
  cellRangeTextureHeight: number;
  maxCellOccupancy?: number;
}

export interface RawGpuConstraintParticleSortedCellCandidateStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  slotCount: number;
  candidateSamples: number;
  broadphaseOwner: 'hybrid';
  broadphase: 'gpu-sorted-cell-ranges';
  spatiallyComplete: boolean;
  producesCandidateSlots: true;
  suitableForAuthoritativeCollision: boolean;
  coverage: 'bounded-world-cell-residents';
  limitation: 'requires-sorted-particle-state-and-cell-ranges';
  requiredReplacement: 'gpu-owned-sort-or-cell-scatter';
  collisionConsumableSlotCount: number;
  collisionBatchedConsumableSlotCount: number;
  collisionRequiresBatchedSolve: boolean;
  collisionRequiredBatches: number;
  collisionPassSlotLimit: 8;
  gridColumns: number;
  gridRows: number;
  residentScanLimit: number;
  maxCellOccupancy: number;
  cellRangeTexels: number;
}

const SORTED_CELL_CANDIDATE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const SORTED_CELL_CANDIDATE_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uPosition;
uniform sampler2D uGridKey;
uniform sampler2D uCellRange;
uniform ivec2 uStateSize;
uniform ivec2 uCellRangeSize;
uniform ivec2 uGridSize;
uniform int uParticleCount;
uniform int uSlotIndex;
uniform int uResidentScanLimit;

out vec4 outSlot;

ivec2 texelForIndex(int index, int width) {
  return ivec2(index % width, index / width);
}

vec4 fetchCellRange(int cellId) {
  if (cellId < 0 || cellId >= uGridSize.x * uGridSize.y) return vec4(0.0, 0.0, 0.0, 0.0);
  ivec2 texel = texelForIndex(cellId, uCellRangeSize.x);
  if (texel.y >= uCellRangeSize.y) return vec4(0.0, 0.0, 0.0, 0.0);
  return texelFetch(uCellRange, texel, 0);
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int selfIndex = texel.y * uStateSize.x + texel.x;
  if (selfIndex >= uParticleCount || uResidentScanLimit <= 0) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  vec4 selfKey = texelFetch(uGridKey, texel, 0);
  if (selfKey.w <= 0.0) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  int neighborCellSlot = uSlotIndex / uResidentScanLimit;
  int residentOffset = uSlotIndex - neighborCellSlot * uResidentScanLimit;
  if (neighborCellSlot < 0 || neighborCellSlot >= 9) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  int dx = neighborCellSlot - (neighborCellSlot / 3) * 3 - 1;
  int dy = neighborCellSlot / 3 - 1;
  int cellX = int(selfKey.x) + dx;
  int cellY = int(selfKey.y) + dy;
  if (cellX < 0 || cellY < 0 || cellX >= uGridSize.x || cellY >= uGridSize.y) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  int cellId = cellX + cellY * uGridSize.x;
  vec4 range = fetchCellRange(cellId);
  int startIndex = int(floor(range.x + 0.5));
  int endIndex = int(floor(range.y + 0.5));
  int count = max(0, min(endIndex - startIndex, int(floor(range.z + 0.5))));
  if (range.w <= 0.0 || residentOffset < 0 || residentOffset >= count) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  int otherIndex = startIndex + residentOffset;
  if (otherIndex < 0 || otherIndex >= uParticleCount || otherIndex == selfIndex) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  ivec2 otherTexel = texelForIndex(otherIndex, uStateSize.x);
  vec4 selfPosition = texelFetch(uPosition, texel, 0);
  vec4 otherPosition = texelFetch(uPosition, otherTexel, 0);
  float radiusSum = max(0.0, selfPosition.z) + max(0.0, otherPosition.z);
  outSlot = vec4(float(otherIndex), radiusSum, 1.0, 1.0);
}
`;

export class RawGpuConstraintParticleSortedCellCandidatePass {
  private readonly pass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleSortedCellCandidateStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    slotCount: 0,
    candidateSamples: 0,
    broadphaseOwner: 'hybrid',
    broadphase: 'gpu-sorted-cell-ranges',
    spatiallyComplete: false,
    producesCandidateSlots: true,
    suitableForAuthoritativeCollision: false,
    coverage: 'bounded-world-cell-residents',
    limitation: 'requires-sorted-particle-state-and-cell-ranges',
    requiredReplacement: 'gpu-owned-sort-or-cell-scatter',
    collisionConsumableSlotCount: 0,
    collisionBatchedConsumableSlotCount: 0,
    collisionRequiresBatchedSolve: false,
    collisionRequiredBatches: 0,
    collisionPassSlotLimit: 8,
    gridColumns: 0,
    gridRows: 0,
    residentScanLimit: 0,
    maxCellOccupancy: 0,
    cellRangeTexels: 0,
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: SORTED_CELL_CANDIDATE_VERTEX,
      fragment: SORTED_CELL_CANDIDATE_FRAGMENT,
    });
  }

  generate(options: RawGpuConstraintParticleSortedCellCandidateOptions): RawGpuConstraintParticleSortedCellCandidateStats {
    const state = options.state;
    const activeParticleCount = Math.max(0, Math.min(state.capacity, Math.floor(options.particleCount ?? state.capacity)));
    const activeRows = activeParticleCount > 0 ? Math.max(1, Math.min(state.height, Math.ceil(activeParticleCount / state.width))) : 0;
    const slotCount = Math.min(options.outputSlots.length, Math.max(0, Math.floor(options.residentScanLimit)) * 9);
    const gridColumns = Math.max(1, Math.floor(options.gridColumns));
    const gridRows = Math.max(1, Math.floor(options.gridRows));
    const residentScanLimit = Math.max(0, Math.floor(options.residentScanLimit));
    const maxCellOccupancy = Math.max(0, Math.floor(options.maxCellOccupancy ?? residentScanLimit));
    const spatiallyComplete = residentScanLimit > 0 && maxCellOccupancy > 0 && residentScanLimit >= maxCellOccupancy && slotCount >= residentScanLimit * 9;
    const collisionPassSlotLimit = 8;
    const collisionConsumableSlotCount = Math.min(slotCount, collisionPassSlotLimit);
    this.lastStats = {
      activeParticleCount,
      activeRows,
      fragmentTexels: state.width * activeRows * slotCount,
      slotCount,
      candidateSamples: slotCount,
      broadphaseOwner: 'hybrid',
      broadphase: 'gpu-sorted-cell-ranges',
      spatiallyComplete,
      producesCandidateSlots: true,
      suitableForAuthoritativeCollision: spatiallyComplete,
      coverage: 'bounded-world-cell-residents',
      limitation: 'requires-sorted-particle-state-and-cell-ranges',
      requiredReplacement: 'gpu-owned-sort-or-cell-scatter',
      collisionConsumableSlotCount,
      collisionBatchedConsumableSlotCount: slotCount,
      collisionRequiresBatchedSolve: slotCount > collisionPassSlotLimit,
      collisionRequiredBatches: slotCount > 0 ? Math.ceil(slotCount / collisionPassSlotLimit) : 0,
      collisionPassSlotLimit,
      gridColumns,
      gridRows,
      residentScanLimit,
      maxCellOccupancy,
      cellRangeTexels: Math.max(1, Math.floor(options.cellRangeTextureWidth)) * Math.max(1, Math.floor(options.cellRangeTextureHeight)),
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
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, options.cellRanges.texture.texture);
          gl.uniform1i(uniform('uCellRange'), 2);
          gl.uniform2i(uniform('uStateSize'), state.width, state.height);
          gl.uniform2i(uniform('uCellRangeSize'), Math.max(1, Math.floor(options.cellRangeTextureWidth)), Math.max(1, Math.floor(options.cellRangeTextureHeight)));
          gl.uniform2i(uniform('uGridSize'), gridColumns, gridRows);
          gl.uniform1i(uniform('uParticleCount'), activeParticleCount);
          gl.uniform1i(uniform('uSlotIndex'), slot);
          gl.uniform1i(uniform('uResidentScanLimit'), residentScanLimit);
        },
      });
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.activeTexture(this.gl.TEXTURE0);
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleSortedCellCandidateStats {
    return this.lastStats;
  }

  capabilities(): Pick<
    RawGpuConstraintParticleSortedCellCandidateStats,
    'broadphase' | 'broadphaseOwner' | 'coverage' | 'limitation' | 'producesCandidateSlots' | 'requiredReplacement'
  > {
    return {
      broadphase: 'gpu-sorted-cell-ranges',
      broadphaseOwner: 'hybrid',
      coverage: 'bounded-world-cell-residents',
      limitation: 'requires-sorted-particle-state-and-cell-ranges',
      producesCandidateSlots: true,
      requiredReplacement: 'gpu-owned-sort-or-cell-scatter',
    };
  }

  destroy(): void {
    this.pass.destroy();
  }
}
