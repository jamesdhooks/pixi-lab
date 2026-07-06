import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { type RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import { type RawFramebuffer, type RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleGridKeyOptions {
  state: RawGpuConstraintParticleState;
  particleCount?: number;
  worldMinX: number;
  worldMinY: number;
  worldMaxX: number;
  worldMaxY: number;
  cellSize: number;
}

export interface RawGpuConstraintParticleGridKeyStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  gridColumns: number;
  gridRows: number;
  cellSize: number;
  broadphaseOwner: 'gpu';
  producesCandidateSlots: false;
}

const GRID_KEY_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const GRID_KEY_FRAGMENT = `#version 300 es
precision highp float;

uniform sampler2D uPosition;
uniform vec2 uStateSize;
uniform float uParticleCount;
uniform vec2 uWorldMin;
uniform vec2 uWorldMax;
uniform float uCellSize;
uniform vec2 uGridSize;

out vec4 outKey;

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  float index = float(texel.y) * uStateSize.x + float(texel.x);
  if (index >= uParticleCount) {
    outKey = vec4(0.0);
    return;
  }

  vec4 position = texelFetch(uPosition, texel, 0);
  vec2 normalized = (position.xy - uWorldMin) / max(vec2(uCellSize), vec2(0.0001));
  vec2 cell = clamp(floor(normalized), vec2(0.0), max(uGridSize - vec2(1.0), vec2(0.0)));
  float linearCell = cell.y * uGridSize.x + cell.x;
  outKey = vec4(cell, linearCell, 1.0);
}
`;

export class RawGpuConstraintParticleGridKeyPass {
  private readonly pass: RawGpuFieldPass;
  private readonly framebuffer: RawFramebuffer;
  private lastStats: RawGpuConstraintParticleGridKeyStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    gridColumns: 0,
    gridRows: 0,
    cellSize: 0,
    broadphaseOwner: 'gpu',
    producesCandidateSlots: false,
  };

  constructor(private readonly resources: RawWebGL2ResourceContext, state: RawGpuConstraintParticleState) {
    this.pass = new RawGpuFieldPass(resources.gl, {
      vertex: GRID_KEY_VERTEX,
      fragment: GRID_KEY_FRAGMENT,
    });
    this.framebuffer = resources.createFramebuffer(resources.createRenderTexture({
      width: state.width,
      height: state.height,
      precision: 'float',
    }));
  }

  get output(): RawFramebuffer {
    return this.framebuffer;
  }

  compute(options: RawGpuConstraintParticleGridKeyOptions): RawGpuConstraintParticleGridKeyStats {
    const gl = this.resources.gl;
    const state = options.state;
    const activeParticleCount = Math.max(0, Math.min(state.capacity, Math.floor(options.particleCount ?? state.capacity)));
    const activeRows = activeParticleCount > 0 ? Math.max(1, Math.min(state.height, Math.ceil(activeParticleCount / state.width))) : 0;
    const worldWidth = Math.max(0.0001, options.worldMaxX - options.worldMinX);
    const worldHeight = Math.max(0.0001, options.worldMaxY - options.worldMinY);
    const cellSize = Math.max(0.0001, options.cellSize);
    const gridColumns = Math.max(1, Math.ceil(worldWidth / cellSize));
    const gridRows = Math.max(1, Math.ceil(worldHeight / cellSize));

    this.lastStats = {
      activeParticleCount,
      activeRows,
      fragmentTexels: state.width * activeRows,
      gridColumns,
      gridRows,
      cellSize,
      broadphaseOwner: 'gpu',
      producesCandidateSlots: false,
    };

    if (activeParticleCount <= 0) return this.lastStats;

    this.pass.render({
      target: this.framebuffer,
      width: state.width,
      height: activeRows,
      bind: (bindGl, _program, uniform) => {
        bindGl.disable(bindGl.BLEND);
        bindGl.activeTexture(bindGl.TEXTURE0);
        bindGl.bindTexture(bindGl.TEXTURE_2D, state.positions.read.texture.texture);
        bindGl.uniform1i(uniform('uPosition'), 0);
        bindGl.uniform2f(uniform('uStateSize'), state.width, state.height);
        bindGl.uniform1f(uniform('uParticleCount'), activeParticleCount);
        bindGl.uniform2f(uniform('uWorldMin'), options.worldMinX, options.worldMinY);
        bindGl.uniform2f(uniform('uWorldMax'), options.worldMaxX, options.worldMaxY);
        bindGl.uniform1f(uniform('uCellSize'), cellSize);
        bindGl.uniform2f(uniform('uGridSize'), gridColumns, gridRows);
      },
    });
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleGridKeyStats {
    return this.lastStats;
  }

  destroy(): void {
    this.pass.destroy();
    this.resources.destroyFramebuffer(this.framebuffer);
  }
}
