import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import type { RawFramebuffer } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleSortedKeyGatherOptions {
  source: RawGpuConstraintParticleState;
  destination: RawGpuConstraintParticleState;
  sortedKeys: RawFramebuffer;
  sortedKeyWidth: number;
  sortedKeyHeight: number;
  particleCount?: number;
  gatherAttributes?: boolean;
}

export interface RawGpuConstraintParticleSortedKeyGatherStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  sourceWidth: number;
  sourceHeight: number;
  destinationWidth: number;
  destinationHeight: number;
  sortedKeyWidth: number;
  sortedKeyHeight: number;
  attributeFragmentTexels: number;
  gpuGatheredSortedState: boolean;
  gpuGatheredSortedAttributes: boolean;
  source: 'gpu-sorted-key-index-texture';
  outputOrder: 'sorted-cell-key';
}

const SORTED_KEY_GATHER_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const SORTED_KEY_GATHER_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;

uniform sampler2D uSourcePosition;
uniform sampler2D uSourceVelocity;
uniform sampler2D uDestinationPosition;
uniform sampler2D uDestinationVelocity;
uniform sampler2D uSortedKeys;
uniform ivec2 uSourceSize;
uniform ivec2 uDestinationSize;
uniform ivec2 uSortedKeySize;
uniform int uParticleCount;

ivec2 texelForIndex(int index, int width) {
  return ivec2(index % width, index / width);
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int sortedIndex = texel.y * uDestinationSize.x + texel.x;
  vec4 fallbackPosition = texelFetch(uDestinationPosition, texel, 0);
  vec4 fallbackVelocity = texelFetch(uDestinationVelocity, texel, 0);
  if (sortedIndex < 0 || sortedIndex >= uParticleCount) {
    outPosition = fallbackPosition;
    outVelocity = fallbackVelocity;
    return;
  }

  ivec2 keyTexel = texelForIndex(sortedIndex, uSortedKeySize.x);
  if (keyTexel.y >= uSortedKeySize.y) {
    outPosition = fallbackPosition;
    outVelocity = fallbackVelocity;
    return;
  }

  vec4 key = texelFetch(uSortedKeys, keyTexel, 0);
  int sourceIndex = int(floor(key.y + 0.5));
  if (sourceIndex < 0 || sourceIndex >= uParticleCount) {
    outPosition = fallbackPosition;
    outVelocity = fallbackVelocity;
    return;
  }

  ivec2 sourceTexel = texelForIndex(sourceIndex, uSourceSize.x);
  if (sourceTexel.y >= uSourceSize.y) {
    outPosition = fallbackPosition;
    outVelocity = fallbackVelocity;
    return;
  }

  outPosition = texelFetch(uSourcePosition, sourceTexel, 0);
  outVelocity = texelFetch(uSourceVelocity, sourceTexel, 0);
}
`;

const SORTED_ATTRIBUTE_GATHER_VERTEX = `#version 300 es
layout(location = 0) in vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const SORTED_ATTRIBUTE_GATHER_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

out vec4 outAttribute;

uniform sampler2D uSourceAttribute;
uniform sampler2D uSortedKeys;
uniform ivec2 uSourceSize;
uniform ivec2 uDestinationSize;
uniform ivec2 uSortedKeySize;
uniform int uParticleCount;

ivec2 texelForIndex(int index, int width) {
  return ivec2(index % width, index / width);
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int sortedIndex = texel.y * uDestinationSize.x + texel.x;
  vec4 fallbackAttribute = vec4(0.0);
  if (sortedIndex < 0 || sortedIndex >= uParticleCount) {
    outAttribute = fallbackAttribute;
    return;
  }

  ivec2 keyTexel = texelForIndex(sortedIndex, uSortedKeySize.x);
  if (keyTexel.y >= uSortedKeySize.y) {
    outAttribute = fallbackAttribute;
    return;
  }

  vec4 key = texelFetch(uSortedKeys, keyTexel, 0);
  int sourceIndex = int(floor(key.y + 0.5));
  if (sourceIndex < 0 || sourceIndex >= uParticleCount) {
    outAttribute = fallbackAttribute;
    return;
  }

  ivec2 sourceTexel = texelForIndex(sourceIndex, uSourceSize.x);
  if (sourceTexel.y >= uSourceSize.y) {
    outAttribute = fallbackAttribute;
    return;
  }

  outAttribute = texelFetch(uSourceAttribute, sourceTexel, 0);
}
`;

export class RawGpuConstraintParticleSortedKeyGatherPass {
  private readonly pass: RawGpuFieldPass;
  private readonly attributePass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleSortedKeyGatherStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    sourceWidth: 0,
    sourceHeight: 0,
    destinationWidth: 0,
    destinationHeight: 0,
    sortedKeyWidth: 0,
    sortedKeyHeight: 0,
    attributeFragmentTexels: 0,
    gpuGatheredSortedState: false,
    gpuGatheredSortedAttributes: false,
    source: 'gpu-sorted-key-index-texture',
    outputOrder: 'sorted-cell-key',
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: SORTED_KEY_GATHER_VERTEX,
      fragment: SORTED_KEY_GATHER_FRAGMENT,
    });
    this.attributePass = new RawGpuFieldPass(gl, {
      vertex: SORTED_ATTRIBUTE_GATHER_VERTEX,
      fragment: SORTED_ATTRIBUTE_GATHER_FRAGMENT,
    });
  }

  gather(options: RawGpuConstraintParticleSortedKeyGatherOptions): void {
    const source = options.source;
    const destination = options.destination;
    const activeCount = activeParticleCount(options.particleCount, Math.min(source.capacity, destination.capacity));
    const activeRows = activeTextureRows(activeCount, destination.width, destination.height);
    const sortedKeyWidth = Math.max(1, Math.floor(options.sortedKeyWidth));
    const sortedKeyHeight = Math.max(1, Math.floor(options.sortedKeyHeight));
    const gatherAttributes = options.gatherAttributes !== false;
    this.lastStats = {
      activeParticleCount: activeCount,
      activeRows,
      fragmentTexels: destination.width * activeRows,
      sourceWidth: source.width,
      sourceHeight: source.height,
      destinationWidth: destination.width,
      destinationHeight: destination.height,
      sortedKeyWidth,
      sortedKeyHeight,
      attributeFragmentTexels: gatherAttributes ? destination.width * activeRows : 0,
      gpuGatheredSortedState: activeCount > 0,
      gpuGatheredSortedAttributes: gatherAttributes && activeCount > 0,
      source: 'gpu-sorted-key-index-texture',
      outputOrder: 'sorted-cell-key',
    };

    destination.bindDynamicWriteFramebuffer();
    this.pass.render({
      width: destination.width,
      height: activeRows,
      preserveFramebuffer: true,
      bind: (gl, _program, uniform) => {
        gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source.positions.read.texture.texture);
        gl.uniform1i(uniform('uSourcePosition'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, source.velocities.read.texture.texture);
        gl.uniform1i(uniform('uSourceVelocity'), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, destination.positions.read.texture.texture);
        gl.uniform1i(uniform('uDestinationPosition'), 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, destination.velocities.read.texture.texture);
        gl.uniform1i(uniform('uDestinationVelocity'), 3);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, options.sortedKeys.texture.texture);
        gl.uniform1i(uniform('uSortedKeys'), 4);
        gl.uniform2i(uniform('uSourceSize'), source.width, source.height);
        gl.uniform2i(uniform('uDestinationSize'), destination.width, destination.height);
        gl.uniform2i(uniform('uSortedKeySize'), sortedKeyWidth, sortedKeyHeight);
        gl.uniform1i(uniform('uParticleCount'), activeCount);
      },
    });
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    destination.unbindDynamicWriteFramebuffer();
    destination.swap();

    if (gatherAttributes) {
      this.attributePass.render({
        target: destination.attributes,
        width: destination.width,
        height: activeRows,
        bind: (gl, _program, uniform) => {
          gl.disable(gl.BLEND);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, source.attributes.texture.texture);
          gl.uniform1i(uniform('uSourceAttribute'), 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, options.sortedKeys.texture.texture);
          gl.uniform1i(uniform('uSortedKeys'), 1);
          gl.uniform2i(uniform('uSourceSize'), source.width, source.height);
          gl.uniform2i(uniform('uDestinationSize'), destination.width, destination.height);
          gl.uniform2i(uniform('uSortedKeySize'), sortedKeyWidth, sortedKeyHeight);
          gl.uniform1i(uniform('uParticleCount'), activeCount);
        },
      });
      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }
  }

  stats(): RawGpuConstraintParticleSortedKeyGatherStats {
    return this.lastStats;
  }

  destroy(): void {
    this.pass.destroy();
    this.attributePass.destroy();
  }
}

function activeParticleCount(count: number | undefined, capacity: number): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return capacity;
  return Math.max(0, Math.min(capacity, Math.floor(count)));
}

function activeTextureRows(count: number, width: number, height: number): number {
  return Math.max(1, Math.min(height, Math.ceil(Math.max(1, count) / Math.max(1, width))));
}
