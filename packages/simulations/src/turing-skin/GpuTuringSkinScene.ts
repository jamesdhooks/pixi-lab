import {
  RawGpuFieldPass,
  RawPingPongRenderTarget,
  RawWebGL2Scene,
  colorNumberToRgb,
  createRawGpuSimulationMetrics,
  finiteNumberSetting,
  rawGpuMetricsToDebugStats,
  type RawGpuSimulationMetrics,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';
import { TURING_SKIN_DEFAULTS } from './turing-skin.config.js';

interface GpuTuringState extends RawWebGL2RenderState {
  target?: RawPingPongRenderTarget;
  seedPass?: RawGpuFieldPass;
  stepPass?: RawGpuFieldPass;
  splatPass?: RawGpuFieldPass;
  displayPass?: RawGpuFieldPass;
  resolution?: number;
  splats?: TuringSplat[];
  gpuMetrics?: RawGpuSimulationMetrics;
  paletteData?: Float32Array;
  cleanupPointer?: () => void;
  pointerId?: number;
  pointerDown?: boolean;
  previousPointer?: { x: number; y: number };
}

interface TuringSplat {
  x: number;
  y: number;
  radius: number;
  strength: number;
}

const VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aClip;
out vec2 vUv;
void main() {
  vUv = aClip * 0.5 + 0.5;
  gl_Position = vec4(aClip, 0.0, 1.0);
}`;

const SEED_FRAGMENT = `#version 300 es
precision highp float;
uniform int uPattern;
uniform float uSeed;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) {
  return fract(sin(dot(p + uSeed, vec2(127.1, 311.7))) * 43758.5453123);
}
void main() {
  float a = 1.0;
  float b = 0.0;
  if (uPattern == 1) {
    float wave = sin(vUv.x * 54.0 + vUv.y * 22.0 + sin(vUv.y * 19.0) * 1.9);
    if (wave > 0.52) {
      b = 0.44 + hash(vUv * 41.0) * 0.2;
      a = 0.72;
    }
  } else {
    vec2 cell = floor(vUv * vec2(18.0, 12.0));
    vec2 local = fract(vUv * vec2(18.0, 12.0)) - 0.5;
    float r = 0.18 + hash(cell) * 0.22;
    float activeValue = step(length(local), r) * step(0.55, hash(cell + 3.1));
    b = activeValue * (0.52 + hash(cell + 5.7) * 0.34);
    a = mix(1.0, 0.76, activeValue);
  }
  outColor = vec4(a, b, 0.0, 1.0);
}`;

const STEP_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uFeed;
uniform float uKill;
uniform float uDiffusionA;
uniform float uDiffusionB;
uniform float uDt;
in vec2 vUv;
out vec4 outColor;
vec2 readState(vec2 uv) {
  return texture(uState, uv).rg;
}
void main() {
  vec2 center = readState(vUv);
  float a = center.r;
  float b = center.g;
  float lapA = 0.0;
  float lapB = 0.0;
  vec2 n;
  n = readState(vUv + vec2(-uTexel.x, 0.0)); lapA += n.r * 0.2; lapB += n.g * 0.2;
  n = readState(vUv + vec2(uTexel.x, 0.0)); lapA += n.r * 0.2; lapB += n.g * 0.2;
  n = readState(vUv + vec2(0.0, -uTexel.y)); lapA += n.r * 0.2; lapB += n.g * 0.2;
  n = readState(vUv + vec2(0.0, uTexel.y)); lapA += n.r * 0.2; lapB += n.g * 0.2;
  n = readState(vUv + vec2(-uTexel.x, -uTexel.y)); lapA += n.r * 0.05; lapB += n.g * 0.05;
  n = readState(vUv + vec2(uTexel.x, -uTexel.y)); lapA += n.r * 0.05; lapB += n.g * 0.05;
  n = readState(vUv + vec2(-uTexel.x, uTexel.y)); lapA += n.r * 0.05; lapB += n.g * 0.05;
  n = readState(vUv + vec2(uTexel.x, uTexel.y)); lapA += n.r * 0.05; lapB += n.g * 0.05;
  lapA -= a;
  lapB -= b;
  float reaction = a * b * b;
  float nextA = a + (uDiffusionA * lapA - reaction + uFeed * (1.0 - a)) * uDt;
  float nextB = b + (uDiffusionB * lapB + reaction - (uKill + uFeed) * b) * uDt;
  outColor = vec4(clamp(nextA, 0.0, 1.2), clamp(nextB, 0.0, 1.4), reaction, 1.0);
}`;

const SPLAT_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uStrength;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 state = texture(uState, vUv);
  float d = distance(vUv, uPoint);
  float falloff = max(0.0, 1.0 - (d * d) / max(0.00001, uRadius * uRadius));
  state.g = clamp(state.g + falloff * uStrength * 0.66, 0.0, 1.25);
  state.r = clamp(state.r - max(0.0, uStrength) * falloff * 0.18, 0.0, 1.08);
  outColor = state;
}`;

const DISPLAY_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec3 uPalette[4];
uniform vec3 uBackground;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 state = texture(uState, vUv);
  float pigment = clamp(state.g, 0.0, 1.0);
  float reagent = clamp(1.0 - state.r * 0.7, 0.0, 1.0);
  float edge = clamp(abs(pigment - reagent), 0.0, 1.0);
  float body = smoothstep(0.08, 0.62, pigment);
  float rim = smoothstep(0.08, 0.42, edge) * (1.0 - smoothstep(0.55, 0.95, pigment));
  vec3 ground = mix(uBackground, uPalette[1] * 0.52, 0.58 + reagent * 0.18);
  vec3 color = mix(ground, uPalette[0], body);
  color = mix(color, uPalette[2], rim * 0.52);
  color += uPalette[3] * pow(pigment, 0.55) * 0.12;
  outColor = vec4(color, 1.0);
}`;

export class GpuTuringSkinScene extends RawWebGL2Scene {
  constructor(private readonly preview = false) {
    super({
      name: 'GpuTuringSkin',
      markup: '<canvas class="h-full w-full touch-none bg-slate-950"></canvas>',
      canvasSelector: 'canvas',
      maxDevicePixelRatio: preview ? 1.25 : 2,
      renderScale: () => preview ? 0.75 : 1,
      onInit: (rawState) => init(rawState as GpuTuringState, this.preview),
      onReset: (rawState) => reset(rawState as GpuTuringState, this.preview),
      onSettingsChange: (rawState, change) => {
        const state = rawState as GpuTuringState;
        if (change?.key === 'resolution' || change?.key === 'renderStyle') reset(state, this.preview);
      },
      render: (rawState) => render(rawState as GpuTuringState, this.preview),
      getDebugStats: (rawState) => gpuDebugStats(rawState as GpuTuringState),
      onDestroy: (rawState) => destroy(rawState as GpuTuringState),
    });
  }
}

function init(state: GpuTuringState, preview: boolean): void {
  const gl = state.gl;
  state.seedPass = new RawGpuFieldPass(gl, { vertex: VERTEX, fragment: SEED_FRAGMENT });
  state.stepPass = new RawGpuFieldPass(gl, { vertex: VERTEX, fragment: STEP_FRAGMENT });
  state.splatPass = new RawGpuFieldPass(gl, { vertex: VERTEX, fragment: SPLAT_FRAGMENT });
  state.displayPass = new RawGpuFieldPass(gl, { vertex: VERTEX, fragment: DISPLAY_FRAGMENT });
  state.splats = [];
  attachPointer(state);
  reset(state, preview);
}

function reset(state: GpuTuringState, preview: boolean): void {
  const gl = state.gl;
  const resolution = Math.floor(clamp(finiteNumberSetting(state.settings, 'resolution', Number(TURING_SKIN_DEFAULTS.resolution)), 48, preview ? 384 : 4096));
  const rows = Math.max(24, Math.round(resolution * Math.max(0.35, state.height / Math.max(1, state.width))));
  state.resolution = resolution;
  state.target?.destroy();
  state.target = new RawPingPongRenderTarget(state.resources, { width: resolution, height: rows, precision: 'half-float' });
  state.gpuMetrics = createRawGpuSimulationMetrics({
    engine: 'gpu-turing-skin',
    stateWidth: resolution,
    stateHeight: rows,
    stateTextures: 2,
    precision: 'half-float',
    passesPerFrame: preview ? 3 : 9,
    capabilities: state.resources.capabilities,
  });
  renderSeed(state);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function render(state: GpuTuringState, preview: boolean): void {
  if (!state.target || !state.stepPass || !state.splatPass || !state.displayPass) return;
  const gl = state.gl;
  const steps = Math.max(1, Math.min(preview ? 2 : 8, Math.ceil(state.deltaSeconds * 90)));
  const subDt = clamp((state.deltaSeconds * 60) / steps, 0.08, 1);
  for (let i = 0; i < steps; i += 1) renderStep(state, subDt);
  for (const splat of state.splats ?? []) renderSplat(state, splat);
  if (state.splats) state.splats.length = 0;
  gl.disable(gl.BLEND);
  state.displayPass.render({
    target: null,
    width: state.width,
    height: state.height,
    bind: (passGl, _program, uniform) => {
      bindTexture(passGl, state.target?.read.texture.texture ?? null, 0);
      uniform1i(passGl, uniform, 'uState', 0);
      passGl.uniform3fv(uniform('uPalette'), palette(state));
      passGl.uniform3fv(uniform('uBackground'), background(state));
    },
  });
}

function renderSeed(state: GpuTuringState): void {
  if (!state.target || !state.seedPass) return;
  const gl = state.gl;
  state.seedPass.render({
    target: state.target.read,
    width: state.target.width,
    height: state.target.height,
    bind: (_passGl, _program, uniform) => {
      uniform1i(gl, uniform, 'uPattern', state.settings.renderStyle === 'bands' ? 1 : 0);
      uniform1f(gl, uniform, 'uSeed', Math.random() * 1000);
    },
  });
}

function renderStep(state: GpuTuringState, dt: number): void {
  if (!state.target || !state.stepPass) return;
  const gl = state.gl;
  state.stepPass.render({
    target: state.target.write,
    width: state.target.width,
    height: state.target.height,
    bind: (_passGl, _program, uniform) => {
      bindTexture(gl, state.target?.read.texture.texture ?? null, 0);
      uniform1i(gl, uniform, 'uState', 0);
      gl.uniform2f(uniform('uTexel'), 1 / (state.target?.width ?? 1), 1 / (state.target?.height ?? 1));
      uniform1f(gl, uniform, 'uFeed', finiteNumberSetting(state.settings, 'feedRate', Number(TURING_SKIN_DEFAULTS.feedRate)));
      uniform1f(gl, uniform, 'uKill', finiteNumberSetting(state.settings, 'killRate', Number(TURING_SKIN_DEFAULTS.killRate)));
      uniform1f(gl, uniform, 'uDiffusionA', finiteNumberSetting(state.settings, 'diffusionA', Number(TURING_SKIN_DEFAULTS.diffusionA)));
      uniform1f(gl, uniform, 'uDiffusionB', finiteNumberSetting(state.settings, 'diffusionB', Number(TURING_SKIN_DEFAULTS.diffusionB)));
      uniform1f(gl, uniform, 'uDt', dt);
    },
  });
  state.target.swap();
}

function renderSplat(state: GpuTuringState, splat: TuringSplat): void {
  if (!state.target || !state.splatPass) return;
  const gl = state.gl;
  state.splatPass.render({
    target: state.target.write,
    width: state.target.width,
    height: state.target.height,
    bind: (_passGl, _program, uniform) => {
      bindTexture(gl, state.target?.read.texture.texture ?? null, 0);
      uniform1i(gl, uniform, 'uState', 0);
      gl.uniform2f(uniform('uPoint'), splat.x, splat.y);
      uniform1f(gl, uniform, 'uRadius', splat.radius);
      uniform1f(gl, uniform, 'uStrength', splat.strength);
    },
  });
  state.target.swap();
}

function attachPointer(state: GpuTuringState): void {
  const canvas = state.canvas;
  const local = (event: PointerEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((rect.bottom - event.clientY) / Math.max(1, rect.height), 0, 1),
    };
  };
  const addSplat = (point: { x: number; y: number }, kind: 'tap' | 'drag' | 'fast'): void => {
    const strength = finiteNumberSetting(state.settings, 'brushStrength', Number(TURING_SKIN_DEFAULTS.brushStrength)) * (state.mode === 'erase' ? -0.85 : 1) * (kind === 'fast' ? 1.35 : 1);
    const radius = kind === 'fast' ? 0.105 : kind === 'drag' ? 0.066 : 0.048;
    state.splats?.push({ x: point.x, y: point.y, radius, strength });
  };
  const down = (event: PointerEvent) => {
    const point = local(event);
    state.pointerDown = true;
    state.pointerId = event.pointerId;
    state.previousPointer = point;
    addSplat(point, 'tap');
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!state.pointerDown || event.pointerId !== state.pointerId) return;
    const point = local(event);
    const previous = state.previousPointer ?? point;
    const speed = Math.hypot(point.x - previous.x, point.y - previous.y);
    addSplat(point, speed > 0.08 ? 'fast' : 'drag');
    state.previousPointer = point;
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId === state.pointerId) {
      state.pointerDown = false;
      state.pointerId = undefined;
      state.previousPointer = undefined;
    }
    canvas.releasePointerCapture?.(event.pointerId);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  state.cleanupPointer = () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  };
}

function destroy(state: GpuTuringState): void {
  state.cleanupPointer?.();
  state.target?.destroy();
  state.seedPass?.destroy();
  state.stepPass?.destroy();
  state.splatPass?.destroy();
  state.displayPass?.destroy();
}

function gpuDebugStats(state: GpuTuringState): Record<string, string | number | boolean | null> | null {
  const metrics = state.gpuMetrics;
  if (!metrics) return null;
  return rawGpuMetricsToDebugStats(metrics);
}

function bindTexture(gl: WebGL2RenderingContext, texture: WebGLTexture | null, unit: number): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

function uniform1i(gl: WebGL2RenderingContext, uniform: (name: string) => WebGLUniformLocation | null, name: string, value: number): void {
  gl.uniform1i(uniform(name), value);
}

function uniform1f(gl: WebGL2RenderingContext, uniform: (name: string) => WebGLUniformLocation | null, name: string, value: number): void {
  gl.uniform1f(uniform(name), value);
}

function palette(state: GpuTuringState): Float32Array {
  const values = state.style?.palette ?? [0xffc857, 0x1f1300, 0xff7a1a, 0xfff2c2];
  const out = state.paletteData ?? (state.paletteData = new Float32Array(12));
  for (let i = 0; i < 4; i += 1) {
    const rgb = colorNumberToRgb(values[i], [1, 1, 1]);
    out[i * 3] = rgb[0];
    out[i * 3 + 1] = rgb[1];
    out[i * 3 + 2] = rgb[2];
  }
  return out;
}

function background(state: GpuTuringState): [number, number, number] {
  return colorNumberToRgb(state.style?.background, [0.02, 0.025, 0.055]);
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
