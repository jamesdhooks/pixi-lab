import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import type { RawFramebuffer, RawTexturePrecision, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuFloatPrefixSumOptions {
  source: RawFramebuffer;
  width: number;
  height: number;
  elementCount?: number;
}

export interface RawGpuFloatPrefixSumStats {
  elementCount: number;
  width: number;
  height: number;
  passCount: number;
  fragmentTexels: number;
  inclusive: true;
  inputChannel: 'r';
  outputChannel: 'r';
  gpuOwnedPrefix: boolean;
  suitableForCellOffsets: boolean;
}

const PREFIX_SUM_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const PREFIX_SUM_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uSource;
uniform ivec2 uSize;
uniform int uElementCount;
uniform int uOffset;

out vec4 outValue;

ivec2 texelForIndex(int index) {
  return ivec2(index % uSize.x, index / uSize.x);
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int index = texel.y * uSize.x + texel.x;
  if (index < 0 || index >= uElementCount) {
    outValue = vec4(0.0);
    return;
  }

  float value = texelFetch(uSource, texel, 0).x;
  if (uOffset > 0) {
    int previousIndex = index - uOffset;
    if (previousIndex >= 0) {
      value += texelFetch(uSource, texelForIndex(previousIndex), 0).x;
    }
  }

  outValue = vec4(value, 0.0, 0.0, 1.0);
}
`;

export class RawGpuFloatPrefixSumPass {
  private readonly pass: RawGpuFieldPass;
  private bufferA?: RawFramebuffer;
  private bufferB?: RawFramebuffer;
  private outputBuffer?: RawFramebuffer;
  private lastStats: RawGpuFloatPrefixSumStats = {
    elementCount: 0,
    width: 0,
    height: 0,
    passCount: 0,
    fragmentTexels: 0,
    inclusive: true,
    inputChannel: 'r',
    outputChannel: 'r',
    gpuOwnedPrefix: false,
    suitableForCellOffsets: false,
  };

  constructor(private readonly resources: RawWebGL2ResourceContext, private readonly precision: RawTexturePrecision = 'float') {
    this.pass = new RawGpuFieldPass(resources.gl, {
      vertex: PREFIX_SUM_VERTEX,
      fragment: PREFIX_SUM_FRAGMENT,
    });
  }

  get output(): RawFramebuffer | undefined {
    return this.outputBuffer;
  }

  compute(options: RawGpuFloatPrefixSumOptions): RawGpuFloatPrefixSumStats {
    const width = Math.max(1, Math.floor(options.width));
    const height = Math.max(1, Math.floor(options.height));
    const elementCount = Math.max(0, Math.min(width * height, Math.floor(options.elementCount ?? width * height)));
    const passCount = elementCount > 0 ? Math.ceil(Math.log2(Math.max(1, elementCount))) + 1 : 0;
    this.lastStats = {
      elementCount,
      width,
      height,
      passCount,
      fragmentTexels: width * height * passCount,
      inclusive: true,
      inputChannel: 'r',
      outputChannel: 'r',
      gpuOwnedPrefix: elementCount > 0,
      suitableForCellOffsets: elementCount > 0,
    };
    if (elementCount <= 0) {
      this.outputBuffer = undefined;
      return this.lastStats;
    }

    const targets = this.ensureBuffers(width, height);
    let source = options.source;
    let target = targets.a;
    this.renderPass(source, target, width, height, elementCount, 0);
    source = target;

    for (let offset = 1, passIndex = 1; offset < elementCount; offset *= 2, passIndex += 1) {
      target = passIndex % 2 === 1 ? targets.b : targets.a;
      this.renderPass(source, target, width, height, elementCount, offset);
      source = target;
    }

    this.outputBuffer = source;
    return this.lastStats;
  }

  stats(): RawGpuFloatPrefixSumStats {
    return this.lastStats;
  }

  destroy(): void {
    this.pass.destroy();
    if (this.bufferA) this.resources.destroyFramebuffer(this.bufferA);
    if (this.bufferB) this.resources.destroyFramebuffer(this.bufferB);
  }

  private ensureBuffers(width: number, height: number): { a: RawFramebuffer; b: RawFramebuffer } {
    if (
      this.bufferA &&
      this.bufferB &&
      this.bufferA.texture.width === width &&
      this.bufferA.texture.height === height &&
      this.bufferB.texture.width === width &&
      this.bufferB.texture.height === height
    ) {
      return { a: this.bufferA, b: this.bufferB };
    }
    if (this.bufferA) this.resources.destroyFramebuffer(this.bufferA);
    if (this.bufferB) this.resources.destroyFramebuffer(this.bufferB);
    this.bufferA = this.createBuffer(width, height);
    this.bufferB = this.createBuffer(width, height);
    return { a: this.bufferA, b: this.bufferB };
  }

  private createBuffer(width: number, height: number): RawFramebuffer {
    return this.resources.createFramebuffer(this.resources.createRenderTexture({
      width,
      height,
      precision: this.precision,
      filter: 'nearest',
    }));
  }

  private renderPass(
    source: RawFramebuffer,
    target: RawFramebuffer,
    width: number,
    height: number,
    elementCount: number,
    offset: number,
  ): void {
    this.pass.render({
      target,
      width,
      height,
      bind: (gl, _program, uniform) => {
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source.texture.texture);
        gl.uniform1i(uniform('uSource'), 0);
        gl.uniform2i(uniform('uSize'), width, height);
        gl.uniform1i(uniform('uElementCount'), elementCount);
        gl.uniform1i(uniform('uOffset'), offset);
      },
    });
  }
}
