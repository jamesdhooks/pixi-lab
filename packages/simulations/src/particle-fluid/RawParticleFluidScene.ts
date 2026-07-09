import {
  RawGpuFieldPass,
  RawGpuParticleState,
  RawPingPongRenderTarget,
  RawWebGL2Scene,
  colorNumberToRgb,
  finiteNumberSetting,
  type GestureEvent,
  type RawFramebuffer,
  type RawSceneDebugStats,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';

interface PointerState {
  active: boolean;
  id: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
}

interface ForceSegment {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  strength: number;
}

interface ParticleFluidState extends RawWebGL2RenderState {
  cpuParticleProgram: WebGLProgram | null;
  gpuParticleProgram: WebGLProgram | null;
  cpuParticleBuffer: WebGLBuffer | null;
  particleUvBuffer: WebGLBuffer | null;
  velocityTarget: RawPingPongRenderTarget | null;
  pressureTarget: RawPingPongRenderTarget | null;
  divergenceTarget: RawFramebuffer | null;
  particleState: RawGpuParticleState | null;
  advectPass: RawGpuFieldPass | null;
  forcePass: RawGpuFieldPass | null;
  divergencePass: RawGpuFieldPass | null;
  pressurePass: RawGpuFieldPass | null;
  gradientPass: RawGpuFieldPass | null;
  particleInitPass: RawGpuFieldPass | null;
  particleStepPass: RawGpuFieldPass | null;
  particleData: Float32Array;
  velocityX: Float32Array;
  velocityY: Float32Array;
  nextVelocityX: Float32Array;
  nextVelocityY: Float32Array;
  divergence: Float32Array;
  pressure: Float32Array;
  nextPressure: Float32Array;
  fieldColumns: number;
  fieldRows: number;
  fieldResolution: number;
  capacity: number;
  count: number;
  particleTextureWidth: number;
  particleTextureHeight: number;
  particleUvCapacity: number;
  gpuReady: boolean;
  gpuFallbackReason: string;
  gpuPassesLastFrame: number;
  gpuSeedUploadFloats: number;
  cellSize: number;
  pointer: PointerState;
  pendingGestures: GestureEvent[];
  frameForces: ForceSegment[];
  pulseX: number;
  pulseY: number;
  pulsePreviousX: number;
  pulsePreviousY: number;
  pulseAge: number;
  pulseSpeed: number;
  pulseStrength: number;
  cleanupPointer?: () => void;
}

const SOURCE_CELL_SIZE = 32;
const MAX_FORCE_SEGMENTS = 8;

const MARKUP = `
  <canvas data-particle-fluid-canvas class="absolute inset-0 h-full w-full touch-none"></canvas>
`;

const CPU_PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aParticle;
uniform float uPointSize;
uniform float uSpeedColorScale;
uniform vec3 uSlowColor;
uniform vec3 uFastColor;
uniform vec3 uHotColor;
uniform float uBloomStrength;
uniform float uEnhanced;
uniform float uAspectRatio;
uniform float uSimulationScale;
uniform vec4 uPulseSegment;
uniform vec4 uPulseParams;
uniform vec3 uPulseColor;
out vec4 vColor;

vec2 distanceToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float len = length(ab);
  if (len <= 0.0001) return vec2(length(p - a), 0.0);
  float projection = dot(p - a, ab) / len;
  float fraction = projection / len;
  if (projection < 0.0) return vec2(length(p - a), fraction);
  if (projection > len) return vec2(length(p - b), fraction);
  float d = sqrt(max(0.0, dot(p - a, p - a) - projection * projection));
  return vec2(d, fraction);
}

void main() {
  vec2 p = aParticle.xy;
  vec2 v = aParticle.zw;
  float speed = length(v);
  float x = clamp(speed * uSpeedColorScale, 0.0, 1.0);
  vec3 color = mix(uSlowColor, uFastColor, x) + uHotColor * x * x * x * 0.1;
  float pulse = 0.0;
  if (uEnhanced > 0.5 && uPulseParams.y > 0.0001) {
    vec2 simP = vec2(p.x * uAspectRatio * uSimulationScale, p.y * uSimulationScale);
    vec2 distanceAndFraction = distanceToSegment(simP, uPulseSegment.xy, uPulseSegment.zw);
    float projected = 1.0 - clamp(distanceAndFraction.y, 0.0, 1.0) * 0.6;
    float sourcePulse = clamp((uPulseParams.z * uPulseParams.z * 0.02 - distanceAndFraction.x * 5.0) * projected, 0.0, 1.0);
    pulse = exp(-distanceAndFraction.x / max(0.0001, uPulseParams.x)) * sourcePulse * uPulseParams.y;
    color += uPulseColor * (pulse * (0.62 + pow(sourcePulse, 9.0) * 0.72));
  }
  float turbulent = smoothstep(0.42, 1.0, x);
  float edgeDistance = 1.0 - max(abs(p.x), abs(p.y));
  float edgeBloomFade = smoothstep(0.015, 0.16, edgeDistance);
  float bloom = (turbulent * turbulent * edgeBloomFade + pulse * 0.72) * uBloomStrength;
  color += (uFastColor * 0.24 + uHotColor * 0.16) * bloom;
  color = min(color, vec3(1.0));
  gl_PointSize = uPointSize;
  gl_Position = vec4(p, 0.0, 1.0);
  vColor = vec4(color, 1.0);
}`;

const GPU_PARTICLE_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
layout(location = 0) in vec2 aParticleUv;
uniform sampler2D uParticlePosition;
uniform sampler2D uParticleVelocity;
uniform float uPointSize;
uniform float uSpeedColorScale;
uniform vec3 uSlowColor;
uniform vec3 uFastColor;
uniform vec3 uHotColor;
uniform float uBloomStrength;
uniform float uEnhanced;
uniform float uAspectRatio;
uniform float uSimulationScale;
uniform vec4 uPulseSegment;
uniform vec4 uPulseParams;
uniform vec3 uPulseColor;
out vec4 vColor;

vec2 distanceToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float len = length(ab);
  if (len <= 0.0001) return vec2(length(p - a), 0.0);
  float projection = dot(p - a, ab) / len;
  float fraction = projection / len;
  if (projection < 0.0) return vec2(length(p - a), fraction);
  if (projection > len) return vec2(length(p - b), fraction);
  float d = sqrt(max(0.0, dot(p - a, p - a) - projection * projection));
  return vec2(d, fraction);
}

void main() {
  vec2 p = texture(uParticlePosition, aParticleUv).xy;
  vec2 v = texture(uParticleVelocity, aParticleUv).xy;
  float speed = length(v);
  float x = clamp(speed * uSpeedColorScale, 0.0, 1.0);
  vec3 color = mix(uSlowColor, uFastColor, x) + uHotColor * x * x * x * 0.1;
  float pulse = 0.0;
  if (uEnhanced > 0.5 && uPulseParams.y > 0.0001) {
    vec2 simP = vec2(p.x * uAspectRatio * uSimulationScale, p.y * uSimulationScale);
    vec2 distanceAndFraction = distanceToSegment(simP, uPulseSegment.xy, uPulseSegment.zw);
    float projected = 1.0 - clamp(distanceAndFraction.y, 0.0, 1.0) * 0.6;
    float sourcePulse = clamp((uPulseParams.z * uPulseParams.z * 0.02 - distanceAndFraction.x * 5.0) * projected, 0.0, 1.0);
    pulse = exp(-distanceAndFraction.x / max(0.0001, uPulseParams.x)) * sourcePulse * uPulseParams.y;
    color += uPulseColor * (pulse * (0.62 + pow(sourcePulse, 9.0) * 0.72));
  }
  float turbulent = smoothstep(0.42, 1.0, x);
  float edgeDistance = 1.0 - max(abs(p.x), abs(p.y));
  float edgeBloomFade = smoothstep(0.015, 0.16, edgeDistance);
  float bloom = (turbulent * turbulent * edgeBloomFade + pulse * 0.72) * uBloomStrength;
  color += (uFastColor * 0.24 + uHotColor * 0.16) * bloom;
  color = min(color, vec3(1.0));
  gl_PointSize = uPointSize;
  gl_Position = vec4(p, 0.0, 1.0);
  vColor = vec4(color, 1.0);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in vec4 vColor;
out vec4 outColor;
void main() {
  outColor = vColor;
}`;

const FIELD_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FIELD_COMMON = `
precision highp float;
precision highp sampler2D;
uniform vec2 uInvResolution;
uniform float uAspectRatio;
uniform float uSimulationScale;
in vec2 vUv;
out vec4 outColor;

vec2 simFromUv(vec2 uv) {
  return vec2((uv.x * 2.0 - 1.0) * uAspectRatio * uSimulationScale, (uv.y * 2.0 - 1.0) * uSimulationScale);
}

vec2 uvFromSim(vec2 sim) {
  return vec2(sim.x / max(0.0001, uAspectRatio * uSimulationScale) + 1.0, sim.y / max(0.0001, uSimulationScale) + 1.0) * 0.5;
}

float samplePressure(sampler2D pressure, vec2 coord) {
  vec2 cellOffset = vec2(0.0);
  if (coord.x < 0.0) cellOffset.x = 1.0;
  else if (coord.x > 1.0) cellOffset.x = -1.0;
  if (coord.y < 0.0) cellOffset.y = 1.0;
  else if (coord.y > 1.0) cellOffset.y = -1.0;
  return texture(pressure, coord + cellOffset * uInvResolution).x;
}

vec2 sampleVelocity(sampler2D velocity, vec2 coord) {
  vec2 cellOffset = vec2(0.0);
  vec2 multiplier = vec2(1.0);
  if (coord.x < 0.0) {
    cellOffset.x = 1.0;
    multiplier.x = -1.0;
  } else if (coord.x > 1.0) {
    cellOffset.x = -1.0;
    multiplier.x = -1.0;
  }
  if (coord.y < 0.0) {
    cellOffset.y = 1.0;
    multiplier.y = -1.0;
  } else if (coord.y > 1.0) {
    cellOffset.y = -1.0;
    multiplier.y = -1.0;
  }
  return multiplier * texture(velocity, coord + cellOffset * uInvResolution).xy;
}
`;

const ADVECT_FRAGMENT = `#version 300 es
${FIELD_COMMON}
uniform sampler2D uVelocity;
uniform sampler2D uTarget;
uniform float uDt;
uniform float uRdx;
void main() {
  vec2 tracedPos = simFromUv(vUv) - uDt * uRdx * texture(uVelocity, vUv).xy;
  vec2 tracedTexel = uvFromSim(tracedPos) / uInvResolution;
  vec4 st;
  st.xy = floor(tracedTexel - 0.5) + 0.5;
  st.zw = st.xy + 1.0;
  vec2 t = tracedTexel - st.xy;
  st *= uInvResolution.xyxy;
  vec4 tex11 = texture(uTarget, st.xy);
  vec4 tex21 = texture(uTarget, st.zy);
  vec4 tex12 = texture(uTarget, st.xw);
  vec4 tex22 = texture(uTarget, st.zw);
  outColor = mix(mix(tex11, tex21, t.x), mix(tex12, tex22, t.x), t.y);
}`;

const FORCE_FRAGMENT = `#version 300 es
${FIELD_COMMON}
uniform sampler2D uVelocity;
uniform vec4 uForceSegments[${MAX_FORCE_SEGMENTS}];
uniform vec4 uForceParams[${MAX_FORCE_SEGMENTS}];
uniform int uForceCount;
uniform float uDt;
uniform float uCellSize;
uniform float uVelocityDecay;
uniform float uForceRadius;
uniform float uForceTaper;
uniform float uForceStrength;
uniform float uForceVelocityScale;

vec2 distanceToSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float len = length(ab);
  if (len <= 0.0001) return vec2(length(p - a), 0.0);
  float projection = dot(p - a, ab) / len;
  float fraction = projection / len;
  if (projection < 0.0) return vec2(length(p - a), fraction);
  if (projection > len) return vec2(length(p - b), fraction);
  float d = sqrt(max(0.0, dot(p - a, p - a) - projection * projection));
  return vec2(d, fraction);
}

void main() {
  vec2 v = texture(uVelocity, vUv).xy * uVelocityDecay;
  vec2 p = simFromUv(vUv);
  for (int i = 0; i < ${MAX_FORCE_SEGMENTS}; i += 1) {
    if (i >= uForceCount) break;
    vec4 segment = uForceSegments[i];
    vec2 mouse = segment.xy;
    vec2 last = segment.zw;
    vec2 mouseVelocity = (mouse - last) / max(0.0001, uDt);
    vec2 distanceAndFraction = distanceToSegment(p, mouse, last);
    float projected = 1.0 - clamp(distanceAndFraction.y, 0.0, 1.0) * uForceTaper;
    float m = exp(-distanceAndFraction.x / uForceRadius) * projected * projected * uForceParams[i].x;
    vec2 targetVelocity = mouseVelocity * uForceVelocityScale * uCellSize * uForceStrength;
    v += (targetVelocity - v) * m;
  }
  outColor = vec4(v, 0.0, 1.0);
}`;

const DIVERGENCE_FRAGMENT = `#version 300 es
${FIELD_COMMON}
uniform sampler2D uVelocity;
uniform float uHalfRdx;
void main() {
  vec2 left = sampleVelocity(uVelocity, vUv - vec2(uInvResolution.x, 0.0));
  vec2 right = sampleVelocity(uVelocity, vUv + vec2(uInvResolution.x, 0.0));
  vec2 bottom = sampleVelocity(uVelocity, vUv - vec2(0.0, uInvResolution.y));
  vec2 top = sampleVelocity(uVelocity, vUv + vec2(0.0, uInvResolution.y));
  outColor = vec4(uHalfRdx * ((right.x - left.x) + (top.y - bottom.y)), 0.0, 0.0, 1.0);
}`;

const PRESSURE_FRAGMENT = `#version 300 es
${FIELD_COMMON}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform float uAlpha;
void main() {
  float left = samplePressure(uPressure, vUv - vec2(uInvResolution.x, 0.0));
  float right = samplePressure(uPressure, vUv + vec2(uInvResolution.x, 0.0));
  float bottom = samplePressure(uPressure, vUv - vec2(0.0, uInvResolution.y));
  float top = samplePressure(uPressure, vUv + vec2(0.0, uInvResolution.y));
  float divergence = texture(uDivergence, vUv).x;
  outColor = vec4((left + right + bottom + top + uAlpha * divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_FRAGMENT = `#version 300 es
${FIELD_COMMON}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform float uHalfRdx;
void main() {
  float left = samplePressure(uPressure, vUv - vec2(uInvResolution.x, 0.0));
  float right = samplePressure(uPressure, vUv + vec2(uInvResolution.x, 0.0));
  float bottom = samplePressure(uPressure, vUv - vec2(0.0, uInvResolution.y));
  float top = samplePressure(uPressure, vUv + vec2(0.0, uInvResolution.y));
  vec2 v = texture(uVelocity, vUv).xy;
  outColor = vec4(v - uHalfRdx * vec2(right - left, top - bottom), 0.0, 1.0);
}`;

const PARTICLE_INIT_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;
void main() {
  outPosition = vec4(vUv * 2.0 - 1.0, 0.0, 1.0);
  outVelocity = vec4(0.0, 0.0, 0.0, 1.0);
}`;

const PARTICLE_STEP_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uParticlePosition;
uniform sampler2D uParticleVelocity;
uniform sampler2D uFlowVelocity;
uniform float uDt;
uniform float uParticleDrag;
uniform vec2 uFlowScale;
in vec2 vUv;
layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;
void main() {
  vec2 p = texture(uParticlePosition, vUv).xy;
  vec2 v = texture(uParticleVelocity, vUv).xy;
  vec2 vf = texture(uFlowVelocity, (p + 1.0) * 0.5).xy * uFlowScale;
  v += (vf - v) * uParticleDrag;
  p += uDt * v;
  outPosition = vec4(p, 0.0, 1.0);
  outVelocity = vec4(v, 0.0, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create program');
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown program error';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function paletteColor(state: ParticleFluidState, index: number, fallback: [number, number, number]): [number, number, number] {
  return colorNumberToRgb(state.style?.palette?.[index], fallback);
}

function readableParticleColor(color: [number, number, number], minimumLuma: number, boost: number): [number, number, number] {
  const boosted: [number, number, number] = [
    clamp(color[0] * boost, 0, 1),
    clamp(color[1] * boost, 0, 1),
    clamp(color[2] * boost, 0, 1),
  ];
  const luma = boosted[0] * 0.2126 + boosted[1] * 0.7152 + boosted[2] * 0.0722;
  if (luma >= minimumLuma) return boosted;
  const lift = minimumLuma - luma;
  return [
    clamp(boosted[0] + lift * (1 - boosted[0]), 0, 1),
    clamp(boosted[1] + lift * (1 - boosted[1]), 0, 1),
    clamp(boosted[2] + lift * (1 - boosted[2]), 0, 1),
  ];
}

function maxParticles(state: ParticleFluidState): number {
  return Math.min(state.capacity, Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'maxParticles', 262144))));
}

function enhancedRenderEnabled(state: ParticleFluidState): boolean {
  return state.settings.renderStyle === 'enhanced';
}

function aspectRatio(state: ParticleFluidState): number {
  return state.fieldColumns / Math.max(1, state.fieldRows);
}

function simulationScale(state: ParticleFluidState): number {
  return Math.max(0.25, finiteNumberSetting(state.settings, 'simulationScale', 1));
}

function clipToSimX(state: ParticleFluidState, clipX: number): number {
  return clipX * aspectRatio(state) * simulationScale(state);
}

function clipToSimY(state: ParticleFluidState, clipY: number): number {
  return clipY * simulationScale(state);
}

function gridSimX(state: ParticleFluidState, x: number): number {
  return ((x + 0.5) / Math.max(1, state.fieldColumns) * 2 - 1) * aspectRatio(state) * simulationScale(state);
}

function gridSimY(state: ParticleFluidState, y: number): number {
  return ((y + 0.5) / Math.max(1, state.fieldRows) * 2 - 1) * simulationScale(state);
}

function simToGridX(state: ParticleFluidState, simX: number): number {
  return (simX / Math.max(0.0001, aspectRatio(state) * simulationScale(state)) + 1) * 0.5 * state.fieldColumns - 0.5;
}

function simToGridY(state: ParticleFluidState, simY: number): number {
  return (simY / simulationScale(state) + 1) * 0.5 * state.fieldRows - 0.5;
}

function pointerClip(canvas: HTMLCanvasElement, event: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1;
  const y = ((rect.height - (event.clientY - rect.top)) / Math.max(1, rect.height)) * 2 - 1;
  return [x, y];
}

function displaySize(state: ParticleFluidState): [number, number] {
  const rect = state.canvas.getBoundingClientRect();
  return [rect.width || state.width, rect.height || state.height];
}

function pixelGestureToClip(state: ParticleFluidState, gesture: GestureEvent): ForceSegment {
  const [width, height] = displaySize(state);
  const x = gesture.x / Math.max(1, width) * 2 - 1;
  const y = ((height - gesture.y) / Math.max(1, height)) * 2 - 1;
  const dx = (gesture.dx ?? 0) / Math.max(1, width) * 2;
  const dy = -((gesture.dy ?? 0) / Math.max(1, height) * 2);
  return { x, y, previousX: x - dx, previousY: y - dy, strength: gesture.strength ?? 1 };
}

function ensureField(state: ParticleFluidState): void {
  const resolution = Math.max(1, finiteNumberSetting(state.settings, 'fieldCellSize', 4));
  state.cellSize = Math.max(1, finiteNumberSetting(state.settings, 'cellSize', SOURCE_CELL_SIZE));
  const columns = Math.max(8, Math.round(state.width / resolution));
  const rows = Math.max(8, Math.round(state.height / resolution));
  if (columns === state.fieldColumns && rows === state.fieldRows && resolution === state.fieldResolution) return;
  const cells = columns * rows;
  state.fieldColumns = columns;
  state.fieldRows = rows;
  state.fieldResolution = resolution;
  state.velocityX = new Float32Array(cells);
  state.velocityY = new Float32Array(cells);
  state.nextVelocityX = new Float32Array(cells);
  state.nextVelocityY = new Float32Array(cells);
  state.divergence = new Float32Array(cells);
  state.pressure = new Float32Array(cells);
  state.nextPressure = new Float32Array(cells);
}

function resetFluid(state: ParticleFluidState, preview: boolean): void {
  ensureField(state);
  state.velocityX.fill(0);
  state.velocityY.fill(0);
  state.pressure.fill(0);
  state.nextPressure.fill(0);
  state.divergence.fill(0);
  state.pulseX = 0;
  state.pulseY = 0;
  state.pulsePreviousX = 0;
  state.pulsePreviousY = 0;
  state.pulseAge = 999;
  state.pulseSpeed = 0;
  state.pulseStrength = 0;
  resetParticles(state, preview);
  if (ensureGpuResources(state)) {
    clearGpuFluid(state);
    resetGpuParticles(state);
  }
}

function resetParticles(state: ParticleFluidState, preview: boolean): void {
  const target = Math.min(maxParticles(state), preview ? Math.min(8192, maxParticles(state)) : maxParticles(state));
  const textureWidth = Math.max(1, Math.ceil(Math.sqrt(target)));
  state.count = target;
  state.particleTextureWidth = textureWidth;
  state.particleTextureHeight = textureWidth;
  for (let i = 0; i < target; i += 1) {
    const col = i % textureWidth;
    const row = Math.floor(i / textureWidth);
    const k = i * 4;
    state.particleData[k] = (col + 0.5) / textureWidth * 2 - 1;
    state.particleData[k + 1] = (row + 0.5) / textureWidth * 2 - 1;
    state.particleData[k + 2] = 0;
    state.particleData[k + 3] = 0;
  }
}

function canUseGpuPath(state: ParticleFluidState): boolean {
  return state.resources.capabilities.floatColorBuffer;
}

function destroyGpuResources(state: ParticleFluidState): void {
  state.velocityTarget?.destroy();
  state.pressureTarget?.destroy();
  if (state.divergenceTarget) state.resources.destroyFramebuffer(state.divergenceTarget);
  state.particleState?.destroy();
  state.velocityTarget = null;
  state.pressureTarget = null;
  state.divergenceTarget = null;
  state.particleState = null;
}

function clearFramebuffer(state: ParticleFluidState, framebuffer: RawFramebuffer): void {
  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.framebuffer);
  gl.viewport(0, 0, framebuffer.texture.width, framebuffer.texture.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function clearPingPongTarget(state: ParticleFluidState, target: RawPingPongRenderTarget): void {
  clearFramebuffer(state, target.read);
  clearFramebuffer(state, target.write);
}

function clearGpuFluid(state: ParticleFluidState): void {
  if (state.velocityTarget) clearPingPongTarget(state, state.velocityTarget);
  if (state.pressureTarget) clearPingPongTarget(state, state.pressureTarget);
  if (state.divergenceTarget) clearFramebuffer(state, state.divergenceTarget);
  state.gl.bindFramebuffer(state.gl.FRAMEBUFFER, null);
}

function ensureGpuResources(state: ParticleFluidState): boolean {
  if (!canUseGpuPath(state)) {
    state.gpuReady = false;
    state.gpuFallbackReason = 'missing-float-render-targets';
    return false;
  }
  ensureField(state);
  const particleCount = maxParticles(state);
  const particleEdge = Math.max(1, Math.ceil(Math.sqrt(particleCount)));
  const needsFluid =
    !state.velocityTarget ||
    !state.pressureTarget ||
    !state.divergenceTarget ||
    state.velocityTarget.width !== state.fieldColumns ||
    state.velocityTarget.height !== state.fieldRows;
  const needsParticles =
    !state.particleState ||
    state.particleState.capacity !== particleCount ||
    state.particleState.width !== particleEdge ||
    state.particleState.height !== particleEdge ||
    state.count !== particleCount ||
    state.particleTextureWidth !== particleEdge ||
    state.particleTextureHeight !== particleEdge;

  if (needsFluid) {
    state.velocityTarget?.destroy();
    state.pressureTarget?.destroy();
    if (state.divergenceTarget) state.resources.destroyFramebuffer(state.divergenceTarget);
    state.velocityTarget = new RawPingPongRenderTarget(state.resources, {
      width: state.fieldColumns,
      height: state.fieldRows,
      precision: 'float',
      filter: 'nearest',
    });
    state.pressureTarget = new RawPingPongRenderTarget(state.resources, {
      width: state.fieldColumns,
      height: state.fieldRows,
      precision: 'float',
      filter: 'nearest',
    });
    state.divergenceTarget = state.resources.createFramebuffer(state.resources.createRenderTexture({
      width: state.fieldColumns,
      height: state.fieldRows,
      precision: 'float',
      filter: 'nearest',
    }));
    clearGpuFluid(state);
  }

  if (needsParticles) {
    state.particleState?.destroy();
    state.count = particleCount;
    state.particleTextureWidth = particleEdge;
    state.particleTextureHeight = particleEdge;
    state.particleUvCapacity = 0;
    state.particleState = new RawGpuParticleState(state.resources, {
      capacity: particleCount,
      width: particleEdge,
      height: particleEdge,
      precision: 'float',
    });
    resetGpuParticles(state);
  }

  state.gpuReady = true;
  state.gpuFallbackReason = '';
  return true;
}

function resetGpuParticles(state: ParticleFluidState): void {
  if (!state.particleState || !state.particleInitPass) return;
  const gl = state.gl;
  state.particleState.bindWriteFramebuffer();
  state.particleInitPass.render({
    width: state.particleState.width,
    height: state.particleState.height,
    preserveFramebuffer: true,
  });
  state.particleState.unbindWriteFramebuffer();
  state.particleState.swap();
  state.gpuSeedUploadFloats = 0;
  ensureParticleUvBuffer(state);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function ensureParticleUvBuffer(state: ParticleFluidState): void {
  const gl = state.gl;
  if (!state.particleUvBuffer) state.particleUvBuffer = gl.createBuffer();
  if (!state.particleUvBuffer) return;
  if (state.particleUvCapacity === state.count) return;
  const uvs = new Float32Array(state.count * 2);
  for (let i = 0; i < state.count; i += 1) {
    const col = i % state.particleTextureWidth;
    const row = Math.floor(i / state.particleTextureWidth);
    const k = i * 2;
    uvs[k] = (col + 0.5) / state.particleTextureWidth;
    uvs[k + 1] = (row + 0.5) / state.particleTextureHeight;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleUvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
  state.particleUvCapacity = state.count;
}

function installPointer(state: ParticleFluidState): () => void {
  const down = (event: PointerEvent) => {
    const [x, y] = pointerClip(state.canvas, event);
    state.pointer = { active: true, id: event.pointerId, x, y, previousX: x, previousY: y };
    state.canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    const [x, y] = pointerClip(state.canvas, event);
    state.pointer.x = x;
    state.pointer.y = y;
  };
  const up = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    state.pointer.active = false;
  };
  state.canvas.addEventListener('pointerdown', down);
  state.canvas.addEventListener('pointermove', move);
  state.canvas.addEventListener('pointerup', up);
  state.canvas.addEventListener('pointercancel', up);
  return () => {
    state.canvas.removeEventListener('pointerdown', down);
    state.canvas.removeEventListener('pointermove', move);
    state.canvas.removeEventListener('pointerup', up);
    state.canvas.removeEventListener('pointercancel', up);
  };
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length <= 0.0001) return [Math.hypot(px - ax, py - ay), 0];
  const projection = ((px - ax) * dx + (py - ay) * dy) / length;
  const fraction = projection / length;
  if (projection < 0) return [Math.hypot(px - ax, py - ay), fraction];
  if (projection > length) return [Math.hypot(px - bx, py - by), fraction];
  return [Math.sqrt(Math.max(0, (px - ax) ** 2 + (py - ay) ** 2 - projection ** 2)), fraction];
}

function sampleScalar(data: Float32Array, width: number, height: number, x: number, y: number): number {
  const x0 = clamp(Math.floor(x), 0, width - 1);
  const y0 = clamp(Math.floor(y), 0, height - 1);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = clamp(x - x0, 0, 1);
  const ty = clamp(y - y0, 0, 1);
  const i00 = y0 * width + x0;
  const i10 = y0 * width + x1;
  const i01 = y1 * width + x0;
  const i11 = y1 * width + x1;
  const a = data[i00] * (1 - tx) + data[i10] * tx;
  const b = data[i01] * (1 - tx) + data[i11] * tx;
  return a * (1 - ty) + b * ty;
}

function sampleAtSim(state: ParticleFluidState, data: Float32Array, simX: number, simY: number): number {
  return sampleScalar(data, state.fieldColumns, state.fieldRows, simToGridX(state, simX), simToGridY(state, simY));
}

function samplePressure(state: ParticleFluidState, x: number, y: number): number {
  const sx = clamp(Math.floor(x), 0, state.fieldColumns - 1);
  const sy = clamp(Math.floor(y), 0, state.fieldRows - 1);
  return state.pressure[sy * state.fieldColumns + sx];
}

function sampleVelocity(state: ParticleFluidState, x: number, y: number): [number, number] {
  let sx = Math.floor(x);
  let sy = Math.floor(y);
  let mx = 1;
  let my = 1;
  if (sx < 0) { sx = 0; mx = -1; }
  else if (sx > state.fieldColumns - 1) { sx = state.fieldColumns - 1; mx = -1; }
  if (sy < 0) { sy = 0; my = -1; }
  else if (sy > state.fieldRows - 1) { sy = state.fieldRows - 1; my = -1; }
  const index = sy * state.fieldColumns + sx;
  return [state.velocityX[index] * mx, state.velocityY[index] * my];
}

function collectForces(state: ParticleFluidState): ForceSegment[] {
  state.frameForces.length = 0;
  while (state.pendingGestures.length > 0) {
    const gesture = state.pendingGestures.shift();
    if (gesture) state.frameForces.push(pixelGestureToClip(state, gesture));
  }
  if (state.pointer.active) {
    state.frameForces.push({ x: state.pointer.x, y: state.pointer.y, previousX: state.pointer.previousX, previousY: state.pointer.previousY, strength: 1 });
  }
  return state.frameForces;
}

function updatePulse(state: ParticleFluidState, forces: ForceSegment[], dt: number): void {
  state.pulseAge += Math.max(0, dt);
  if (forces.length === 0) return;

  let strongest = forces[0];
  let strongestSpeed = 0;
  const scale = simulationScale(state);
  for (const force of forces) {
    const dx = clipToSimX(state, force.x) - clipToSimX(state, force.previousX);
    const dy = clipToSimY(state, force.y) - clipToSimY(state, force.previousY);
    const speed = Math.hypot(dx / scale, dy / scale) / Math.max(0.0001, dt);
    if (speed * force.strength >= strongestSpeed) {
      strongest = force;
      strongestSpeed = speed * force.strength;
    }
  }

  if (!strongest) return;
  state.pulseX = clipToSimX(state, strongest.x);
  state.pulseY = clipToSimY(state, strongest.y);
  state.pulsePreviousX = clipToSimX(state, strongest.previousX);
  state.pulsePreviousY = clipToSimY(state, strongest.previousY);
  state.pulseSpeed = strongestSpeed;
  state.pulseStrength = clamp(strongest.strength, 0, 2);
  state.pulseAge = 0;
}

function applyForces(state: ParticleFluidState, dt: number, forces: ForceSegment[]): void {
  const velocityDecay = clamp(finiteNumberSetting(state.settings, 'velocityDecay', 0.999), 0, 1);
  const forceRadius = Math.max(0.0001, finiteNumberSetting(state.settings, 'forceRadius', 0.015)) * simulationScale(state);
  const forceTaper = clamp(finiteNumberSetting(state.settings, 'forceTaper', 0.6), 0, 1);
  const forceStrength = finiteNumberSetting(state.settings, 'forceStrength', 1);
  const forceVelocityScale = 1 / simulationScale(state);
  for (let y = 0; y < state.fieldRows; y += 1) {
    for (let x = 0; x < state.fieldColumns; x += 1) {
      const index = y * state.fieldColumns + x;
      let vx = state.velocityX[index] * velocityDecay;
      let vy = state.velocityY[index] * velocityDecay;
      const px = gridSimX(state, x);
      const py = gridSimY(state, y);
      for (const force of forces) {
        const mouseX = clipToSimX(state, force.x);
        const mouseY = clipToSimY(state, force.y);
        const lastX = clipToSimX(state, force.previousX);
        const lastY = clipToSimY(state, force.previousY);
        const mouseVelocityX = (mouseX - lastX) / Math.max(0.0001, dt) * forceVelocityScale;
        const mouseVelocityY = (mouseY - lastY) / Math.max(0.0001, dt) * forceVelocityScale;
        const [distance, fraction] = distanceToSegment(px, py, mouseX, mouseY, lastX, lastY);
        const projected = 1 - clamp(fraction, 0, 1) * forceTaper;
        const m = Math.exp(-distance / forceRadius) * projected * projected * force.strength;
        vx += (mouseVelocityX * state.cellSize * forceStrength - vx) * m;
        vy += (mouseVelocityY * state.cellSize * forceStrength - vy) * m;
      }
      state.velocityX[index] = vx;
      state.velocityY[index] = vy;
    }
  }
}

function advectVector(state: ParticleFluidState, dt: number): void {
  const rdx = 1 / state.cellSize;
  for (let y = 0; y < state.fieldRows; y += 1) {
    for (let x = 0; x < state.fieldColumns; x += 1) {
      const index = y * state.fieldColumns + x;
      const tracedX = gridSimX(state, x) - dt * rdx * state.velocityX[index];
      const tracedY = gridSimY(state, y) - dt * rdx * state.velocityY[index];
      state.nextVelocityX[index] = sampleAtSim(state, state.velocityX, tracedX, tracedY);
      state.nextVelocityY[index] = sampleAtSim(state, state.velocityY, tracedX, tracedY);
    }
  }
  [state.velocityX, state.nextVelocityX] = [state.nextVelocityX, state.velocityX];
  [state.velocityY, state.nextVelocityY] = [state.nextVelocityY, state.velocityY];
}

function computeDivergence(state: ParticleFluidState): void {
  const halfRdx = 0.5 / state.cellSize;
  for (let y = 0; y < state.fieldRows; y += 1) {
    for (let x = 0; x < state.fieldColumns; x += 1) {
      const [leftX] = sampleVelocity(state, x - 1, y);
      const [rightX] = sampleVelocity(state, x + 1, y);
      const [, bottomY] = sampleVelocity(state, x, y - 1);
      const [, topY] = sampleVelocity(state, x, y + 1);
      state.divergence[y * state.fieldColumns + x] = halfRdx * ((rightX - leftX) + (topY - bottomY));
    }
  }
}

function solvePressure(state: ParticleFluidState): void {
  const alpha = -state.cellSize * state.cellSize;
  const iterations = Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'solverIterations', 18)));
  for (let pass = 0; pass < iterations; pass += 1) {
    for (let y = 0; y < state.fieldRows; y += 1) {
      for (let x = 0; x < state.fieldColumns; x += 1) {
        const index = y * state.fieldColumns + x;
        const l = samplePressure(state, x - 1, y);
        const r = samplePressure(state, x + 1, y);
        const b = samplePressure(state, x, y - 1);
        const t = samplePressure(state, x, y + 1);
        state.nextPressure[index] = (l + r + b + t + alpha * state.divergence[index]) * 0.25;
      }
    }
    [state.pressure, state.nextPressure] = [state.nextPressure, state.pressure];
  }
}

function subtractPressureGradient(state: ParticleFluidState): void {
  const halfRdx = 0.5 / state.cellSize;
  for (let y = 0; y < state.fieldRows; y += 1) {
    for (let x = 0; x < state.fieldColumns; x += 1) {
      const index = y * state.fieldColumns + x;
      state.velocityX[index] -= halfRdx * (samplePressure(state, x + 1, y) - samplePressure(state, x - 1, y));
      state.velocityY[index] -= halfRdx * (samplePressure(state, x, y + 1) - samplePressure(state, x, y - 1));
    }
  }
}

function stepParticles(state: ParticleFluidState, dt: number): void {
  const count = maxParticles(state);
  if (state.count !== count) resetParticles(state, false);
  const scale = simulationScale(state);
  const flowScaleX = 1 / (state.cellSize * aspectRatio(state) * scale);
  const flowScaleY = 1 / (state.cellSize * scale);
  const particleDrag = clamp(finiteNumberSetting(state.settings, 'particleDrag', 1), 0, 1);
  for (let i = 0; i < state.count; i += 1) {
    const index = i * 4;
    const pX = state.particleData[index];
    const pY = state.particleData[index + 1];
    const fieldX = (pX + 1) * 0.5 * state.fieldColumns - 0.5;
    const fieldY = (pY + 1) * 0.5 * state.fieldRows - 0.5;
    const sampledX = sampleScalar(state.velocityX, state.fieldColumns, state.fieldRows, fieldX, fieldY) * flowScaleX;
    const sampledY = sampleScalar(state.velocityY, state.fieldColumns, state.fieldRows, fieldX, fieldY) * flowScaleY;
    const vX = state.particleData[index + 2] + (sampledX - state.particleData[index + 2]) * particleDrag;
    const vY = state.particleData[index + 3] + (sampledY - state.particleData[index + 3]) * particleDrag;
    state.particleData[index] = pX + dt * vX;
    state.particleData[index + 1] = pY + dt * vY;
    state.particleData[index + 2] = vX;
    state.particleData[index + 3] = vY;
  }
}

function simulate(state: ParticleFluidState, dt: number): void {
  ensureField(state);
  const forces = collectForces(state);
  updatePulse(state, forces, dt);
  advectVector(state, dt);
  applyForces(state, dt, forces);
  computeDivergence(state);
  solvePressure(state);
  subtractPressureGradient(state);
  stepParticles(state, dt);
  if (state.pointer.active) {
    state.pointer.previousX = state.pointer.x;
    state.pointer.previousY = state.pointer.y;
  }
}

function bindTexture(gl: WebGL2RenderingContext, unit: number, texture: WebGLTexture, location: WebGLUniformLocation | null): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (location) gl.uniform1i(location, unit);
}

function bindForceSegmentUniforms(
  state: ParticleFluidState,
  forces: ForceSegment[],
  uniform: (name: string) => WebGLUniformLocation | null,
): void {
  const gl = state.gl;
  const count = Math.min(forces.length, MAX_FORCE_SEGMENTS);
  gl.uniform1i(uniform('uForceCount'), count);
  for (let index = 0; index < MAX_FORCE_SEGMENTS; index += 1) {
    const force = forces[index];
    if (force && index < count) {
      gl.uniform4f(
        uniform(`uForceSegments[${index}]`),
        clipToSimX(state, force.x),
        clipToSimY(state, force.y),
        clipToSimX(state, force.previousX),
        clipToSimY(state, force.previousY),
      );
      gl.uniform4f(uniform(`uForceParams[${index}]`), force.strength, 0, 0, 0);
    } else {
      gl.uniform4f(uniform(`uForceSegments[${index}]`), 0, 0, 0, 0);
      gl.uniform4f(uniform(`uForceParams[${index}]`), 0, 0, 0, 0);
    }
  }
}

function bindParticleUniforms(state: ParticleFluidState, program: WebGLProgram): void {
  const gl = state.gl;
  const enhanced = enhancedRenderEnabled(state);
  const bloomStrength = enhanced ? finiteNumberSetting(state.settings, 'bloomStrength', 0.9) : 0;
  const pulseSetting = finiteNumberSetting(state.settings, 'pulseStrength', 1);
  const pulseFade = enhanced ? clamp(1 - state.pulseAge / 1.65, 0, 1) * state.pulseStrength * pulseSetting : 0;
  const pulseColor = paletteColor(state, 3, [1, 1, 1]);
  const slowColor = enhanced
    ? readableParticleColor(paletteColor(state, 0, [40.4 / 300, 0, 35 / 300]), 0.2, 1.18)
    : paletteColor(state, 0, [40.4 / 300, 0, 35 / 300]);
  const fastColor = enhanced
    ? readableParticleColor(paletteColor(state, 1, [0.2 / 100, 47.8 / 100, 1]), 0.46, 1.12)
    : paletteColor(state, 1, [0.2 / 100, 47.8 / 100, 1]);
  const hotColor = enhanced
    ? readableParticleColor(paletteColor(state, 2, [63.1 / 100, 92.5 / 100, 1]), 0.68, 1.08)
    : paletteColor(state, 2, [63.1 / 100, 92.5 / 100, 1]);
  gl.uniform1f(gl.getUniformLocation(program, 'uPointSize'), Math.max(1, finiteNumberSetting(state.settings, 'pointSize', 1)));
  gl.uniform1f(gl.getUniformLocation(program, 'uSpeedColorScale'), Math.max(0, finiteNumberSetting(state.settings, 'colorSpeedScale', 4)));
  gl.uniform3f(gl.getUniformLocation(program, 'uSlowColor'), slowColor[0], slowColor[1], slowColor[2]);
  gl.uniform3f(gl.getUniformLocation(program, 'uFastColor'), fastColor[0], fastColor[1], fastColor[2]);
  gl.uniform3f(gl.getUniformLocation(program, 'uHotColor'), hotColor[0], hotColor[1], hotColor[2]);
  gl.uniform3f(gl.getUniformLocation(program, 'uPulseColor'), pulseColor[0], pulseColor[1], pulseColor[2]);
  gl.uniform1f(gl.getUniformLocation(program, 'uBloomStrength'), bloomStrength);
  gl.uniform1f(gl.getUniformLocation(program, 'uEnhanced'), enhanced ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(program, 'uAspectRatio'), aspectRatio(state));
  gl.uniform1f(gl.getUniformLocation(program, 'uSimulationScale'), simulationScale(state));
  gl.uniform4f(gl.getUniformLocation(program, 'uPulseSegment'), state.pulseX, state.pulseY, state.pulsePreviousX, state.pulsePreviousY);
  gl.uniform4f(
    gl.getUniformLocation(program, 'uPulseParams'),
    Math.max(0.0001, finiteNumberSetting(state.settings, 'forceRadius', 0.015)) * simulationScale(state) * 1.75,
    pulseFade,
    state.pulseSpeed,
    state.pulseAge,
  );
}

function bindFluidCommon(state: ParticleFluidState, uniform: (name: string) => WebGLUniformLocation | null): void {
  const gl = state.gl;
  gl.uniform2f(uniform('uInvResolution'), 1 / Math.max(1, state.fieldColumns), 1 / Math.max(1, state.fieldRows));
  gl.uniform1f(uniform('uAspectRatio'), aspectRatio(state));
  gl.uniform1f(uniform('uSimulationScale'), simulationScale(state));
}

function simulateGpu(state: ParticleFluidState, dt: number): boolean {
  if (!ensureGpuResources(state)) return false;
  const velocity = state.velocityTarget;
  const pressure = state.pressureTarget;
  const divergence = state.divergenceTarget;
  const particleState = state.particleState;
  if (
    !velocity ||
    !pressure ||
    !divergence ||
    !particleState ||
    !state.advectPass ||
    !state.forcePass ||
    !state.divergencePass ||
    !state.pressurePass ||
    !state.gradientPass ||
    !state.particleStepPass
  ) return false;

  const gl = state.gl;
  const forces = collectForces(state);
  updatePulse(state, forces, dt);
  const safeDt = Math.max(0.0001, dt);
  const halfRdx = 0.5 / state.cellSize;
  const rdx = 1 / state.cellSize;
  const scale = simulationScale(state);
  const flowScaleX = 1 / (state.cellSize * aspectRatio(state) * scale);
  const flowScaleY = 1 / (state.cellSize * scale);
  let passes = 0;

  state.advectPass.render({
    target: velocity.write,
    width: state.fieldColumns,
    height: state.fieldRows,
    bind: (_gl, _program, uniform) => {
      bindFluidCommon(state, uniform);
      bindTexture(gl, 0, velocity.read.texture.texture, uniform('uVelocity'));
      bindTexture(gl, 1, velocity.read.texture.texture, uniform('uTarget'));
      gl.uniform1f(uniform('uDt'), dt);
      gl.uniform1f(uniform('uRdx'), rdx);
    },
  });
  velocity.swap();
  passes += 1;

  state.forcePass.render({
    target: velocity.write,
    width: state.fieldColumns,
    height: state.fieldRows,
    bind: (_gl, _program, uniform) => {
      bindFluidCommon(state, uniform);
      bindTexture(gl, 0, velocity.read.texture.texture, uniform('uVelocity'));
      bindForceSegmentUniforms(state, forces, uniform);
      gl.uniform1f(uniform('uDt'), safeDt);
      gl.uniform1f(uniform('uCellSize'), state.cellSize);
      gl.uniform1f(uniform('uVelocityDecay'), clamp(finiteNumberSetting(state.settings, 'velocityDecay', 0.999), 0, 1));
      gl.uniform1f(uniform('uForceRadius'), Math.max(0.0001, finiteNumberSetting(state.settings, 'forceRadius', 0.015)) * scale);
      gl.uniform1f(uniform('uForceTaper'), clamp(finiteNumberSetting(state.settings, 'forceTaper', 0.6), 0, 1));
      gl.uniform1f(uniform('uForceStrength'), finiteNumberSetting(state.settings, 'forceStrength', 1));
      gl.uniform1f(uniform('uForceVelocityScale'), 1 / scale);
    },
  });
  velocity.swap();
  passes += 1;

  state.divergencePass.render({
    target: divergence,
    width: state.fieldColumns,
    height: state.fieldRows,
    bind: (_gl, _program, uniform) => {
      bindFluidCommon(state, uniform);
      bindTexture(gl, 0, velocity.read.texture.texture, uniform('uVelocity'));
      gl.uniform1f(uniform('uHalfRdx'), halfRdx);
    },
  });
  passes += 1;

  const iterations = Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'solverIterations', 18)));
  for (let pass = 0; pass < iterations; pass += 1) {
    state.pressurePass.render({
      target: pressure.write,
      width: state.fieldColumns,
      height: state.fieldRows,
      bind: (_gl, _program, uniform) => {
        bindFluidCommon(state, uniform);
        bindTexture(gl, 0, pressure.read.texture.texture, uniform('uPressure'));
        bindTexture(gl, 1, divergence.texture.texture, uniform('uDivergence'));
        gl.uniform1f(uniform('uAlpha'), -state.cellSize * state.cellSize);
      },
    });
    pressure.swap();
    passes += 1;
  }

  state.gradientPass.render({
    target: velocity.write,
    width: state.fieldColumns,
    height: state.fieldRows,
    bind: (_gl, _program, uniform) => {
      bindFluidCommon(state, uniform);
      bindTexture(gl, 0, pressure.read.texture.texture, uniform('uPressure'));
      bindTexture(gl, 1, velocity.read.texture.texture, uniform('uVelocity'));
      gl.uniform1f(uniform('uHalfRdx'), halfRdx);
    },
  });
  velocity.swap();
  passes += 1;

  particleState.bindWriteFramebuffer();
  state.particleStepPass.render({
    width: state.particleTextureWidth,
    height: state.particleTextureHeight,
    preserveFramebuffer: true,
    bind: (_gl, _program, uniform) => {
      bindTexture(gl, 0, particleState.positions.read.texture.texture, uniform('uParticlePosition'));
      bindTexture(gl, 1, particleState.velocities.read.texture.texture, uniform('uParticleVelocity'));
      bindTexture(gl, 2, velocity.read.texture.texture, uniform('uFlowVelocity'));
      gl.uniform1f(uniform('uDt'), dt);
      gl.uniform1f(uniform('uParticleDrag'), clamp(finiteNumberSetting(state.settings, 'particleDrag', 1), 0, 1));
      gl.uniform2f(uniform('uFlowScale'), flowScaleX, flowScaleY);
    },
  });
  particleState.unbindWriteFramebuffer();
  particleState.swap();
  passes += 1;

  state.gpuPassesLastFrame = passes;
  if (state.pointer.active) {
    state.pointer.previousX = state.pointer.x;
    state.pointer.previousY = state.pointer.y;
  }
  return true;
}

function renderParticles(state: ParticleFluidState): void {
  const gl = state.gl;
  if (!state.cpuParticleProgram || !state.cpuParticleBuffer || state.count <= 0) return;
  gl.useProgram(state.cpuParticleProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.cpuParticleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, state.particleData.subarray(0, state.count * 4), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
  bindParticleUniforms(state, state.cpuParticleProgram);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.SRC_ALPHA);
  gl.drawArrays(gl.POINTS, 0, state.count);
  gl.disable(gl.BLEND);
}

function renderGpuParticles(state: ParticleFluidState): boolean {
  const gl = state.gl;
  const particleState = state.particleState;
  if (!state.gpuParticleProgram || !state.particleUvBuffer || !particleState || state.count <= 0) return false;
  ensureParticleUvBuffer(state);
  gl.useProgram(state.gpuParticleProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleUvBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  bindTexture(gl, 0, particleState.positions.read.texture.texture, gl.getUniformLocation(state.gpuParticleProgram, 'uParticlePosition'));
  bindTexture(gl, 1, particleState.velocities.read.texture.texture, gl.getUniformLocation(state.gpuParticleProgram, 'uParticleVelocity'));
  bindParticleUniforms(state, state.gpuParticleProgram);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.SRC_ALPHA);
  gl.drawArrays(gl.POINTS, 0, state.count);
  gl.disable(gl.BLEND);
  return true;
}

function renderFluid(state: ParticleFluidState): void {
  const gl = state.gl;
  gl.disable(gl.DEPTH_TEST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  const background = colorNumberToRgb(state.style?.background, [0, 0, 0]);
  gl.clearColor(background[0], background[1], background[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (!state.gpuReady || !renderGpuParticles(state)) renderParticles(state);
}

export class RawParticleFluidScene extends RawWebGL2Scene {
  private readonly pendingGestures: GestureEvent[] = [];

  constructor(private readonly preview = false) {
    super({
      name: 'Particle Fluid',
      markup: MARKUP,
      canvasSelector: '[data-particle-fluid-canvas]',
      maxDevicePixelRatio: preview ? 1 : 2,
      onInit: (state) => {
        const s = state as ParticleFluidState;
        s.cpuParticleProgram = link(s.gl, CPU_PARTICLE_VERTEX, PARTICLE_FRAGMENT);
        s.gpuParticleProgram = link(s.gl, GPU_PARTICLE_VERTEX, PARTICLE_FRAGMENT);
        s.cpuParticleBuffer = s.gl.createBuffer();
        s.particleUvBuffer = s.gl.createBuffer();
        s.velocityTarget = null;
        s.pressureTarget = null;
        s.divergenceTarget = null;
        s.particleState = null;
        s.advectPass = new RawGpuFieldPass(s.gl, { vertex: FIELD_VERTEX, fragment: ADVECT_FRAGMENT });
        s.forcePass = new RawGpuFieldPass(s.gl, { vertex: FIELD_VERTEX, fragment: FORCE_FRAGMENT });
        s.divergencePass = new RawGpuFieldPass(s.gl, { vertex: FIELD_VERTEX, fragment: DIVERGENCE_FRAGMENT });
        s.pressurePass = new RawGpuFieldPass(s.gl, { vertex: FIELD_VERTEX, fragment: PRESSURE_FRAGMENT });
        s.gradientPass = new RawGpuFieldPass(s.gl, { vertex: FIELD_VERTEX, fragment: GRADIENT_FRAGMENT });
        s.particleInitPass = new RawGpuFieldPass(s.gl, { vertex: FIELD_VERTEX, fragment: PARTICLE_INIT_FRAGMENT });
        s.particleStepPass = new RawGpuFieldPass(s.gl, { vertex: FIELD_VERTEX, fragment: PARTICLE_STEP_FRAGMENT });
        s.capacity = preview ? 8192 : 4_194_304;
        s.particleData = new Float32Array(s.capacity * 4);
        s.velocityX = new Float32Array(1);
        s.velocityY = new Float32Array(1);
        s.nextVelocityX = new Float32Array(1);
        s.nextVelocityY = new Float32Array(1);
        s.divergence = new Float32Array(1);
        s.pressure = new Float32Array(1);
        s.nextPressure = new Float32Array(1);
        s.fieldColumns = 0;
        s.fieldRows = 0;
        s.fieldResolution = 4;
        s.cellSize = SOURCE_CELL_SIZE;
        s.count = 0;
        s.particleTextureWidth = 1;
        s.particleTextureHeight = 1;
        s.particleUvCapacity = 0;
        s.gpuReady = false;
        s.gpuFallbackReason = '';
        s.gpuPassesLastFrame = 0;
        s.gpuSeedUploadFloats = 0;
        s.pendingGestures = this.pendingGestures;
        s.frameForces = [];
        s.pointer = { active: false, id: -1, x: 0, y: 0, previousX: 0, previousY: 0 };
        s.pulseX = 0;
        s.pulseY = 0;
        s.pulsePreviousX = 0;
        s.pulsePreviousY = 0;
        s.pulseAge = 999;
        s.pulseSpeed = 0;
        s.pulseStrength = 0;
        s.canvas.dataset.pixiLabContextLabel = 'particle-fluid';
        s.cleanupPointer = installPointer(s);
        resetFluid(s, preview);
      },
      onReset: (state) => resetFluid(state as ParticleFluidState, preview),
      onSettingsChange: (state, change) => {
        const s = state as ParticleFluidState;
        if (!change || change.key === 'renderStyle' || change.key === 'bloomStrength' || change.key === 'pulseStrength' || change.key === 'pointSize' || change.key === 'colorSpeedScale') return;
        resetFluid(s, preview);
      },
      render: (state) => {
        const s = state as ParticleFluidState;
        ensureField(s);
        const dt = Math.max(0, s.deltaSeconds);
        if (!simulateGpu(s, dt)) simulate(s, dt);
        renderFluid(s);
      },
      getDebugStats: (state): RawSceneDebugStats => {
        const s = state as ParticleFluidState;
        return {
          renderer: 'raw-webgl2-particle-fluid',
          simulation: s.gpuReady ? 'gpu-source-mapped-velocity-and-particle-textures' : 'cpu-source-mapped-velocity-and-particles',
          rendering: s.gpuReady && enhancedRenderEnabled(s) ? 'gpu-texture-point-particles-with-particle-pulse' : s.gpuReady ? 'gpu-texture-point-particles' : 'cpu-uploaded-point-particles',
          gpuSimulated: s.gpuReady,
          gpuRendered: true,
          cpuTopology: false,
          cpuUpload: !s.gpuReady,
          particles: s.count,
          maxParticles: maxParticles(s),
          particleTexture: `${s.particleTextureWidth}x${s.particleTextureHeight}`,
          flowField: `${s.fieldColumns}x${s.fieldRows}`,
          simulationScale: Math.round(simulationScale(s) * 100) / 100,
          cellSize: s.cellSize,
          velocityDecay: Math.round(finiteNumberSetting(s.settings, 'velocityDecay', 0.999) * 10000) / 10000,
          pressureIterations: Math.floor(finiteNumberSetting(s.settings, 'solverIterations', 18)),
          fluidPasses: s.gpuReady ? s.gpuPassesLastFrame - 1 : 0,
          gpuPasses: s.gpuReady ? s.gpuPassesLastFrame : 0,
          renderStyle: enhancedRenderEnabled(s) ? 'enhanced' : 'basic',
          dyeField: false,
          bloomStrength: enhancedRenderEnabled(s) ? Math.round(finiteNumberSetting(s.settings, 'bloomStrength', 0.9) * 100) / 100 : 0,
          pulseStrength: enhancedRenderEnabled(s) ? Math.round(finiteNumberSetting(s.settings, 'pulseStrength', 1) * 100) / 100 : 0,
          gpuSeedUploadFloats: s.gpuSeedUploadFloats,
          cpuUploadFloats: s.gpuReady ? 0 : s.count * 4,
          gpuFallbackReason: s.gpuFallbackReason,
          preview: this.preview,
        };
      },
      onDestroy: (state) => {
        const s = state as ParticleFluidState;
        s.cleanupPointer?.();
        destroyGpuResources(s);
        s.advectPass?.destroy();
        s.forcePass?.destroy();
        s.divergencePass?.destroy();
        s.pressurePass?.destroy();
        s.gradientPass?.destroy();
        s.particleInitPass?.destroy();
        s.particleStepPass?.destroy();
        if (s.cpuParticleBuffer) s.gl.deleteBuffer(s.cpuParticleBuffer);
        if (s.particleUvBuffer) s.gl.deleteBuffer(s.particleUvBuffer);
        if (s.cpuParticleProgram) s.gl.deleteProgram(s.cpuParticleProgram);
        if (s.gpuParticleProgram) s.gl.deleteProgram(s.gpuParticleProgram);
      },
    });
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.pendingGestures.push(...gestures);
  }
}
