import {
  RawWebGL2Scene,
  colorNumberToRgb,
  finiteNumberSetting,
  type GestureEvent,
  type RawSceneDebugStats,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';

export type ParticleMetaballPreset = 'lava-lamp' | 'water-tank';

interface PointerState {
  active: boolean;
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
}

interface ParticleMetaballState extends RawWebGL2RenderState {
  particleProgram: WebGLProgram | null;
  obstacleProgram: WebGLProgram | null;
  particleBuffer: WebGLBuffer | null;
  obstacleBuffer: WebGLBuffer | null;
  feedbackElement: HTMLDivElement | null;
  particleData: Float32Array;
  obstacleData: Float32Array;
  buildPreviewData: Float32Array;
  count: number;
  obstacleCount: number;
  capacity: number;
  obstacleCapacity: number;
  gridHead: Int32Array;
  gridNext: Int32Array;
  pointer: PointerState;
  pendingGestures: GestureEvent[];
  modeId: string;
  preset: ParticleMetaballPreset;
  seed: number;
  needsSeed: boolean;
  cleanupPointer?: () => void;
}

const MARKUP = `
  <canvas data-particle-metaball-canvas class="absolute inset-0 h-full w-full touch-none"></canvas>
  <div data-particle-metaball-feedback class="pointer-events-none absolute left-0 top-0 hidden rounded-full border border-white/35 bg-white/10"></div>
  <div class="pointer-events-none absolute inset-2 rounded-3xl border border-white/12 shadow-[inset_0_0_28px_rgba(255,255,255,0.08)]"></div>
`;

const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec4 aData;
uniform vec2 uResolution;
uniform float uPointScale;
out float vTemperature;
out float vSeed;
out float vRadius;
void main() {
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vRadius = aData.z;
  vTemperature = aData.w;
  vSeed = aData.x * 0.017 + aData.y * 0.013 + aData.z;
  gl_PointSize = max(1.0, aData.z * uPointScale);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uHot;
uniform vec3 uWarm;
uniform vec3 uCold;
uniform float uOpacity;
uniform float uMetaball;
uniform float uStyle;
in float vTemperature;
in float vSeed;
in float vRadius;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float core = exp(-d2 * mix(3.9, 1.18, uMetaball));
  float edge = 1.0 - smoothstep(mix(0.64, 0.82, uStyle), 1.0, d2);
  float ring = smoothstep(0.5, 0.94, d2) * (1.0 - smoothstep(0.88, 1.0, d2));
  float alpha = mix(edge, core, uMetaball) * uOpacity;
  alpha = mix(alpha, max(alpha, ring * 0.58), smoothstep(0.55, 1.0, uStyle));
  vec3 color = mix(uCold, uWarm, smoothstep(0.05, 0.72, vTemperature));
  color = mix(color, uHot, smoothstep(0.62, 1.0, vTemperature));
  float shade = 0.78 + 0.22 * sqrt(max(0.0, 1.0 - d2));
  float sparkle = fract(sin(vSeed * 93.17) * 43758.5453) * 0.06;
  color = mix(color, color * (0.76 + ring * 0.36), smoothstep(0.72, 1.0, uStyle));
  outColor = vec4(color * (shade + sparkle), alpha);
}`;

const OBSTACLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aObstacle;
uniform vec2 uResolution;
out float vRadius;
void main() {
  vec2 clip = aObstacle.xy / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vRadius = aObstacle.z;
  gl_PointSize = max(2.0, aObstacle.z * 2.0);
}`;

const OBSTACLE_FRAGMENT = `#version 300 es
precision highp float;
in float vRadius;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float edge = 1.0 - smoothstep(0.72, 1.0, d2);
  outColor = vec4(vec3(0.56, 0.58, 0.62) * (0.78 + 0.22 * edge), 0.88);
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

function random(seed: number): [number, number] {
  let next = seed | 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return [(next >>> 0) / 4294967296, next | 0];
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function modeForPreset(preset: ParticleMetaballPreset): string {
  return preset === 'water-tank' ? 'pour' : 'heat';
}

function maxParticles(state: ParticleMetaballState, preset: ParticleMetaballPreset): number {
  const fallback = preset === 'water-tank' ? 7000 : 360;
  return Math.min(state.capacity, Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'maxParticles', fallback))));
}

function particleRadius(state: ParticleMetaballState, preset: ParticleMetaballPreset): number {
  return preset === 'water-tank'
    ? finiteNumberSetting(state.settings, 'particleRadius', 4.8)
    : finiteNumberSetting(state.settings, 'blobRadius', 22);
}

function clearScene(state: ParticleMetaballState, preset: ParticleMetaballPreset): void {
  state.count = 0;
  state.obstacleCount = 0;
  state.needsSeed = true;
  if (preset === 'water-tank') {
    seedWater(state, state.width, state.height, state.canvas.clientWidth < 320);
  } else {
    seedLava(state, state.width, state.height, state.canvas.clientWidth < 320);
  }
}

function seedLava(state: ParticleMetaballState, width: number, height: number, lite: boolean): void {
  const target = Math.min(maxParticles(state, 'lava-lamp'), lite ? 72 : Math.floor(finiteNumberSetting(state.settings, 'initialBlobs', 150)));
  state.count = 0;
  const radius = particleRadius(state, 'lava-lamp');
  for (let i = 0; i < target; i += 1) {
    let r = 0;
    [r, state.seed] = random(state.seed + i * 17);
    const x = width * (0.12 + r * 0.76);
    [r, state.seed] = random(state.seed + 31);
    const y = height * (0.56 + r * 0.36);
    [r, state.seed] = random(state.seed + 79);
    addParticle(state, x, y, radius * (0.72 + r * 0.68), 0, -120 * r, 0.65 + r * 0.35);
  }
  state.needsSeed = false;
}

function seedWater(state: ParticleMetaballState, width: number, height: number, lite: boolean): void {
  const radius = particleRadius(state, 'water-tank');
  const columns = Math.max(8, Math.floor(width / (radius * 2.15)));
  const rows = Math.max(4, Math.floor(height * (lite ? 0.28 : 0.42) / (radius * 2.05)));
  const target = Math.min(maxParticles(state, 'water-tank'), columns * rows);
  state.count = 0;
  for (let i = 0; i < target; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    let jitter = 0;
    [jitter, state.seed] = random(state.seed + i * 13);
    const x = width * 0.08 + col * radius * 2.15 + (jitter - 0.5) * radius * 0.7;
    [jitter, state.seed] = random(state.seed + 23);
    const y = height * 0.92 - row * radius * 2.05 + (jitter - 0.5) * radius * 0.4;
    addParticle(state, x, y, radius, 0, 0, 0.35 + row / Math.max(1, rows) * 0.35);
  }
  const obstacleRadius = finiteNumberSetting(state.settings, 'buildRadius', 18);
  let phase = 0;
  [phase, state.seed] = random(state.seed + 9001);
  const tiltA = (phase - 0.5) * height * 0.14;
  [phase, state.seed] = random(state.seed + 9007);
  const tiltB = (phase - 0.5) * height * 0.14;
  [phase, state.seed] = random(state.seed + 9011);
  const centerOffset = (phase - 0.5) * width * 0.22;
  if (lite) {
    addObstacleLine(state, width * 0.2, height * 0.62 + tiltA, width * 0.5, height * 0.7 - tiltA * 0.45);
    addObstacleLine(state, width * 0.8, height * 0.48 + tiltB, width * 0.52, height * 0.58 - tiltB * 0.4);
  } else {
    addObstacleLine(state, width * 0.14, height * 0.58 + tiltA, width * 0.44, height * 0.72 - tiltA * 0.4);
    addObstacleLine(state, width * 0.86, height * 0.48 + tiltB, width * 0.56, height * 0.61 - tiltB * 0.4);
    addObstacle(state, width * 0.5 + centerOffset, height * 0.42, obstacleRadius * (1.05 + phase * 0.45));
  }
  state.needsSeed = false;
}

function enforceParticleLimit(state: ParticleMetaballState): void {
  const limit = maxParticles(state, state.preset);
  if (state.count > limit) state.count = limit;
}

function addParticle(state: ParticleMetaballState, x: number, y: number, radius: number, vx: number, vy: number, temperature: number): void {
  if (state.count >= maxParticles(state, state.preset)) return;
  const index = state.count * 6;
  state.particleData[index] = x;
  state.particleData[index + 1] = y;
  state.particleData[index + 2] = vx;
  state.particleData[index + 3] = vy;
  state.particleData[index + 4] = radius;
  state.particleData[index + 5] = clamp(temperature, 0, 1);
  state.count += 1;
}

function addObstacle(state: ParticleMetaballState, x: number, y: number, radius: number): void {
  if (state.obstacleCount >= state.obstacleCapacity) return;
  const index = state.obstacleCount * 3;
  state.obstacleData[index] = x;
  state.obstacleData[index + 1] = y;
  state.obstacleData[index + 2] = radius;
  state.obstacleCount += 1;
}

function addObstacleLine(state: ParticleMetaballState, x0: number, y0: number, x1: number, y1: number): void {
  const radius = finiteNumberSetting(state.settings, 'buildRadius', 16);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const steps = Math.max(1, Math.ceil(distance / Math.max(4, radius * 1.45)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    addObstacle(state, x0 + dx * t, y0 + dy * t, radius);
  }
}

function pointerXY(canvas: HTMLCanvasElement, event: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(1, rect.width);
  const sy = canvas.height / Math.max(1, rect.height);
  return [(event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy];
}

function installPointer(state: ParticleMetaballState, preset: ParticleMetaballPreset): () => void {
  const down = (event: PointerEvent) => {
    const [x, y] = pointerXY(state.canvas, event);
    state.pointer = { active: true, id: event.pointerId, startX: x, startY: y, x, y, previousX: x, previousY: y };
    state.canvas.setPointerCapture(event.pointerId);
    if (preset === 'water-tank' && state.modeId === 'build') return;
    applyPointerTool(state, preset, x, y, 0, 0, true);
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
    if (preset === 'water-tank' && state.modeId === 'build') return;
    applyPointerTool(state, preset, x, y, dx, dy, false);
  };
  const up = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    const [x, y] = pointerXY(state.canvas, event);
    if (preset === 'water-tank' && state.modeId === 'build') {
      const distance = Math.hypot(x - state.pointer.startX, y - state.pointer.startY);
      if (distance < 8) addObstacle(state, x, y, finiteNumberSetting(state.settings, 'buildRadius', 16));
      else addObstacleLine(state, state.pointer.startX, state.pointer.startY, x, y);
    }
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

function applyPointerTool(state: ParticleMetaballState, preset: ParticleMetaballPreset, x: number, y: number, dx: number, dy: number, first: boolean, thermalIntent?: number): void {
  if (preset === 'lava-lamp') {
    const radius = finiteNumberSetting(state.settings, 'inputRadius', 90);
    const heat = typeof thermalIntent === 'number' && thermalIntent < 0 ? -1 : state.modeId === 'cool' ? -1 : 1;
    const lift = finiteNumberSetting(state.settings, 'inputLift', 240);
    const thermalRate = finiteNumberSetting(state.settings, 'inputThermalRate', 0.09);
    for (let i = 0; i < state.count; i += 1) {
      const k = i * 6;
      const px = state.particleData[k];
      const py = state.particleData[k + 1];
      const d = Math.hypot(px - x, py - y);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      state.particleData[k + 5] = clamp(state.particleData[k + 5] + heat * falloff * thermalRate, 0, 1);
      state.particleData[k + 2] += dx * falloff * 7;
      state.particleData[k + 3] += dy * falloff * 7 - heat * falloff * lift;
    }
    if (first && state.count < maxParticles(state, preset)) {
      addParticle(state, x, y, particleRadius(state, preset) * 0.95, dx * 2, dy * 2 - 120, heat > 0 ? 1 : 0.1);
    }
    return;
  }

  if (state.modeId === 'interact') {
    const radius = finiteNumberSetting(state.settings, 'interactionRadius', 72);
    const strength = finiteNumberSetting(state.settings, 'interactionStrength', 18);
    for (let i = 0; i < state.count; i += 1) {
      const k = i * 6;
      const d = Math.hypot(state.particleData[k] - x, state.particleData[k + 1] - y);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      state.particleData[k + 2] += dx * strength * falloff;
      state.particleData[k + 3] += dy * strength * falloff;
    }
    return;
  }

  const rate = Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'pourRate', 80) / 30));
  const radius = particleRadius(state, preset);
  for (let i = 0; i < rate; i += 1) {
    let r = 0;
    [r, state.seed] = random(state.seed + i * 37);
    const angle = r * Math.PI * 2;
    [r, state.seed] = random(state.seed + 11);
    const spread = Math.sqrt(r) * finiteNumberSetting(state.settings, 'pourRadius', 24);
    addParticle(state, x + Math.cos(angle) * spread, y + Math.sin(angle) * spread, radius, dx * 5 + (r - 0.5) * 80, dy * 5, 0.46);
  }
}

function applyGestures(state: ParticleMetaballState, preset: ParticleMetaballPreset): void {
  for (const gesture of state.pendingGestures.splice(0)) {
    const dx = gesture.dx ?? 0;
    const dy = gesture.dy ?? 0;
    applyPointerTool(state, preset, gesture.x, gesture.y, dx, dy, gesture.kind === 'tap', gesture.strength);
  }
}

function simulateLava(state: ParticleMetaballState, dt: number): void {
  const width = state.width;
  const height = state.height;
  const gravity = finiteNumberSetting(state.settings, 'gravity', 80);
  const buoyancy = finiteNumberSetting(state.settings, 'buoyancy', 520);
  const tension = finiteNumberSetting(state.settings, 'surfaceTension', 0.42);
  const clump = finiteNumberSetting(state.settings, 'clumping', 0.55);
  const targetRadius = particleRadius(state, 'lava-lamp');
  const drag = Math.pow(0.985, dt * 60);
  const count = state.count;
  const data = state.particleData;
  for (let i = 0; i < count; i += 1) {
    const k = i * 6;
    const y = data[k + 1];
    data[k + 4] += (targetRadius - data[k + 4]) * Math.min(1, dt * 0.75);
    let temp = data[k + 5];
    const bottomHeat = 1 - clamp(y / Math.max(1, height), 0, 1);
    const topCool = clamp(y / Math.max(1, height), 0, 1);
    temp += (bottomHeat * finiteNumberSetting(state.settings, 'heatRate', 0.08) - topCool * finiteNumberSetting(state.settings, 'coolRate', 0.055)) * dt;
    data[k + 5] = clamp(temp, 0, 1);
    data[k + 3] += (gravity - buoyancy * data[k + 5]) * dt;
  }
  solveLavaPairsWithGrid(state, Math.max(24, targetRadius * 4.8), tension, clump);
  for (let i = 0; i < count; i += 1) {
    const k = i * 6;
    const radius = data[k + 4];
    data[k + 2] *= drag;
    data[k + 3] *= drag;
    data[k] += data[k + 2] * dt;
    data[k + 1] += data[k + 3] * dt;
    if (data[k] < radius || data[k] > width - radius) {
      data[k] = clamp(data[k], radius, width - radius);
      data[k + 2] *= -0.35;
    }
    if (data[k + 1] < radius || data[k + 1] > height - radius) {
      data[k + 1] = clamp(data[k + 1], radius, height - radius);
      data[k + 3] *= -0.25;
    }
  }
}

function solveLavaPairsWithGrid(state: ParticleMetaballState, influenceCellSize: number, tension: number, clump: number): void {
  const columns = Math.max(1, Math.ceil(state.width / influenceCellSize));
  const rows = Math.max(1, Math.ceil(state.height / influenceCellSize));
  const cells = columns * rows;
  if (state.gridHead.length < cells) state.gridHead = new Int32Array(cells);
  state.gridHead.fill(-1, 0, cells);
  const invCell = 1 / influenceCellSize;
  const data = state.particleData;

  for (let i = 0; i < state.count; i += 1) {
    const k = i * 6;
    const cx = clamp((data[k] * invCell) | 0, 0, columns - 1);
    const cy = clamp((data[k + 1] * invCell) | 0, 0, rows - 1);
    const cell = cx + cy * columns;
    state.gridNext[i] = state.gridHead[cell];
    state.gridHead[cell] = i;
  }

  for (let cy = 0; cy < rows; cy += 1) {
    const row = cy * columns;
    const nextRow = row + columns;
    for (let cx = 0; cx < columns; cx += 1) {
      const cell = row + cx;
      if (state.gridHead[cell] === -1) continue;
      collideLavaSelfCell(state, cell, tension, clump);
      if (cx + 1 < columns) collideLavaCellPair(state, cell, cell + 1, tension, clump);
      if (cy + 1 < rows) {
        collideLavaCellPair(state, cell, nextRow + cx, tension, clump);
        if (cx > 0) collideLavaCellPair(state, cell, nextRow + cx - 1, tension, clump);
        if (cx + 1 < columns) collideLavaCellPair(state, cell, nextRow + cx + 1, tension, clump);
      }
    }
  }
}

function collideLavaSelfCell(state: ParticleMetaballState, cell: number, tension: number, clump: number): void {
  for (let i = state.gridHead[cell]; i !== -1; i = state.gridNext[i]) {
    for (let j = state.gridNext[i]; j !== -1; j = state.gridNext[j]) {
      solveLavaPair(state, i, j, tension, clump);
    }
  }
}

function collideLavaCellPair(state: ParticleMetaballState, a: number, b: number, tension: number, clump: number): void {
  const headA = state.gridHead[a];
  const headB = state.gridHead[b];
  if (headA === -1 || headB === -1) return;
  for (let i = headA; i !== -1; i = state.gridNext[i]) {
    for (let j = headB; j !== -1; j = state.gridNext[j]) {
      solveLavaPair(state, i, j, tension, clump);
    }
  }
}

function solveLavaPair(state: ParticleMetaballState, a: number, b: number, tension: number, clump: number): void {
  const data = state.particleData;
  const ai = a * 6;
  const bi = b * 6;
  const dx = data[bi] - data[ai];
  const dy = data[bi + 1] - data[ai + 1];
  const dist = Math.max(0.001, Math.hypot(dx, dy));
  const rest = (data[ai + 4] + data[bi + 4]) * 0.72;
  const influence = (data[ai + 4] + data[bi + 4]) * 2.3;
  if (dist > influence) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = rest - dist;
  if (overlap > 0) {
    const push = overlap * tension * 0.5;
    data[ai + 2] -= nx * push;
    data[ai + 3] -= ny * push;
    data[bi + 2] += nx * push;
    data[bi + 3] += ny * push;
    return;
  }
  const pull = (1 - dist / influence) * clump * 8;
  data[ai + 2] += nx * pull;
  data[ai + 3] += ny * pull;
  data[bi + 2] -= nx * pull;
  data[bi + 3] -= ny * pull;
}

function simulateWater(state: ParticleMetaballState, dt: number): void {
  const data = state.particleData;
  const width = state.width;
  const height = state.height;
  const gravity = finiteNumberSetting(state.settings, 'gravity', 1450);
  const viscosity = finiteNumberSetting(state.settings, 'viscosity', 0.18);
  const radius = particleRadius(state, 'water-tank');
  for (let i = 0; i < state.count; i += 1) {
    state.particleData[i * 6 + 4] = radius;
  }
  const target = radius * 1.82;
  for (let i = 0; i < state.count; i += 1) {
    const k = i * 6;
    data[k + 3] += gravity * dt;
  }
  solveWaterPairsWithGrid(state, target, viscosity);
  for (let i = 0; i < state.count; i += 1) {
    const k = i * 6;
    data[k + 2] *= 0.995;
    data[k + 3] *= 0.995;
    data[k] += data[k + 2] * dt;
    data[k + 1] += data[k + 3] * dt;
    for (let o = 0; o < state.obstacleCount; o += 1) {
      const oi = o * 3;
      const dx = data[k] - state.obstacleData[oi];
      const dy = data[k + 1] - state.obstacleData[oi + 1];
      const minDist = radius + state.obstacleData[oi + 2];
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      if (dist >= minDist) continue;
      const nx = dx / dist;
      const ny = dy / dist;
      const push = minDist - dist;
      data[k] += nx * push;
      data[k + 1] += ny * push;
      const vn = data[k + 2] * nx + data[k + 3] * ny;
      if (vn < 0) {
        data[k + 2] -= nx * vn * 1.25;
        data[k + 3] -= ny * vn * 1.25;
      }
    }
    if (data[k] < radius || data[k] > width - radius) {
      data[k] = clamp(data[k], radius, width - radius);
      data[k + 2] *= -0.16;
    }
    if (data[k + 1] < radius || data[k + 1] > height - radius) {
      data[k + 1] = clamp(data[k + 1], radius, height - radius);
      data[k + 3] *= -0.08;
      data[k + 2] *= 0.82;
    }
    const speed = Math.min(1, Math.hypot(data[k + 2], data[k + 3]) / 900);
    const depth = clamp(data[k + 1] / Math.max(1, height), 0, 1);
    const foam = speed * 0.65 + (1 - depth) * 0.2;
    data[k + 5] += (clamp(foam, 0.05, 1) - data[k + 5]) * 0.08;
  }
}

function solveWaterPairsWithGrid(state: ParticleMetaballState, target: number, viscosity: number): void {
  const columns = Math.max(1, Math.ceil(state.width / target));
  const rows = Math.max(1, Math.ceil(state.height / target));
  const cells = columns * rows;
  if (state.gridHead.length < cells) state.gridHead = new Int32Array(cells);
  state.gridHead.fill(-1, 0, cells);
  const invCell = 1 / target;
  const data = state.particleData;

  for (let i = 0; i < state.count; i += 1) {
    const k = i * 6;
    const cx = clamp((data[k] * invCell) | 0, 0, columns - 1);
    const cy = clamp((data[k + 1] * invCell) | 0, 0, rows - 1);
    const cell = cx + cy * columns;
    state.gridNext[i] = state.gridHead[cell];
    state.gridHead[cell] = i;
  }

  for (let cy = 0; cy < rows; cy += 1) {
    const row = cy * columns;
    const nextRow = row + columns;
    for (let cx = 0; cx < columns; cx += 1) {
      const cell = row + cx;
      if (state.gridHead[cell] === -1) continue;
      collideWaterSelfCell(state, cell, target, viscosity);
      if (cx + 1 < columns) collideWaterCellPair(state, cell, cell + 1, target, viscosity);
      if (cy + 1 < rows) {
        collideWaterCellPair(state, cell, nextRow + cx, target, viscosity);
        if (cx > 0) collideWaterCellPair(state, cell, nextRow + cx - 1, target, viscosity);
        if (cx + 1 < columns) collideWaterCellPair(state, cell, nextRow + cx + 1, target, viscosity);
      }
    }
  }
}

function collideWaterSelfCell(state: ParticleMetaballState, cell: number, target: number, viscosity: number): void {
  for (let i = state.gridHead[cell]; i !== -1; i = state.gridNext[i]) {
    for (let j = state.gridNext[i]; j !== -1; j = state.gridNext[j]) {
      solveWaterPair(state, i, j, target, viscosity);
    }
  }
}

function collideWaterCellPair(state: ParticleMetaballState, a: number, b: number, target: number, viscosity: number): void {
  const headA = state.gridHead[a];
  const headB = state.gridHead[b];
  if (headA === -1 || headB === -1) return;
  for (let i = headA; i !== -1; i = state.gridNext[i]) {
    for (let j = headB; j !== -1; j = state.gridNext[j]) {
      solveWaterPair(state, i, j, target, viscosity);
    }
  }
}

function solveWaterPair(state: ParticleMetaballState, a: number, b: number, target: number, viscosity: number): void {
  const data = state.particleData;
  const ai = a * 6;
  const bi = b * 6;
  const dx = data[bi] - data[ai];
  const dy = data[bi + 1] - data[ai + 1];
  const d2 = dx * dx + dy * dy;
  if (d2 >= target * target) return;
  const dist = Math.max(0.001, Math.sqrt(d2));
  const push = (target - dist) * 0.44;
  const nx = dx / dist;
  const ny = dy / dist;
  data[ai] -= nx * push;
  data[ai + 1] -= ny * push;
  data[bi] += nx * push;
  data[bi + 1] += ny * push;
  const avx = (data[ai + 2] + data[bi + 2]) * 0.5;
  const avy = (data[ai + 3] + data[bi + 3]) * 0.5;
  data[ai + 2] += (avx - data[ai + 2]) * viscosity;
  data[ai + 3] += (avy - data[ai + 3]) * viscosity;
  data[bi + 2] += (avx - data[bi + 2]) * viscosity;
  data[bi + 3] += (avy - data[bi + 3]) * viscosity;
}

function renderParticles(state: ParticleMetaballState, preset: ParticleMetaballPreset): void {
  updatePointerFeedback(state, preset);
  const gl = state.gl;
  const style = state.style;
  const palette = style?.palette ?? (preset === 'water-tank' ? [0x5ee7ff, 0x0077ff, 0xb8f7ff] : [0xfff4a3, 0xff7a1f, 0x5d1300]);
  const background = style?.background ?? (preset === 'water-tank' ? 0x04131f : 0x120403);
  const bg = colorNumberToRgb(background, [0, 0, 0]);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  if (preset === 'water-tank' && state.obstacleCount > 0 && state.obstacleProgram && state.obstacleBuffer) {
    gl.useProgram(state.obstacleProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.obstacleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.obstacleData.subarray(0, state.obstacleCount * 3), gl.DYNAMIC_DRAW);
    const res = gl.getUniformLocation(state.obstacleProgram, 'uResolution');
    gl.uniform2f(res, state.width, state.height);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.drawArrays(gl.POINTS, 0, state.obstacleCount);
  }
  if (
    preset === 'water-tank'
    && state.modeId === 'build'
    && state.pointer.active
    && state.obstacleProgram
    && state.obstacleBuffer
  ) {
    const previewCount = writeObstacleLineData(
      state.buildPreviewData,
      state.pointer.startX,
      state.pointer.startY,
      state.pointer.x,
      state.pointer.y,
      finiteNumberSetting(state.settings, 'buildRadius', 16),
    );
    if (previewCount > 0) {
      gl.useProgram(state.obstacleProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, state.obstacleBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, state.buildPreviewData.subarray(0, previewCount * 3), gl.DYNAMIC_DRAW);
      const res = gl.getUniformLocation(state.obstacleProgram, 'uResolution');
      gl.uniform2f(res, state.width, state.height);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
      gl.drawArrays(gl.POINTS, 0, previewCount);
    }
  }

  if (!state.particleProgram || !state.particleBuffer || state.count <= 0) return;
  if (preset === 'lava-lamp') {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  } else {
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.useProgram(state.particleProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, state.particleData.subarray(0, state.count * 6), gl.DYNAMIC_DRAW);
  gl.uniform2f(gl.getUniformLocation(state.particleProgram, 'uResolution'), state.width, state.height);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uPointScale'), finiteNumberSetting(state.settings, 'renderScale', preset === 'water-tank' ? 2.1 : 3.2));
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uOpacity'), finiteNumberSetting(state.settings, 'opacity', preset === 'water-tank' ? 0.34 : 0.46));
  const renderStyle = typeof state.settings.renderStyle === 'string' ? state.settings.renderStyle : '';
  const styleWeight = renderStyle === 'cellular' || renderStyle === 'particles'
    ? 1
    : renderStyle === 'surface'
      ? 0.45
      : 0;
  const styleMetaballOffset = renderStyle === 'particles' ? -0.42 : renderStyle === 'surface' ? -0.12 : renderStyle === 'glow' ? 0.08 : 0;
  const metaballBlend = clamp(finiteNumberSetting(state.settings, 'metaballBlend', preset === 'water-tank' ? 0.72 : 0.92) + styleMetaballOffset, 0, 1);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uMetaball'), metaballBlend);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uStyle'), styleWeight);
  const hot = colorNumberToRgb(palette[0], [1, 0.55, 0.1]);
  const warm = colorNumberToRgb(palette[1], [1, 0.12, 0.05]);
  const cold = colorNumberToRgb(palette[2], [0.15, 0.22, 0.55]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uHot'), hot[0], hot[1], hot[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uWarm'), warm[0], warm[1], warm[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uCold'), cold[0], cold[1], cold[2]);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
  gl.drawArrays(gl.POINTS, 0, state.count);
}

function updatePointerFeedback(state: ParticleMetaballState, preset: ParticleMetaballPreset): void {
  const feedback = state.feedbackElement;
  if (!feedback) return;
  if (!state.pointer.active || (preset === 'water-tank' && state.modeId === 'build')) {
    feedback.classList.add('hidden');
    return;
  }
  const radius = preset === 'lava-lamp'
    ? finiteNumberSetting(state.settings, 'inputRadius', 90)
    : state.modeId === 'interact'
      ? finiteNumberSetting(state.settings, 'interactionRadius', 72)
      : finiteNumberSetting(state.settings, 'pourRadius', 24);
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
}

function writeObstacleLineData(data: Float32Array, x0: number, y0: number, x1: number, y1: number, radius: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const steps = Math.min(Math.floor(data.length / 3) - 1, Math.max(1, Math.ceil(distance / Math.max(4, radius * 1.45))));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const index = i * 3;
    data[index] = x0 + dx * t;
    data[index + 1] = y0 + dy * t;
    data[index + 2] = radius;
  }
  return steps + 1;
}

export class RawParticleMetaballScene extends RawWebGL2Scene {
  private readonly pendingGestures: GestureEvent[] = [];

  constructor(private readonly preset: ParticleMetaballPreset, private readonly preview = false) {
    super({
      name: preset === 'water-tank' ? 'Water Tank' : 'Lava Lamp',
      markup: MARKUP,
      canvasSelector: '[data-particle-metaball-canvas]',
      maxDevicePixelRatio: preview ? 1 : 2,
      onInit: (state) => {
        const s = state as ParticleMetaballState;
        s.particleProgram = link(s.gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
        s.obstacleProgram = link(s.gl, OBSTACLE_VERTEX, OBSTACLE_FRAGMENT);
        s.particleBuffer = s.gl.createBuffer();
        s.obstacleBuffer = s.gl.createBuffer();
        s.feedbackElement = s.canvas.parentElement?.querySelector<HTMLDivElement>('[data-particle-metaball-feedback]') ?? null;
        s.capacity = preset === 'water-tank' ? (preview ? 1400 : 12_000) : (preview ? 120 : 900);
        s.obstacleCapacity = preview ? 96 : 512;
        s.particleData = new Float32Array(s.capacity * 6);
        s.obstacleData = new Float32Array(s.obstacleCapacity * 3);
        s.buildPreviewData = new Float32Array(256 * 3);
        s.gridHead = new Int32Array(1);
        s.gridNext = new Int32Array(s.capacity);
        s.count = 0;
        s.obstacleCount = 0;
        s.modeId = modeForPreset(preset);
        s.preset = preset;
        s.pendingGestures = this.pendingGestures;
        s.seed = preset === 'water-tank' ? 0x8ab4f8 : 0xff6d1b;
        s.needsSeed = true;
        s.pointer = { active: false, id: -1, startX: 0, startY: 0, x: 0, y: 0, previousX: 0, previousY: 0 };
        s.canvas.dataset.pixiLabContextLabel = preset;
        s.cleanupPointer = installPointer(s, preset);
        clearScene(s, preset);
      },
      onReset: (state) => clearScene(state as ParticleMetaballState, preset),
      onModeChange: (state, mode) => {
        (state as ParticleMetaballState).modeId = mode === 'demo' ? modeForPreset(preset) : mode;
      },
      render: (state) => {
        const s = state as ParticleMetaballState;
        if (s.needsSeed) clearScene(s, preset);
        enforceParticleLimit(s);
        applyGestures(s, preset);
        const dt = Math.min(1 / 24, Math.max(0, s.deltaSeconds));
        const substeps = Math.max(1, Math.floor(finiteNumberSetting(s.settings, 'substeps', preset === 'water-tank' ? 2 : 1)));
        for (let i = 0; i < substeps; i += 1) {
          if (preset === 'water-tank') simulateWater(s, dt / substeps);
          else simulateLava(s, dt / substeps);
        }
        renderParticles(s, preset);
      },
      getDebugStats: (state): RawSceneDebugStats => {
        const s = state as ParticleMetaballState;
        return {
          renderer: 'raw-webgl2-particle-metaball',
          simulation: preset,
          rendering: 'gpu-point-metaball',
          acceleration: 'gpu-point-sprite-metaball-rendering',
          blendMode: preset === 'lava-lamp' ? 'additive-density-glow' : 'alpha-glass-water',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: true,
          particles: s.count,
          maxParticles: maxParticles(s, preset),
          particleRadius: Math.round(particleRadius(s, preset) * 100) / 100,
          renderStyle: typeof s.settings.renderStyle === 'string' ? s.settings.renderStyle : null,
          obstacles: s.obstacleCount,
          gridCells: s.gridHead.length,
          mode: s.modeId,
          preview: this.preview,
        };
      },
      onDestroy: (state) => {
        const s = state as ParticleMetaballState;
        s.cleanupPointer?.();
        if (s.particleBuffer) s.gl.deleteBuffer(s.particleBuffer);
        if (s.obstacleBuffer) s.gl.deleteBuffer(s.obstacleBuffer);
        if (s.particleProgram) s.gl.deleteProgram(s.particleProgram);
        if (s.obstacleProgram) s.gl.deleteProgram(s.obstacleProgram);
      },
    });
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.pendingGestures.push(...gestures);
  }
}
