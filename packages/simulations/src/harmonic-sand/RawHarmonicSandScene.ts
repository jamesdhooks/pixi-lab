import { RawWebGL2Scene, colorNumberToRgb, finiteNumberSetting, type RawWebGL2RenderState } from '@hooksjam/pixi-lab-core';

const markup = '<canvas data-harmonic-sand-raw class="absolute inset-0 h-full w-full touch-none"></canvas><div class="pointer-events-none absolute left-4 top-4 rounded-full border border-amber-200/25 bg-black/35 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-amber-100/80 backdrop-blur">WebGL2 raw plate</div>';

const vertexSource = `#version 300 es
precision highp float;
const vec2 POSITIONS[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
out vec2 vUv;
void main() {
  vec2 position = POSITIONS[gl_VertexID];
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBaseFrequency;
uniform float uParticleDensity;
uniform float uLineSharpness;
uniform float uGlow;
uniform float uWaveMix;
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uBackground;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float waveField(vec2 p, float t) {
  float f = max(0.1, uBaseFrequency);
  float orthogonal = sin((p.x * f + 0.19 * sin(t * 0.31)) * 3.14159) * sin((p.y * (f * 1.37) - 0.17 * cos(t * 0.27)) * 3.14159);
  vec2 c1 = p - vec2(0.34 * sin(t * 0.17), 0.26 * cos(t * 0.21));
  vec2 c2 = p + vec2(0.29 * cos(t * 0.13), 0.31 * sin(t * 0.19));
  float radial = sin(length(c1) * f * 7.4 - t * 0.95) * cos(length(c2) * f * 5.9 + t * 0.63);
  return mix(orthogonal, radial, clamp(uWaveMix, 0.0, 1.0));
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = (uv - 0.5) * 2.0 * aspect;
  float t = uTime;
  float field = waveField(p, t);
  float nodal = exp(-abs(field) * mix(14.0, 46.0, clamp(uLineSharpness / 3.5, 0.0, 1.0)));
  float harmonic = waveField(p * 1.73 + 0.21 * sin(t * 0.2), t * 0.72);
  nodal += 0.45 * exp(-abs(harmonic) * 34.0 * uLineSharpness);
  nodal = clamp(nodal, 0.0, 1.0);

  float grainScale = mix(210.0, 760.0, clamp(uParticleDensity / 2.5, 0.0, 1.0));
  vec2 grid = floor(uv * grainScale);
  float grain = hash(grid + floor(t * 18.0));
  float sparkle = smoothstep(0.72, 1.0, grain) * nodal;
  float micro = hash(grid * 1.618 + 7.0);

  float vignette = smoothstep(1.24, 0.18, length((uv - 0.5) * vec2(aspect.x, 1.0)));
  vec3 sand = mix(uPaletteA, uPaletteB, smoothstep(0.1, 1.0, nodal));
  sand = mix(sand, uPaletteC, sparkle * 0.85);
  vec3 glow = sand * nodal * uGlow * 1.65;
  vec3 base = uBackground * (0.34 + 0.22 * vignette);
  vec3 color = base + glow + sand * nodal * (0.45 + micro * 0.38) + vec3(sparkle) * 1.4;
  color += 0.08 * vec3(0.9, 0.72, 0.38) * sin((field + harmonic) * 8.0 + t);
  color *= 0.55 + 0.65 * vignette;
  fragColor = vec4(pow(max(color, vec3(0.0)), vec3(0.88)), 1.0);
}`;

interface HarmonicSandUniforms {
  resolution: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  baseFrequency: WebGLUniformLocation | null;
  particleDensity: WebGLUniformLocation | null;
  lineSharpness: WebGLUniformLocation | null;
  glow: WebGLUniformLocation | null;
  waveMix: WebGLUniformLocation | null;
  paletteA: WebGLUniformLocation | null;
  paletteB: WebGLUniformLocation | null;
  paletteC: WebGLUniformLocation | null;
  background: WebGLUniformLocation | null;
}

const uniformCache = new WeakMap<WebGLProgram, HarmonicSandUniforms>();

function requireProgram(state: RawWebGL2RenderState): WebGLProgram | null {
  return state.program;
}

function initUniforms(state: RawWebGL2RenderState): void {
  const { gl } = state;
  const program = requireProgram(state);
  if (!program) return;
  uniformCache.set(program, {
    resolution: gl.getUniformLocation(program, 'uResolution'),
    time: gl.getUniformLocation(program, 'uTime'),
    baseFrequency: gl.getUniformLocation(program, 'uBaseFrequency'),
    particleDensity: gl.getUniformLocation(program, 'uParticleDensity'),
    lineSharpness: gl.getUniformLocation(program, 'uLineSharpness'),
    glow: gl.getUniformLocation(program, 'uGlow'),
    waveMix: gl.getUniformLocation(program, 'uWaveMix'),
    paletteA: gl.getUniformLocation(program, 'uPaletteA'),
    paletteB: gl.getUniformLocation(program, 'uPaletteB'),
    paletteC: gl.getUniformLocation(program, 'uPaletteC'),
    background: gl.getUniformLocation(program, 'uBackground'),
  });
}

function renderHarmonicSand(state: RawWebGL2RenderState): void {
  const { gl, vao, canvas, settings, style } = state;
  const program = requireProgram(state);
  if (!program) return;
  const uniforms = uniformCache.get(program);
  if (!uniforms) return;
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  const palette = style?.palette ?? [];
  const a = colorNumberToRgb(palette[0], [1.0, 0.78, 0.35]);
  const b = colorNumberToRgb(palette[1], [0.18, 0.82, 1.0]);
  const c = colorNumberToRgb(palette[2], [1.0, 0.28, 0.62]);
  const bg = colorNumberToRgb(style?.background, [0.015, 0.012, 0.025]);

  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.time, state.timeSeconds);
  gl.uniform1f(uniforms.baseFrequency, finiteNumberSetting(settings, 'baseFrequency', 2.4));
  gl.uniform1f(uniforms.particleDensity, finiteNumberSetting(settings, 'rawParticleDensity', 1.25));
  gl.uniform1f(uniforms.lineSharpness, finiteNumberSetting(settings, 'rawLineSharpness', 1.8));
  gl.uniform1f(uniforms.glow, finiteNumberSetting(settings, 'rawGlow', 1.35));
  gl.uniform1f(uniforms.waveMix, finiteNumberSetting(settings, 'rawWaveMix', 0.42));
  gl.uniform3fv(uniforms.paletteA, a);
  gl.uniform3fv(uniforms.paletteB, b);
  gl.uniform3fv(uniforms.paletteC, c);
  gl.uniform3fv(uniforms.background, bg);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export class RawHarmonicSandScene extends RawWebGL2Scene {
  constructor() {
    super({
      name: 'RawHarmonicSand',
      markup,
      canvasSelector: 'canvas[data-harmonic-sand-raw]',
      sources: { vertex: vertexSource, fragment: fragmentSource },
      unsupportedMarkup: '<div class="grid h-full place-items-center bg-black text-sm text-amber-100">WebGL2 is required for the raw Harmonic Sand engine.</div>',
      onInit: initUniforms,
      render: renderHarmonicSand,
    });
  }
}
