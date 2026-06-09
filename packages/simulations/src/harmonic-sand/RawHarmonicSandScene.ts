import { RawWebGL2Scene, colorNumberToRgb, finiteNumberSetting, type GestureEvent, type RawWebGL2RenderState } from '@hooksjam/pixi-lab-core';

const MAX_RAW_EMITTERS = 16;
const DOUBLE_TAP_MS = 320;
const DRAG_PICK_RADIUS = 0.18;

type RawEmitter = {
  x: number;
  y: number;
  frequency: number;
  phase: number;
  amplitude: number;
};

type RawInteractionState = {
  emitters: RawEmitter[];
  queuedGestures: GestureEvent[];
  activePointerId: number | null;
  draggingIndex: number | null;
  lastTapAt: number;
};

const markup = '<canvas data-harmonic-sand-raw class="absolute inset-0 h-full w-full touch-none cursor-crosshair"></canvas>';

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
#define MAX_EMITTERS 16
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uResolution;
uniform float uFieldResolution;
uniform float uTime;
uniform float uBaseFrequency;
uniform float uParticleDensity;
uniform float uParticleCount;
uniform float uLineSharpness;
uniform float uGlow;
uniform float uMarkerVisibility;
uniform int uEmitterCount;
uniform vec4 uEmitters[MAX_EMITTERS];
uniform float uEmitterAmplitudes[MAX_EMITTERS];
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uBackground;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float sourceField(vec2 p, float t) {
  float field = 0.0;
  for (int i = 0; i < MAX_EMITTERS; i++) {
    if (i >= uEmitterCount) break;
    vec4 e = uEmitters[i];
    vec2 delta = p - e.xy;
    float radius = max(1.0, length(delta) * uFieldResolution * 0.5);
    float frequency = e.z * max(0.05, uBaseFrequency / 2.4);
    field += sin(radius * 0.035 * frequency - t * frequency + e.w) * uEmitterAmplitudes[i];
  }
  return field / max(1.0, float(uEmitterCount));
}

float basePlateField(vec2 p, float t) {
  float f = max(0.1, uBaseFrequency);
  float radius = max(1.0, length(p) * uFieldResolution * 0.5);
  return sin(radius * 0.035 * f - t * f);
}

float waveField(vec2 p, float t) {
  if (uEmitterCount > 0) return sourceField(p, t);
  return basePlateField(p, t);
}

float sourceMarker(vec2 p) {
  float marker = 0.0;
  for (int i = 0; i < MAX_EMITTERS; i++) {
    if (i >= uEmitterCount) break;
    vec2 delta = p - uEmitters[i].xy;
    float d = length(delta);
    marker += smoothstep(0.034, 0.009, d) + 0.35 * smoothstep(0.055, 0.038, abs(d - 0.046));
  }
  return clamp(marker, 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = vec2((uv.x - 0.5) * 2.0 * aspect.x, (0.5 - uv.y) * 2.0);
  float t = uTime;
  float field = waveField(p, t);
  float sharpness = max(0.05, uLineSharpness);
  float particleBudget = clamp((uParticleCount - 25000.0) / 1975000.0, 0.0, 1.0);
  float density = clamp(uParticleDensity, 0.05, 8.0);
  float nodal = exp(-abs(field) * mix(10.0, 58.0, clamp(sharpness / 3.5, 0.0, 1.0)));
  nodal = clamp(nodal, 0.0, 1.0);

  float resolutionScale = clamp(uFieldResolution / 128.0, 0.25, 8.0);
  float grainScale = mix(130.0, 2300.0, particleBudget) * mix(0.55, 2.25, clamp(density / 8.0, 0.0, 1.0)) * sqrt(resolutionScale);
  vec2 grid = floor(uv * grainScale);
  float grain = hash(grid + floor(t * mix(6.0, 28.0, particleBudget)));
  float occupancy = mix(0.18, 1.0, particleBudget) * density;
  float sparkle = smoothstep(mix(0.96, 0.36, clamp(occupancy / 3.0, 0.0, 1.0)), 1.0, grain) * nodal;
  float micro = hash(grid * 1.618 + 7.0);
  float markers = sourceMarker(p) * uMarkerVisibility;

  float vignette = smoothstep(1.24, 0.18, length((uv - 0.5) * vec2(aspect.x, 1.0)));

  // Map the harmonic scalar field itself across the full style palette.  Nodal
  // intensity and particles shape contrast only; they must not collapse the
  // plate back into colored lines over a black background.
  float harmonicValue = clamp(0.5 + 0.5 * field, 0.0, 1.0);
  harmonicValue = pow(harmonicValue, 0.82);
  vec3 lowBand = mix(uPaletteA, uPaletteB, smoothstep(0.0, 0.34, harmonicValue));
  vec3 highBand = mix(uPaletteC, uPaletteD, smoothstep(0.66, 1.0, harmonicValue));
  vec3 sand = mix(lowBand, highBand, smoothstep(0.28, 0.78, harmonicValue));

  float bandContrast = 0.58 + 0.34 * nodal + 0.18 * sparkle + 0.10 * micro;
  float glowContrast = 1.0 + nodal * uGlow * mix(0.18, 0.42, particleBudget);
  vec3 color = sand * bandContrast * glowContrast;
  color = mix(color, uPaletteD, sparkle * mix(0.12, 0.32, particleBudget));
  color = mix(color, mix(uPaletteC, uPaletteD, 0.5 + 0.5 * sin(t * 2.0)), markers * (0.62 + 0.28 * nodal));
  color *= 0.72 + 0.38 * vignette;
  fragColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(0.88)), 1.0);
}`;

interface HarmonicSandUniforms {
  resolution: WebGLUniformLocation | null;
  fieldResolution: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  baseFrequency: WebGLUniformLocation | null;
  particleDensity: WebGLUniformLocation | null;
  particleCount: WebGLUniformLocation | null;
  lineSharpness: WebGLUniformLocation | null;
  glow: WebGLUniformLocation | null;
  markerVisibility: WebGLUniformLocation | null;
  emitterCount: WebGLUniformLocation | null;
  emitters: WebGLUniformLocation | null;
  emitterAmplitudes: WebGLUniformLocation | null;
  paletteA: WebGLUniformLocation | null;
  paletteB: WebGLUniformLocation | null;
  paletteC: WebGLUniformLocation | null;
  paletteD: WebGLUniformLocation | null;
  background: WebGLUniformLocation | null;
}

type RawVisibilityState = {
  uiHidden: boolean;
  demoModeActive: boolean;
};

const uniformCache = new WeakMap<WebGLProgram, HarmonicSandUniforms>();
const interactionCache = new WeakMap<HTMLCanvasElement, RawInteractionState>();
const cleanupCache = new WeakMap<HTMLCanvasElement, () => void>();
const visibilityCache = new WeakMap<HTMLCanvasElement, RawVisibilityState>();
let activeRawState: RawWebGL2RenderState | null = null;

function requireProgram(state: RawWebGL2RenderState): WebGLProgram | null {
  return state.program;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sourceLimit(settings: Record<string, unknown>): number {
  return clamp(Math.round(finiteNumberSetting(settings, 'rawEmitterLimit', 10)), 1, MAX_RAW_EMITTERS);
}

function createInitialEmitters(settings: Record<string, unknown>): RawEmitter[] {
  const limit = sourceLimit(settings);
  return [
    { x: -0.44, y: -0.22, frequency: 2.6, phase: 0.2, amplitude: 1 },
    { x: 0.36, y: -0.1, frequency: 3.1, phase: 2.4, amplitude: 1 },
    { x: -0.02, y: 0.38, frequency: 2.2, phase: 4.1, amplitude: 0.9 },
  ].slice(0, limit);
}

function canvasToPlate(canvas: HTMLCanvasElement, event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const nx = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
  const ny = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
  const aspect = rect.height > 0 ? rect.width / rect.height : 1;
  return {
    x: clamp((nx - 0.5) * 2 * aspect, -aspect, aspect),
    y: clamp((ny - 0.5) * 2, -1, 1),
  };
}

function gestureToPlate(canvas: HTMLCanvasElement, x: number, y: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width > 0 ? rect.width : canvas.width;
  const cssHeight = rect.height > 0 ? rect.height : canvas.height;
  const aspect = cssHeight > 0 ? cssWidth / cssHeight : 1;
  const nx = x > 1 || y > 1 ? x / Math.max(1, cssWidth) : x;
  const ny = x > 1 || y > 1 ? y / Math.max(1, cssHeight) : y;
  return {
    x: clamp((nx - 0.5) * 2 * aspect, -aspect, aspect),
    y: clamp((ny - 0.5) * 2, -1, 1),
  };
}

function nearestEmitter(emitters: RawEmitter[], point: { x: number; y: number }): number | null {
  let bestIndex: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  emitters.forEach((emitter, index) => {
    const distance = Math.hypot(emitter.x - point.x, emitter.y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestDistance <= DRAG_PICK_RADIUS ? bestIndex : null;
}

function upsertEmitter(interaction: RawInteractionState, settings: Record<string, unknown>, point: { x: number; y: number }): number {
  const existing = nearestEmitter(interaction.emitters, point);
  if (existing !== null) return existing;
  const limit = sourceLimit(settings);
  const phase = (point.x * 5.1 + point.y * 3.7 + interaction.emitters.length * 1.9) % (Math.PI * 2);
  const frequency = finiteNumberSetting(settings, 'baseFrequency', 2.4) * (0.82 + (interaction.emitters.length % 5) * 0.08);
  if (interaction.emitters.length >= limit) interaction.emitters.shift();
  interaction.emitters.push({ x: point.x, y: point.y, frequency, phase, amplitude: 1 });
  return interaction.emitters.length - 1;
}

function applyGesture(interaction: RawInteractionState, settings: Record<string, unknown>, canvas: HTMLCanvasElement, gesture: GestureEvent): void {
  const point = gestureToPlate(canvas, gesture.x, gesture.y);
  if (gesture.kind === 'double_tap') {
    const nearest = nearestEmitter(interaction.emitters, point);
    if (nearest !== null) interaction.emitters.splice(nearest, 1);
    return;
  }
  if (gesture.kind !== 'tap' && gesture.kind !== 'hold' && gesture.kind !== 'drag') return;
  const index = upsertEmitter(interaction, settings, point);
  const emitter = interaction.emitters[index];
  if (emitter && gesture.kind === 'drag') {
    emitter.x = point.x;
    emitter.y = point.y;
  }
}

function flushQueuedGestures(interaction: RawInteractionState | undefined, settings: Record<string, unknown>, canvas: HTMLCanvasElement): void {
  if (!interaction || interaction.queuedGestures.length === 0) return;
  const gestures = interaction.queuedGestures.splice(0);
  gestures.forEach((gesture) => applyGesture(interaction, settings, canvas, gesture));
}

function attachInteractions(state: RawWebGL2RenderState): void {
  const { canvas } = state;
  const interaction: RawInteractionState = {
    emitters: createInitialEmitters(state.settings),
    queuedGestures: [],
    activePointerId: null,
    draggingIndex: null,
    lastTapAt: 0,
  };
  interactionCache.set(canvas, interaction);
  visibilityCache.set(canvas, { uiHidden: false, demoModeActive: false });

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    const point = canvasToPlate(canvas, event);
    const now = performance.now();
    const nearest = nearestEmitter(interaction.emitters, point);
    if (nearest !== null && now - interaction.lastTapAt <= DOUBLE_TAP_MS) {
      interaction.emitters.splice(nearest, 1);
      interaction.draggingIndex = null;
      interaction.lastTapAt = 0;
      return;
    }
    interaction.lastTapAt = now;
    interaction.draggingIndex = upsertEmitter(interaction, state.settings, point);
    interaction.activePointerId = event.pointerId;
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events and some browser edge cases can reject capture.
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (interaction.activePointerId !== event.pointerId || interaction.draggingIndex === null) return;
    event.preventDefault();
    const emitter = interaction.emitters[interaction.draggingIndex];
    if (!emitter) return;
    const point = canvasToPlate(canvas, event);
    emitter.x = point.x;
    emitter.y = point.y;
  };

  const finishPointer = (event: PointerEvent) => {
    if (interaction.activePointerId === event.pointerId) {
      interaction.activePointerId = null;
      interaction.draggingIndex = null;
      try {
        canvas.releasePointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture may not exist for synthetic or already-finished events.
      }
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
  cleanupCache.set(canvas, () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', finishPointer);
    canvas.removeEventListener('pointercancel', finishPointer);
    interactionCache.delete(canvas);
  });
}

function initUniforms(state: RawWebGL2RenderState): void {
  activeRawState = state;
  const { gl } = state;
  const program = requireProgram(state);
  if (!program) return;
  uniformCache.set(program, {
    resolution: gl.getUniformLocation(program, 'uResolution'),
    fieldResolution: gl.getUniformLocation(program, 'uFieldResolution'),
    time: gl.getUniformLocation(program, 'uTime'),
    baseFrequency: gl.getUniformLocation(program, 'uBaseFrequency'),
    particleDensity: gl.getUniformLocation(program, 'uParticleDensity'),
    particleCount: gl.getUniformLocation(program, 'uParticleCount'),
    lineSharpness: gl.getUniformLocation(program, 'uLineSharpness'),
    glow: gl.getUniformLocation(program, 'uGlow'),
    markerVisibility: gl.getUniformLocation(program, 'uMarkerVisibility'),
    emitterCount: gl.getUniformLocation(program, 'uEmitterCount'),
    emitters: gl.getUniformLocation(program, 'uEmitters'),
    emitterAmplitudes: gl.getUniformLocation(program, 'uEmitterAmplitudes'),
    paletteA: gl.getUniformLocation(program, 'uPaletteA'),
    paletteB: gl.getUniformLocation(program, 'uPaletteB'),
    paletteC: gl.getUniformLocation(program, 'uPaletteC'),
    paletteD: gl.getUniformLocation(program, 'uPaletteD'),
    background: gl.getUniformLocation(program, 'uBackground'),
  });
  attachInteractions(state);
}

function resetRawPlate(state: RawWebGL2RenderState): void {
  const interaction = interactionCache.get(state.canvas);
  if (!interaction) return;
  interaction.emitters = createInitialEmitters(state.settings);
  interaction.queuedGestures = [];
  interaction.activePointerId = null;
  interaction.draggingIndex = null;
  interaction.lastTapAt = 0;
}

function syncEmitterLimit(state: RawWebGL2RenderState, change?: { key: string; value: unknown }): void {
  if (change?.key !== 'rawEmitterLimit') return;
  const interaction = interactionCache.get(state.canvas);
  if (!interaction) return;
  interaction.emitters = interaction.emitters.slice(-sourceLimit(state.settings));
}

function renderHarmonicSand(state: RawWebGL2RenderState): void {
  const { gl, vao, canvas, settings, style } = state;
  const program = requireProgram(state);
  if (!program) return;
  const uniforms = uniformCache.get(program);
  if (!uniforms) return;
  const interaction = interactionCache.get(canvas);
  flushQueuedGestures(interaction, settings, canvas);
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  const palette = style?.palette ?? [];
  const a = colorNumberToRgb(palette[0], [1.0, 0.78, 0.35]);
  const b = colorNumberToRgb(palette[1], [0.18, 0.82, 1.0]);
  const c = colorNumberToRgb(palette[2], [1.0, 0.28, 0.62]);
  const d = colorNumberToRgb(palette[3], [1.0, 1.0, 1.0]);
  const bg = colorNumberToRgb(style?.background, [0.015, 0.012, 0.025]);
  const emitterData = new Float32Array(MAX_RAW_EMITTERS * 4);
  const emitterAmplitudes = new Float32Array(MAX_RAW_EMITTERS);
  const emitters = interaction?.emitters ?? [];
  const visibility = visibilityCache.get(canvas) ?? { uiHidden: false, demoModeActive: false };
  emitters.slice(0, MAX_RAW_EMITTERS).forEach((emitter, index) => {
    const offset = index * 4;
    emitterData[offset] = emitter.x;
    emitterData[offset + 1] = emitter.y;
    emitterData[offset + 2] = emitter.frequency;
    emitterData[offset + 3] = emitter.phase;
    emitterAmplitudes[index] = emitter.amplitude;
  });

  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.fieldResolution, finiteNumberSetting(settings, 'resolution', 128));
  gl.uniform1f(uniforms.time, state.timeSeconds / Math.max(0.1, finiteNumberSetting(settings, 'wavePeriod', 1)));
  gl.uniform1f(uniforms.baseFrequency, finiteNumberSetting(settings, 'baseFrequency', 2.4));
  gl.uniform1f(uniforms.particleDensity, finiteNumberSetting(settings, 'rawParticleDensity', 1.25));
  gl.uniform1f(uniforms.particleCount, finiteNumberSetting(settings, 'rawParticleCount', 180000));
  gl.uniform1f(uniforms.lineSharpness, finiteNumberSetting(settings, 'rawLineSharpness', 1.8));
  gl.uniform1f(uniforms.glow, finiteNumberSetting(settings, 'rawGlow', 1.35));
  gl.uniform1f(uniforms.markerVisibility, visibility.uiHidden || visibility.demoModeActive ? 0 : 1);
  gl.uniform1i(uniforms.emitterCount, Math.min(emitters.length, MAX_RAW_EMITTERS));
  gl.uniform4fv(uniforms.emitters, emitterData);
  gl.uniform1fv(uniforms.emitterAmplitudes, emitterAmplitudes);
  gl.uniform3fv(uniforms.paletteA, a);
  gl.uniform3fv(uniforms.paletteB, b);
  gl.uniform3fv(uniforms.paletteC, c);
  gl.uniform3fv(uniforms.paletteD, d);
  gl.uniform3fv(uniforms.background, bg);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function destroyRawPlate(state: RawWebGL2RenderState): void {
  cleanupCache.get(state.canvas)?.();
  cleanupCache.delete(state.canvas);
  visibilityCache.delete(state.canvas);
  if (activeRawState?.canvas === state.canvas) activeRawState = null;
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
      onReset: resetRawPlate,
      onSettingsChange: syncEmitterLimit,
      render: renderHarmonicSand,
      onDestroy: destroyRawPlate,
    });
  }

  onUIHidden(hidden: boolean): void {
    if (!activeRawState) return;
    const visibility = visibilityCache.get(activeRawState.canvas) ?? { uiHidden: false, demoModeActive: false };
    visibility.uiHidden = hidden;
    visibilityCache.set(activeRawState.canvas, visibility);
  }

  setMode(mode: string): void {
    if (!activeRawState) return;
    const visibility = visibilityCache.get(activeRawState.canvas) ?? { uiHidden: false, demoModeActive: false };
    visibility.demoModeActive = mode === 'demo';
    visibilityCache.set(activeRawState.canvas, visibility);
  }

  pushGestures(gestures: GestureEvent[]): void {
    if (gestures.length === 0 || !activeRawState) return;
    const interaction = interactionCache.get(activeRawState.canvas);
    if (!interaction) return;
    interaction.queuedGestures.push(...gestures);
  }

  clearEmitters(): void {
    if (!activeRawState) return;
    const interaction = interactionCache.get(activeRawState.canvas);
    if (!interaction) return;
    interaction.emitters = [];
    interaction.queuedGestures = [];
    interaction.activePointerId = null;
    interaction.draggingIndex = null;
    interaction.lastTapAt = 0;
  }
}
