import {
  type RawFramebuffer,
  type RawTexturePrecision,
  type RawWebGL2ResourceContext,
  linkRawWebGL2Program,
} from './RawWebGL2ResourceContext.js';
import { RawGpuFieldPass } from './RawGpuFieldPass.js';

export interface RawGpuInstancedSegmentFieldRenderOptions {
  width: number;
  height: number;
  fieldScale?: number;
  feedbackDecay?: number;
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

export interface RawGpuInstancedSegmentFieldImpulseOptions {
  x: number;
  y: number;
  radius: number;
  strength: number;
  worldWidth: number;
  worldHeight: number;
}

export interface RawGpuInstancedSegmentFieldStats {
  fieldWidth: number;
  fieldHeight: number;
  segmentCapacity: number;
  segmentDataFloats: number;
  styleDataFloats: number;
  lastUploadFloats: number;
  lastDrawCount: number;
  lastFragmentPixels: number;
  lastFeedbackFragmentPixels: number;
  lastImpulseFragmentPixels: number;
  fieldImpulseCount: number;
  gpuFieldResident: boolean;
  persistentFeedback: boolean;
  feedbackDecay: number;
  additiveBlend: boolean;
}

const FIELD_VERTEX = `#version 300 es
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
  float radius = max(0.5, aStyle.x) * 3.0;
  vec2 center = mix(a, b, aCorner.x * 0.5 + 0.5);
  vec2 pos = center + normal * aCorner.y * radius;
  vec2 clip = pos / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vAlong = aCorner.x;
  vAcross = aCorner.y;
  vIntensity = aStyle.y;
}
`;

const FIELD_FRAGMENT = `#version 300 es
precision highp float;
in float vAlong;
in float vAcross;
in float vIntensity;
out vec4 outField;
void main() {
  float tube = exp(-vAcross * vAcross * 2.8);
  float startFade = smoothstep(-1.0, -0.72, vAlong);
  float endFade = 1.0 - smoothstep(0.72, 1.0, vAlong);
  float capFade = max(0.25, startFade * endFade);
  float energy = tube * capFade * clamp(vIntensity, 0.0, 2.0);
  if (energy <= 0.001) discard;
  outField = vec4(energy, energy * energy, abs(vAcross) * energy, energy);
}
`;

const FEEDBACK_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FEEDBACK_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uPrevious;
uniform float uDecay;
in vec2 vUv;
out vec4 outField;

void main() {
  outField = texture(uPrevious, vUv) * clamp(uDecay, 0.0, 1.0);
}
`;

const IMPULSE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uPrevious;
uniform vec2 uCenter;
uniform vec2 uWorldSize;
uniform float uRadius;
uniform float uStrength;
in vec2 vUv;
out vec4 outField;

void main() {
  vec4 previous = texture(uPrevious, vUv);
  vec2 world = vUv * max(uWorldSize, vec2(1.0));
  float distanceToCenter = length(world - uCenter);
  float radius = max(0.001, uRadius);
  float falloff = exp(-pow(distanceToCenter / radius, 2.0) * 2.65);
  float delta = clamp(uStrength, -4.0, 4.0) * falloff;
  vec4 nextField = previous;
  nextField.r = max(0.0, previous.r + delta);
  nextField.g = max(0.0, previous.g + delta * abs(delta));
  nextField.b = max(0.0, previous.b + delta * 0.35);
  nextField.a = max(0.0, previous.a + delta);
  outField = nextField;
}
`;

const CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

export class RawGpuInstancedSegmentField {
  private readonly program: WebGLProgram;
  private readonly feedbackPass: RawGpuFieldPass;
  private readonly impulsePass: RawGpuFieldPass;
  private readonly vao: WebGLVertexArrayObject;
  private readonly cornerBuffer: WebGLBuffer;
  private readonly segmentBuffer: WebGLBuffer;
  private readonly styleBuffer: WebGLBuffer;
  private readonly resolutionUniform: WebGLUniformLocation | null;
  private target?: RawFramebuffer;
  private feedbackTarget?: RawFramebuffer;
  private fieldInitialized = false;
  private segmentCapacity = 0;
  private segmentData = new Float32Array(0);
  private styleData = new Float32Array(0);
  private lastUploadFloats = 0;
  private lastDrawCount = 0;
  private lastFragmentPixels = 0;
  private lastFeedbackFragmentPixels = 0;
  private lastImpulseFragmentPixels = 0;
  private fieldImpulseCount = 0;
  private lastFeedbackDecay = 0;

  constructor(private readonly resources: RawWebGL2ResourceContext, private readonly precision: RawTexturePrecision = 'half-float') {
    const gl = resources.gl;
    const program = linkRawWebGL2Program(gl, { vertex: FIELD_VERTEX, fragment: FIELD_FRAGMENT });
    const feedbackPass = new RawGpuFieldPass(gl, { vertex: FEEDBACK_VERTEX, fragment: FEEDBACK_FRAGMENT });
    const impulsePass = new RawGpuFieldPass(gl, { vertex: FEEDBACK_VERTEX, fragment: IMPULSE_FRAGMENT });
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
      throw new Error('Unable to allocate raw GPU segment field buffers');
    }

    this.program = program;
    this.feedbackPass = feedbackPass;
    this.impulsePass = impulsePass;
    this.vao = vao;
    this.cornerBuffer = cornerBuffer;
    this.segmentBuffer = segmentBuffer;
    this.styleBuffer = styleBuffer;
    this.resolutionUniform = gl.getUniformLocation(program, 'uResolution');

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

  get texture(): RawFramebuffer | undefined {
    return this.target;
  }

  applyImpulse(options: RawGpuInstancedSegmentFieldImpulseOptions): number {
    if (!this.target || !this.feedbackTarget || !this.fieldInitialized) {
      this.lastImpulseFragmentPixels = 0;
      return 0;
    }
    const readTarget = this.target;
    const writeTarget = this.feedbackTarget;
    const width = readTarget.texture.width;
    const height = readTarget.texture.height;
    this.impulsePass.render({
      target: writeTarget,
      width,
      height,
      bind: (gl, _program, uniform) => {
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, readTarget.texture.texture);
        gl.uniform1i(uniform('uPrevious'), 0);
        gl.uniform2f(uniform('uCenter'), options.x, options.y);
        gl.uniform2f(uniform('uWorldSize'), Math.max(1, options.worldWidth), Math.max(1, options.worldHeight));
        gl.uniform1f(uniform('uRadius'), Math.max(0.001, options.radius));
        gl.uniform1f(uniform('uStrength'), options.strength);
      },
    });
    this.target = writeTarget;
    this.feedbackTarget = readTarget;
    this.lastImpulseFragmentPixels = width * height;
    this.fieldImpulseCount += 1;
    return this.lastImpulseFragmentPixels;
  }

  renderPacked(options: RawGpuInstancedSegmentFieldRenderOptions): number {
    const gl = this.resources.gl;
    const count = Math.max(0, Math.min(options.count, options.segmentData.length >> 2, options.styleData.length >> 1));
    this.lastUploadFloats = 0;
    this.lastDrawCount = 0;
    const fieldScale = Math.max(0.05, Math.min(1, options.fieldScale ?? 0.35));
    const feedbackDecay = Math.max(0, Math.min(1, options.feedbackDecay ?? 0));
    this.lastFeedbackDecay = feedbackDecay;
    const fieldWidth = Math.max(1, Math.ceil(options.width * fieldScale));
    const fieldHeight = Math.max(1, Math.ceil(options.height * fieldScale));
    this.ensureTargets(fieldWidth, fieldHeight);
    if (!this.target) return 0;

    this.prepareFieldForInjection(fieldWidth, fieldHeight, feedbackDecay);
    this.lastFragmentPixels = fieldWidth * fieldHeight;
    if (count <= 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return 0;
    }

    this.ensureCapacity(count);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    if (options.uploadSegmentData !== false) {
      const uploadStart = Math.max(0, Math.min(count, Math.floor(options.uploadSegmentStart ?? 0)));
      const uploadCount = Math.max(0, Math.min(count - uploadStart, Math.floor(options.uploadSegmentCount ?? count)));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.segmentBuffer);
      if (uploadCount > 0) {
        gl.bufferSubData(gl.ARRAY_BUFFER, uploadStart * 4 * 4, options.segmentData, uploadStart * 4, uploadCount * 4);
        this.lastUploadFloats += uploadCount * 4;
      }
    }
    if (options.uploadStyleData !== false) {
      const uploadStart = Math.max(0, Math.min(count, Math.floor(options.uploadStyleStart ?? 0)));
      const uploadCount = Math.max(0, Math.min(count - uploadStart, Math.floor(options.uploadStyleCount ?? count)));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.styleBuffer);
      if (uploadCount > 0) {
        gl.bufferSubData(gl.ARRAY_BUFFER, uploadStart * 2 * 4, options.styleData, uploadStart * 2, uploadCount * 2);
        this.lastUploadFloats += uploadCount * 2;
      }
    }
    gl.uniform2f(this.resolutionUniform, options.width, options.height);
    if (this.resources.capabilities.floatBlend) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
    } else {
      gl.disable(gl.BLEND);
    }
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.lastDrawCount = count;
    return this.lastUploadFloats;
  }

  stats(): RawGpuInstancedSegmentFieldStats {
    return {
      fieldWidth: this.target?.texture.width ?? 0,
      fieldHeight: this.target?.texture.height ?? 0,
      segmentCapacity: this.segmentCapacity,
      segmentDataFloats: this.segmentData.length,
      styleDataFloats: this.styleData.length,
      lastUploadFloats: this.lastUploadFloats,
      lastDrawCount: this.lastDrawCount,
      lastFragmentPixels: this.lastFragmentPixels,
      lastFeedbackFragmentPixels: this.lastFeedbackFragmentPixels,
      lastImpulseFragmentPixels: this.lastImpulseFragmentPixels,
      fieldImpulseCount: this.fieldImpulseCount,
      gpuFieldResident: this.target != null,
      persistentFeedback: this.lastFeedbackDecay > 0,
      feedbackDecay: this.lastFeedbackDecay,
      additiveBlend: this.resources.capabilities.floatBlend,
    };
  }

  destroy(): void {
    const gl = this.resources.gl;
    if (this.target) this.resources.destroyFramebuffer(this.target);
    if (this.feedbackTarget) this.resources.destroyFramebuffer(this.feedbackTarget);
    gl.deleteBuffer(this.cornerBuffer);
    gl.deleteBuffer(this.segmentBuffer);
    gl.deleteBuffer(this.styleBuffer);
    gl.deleteVertexArray(this.vao);
    this.feedbackPass.destroy();
    this.impulsePass.destroy();
    gl.deleteProgram(this.program);
  }

  private ensureTargets(width: number, height: number): void {
    if (
      this.target &&
      this.feedbackTarget &&
      this.target.texture.width === width &&
      this.target.texture.height === height &&
      this.feedbackTarget.texture.width === width &&
      this.feedbackTarget.texture.height === height
    ) return;
    if (this.target) this.resources.destroyFramebuffer(this.target);
    if (this.feedbackTarget) this.resources.destroyFramebuffer(this.feedbackTarget);
    this.target = this.resources.createFramebuffer(this.resources.createRenderTexture({
      width,
      height,
      precision: this.precision,
      filter: 'linear',
    }));
    this.feedbackTarget = this.resources.createFramebuffer(this.resources.createRenderTexture({
      width,
      height,
      precision: this.precision,
      filter: 'linear',
    }));
    this.fieldInitialized = false;
  }

  private prepareFieldForInjection(width: number, height: number, feedbackDecay: number): void {
    const gl = this.resources.gl;
    this.lastFeedbackFragmentPixels = 0;
    if (!this.target) return;
    if (feedbackDecay > 0 && this.fieldInitialized && this.feedbackTarget) {
      const readTarget = this.target;
      const writeTarget = this.feedbackTarget;
      this.feedbackPass.render({
        target: writeTarget,
        width,
        height,
        bind: (bindGl, _program, uniform) => {
          bindGl.disable(bindGl.BLEND);
          bindGl.activeTexture(bindGl.TEXTURE0);
          bindGl.bindTexture(bindGl.TEXTURE_2D, readTarget.texture.texture);
          bindGl.uniform1i(uniform('uPrevious'), 0);
          bindGl.uniform1f(uniform('uDecay'), feedbackDecay);
        },
      });
      this.target = writeTarget;
      this.feedbackTarget = readTarget;
      this.lastFeedbackFragmentPixels = width * height;
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.target.framebuffer);
    gl.viewport(0, 0, width, height);
    this.fieldInitialized = true;
  }

  private ensureCapacity(count: number): void {
    if (count <= this.segmentCapacity) return;
    const gl = this.resources.gl;
    this.segmentCapacity = Math.max(count, this.segmentCapacity * 2, 256);
    this.segmentData = new Float32Array(this.segmentCapacity * 4);
    this.styleData = new Float32Array(this.segmentCapacity * 2);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.segmentBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.segmentData.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.styleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.styleData.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
}
