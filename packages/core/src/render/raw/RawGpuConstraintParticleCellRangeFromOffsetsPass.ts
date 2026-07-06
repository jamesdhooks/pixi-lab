import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import type { RawFramebuffer, RawTexturePrecision, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleCellRangeFromOffsetsOptions {
  occupancy: RawFramebuffer;
  inclusiveOffsets: RawFramebuffer;
  gridColumns: number;
  gridRows: number;
}

export interface RawGpuConstraintParticleCellRangeFromOffsetsStats {
  gridColumns: number;
  gridRows: number;
  cellCount: number;
  fragmentTexels: number;
  uploadFloats: 0;
  gpuOwnedCellRanges: boolean;
  producesCellRanges: true;
  producesResidentLists: false;
  sortedStateRequired: true;
  suitableForSortedCandidateBridge: boolean;
  suitableForAuthoritativeUnsortedBroadphase: false;
  requiredNextStep: 'particle-cell-scatter';
}

const CELL_RANGE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const CELL_RANGE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uOccupancy;
uniform sampler2D uInclusiveOffsets;
uniform ivec2 uGridSize;

out vec4 outRange;

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  if (texel.x < 0 || texel.y < 0 || texel.x >= uGridSize.x || texel.y >= uGridSize.y) {
    outRange = vec4(0.0);
    return;
  }

  float count = max(0.0, floor(texelFetch(uOccupancy, texel, 0).x + 0.5));
  float endIndex = max(0.0, floor(texelFetch(uInclusiveOffsets, texel, 0).x + 0.5));
  float startIndex = max(0.0, endIndex - count);
  float activeValue = count > 0.0 ? 1.0 : 0.0;
  outRange = vec4(startIndex, endIndex, count, activeValue);
}
`;

export class RawGpuConstraintParticleCellRangeFromOffsetsPass {
  private readonly pass: RawGpuFieldPass;
  private framebuffer?: RawFramebuffer;
  private lastStats: RawGpuConstraintParticleCellRangeFromOffsetsStats = {
    gridColumns: 0,
    gridRows: 0,
    cellCount: 0,
    fragmentTexels: 0,
    uploadFloats: 0,
    gpuOwnedCellRanges: false,
    producesCellRanges: true,
    producesResidentLists: false,
    sortedStateRequired: true,
    suitableForSortedCandidateBridge: false,
    suitableForAuthoritativeUnsortedBroadphase: false,
    requiredNextStep: 'particle-cell-scatter',
  };

  constructor(private readonly resources: RawWebGL2ResourceContext, private readonly precision: RawTexturePrecision = 'float') {
    this.pass = new RawGpuFieldPass(resources.gl, {
      vertex: CELL_RANGE_VERTEX,
      fragment: CELL_RANGE_FRAGMENT,
    });
  }

  get output(): RawFramebuffer | undefined {
    return this.framebuffer;
  }

  compute(options: RawGpuConstraintParticleCellRangeFromOffsetsOptions): RawGpuConstraintParticleCellRangeFromOffsetsStats {
    const gridColumns = Math.max(1, Math.floor(options.gridColumns));
    const gridRows = Math.max(1, Math.floor(options.gridRows));
    const cellCount = gridColumns * gridRows;
    const target = this.ensureFramebuffer(gridColumns, gridRows);
    this.pass.render({
      target,
      width: gridColumns,
      height: gridRows,
      bind: (gl, _program, uniform) => {
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, options.occupancy.texture.texture);
        gl.uniform1i(uniform('uOccupancy'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, options.inclusiveOffsets.texture.texture);
        gl.uniform1i(uniform('uInclusiveOffsets'), 1);
        gl.uniform2i(uniform('uGridSize'), gridColumns, gridRows);
      },
    });
    this.lastStats = {
      gridColumns,
      gridRows,
      cellCount,
      fragmentTexels: cellCount,
      uploadFloats: 0,
      gpuOwnedCellRanges: true,
      producesCellRanges: true,
      producesResidentLists: false,
      sortedStateRequired: true,
      suitableForSortedCandidateBridge: true,
      suitableForAuthoritativeUnsortedBroadphase: false,
      requiredNextStep: 'particle-cell-scatter',
    };
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleCellRangeFromOffsetsStats {
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
