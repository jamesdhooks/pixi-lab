import { RawGpuFieldPass } from './RawGpuFieldPass.js';
import { RawGpuConstraintParticleState } from './RawGpuConstraintParticleState.js';

export interface RawGpuConstraintParticleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RawGpuConstraintParticleStepOptions {
  state: RawGpuConstraintParticleState;
  dt: number;
  gravityX?: number;
  gravityY?: number;
  damping?: number;
  speedLimit?: number;
  bounds?: RawGpuConstraintParticleBounds;
  bounce?: number;
  radiusScale?: number;
  particleCount?: number;
}

export interface RawGpuConstraintParticleStepStats {
  activeParticleCount: number;
  activeRows: number;
  fragmentTexels: number;
}

const STEP_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const STEP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uAttribute;
uniform ivec2 uStateSize;
uniform int uCapacity;
uniform float uDt;
uniform vec2 uGravity;
uniform float uDamping;
uniform float uSpeedLimit;
uniform vec4 uBounds;
uniform float uBounce;
uniform float uRadiusScale;

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int index = texel.y * uStateSize.x + texel.x;
  vec4 position = texelFetch(uPosition, texel, 0);
  vec4 velocity = texelFetch(uVelocity, texel, 0);
  vec4 particleAttr = texelFetch(uAttribute, texel, 0);

  if (index >= uCapacity) {
    outPosition = position;
    outVelocity = velocity;
    return;
  }

  float radius = max(max(position.z, particleAttr.x) * uRadiusScale, 0.0);
  float inverseMass = max(max(velocity.z, particleAttr.y), 0.0);
  vec2 nextPosition = position.xy;
  vec2 nextVelocity = velocity.xy;

  if (inverseMass > 0.0 && uDt > 0.0) {
    nextVelocity += uGravity * uDt;
    nextVelocity *= uDamping;

    float speed = length(nextVelocity);
    if (uSpeedLimit > 0.0 && speed > uSpeedLimit) {
      nextVelocity *= uSpeedLimit / max(speed, 0.00001);
    }

    nextPosition += nextVelocity * uDt;

    if (nextPosition.x < uBounds.x + radius) {
      nextPosition.x = uBounds.x + radius;
      nextVelocity.x = abs(nextVelocity.x) * uBounce;
    } else if (nextPosition.x > uBounds.z - radius) {
      nextPosition.x = uBounds.z - radius;
      nextVelocity.x = -abs(nextVelocity.x) * uBounce;
    }

    if (nextPosition.y < uBounds.y + radius) {
      nextPosition.y = uBounds.y + radius;
      nextVelocity.y = abs(nextVelocity.y) * uBounce;
    } else if (nextPosition.y > uBounds.w - radius) {
      nextPosition.y = uBounds.w - radius;
      nextVelocity.y = -abs(nextVelocity.y) * uBounce;
    }
  }

  outPosition = vec4(nextPosition, position.zw);
  outVelocity = vec4(nextVelocity, velocity.zw);
}`;

export class RawGpuConstraintParticleStepPass {
  private readonly pass: RawGpuFieldPass;
  private lastStats: RawGpuConstraintParticleStepStats = {
    activeParticleCount: 0,
    activeRows: 0,
    fragmentTexels: 0,
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.pass = new RawGpuFieldPass(gl, {
      vertex: STEP_VERTEX_SHADER,
      fragment: STEP_FRAGMENT_SHADER,
    });
  }

  step(options: RawGpuConstraintParticleStepOptions): void {
    const state = options.state;
    const activeCount = activeParticleCount(options.particleCount, state.capacity);
    const activeRows = activeTextureRows(activeCount, state.width, state.height);
    this.lastStats = {
      activeParticleCount: activeCount,
      activeRows,
      fragmentTexels: state.width * activeRows,
    };
    const dt = Math.max(0, finiteOr(options.dt, 0));
    const gravityX = finiteOr(options.gravityX, 0);
    const gravityY = finiteOr(options.gravityY, 0);
    const damping = clamp(finiteOr(options.damping, 1), 0, 1);
    const speedLimit = Math.max(0, finiteOr(options.speedLimit, 0));
    const bounce = clamp(finiteOr(options.bounce, 0), 0, 1);
    const radiusScale = Math.max(0, finiteOr(options.radiusScale, 1));
    const bounds = options.bounds ?? {
      minX: -1000000,
      minY: -1000000,
      maxX: 1000000,
      maxY: 1000000,
    };

    state.bindDynamicWriteFramebuffer();
    this.pass.render({
      width: state.width,
      height: activeRows,
      preserveFramebuffer: true,
      bind: (gl, _program, uniform) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, state.positions.read.texture.texture);
        gl.uniform1i(uniform('uPosition'), 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, state.velocities.read.texture.texture);
        gl.uniform1i(uniform('uVelocity'), 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, state.attributes.texture.texture);
        gl.uniform1i(uniform('uAttribute'), 2);
        gl.uniform2i(uniform('uStateSize'), state.width, state.height);
        gl.uniform1i(uniform('uCapacity'), activeCount);
        gl.uniform1f(uniform('uDt'), dt);
        gl.uniform2f(uniform('uGravity'), gravityX, gravityY);
        gl.uniform1f(uniform('uDamping'), damping);
        gl.uniform1f(uniform('uSpeedLimit'), speedLimit);
        gl.uniform4f(uniform('uBounds'), bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
        gl.uniform1f(uniform('uBounce'), bounce);
        gl.uniform1f(uniform('uRadiusScale'), radiusScale);
      },
    });
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    state.unbindDynamicWriteFramebuffer();
    state.swap();
  }

  stats(): RawGpuConstraintParticleStepStats {
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

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
