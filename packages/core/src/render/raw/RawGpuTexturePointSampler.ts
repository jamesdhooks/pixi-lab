import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { type RawFramebuffer, type RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuTexturePointSamplerOptions {
  maxSamples: number;
}

export interface RawGpuTexturePointSamplerSampleOptions {
  source: RawFramebuffer;
  sourceWidth: number;
  sourceHeight: number;
  points: Float32Array;
  pointCount: number;
  worldWidth: number;
  worldHeight: number;
}

export interface RawGpuTexturePointSamplerStats {
  maxSamples: number;
  lastSampleCount: number;
  lastFragmentPixels: number;
  lastUploadFloats: number;
  lastReadbackFloats: number;
}

const SAMPLE_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const SAMPLE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform sampler2D uPoints;
uniform float uPointCount;
uniform vec2 uWorldSize;
out vec4 outSample;

void main() {
  int index = int(floor(gl_FragCoord.x));
  if (float(index) >= uPointCount) {
    outSample = vec4(0.0);
    return;
  }
  vec2 point = texelFetch(uPoints, ivec2(index, 0), 0).xy;
  vec2 uv = clamp(point / max(uWorldSize, vec2(1.0)), vec2(0.0), vec2(1.0));
  outSample = texture(uSource, uv);
}
`;

export class RawGpuTexturePointSampler {
  private readonly pass: RawGpuFieldPass;
  private readonly pointTexture: WebGLTexture;
  private readonly framebuffer: RawFramebuffer;
  private readonly maxSamples: number;
  private pointScratch = new Float32Array(0);
  private readScratch = new Float32Array(0);
  private lastStats: RawGpuTexturePointSamplerStats;

  constructor(private readonly resources: RawWebGL2ResourceContext, options: RawGpuTexturePointSamplerOptions) {
    const gl = resources.gl;
    this.maxSamples = Math.max(1, Math.floor(options.maxSamples));
    this.pass = new RawGpuFieldPass(gl, {
      vertex: SAMPLE_VERTEX,
      fragment: SAMPLE_FRAGMENT,
    });
    const pointTexture = gl.createTexture();
    if (!pointTexture) {
      this.pass.destroy();
      throw new Error('Unable to allocate raw GPU point sampler texture');
    }
    this.pointTexture = pointTexture;
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.maxSamples, 1, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.framebuffer = resources.createFramebuffer(resources.createRenderTexture({
      width: this.maxSamples,
      height: 1,
      precision: 'float',
    }));
    this.lastStats = {
      maxSamples: this.maxSamples,
      lastSampleCount: 0,
      lastFragmentPixels: 0,
      lastUploadFloats: 0,
      lastReadbackFloats: 0,
    };
  }

  sample(options: RawGpuTexturePointSamplerSampleOptions): Float32Array {
    const gl = this.resources.gl;
    const pointCount = Math.max(0, Math.min(this.maxSamples, Math.floor(options.pointCount)));
    const uploadFloats = this.maxSamples * 4;
    const points = this.ensurePointScratch(uploadFloats);
    points.fill(0);
    const copyFloats = Math.min(pointCount * 2, options.points.length);
    for (let index = 0; index < copyFloats; index += 1) points[index] = options.points[index] ?? 0;
    gl.bindTexture(gl.TEXTURE_2D, this.pointTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.maxSamples, 1, gl.RGBA, gl.FLOAT, points);

    if (pointCount > 0) {
      this.pass.render({
        target: this.framebuffer,
        width: pointCount,
        height: 1,
        bind: (bindGl, _program, uniform) => {
          bindGl.disable(bindGl.BLEND);
          bindGl.activeTexture(bindGl.TEXTURE0);
          bindGl.bindTexture(bindGl.TEXTURE_2D, options.source.texture.texture);
          bindGl.uniform1i(uniform('uSource'), 0);
          bindGl.activeTexture(bindGl.TEXTURE1);
          bindGl.bindTexture(bindGl.TEXTURE_2D, this.pointTexture);
          bindGl.uniform1i(uniform('uPoints'), 1);
          bindGl.uniform1f(uniform('uPointCount'), pointCount);
          bindGl.uniform2f(uniform('uWorldSize'), options.worldWidth, options.worldHeight);
        },
      });
    }

    const readFloats = pointCount * 4;
    const result = this.ensureReadScratch(readFloats);
    if (pointCount > 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer.framebuffer);
      gl.readPixels(0, 0, pointCount, 1, gl.RGBA, gl.FLOAT, result);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    this.lastStats = {
      maxSamples: this.maxSamples,
      lastSampleCount: pointCount,
      lastFragmentPixels: pointCount,
      lastUploadFloats: uploadFloats,
      lastReadbackFloats: readFloats,
    };
    return result;
  }

  stats(): RawGpuTexturePointSamplerStats {
    return this.lastStats;
  }

  destroy(): void {
    this.pass.destroy();
    this.resources.gl.deleteTexture(this.pointTexture);
    this.resources.destroyFramebuffer(this.framebuffer);
  }

  private ensurePointScratch(length: number): Float32Array {
    if (this.pointScratch.length < length) this.pointScratch = new Float32Array(length);
    return this.pointScratch;
  }

  private ensureReadScratch(length: number): Float32Array {
    if (this.readScratch.length < length) this.readScratch = new Float32Array(length);
    return this.readScratch;
  }
}
