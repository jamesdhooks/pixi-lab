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

interface ForceSegment {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  strength: number;
}

interface ParticleFluidState extends RawWebGL2RenderState {
  particleProgram: WebGLProgram | null;
  particleBuffer: WebGLBuffer | null;
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
  cellSize: number;
  pointer: PointerState;
  pendingGestures: GestureEvent[];
  frameForces: ForceSegment[];
  cleanupPointer?: () => void;
}

const SOURCE_CELL_SIZE = 32;

const MARKUP = `
  <canvas data-particle-fluid-canvas class="absolute inset-0 h-full w-full touch-none"></canvas>
`;

const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aParticle;
uniform float uPointSize;
uniform float uSpeedColorScale;
uniform vec3 uSlowColor;
uniform vec3 uFastColor;
uniform vec3 uHotColor;
out vec4 vColor;
void main() {
  vec2 p = aParticle.xy;
  vec2 v = aParticle.zw;
  float speed = length(v);
  float x = clamp(speed * uSpeedColorScale, 0.0, 1.0);
  vec3 color = mix(uSlowColor, uFastColor, x) + uHotColor * x * x * x * 0.1;
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

function maxParticles(state: ParticleFluidState): number {
  return Math.min(state.capacity, Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'maxParticles', 262144))));
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
  const resolution = Math.max(2, finiteNumberSetting(state.settings, 'fieldCellSize', 4));
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
  resetParticles(state, preview);
}

function resetParticles(state: ParticleFluidState, preview: boolean): void {
  const target = Math.min(maxParticles(state), preview ? Math.min(8192, maxParticles(state)) : maxParticles(state));
  const textureWidth = Math.max(1, Math.ceil(Math.sqrt(target)));
  state.count = target;
  state.particleTextureWidth = textureWidth;
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

function applyForces(state: ParticleFluidState, dt: number, forces: ForceSegment[]): void {
  const velocityDecay = clamp(finiteNumberSetting(state.settings, 'velocityDecay', 0.999), 0, 1);
  const forceRadius = Math.max(0.0001, finiteNumberSetting(state.settings, 'forceRadius', 0.015)) * simulationScale(state);
  const forceTaper = clamp(finiteNumberSetting(state.settings, 'forceTaper', 0.6), 0, 1);
  const forceStrength = finiteNumberSetting(state.settings, 'forceStrength', 1);
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
        const mouseVelocityX = (mouseX - lastX) / Math.max(0.0001, dt);
        const mouseVelocityY = (mouseY - lastY) / Math.max(0.0001, dt);
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

function renderParticles(state: ParticleFluidState): void {
  const gl = state.gl;
  if (!state.particleProgram || !state.particleBuffer || state.count <= 0) return;
  gl.useProgram(state.particleProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, state.particleData.subarray(0, state.count * 4), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uPointSize'), Math.max(1, finiteNumberSetting(state.settings, 'pointSize', 1)));
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uSpeedColorScale'), Math.max(0, finiteNumberSetting(state.settings, 'colorSpeedScale', 4)));
  const slowColor = paletteColor(state, 0, [40.4 / 300, 0, 35 / 300]);
  const fastColor = paletteColor(state, 1, [0.2 / 100, 47.8 / 100, 1]);
  const hotColor = paletteColor(state, 2, [63.1 / 100, 92.5 / 100, 1]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uSlowColor'), slowColor[0], slowColor[1], slowColor[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uFastColor'), fastColor[0], fastColor[1], fastColor[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uHotColor'), hotColor[0], hotColor[1], hotColor[2]);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.SRC_ALPHA);
  gl.drawArrays(gl.POINTS, 0, state.count);
  gl.disable(gl.BLEND);
}

function renderFluid(state: ParticleFluidState): void {
  const gl = state.gl;
  gl.disable(gl.DEPTH_TEST);
  const background = colorNumberToRgb(state.style?.background, [0, 0, 0]);
  gl.clearColor(background[0], background[1], background[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
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
        s.particleBuffer = s.gl.createBuffer();
        s.capacity = preview ? 8192 : 1_048_576;
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
        s.pendingGestures = this.pendingGestures;
        s.frameForces = [];
        s.pointer = { active: false, id: -1, x: 0, y: 0, previousX: 0, previousY: 0 };
        s.canvas.dataset.pixiLabContextLabel = 'particle-fluid';
        s.cleanupPointer = installPointer(s);
        resetFluid(s, preview);
      },
      onReset: (state) => resetFluid(state as ParticleFluidState, preview),
      onSettingsChange: (state) => resetFluid(state as ParticleFluidState, preview),
      render: (state) => {
        const s = state as ParticleFluidState;
        ensureField(s);
        const dt = Math.max(0, s.deltaSeconds);
        simulate(s, dt);
        renderFluid(s);
      },
      getDebugStats: (state): RawSceneDebugStats => {
        const s = state as ParticleFluidState;
        return {
          renderer: 'raw-webgl2-particle-fluid',
          simulation: 'source-mapped-advected-velocity-and-particles',
          rendering: 'source-like-motion-point-particles',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: true,
          particles: s.count,
          maxParticles: maxParticles(s),
          particleTexture: `${s.particleTextureWidth}x${s.particleTextureWidth}`,
          flowField: `${s.fieldColumns}x${s.fieldRows}`,
          simulationScale: Math.round(simulationScale(s) * 100) / 100,
          cellSize: s.cellSize,
          velocityDecay: Math.round(finiteNumberSetting(s.settings, 'velocityDecay', 0.999) * 10000) / 10000,
          pressureIterations: Math.floor(finiteNumberSetting(s.settings, 'solverIterations', 18)),
          cpuUploadFloats: s.count * 4,
          preview: this.preview,
        };
      },
      onDestroy: (state) => {
        const s = state as ParticleFluidState;
        s.cleanupPointer?.();
        if (s.particleBuffer) s.gl.deleteBuffer(s.particleBuffer);
        if (s.particleProgram) s.gl.deleteProgram(s.particleProgram);
      },
    });
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.pendingGestures.push(...gestures);
  }
}
