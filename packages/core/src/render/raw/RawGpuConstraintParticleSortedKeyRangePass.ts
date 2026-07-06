import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import type { RawFramebuffer, RawTexturePrecision, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleSortedKeyRangeOptions {
  sortedKeys: RawFramebuffer;
  sortedKeyWidth: number;
  sortedKeyHeight: number;
  elementCount: number;
  gridColumns: number;
  gridRows: number;
}

export interface RawGpuConstraintParticleSortedKeyRangeStats {
  elementCount: number;
  gridColumns: number;
  gridRows: number;
  cellCount: number;
  sortedKeyTexels: number;
  fragmentTexels: number;
  binarySearchSteps: number;
  gpuDerivedCellRanges: boolean;
  producesCellRanges: true;
  producesResidentLists: false;
  source: 'gpu-sorted-key-index-texture';
  suitableForSortedCandidateBridge: boolean;
  suitableForAuthoritativeUnsortedBroadphase: false;
  requiredNextStep: 'sorted-state-gather-or-scatter';
}

const SORTED_KEY_RANGE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const SORTED_KEY_RANGE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uSortedKeys;
uniform ivec2 uSortedKeySize;
uniform ivec2 uGridSize;
uniform int uElementCount;
uniform int uSearchSteps;

out vec4 outRange;

ivec2 texelForIndex(int index) {
  return ivec2(index % uSortedKeySize.x, index / uSortedKeySize.x);
}

float keyAt(int index) {
  if (index < 0 || index >= uElementCount) return 16777216.0;
  return texelFetch(uSortedKeys, texelForIndex(index), 0).x;
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

int upperBound(float target) {
  int lo = 0;
  int hi = uElementCount;
  for (int step = 0; step < 32; step += 1) {
    if (step >= uSearchSteps) break;
    int mid = (lo + hi) / 2;
    if (keyAt(mid) <= target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  if (texel.x < 0 || texel.y < 0 || texel.x >= uGridSize.x || texel.y >= uGridSize.y || uElementCount <= 0) {
    outRange = vec4(0.0);
    return;
  }

  float cellId = float(texel.x + texel.y * uGridSize.x);
  int startIndex = lowerBound(cellId);
  int endIndex = upperBound(cellId);
  int count = max(0, endIndex - startIndex);
  outRange = vec4(float(startIndex), float(endIndex), float(count), count > 0 ? 1.0 : 0.0);
}
`;

export class RawGpuConstraintParticleSortedKeyRangePass {
  private readonly pass: RawGpuFieldPass;
  private framebuffer?: RawFramebuffer;
  private lastStats: RawGpuConstraintParticleSortedKeyRangeStats = {
    elementCount: 0,
    gridColumns: 0,
    gridRows: 0,
    cellCount: 0,
    sortedKeyTexels: 0,
    fragmentTexels: 0,
    binarySearchSteps: 0,
    gpuDerivedCellRanges: false,
    producesCellRanges: true,
    producesResidentLists: false,
    source: 'gpu-sorted-key-index-texture',
    suitableForSortedCandidateBridge: false,
    suitableForAuthoritativeUnsortedBroadphase: false,
    requiredNextStep: 'sorted-state-gather-or-scatter',
  };

  constructor(private readonly resources: RawWebGL2ResourceContext, private readonly precision: RawTexturePrecision = 'float') {
    this.pass = new RawGpuFieldPass(resources.gl, {
      vertex: SORTED_KEY_RANGE_VERTEX,
      fragment: SORTED_KEY_RANGE_FRAGMENT,
    });
  }

  get output(): RawFramebuffer | undefined {
    return this.framebuffer;
  }

  compute(options: RawGpuConstraintParticleSortedKeyRangeOptions): RawGpuConstraintParticleSortedKeyRangeStats {
    const elementCount = Math.max(0, Math.floor(options.elementCount));
    const gridColumns = Math.max(1, Math.floor(options.gridColumns));
    const gridRows = Math.max(1, Math.floor(options.gridRows));
    const sortedKeyWidth = Math.max(1, Math.floor(options.sortedKeyWidth));
    const sortedKeyHeight = Math.max(1, Math.floor(options.sortedKeyHeight));
    const searchSteps = elementCount > 0 ? Math.min(32, Math.ceil(Math.log2(Math.max(1, elementCount))) + 1) : 0;
    const target = this.ensureFramebuffer(gridColumns, gridRows);
    this.pass.render({
      target,
      width: gridColumns,
      height: gridRows,
      bind: (gl, _program, uniform) => {
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, options.sortedKeys.texture.texture);
        gl.uniform1i(uniform('uSortedKeys'), 0);
        gl.uniform2i(uniform('uSortedKeySize'), sortedKeyWidth, sortedKeyHeight);
        gl.uniform2i(uniform('uGridSize'), gridColumns, gridRows);
        gl.uniform1i(uniform('uElementCount'), elementCount);
        gl.uniform1i(uniform('uSearchSteps'), searchSteps);
      },
    });
    this.lastStats = {
      elementCount,
      gridColumns,
      gridRows,
      cellCount: gridColumns * gridRows,
      sortedKeyTexels: sortedKeyWidth * sortedKeyHeight,
      fragmentTexels: gridColumns * gridRows,
      binarySearchSteps: searchSteps,
      gpuDerivedCellRanges: elementCount > 0,
      producesCellRanges: true,
      producesResidentLists: false,
      source: 'gpu-sorted-key-index-texture',
      suitableForSortedCandidateBridge: elementCount > 0,
      suitableForAuthoritativeUnsortedBroadphase: false,
      requiredNextStep: 'sorted-state-gather-or-scatter',
    };
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleSortedKeyRangeStats {
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
