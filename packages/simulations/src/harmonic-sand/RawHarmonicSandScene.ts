import { RawWebGL2Scene, colorNumberToRgb, finiteNumberSetting, type GestureEvent, type RawWebGL2RenderState, type RenderQuality } from '@hooksjam/pixi-lab-core';

const MAX_RAW_EMITTERS = 16;
const DOUBLE_TAP_MS = 320;
const DRAG_PICK_RADIUS = 0.18;
const QUALITY_PROFILE_MAP: Record<RenderQuality, {
  particleScale: number;
  resolutionScale: number;
  densityScale: number;
  lineSharpnessScale: number;
  glowScale: number;
  renderScale: number;
  emitterLimitScale: number;
}> = {
  basic: {
    particleScale: 0.22,
    resolutionScale: 0.62,
    densityScale: 0.72,
    lineSharpnessScale: 0.82,
    glowScale: 0.72,
    renderScale: 0.68,
    emitterLimitScale: 0.6,
  },
  enhanced: {
    particleScale: 0.58,
    resolutionScale: 0.82,
    densityScale: 0.9,
    lineSharpnessScale: 0.92,
    glowScale: 0.9,
    renderScale: 0.84,
    emitterLimitScale: 0.8,
  },
  raw: {
    particleScale: 1,
    resolutionScale: 1,
    densityScale: 1,
    lineSharpnessScale: 1,
    glowScale: 1,
    renderScale: 1,
    emitterLimitScale: 1,
  },
};

const QUALITY_KEYS = Object.keys(QUALITY_PROFILE_MAP) as RenderQuality[];

function qualityProfile(quality: RenderQuality): typeof QUALITY_PROFILE_MAP[RenderQuality] {
  return QUALITY_PROFILE_MAP[QUALITY_KEYS.includes(quality) ? quality : 'raw'];
}

type RawEmitter = {
  x: number;
  y: number;
  frequency: number;
  phase: number;
  amplitude: number;
};

type RawInteractionState = {
  emitters: RawEmitter[];
  emitterData: Float32Array;
  emitterAmplitudes: Float32Array;
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
uniform int uRenderMode;
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

vec3 fieldPalette(float value, bool smoothPalette) {
  if (!smoothPalette) {
    if (value < 0.25) return uPaletteA;
    if (value < 0.50) return uPaletteB;
    if (value < 0.75) return uPaletteC;
    return uPaletteD;
  }
  vec3 lowBand = mix(uPaletteA, uPaletteB, smoothstep(0.0, 0.34, value));
  vec3 highBand = mix(uPaletteC, uPaletteD, smoothstep(0.66, 1.0, value));
  return mix(lowBand, highBand, smoothstep(0.28, 0.78, value));
}

vec2 fieldGridSize() {
  float columns = max(1.0, uFieldResolution);
  float rows = max(1.0, columns * uResolution.y / max(1.0, uResolution.x));
  return vec2(columns, rows);
}

vec2 platePointFromUv(vec2 sampleUv, vec2 aspect) {
  return vec2((sampleUv.x - 0.5) * 2.0 * aspect.x, (0.5 - sampleUv.y) * 2.0);
}

vec4 pixiFieldPixel(vec2 sampleUv, vec2 aspect, float t, bool smoothPalette, float gamma, float maxAlpha) {
  vec2 p = platePointFromUv(sampleUv, aspect);
  float value = pow(clamp(abs(waveField(p, t)), 0.0, 1.0), gamma);
  return vec4(fieldPalette(value, smoothPalette), value * maxAlpha);
}

vec4 pixiNearestField(vec2 uv, vec2 aspect, float t, bool smoothPalette, float gamma, float maxAlpha) {
  vec2 gridSize = fieldGridSize();
  vec2 cell = floor(clamp(uv, vec2(0.0), vec2(0.999999)) * gridSize);
  vec2 sampleUv = (cell + 0.5) / gridSize;
  return pixiFieldPixel(sampleUv, aspect, t, smoothPalette, gamma, maxAlpha);
}

vec4 pixiLinearField(vec2 uv, vec2 aspect, float t, bool smoothPalette, float gamma, float maxAlpha) {
  vec2 gridSize = fieldGridSize();
  vec2 texel = clamp(uv, vec2(0.0), vec2(0.999999)) * gridSize - 0.5;
  vec2 base = floor(texel);
  vec2 blend = smoothstep(vec2(0.0), vec2(1.0), fract(texel));
  vec2 uv00 = (clamp(base + vec2(0.0, 0.0), vec2(0.0), gridSize - 1.0) + 0.5) / gridSize;
  vec2 uv10 = (clamp(base + vec2(1.0, 0.0), vec2(0.0), gridSize - 1.0) + 0.5) / gridSize;
  vec2 uv01 = (clamp(base + vec2(0.0, 1.0), vec2(0.0), gridSize - 1.0) + 0.5) / gridSize;
  vec2 uv11 = (clamp(base + vec2(1.0, 1.0), vec2(0.0), gridSize - 1.0) + 0.5) / gridSize;
  vec4 c00 = pixiFieldPixel(uv00, aspect, t, smoothPalette, gamma, maxAlpha);
  vec4 c10 = pixiFieldPixel(uv10, aspect, t, smoothPalette, gamma, maxAlpha);
  vec4 c01 = pixiFieldPixel(uv01, aspect, t, smoothPalette, gamma, maxAlpha);
  vec4 c11 = pixiFieldPixel(uv11, aspect, t, smoothPalette, gamma, maxAlpha);
  return mix(mix(c00, c10, blend.x), mix(c01, c11, blend.x), blend.y);
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = vec2((uv.x - 0.5) * 2.0 * aspect.x, (0.5 - uv.y) * 2.0);
  float t = uTime;
  float field = waveField(p, t);
  float markers = sourceMarker(p) * uMarkerVisibility;

  if (uRenderMode < 2) {
    bool enhanced = uRenderMode == 1;
    float gamma = enhanced ? 0.45 : 0.65;
    float maxAlpha = enhanced ? 224.0 / 255.0 : 200.0 / 255.0;
    vec4 fieldPixel = enhanced
      ? pixiLinearField(uv, aspect, t, true, gamma, maxAlpha)
      : pixiNearestField(uv, aspect, t, false, gamma, maxAlpha);
    vec3 color = mix(uBackground, fieldPixel.rgb, fieldPixel.a);
    color = mix(color, mix(uPaletteC, uPaletteD, 0.5 + 0.5 * sin(t * 2.0)), markers * 0.85);
    fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    return;
  }

  float sharpness = max(0.05, uLineSharpness);
  float particleBudget = clamp((uParticleCount - 25000.0) / 1975000.0, 0.0, 1.0);
  float density = clamp(uParticleDensity, 0.05, 8.0);
  float nodal = exp(-abs(field) * mix(10.0, 58.0, clamp(sharpness / 3.5, 0.0, 1.0)));
  nodal = clamp(nodal, 0.0, 1.0);

  float resolutionScale = clamp(uFieldResolution / 128.0, 0.25, 8.0);
  float grainScale = mix(130.0, 2300.0, particleBudget) * mix(0.55, 2.25, clamp(density / 8.0, 0.0, 1.0)) * sqrt(resolutionScale);
  vec2 grid = floor(uv * grainScale);
  float grain = hash(grid);
  float occupancy = mix(0.18, 1.0, particleBudget) * density;
  float sparkle = smoothstep(mix(0.985, 0.72, clamp(occupancy / 3.0, 0.0, 1.0)), 1.0, grain) * nodal;
  float micro = mix(0.5, hash(grid * 1.618 + 7.0), 0.18);
  float vignette = smoothstep(1.24, 0.18, length((uv - 0.5) * vec2(aspect.x, 1.0)));

  // Map the harmonic scalar field itself across the full style palette.  Nodal
  // intensity and particles shape contrast only; they must not collapse the
  // plate back into colored lines over a black background.
  float harmonicValue = clamp(0.5 + 0.5 * field, 0.0, 1.0);
  harmonicValue = pow(harmonicValue, 0.82);
  vec3 lowBand = mix(uPaletteA, uPaletteB, smoothstep(0.0, 0.34, harmonicValue));
  vec3 highBand = mix(uPaletteC, uPaletteD, smoothstep(0.66, 1.0, harmonicValue));
  vec3 sand = mix(lowBand, highBand, smoothstep(0.28, 0.78, harmonicValue));

  float bandContrast = 0.62 + 0.34 * nodal + 0.045 * sparkle + 0.025 * micro;
  float glowContrast = 1.0 + nodal * uGlow * mix(0.14, 0.34, particleBudget);
  vec3 color = sand * bandContrast * glowContrast;
  color = mix(color, uPaletteD, sparkle * mix(0.04, 0.12, particleBudget));
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
  renderMode: WebGLUniformLocation | null;
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

type HarmonicRenderStyle = 'basic' | 'enhanced' | 'ultra';

const uniformCache = new WeakMap<WebGLProgram, HarmonicSandUniforms>();
const interactionCache = new WeakMap<HTMLCanvasElement, RawInteractionState>();
const cleanupCache = new WeakMap<HTMLCanvasElement, () => void>();
const visibilityCache = new WeakMap<HTMLCanvasElement, RawVisibilityState>();

function requireProgram(state: RawWebGL2RenderState): WebGLProgram | null {
  return state.program;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sourceLimit(settings: Record<string, unknown>, quality: RenderQuality): number {
  const profile = qualityProfile(quality);
  return clamp(Math.round(finiteNumberSetting(settings, 'rawEmitterLimit', 10) * profile.emitterLimitScale), 1, MAX_RAW_EMITTERS);
}

function createInitialEmitters(settings: Record<string, unknown>, quality: RenderQuality): RawEmitter[] {
  const limit = sourceLimit(settings, quality);
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

function upsertEmitter(
  interaction: RawInteractionState,
  settings: Record<string, unknown>,
  quality: RenderQuality,
  point: { x: number; y: number }
): number {
  const existing = nearestEmitter(interaction.emitters, point);
  if (existing !== null) return existing;
  const limit = sourceLimit(settings, quality);
  const phase = (point.x * 5.1 + point.y * 3.7 + interaction.emitters.length * 1.9) % (Math.PI * 2);
  const frequency = finiteNumberSetting(settings, 'baseFrequency', 2.4) * (0.82 + (interaction.emitters.length % 5) * 0.08);
  if (interaction.emitters.length >= limit) interaction.emitters.shift();
  interaction.emitters.push({ x: point.x, y: point.y, frequency, phase, amplitude: 1 });
  return interaction.emitters.length - 1;
}

function applyGesture(
  interaction: RawInteractionState,
  settings: Record<string, unknown>,
  quality: RenderQuality,
  canvas: HTMLCanvasElement,
  gesture: GestureEvent
): void {
  const point = gestureToPlate(canvas, gesture.x, gesture.y);
  if (gesture.kind === 'double_tap') {
    const nearest = nearestEmitter(interaction.emitters, point);
    if (nearest !== null) interaction.emitters.splice(nearest, 1);
    return;
  }
  if (gesture.kind !== 'tap' && gesture.kind !== 'hold' && gesture.kind !== 'drag') return;
  const index = upsertEmitter(interaction, settings, quality, point);
  const emitter = interaction.emitters[index];
  if (emitter && gesture.kind === 'drag') {
    emitter.x = point.x;
    emitter.y = point.y;
  }
}

function flushQueuedGestures(interaction: RawInteractionState | undefined, settings: Record<string, unknown>, quality: RenderQuality, canvas: HTMLCanvasElement): void {
  if (!interaction || interaction.queuedGestures.length === 0) return;
  const gestures = interaction.queuedGestures.splice(0);
  gestures.forEach((gesture) => applyGesture(interaction, settings, quality, canvas, gesture));
}

function attachInteractions(state: RawWebGL2RenderState, quality: RenderQuality): void {
  const { canvas } = state;
  const interaction: RawInteractionState = {
    emitters: createInitialEmitters(state.settings, quality),
    emitterData: new Float32Array(MAX_RAW_EMITTERS * 4),
    emitterAmplitudes: new Float32Array(MAX_RAW_EMITTERS),
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
    interaction.draggingIndex = upsertEmitter(interaction, state.settings, quality, point);
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
    renderMode: gl.getUniformLocation(program, 'uRenderMode'),
    emitterCount: gl.getUniformLocation(program, 'uEmitterCount'),
    emitters: gl.getUniformLocation(program, 'uEmitters'),
    emitterAmplitudes: gl.getUniformLocation(program, 'uEmitterAmplitudes'),
    paletteA: gl.getUniformLocation(program, 'uPaletteA'),
    paletteB: gl.getUniformLocation(program, 'uPaletteB'),
    paletteC: gl.getUniformLocation(program, 'uPaletteC'),
    paletteD: gl.getUniformLocation(program, 'uPaletteD'),
    background: gl.getUniformLocation(program, 'uBackground'),
  });
}

function resetRawPlate(state: RawWebGL2RenderState, quality: RenderQuality): void {
  const interaction = interactionCache.get(state.canvas);
  if (!interaction) return;
  interaction.emitters = createInitialEmitters(state.settings, quality);
  interaction.queuedGestures = [];
  interaction.activePointerId = null;
  interaction.draggingIndex = null;
  interaction.lastTapAt = 0;
}

function syncEmitterLimit(state: RawWebGL2RenderState, quality: RenderQuality, change?: { key: string; value: unknown }): void {
  if (change?.key !== 'rawEmitterLimit') return;
  const interaction = interactionCache.get(state.canvas);
  if (!interaction) return;
  interaction.emitters = interaction.emitters.slice(-sourceLimit(state.settings, quality));
}

function renderStyle(settings: Record<string, unknown>): HarmonicRenderStyle {
  const value = settings.renderStyle;
  if (value === 'basic' || value === 'enhanced' || value === 'ultra') return value;
  return 'ultra';
}

function renderHarmonicSand(state: RawWebGL2RenderState, quality: RenderQuality): void {
  const profile = qualityProfile(quality);
  const { gl, vao, canvas, settings, style } = state;
  const program = requireProgram(state);
  if (!program) return;
  const uniforms = uniformCache.get(program);
  if (!uniforms) return;
  const interaction = interactionCache.get(canvas);
  flushQueuedGestures(interaction, settings, quality, canvas);
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  const palette = style?.palette ?? [];
  const a = colorNumberToRgb(palette[0], [1.0, 0.78, 0.35]);
  const b = colorNumberToRgb(palette[1], [0.18, 0.82, 1.0]);
  const c = colorNumberToRgb(palette[2], [1.0, 0.28, 0.62]);
  const d = colorNumberToRgb(palette[3], [1.0, 1.0, 1.0]);
  const bg = colorNumberToRgb(style?.background, [0.015, 0.012, 0.025]);
  const emitters = interaction?.emitters ?? [];
  const emitterData = interaction?.emitterData;
  const emitterAmplitudes = interaction?.emitterAmplitudes;
  const visibility = visibilityCache.get(canvas) ?? { uiHidden: false, demoModeActive: false };
  const emitterCount = Math.min(emitters.length, MAX_RAW_EMITTERS);
  for (let index = 0; index < emitterCount; index += 1) {
    const emitter = emitters[index];
    if (!emitter || !emitterData || !emitterAmplitudes) continue;
    const offset = index * 4;
    emitterData[offset] = emitter.x;
    emitterData[offset + 1] = emitter.y;
    emitterData[offset + 2] = emitter.frequency;
    emitterData[offset + 3] = emitter.phase;
    emitterAmplitudes[index] = emitter.amplitude;
  }

  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  gl.uniform1f(uniforms.fieldResolution, finiteNumberSetting(settings, 'resolution', 128) * profile.resolutionScale);
  gl.uniform1f(uniforms.time, state.timeSeconds / Math.max(1, finiteNumberSetting(settings, 'wavePeriod', 1)));
  gl.uniform1f(uniforms.baseFrequency, finiteNumberSetting(settings, 'baseFrequency', 2.4));
  gl.uniform1f(uniforms.particleDensity, finiteNumberSetting(settings, 'rawParticleDensity', 1.25) * profile.densityScale);
  gl.uniform1f(
    uniforms.particleCount,
    Math.max(1, finiteNumberSetting(settings, 'rawParticleCount', 180000) * profile.particleScale),
  );
  gl.uniform1f(uniforms.lineSharpness, finiteNumberSetting(settings, 'rawLineSharpness', 1.8) * profile.lineSharpnessScale);
  gl.uniform1f(uniforms.glow, finiteNumberSetting(settings, 'rawGlow', 1.35) * profile.glowScale);
  gl.uniform1f(uniforms.markerVisibility, visibility.uiHidden || visibility.demoModeActive ? 0 : 1);
  const styleMode = renderStyle(settings);
  gl.uniform1i(uniforms.renderMode, styleMode === 'basic' ? 0 : styleMode === 'enhanced' ? 1 : 2);
  gl.uniform1i(uniforms.emitterCount, emitterCount);
  if (emitterCount > 0 && emitterData) gl.uniform4fv(uniforms.emitters, emitterData.subarray(0, emitterCount * 4));
  if (emitterCount > 0 && emitterAmplitudes) gl.uniform1fv(uniforms.emitterAmplitudes, emitterAmplitudes.subarray(0, emitterCount));
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
}

export class RawHarmonicSandScene extends RawWebGL2Scene {
  private qualityState: { value: RenderQuality };
  private rawState: { value: RawWebGL2RenderState | null };

  constructor() {
    const qualityState = { value: 'raw' as RenderQuality };
    const rawState = { value: null as RawWebGL2RenderState | null };
    super({
      name: 'RawHarmonicSand',
      markup,
      canvasSelector: 'canvas[data-harmonic-sand-raw]',
      sources: { vertex: vertexSource, fragment: fragmentSource },
      unsupportedMarkup: '<div class="grid h-full place-items-center bg-black text-sm text-amber-100">WebGL2 is required for the raw Harmonic Sand engine.</div>',
      renderScale: () => qualityProfile(qualityState.value).renderScale,
      onInit: (state) => {
        rawState.value = state;
        initUniforms(state);
        attachInteractions(state, qualityState.value);
      },
      onReset: (state) => {
        resetRawPlate(state, qualityState.value);
      },
      onSettingsChange: (state, change) => {
        syncEmitterLimit(state, qualityState.value, change);
      },
      render: (state) => renderHarmonicSand(state, qualityState.value),
      getDebugStats: (state) => {
        const interaction = interactionCache.get(state.canvas);
        const profile = qualityProfile(qualityState.value);
        const styleMode = renderStyle(state.settings);
        const emitterCount = Math.min(interaction?.emitters.length ?? 0, MAX_RAW_EMITTERS);
        const fieldResolution = finiteNumberSetting(state.settings, 'resolution', 128) * profile.resolutionScale;
        return {
          renderer: 'raw-webgl2-harmonic-shader',
          simulation: 'gpu-analytic-field-shader',
          rendering: 'gpu-fragment-shader',
          gpuSimulated: true,
          gpuRendered: true,
          cpuTopology: false,
          cpuUpload: false,
          style: styleMode,
          emitters: emitterCount,
          emitterLimit: sourceLimit(state.settings, qualityState.value),
          fieldResolution: Math.round(fieldResolution),
          particleBudget: Math.round(Math.max(1, finiteNumberSetting(state.settings, 'rawParticleCount', 180000) * profile.particleScale)),
          gpuPasses: 1,
          uniformUploadFloats: emitterCount * 5 + 26,
        };
      },
      onDestroy: (state) => {
        destroyRawPlate(state);
        if (rawState.value?.canvas === state.canvas) rawState.value = null;
      },
    });
    this.qualityState = qualityState;
    this.rawState = rawState;
  }

  setQuality(quality: RenderQuality): void {
    this.qualityState.value = quality;
    const activeState = this.rawState.value;
    if (!activeState) return;
    const interaction = interactionCache.get(activeState.canvas);
    if (!interaction) return;
    interaction.emitters = interaction.emitters.slice(-sourceLimit(activeState.settings, quality));
  }

  onUIHidden(hidden: boolean): void {
    const activeState = this.rawState.value;
    if (!activeState) return;
    const visibility = visibilityCache.get(activeState.canvas) ?? { uiHidden: false, demoModeActive: false };
    visibility.uiHidden = hidden;
    visibilityCache.set(activeState.canvas, visibility);
  }

  setMode(mode: string): void {
    const activeState = this.rawState.value;
    if (!activeState) return;
    const visibility = visibilityCache.get(activeState.canvas) ?? { uiHidden: false, demoModeActive: false };
    visibility.demoModeActive = mode === 'demo';
    visibilityCache.set(activeState.canvas, visibility);
  }

  pushGestures(gestures: GestureEvent[]): void {
    const activeState = this.rawState.value;
    if (gestures.length === 0 || !activeState) return;
    const interaction = interactionCache.get(activeState.canvas);
    if (!interaction) return;
    interaction.queuedGestures.push(...gestures);
  }

  clearEmitters(): void {
    const activeState = this.rawState.value;
    if (!activeState) return;
    const interaction = interactionCache.get(activeState.canvas);
    if (!interaction) return;
    interaction.emitters = [];
    interaction.queuedGestures = [];
    interaction.activePointerId = null;
    interaction.draggingIndex = null;
    interaction.lastTapAt = 0;
  }
}
