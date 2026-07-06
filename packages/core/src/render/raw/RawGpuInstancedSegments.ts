import { linkRawWebGL2Program } from './RawWebGL2ResourceContext.js';

export interface RawGpuSegmentInstance {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  radius: number;
  intensity: number;
}

export interface RawGpuInstancedSegmentsRenderOptions {
  width: number;
  height: number;
  color: [number, number, number, number];
  segments: readonly RawGpuSegmentInstance[];
}

export interface RawGpuInstancedSegmentsPackedRenderOptions {
  width: number;
  height: number;
  color: [number, number, number, number];
  segmentData: Float32Array;
  styleData: Float32Array;
  count: number;
  uploadSegmentData?: boolean;
  uploadStyleData?: boolean;
  uploadSegmentStart?: number;
  uploadSegmentCount?: number;
  uploadStyleStart?: number;
  uploadStyleCount?: number;
}

export interface RawGpuInstancedSegmentsStats {
  segmentCapacity: number;
  segmentDataFloats: number;
  styleDataFloats: number;
  lastUploadFloats: number;
  lastDrawCount: number;
}

const VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aSegment;
layout(location = 2) in vec2 aStyle;
uniform vec2 uResolution;
out float vAlong;
out float vAcross;
out float vIntensity;
void main() {
  vec2 a = aSegment.xy;
  vec2 b = aSegment.zw;
  vec2 axis = b - a;
  float len = max(0.001, length(axis));
  vec2 tangent = axis / len;
  vec2 normal = vec2(-tangent.y, tangent.x);
  float radius = aStyle.x;
  vec2 center = mix(a, b, aCorner.x * 0.5 + 0.5);
  vec2 pos = center + normal * aCorner.y * radius;
  vec2 clip = pos / uResolution * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vAlong = aCorner.x;
  vAcross = aCorner.y;
  vIntensity = aStyle.y;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 uColor;
in float vAlong;
in float vAcross;
in float vIntensity;
out vec4 outColor;
void main() {
  float capsule = 1.0 - smoothstep(0.72, 1.0, abs(vAcross));
  float startFade = smoothstep(-1.0, -0.72, vAlong);
  float endFade = 1.0 - smoothstep(0.72, 1.0, vAlong);
  float capFade = startFade * endFade;
  float alpha = capsule * max(0.36, capFade) * uColor.a * clamp(vIntensity, 0.0, 1.5);
  outColor = vec4(uColor.rgb * (0.72 + vIntensity * 0.28), alpha);
}`;

const CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

export class RawGpuInstancedSegments {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly cornerBuffer: WebGLBuffer;
  private readonly segmentBuffer: WebGLBuffer;
  private readonly styleBuffer: WebGLBuffer;
  private segmentCapacity = 0;
  private segmentData = new Float32Array(0);
  private styleData = new Float32Array(0);
  private lastUploadFloats = 0;
  private lastDrawCount = 0;
  private readonly resolutionUniform: WebGLUniformLocation | null;
  private readonly colorUniform: WebGLUniformLocation | null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    const program = linkRawWebGL2Program(gl, { vertex: VERTEX, fragment: FRAGMENT });
    const vao = gl.createVertexArray();
    const cornerBuffer = gl.createBuffer();
    const segmentBuffer = gl.createBuffer();
    const styleBuffer = gl.createBuffer();
    if (!vao || !cornerBuffer || !segmentBuffer || !styleBuffer) {
      gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      if (cornerBuffer) gl.deleteBuffer(cornerBuffer);
      if (segmentBuffer) gl.deleteBuffer(segmentBuffer);
      if (styleBuffer) gl.deleteBuffer(styleBuffer);
      throw new Error('Unable to allocate raw GPU instanced segment buffers');
    }

    this.program = program;
    this.vao = vao;
    this.cornerBuffer = cornerBuffer;
    this.segmentBuffer = segmentBuffer;
    this.styleBuffer = styleBuffer;
    this.resolutionUniform = gl.getUniformLocation(program, 'uResolution');
    this.colorUniform = gl.getUniformLocation(program, 'uColor');

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.segmentBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.styleBuffer);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
  }

  render(options: RawGpuInstancedSegmentsRenderOptions): number {
    this.lastUploadFloats = 0;
    this.lastDrawCount = 0;
    if (options.segments.length === 0) return 0;
    this.ensureCapacity(options.segments.length);
    for (let i = 0; i < options.segments.length; i += 1) {
      const segment = options.segments[i];
      if (!segment) continue;
      this.segmentData[i * 4] = segment.ax;
      this.segmentData[i * 4 + 1] = segment.ay;
      this.segmentData[i * 4 + 2] = segment.bx;
      this.segmentData[i * 4 + 3] = segment.by;
      this.styleData[i * 2] = segment.radius;
      this.styleData[i * 2 + 1] = segment.intensity;
    }
    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.segmentBuffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.segmentData, 0, options.segments.length * 4);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.styleBuffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.styleData, 0, options.segments.length * 2);
    this.lastUploadFloats = options.segments.length * 6;
    this.gl.uniform2f(this.resolutionUniform, options.width, options.height);
    this.gl.uniform4f(this.colorUniform, options.color[0], options.color[1], options.color[2], options.color[3]);
    this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, 6, options.segments.length);
    this.gl.bindVertexArray(null);
    this.lastDrawCount = options.segments.length;
    return this.lastUploadFloats;
  }

  renderPacked(options: RawGpuInstancedSegmentsPackedRenderOptions): number {
    const count = Math.max(0, Math.min(options.count, options.segmentData.length >> 2, options.styleData.length >> 1));
    this.lastUploadFloats = 0;
    this.lastDrawCount = 0;
    if (count === 0) return 0;
    this.ensureCapacity(count);
    this.gl.useProgram(this.program);
    this.gl.bindVertexArray(this.vao);
    if (options.uploadSegmentData !== false) {
      const uploadStart = Math.max(0, Math.min(count, Math.floor(options.uploadSegmentStart ?? 0)));
      const uploadCount = Math.max(0, Math.min(count - uploadStart, Math.floor(options.uploadSegmentCount ?? count)));
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.segmentBuffer);
      if (uploadCount > 0) {
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, uploadStart * 4 * 4, options.segmentData, uploadStart * 4, uploadCount * 4);
        this.lastUploadFloats += uploadCount * 4;
      }
    }
    if (options.uploadStyleData !== false) {
      const uploadStart = Math.max(0, Math.min(count, Math.floor(options.uploadStyleStart ?? 0)));
      const uploadCount = Math.max(0, Math.min(count - uploadStart, Math.floor(options.uploadStyleCount ?? count)));
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.styleBuffer);
      if (uploadCount > 0) {
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, uploadStart * 2 * 4, options.styleData, uploadStart * 2, uploadCount * 2);
        this.lastUploadFloats += uploadCount * 2;
      }
    }
    this.gl.uniform2f(this.resolutionUniform, options.width, options.height);
    this.gl.uniform4f(this.colorUniform, options.color[0], options.color[1], options.color[2], options.color[3]);
    this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, 6, count);
    this.gl.bindVertexArray(null);
    this.lastDrawCount = count;
    return this.lastUploadFloats;
  }

  private ensureCapacity(count: number): void {
    if (count <= this.segmentCapacity) return;
    this.segmentCapacity = Math.max(count, this.segmentCapacity * 2, 256);
    this.segmentData = new Float32Array(this.segmentCapacity * 4);
    this.styleData = new Float32Array(this.segmentCapacity * 2);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.segmentBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.segmentData.byteLength, this.gl.DYNAMIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.styleBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.styleData.byteLength, this.gl.DYNAMIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  stats(): RawGpuInstancedSegmentsStats {
    return {
      segmentCapacity: this.segmentCapacity,
      segmentDataFloats: this.segmentData.length,
      styleDataFloats: this.styleData.length,
      lastUploadFloats: this.lastUploadFloats,
      lastDrawCount: this.lastDrawCount,
    };
  }

  destroy(): void {
    this.gl.deleteBuffer(this.cornerBuffer);
    this.gl.deleteBuffer(this.segmentBuffer);
    this.gl.deleteBuffer(this.styleBuffer);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}
