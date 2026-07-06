import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import type { RawFramebuffer, RawTexturePrecision, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleResidentListFromSortedKeysOptions {
  sortedKeys: RawFramebuffer;
  sortedKeyWidth: number;
  sortedKeyHeight: number;
  elementCount: number;
  gridColumns: number;
  gridRows: number;
  residentLimit: number;
  maxCellOccupancy?: number;
}

export interface RawGpuConstraintParticleResidentListFromSortedKeysStats {
  elementCount: number;
  gridColumns: number;
  gridRows: number;
  cellCount: number;
  residentLimit: number;
  maxCellOccupancy: number;
  width: number;
  height: number;
  fragmentTexels: number;
  binarySearchSteps: number;
  gpuDerivedResidentLists: boolean;
  source: 'gpu-sorted-key-index-texture';
  outputChannels: 'original-index-cell-id-resident-slot-active';
  producesResidentLists: true;
  residentListsSpatiallyComplete: boolean;
  suitableForCandidateGeneration: boolean;
  suitableForAuthoritativeUnsortedBroadphase: boolean;
  requiredNextStep: 'resident-list-candidate-generation';
}

const RESIDENT_LIST_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const RESIDENT_LIST_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uSortedKeys;
uniform ivec2 uSortedKeySize;
uniform int uElementCount;
uniform int uSearchSteps;
uniform int uCellCount;
uniform int uResidentLimit;
uniform int uOutputWidth;

out vec4 outResident;

const float INVALID_KEY = 16777216.0;

ivec2 texelForIndex(int index, int width) {
  return ivec2(index % width, index / width);
}

vec4 sortedValueAt(int index) {
  if (index < 0 || index >= uElementCount) return vec4(INVALID_KEY, -1.0, 0.0, 0.0);
  ivec2 texel = texelForIndex(index, uSortedKeySize.x);
  if (texel.y >= uSortedKeySize.y) return vec4(INVALID_KEY, -1.0, 0.0, 0.0);
  return texelFetch(uSortedKeys, texel, 0);
}

float keyAt(int index) {
  return sortedValueAt(index).x;
}

int lowerBound(float target) {
  int lo = 0;
  int hi = uElementCount;
  for (int step = 0; step < 32; step += 1) {
    if (step >= uSearchSteps) break;
    int mid = (lo + hi) / 2;
    if (keyAt(mid) < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int linear = texel.y * uOutputWidth + texel.x;
  if (linear < 0 || uCellCount <= 0 || uResidentLimit <= 0 || linear >= uCellCount * uResidentLimit) {
    outResident = vec4(-1.0, -1.0, -1.0, 0.0);
    return;
  }

  int cellId = linear / uResidentLimit;
  int residentSlot = linear - cellId * uResidentLimit;
  int sortedIndex = lowerBound(float(cellId)) + residentSlot;
  vec4 value = sortedValueAt(sortedIndex);
  float key = floor(value.x + 0.5);
  if (sortedIndex < 0 || sortedIndex >= uElementCount || key != float(cellId)) {
    outResident = vec4(-1.0, float(cellId), float(residentSlot), 0.0);
    return;
  }

  outResident = vec4(value.y, float(cellId), float(residentSlot), 1.0);
}
`;

export class RawGpuConstraintParticleResidentListFromSortedKeysPass {
  private readonly pass: RawGpuFieldPass;
  private framebuffer?: RawFramebuffer;
  private lastStats: RawGpuConstraintParticleResidentListFromSortedKeysStats = {
    elementCount: 0,
    gridColumns: 0,
    gridRows: 0,
    cellCount: 0,
    residentLimit: 0,
    maxCellOccupancy: 0,
    width: 0,
    height: 0,
    fragmentTexels: 0,
    binarySearchSteps: 0,
    gpuDerivedResidentLists: false,
    source: 'gpu-sorted-key-index-texture',
    outputChannels: 'original-index-cell-id-resident-slot-active',
    producesResidentLists: true,
    residentListsSpatiallyComplete: false,
    suitableForCandidateGeneration: false,
    suitableForAuthoritativeUnsortedBroadphase: false,
    requiredNextStep: 'resident-list-candidate-generation',
  };

  constructor(private readonly resources: RawWebGL2ResourceContext, private readonly precision: RawTexturePrecision = 'float') {
    this.pass = new RawGpuFieldPass(resources.gl, {
      vertex: RESIDENT_LIST_VERTEX,
      fragment: RESIDENT_LIST_FRAGMENT,
    });
  }

  get output(): RawFramebuffer | undefined {
    return this.framebuffer;
  }

  compute(options: RawGpuConstraintParticleResidentListFromSortedKeysOptions): RawGpuConstraintParticleResidentListFromSortedKeysStats {
    const elementCount = Math.max(0, Math.floor(options.elementCount));
    const gridColumns = Math.max(1, Math.floor(options.gridColumns));
    const gridRows = Math.max(1, Math.floor(options.gridRows));
    const cellCount = gridColumns * gridRows;
    const maxTextureSize = Math.max(1, this.resources.capabilities.maxTextureSize || 4096);
    const maxResidentLimitForTexture = Math.max(0, Math.floor((maxTextureSize * maxTextureSize) / Math.max(1, cellCount)));
    const residentLimit = Math.min(Math.max(0, Math.floor(options.residentLimit)), maxResidentLimitForTexture);
    const maxCellOccupancy = Math.max(0, Math.floor(options.maxCellOccupancy ?? residentLimit));
    const outputTexels = Math.max(1, cellCount * Math.max(1, residentLimit));
    const width = Math.max(1, Math.min(maxTextureSize, Math.ceil(Math.sqrt(outputTexels))));
    const height = Math.max(1, Math.ceil(outputTexels / width));
    const searchSteps = elementCount > 0 ? Math.min(32, Math.ceil(Math.log2(Math.max(1, elementCount))) + 1) : 0;
    const residentListsSpatiallyComplete = residentLimit > 0 && maxCellOccupancy > 0 && residentLimit >= maxCellOccupancy;
    const target = this.ensureFramebuffer(width, height);
    this.pass.render({
      target,
      width,
      height,
      bind: (gl, _program, uniform) => {
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, options.sortedKeys.texture.texture);
        gl.uniform1i(uniform('uSortedKeys'), 0);
        gl.uniform2i(uniform('uSortedKeySize'), Math.max(1, Math.floor(options.sortedKeyWidth)), Math.max(1, Math.floor(options.sortedKeyHeight)));
        gl.uniform1i(uniform('uElementCount'), elementCount);
        gl.uniform1i(uniform('uSearchSteps'), searchSteps);
        gl.uniform1i(uniform('uCellCount'), cellCount);
        gl.uniform1i(uniform('uResidentLimit'), residentLimit);
        gl.uniform1i(uniform('uOutputWidth'), width);
      },
    });
    this.lastStats = {
      elementCount,
      gridColumns,
      gridRows,
      cellCount,
      residentLimit,
      maxCellOccupancy,
      width,
      height,
      fragmentTexels: width * height,
      binarySearchSteps: searchSteps,
      gpuDerivedResidentLists: elementCount > 0 && residentLimit > 0,
      source: 'gpu-sorted-key-index-texture',
      outputChannels: 'original-index-cell-id-resident-slot-active',
      producesResidentLists: true,
      residentListsSpatiallyComplete,
      suitableForCandidateGeneration: elementCount > 0 && residentLimit > 0,
      suitableForAuthoritativeUnsortedBroadphase: elementCount > 0 && residentListsSpatiallyComplete,
      requiredNextStep: 'resident-list-candidate-generation',
    };
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleResidentListFromSortedKeysStats {
    return this.lastStats;
  }

  destroy(): void {
    this.pass.destroy();
    if (this.framebuffer) this.resources.destroyFramebuffer(this.framebuffer);
  }

  private ensureFramebuffer(width: number, height: number): RawFramebuffer {
    if (this.framebuffer && this.framebuffer.texture.width === width && this.framebuffer.texture.height === height) {
      return this.framebuffer;
    }
    if (this.framebuffer) this.resources.destroyFramebuffer(this.framebuffer);
    this.framebuffer = this.resources.createFramebuffer(this.resources.createRenderTexture({
      width,
      height,
      precision: this.precision,
      filter: 'nearest',
    }));
    return this.framebuffer;
  }
}
