import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import type { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import type { RawFramebuffer, RawTexturePrecision, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleCellKeyOptions {
  state: RawGpuConstraintParticleState;
  particleCount?: number;
  worldMinX: number;
  worldMinY: number;
  worldMaxX: number;
  worldMaxY: number;
  cellSize: number;
}

export interface RawGpuConstraintParticleCellKeyStats {
  activeParticleCount: number;
  width: number;
  height: number;
  gridColumns: number;
  gridRows: number;
  cellSize: number;
  fragmentTexels: number;
  gpuOwnedCellKeys: boolean;
  outputChannels: 'cell-index-gridx-gridy';
  suitableForGpuSort: boolean;
}

const CELL_KEY_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const CELL_KEY_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uPosition;
uniform ivec2 uStateSize;
uniform int uParticleCount;
uniform vec2 uWorldMin;
uniform float uCellSize;
uniform ivec2 uGridSize;

out vec4 outKey;

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int index = texel.y * uStateSize.x + texel.x;
  if (index < 0 || index >= uParticleCount) {
    outKey = vec4(16777216.0, float(index), 0.0, 0.0);
    return;
  }

  vec4 position = texelFetch(uPosition, texel, 0);
  vec2 cell = clamp(floor((position.xy - uWorldMin) / max(uCellSize, 0.0001)), vec2(0.0), vec2(uGridSize - ivec2(1)));
  float cellId = cell.x + cell.y * float(uGridSize.x);
  outKey = vec4(cellId, float(index), cell.x, cell.y);
}
`;

export class RawGpuConstraintParticleCellKeyPass {
  private readonly pass: RawGpuFieldPass;
  private framebuffer?: RawFramebuffer;
  private lastStats: RawGpuConstraintParticleCellKeyStats = {
    activeParticleCount: 0,
    width: 0,
    height: 0,
    gridColumns: 0,
    gridRows: 0,
    cellSize: 0,
    fragmentTexels: 0,
    gpuOwnedCellKeys: false,
    outputChannels: 'cell-index-gridx-gridy',
    suitableForGpuSort: false,
  };

  constructor(private readonly resources: RawWebGL2ResourceContext, private readonly precision: RawTexturePrecision = 'float') {
    this.pass = new RawGpuFieldPass(resources.gl, {
      vertex: CELL_KEY_VERTEX,
      fragment: CELL_KEY_FRAGMENT,
    });
  }

  get output(): RawFramebuffer | undefined {
    return this.framebuffer;
  }

  compute(options: RawGpuConstraintParticleCellKeyOptions): RawGpuConstraintParticleCellKeyStats {
    const state = options.state;
    const activeParticleCount = Math.max(0, Math.min(state.capacity, Math.floor(options.particleCount ?? state.capacity)));
    const activeRows = activeParticleCount > 0 ? Math.max(1, Math.min(state.height, Math.ceil(activeParticleCount / state.width))) : 1;
    const worldWidth = Math.max(0.0001, options.worldMaxX - options.worldMinX);
    const worldHeight = Math.max(0.0001, options.worldMaxY - options.worldMinY);
    const cellSize = Math.max(0.0001, options.cellSize);
    const gridColumns = Math.max(1, Math.ceil(worldWidth / cellSize));
    const gridRows = Math.max(1, Math.ceil(worldHeight / cellSize));
    const target = this.ensureFramebuffer(state.width, activeRows);
    this.pass.render({
      target,
      width: state.width,
      height: activeRows,
      bind: (gl, _program, uniform) => {
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, state.positions.read.texture.texture);
        gl.uniform1i(uniform('uPosition'), 0);
        gl.uniform2i(uniform('uStateSize'), state.width, state.height);
        gl.uniform1i(uniform('uParticleCount'), activeParticleCount);
        gl.uniform2f(uniform('uWorldMin'), options.worldMinX, options.worldMinY);
        gl.uniform1f(uniform('uCellSize'), cellSize);
        gl.uniform2i(uniform('uGridSize'), gridColumns, gridRows);
      },
    });
    this.lastStats = {
      activeParticleCount,
      width: state.width,
      height: activeRows,
      gridColumns,
      gridRows,
      cellSize,
      fragmentTexels: state.width * activeRows,
      gpuOwnedCellKeys: activeParticleCount > 0,
      outputChannels: 'cell-index-gridx-gridy',
      suitableForGpuSort: activeParticleCount > 0,
    };
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleCellKeyStats {
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
