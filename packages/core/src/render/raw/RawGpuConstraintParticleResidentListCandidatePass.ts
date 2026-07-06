import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import type { RawFramebuffer } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleResidentListCandidateOptions {
  state: RawGpuConstraintParticleState;
  gridKeys: RawFramebuffer;
  residentList: RawFramebuffer;
  outputSlots: readonly RawFramebuffer[];
  particleCount?: number;
  gridColumns: number;
  gridRows: number;
  residentLimit: number;
  residentListTextureWidth: number;
  residentListTextureHeight: number;
  maxCellOccupancy?: number;
}

export interface RawGpuConstraintParticleResidentListCandidateStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  slotCount: number;
  candidateSamples: number;
  broadphaseOwner: 'gpu';
  broadphase: 'gpu-resident-list';
  spatiallyComplete: boolean;
  producesCandidateSlots: true;
  suitableForAuthoritativeCollision: boolean;
  coverage: 'gpu-resident-list-world-cells';
  limitation: 'resident-list-limit-must-cover-max-cell-occupancy';
  requiredReplacement: 'none-when-resident-list-spatially-complete';
  collisionConsumableSlotCount: number;
  collisionBatchedConsumableSlotCount: number;
  collisionRequiresBatchedSolve: boolean;
  collisionRequiredBatches: number;
  collisionPassSlotLimit: 8;
  gridColumns: number;
  gridRows: number;
  residentLimit: number;
  maxCellOccupancy: number;
  residentListTexels: number;
  indexOrder: 'original-index';
}

const RESIDENT_LIST_CANDIDATE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const RESIDENT_LIST_CANDIDATE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D uPosition;
uniform sampler2D uGridKey;
uniform sampler2D uResidentList;
uniform ivec2 uStateSize;
uniform ivec2 uResidentListSize;
uniform ivec2 uGridSize;
uniform int uParticleCount;
uniform int uSlotIndex;
uniform int uResidentLimit;

out vec4 outSlot;

ivec2 texelForIndex(int index, int width) {
  return ivec2(index % width, index / width);
}

vec4 fetchResident(int cellId, int residentOffset) {
  if (cellId < 0 || cellId >= uGridSize.x * uGridSize.y || residentOffset < 0 || residentOffset >= uResidentLimit) {
    return vec4(-1.0, float(cellId), float(residentOffset), 0.0);
  }
  int linear = cellId * uResidentLimit + residentOffset;
  ivec2 texel = texelForIndex(linear, uResidentListSize.x);
  if (texel.y >= uResidentListSize.y) return vec4(-1.0, float(cellId), float(residentOffset), 0.0);
  return texelFetch(uResidentList, texel, 0);
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int selfIndex = texel.y * uStateSize.x + texel.x;
  if (selfIndex >= uParticleCount || uResidentLimit <= 0) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  vec4 selfKey = texelFetch(uGridKey, texel, 0);
  if (selfKey.x < 0.0 || selfKey.w < 0.0) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  int neighborCellSlot = uSlotIndex / uResidentLimit;
  int residentOffset = uSlotIndex - neighborCellSlot * uResidentLimit;
  if (neighborCellSlot < 0 || neighborCellSlot >= 9) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  int dx = neighborCellSlot - (neighborCellSlot / 3) * 3 - 1;
  int dy = neighborCellSlot / 3 - 1;
  int cellX = int(selfKey.z) + dx;
  int cellY = int(selfKey.w) + dy;
  if (cellX < 0 || cellY < 0 || cellX >= uGridSize.x || cellY >= uGridSize.y) {
    outSlot = vec4(-1.0, 0.0, 0.0, 0.0);
    return;
  }

  int cellId = cellX + cellY * uGridSize.x;
  vec4 resident = fetchResident(cellId, residentOffset);
  int otherIndex = int(floor(resident.x + 0.5));
  int residentCellId = int(floor(resident.y + 0.5));
  if (resident.w <= 0.0 || residentCellId != cellId || otherIndex < 0 || otherIndex >= uParticleCount || otherIndex == selfIndex) {
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

export class RawGpuConstraintParticleResidentListCandidatePass {
  private readonly pass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleResidentListCandidateStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    slotCount: 0,
    candidateSamples: 0,
    broadphaseOwner: 'gpu',
    broadphase: 'gpu-resident-list',
    spatiallyComplete: false,
    producesCandidateSlots: true,
    suitableForAuthoritativeCollision: false,
    coverage: 'gpu-resident-list-world-cells',
    limitation: 'resident-list-limit-must-cover-max-cell-occupancy',
    requiredReplacement: 'none-when-resident-list-spatially-complete',
    collisionConsumableSlotCount: 0,
    collisionBatchedConsumableSlotCount: 0,
    collisionRequiresBatchedSolve: false,
    collisionRequiredBatches: 0,
    collisionPassSlotLimit: 8,
    gridColumns: 0,
    gridRows: 0,
    residentLimit: 0,
    maxCellOccupancy: 0,
    residentListTexels: 0,
    indexOrder: 'original-index',
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: RESIDENT_LIST_CANDIDATE_VERTEX,
      fragment: RESIDENT_LIST_CANDIDATE_FRAGMENT,
    });
  }

  generate(options: RawGpuConstraintParticleResidentListCandidateOptions): RawGpuConstraintParticleResidentListCandidateStats {
    const state = options.state;
    const activeParticleCount = Math.max(0, Math.min(state.capacity, Math.floor(options.particleCount ?? state.capacity)));
    const activeRows = activeParticleCount > 0 ? Math.max(1, Math.min(state.height, Math.ceil(activeParticleCount / state.width))) : 0;
    const residentLimit = Math.max(0, Math.floor(options.residentLimit));
    const slotCount = Math.min(options.outputSlots.length, residentLimit * 9);
    const gridColumns = Math.max(1, Math.floor(options.gridColumns));
    const gridRows = Math.max(1, Math.floor(options.gridRows));
    const maxCellOccupancy = Math.max(0, Math.floor(options.maxCellOccupancy ?? residentLimit));
    const spatiallyComplete = residentLimit > 0 && maxCellOccupancy > 0 && residentLimit >= maxCellOccupancy && slotCount >= residentLimit * 9;
    const collisionPassSlotLimit = 8;
    const collisionConsumableSlotCount = Math.min(slotCount, collisionPassSlotLimit);
    this.lastStats = {
      activeParticleCount,
      activeRows,
      fragmentTexels: state.width * activeRows * slotCount,
      slotCount,
      candidateSamples: slotCount,
      broadphaseOwner: 'gpu',
      broadphase: 'gpu-resident-list',
      spatiallyComplete,
      producesCandidateSlots: true,
      suitableForAuthoritativeCollision: spatiallyComplete,
      coverage: 'gpu-resident-list-world-cells',
      limitation: 'resident-list-limit-must-cover-max-cell-occupancy',
      requiredReplacement: 'none-when-resident-list-spatially-complete',
      collisionConsumableSlotCount,
      collisionBatchedConsumableSlotCount: slotCount,
      collisionRequiresBatchedSolve: slotCount > collisionPassSlotLimit,
      collisionRequiredBatches: slotCount > 0 ? Math.ceil(slotCount / collisionPassSlotLimit) : 0,
      collisionPassSlotLimit,
      gridColumns,
      gridRows,
      residentLimit,
      maxCellOccupancy,
      residentListTexels: Math.max(1, Math.floor(options.residentListTextureWidth)) * Math.max(1, Math.floor(options.residentListTextureHeight)),
      indexOrder: 'original-index',
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
          gl.bindTexture(gl.TEXTURE_2D, options.residentList.texture.texture);
          gl.uniform1i(uniform('uResidentList'), 2);
          gl.uniform2i(uniform('uStateSize'), state.width, state.height);
          gl.uniform2i(uniform('uResidentListSize'), Math.max(1, Math.floor(options.residentListTextureWidth)), Math.max(1, Math.floor(options.residentListTextureHeight)));
          gl.uniform2i(uniform('uGridSize'), gridColumns, gridRows);
          gl.uniform1i(uniform('uParticleCount'), activeParticleCount);
          gl.uniform1i(uniform('uSlotIndex'), slot);
          gl.uniform1i(uniform('uResidentLimit'), residentLimit);
        },
      });
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.activeTexture(this.gl.TEXTURE0);
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleResidentListCandidateStats {
    return this.lastStats;
  }

  destroy(): void {
    this.pass.destroy();
  }
}
