import {
  RawWebGL2Scene,
  colorNumberToRgb,
  finiteNumberSetting,
  type GestureEvent,
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

interface ParticleFluidState extends RawWebGL2RenderState {
  particleProgram: WebGLProgram | null;
  fieldProgram: WebGLProgram | null;
  particleBuffer: WebGLBuffer | null;
  quadBuffer: WebGLBuffer | null;
  dyeTexture: WebGLTexture | null;
  particleData: Float32Array;
  flowX: Float32Array;
  flowY: Float32Array;
  nextFlowX: Float32Array;
  nextFlowY: Float32Array;
  dye: Float32Array;
  nextDye: Float32Array;
  divergence: Float32Array;
  pressure: Float32Array;
  nextPressure: Float32Array;
  fieldPixels: Uint8Array;
  fieldColumns: number;
  fieldRows: number;
  fieldCellSize: number;
  capacity: number;
  count: number;
  seed: number;
  pointer: PointerState;
  pendingGestures: GestureEvent[];
  modeId: string;
  cleanupPointer?: () => void;
}

const MARKUP = `
  <canvas data-particle-fluid-canvas class="absolute inset-0 h-full w-full touch-none"></canvas>
  <div data-particle-fluid-feedback class="pointer-events-none absolute left-0 top-0 hidden rounded-full border border-white/35 bg-white/10"></div>
`;

const FIELD_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FIELD_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uDye;
uniform vec3 uBackground;
uniform float uFieldStrength;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 fieldUv = vec2(vUv.x, 1.0 - vUv.y);
  vec3 dye = texture(uDye, fieldUv).rgb;
  float vignette = smoothstep(0.86, 0.16, distance(vUv, vec2(0.5)));
  outColor = vec4(uBackground + dye * uFieldStrength * (0.52 + vignette * 0.48), 1.0);
}`;

const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec4 aData;
uniform vec2 uResolution;
uniform float uPointScale;
out float vSpeed;
out float vDye;
out float vSeed;
void main() {
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vSpeed = length(aData.xy);
  vDye = aData.w;
  vSeed = fract(aPosition.x * 0.013 + aPosition.y * 0.017 + aData.w);
  gl_PointSize = max(1.0, aData.z * uPointScale);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uInk;
uniform vec3 uGlow;
uniform vec3 uFoam;
uniform float uOpacity;
uniform float uRenderStyle;
uniform float uBloomPass;
in float vSpeed;
in float vDye;
in float vSeed;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  float speed = clamp(vSpeed / 980.0, 0.0, 1.0);
  float dye = clamp(vDye, 0.0, 1.0);
  float sparkle = fract(sin(vSeed * 183.17) * 43758.5453) * 0.035;
  if (uBloomPass > 0.5) {
    if (d2 > 1.0) discard;
    float halo = exp(-d2 * 2.45) * (1.0 - smoothstep(0.74, 1.0, d2)) * (0.18 + speed * 0.82);
    vec3 bloomColor = mix(uGlow, uFoam, pow(speed, 2.0) * 0.28 + dye * 0.12);
    outColor = vec4(bloomColor * (0.72 + speed * 0.56), halo * uOpacity * 0.34);
    return;
  }
  vec3 sourcePurple = vec3(0.18, 0.035, 0.22);
  vec3 motionColor = mix(sourcePurple + uGlow * 0.18, uGlow * 1.15 + uFoam * 0.08, speed);
  vec3 color = motionColor + uGlow * (0.08 + dye * 0.34) + uFoam * pow(speed, 3.0) * 0.18;
  float alpha = uOpacity * (0.82 + speed * 0.18);
  if (uRenderStyle > 1.5) {
    if (d2 > 1.0) discard;
    alpha *= 1.0 - smoothstep(0.64, 1.0, d2);
    color = mix(uInk, uFoam, 0.35 + speed * 0.65);
  } else if (uRenderStyle > 0.5) {
    if (d2 > 1.0) discard;
    alpha *= max(0.36, exp(-d2 * 1.6));
    color += uGlow * (0.18 + speed * 0.26);
  }
  outColor = vec4(color * (1.0 + sparkle), alpha);
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

function random(seed: number): [number, number] {
  let next = seed | 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return [(next >>> 0) / 4294967296, next | 0];
}

function maxParticles(state: ParticleFluidState): number {
  return Math.min(state.capacity, Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'maxParticles', 262144))));
}

function particleRadius(state: ParticleFluidState): number {
  return finiteNumberSetting(state.settings, 'particleRadius', 1.05);
}

function styleUniformNumber(state: ParticleFluidState, key: string, fallback: number): number {
  const uniforms = state.style?.uniforms;
  if (!uniforms || typeof uniforms !== 'object') return fallback;
  const value = (uniforms as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function fieldIndex(state: ParticleFluidState, x: number, y: number): number {
  const cx = clamp(Math.floor(x), 0, state.fieldColumns - 1);
  const cy = clamp(Math.floor(y), 0, state.fieldRows - 1);
  return cy * state.fieldColumns + cx;
}

function sampleScalar(state: ParticleFluidState, data: Float32Array, x: number, y: number): number {
  const x0 = clamp(Math.floor(x), 0, state.fieldColumns - 1);
  const y0 = clamp(Math.floor(y), 0, state.fieldRows - 1);
  const x1 = Math.min(state.fieldColumns - 1, x0 + 1);
  const y1 = Math.min(state.fieldRows - 1, y0 + 1);
  const tx = clamp(x - x0, 0, 1);
  const ty = clamp(y - y0, 0, 1);
  const i00 = y0 * state.fieldColumns + x0;
  const i10 = y0 * state.fieldColumns + x1;
  const i01 = y1 * state.fieldColumns + x0;
  const i11 = y1 * state.fieldColumns + x1;
  const a = data[i00] * (1 - tx) + data[i10] * tx;
  const b = data[i01] * (1 - tx) + data[i11] * tx;
  return a * (1 - ty) + b * ty;
}

function sampleFlowAtParticle(state: ParticleFluidState, x: number, y: number): [number, number, number] {
  const gx = x / Math.max(1, state.fieldCellSize);
  const gy = y / Math.max(1, state.fieldCellSize);
  return [
    sampleScalar(state, state.flowX, gx, gy),
    sampleScalar(state, state.flowY, gx, gy),
    sampleScalar(state, state.dye, gx, gy),
  ];
}

function ensureField(state: ParticleFluidState): void {
  const requestedCellSize = Math.max(4, finiteNumberSetting(state.settings, 'fieldCellSize', 7));
  const columns = Math.max(8, Math.ceil(state.width / requestedCellSize));
  const rows = Math.max(8, Math.ceil(state.height / requestedCellSize));
  if (columns === state.fieldColumns && rows === state.fieldRows && requestedCellSize === state.fieldCellSize) return;
  const cells = columns * rows;
  state.fieldColumns = columns;
  state.fieldRows = rows;
  state.fieldCellSize = requestedCellSize;
  state.flowX = new Float32Array(cells);
  state.flowY = new Float32Array(cells);
  state.nextFlowX = new Float32Array(cells);
  state.nextFlowY = new Float32Array(cells);
  state.dye = new Float32Array(cells);
  state.nextDye = new Float32Array(cells);
  state.divergence = new Float32Array(cells);
  state.pressure = new Float32Array(cells);
  state.nextPressure = new Float32Array(cells);
  state.fieldPixels = new Uint8Array(cells * 4);
  seedField(state);
}

function seedField(state: ParticleFluidState): void {
  const cx = state.fieldColumns * 0.5;
  const cy = state.fieldRows * 0.5;
  for (let y = 0; y < state.fieldRows; y += 1) {
    for (let x = 0; x < state.fieldColumns; x += 1) {
      const i = y * state.fieldColumns + x;
      const ox = x - cx;
      const oy = y - cy;
      const dist = Math.max(1, Math.hypot(ox, oy));
      const halo = Math.exp(-((dist / Math.max(1, Math.min(cx, cy) * 0.8)) ** 2));
      state.flowX[i] = -oy / dist * halo * 22;
      state.flowY[i] = ox / dist * halo * 22;
      state.dye[i] = halo * 0.11;
    }
  }
}

function resetFluid(state: ParticleFluidState, preview: boolean): void {
  ensureField(state);
  state.count = 0;
  state.flowX.fill(0);
  state.flowY.fill(0);
  state.dye.fill(0);
  seedField(state);
  if (state.width <= 1 || state.height <= 1) return;
  const radius = particleRadius(state);
  const target = Math.min(maxParticles(state), preview ? Math.min(8192, maxParticles(state)) : maxParticles(state));
  const columns = Math.max(1, Math.ceil(Math.sqrt(target * state.width / Math.max(1, state.height))));
  const rows = Math.max(1, Math.ceil(target / columns));
  for (let i = 0; i < target; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    let r = 0;
    [r, state.seed] = random(state.seed + i * 29);
    const jitterX = (r - 0.5) * state.width / columns * 0.7;
    [r, state.seed] = random(state.seed + 41);
    const jitterY = (r - 0.5) * state.height / rows * 0.7;
    const x = (col + 0.5) / columns * state.width + jitterX;
    const y = (row + 0.5) / rows * state.height + jitterY;
    const dx = x - state.width * 0.5;
    const dy = y - state.height * 0.5;
    const distance = Math.max(90, Math.hypot(dx, dy));
    const swirl = 14 + r * 18;
    addParticle(state, x, y, -dy / distance * swirl, dx / distance * swirl, radius, 0.08 + r * 0.1);
  }
}

function addParticle(state: ParticleFluidState, x: number, y: number, vx: number, vy: number, radius: number, dye: number): void {
  if (state.count >= maxParticles(state)) return;
  const index = state.count * 6;
  const padding = containmentPadding(state);
  state.particleData[index] = clamp(x, padding, Math.max(padding, state.width - padding));
  state.particleData[index + 1] = clamp(y, padding, Math.max(padding, state.height - padding));
  state.particleData[index + 2] = vx;
  state.particleData[index + 3] = vy;
  state.particleData[index + 4] = radius;
  state.particleData[index + 5] = clamp(dye, 0, 1);
  state.count += 1;
}

function pointerXY(canvas: HTMLCanvasElement, event: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(1, rect.width);
  const sy = canvas.height / Math.max(1, rect.height);
  return [(event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy];
}

function installPointer(state: ParticleFluidState): () => void {
  const feedback = state.canvas.parentElement?.querySelector<HTMLDivElement>('[data-particle-fluid-feedback]') ?? null;
  const down = (event: PointerEvent) => {
    const [x, y] = pointerXY(state.canvas, event);
    state.pointer = { active: true, id: event.pointerId, x, y, previousX: x, previousY: y };
    state.canvas.setPointerCapture(event.pointerId);
    applyInput(state, x, y, 0, 0, 1);
  };
  const move = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    const [x, y] = pointerXY(state.canvas, event);
    const dx = x - state.pointer.x;
    const dy = y - state.pointer.y;
    state.pointer.previousX = state.pointer.x;
    state.pointer.previousY = state.pointer.y;
    state.pointer.x = x;
    state.pointer.y = y;
    applyInput(state, x, y, dx, dy, 1);
  };
  const up = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    state.pointer.active = false;
    feedback?.classList.add('hidden');
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

function updateFeedback(state: ParticleFluidState): void {
  const feedback = state.canvas.parentElement?.querySelector<HTMLDivElement>('[data-particle-fluid-feedback]');
  if (!feedback) return;
  if (!state.pointer.active) {
    feedback.classList.add('hidden');
    return;
  }
  const radius = finiteNumberSetting(state.settings, 'inputRadius', 74);
  const rect = state.canvas.getBoundingClientRect();
  const sx = rect.width / Math.max(1, state.width);
  const sy = rect.height / Math.max(1, state.height);
  const cssX = state.pointer.x * sx;
  const cssY = state.pointer.y * sy;
  const cssR = radius * Math.max(sx, sy);
  feedback.classList.remove('hidden');
  feedback.style.width = `${cssR * 2}px`;
  feedback.style.height = `${cssR * 2}px`;
  feedback.style.transform = `translate(${cssX - cssR}px, ${cssY - cssR}px)`;
  feedback.style.borderColor = state.modeId === 'repel' ? 'rgba(248, 250, 252, 0.42)' : 'rgba(34, 211, 238, 0.42)';
  feedback.style.backgroundColor = state.modeId === 'inject' ? 'rgba(217, 70, 239, 0.14)' : 'rgba(14, 165, 233, 0.11)';
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number, number, number] {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0.0001 ? clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1) : 1;
  const sx = ax + vx * t;
  const sy = ay + vy * t;
  return [Math.hypot(px - sx, py - sy), t, sx, sy];
}

function applyInput(state: ParticleFluidState, x: number, y: number, dx: number, dy: number, strength: number): void {
  ensureField(state);
  const radius = finiteNumberSetting(state.settings, 'inputRadius', 74);
  const force = finiteNumberSetting(state.settings, 'inputForce', 18) * clamp(strength, 0.2, 2.8);
  const spread = finiteNumberSetting(state.settings, 'dyeSpread', 0.16);
  const mode = state.modeId;
  const ax = x - dx;
  const ay = y - dy;
  const minX = clamp(Math.floor((Math.min(ax, x) - radius) / state.fieldCellSize), 0, state.fieldColumns - 1);
  const maxX = clamp(Math.ceil((Math.max(ax, x) + radius) / state.fieldCellSize), 0, state.fieldColumns - 1);
  const minY = clamp(Math.floor((Math.min(ay, y) - radius) / state.fieldCellSize), 0, state.fieldRows - 1);
  const maxY = clamp(Math.ceil((Math.max(ay, y) + radius) / state.fieldCellSize), 0, state.fieldRows - 1);
  const speed = Math.hypot(dx, dy);
  for (let gy = minY; gy <= maxY; gy += 1) {
    for (let gx = minX; gx <= maxX; gx += 1) {
      const px = (gx + 0.5) * state.fieldCellSize;
      const py = (gy + 0.5) * state.fieldCellSize;
      const [distance, segmentT, sx, sy] = distanceToSegment(px, py, ax, ay, x, y);
      if (distance > radius) continue;
      const projected = 1 - segmentT * 0.6;
      const falloff = Math.exp(-distance / Math.max(1, radius * 0.24)) * projected * projected;
      const i = gy * state.fieldColumns + gx;
      if (mode === 'repel') {
        const ox = px - x;
        const oy = py - y;
        const d = Math.max(1, Math.hypot(ox, oy));
        state.flowX[i] += ox / d * force * 52 * falloff;
        state.flowY[i] += oy / d * force * 52 * falloff;
      } else {
        const targetVx = dx * force * 5.6;
        const targetVy = dy * force * 5.6;
        const swirl = mode === 'vortex' ? force * 22 : force * 7;
        const ox = px - sx;
        const oy = py - sy;
        const d = Math.max(1, Math.hypot(ox, oy));
        state.flowX[i] += (targetVx - state.flowX[i]) * falloff + -oy / d * swirl * falloff;
        state.flowY[i] += (targetVy - state.flowY[i]) * falloff + ox / d * swirl * falloff;
        state.dye[i] = clamp(state.dye[i] + spread * falloff * (1.2 + speed * 0.035), 0, 1.8);
      }
    }
  }

  if (mode !== 'inject') return;
  const radiusSetting = particleRadius(state);
  const rate = finiteNumberSetting(state.settings, 'injectRate', 260);
  const spawnCount = Math.min(160, Math.max(8, Math.floor(rate / 36 * clamp(strength, 0.35, 2.2))));
  for (let i = 0; i < spawnCount; i += 1) {
    let r = 0;
    [r, state.seed] = random(state.seed + i * 17 + state.frame);
    const angle = r * Math.PI * 2;
    [r, state.seed] = random(state.seed + 31);
    const distance = Math.sqrt(r) * radius * 0.18;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    addParticle(state, px, py, dx * 15 + Math.cos(angle) * 110, dy * 15 + Math.sin(angle) * 110, radiusSetting, 0.7 + r * 0.3);
  }
}

function applyGestures(state: ParticleFluidState): void {
  while (state.pendingGestures.length > 0) {
    const gesture = state.pendingGestures.shift();
    if (!gesture) continue;
    applyInput(state, gesture.x, gesture.y, gesture.dx ?? 0, gesture.dy ?? 0, gesture.strength ?? 1);
  }
}

function advectField(state: ParticleFluidState, dt: number): void {
  const drag = finiteNumberSetting(state.settings, 'drag', 0.025);
  const viscosity = finiteNumberSetting(state.settings, 'viscosity', 0.12);
  const velocityDamping = Math.pow(clamp(0.999 - drag * 0.16, 0.94, 0.999), dt * 60);
  const dyeFade = Math.pow(clamp(0.986 - viscosity * 0.018, 0.94, 0.995), dt * 60);
  for (let y = 0; y < state.fieldRows; y += 1) {
    for (let x = 0; x < state.fieldColumns; x += 1) {
      const i = y * state.fieldColumns + x;
      const bx = x - state.flowX[i] * dt / Math.max(1, state.fieldCellSize);
      const by = y - state.flowY[i] * dt / Math.max(1, state.fieldCellSize);
      const vx = sampleScalar(state, state.flowX, bx, by);
      const vy = sampleScalar(state, state.flowY, bx, by);
      const curl = Math.sin(state.timeSeconds * 0.57 + x * 0.19 + y * 0.13) * finiteNumberSetting(state.settings, 'vorticity', 0.48);
      state.nextFlowX[i] = (vx + -vy * curl * 0.018) * velocityDamping;
      state.nextFlowY[i] = (vy + vx * curl * 0.018) * velocityDamping;
      state.nextDye[i] = sampleScalar(state, state.dye, bx, by) * dyeFade;
    }
  }
  [state.flowX, state.nextFlowX] = [state.nextFlowX, state.flowX];
  [state.flowY, state.nextFlowY] = [state.nextFlowY, state.flowY];
  [state.dye, state.nextDye] = [state.nextDye, state.dye];
  containField(state);
}

function projectField(state: ParticleFluidState): void {
  const w = state.fieldColumns;
  const h = state.fieldRows;
  const cell = Math.max(1, state.fieldCellSize);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const l = fieldIndex(state, x - 1, y);
      const r = fieldIndex(state, x + 1, y);
      const b = fieldIndex(state, x, y - 1);
      const t = fieldIndex(state, x, y + 1);
      state.divergence[i] = -0.5 * ((state.flowX[r] - state.flowX[l]) + (state.flowY[t] - state.flowY[b])) / cell;
      state.pressure[i] = 0;
    }
  }
  const iterations = Math.max(4, Math.floor(finiteNumberSetting(state.settings, 'solverIterations', 18)));
  for (let pass = 0; pass < iterations; pass += 1) {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        const l = fieldIndex(state, x - 1, y);
        const r = fieldIndex(state, x + 1, y);
        const b = fieldIndex(state, x, y - 1);
        const t = fieldIndex(state, x, y + 1);
        state.nextPressure[i] = (state.pressure[l] + state.pressure[r] + state.pressure[b] + state.pressure[t] + state.divergence[i]) * 0.25;
      }
    }
    [state.pressure, state.nextPressure] = [state.nextPressure, state.pressure];
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const l = fieldIndex(state, x - 1, y);
      const r = fieldIndex(state, x + 1, y);
      const b = fieldIndex(state, x, y - 1);
      const t = fieldIndex(state, x, y + 1);
      state.flowX[i] -= (state.pressure[r] - state.pressure[l]) * 0.5 * cell;
      state.flowY[i] -= (state.pressure[t] - state.pressure[b]) * 0.5 * cell;
    }
  }
  containField(state);
}

function simulateParticles(state: ParticleFluidState, dt: number): void {
  if (state.count > maxParticles(state)) state.count = maxParticles(state);
  const data = state.particleData;
  const coupling = finiteNumberSetting(state.settings, 'fluidTightness', 1);
  const radius = particleRadius(state);
  for (let i = 0; i < state.count; i += 1) {
    const k = i * 6;
    const [fx, fy, dye] = sampleFlowAtParticle(state, data[k], data[k + 1]);
    const blend = clamp(coupling, 0.05, 1.35);
    data[k + 2] += (fx - data[k + 2]) * blend;
    data[k + 3] += (fy - data[k + 3]) * blend;
    applySoftBoundaryForce(state, data, k, dt);
    data[k] += data[k + 2] * dt;
    data[k + 1] += data[k + 3] * dt;
    containParticle(state, data, k);
    data[k + 4] += (radius - data[k + 4]) * Math.min(1, dt * 4);
    data[k + 5] = clamp(data[k + 5] * 0.994 + dye * 0.018, 0, 1);
  }
}

function containmentPadding(state: ParticleFluidState): number {
  return Math.max(2, particleRadius(state) * 1.8);
}

function containmentMargin(state: ParticleFluidState): number {
  return Math.max(34, particleRadius(state) * 16);
}

function applySoftBoundaryForce(state: ParticleFluidState, data: Float32Array, index: number, dt: number): void {
  const margin = containmentMargin(state);
  const padding = containmentPadding(state);
  const x = data[index];
  const y = data[index + 1];
  const maxX = Math.max(padding, state.width - padding);
  const maxY = Math.max(padding, state.height - padding);
  const wallAcceleration = 4200;
  const tangentDamping = 0.985;
  if (x < margin) {
    const t = ((margin - x) / margin) ** 2;
    data[index + 2] += wallAcceleration * t * dt;
    data[index + 3] *= tangentDamping;
  } else if (x > maxX - margin) {
    const t = ((x - (maxX - margin)) / margin) ** 2;
    data[index + 2] -= wallAcceleration * t * dt;
    data[index + 3] *= tangentDamping;
  }
  if (y < margin) {
    const t = ((margin - y) / margin) ** 2;
    data[index + 3] += wallAcceleration * t * dt;
    data[index + 2] *= tangentDamping;
  } else if (y > maxY - margin) {
    const t = ((y - (maxY - margin)) / margin) ** 2;
    data[index + 3] -= wallAcceleration * t * dt;
    data[index + 2] *= tangentDamping;
  }
}

function containParticle(state: ParticleFluidState, data: Float32Array, index: number): void {
  const padding = containmentPadding(state);
  const minX = padding;
  const minY = padding;
  const maxX = Math.max(minX, state.width - padding);
  const maxY = Math.max(minY, state.height - padding);
  const bounce = 0.46;
  const wallDrag = 0.86;
  const releaseSpeed = 48;
  if (data[index] < minX) {
    data[index] = minX;
    data[index + 2] = Math.max(Math.abs(data[index + 2]) * bounce, releaseSpeed);
    data[index + 3] *= wallDrag;
  } else if (data[index] > maxX) {
    data[index] = maxX;
    data[index + 2] = -Math.max(Math.abs(data[index + 2]) * bounce, releaseSpeed);
    data[index + 3] *= wallDrag;
  }
  if (data[index + 1] < minY) {
    data[index + 1] = minY;
    data[index + 3] = Math.max(Math.abs(data[index + 3]) * bounce, releaseSpeed);
    data[index + 2] *= wallDrag;
  } else if (data[index + 1] > maxY) {
    data[index + 1] = maxY;
    data[index + 3] = -Math.max(Math.abs(data[index + 3]) * bounce, releaseSpeed);
    data[index + 2] *= wallDrag;
  }
}

function containField(state: ParticleFluidState): void {
  const w = state.fieldColumns;
  const h = state.fieldRows;
  if (w <= 1 || h <= 1) return;
  const layers = Math.min(5, Math.floor(Math.min(w, h) * 0.5));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const layer = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (layer >= layers) continue;
      constrainBoundaryCell(state, x, y, (layers - layer) / layers);
    }
  }
}

function constrainBoundaryCell(state: ParticleFluidState, x: number, y: number, strength: number): void {
  const w = state.fieldColumns;
  const h = state.fieldRows;
  const index = y * w + x;
  const reflect = 0.22 + strength * 0.08;
  const tangent = 1 - strength * 0.055;
  if (x < 1 && state.flowX[index] < 0) state.flowX[index] = -state.flowX[index] * reflect;
  if (x > w - 2 && state.flowX[index] > 0) state.flowX[index] = -state.flowX[index] * reflect;
  if (y < 1 && state.flowY[index] < 0) state.flowY[index] = -state.flowY[index] * reflect;
  if (y > h - 2 && state.flowY[index] > 0) state.flowY[index] = -state.flowY[index] * reflect;
  if (x < 2 || x > w - 3) state.flowY[index] *= tangent;
  if (y < 2 || y > h - 3) state.flowX[index] *= tangent;
  state.dye[index] *= 1 - strength * 0.025;
}

function simulate(state: ParticleFluidState, dt: number): void {
  ensureField(state);
  advectField(state, dt);
  projectField(state);
  simulateParticles(state, dt);
}

function updateFieldTexture(state: ParticleFluidState): void {
  const style = state.style;
  const palette = style?.palette ?? [0x061a2e, 0x00d4ff, 0xff4fd8, 0xffffff];
  const ink = colorNumberToRgb(palette[0], [0.02, 0.1, 0.18]);
  const glow = colorNumberToRgb(palette[1], [0.0, 0.83, 1.0]);
  const foam = colorNumberToRgb(palette[2] ?? palette[3], [1.0, 0.31, 0.85]);
  const fieldGain = styleUniformNumber(state, 'fieldGain', 1);
  for (let i = 0; i < state.dye.length; i += 1) {
    const speed = clamp(Math.hypot(state.flowX[i], state.flowY[i]) / 800, 0, 1);
    const dye = clamp(state.dye[i], 0, 1);
    const hot = Math.pow(speed, 2.2) * 0.18;
    const r = ink[0] * 0.12 + glow[0] * dye * 1.45 * fieldGain + foam[0] * hot;
    const g = ink[1] * 0.12 + glow[1] * dye * 1.45 * fieldGain + foam[1] * hot;
    const b = ink[2] * 0.12 + glow[2] * dye * 1.45 * fieldGain + foam[2] * hot;
    const k = i * 4;
    state.fieldPixels[k] = Math.round(clamp(r, 0, 1) * 255);
    state.fieldPixels[k + 1] = Math.round(clamp(g, 0, 1) * 255);
    state.fieldPixels[k + 2] = Math.round(clamp(b, 0, 1) * 255);
    state.fieldPixels[k + 3] = 255;
  }
  const gl = state.gl;
  gl.bindTexture(gl.TEXTURE_2D, state.dyeTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, state.fieldColumns, state.fieldRows, 0, gl.RGBA, gl.UNSIGNED_BYTE, state.fieldPixels);
}

function renderField(state: ParticleFluidState): void {
  const gl = state.gl;
  if (!state.fieldProgram || !state.quadBuffer || !state.dyeTexture) return;
  updateFieldTexture(state);
  const bg = colorNumberToRgb(state.style?.background, [0.01, 0.02, 0.04]);
  gl.useProgram(state.fieldProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.dyeTexture);
  gl.uniform1i(gl.getUniformLocation(state.fieldProgram, 'uDye'), 0);
  gl.uniform3f(gl.getUniformLocation(state.fieldProgram, 'uBackground'), bg[0], bg[1], bg[2]);
  gl.uniform1f(gl.getUniformLocation(state.fieldProgram, 'uFieldStrength'), finiteNumberSetting(state.settings, 'metaballBlend', 0.86) * styleUniformNumber(state, 'fieldStrength', 1));
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function renderParticles(state: ParticleFluidState): void {
  const gl = state.gl;
  const style = state.style;
  const palette = style?.palette ?? [0x061a2e, 0x00d4ff, 0xff4fd8, 0xffffff];
  if (!state.particleProgram || !state.particleBuffer || state.count <= 0) return;
  const renderStyle = typeof state.settings.renderStyle === 'string' ? state.settings.renderStyle : 'dye';
  const pointScale = styleUniformNumber(state, 'pointScale', 1);
  const bloomStrength = styleUniformNumber(state, 'bloomStrength', 1);
  const opacity = finiteNumberSetting(state.settings, 'opacity', 0.92);
  gl.enable(gl.BLEND);
  gl.useProgram(state.particleProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, state.particleData.subarray(0, state.count * 6), gl.DYNAMIC_DRAW);
  gl.uniform2f(gl.getUniformLocation(state.particleProgram, 'uResolution'), state.width, state.height);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uPointScale'), (renderStyle === 'droplets' ? 2.2 : renderStyle === 'plasma' ? 2.6 : 1.25) * pointScale);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uOpacity'), opacity);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uRenderStyle'), renderStyle === 'plasma' ? 1 : renderStyle === 'droplets' ? 2 : 0);
  const ink = colorNumberToRgb(palette[0], [0.02, 0.1, 0.18]);
  const glow = colorNumberToRgb(palette[1], [0.0, 0.83, 1.0]);
  const foam = colorNumberToRgb(palette[2] ?? palette[3], [1.0, 0.31, 0.85]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uInk'), ink[0], ink[1], ink[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uGlow'), glow[0], glow[1], glow[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uFoam'), foam[0], foam[1], foam[2]);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
  if (bloomStrength > 0.02 && renderStyle !== 'droplets') {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uBloomPass'), 1);
    gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uPointScale'), (renderStyle === 'plasma' ? 9.2 : 6.8) * pointScale);
    gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uOpacity'), opacity * bloomStrength);
    gl.drawArrays(gl.POINTS, 0, state.count);
  }
  gl.blendFunc(gl.SRC_ALPHA, renderStyle === 'droplets' ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uBloomPass'), 0);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uPointScale'), (renderStyle === 'droplets' ? 2.2 : renderStyle === 'plasma' ? 2.6 : 1.25) * pointScale);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uOpacity'), opacity);
  gl.drawArrays(gl.POINTS, 0, state.count);
  gl.disable(gl.BLEND);
}

function renderFluid(state: ParticleFluidState): void {
  const gl = state.gl;
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  renderField(state);
  renderParticles(state);
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
        s.particleProgram = link(s.gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
        s.fieldProgram = link(s.gl, FIELD_VERTEX, FIELD_FRAGMENT);
        s.particleBuffer = s.gl.createBuffer();
        s.quadBuffer = s.gl.createBuffer();
        s.dyeTexture = s.gl.createTexture();
        s.capacity = preview ? 8192 : 1_048_576;
        s.particleData = new Float32Array(s.capacity * 6);
        s.flowX = new Float32Array(1);
        s.flowY = new Float32Array(1);
        s.nextFlowX = new Float32Array(1);
        s.nextFlowY = new Float32Array(1);
        s.dye = new Float32Array(1);
        s.nextDye = new Float32Array(1);
        s.divergence = new Float32Array(1);
        s.pressure = new Float32Array(1);
        s.nextPressure = new Float32Array(1);
        s.fieldPixels = new Uint8Array(4);
        s.fieldColumns = 0;
        s.fieldRows = 0;
        s.fieldCellSize = 7;
        s.count = 0;
        s.seed = 0x5f17d1;
        s.pendingGestures = this.pendingGestures;
        s.modeId = 'vortex';
        s.pointer = { active: false, id: -1, x: 0, y: 0, previousX: 0, previousY: 0 };
        s.canvas.dataset.pixiLabContextLabel = 'particle-fluid';
        s.gl.bindBuffer(s.gl.ARRAY_BUFFER, s.quadBuffer);
        s.gl.bufferData(s.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), s.gl.STATIC_DRAW);
        s.gl.bindTexture(s.gl.TEXTURE_2D, s.dyeTexture);
        s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_MIN_FILTER, s.gl.LINEAR);
        s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_MAG_FILTER, s.gl.LINEAR);
        s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_WRAP_S, s.gl.CLAMP_TO_EDGE);
        s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_WRAP_T, s.gl.CLAMP_TO_EDGE);
        s.cleanupPointer = installPointer(s);
        resetFluid(s, preview);
      },
      onReset: (state) => resetFluid(state as ParticleFluidState, preview),
      onModeChange: (state, mode) => {
        (state as ParticleFluidState).modeId = mode === 'demo' ? 'vortex' : mode;
      },
      render: (state) => {
        const s = state as ParticleFluidState;
        ensureField(s);
        if (s.count <= 0) resetFluid(s, preview);
        applyGestures(s);
        updateFeedback(s);
        const dt = Math.min(1 / 24, Math.max(0, s.deltaSeconds));
        const substeps = Math.max(1, Math.floor(finiteNumberSetting(s.settings, 'substeps', 1)));
        for (let i = 0; i < substeps; i += 1) simulate(s, dt / substeps);
        renderFluid(s);
      },
      getDebugStats: (state): RawSceneDebugStats => {
        const s = state as ParticleFluidState;
        return {
          renderer: 'raw-webgl2-particle-fluid',
          simulation: 'cpu-projected-flow-field-particles',
          rendering: 'gpu-additive-point-particles-and-dye-field',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: true,
          particles: s.count,
          maxParticles: maxParticles(s),
          particleRadius: Math.round(particleRadius(s) * 100) / 100,
          flowField: `${s.fieldColumns}x${s.fieldRows}`,
          fieldCellSize: Math.round(s.fieldCellSize * 100) / 100,
          pressureIterations: Math.floor(finiteNumberSetting(s.settings, 'solverIterations', 18)),
          cpuUploadFloats: s.count * 6,
          renderStyle: typeof s.settings.renderStyle === 'string' ? s.settings.renderStyle : 'dye',
          mode: s.modeId,
          preview: this.preview,
        };
      },
      onDestroy: (state) => {
        const s = state as ParticleFluidState;
        s.cleanupPointer?.();
        if (s.particleBuffer) s.gl.deleteBuffer(s.particleBuffer);
        if (s.quadBuffer) s.gl.deleteBuffer(s.quadBuffer);
        if (s.dyeTexture) s.gl.deleteTexture(s.dyeTexture);
        if (s.particleProgram) s.gl.deleteProgram(s.particleProgram);
        if (s.fieldProgram) s.gl.deleteProgram(s.fieldProgram);
      },
    });
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.pendingGestures.push(...gestures);
  }
}
