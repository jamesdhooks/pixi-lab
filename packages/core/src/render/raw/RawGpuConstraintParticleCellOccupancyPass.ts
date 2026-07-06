import {
  type RawFramebuffer,
  type RawTexturePrecision,
  type RawWebGL2ResourceContext,
  linkRawWebGL2Program,
} from './RawWebGL2ResourceContext.js';
import type { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';

export interface RawGpuConstraintParticleCellOccupancyOptions {
  state: RawGpuConstraintParticleState;
  particleCount?: number;
  worldMinX: number;
  worldMinY: number;
  worldMaxX: number;
  worldMaxY: number;
  cellSize: number;
}

export interface RawGpuConstraintParticleCellOccupancyStats {
  activeParticleCount: number;
  gridColumns: number;
  gridRows: number;
  cellSize: number;
  fragmentCells: number;
  pointDraws: number;
  additiveBlend: boolean;
  gpuOwnedOccupancy: boolean;
  producesCellRanges: false;
  suitableForAuthoritativeBroadphase: false;
  requiredReplacement: 'gpu-prefix-sum-or-sort-scatter';
}

const OCCUPANCY_VERTEX = `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) in float aPoint;

uniform sampler2D uPosition;
uniform ivec2 uStateSize;
uniform int uParticleCount;
uniform vec2 uWorldMin;
uniform float uCellSize;
uniform ivec2 uGridSize;

void main() {
  float point = aPoint;
  int index = gl_InstanceID;
  if (index >= uParticleCount) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  vec4 position = texelFetch(uPosition, texel, 0);
  vec2 cell = clamp(floor((position.xy - uWorldMin) / max(uCellSize, 0.0001)), vec2(0.0), vec2(uGridSize - ivec2(1)));
  vec2 uv = (cell + vec2(0.5)) / max(vec2(uGridSize), vec2(1.0));
  vec2 clip = uv * 2.0 - 1.0;
  gl_Position = vec4(clip + vec2(point * 0.0), 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;

const OCCUPANCY_FRAGMENT = `#version 300 es
precision highp float;

out vec4 outOccupancy;

void main() {
  outOccupancy = vec4(1.0, 1.0, 0.0, 1.0);
}
`;

const POINT_VERTEX = new Float32Array([0]);

export class RawGpuConstraintParticleCellOccupancyPass {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly pointBuffer: WebGLBuffer;
  private readonly positionUniform: WebGLUniformLocation | null;
  private readonly stateSizeUniform: WebGLUniformLocation | null;
  private readonly particleCountUniform: WebGLUniformLocation | null;
  private readonly worldMinUniform: WebGLUniformLocation | null;
  private readonly cellSizeUniform: WebGLUniformLocation | null;
  private readonly gridSizeUniform: WebGLUniformLocation | null;
  private framebuffer?: RawFramebuffer;
  private lastStats: RawGpuConstraintParticleCellOccupancyStats = {
    activeParticleCount: 0,
    gridColumns: 0,
    gridRows: 0,
    cellSize: 0,
    fragmentCells: 0,
    pointDraws: 0,
    additiveBlend: false,
    gpuOwnedOccupancy: false,
    producesCellRanges: false,
    suitableForAuthoritativeBroadphase: false,
    requiredReplacement: 'gpu-prefix-sum-or-sort-scatter',
  };

  constructor(private readonly resources: RawWebGL2ResourceContext, private readonly precision: RawTexturePrecision = 'float') {
    const gl = resources.gl;
    this.program = linkRawWebGL2Program(gl, {
      vertex: OCCUPANCY_VERTEX,
      fragment: OCCUPANCY_FRAGMENT,
    });
    const vao = gl.createVertexArray();
    const pointBuffer = gl.createBuffer();
    if (!vao || !pointBuffer) {
      if (vao) gl.deleteVertexArray(vao);
      if (pointBuffer) gl.deleteBuffer(pointBuffer);
      gl.deleteProgram(this.program);
      throw new Error('Unable to allocate raw GPU cell-occupancy buffers');
    }
    this.vao = vao;
    this.pointBuffer = pointBuffer;
    this.positionUniform = gl.getUniformLocation(this.program, 'uPosition');
    this.stateSizeUniform = gl.getUniformLocation(this.program, 'uStateSize');
    this.particleCountUniform = gl.getUniformLocation(this.program, 'uParticleCount');
    this.worldMinUniform = gl.getUniformLocation(this.program, 'uWorldMin');
    this.cellSizeUniform = gl.getUniformLocation(this.program, 'uCellSize');
    this.gridSizeUniform = gl.getUniformLocation(this.program, 'uGridSize');

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, POINT_VERTEX, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  get output(): RawFramebuffer | undefined {
    return this.framebuffer;
  }

  compute(options: RawGpuConstraintParticleCellOccupancyOptions): RawGpuConstraintParticleCellOccupancyStats {
    const state = options.state;
    const activeParticleCount = Math.max(0, Math.min(state.capacity, Math.floor(options.particleCount ?? state.capacity)));
    const worldWidth = Math.max(0.0001, options.worldMaxX - options.worldMinX);
    const worldHeight = Math.max(0.0001, options.worldMaxY - options.worldMinY);
    const cellSize = Math.max(0.0001, options.cellSize);
    const gridColumns = Math.max(1, Math.ceil(worldWidth / cellSize));
    const gridRows = Math.max(1, Math.ceil(worldHeight / cellSize));
    const additiveBlend = this.resources.capabilities.floatBlend;
    this.lastStats = {
      activeParticleCount,
      gridColumns,
      gridRows,
      cellSize,
      fragmentCells: gridColumns * gridRows,
      pointDraws: activeParticleCount,
      additiveBlend,
      gpuOwnedOccupancy: additiveBlend && activeParticleCount > 0,
      producesCellRanges: false,
      suitableForAuthoritativeBroadphase: false,
      requiredReplacement: 'gpu-prefix-sum-or-sort-scatter',
    };
    const framebuffer = this.ensureFramebuffer(gridColumns, gridRows);
    const gl = this.resources.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);
    gl.viewport(0, 0, gridColumns, gridRows);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (activeParticleCount <= 0 || !additiveBlend) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return this.lastStats;
    }
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.positions.read.texture.texture);
    gl.uniform1i(this.positionUniform, 0);
    gl.uniform2i(this.stateSizeUniform, state.width, state.height);
    gl.uniform1i(this.particleCountUniform, activeParticleCount);
    gl.uniform2f(this.worldMinUniform, options.worldMinX, options.worldMinY);
    gl.uniform1f(this.cellSizeUniform, cellSize);
    gl.uniform2i(this.gridSizeUniform, gridColumns, gridRows);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArraysInstanced(gl.POINTS, 0, 1, activeParticleCount);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleCellOccupancyStats {
    return this.lastStats;
  }

  destroy(): void {
    const gl = this.resources.gl;
    if (this.framebuffer) this.resources.destroyFramebuffer(this.framebuffer);
    gl.deleteBuffer(this.pointBuffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
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
