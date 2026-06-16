import {
  linkRawWebGL2Program,
  RawWebGL2Scene,
  type RawFramebuffer,
  type RawRenderTexture,
  type RawWebGL2ResourceContext,
  type GestureEvent,
  type SettingsValue,
} from '@hooksjam/pixi-lab-core';
import { ORBITAL_SHRAPNEL_DEFAULTS } from './orbital-shrapnel.config.js';
import { OrbitalShrapnelModel } from './OrbitalShrapnelModel.js';
import { resolveOrbitalShrapnelRawTexturePlan } from './OrbitalShrapnelRawTexturePlan.js';

const MARKUP = `
  <div class="relative h-full w-full overflow-hidden bg-black text-white">
    <canvas class="h-full w-full" data-orbital-engine-raw-canvas></canvas>
    <div hidden data-orbital-engine-raw-status></div>
  </div>
`;

const VERTEX_SHADER = `#version 300 es
  precision highp float;

  in vec2 aPosition;
  in float aHeat;
  uniform vec2 uResolution;
  uniform float uPointScale;
  out float vHeat;

  void main() {
    vec2 clip = (aPosition / uResolution) * 2.0 - 1.0;
    gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
    gl_PointSize = mix(1.4, 3.8, clamp(aHeat, 0.0, 1.0)) * uPointScale;
    vHeat = aHeat;
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  in float vHeat;
  out vec4 outColor;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float falloff = max(0.0, 1.0 - dot(uv, uv));
    if (falloff <= 0.0) discard;
    vec3 cool = vec3(0.34, 0.72, 1.0);
    vec3 hot = vec3(1.0, 0.76, 0.36);
    vec3 color = mix(cool, hot, clamp(vHeat, 0.0, 1.0));
    outColor = vec4(color * (0.28 + vHeat), falloff * 0.82);
  }
`;

interface RawEngineRuntime {
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  heatBuffer: WebGLBuffer;
  vao: WebGLVertexArrayObject;
  resolutionUniform: WebGLUniformLocation | null;
  pointScaleUniform: WebGLUniformLocation | null;
  particleTexture: RawRenderTexture;
  trailTexture: RawRenderTexture;
  trailFramebuffer: RawFramebuffer;
  particleData: Float32Array;
  model: OrbitalShrapnelModel;
  capacity: number;
  trailWidth: number;
  trailHeight: number;
  lastWidth: number;
  lastHeight: number;
}

type RawEngineSettings = Record<string, SettingsValue>;

function numberSetting(settings: RawEngineSettings | undefined, key: string, fallback: number): number {
  const value = settings?.[key] ?? ORBITAL_SHRAPNEL_DEFAULTS[key];
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function writeStatus(canvas: HTMLCanvasElement, supported: boolean, fallbackReasons: string[]): void {
  const root = canvas.closest('[data-pixi-lab-dom-scene]') ?? canvas.parentElement;
  const status = root?.querySelector<HTMLElement>('[data-orbital-engine-raw-status]');
  if (!status) return;
  status.textContent = supported ? 'engine resources ready' : `fallback: ${fallbackReasons.join(', ')}`;
}

function createModel(width: number, height: number, settings: RawEngineSettings | undefined): OrbitalShrapnelModel {
  const resolution = numberSetting(settings, 'resolution', 64);
  const particleCount = numberSetting(settings, 'particleCount', 520);
  return new OrbitalShrapnelModel({
    seed: 771203,
    width,
    height,
    particleCount,
    trailColumns: resolution,
    trailRows: Math.max(16, Math.round(resolution * (height / Math.max(1, width)))),
    planetRadius: numberSetting(settings, 'planetRadius', 46),
    gravity: numberSetting(settings, 'gravity', 1550),
    drag: numberSetting(settings, 'drag', 0.002),
    trailFade: numberSetting(settings, 'trailFade', 0.955),
    maxSpeed: numberSetting(settings, 'rawMaxSpeed', 2.3),
  });
}

function createRuntime(
  gl: WebGL2RenderingContext,
  resources: RawWebGL2ResourceContext,
  width: number,
  height: number,
  settings: RawEngineSettings | undefined,
): RawEngineRuntime {
  const model = createModel(width, height, settings);
  const plan = resolveOrbitalShrapnelRawTexturePlan({
    width,
    height,
    quality: 'raw',
    particleCount: numberSetting(settings, 'particleCount', 520),
    trailColumns: numberSetting(settings, 'resolution', 64),
    rawParticleTextureSize: numberSetting(settings, 'rawParticleTextureSize', 32),
    rawTrailTextureWidth: numberSetting(settings, 'rawTrailTextureWidth', 512),
  });

  let program: WebGLProgram | null = null;
  let positionBuffer: WebGLBuffer | null = null;
  let heatBuffer: WebGLBuffer | null = null;
  let vao: WebGLVertexArrayObject | null = null;

  try {
    program = linkRawWebGL2Program(gl, { vertex: VERTEX_SHADER, fragment: FRAGMENT_SHADER });
    positionBuffer = gl.createBuffer();
    heatBuffer = gl.createBuffer();
    vao = gl.createVertexArray();
    if (!positionBuffer || !heatBuffer || !vao) throw new Error('Unable to allocate orbital raw engine buffers');

    const particleTexture = resources.createRenderTexture({ width: plan.particleState.width, height: plan.particleState.height, precision: 'float' });
    const trailTexture = resources.createRenderTexture({ width: plan.trailField.width, height: plan.trailField.height, precision: 'half-float' });
    const trailFramebuffer = resources.createFramebuffer(trailTexture);
    const particleData = new Float32Array(plan.particleState.capacity * 4);

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const heatLocation = gl.getAttribLocation(program, 'aHeat');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, heatBuffer);
    gl.enableVertexAttribArray(heatLocation);
    gl.vertexAttribPointer(heatLocation, 1, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    return {
      program,
      positionBuffer,
      heatBuffer,
      vao,
      resolutionUniform: gl.getUniformLocation(program, 'uResolution'),
      pointScaleUniform: gl.getUniformLocation(program, 'uPointScale'),
      particleTexture,
      trailTexture,
      trailFramebuffer,
      particleData,
      model,
      capacity: plan.particleState.capacity,
      trailWidth: plan.trailField.width,
      trailHeight: plan.trailField.height,
      lastWidth: width,
      lastHeight: height,
    };
  } catch (error) {
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(null);
    if (vao) gl.deleteVertexArray(vao);
    if (positionBuffer) gl.deleteBuffer(positionBuffer);
    if (heatBuffer) gl.deleteBuffer(heatBuffer);
    if (program) gl.deleteProgram(program);
    resources.destroy();
    throw error;
  }
}

function destroyRuntime(gl: WebGL2RenderingContext, runtime: RawEngineRuntime | null): void {
  if (!runtime) return;
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.useProgram(null);
  gl.deleteVertexArray(runtime.vao);
  gl.deleteBuffer(runtime.positionBuffer);
  gl.deleteBuffer(runtime.heatBuffer);
  gl.deleteProgram(runtime.program);
}

function uploadModelState(gl: WebGL2RenderingContext, runtime: RawEngineRuntime): number {
  const particles = runtime.model.renderParticles();
  const drawCount = Math.min(particles.length, runtime.capacity);
  const positions = new Float32Array(drawCount * 2);
  const heat = new Float32Array(drawCount);

  for (let i = 0; i < drawCount; i++) {
    const particle = particles[i];
    positions[i * 2] = particle.position.x;
    positions[i * 2 + 1] = particle.position.y;
    heat[i] = Math.min(1.5, Math.max(0.05, particle.alpha ?? 0.5));
    runtime.particleData[i * 4] = particle.position.x;
    runtime.particleData[i * 4 + 1] = particle.position.y;
    runtime.particleData[i * 4 + 2] = particle.velocity.x;
    runtime.particleData[i * 4 + 3] = heat[i];
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, runtime.positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, runtime.heatBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, heat, gl.DYNAMIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, runtime.particleTexture.texture);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    runtime.particleTexture.width,
    runtime.particleTexture.height,
    gl.RGBA,
    gl.FLOAT,
    runtime.particleData,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);

  return drawCount;
}

export class OrbitalShrapnelExperimentalRawEngineScene extends RawWebGL2Scene {
  private runtime: RawEngineRuntime | null = null;
  private drawCount = 0;
  private status = 'initializing';
  private settings: RawEngineSettings | undefined;

  constructor() {
    super({
      name: 'Orbital Shrapnel Engine Raw Experimental',
      markup: MARKUP,
      canvasSelector: '[data-orbital-engine-raw-canvas]',
      onInit: (state) => {
        writeStatus(state.canvas, state.resources.capabilities.supported, state.resources.capabilities.fallbackReasons);
        this.runtime = createRuntime(state.gl, state.resources, state.width, state.height, this.settings);
        this.status = 'engine-backed';
      },
      render: ({ gl, width, height, canvas, resources, deltaSeconds }) => {
        writeStatus(canvas, resources.capabilities.supported, resources.capabilities.fallbackReasons);
        if (!this.runtime) return;
        if (this.runtime.lastWidth !== width || this.runtime.lastHeight !== height) {
          this.runtime.model = createModel(width, height, this.settings);
          this.runtime.lastWidth = width;
          this.runtime.lastHeight = height;
        }

        this.runtime.model.update(Math.min(1 / 20, Math.max(1 / 240, deltaSeconds)));
        this.drawCount = uploadModelState(gl, this.runtime);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.runtime.trailFramebuffer.framebuffer);
        gl.viewport(0, 0, this.runtime.trailWidth, this.runtime.trailHeight);
        gl.clearColor(0.0, 0.0, 0.0, 0.055);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.viewport(0, 0, width, height);
        gl.clearColor(0.015, 0.01, 0.035, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.useProgram(this.runtime.program);
        gl.uniform2f(this.runtime.resolutionUniform, width, height);
        gl.uniform1f(this.runtime.pointScaleUniform, numberSetting(this.settings, 'debrisSize', 0.58) * 2.2);
        gl.bindVertexArray(this.runtime.vao);
        gl.drawArrays(gl.POINTS, 0, this.drawCount);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
      },
      onDestroy: ({ gl }) => {
        destroyRuntime(gl, this.runtime);
        this.runtime = null;
        this.drawCount = 0;
        this.status = 'destroyed';
      },
    });
  }

  updateSettings(settings: RawEngineSettings): void {
    this.settings = settings;
    if (this.runtime) {
      this.runtime.model = createModel(this.runtime.lastWidth, this.runtime.lastHeight, settings);
      this.drawCount = 0;
    }
  }

  pushGestures(gestures: GestureEvent[]): void {
    if (!this.runtime || gestures.length === 0) return;
    for (const gesture of gestures) this.runtime.model.handleGesture(gesture);
  }

  reset(): void {
    this.runtime?.model.reset(771203);
  }

  getDebugStats(): Record<string, string | number | boolean | null> | null {
    if (!this.runtime) {
      return {
        renderer: 'raw-webgl2-engine-experimental',
        fps: null,
        gpu: 'n/a',
        particles: 0,
        drawn: 0,
        state: 'pending',
        trailRt: 'pending',
        vram: 'pending',
        caps: 'pending',
        status: this.status,
      };
    }

    const stats = this.runtime.model.stats();
    const particleTexturePixels = this.runtime.particleTexture.width * this.runtime.particleTexture.height;
    const particleTextureBytes = particleTexturePixels * 4 * Float32Array.BYTES_PER_ELEMENT;
    const trailTextureBytes = this.runtime.trailWidth * this.runtime.trailHeight * 4;
    const totalBytes = particleTextureBytes + trailTextureBytes;

    return {
      renderer: 'raw-webgl2-engine-experimental',
      fps: null,
      gpu: 'n/a',
      particles: stats.particleCount,
      drawn: this.drawCount,
      state: `${this.runtime.particleTexture.width}×${this.runtime.particleTexture.height} RGBA32F`,
      trailRt: `${this.runtime.trailWidth}×${this.runtime.trailHeight}`,
      vram: `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`,
      caps: 'WebGL2 engine resources',
      status: this.status,
      capacity: this.runtime.capacity,
      wells: stats.gravityWellCount,
      shockwaves: stats.shockwaveCount,
      meanSpeed: Number(stats.meanSpeed.toFixed(2)),
      trailMax: Number(stats.trailMax.toFixed(3)),
    };
  }
}
