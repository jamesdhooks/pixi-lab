import { linkRawWebGL2Program, type RawFramebuffer, type RawWebGL2ProgramSources } from './RawWebGL2ResourceContext.js';

export interface RawGpuFieldPassRenderOptions {
  target?: RawFramebuffer | null;
  width: number;
  height: number;
  preserveFramebuffer?: boolean;
  bind?: (gl: WebGL2RenderingContext, program: WebGLProgram, uniform: (name: string) => WebGLUniformLocation | null) => void;
}

const FULLSCREEN_QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

export class RawGpuFieldPass {
  readonly program: WebGLProgram;

  private readonly vao: WebGLVertexArrayObject;
  private readonly buffer: WebGLBuffer;
  private readonly uniformLocations = new Map<string, WebGLUniformLocation | null>();

  constructor(private readonly gl: WebGL2RenderingContext, sources: RawWebGL2ProgramSources) {
    const program = linkRawWebGL2Program(gl, sources);
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) {
      gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      if (buffer) gl.deleteBuffer(buffer);
      throw new Error('Unable to allocate raw GPU field pass geometry');
    }

    this.program = program;
    this.vao = vao;
    this.buffer = buffer;

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  render(options: RawGpuFieldPassRenderOptions): void {
    if (options.preserveFramebuffer !== true) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, options.target?.framebuffer ?? null);
    }
    this.gl.viewport(0, 0, options.width, options.height);
    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);
    options.bind?.(this.gl, this.program, (name) => this.uniform(name));
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gl.bindVertexArray(null);
  }

  uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniformLocations.has(name)) {
      this.uniformLocations.set(name, this.gl.getUniformLocation(this.program, name));
    }
    return this.uniformLocations.get(name) ?? null;
  }

  destroy(): void {
    this.uniformLocations.clear();
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}
