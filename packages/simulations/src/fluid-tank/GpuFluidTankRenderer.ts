import { SeededRng, type RenderQuality } from '@hooksjam/pixi-lab-core';

export interface GpuFluidTankOptions {
  cellSize: number;
  fingerForce: number;
  fingerRadius: number;
  viscosity: number;
  curl: number;
  eddyAssist: number;
  dyePersistence: number;
  pressureIterations: number;
  exposure: number;
  palette: readonly number[];
  paletteStrength: number;
  edgeDarkening: number;
  ambient: boolean;
  seed: number;
  displayMode?: 'dye' | 'velocity' | 'curl' | 'divergence' | 'pressure';
}

export interface FluidSplat {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radiusScale?: number;
}

export interface GpuFluidTankStats {
  supported: boolean;
  simWidth: number;
  simHeight: number;
  dyeWidth: number;
  dyeHeight: number;
  splats: number;
}

interface FluidProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

interface FluidTarget {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
  attach(unit: number): number;
  dispose(): void;
}

interface FluidDoubleTarget {
  readonly read: FluidTarget;
  readonly write: FluidTarget;
  readonly width: number;
  readonly height: number;
  swap(): void;
  dispose(): void;
}

const BASE_SIM_RESOLUTION = 220;
const BASE_DYE_RESOLUTION = 950;
const VELOCITY_DISSIPATION = 0.986;
const MAX_VELOCITY_CELLS = 8.5;

const BASE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const CLEAR_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float value;
void main() {
  outColor = vec4(value, value, value, 1.0);
}`;

const INIT_DYE_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 resolution;
uniform float seed;
uniform float cellSize;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i + vec2(0.0, 0.0));
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.17, 31.71);
    amplitude *= 0.52;
  }

  return value;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  float aspect = resolution.x / resolution.y;
  float scale = 1.0 / max(cellSize, 0.35);
  vec2 p = vUv * vec2(aspect, 1.0);
  vec2 s1 = vec2(seed * 1.37, seed * 2.11);
  vec2 s2 = vec2(seed * 3.19, seed * 0.73);

  float large = fbm(p * 2.1 * scale + s1);
  float medium = fbm(p * 5.6 * scale + s2);
  float fine = fbm(p * 12.0 * scale - s1 * 0.42);
  float ribbons = 0.5 + 0.5 * sin((p.x * 1.4 * scale - p.y * 0.8 * scale + large * 2.8 + seed * 0.07) * 6.2831853);

  float hue = fract(large * 0.76 + medium * 0.31 + ribbons * 0.22 + seed * 0.113);
  float saturation = 0.72 + 0.26 * medium;
  float value = 0.96 + 0.40 * fine + 0.16 * ribbons;

  vec3 color = hsv2rgb(vec3(hue, saturation, value));
  color *= 1.04 + 0.20 * ribbons;

  outColor = vec4(color, 1.0);
}
      `;

const SPLAT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main() {
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  float splat = exp(-dot(p, p) / radius);
  vec3 base = texture(uTarget, vUv).rgb;
  outColor = vec4(base + color * splat, 1.0);
}`;

const ADVECTION_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - dt * velocity * texelSize;
  coord = clamp(coord, vec2(0.001), vec2(0.999));
  outColor = texture(uSource, coord) * dissipation;
}`;

const BOUNDARY_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
uniform float wallDamping;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  float left = vUv.x;
  float right = 1.0 - vUv.x;
  float bottom = vUv.y;
  float top = 1.0 - vUv.y;
  float edge = min(min(left, right), min(bottom, top));
  float wall = smoothstep(0.0, max(texelSize.x, texelSize.y) * 7.0, edge);
  if (left < texelSize.x || right < texelSize.x) velocity.x = 0.0;
  if (bottom < texelSize.y || top < texelSize.y) velocity.y = 0.0;
  velocity *= mix(wallDamping, 1.0, wall);
  outColor = vec4(velocity, 0.0, 1.0);
}`;

const DIVERGENCE_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
vec2 velocityAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec2(0.0);
  return texture(uVelocity, uv).xy;
}
void main() {
  float L = velocityAt(vUv - vec2(texelSize.x, 0.0)).x;
  float R = velocityAt(vUv + vec2(texelSize.x, 0.0)).x;
  float B = velocityAt(vUv - vec2(0.0, texelSize.y)).y;
  float T = velocityAt(vUv + vec2(0.0, texelSize.y)).y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CURL_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
vec2 velocityAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec2(0.0);
  return texture(uVelocity, uv).xy;
}
void main() {
  float L = velocityAt(vUv - vec2(texelSize.x, 0.0)).y;
  float R = velocityAt(vUv + vec2(texelSize.x, 0.0)).y;
  float B = velocityAt(vUv - vec2(0.0, texelSize.y)).x;
  float T = velocityAt(vUv + vec2(0.0, texelSize.y)).x;
  outColor = vec4(R - L - T + B, 0.0, 0.0, 1.0);
}`;

const VORTICITY_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 texelSize;
uniform float curlStrength;
uniform float dt;
void main() {
  float L = abs(texture(uCurl, vUv - vec2(texelSize.x, 0.0)).x);
  float R = abs(texture(uCurl, vUv + vec2(texelSize.x, 0.0)).x);
  float B = abs(texture(uCurl, vUv - vec2(0.0, texelSize.y)).x);
  float T = abs(texture(uCurl, vUv + vec2(0.0, texelSize.y)).x);
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(R - L, T - B);
  force /= length(force) + 0.0001;
  force *= curlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy + force * dt;
  outColor = vec4(clamp(velocity, vec2(-260.0), vec2(260.0)), 0.0, 1.0);
}`;

const PRESSURE_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 texelSize;
float pressureAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uPressure, uv).x;
}
void main() {
  float L = pressureAt(vUv - vec2(texelSize.x, 0.0));
  float R = pressureAt(vUv + vec2(texelSize.x, 0.0));
  float B = pressureAt(vUv - vec2(0.0, texelSize.y));
  float T = pressureAt(vUv + vec2(0.0, texelSize.y));
  float divergence = texture(uDivergence, vUv).x;
  outColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_SUBTRACT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
float pressureAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uPressure, uv).x;
}
void main() {
  float L = pressureAt(vUv - vec2(texelSize.x, 0.0));
  float R = pressureAt(vUv + vec2(texelSize.x, 0.0));
  float B = pressureAt(vUv - vec2(0.0, texelSize.y));
  float T = pressureAt(vUv + vec2(0.0, texelSize.y));
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= 0.5 * vec2(R - L, T - B);
  outColor = vec4(velocity, 0.0, 1.0);
}`;

const DISPLAY_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uTexture;
uniform vec2 texelSize;
uniform vec2 resolution;
uniform float exposure;
uniform float time;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec3 c = texture(uTexture, vUv).rgb;

  vec3 glow = vec3(0.0);
  glow += texture(uTexture, vUv + vec2( 2.0,  0.0) * texelSize).rgb;
  glow += texture(uTexture, vUv + vec2(-2.0,  0.0) * texelSize).rgb;
  glow += texture(uTexture, vUv + vec2( 0.0,  2.0) * texelSize).rgb;
  glow += texture(uTexture, vUv + vec2( 0.0, -2.0) * texelSize).rgb;
  glow *= 0.075;

  c += glow;
  c = 1.0 - exp(-c * exposure);
  c = pow(c, vec3(0.9));

  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float wallShadow = smoothstep(0.0, 0.035, edge);
  c *= 0.78 + 0.22 * wallShadow;

  float vignette = smoothstep(0.92, 0.20, distance(vUv, vec2(0.5)));
  c *= 0.82 + 0.18 * vignette;

  float grain = hash(vUv * resolution + time) - 0.5;
  c += grain * 0.012;

  outColor = vec4(max(c, 0.0), 1.0);
}
      `;

export const RAW_FLUID_CANVAS_Z_INDEX = '3';

export class GpuFluidTankRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext | null;
  private rng: SeededRng;
  private readonly textureFilter: number;
  private readonly programs = new Map<string, FluidProgram>();
  private readonly format: { internalFormat: number; format: number; type: number } | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private velocity: FluidDoubleTarget | null = null;
  private dye: FluidDoubleTarget | null = null;
  private pressure: FluidDoubleTarget | null = null;
  private divergence: FluidTarget | null = null;
  private curlTarget: FluidTarget | null = null;
  private options: GpuFluidTankOptions;
  private quality: RenderQuality;
  private supported = false;
  private width = 0;
  private height = 0;
  private elapsed = 0;
  private lastAmbient = 0;
  private splatCount = 0;
  private shaderSeed = 0;

  constructor(parent: HTMLElement, options: GpuFluidTankOptions, quality: RenderQuality = 'basic') {
    this.options = { ...options };
    this.quality = quality;
    this.rng = new SeededRng(options.seed);
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.background = '#020206';
    // Raw mode owns the visible fluid surface. Keep it above the shared Pixi
    // canvas; otherwise Pixi's opaque WebGL backbuffer can cover the raw WebGL
    // adapter and make `raw` appear to be the Pixi/basic renderer.
    this.canvas.style.zIndex = RAW_FLUID_CANVAS_Z_INDEX;
    this.canvas.dataset.pixiLabFluidRenderer = 'raw-webgl';
    parent.appendChild(this.canvas);

    this.gl = this.canvas.getContext('webgl2', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });

    if (!this.gl) {
      this.textureFilter = 0;
      return;
    }

    const colorBufferFloat = this.gl.getExtension('EXT_color_buffer_float');
    const linearFloat =
      this.gl.getExtension('OES_texture_float_linear') ||
      this.gl.getExtension('OES_texture_half_float_linear');
    if (!colorBufferFloat) {
      this.textureFilter = this.gl.NEAREST;
      return;
    }
    this.textureFilter = linearFloat ? this.gl.LINEAR : this.gl.NEAREST;
    this.format = {
      internalFormat: this.gl.RGBA16F,
      format: this.gl.RGBA,
      type: this.gl.HALF_FLOAT,
    };

    try {
      this.initializeGl();
      this.supported = true;
    } catch {
      this.supported = false;
    }
  }

  setQuality(quality: RenderQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.resize(this.width, this.height, true);
  }

  setOptions(options: Partial<GpuFluidTankOptions>): void {
    const previousCellSize = this.options.cellSize;
    const previousSeed = this.options.seed;
    this.options = { ...this.options, ...options };
    if (options.seed !== undefined && options.seed !== previousSeed) {
      this.rng = new SeededRng(options.seed);
    }
    if (options.cellSize !== undefined && options.cellSize !== previousCellSize) {
      this.resize(this.width, this.height, true);
      this.randomizeDye(this.options.seed);
    }
  }

  resize(width: number, height: number, force = false): void {
    if (!this.supported || !this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(2, Math.floor(width * dpr));
    const nextHeight = Math.max(2, Math.floor(height * dpr));
    if (!force && nextWidth === this.width && nextHeight === this.height) return;
    this.width = nextWidth;
    this.height = nextHeight;
    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.initFramebuffers();
    this.randomizeDye(this.options.seed);
  }

  randomizeDye(seed = this.options.seed + 1, seedMotion = true): void {
    if (!this.supported || !this.dye) return;
    this.options.seed = seed;
    this.rng = new SeededRng(seed);
    this.shaderSeed = seed;
    this.settleVelocity();
    this.initDyeField();
    if (seedMotion) this.seedRestingMotion();
    this.splatCount = 0;
  }

  settleVelocity(): void {
    if (!this.supported || !this.velocity || !this.pressure || !this.divergence || !this.curlTarget) return;
    this.clearDoubleTarget(this.velocity);
    this.clearDoubleTarget(this.pressure);
    this.clearTarget(this.divergence, 0);
    this.clearTarget(this.curlTarget, 0);
  }

  splat(splat: FluidSplat): void {
    if (!this.supported || !this.velocity) return;
    const radius = this.options.fingerRadius * (splat.radiusScale ?? 1);
    this.applySplat(
      clamp01(splat.x),
      clamp01(1 - splat.y),
      splat.dx * this.options.fingerForce,
      -splat.dy * this.options.fingerForce,
      radius,
    );
    if (this.options.eddyAssist > 0) {
      this.applySplat(
        clamp01(splat.x),
        clamp01(1 - splat.y),
        splat.dy * this.options.fingerForce * this.options.eddyAssist,
        splat.dx * this.options.fingerForce * this.options.eddyAssist,
        radius * 1.35,
      );
    }
    this.splatCount += 1;
  }

  smallSwirl(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = randomBetween(this.rng, this.options.fingerRadius * 0.35, this.options.fingerRadius * 0.9);
      this.splat({
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        dx: -Math.sin(angle) * 0.55,
        dy: Math.cos(angle) * 0.55,
        radiusScale: 0.85,
      });
    }
  }

  update(dt: number): void {
    if (!this.supported) return;
    const safeDt = Math.min(dt, 0.032);
    this.elapsed += safeDt;
    this.ambientStir();
    this.step(safeDt);
  }

  render(): void {
    if (!this.supported || !this.gl || !this.dye) return;
    const source = this.getDisplayTarget();
    if (!source) return;
    const program = this.requireProgram('display');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uTexture, source.attach(0));
    this.gl.uniform2f(program.uniforms.texelSize, 1 / source.width, 1 / source.height);
    this.gl.uniform2f(program.uniforms.resolution, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    this.gl.uniform1f(program.uniforms.exposure, this.options.exposure);
    this.gl.uniform1f(program.uniforms.time, this.elapsed);
    this.blit(null);
  }

  private getDisplayTarget(): FluidTarget | null {
    switch (this.options.displayMode ?? 'dye') {
      case 'velocity':
        return this.velocity?.read ?? null;
      case 'curl':
        return this.curlTarget ?? null;
      case 'divergence':
        return this.divergence ?? null;
      case 'pressure':
        return this.pressure?.read ?? null;
      case 'dye':
      default:
        return this.dye?.read ?? null;
    }
  }

  stats(): GpuFluidTankStats {
    return {
      supported: this.supported,
      simWidth: this.velocity?.width ?? 0,
      simHeight: this.velocity?.height ?? 0,
      dyeWidth: this.dye?.width ?? 0,
      dyeHeight: this.dye?.height ?? 0,
      splats: this.splatCount,
    };
  }

  destroy(): void {
    this.disposeFramebuffers();
    if (this.gl) {
      for (const entry of Array.from(this.programs.values())) {
        this.gl.deleteProgram(entry.program);
      }
      if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
      if (this.quadVao) this.gl.deleteVertexArray(this.quadVao);
    }
    this.canvas.remove();
  }

  private initializeGl(): void {
    if (!this.gl) return;
    this.gl.disable(this.gl.BLEND);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.programs.set('clear', this.createProgram(CLEAR_SHADER));
    this.programs.set('initDye', this.createProgram(INIT_DYE_SHADER));
    this.programs.set('splat', this.createProgram(SPLAT_SHADER));
    this.programs.set('advection', this.createProgram(ADVECTION_SHADER));
    this.programs.set('boundary', this.createProgram(BOUNDARY_SHADER));
    this.programs.set('divergence', this.createProgram(DIVERGENCE_SHADER));
    this.programs.set('curl', this.createProgram(CURL_SHADER));
    this.programs.set('vorticity', this.createProgram(VORTICITY_SHADER));
    this.programs.set('pressure', this.createProgram(PRESSURE_SHADER));
    this.programs.set('gradientSubtract', this.createProgram(GRADIENT_SUBTRACT_SHADER));
    this.programs.set('display', this.createProgram(DISPLAY_SHADER));
    this.quadVao = this.gl.createVertexArray();
    this.quadBuffer = this.gl.createBuffer();
    if (!this.quadVao || !this.quadBuffer) throw new Error('Failed to create fluid quad');
    this.gl.bindVertexArray(this.quadVao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(0);
    this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.bindVertexArray(null);
  }

  private initFramebuffers(): void {
    if (!this.gl) return;
    this.disposeFramebuffers();
    const simResolution = this.getResolution(Math.round(clamp(BASE_SIM_RESOLUTION / this.options.cellSize, 90, 260)));
    const dyeResolution = this.getResolution(Math.round(clamp(BASE_DYE_RESOLUTION / this.options.cellSize, 300, 1200)));
    this.velocity = this.createDoubleTarget(simResolution.width, simResolution.height, this.textureFilter);
    this.dye = this.createDoubleTarget(dyeResolution.width, dyeResolution.height, this.textureFilter);
    this.pressure = this.createDoubleTarget(simResolution.width, simResolution.height, this.gl.NEAREST);
    this.divergence = this.createTarget(simResolution.width, simResolution.height, this.gl.NEAREST);
    this.curlTarget = this.createTarget(simResolution.width, simResolution.height, this.gl.NEAREST);
    this.clearDoubleTarget(this.velocity);
    this.clearDoubleTarget(this.pressure);
    this.clearTarget(this.divergence, 0);
    this.clearTarget(this.curlTarget, 0);
  }

  private initDyeField(): void {
    if (!this.gl || !this.dye) return;
    const program = this.requireProgram('initDye');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.resolution, this.dye.width, this.dye.height);
    this.gl.uniform1f(program.uniforms.seed, this.shaderSeed);
    this.gl.uniform1f(program.uniforms.cellSize, this.options.cellSize);
    this.blit(this.dye.read);
    this.blit(this.dye.write);
  }

  private step(dt: number): void {
    if (!this.gl || !this.velocity || !this.dye || !this.pressure || !this.divergence || !this.curlTarget) return;
    this.gl.disable(this.gl.BLEND);

    let program = this.requireProgram('curl');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.blit(this.curlTarget);

    if (this.options.curl > 0) {
      program = this.requireProgram('vorticity');
      this.bind(program);
      this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
      this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
      this.gl.uniform1i(program.uniforms.uCurl, this.curlTarget.attach(1));
      this.gl.uniform1f(program.uniforms.curlStrength, this.options.curl);
      this.gl.uniform1f(program.uniforms.dt, dt);
      this.blit(this.velocity.write);
      this.velocity.swap();
      this.enforceVelocityBoundary();
    }

    program = this.requireProgram('divergence');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.blit(this.divergence);

    this.clearDoubleTarget(this.pressure);
    program = this.requireProgram('pressure');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.pressure.width, 1 / this.pressure.height);
    this.gl.uniform1i(program.uniforms.uDivergence, this.divergence.attach(1));
    for (let i = 0; i < this.options.pressureIterations; i++) {
      this.gl.uniform1i(program.uniforms.uPressure, this.pressure.read.attach(0));
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    program = this.requireProgram('gradientSubtract');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uPressure, this.pressure.read.attach(0));
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(1));
    this.blit(this.velocity.write);
    this.velocity.swap();
    this.enforceVelocityBoundary();

    program = this.requireProgram('advection');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.gl.uniform1i(program.uniforms.uSource, this.velocity.read.attach(1));
    this.gl.uniform1f(program.uniforms.dt, dt);
    this.gl.uniform1f(program.uniforms.dissipation, VELOCITY_DISSIPATION);
    this.blit(this.velocity.write);
    this.velocity.swap();
    this.enforceVelocityBoundary();

    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.gl.uniform1i(program.uniforms.uSource, this.dye.read.attach(1));
    this.gl.uniform1f(program.uniforms.dt, dt);
    this.gl.uniform1f(program.uniforms.dissipation, this.options.dyePersistence);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  private applySplat(x: number, y: number, vx: number, vy: number, radius: number): void {
    if (!this.gl || !this.velocity) return;
    const program = this.requireProgram('splat');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uTarget, this.velocity.read.attach(0));
    this.gl.uniform1f(program.uniforms.aspectRatio, this.velocity.width / this.velocity.height);
    this.gl.uniform3f(program.uniforms.color, vx, vy, 0);
    this.gl.uniform2f(program.uniforms.point, x, y);
    this.gl.uniform1f(program.uniforms.radius, radius * radius);
    this.blit(this.velocity.write);
    this.velocity.swap();
  }

  private enforceVelocityBoundary(): void {
    if (!this.gl || !this.velocity) return;
    const program = this.requireProgram('boundary');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1f(program.uniforms.wallDamping, 0.08);
    this.blit(this.velocity.write);
    this.velocity.swap();
  }

  private seedRestingMotion(): void {
    for (let i = 0; i < 7; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      this.splat({
        x: this.rng.next(),
        y: this.rng.next(),
        dx: Math.cos(angle) * randomBetween(this.rng, 0.35, 0.75),
        dy: Math.sin(angle) * randomBetween(this.rng, 0.35, 0.75),
        radiusScale: randomBetween(this.rng, 1.4, 2.4),
      });
    }
    this.splatCount = 0;
  }

  private ambientStir(): void {
    if (!this.options.ambient || this.elapsed - this.lastAmbient < 0.28) return;
    this.lastAmbient = this.elapsed;
    for (let i = 0; i < 2; i++) {
      const phase = i * Math.PI;
      const t = this.elapsed;
      this.splat({
        x: 0.5 + Math.sin(t * 0.31 + phase) * 0.28,
        y: 0.5 + Math.cos(t * 0.27 + phase * 1.3) * 0.24,
        dx: Math.cos(t * 0.71 + phase) * 0.5,
        dy: Math.sin(t * 0.63 + phase) * 0.5,
        radiusScale: 2,
      });
    }
  }

  private clearDoubleTarget(target: FluidDoubleTarget): void {
    this.clearTarget(target.read, 0);
    this.clearTarget(target.write, 0);
  }

  private clearTarget(target: FluidTarget, value: number): void {
    if (!this.gl) return;
    const program = this.requireProgram('clear');
    this.bind(program);
    this.gl.uniform1f(program.uniforms.value, value);
    this.blit(target);
  }

  private blit(target: FluidTarget | null): void {
    if (!this.gl || !this.quadVao) return;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target ? target.fbo : null);
    this.gl.viewport(0, 0, target ? target.width : this.gl.drawingBufferWidth, target ? target.height : this.gl.drawingBufferHeight);
    this.gl.bindVertexArray(this.quadVao);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
    this.gl.bindVertexArray(null);
  }

  private createTarget(width: number, height: number, filter: number): FluidTarget {
    if (!this.gl || !this.format) throw new Error('Fluid renderer unavailable');
    const gl = this.gl;
    const texture = gl.createTexture();
    const fbo = gl.createFramebuffer();
    if (!texture || !fbo) throw new Error('Failed to allocate fluid target');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.format.internalFormat, width, height, 0, this.format.format, this.format.type, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Fluid framebuffer is incomplete');
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
      texture,
      fbo,
      width,
      height,
      attach(unit: number): number {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return unit;
      },
      dispose(): void {
        gl.deleteTexture(texture);
        gl.deleteFramebuffer(fbo);
      },
    };
  }

  private createDoubleTarget(width: number, height: number, filter: number): FluidDoubleTarget {
    let read = this.createTarget(width, height, filter);
    let write = this.createTarget(width, height, filter);
    return {
      get read() {
        return read;
      },
      get write() {
        return write;
      },
      width,
      height,
      swap(): void {
        const previous = read;
        read = write;
        write = previous;
      },
      dispose(): void {
        read.dispose();
        write.dispose();
      },
    };
  }

  private disposeFramebuffers(): void {
    this.velocity?.dispose();
    this.dye?.dispose();
    this.pressure?.dispose();
    this.divergence?.dispose();
    this.curlTarget?.dispose();
    this.velocity = null;
    this.dye = null;
    this.pressure = null;
    this.divergence = null;
    this.curlTarget = null;
  }

  private createProgram(fragmentSource: string): FluidProgram {
    if (!this.gl) throw new Error('Fluid renderer unavailable');
    const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, BASE_VERTEX_SHADER);
    const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.gl.createProgram();
    if (!program) throw new Error('Failed to create fluid shader program');
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const message = this.gl.getProgramInfoLog(program) ?? 'Unknown fluid program link error';
      this.gl.deleteProgram(program);
      throw new Error(message);
    }
    return { program, uniforms: this.getUniforms(program) };
  }

  private compileShader(type: number, source: string): WebGLShader {
    if (!this.gl) throw new Error('Fluid renderer unavailable');
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Failed to create fluid shader');
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const message = this.gl.getShaderInfoLog(shader) ?? 'Unknown fluid shader compile error';
      this.gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  private getUniforms(program: WebGLProgram): Record<string, WebGLUniformLocation | null> {
    if (!this.gl) return {};
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const count = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const uniform: WebGLActiveInfo | null = this.gl.getActiveUniform(program, i);
      if (!uniform) continue;
      const name = uniform.name.replace(/\[0\]$/, '');
      uniforms[name] = this.gl.getUniformLocation(program, name);
    }
    return uniforms;
  }

  private bind(program: FluidProgram): void {
    this.gl?.useProgram(program.program);
  }

  private requireProgram(name: string): FluidProgram {
    const program = this.programs.get(name);
    if (!program) throw new Error(`Missing fluid program: ${name}`);
    return program;
  }


  private getResolution(baseResolution: number): { width: number; height: number } {
    const aspect = this.height > 0 ? Math.max(this.width / this.height, this.height / this.width) : 1;
    const min = Math.round(baseResolution);
    const max = Math.round(baseResolution * aspect);
    return this.width > this.height ? { width: max, height: min } : { width: min, height: max };
  }
}

export function velocityFromScreenDelta(
  dx: number,
  dy: number,
  width: number,
  height: number,
  simWidth: number,
  simHeight: number,
): { dx: number; dy: number } {
  let vx = (dx / Math.max(1, width)) * simWidth;
  let vy = (dy / Math.max(1, height)) * simHeight;
  const magnitude = Math.hypot(vx, vy);
  if (magnitude > MAX_VELOCITY_CELLS) {
    const scale = MAX_VELOCITY_CELLS / magnitude;
    vx *= scale;
    vy *= scale;
  }
  return { dx: vx, dy: vy };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0.001, 0.999);
}

function randomBetween(rng: SeededRng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}
