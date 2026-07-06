import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import type { RawFramebuffer, RawTexturePrecision, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuKeyIndexSortOptions {
  source: RawFramebuffer;
  sourceWidth: number;
  sourceHeight: number;
  elementCount: number;
}

export interface RawGpuKeyIndexSortStats {
  elementCount: number;
  sortCapacity: number;
  width: number;
  height: number;
  passCount: number;
  fragmentTexels: number;
  gpuSorted: boolean;
  sortAlgorithm: 'bitonic-texture';
  keyChannel: 'r';
  indexChannel: 'g';
  suitableForCellRangeDerivation: boolean;
}

const SORT_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const SORT_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D uSource;
uniform ivec2 uSourceSize;
uniform ivec2 uOutputSize;
uniform int uElementCount;
uniform int uSortCapacity;
uniform int uStageK;
uniform int uStageJ;
uniform bool uSeed;

out vec4 outValue;

const float INVALID_KEY = 16777216.0;

ivec2 texelForIndex(int index, int width) {
  return ivec2(index % width, index / width);
}

vec4 invalidValue(int index) {
  return vec4(INVALID_KEY, float(index), 0.0, 0.0);
}

vec4 readSource(int index, ivec2 size) {
  if (index < 0 || index >= size.x * size.y) return invalidValue(index);
  return texelFetch(uSource, texelForIndex(index, size.x), 0);
}

bool before(vec4 a, vec4 b) {
  if (a.x < b.x) return true;
  if (a.x > b.x) return false;
  return a.y <= b.y;
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int index = texel.y * uOutputSize.x + texel.x;
  if (index < 0 || index >= uOutputSize.x * uOutputSize.y) {
    outValue = vec4(0.0);
    return;
  }

  if (uSeed) {
    outValue = index < uElementCount && index < uSortCapacity
      ? readSource(index, uSourceSize)
      : invalidValue(index);
    return;
  }

  if (index >= uSortCapacity) {
    outValue = invalidValue(index);
    return;
  }

  int partner = index ^ uStageJ;
  vec4 selfValue = readSource(index, uOutputSize);
  if (partner < 0 || partner >= uSortCapacity) {
    outValue = selfValue;
    return;
  }

  vec4 otherValue = readSource(partner, uOutputSize);
  bool selfBeforeOther = before(selfValue, otherValue);
  bool lowerSlot = (index & uStageJ) == 0;
  bool ascending = (index & uStageK) == 0;
  bool takeOther = ascending
    ? (lowerSlot ? !selfBeforeOther : selfBeforeOther)
    : (lowerSlot ? selfBeforeOther : !selfBeforeOther);
  outValue = takeOther ? otherValue : selfValue;
}
`;

export class RawGpuKeyIndexSortPass {
  private readonly pass: RawGpuFieldPass;
  private bufferA?: RawFramebuffer;
  private bufferB?: RawFramebuffer;
  private outputBuffer?: RawFramebuffer;
  private lastStats: RawGpuKeyIndexSortStats = {
    elementCount: 0,
    sortCapacity: 0,
    width: 0,
    height: 0,
    passCount: 0,
    fragmentTexels: 0,
    gpuSorted: false,
    sortAlgorithm: 'bitonic-texture',
    keyChannel: 'r',
    indexChannel: 'g',
    suitableForCellRangeDerivation: false,
  };

  constructor(private readonly resources: RawWebGL2ResourceContext, private readonly precision: RawTexturePrecision = 'float') {
    this.pass = new RawGpuFieldPass(resources.gl, {
      vertex: SORT_VERTEX,
      fragment: SORT_FRAGMENT,
    });
  }

  get output(): RawFramebuffer | undefined {
    return this.outputBuffer;
  }

  sort(options: RawGpuKeyIndexSortOptions): RawGpuKeyIndexSortStats {
    const elementCount = Math.max(0, Math.floor(options.elementCount));
    const sortCapacity = nextPowerOfTwo(Math.max(1, elementCount));
    const width = Math.max(1, Math.ceil(Math.sqrt(sortCapacity)));
    const height = Math.max(1, Math.ceil(sortCapacity / width));
    const buffers = this.ensureBuffers(width, height);
    let passCount = 0;

    this.renderPass({
      source: options.source,
      target: buffers.a,
      sourceWidth: Math.max(1, Math.floor(options.sourceWidth)),
      sourceHeight: Math.max(1, Math.floor(options.sourceHeight)),
      width,
      height,
      elementCount,
      sortCapacity,
      stageK: 0,
      stageJ: 0,
      seed: true,
    });
    passCount += 1;
    let read = buffers.a;
    let write = buffers.b;

    for (let k = 2; k <= sortCapacity; k *= 2) {
      for (let j = k / 2; j > 0; j = Math.floor(j / 2)) {
        this.renderPass({
          source: read,
          target: write,
          sourceWidth: width,
          sourceHeight: height,
          width,
          height,
          elementCount,
          sortCapacity,
          stageK: k,
          stageJ: j,
          seed: false,
        });
        const previousRead = read;
        read = write;
        write = previousRead;
        passCount += 1;
      }
    }

    this.outputBuffer = read;
    this.lastStats = {
      elementCount,
      sortCapacity,
      width,
      height,
      passCount,
      fragmentTexels: width * height * passCount,
      gpuSorted: elementCount > 0,
      sortAlgorithm: 'bitonic-texture',
      keyChannel: 'r',
      indexChannel: 'g',
      suitableForCellRangeDerivation: elementCount > 0,
    };
    return this.lastStats;
  }

  stats(): RawGpuKeyIndexSortStats {
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

  private renderPass(options: {
    source: RawFramebuffer;
    target: RawFramebuffer;
    sourceWidth: number;
    sourceHeight: number;
    width: number;
    height: number;
    elementCount: number;
    sortCapacity: number;
    stageK: number;
    stageJ: number;
    seed: boolean;
  }): void {
    this.pass.render({
      target: options.target,
      width: options.width,
      height: options.height,
      bind: (gl, _program, uniform) => {
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, options.source.texture.texture);
        gl.uniform1i(uniform('uSource'), 0);
        gl.uniform2i(uniform('uSourceSize'), options.sourceWidth, options.sourceHeight);
        gl.uniform2i(uniform('uOutputSize'), options.width, options.height);
        gl.uniform1i(uniform('uElementCount'), options.elementCount);
        gl.uniform1i(uniform('uSortCapacity'), options.sortCapacity);
        gl.uniform1i(uniform('uStageK'), options.stageK);
        gl.uniform1i(uniform('uStageJ'), options.stageJ);
        gl.uniform1i(uniform('uSeed'), options.seed ? 1 : 0);
      },
    });
  }
}

function nextPowerOfTwo(value: number): number {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}
