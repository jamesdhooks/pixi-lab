import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';
import type { RawFramebuffer } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleIndexMapGatherOptions {
  source: RawGpuConstraintParticleState;
  destination: RawGpuConstraintParticleState;
  indexMap: RawFramebuffer;
  particleCount?: number;
}

export interface RawGpuConstraintParticleIndexMapGatherStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
  sourceWidth: number;
  sourceHeight: number;
  destinationWidth: number;
  destinationHeight: number;
  sourceOrder: 'sorted-cell-key';
  destinationOrder: 'original-index';
  gathersPositionVelocity: boolean;
  gathersAttributes: boolean;
  suitableForOriginalOrderFeedback: boolean;
}

const GATHER_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const GATHER_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;

uniform sampler2D uSourcePosition;
uniform sampler2D uSourceVelocity;
uniform sampler2D uDestinationPosition;
uniform sampler2D uDestinationVelocity;
uniform sampler2D uIndexMap;
uniform ivec2 uDestinationSize;
uniform ivec2 uSourceSize;
uniform int uCapacity;

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int index = texel.y * uDestinationSize.x + texel.x;
  vec4 fallbackPosition = texelFetch(uDestinationPosition, texel, 0);
  vec4 fallbackVelocity = texelFetch(uDestinationVelocity, texel, 0);
  if (index >= uCapacity) {
    outPosition = fallbackPosition;
    outVelocity = fallbackVelocity;
    return;
  }

  vec4 map = texelFetch(uIndexMap, texel, 0);
  if (map.w <= 0.0) {
    outPosition = fallbackPosition;
    outVelocity = fallbackVelocity;
    return;
  }

  ivec2 sourceTexel = ivec2(int(map.x + 0.5), int(map.y + 0.5));
  if (sourceTexel.x < 0 || sourceTexel.y < 0 || sourceTexel.x >= uSourceSize.x || sourceTexel.y >= uSourceSize.y) {
    outPosition = fallbackPosition;
    outVelocity = fallbackVelocity;
    return;
  }

  outPosition = texelFetch(uSourcePosition, sourceTexel, 0);
  outVelocity = texelFetch(uSourceVelocity, sourceTexel, 0);
}`;

export class RawGpuConstraintParticleIndexMapGatherPass {
  private readonly pass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleIndexMapGatherStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
    sourceWidth: 0,
    sourceHeight: 0,
    destinationWidth: 0,
    destinationHeight: 0,
    sourceOrder: 'sorted-cell-key',
    destinationOrder: 'original-index',
    gathersPositionVelocity: true,
    gathersAttributes: false,
    suitableForOriginalOrderFeedback: false,
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: GATHER_VERTEX_SHADER,
      fragment: GATHER_FRAGMENT_SHADER,
    });
  }

  gather(options: RawGpuConstraintParticleIndexMapGatherOptions): void {
    const source = options.source;
    const destination = options.destination;
    const activeCount = activeParticleCount(options.particleCount, destination.capacity);
    const activeRows = activeTextureRows(activeCount, destination.width, destination.height);
    this.lastStats = {
      activeParticleCount: activeCount,
      activeRows,
      fragmentTexels: destination.width * activeRows,
      sourceWidth: source.width,
      sourceHeight: source.height,
      destinationWidth: destination.width,
      destinationHeight: destination.height,
      sourceOrder: 'sorted-cell-key',
      destinationOrder: 'original-index',
      gathersPositionVelocity: true,
      gathersAttributes: false,
      suitableForOriginalOrderFeedback: activeCount > 0,
    };

    destination.bindDynamicWriteFramebuffer();
    this.pass.render({
      width: destination.width,
      height: activeRows,
      preserveFramebuffer: true,
      bind: (gl, _program, uniform) => {
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
        gl.bindTexture(gl.TEXTURE_2D, options.indexMap.texture.texture);
        gl.uniform1i(uniform('uIndexMap'), 4);
        gl.uniform2i(uniform('uDestinationSize'), destination.width, destination.height);
        gl.uniform2i(uniform('uSourceSize'), source.width, source.height);
        gl.uniform1i(uniform('uCapacity'), activeCount);
      },
    });
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    destination.unbindDynamicWriteFramebuffer();
    destination.swap();
  }

  stats(): RawGpuConstraintParticleIndexMapGatherStats {
    return this.lastStats;
  }

  destroy(): void {
    this.pass.destroy();
  }
}

function activeParticleCount(count: number | undefined, capacity: number): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return capacity;
  return Math.max(0, Math.min(capacity, Math.floor(count)));
}

function activeTextureRows(count: number, width: number, height: number): number {
  return Math.max(1, Math.min(height, Math.ceil(Math.max(1, count) / Math.max(1, width))));
}
