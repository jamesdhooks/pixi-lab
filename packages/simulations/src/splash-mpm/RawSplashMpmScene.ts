import {
  RawWebGL2Scene,
  colorNumberToRgb,
  finiteNumberSetting,
  type GestureEvent,
  type RawSceneDebugStats,
  type RawWebGL2RenderState,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

interface SplashPointerState {
  active: boolean;
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

interface SplashMpmState extends RawWebGL2RenderState {
  particleProgram: WebGLProgram | null;
  surfaceProgram: WebGLProgram | null;
  particleBuffer: WebGLBuffer | null;
  quadBuffer: WebGLBuffer | null;
  densityTexture: WebGLTexture | null;
  particleData: Float32Array;
  mass: Float32Array;
  velocityX: Float32Array;
  velocityY: Float32Array;
  previousVelocityX: Float32Array;
  previousVelocityY: Float32Array;
  nextVelocityX: Float32Array;
  nextVelocityY: Float32Array;
  pressure: Float32Array;
  densityPixels: Uint8Array;
  metaballPixels: Uint8Array;
  metaballColumns: number;
  metaballRows: number;
  gridColumns: number;
  gridRows: number;
  cellSize: number;
  capacity: number;
  count: number;
  seed: number;
  pointer: SplashPointerState;
  jetSpawnAccumulator: number;
  pendingGestures: GestureEvent[];
  modeId: string;
  initialized: boolean;
  cleanupPointer?: () => void;
}

const STRIDE = 10;
type SplashRenderTier = 'particles' | 'fluid' | 'ultra';
const MARKUP = `
  <canvas data-splash-mpm-canvas class="absolute inset-0 h-full w-full touch-none"></canvas>
  <div data-splash-mpm-feedback class="pointer-events-none absolute left-0 top-0 hidden rounded-full border border-cyan-100/40 bg-cyan-200/10"></div>
`;

const QUAD_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uDensity;
uniform vec3 uBackground;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform float uSmoothing;
uniform float uRenderStyle;
uniform float uEnhancedDepth;
uniform float uEnhancedEdge;
in vec2 vUv;
out vec4 outColor;

float densityAt(vec2 uv) {
  return texture(uDensity, vec2(uv.x, 1.0 - uv.y)).r;
}

void main() {
  vec2 texel = 1.0 / vec2(textureSize(uDensity, 0));
  float center = densityAt(vUv);
  float filtered = center;
  float weight = 1.0;
  for (int y = -2; y <= 2; y += 1) {
    for (int x = -2; x <= 2; x += 1) {
      if (x == 0 && y == 0) continue;
      vec2 offset = vec2(float(x), float(y)) * texel;
      float sampleDensity = densityAt(vUv + offset);
      float spatial = exp(-dot(offset / texel, offset / texel) * 0.18);
      float range = exp(-abs(sampleDensity - center) * (7.0 - uSmoothing * 4.0));
      float w = spatial * mix(0.18, range, uSmoothing);
      filtered += sampleDensity * w;
      weight += w;
    }
  }
  float d = clamp(filtered / max(0.001, weight), 0.0, 1.0);
  float ultra = step(1.5, uRenderStyle);

  if (ultra < 0.5) {
    float north = densityAt(vUv + vec2(0.0, texel.y));
    float south = densityAt(vUv - vec2(0.0, texel.y));
    float east = densityAt(vUv + vec2(texel.x, 0.0));
    float west = densityAt(vUv - vec2(texel.x, 0.0));
    float neighborAverage = (north + south + east + west) * 0.25;
    float contourDensity = max(d * 1.12, max(center, neighborAverage * 1.08));
    float threshold = 0.13;
    float aa = max(0.016, fwidth(contourDensity) * 1.8);
    float fill = smoothstep(threshold - aa, threshold + aa, contourDensity);
    float surfaceBand = fill * (1.0 - smoothstep(threshold + aa, threshold + aa * 2.4, contourDensity));
    float depth = smoothstep(threshold + aa * 1.4, 0.82, contourDensity);
    float lowerDepth = smoothstep(0.18, 0.94, vUv.y);
    float depthControl = clamp(uEnhancedDepth, 0.0, 1.0);
    float edgeControl = clamp(uEnhancedEdge, 0.0, 1.0);
    vec3 flatWater = mix(uShallow, uDeep, clamp((depth * 0.54 + lowerDepth * 0.12) * depthControl, 0.0, 0.72));
    vec3 surfaceColor = mix(uShallow, uFoam, 0.1);
    float edgeShade = surfaceBand * (0.08 + edgeControl * 0.34) + (1.0 - depth) * fill * (0.03 + edgeControl * 0.09);
    vec3 simpleWater = mix(flatWater, surfaceColor, clamp(surfaceBand * (0.12 + edgeControl * 0.62), 0.0, 1.0));
    simpleWater = mix(simpleWater, uDeep, clamp(edgeShade, 0.0, 0.28));
    outColor = vec4(mix(uBackground, simpleWater, fill), 1.0);
    return;
  }

  float speed = texture(uDensity, vec2(vUv.x, 1.0 - vUv.y)).g;
  float pressure = texture(uDensity, vec2(vUv.x, 1.0 - vUv.y)).b;
  float contourDensity = max(center, d * 0.76);
  float contourWidth = max(0.007, fwidth(contourDensity) * 1.15);
  float surfaceCut = 0.18;
  float edge = smoothstep(surfaceCut - contourWidth, surfaceCut + contourWidth, contourDensity);
  float core = smoothstep(surfaceCut + contourWidth * 2.0, 0.72, contourDensity);
  float rim = edge * (1.0 - smoothstep(surfaceCut + contourWidth, surfaceCut + 0.13, contourDensity));
  vec3 normal = normalize(vec3(
    densityAt(vUv + vec2(texel.x, 0.0)) - densityAt(vUv - vec2(texel.x, 0.0)),
    densityAt(vUv + vec2(0.0, texel.y)) - densityAt(vUv - vec2(0.0, texel.y)),
    0.18
  ));
  float shade = clamp(dot(normal, normalize(vec3(-0.35, -0.55, 0.72))), 0.0, 1.0);
  float depth = smoothstep(surfaceCut, 0.96, max(d, contourDensity));
  vec3 water = mix(uDeep, uShallow, pow(depth, 0.52));
  water += uShallow * shade * 0.18;
  float fresnel = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.2) * edge;
  float specular = pow(max(0.0, dot(normal, normalize(vec3(-0.18, -0.42, 0.88)))), 56.0) * edge;
  float surfaceHighlight = rim * (0.42 + shade * 0.34);
  float foamLine = smoothstep(0.18, 0.78, speed) * smoothstep(surfaceCut + 0.02, 0.86, d);
  water += uFoam * (pow(speed, 1.6) * 0.36 + foamLine * 0.36 + pressure * 0.1 + shade * 0.16 + fresnel * 0.22 + specular * 0.48);
  water = mix(water, mix(uDeep, uFoam, 0.42), surfaceHighlight);
  water = mix(water, uDeep, rim * (1.0 - core) * 0.28);
  float vignette = smoothstep(0.92, 0.2, distance(vUv, vec2(0.5)));
  outColor = vec4(mix(uBackground, water, edge) * (0.72 + vignette * 0.28), 1.0);
}`;

const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aVelocity;
layout(location = 2) in vec2 aRenderData;
uniform vec2 uResolution;
uniform float uPointScale;
uniform float uRenderStyle;
out float vSpeed;
out float vFoam;
flat out float vPaletteT;
void main() {
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vSpeed = length(aVelocity);
  vFoam = aRenderData.y;
  vPaletteT = fract(sin(float(gl_VertexID) * 12.9898 + 78.233) * 43758.5453);
  float radiusScale = clamp(aRenderData.x, 0.7, 6.0);
  float motionScale = 0.64 + smoothstep(120.0, 1280.0, vSpeed) * 0.48 + clamp(vFoam, 0.0, 1.0) * 0.18;
  float ultraRadius = clamp(sqrt(radiusScale) * 0.82, 0.7, 2.2);
  gl_PointSize = max(1.0, uRenderStyle < 0.5 ? uPointScale : ultraRadius * uPointScale * clamp(motionScale, 0.62, 1.3));
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uDroplet;
uniform vec3 uFoam;
uniform vec3 uPalette0;
uniform vec3 uPalette1;
uniform vec3 uPalette2;
uniform float uOpacity;
uniform float uRenderStyle;
in float vSpeed;
in float vFoam;
flat in float vPaletteT;
out vec4 outColor;

vec3 sampleBasicPalette(float t) {
  float scaled = clamp(t, 0.0, 0.999) * 2.0;
  if (scaled < 1.0) return mix(uPalette0, uPalette1, scaled);
  return mix(uPalette1, uPalette2, scaled - 1.0);
}

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  if (uRenderStyle < 0.5) {
    float alpha = (1.0 - smoothstep(0.92, 1.0, d2)) * uOpacity;
    outColor = vec4(sampleBasicPalette(vPaletteT), alpha);
    return;
  }
  float speed = clamp(vSpeed / 1200.0, 0.0, 1.0);
  float alpha = (1.0 - smoothstep(0.38, 1.0, d2)) * uOpacity;
  if (uRenderStyle > 1.5) {
    float spray = smoothstep(0.16, 0.78, max(speed, vFoam));
    alpha *= 0.08 + spray * 0.42;
  }
  vec3 color = mix(uDroplet, uFoam, clamp(vFoam + speed * 0.62, 0.0, 1.0));
  color += uFoam * pow(speed, 2.0) * 0.25;
  outColor = vec4(color, alpha);
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

function maxParticles(state: SplashMpmState): number {
  return Math.min(state.capacity, Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'maxParticles', 32768))));
}

function gridResolution(state: SplashMpmState): number {
  return clamp(finiteNumberSetting(state.settings, 'resolution', 128), 32, 512);
}

function particleRadius(state: SplashMpmState): number {
  return finiteNumberSetting(state.settings, 'particleRadius', 2.2);
}

function wallPadding(radius: number): number {
  return Math.max(0.5, radius * 0.45);
}

function basicParticleDiameter(state: SplashMpmState): number {
  return clamp(state.cellSize * 0.68, 2.2, 32);
}

function initialParticleSpacing(state: SplashMpmState, radius: number): number {
  const resolutionScale = clamp(128 / Math.max(32, gridResolution(state)), 0.25, 1.35);
  const coarseSpacing = radius * 1.9 * resolutionScale;
  return clamp(coarseSpacing, Math.max(1.35, radius * 0.42), radius * 2.1);
}

function styleUniformNumber(state: SplashMpmState, key: string, fallback: number): number {
  const uniforms = state.style?.uniforms;
  if (!uniforms || typeof uniforms !== 'object') return fallback;
  const value = (uniforms as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function renderTier(settings: Record<string, unknown>): SplashRenderTier {
  const style = typeof settings.renderStyle === 'string' ? settings.renderStyle : 'raw';
  if (style === 'basic') return 'particles';
  if (style === 'enhanced') return 'fluid';
  return 'ultra';
}

function quadraticWeights(fx: number): [number, number, number] {
  return [
    0.5 * (1.5 - fx) * (1.5 - fx),
    0.75 - (fx - 1) * (fx - 1),
    0.5 * (fx - 0.5) * (fx - 0.5),
  ];
}

function gridIndex(state: SplashMpmState, x: number, y: number): number {
  const cx = clamp(Math.floor(x), 0, state.gridColumns - 1);
  const cy = clamp(Math.floor(y), 0, state.gridRows - 1);
  return cy * state.gridColumns + cx;
}

function sampleGrid(state: SplashMpmState, data: Float32Array, x: number, y: number): number {
  const gx = x / Math.max(1, state.cellSize);
  const gy = y / Math.max(1, state.cellSize);
  const baseX = Math.floor(gx - 0.5);
  const baseY = Math.floor(gy - 0.5);
  const wx = quadraticWeights(gx - baseX);
  const wy = quadraticWeights(gy - baseY);
  let value = 0;
  for (let yy = 0; yy < 3; yy += 1) {
    for (let xx = 0; xx < 3; xx += 1) {
      value += data[gridIndex(state, baseX + xx, baseY + yy)] * wx[xx] * wy[yy];
    }
  }
  return value;
}

function ensureGrid(state: SplashMpmState): void {
  const requestedColumns = Math.max(24, Math.floor(gridResolution(state)));
  const cellSize = Math.max(2, state.width / requestedColumns);
  const columns = Math.max(8, Math.ceil(state.width / cellSize));
  const rows = Math.max(8, Math.ceil(state.height / cellSize));
  if (columns === state.gridColumns && rows === state.gridRows && Math.abs(cellSize - state.cellSize) < 0.001) return;
  const cells = columns * rows;
  state.gridColumns = columns;
  state.gridRows = rows;
  state.cellSize = cellSize;
  state.mass = new Float32Array(cells);
  state.velocityX = new Float32Array(cells);
  state.velocityY = new Float32Array(cells);
  state.previousVelocityX = new Float32Array(cells);
  state.previousVelocityY = new Float32Array(cells);
  state.nextVelocityX = new Float32Array(cells);
  state.nextVelocityY = new Float32Array(cells);
  state.pressure = new Float32Array(cells);
  state.densityPixels = new Uint8Array(cells * 4);
  state.initialized = false;
}

function resetFluid(state: SplashMpmState, preview: boolean): void {
  ensureGrid(state);
  state.count = 0;
  state.mass.fill(0);
  state.velocityX.fill(0);
  state.velocityY.fill(0);
  if (state.width <= 1 || state.height <= 1) return;
  const radius = particleRadius(state);
  const target = Math.min(maxParticles(state), preview ? 8192 : maxParticles(state));
  const spacing = initialParticleSpacing(state, radius);
  const wall = wallPadding(radius);
  const startX = wall;
  const endX = state.width - wall;
  const startY = state.height * 0.26;
  const endY = state.height - wall;
  for (let y = startY; y < endY && state.count < target; y += spacing) {
    for (let x = startX; x < endX && state.count < target; x += spacing) {
      let r = 0;
      [r, state.seed] = random(state.seed + state.count * 31);
      const jx = (r - 0.5) * spacing * 0.34;
      [r, state.seed] = random(state.seed + 17);
      const jy = (r - 0.5) * spacing * 0.34;
      addParticle(state, x + jx, y + jy, 28 + r * 34, 8, radius, 0.08 + r * 0.16);
    }
  }
  state.initialized = true;
}

function addParticle(state: SplashMpmState, x: number, y: number, vx: number, vy: number, radius: number, foam: number): void {
  if (state.count >= maxParticles(state)) return;
  const k = state.count * STRIDE;
  const padding = wallPadding(radius);
  state.particleData[k] = clamp(x, padding, Math.max(padding, state.width - padding));
  state.particleData[k + 1] = clamp(y, padding, Math.max(padding, state.height - padding));
  state.particleData[k + 2] = vx;
  state.particleData[k + 3] = vy;
  state.particleData[k + 4] = 0;
  state.particleData[k + 5] = 0;
  state.particleData[k + 6] = 0;
  state.particleData[k + 7] = 0;
  state.particleData[k + 8] = radius;
  state.particleData[k + 9] = clamp(foam, 0, 1);
  state.count += 1;
}

function pointerXY(state: SplashMpmState, event: PointerEvent): [number, number] {
  const rect = state.canvas.getBoundingClientRect();
  const localX = clamp(event.clientX - rect.left, 0, Math.max(1, rect.width));
  const localY = clamp(event.clientY - rect.top, 0, Math.max(1, rect.height));
  const sx = state.width / Math.max(1, rect.width);
  const sy = state.height / Math.max(1, rect.height);
  return [localX * sx, localY * sy];
}

function installPointer(state: SplashMpmState): () => void {
  const feedback = state.canvas.parentElement?.querySelector<HTMLDivElement>('[data-splash-mpm-feedback]') ?? null;
  const down = (event: PointerEvent) => {
    const [x, y] = pointerXY(state, event);
    state.pointer = { active: true, id: event.pointerId, x, y, dx: 0, dy: 0 };
    state.jetSpawnAccumulator = 0;
    state.canvas.setPointerCapture(event.pointerId);
    if (state.modeId === 'jet') {
      const rate = finiteNumberSetting(state.settings, 'emitRate', 520);
      emitJetParticles(state, x, y, 0, 0, 1, Math.min(48, Math.max(8, Math.floor(rate / 80))));
    }
    applyInput(state, x, y, 0, 0, 1);
  };
  const move = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    const [x, y] = pointerXY(state, event);
    const dx = x - state.pointer.x;
    const dy = y - state.pointer.y;
    state.pointer.x = x;
    state.pointer.y = y;
    state.pointer.dx = dx;
    state.pointer.dy = dy;
    applyInput(state, x, y, dx, dy, 1);
  };
  const up = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    state.pointer.active = false;
    feedback?.classList.add('hidden');
    state.canvas.releasePointerCapture?.(event.pointerId);
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

function updateFeedback(state: SplashMpmState): void {
  const feedback = state.canvas.parentElement?.querySelector<HTMLDivElement>('[data-splash-mpm-feedback]');
  if (!feedback) return;
  if (!state.pointer.active) {
    feedback.classList.add('hidden');
    return;
  }
  const parentRect = state.canvas.parentElement?.getBoundingClientRect();
  const radius = finiteNumberSetting(state.settings, 'inputRadius', 62);
  const rect = state.canvas.getBoundingClientRect();
  const sx = rect.width / Math.max(1, state.width);
  const sy = rect.height / Math.max(1, state.height);
  const offsetX = parentRect ? rect.left - parentRect.left : 0;
  const offsetY = parentRect ? rect.top - parentRect.top : 0;
  const cssX = state.pointer.x * sx;
  const cssY = state.pointer.y * sy;
  const cssR = radius * Math.max(sx, sy);
  feedback.classList.remove('hidden');
  feedback.style.width = `${cssR * 2}px`;
  feedback.style.height = `${cssR * 2}px`;
  feedback.style.transform = `translate(${offsetX + cssX - cssR}px, ${offsetY + cssY - cssR}px)`;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number, number] {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0.0001 ? clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1) : 1;
  const sx = ax + vx * t;
  const sy = ay + vy * t;
  return [Math.hypot(px - sx, py - sy), sx, sy];
}

function applyInput(state: SplashMpmState, x: number, y: number, dx: number, dy: number, strength: number): void {
  const radius = finiteNumberSetting(state.settings, 'inputRadius', 62);
  const force = finiteNumberSetting(state.settings, 'inputForce', 17) * clamp(strength, 0.25, 3);
  const mode = state.modeId;
  if (mode === 'jet') {
    return;
  }
  const ax = x - dx;
  const ay = y - dy;
  const radius2 = radius * radius;
  for (let i = 0; i < state.count; i += 1) {
    const k = i * STRIDE;
    const [distance, sx, sy] = distanceToSegment(state.particleData[k], state.particleData[k + 1], ax, ay, x, y);
    if (distance > radius) continue;
    const falloff = (1 - distance * distance / radius2) ** 2;
    const ox = state.particleData[k] - sx;
    const oy = state.particleData[k + 1] - sy;
    const inv = 1 / Math.max(1, Math.hypot(ox, oy));
    state.particleData[k + 2] += (dx * force * 4.8 - oy * inv * force * 12) * falloff;
    state.particleData[k + 3] += (dy * force * 4.8 + ox * inv * force * 12) * falloff;
    state.particleData[k + 9] = clamp(state.particleData[k + 9] + falloff * 0.34, 0, 1);
  }
}

function emitJetParticles(state: SplashMpmState, x: number, y: number, dx: number, dy: number, _strength: number, spawnCount: number): void {
  if (spawnCount <= 0) return;
  const radiusSetting = particleRadius(state);
  const speed = Math.hypot(dx, dy);
  const invSpeed = speed > 0.001 ? 1 / speed : 0;
  const vx = dx * 16;
  const vy = dy * 16;
  const spread = Math.max(radiusSetting * 0.25, Math.min(radiusSetting * 1.6, speed * 0.035));
  for (let i = 0; i < spawnCount; i += 1) {
    let r = 0;
    [r, state.seed] = random(state.seed + i * 19 + state.frame);
    const angle = r * Math.PI * 2;
    [r, state.seed] = random(state.seed + 37);
    const dist = i === 0 ? 0 : Math.sqrt(r) * spread;
    [r, state.seed] = random(state.seed + 53);
    const jitter = (r - 0.5) * 22;
    addParticle(
      state,
      x + Math.cos(angle) * dist,
      y + Math.sin(angle) * dist,
      vx + Math.cos(angle) * jitter + dx * invSpeed * 45,
      vy + Math.sin(angle) * jitter + dy * invSpeed * 45,
      radiusSetting,
      0.72 + r * 0.28,
    );
  }
}

function emitActiveJet(state: SplashMpmState, dt: number): void {
  if (state.modeId !== 'jet' || !state.pointer.active) {
    state.jetSpawnAccumulator = 0;
    return;
  }
  const rate = finiteNumberSetting(state.settings, 'emitRate', 520);
  state.jetSpawnAccumulator = Math.min(rate, state.jetSpawnAccumulator + rate * Math.max(0, dt));
  const spawnCount = Math.min(96, Math.floor(state.jetSpawnAccumulator));
  if (spawnCount <= 0) return;
  state.jetSpawnAccumulator -= spawnCount;
  emitJetParticles(state, state.pointer.x, state.pointer.y, state.pointer.dx, state.pointer.dy, 1, spawnCount);
  state.pointer.dx *= 0.72;
  state.pointer.dy *= 0.72;
}

function applyGestures(state: SplashMpmState): void {
  while (state.pendingGestures.length > 0) {
    const gesture = state.pendingGestures.shift();
    if (!gesture) continue;
    applyInput(state, gesture.x, gesture.y, gesture.dx ?? 0, gesture.dy ?? 0, gesture.strength ?? 1);
  }
}

function particleToGrid(state: SplashMpmState): void {
  state.mass.fill(0);
  state.velocityX.fill(0);
  state.velocityY.fill(0);
  const data = state.particleData;
  for (let i = 0; i < state.count; i += 1) {
    const k = i * STRIDE;
    const gx = data[k] / Math.max(1, state.cellSize);
    const gy = data[k + 1] / Math.max(1, state.cellSize);
    const baseX = Math.floor(gx - 0.5);
    const baseY = Math.floor(gy - 0.5);
    const wx = quadraticWeights(gx - baseX);
    const wy = quadraticWeights(gy - baseY);
    for (let yy = 0; yy < 3; yy += 1) {
      for (let xx = 0; xx < 3; xx += 1) {
        const index = gridIndex(state, baseX + xx, baseY + yy);
        const weight = wx[xx] * wy[yy];
        const dx = baseX + xx - gx;
        const dy = baseY + yy - gy;
        const affineX = data[k + 4] * dx + data[k + 5] * dy;
        const affineY = data[k + 6] * dx + data[k + 7] * dy;
        state.mass[index] += weight;
        state.velocityX[index] += (data[k + 2] + affineX) * weight;
        state.velocityY[index] += (data[k + 3] + affineY) * weight;
      }
    }
  }

  for (let i = 0; i < state.mass.length; i += 1) {
    if (state.mass[i] <= 0.000001) {
      state.velocityX[i] = 0;
      state.velocityY[i] = 0;
      state.previousVelocityX[i] = 0;
      state.previousVelocityY[i] = 0;
      continue;
    }
    const invMass = 1 / state.mass[i];
    state.velocityX[i] *= invMass;
    state.velocityY[i] *= invMass;
    state.previousVelocityX[i] = state.velocityX[i];
    state.previousVelocityY[i] = state.velocityY[i];
  }
}

function updateGrid(state: SplashMpmState, dt: number): void {
  const restDensity = finiteNumberSetting(state.settings, 'restDensity', 3.2);
  const stiffness = finiteNumberSetting(state.settings, 'stiffness', 86);
  const gravity = finiteNumberSetting(state.settings, 'gravity', 920);
  const viscosity = finiteNumberSetting(state.settings, 'viscosity', 0.18);
  const w = state.gridColumns;
  const h = state.gridRows;
  for (let i = 0; i < state.mass.length; i += 1) {
    state.pressure[i] = Math.max(0, state.mass[i] / Math.max(0.001, restDensity) - 1) * stiffness;
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (state.mass[i] <= 0.000001) continue;
      const l = gridIndex(state, x - 1, y);
      const r = gridIndex(state, x + 1, y);
      const b = gridIndex(state, x, y - 1);
      const t = gridIndex(state, x, y + 1);
      const gradX = (state.pressure[r] - state.pressure[l]) / Math.max(1, state.cellSize * 2);
      const gradY = (state.pressure[t] - state.pressure[b]) / Math.max(1, state.cellSize * 2);
      state.velocityX[i] -= gradX * dt * state.cellSize * 18;
      state.velocityY[i] += gravity * dt - gradY * dt * state.cellSize * 18;
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const l = gridIndex(state, x - 1, y);
      const r = gridIndex(state, x + 1, y);
      const b = gridIndex(state, x, y - 1);
      const t = gridIndex(state, x, y + 1);
      const avgX = (state.velocityX[l] + state.velocityX[r] + state.velocityX[b] + state.velocityX[t]) * 0.25;
      const avgY = (state.velocityY[l] + state.velocityY[r] + state.velocityY[b] + state.velocityY[t]) * 0.25;
      const blend = clamp(viscosity * dt * 14, 0, 0.85);
      state.nextVelocityX[i] = state.velocityX[i] + (avgX - state.velocityX[i]) * blend;
      state.nextVelocityY[i] = state.velocityY[i] + (avgY - state.velocityY[i]) * blend;
    }
  }
  [state.velocityX, state.nextVelocityX] = [state.nextVelocityX, state.velocityX];
  [state.velocityY, state.nextVelocityY] = [state.nextVelocityY, state.velocityY];
  constrainGrid(state);
}

function constrainGrid(state: SplashMpmState): void {
  const w = state.gridColumns;
  const h = state.gridRows;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (x === 0 && state.velocityX[i] < 0) state.velocityX[i] = 0;
      if (x === w - 1 && state.velocityX[i] > 0) state.velocityX[i] = 0;
      if (y === 0 && state.velocityY[i] < 0) state.velocityY[i] = 0;
      if (y === h - 1 && state.velocityY[i] > 0) state.velocityY[i] = 0;
    }
  }
}

function gridToParticle(state: SplashMpmState, dt: number): void {
  const data = state.particleData;
  const flipness = clamp(finiteNumberSetting(state.settings, 'flipness', 0.88), 0, 1);
  const radius = particleRadius(state);
  for (let i = 0; i < state.count; i += 1) {
    const k = i * STRIDE;
    const oldVx = data[k + 2];
    const oldVy = data[k + 3];
    const picX = sampleGrid(state, state.velocityX, data[k], data[k + 1]);
    const picY = sampleGrid(state, state.velocityY, data[k], data[k + 1]);
    const prevX = sampleGrid(state, state.previousVelocityX, data[k], data[k + 1]);
    const prevY = sampleGrid(state, state.previousVelocityY, data[k], data[k + 1]);
    data[k + 2] = picX * (1 - flipness) + (oldVx + picX - prevX) * flipness;
    data[k + 3] = picY * (1 - flipness) + (oldVy + picY - prevY) * flipness;
    data[k] += data[k + 2] * dt;
    data[k + 1] += data[k + 3] * dt;
    containParticle(state, data, k);
    const eps = Math.max(1, state.cellSize);
    const vxL = sampleGrid(state, state.velocityX, data[k] - eps, data[k + 1]);
    const vxR = sampleGrid(state, state.velocityX, data[k] + eps, data[k + 1]);
    const vxB = sampleGrid(state, state.velocityX, data[k], data[k + 1] - eps);
    const vxT = sampleGrid(state, state.velocityX, data[k], data[k + 1] + eps);
    const vyL = sampleGrid(state, state.velocityY, data[k] - eps, data[k + 1]);
    const vyR = sampleGrid(state, state.velocityY, data[k] + eps, data[k + 1]);
    const vyB = sampleGrid(state, state.velocityY, data[k], data[k + 1] - eps);
    const vyT = sampleGrid(state, state.velocityY, data[k], data[k + 1] + eps);
    data[k + 4] = (vxR - vxL) * 0.5;
    data[k + 5] = (vxT - vxB) * 0.5;
    data[k + 6] = (vyR - vyL) * 0.5;
    data[k + 7] = (vyT - vyB) * 0.5;
    data[k + 8] += (radius - data[k + 8]) * Math.min(1, dt * 5);
    data[k + 9] = clamp(data[k + 9] * Math.pow(0.986, dt * 60) + Math.min(1, Math.hypot(data[k + 2], data[k + 3]) / 1800) * 0.012, 0, 1);
  }
}

function containParticle(state: SplashMpmState, data: Float32Array, index: number): void {
  const padding = wallPadding(data[index + 8]);
  const maxX = Math.max(padding, state.width - padding);
  const maxY = Math.max(padding, state.height - padding);
  const bounce = 0.34;
  if (data[index] < padding) {
    data[index] = padding;
    data[index + 2] = Math.abs(data[index + 2]) * bounce;
  } else if (data[index] > maxX) {
    data[index] = maxX;
    data[index + 2] = -Math.abs(data[index + 2]) * bounce;
  }
  if (data[index + 1] < padding) {
    data[index + 1] = padding;
    data[index + 3] = Math.abs(data[index + 3]) * bounce;
  } else if (data[index + 1] > maxY) {
    data[index + 1] = maxY;
    data[index + 3] = -Math.abs(data[index + 3]) * bounce;
    data[index + 2] *= 0.86;
  }
}

function simulate(state: SplashMpmState, dt: number): void {
  if (state.count > maxParticles(state)) state.count = maxParticles(state);
  particleToGrid(state);
  updateGrid(state, dt);
  gridToParticle(state, dt);
}

function uploadDensityPixels(state: SplashMpmState, pixels: Uint8Array, width: number, height: number): void {
  const gl = state.gl;
  gl.bindTexture(gl.TEXTURE_2D, state.densityTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
}

function updateGridDensityTexture(state: SplashMpmState): void {
  let maxMass = finiteNumberSetting(state.settings, 'restDensity', 3.2) * 2.2;
  for (let i = 0; i < state.mass.length; i += 1) maxMass = Math.max(maxMass, state.mass[i]);
  for (let i = 0; i < state.mass.length; i += 1) {
    const density = clamp(state.mass[i] / Math.max(0.001, maxMass), 0, 1);
    const speed = clamp(Math.hypot(state.velocityX[i], state.velocityY[i]) / 1150, 0, 1);
    const k = i * 4;
    state.densityPixels[k] = Math.round(density * 255);
    state.densityPixels[k + 1] = Math.round(speed * 255);
    state.densityPixels[k + 2] = Math.round(clamp(state.pressure[i] / 180, 0, 1) * 255);
    state.densityPixels[k + 3] = 255;
  }
  uploadDensityPixels(state, state.densityPixels, state.gridColumns, state.gridRows);
}

function ensureMetaballPixels(state: SplashMpmState): void {
  const quality = clamp(finiteNumberSetting(state.settings, 'enhancedQuality', 1), 0.6, 1.4);
  const targetCell = clamp(basicParticleDiameter(state) * (0.5 / quality), 1.6, 7.0);
  let columns = clamp(Math.round(state.width / targetCell), 128, 960);
  let rows = Math.max(48, Math.round(columns * state.height / Math.max(1, state.width)));
  const maxPixels = Math.round(420_000 + quality * 230_000);
  const pixels = columns * rows;
  if (pixels > maxPixels) {
    const scale = Math.sqrt(maxPixels / pixels);
    columns = Math.max(128, Math.floor(columns * scale));
    rows = Math.max(48, Math.floor(rows * scale));
  }
  if (columns === state.metaballColumns && rows === state.metaballRows && state.metaballPixels.length === columns * rows * 4) return;
  state.metaballColumns = columns;
  state.metaballRows = rows;
  state.metaballPixels = new Uint8Array(columns * rows * 4);
}

function updateParticleMetaballTexture(state: SplashMpmState): void {
  ensureMetaballPixels(state);
  if (state.frame % 2 === 1) return;
  const pixels = state.metaballPixels;
  pixels.fill(0);
  const columns = state.metaballColumns;
  const rows = state.metaballRows;
  const cellX = Math.max(0.001, state.width / Math.max(1, columns));
  const cellY = Math.max(0.001, state.height / Math.max(1, rows));
  const splatScale = clamp(finiteNumberSetting(state.settings, 'enhancedSplatSize', 1), 0.75, 1.7);
  const circleRadius = basicParticleDiameter(state) * 1.36 * splatScale;
  const splatRadius = clamp(circleRadius / Math.max(0.001, (cellX + cellY) * 0.5), 2.4, 6.4);
  const splatRadius2 = splatRadius * splatRadius;
  const particleStep = state.count > 52000 ? 3 : state.count > 24000 ? 2 : 1;
  const data = state.particleData;
  for (let i = 0; i < state.count; i += particleStep) {
    const k = i * STRIDE;
    const cx = data[k] / cellX;
    const cy = data[k + 1] / cellY;
    const speed = clamp(Math.hypot(data[k + 2], data[k + 3]) / 900, 0, 1);
    const minX = Math.max(0, Math.floor(cx - splatRadius));
    const maxX = Math.min(columns - 1, Math.ceil(cx + splatRadius));
    const minY = Math.max(0, Math.floor(cy - splatRadius));
    const maxY = Math.min(rows - 1, Math.ceil(cy + splatRadius));
    for (let y = minY; y <= maxY; y += 1) {
      const dy = y + 0.5 - cy;
      for (let x = minX; x <= maxX; x += 1) {
        const dx = x + 0.5 - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 > splatRadius2) continue;
        const falloff = 1 - d2 / splatRadius2;
        const density = Math.round(falloff * falloff * 220 * particleStep);
        const index = (y * columns + x) * 4;
        pixels[index] = Math.min(255, pixels[index] + density);
        pixels[index + 1] = Math.min(255, Math.max(pixels[index + 1], Math.round(speed * 255)));
        pixels[index + 2] = 0;
        pixels[index + 3] = 255;
      }
    }
  }
  uploadDensityPixels(state, pixels, columns, rows);
}

function updateDensityTexture(state: SplashMpmState, tier: SplashRenderTier): void {
  if (tier === 'fluid') updateParticleMetaballTexture(state);
  else updateGridDensityTexture(state);
}

function renderSurface(state: SplashMpmState, tier: SplashRenderTier): void {
  const gl = state.gl;
  if (!state.surfaceProgram || !state.quadBuffer || !state.densityTexture) return;
  updateDensityTexture(state, tier);
  const palette = state.style?.palette ?? [0x021326, 0x008fd8, 0xcdf7ff, 0xffffff];
  const background = colorNumberToRgb(state.style?.background, [0.0, 0.02, 0.05]);
  const deep = colorNumberToRgb(palette[1], [0, 0.56, 0.85]);
  const shallow = colorNumberToRgb(palette[2], [0.8, 0.97, 1]);
  const foam = colorNumberToRgb(palette[3] ?? palette[2], [1, 1, 1]);
  gl.useProgram(state.surfaceProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.densityTexture);
  gl.uniform1i(gl.getUniformLocation(state.surfaceProgram, 'uDensity'), 0);
  gl.uniform3f(gl.getUniformLocation(state.surfaceProgram, 'uBackground'), background[0], background[1], background[2]);
  gl.uniform3f(gl.getUniformLocation(state.surfaceProgram, 'uDeep'), deep[0], deep[1], deep[2]);
  gl.uniform3f(gl.getUniformLocation(state.surfaceProgram, 'uShallow'), shallow[0], shallow[1], shallow[2]);
  gl.uniform3f(gl.getUniformLocation(state.surfaceProgram, 'uFoam'), foam[0], foam[1], foam[2]);
  const smoothing = tier === 'ultra'
    ? finiteNumberSetting(state.settings, 'surfaceSmoothing', 0.72)
    : Math.min(0.16, finiteNumberSetting(state.settings, 'surfaceSmoothing', 0.72));
  gl.uniform1f(gl.getUniformLocation(state.surfaceProgram, 'uSmoothing'), smoothing);
  gl.uniform1f(gl.getUniformLocation(state.surfaceProgram, 'uRenderStyle'), tier === 'ultra' ? 2 : 0);
  gl.uniform1f(gl.getUniformLocation(state.surfaceProgram, 'uEnhancedDepth'), finiteNumberSetting(state.settings, 'enhancedDepth', 0.62));
  gl.uniform1f(gl.getUniformLocation(state.surfaceProgram, 'uEnhancedEdge'), finiteNumberSetting(state.settings, 'enhancedEdge', 0.58));
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function renderParticles(state: SplashMpmState, tier: SplashRenderTier): void {
  const gl = state.gl;
  if (!state.particleProgram || !state.particleBuffer || state.count <= 0) return;
  const palette = state.style?.palette ?? [0x021326, 0x008fd8, 0xcdf7ff, 0xffffff];
  const palette0 = colorNumberToRgb(palette[1] ?? palette[0], [0, 0.56, 0.85]);
  const palette1 = colorNumberToRgb(palette[2] ?? palette[1] ?? palette[0], [0.8, 0.97, 1]);
  const palette2 = colorNumberToRgb(palette[3] ?? palette[2] ?? palette[1] ?? palette[0], [1, 1, 1]);
  const droplet = tier === 'particles' ? palette0 : palette1;
  const foam = colorNumberToRgb(palette[3] ?? palette[2], [1, 1, 1]);
  const pointScaleBase = tier === 'particles' ? basicParticleDiameter(state) : 1.35;
  const opacityScale = tier === 'particles' ? 1 : 0.58;
  const pointScale = tier === 'particles' ? pointScaleBase : pointScaleBase * styleUniformNumber(state, 'pointScale', 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(state.particleProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, state.particleData.subarray(0, state.count * STRIDE), gl.DYNAMIC_DRAW);
  gl.uniform2f(gl.getUniformLocation(state.particleProgram, 'uResolution'), state.width, state.height);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uPointScale'), pointScale);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uOpacity'), finiteNumberSetting(state.settings, 'opacity', 0.82) * opacityScale);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uRenderStyle'), tier === 'particles' ? 0 : 2);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uDroplet'), droplet[0], droplet[1], droplet[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uFoam'), foam[0], foam[1], foam[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uPalette0'), palette0[0], palette0[1], palette0[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uPalette1'), palette1[0], palette1[1], palette1[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uPalette2'), palette2[0], palette2[1], palette2[2]);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE * 4, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE * 4, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE * 4, 32);
  gl.drawArrays(gl.POINTS, 0, state.count);
  gl.disable(gl.BLEND);
}

function render(state: SplashMpmState): void {
  const gl = state.gl;
  const tier = renderTier(state.settings);
  const background = colorNumberToRgb(state.style?.background, [0.0, 0.02, 0.05]);
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(background[0], background[1], background[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (tier === 'particles') {
    renderParticles(state, tier);
    return;
  }
  renderSurface(state, tier);
  if (tier === 'ultra') renderParticles(state, tier);
}

export class RawSplashMpmScene extends RawWebGL2Scene {
  private readonly pendingGestures: GestureEvent[] = [];
  private readonly qualityState: { value: RenderQuality };

  constructor(private readonly preview = false) {
    const qualityState = { value: 'raw' as RenderQuality };
    super({
      name: 'Splash MPM',
      markup: MARKUP,
      canvasSelector: '[data-splash-mpm-canvas]',
      maxDevicePixelRatio: preview ? 1 : 2,
      onInit: (state) => {
        const s = state as SplashMpmState;
        s.particleProgram = link(s.gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
        s.surfaceProgram = link(s.gl, QUAD_VERTEX, SURFACE_FRAGMENT);
        s.particleBuffer = s.gl.createBuffer();
        s.quadBuffer = s.gl.createBuffer();
        s.densityTexture = s.gl.createTexture();
        s.capacity = preview ? 8192 : 131072;
        s.particleData = new Float32Array(s.capacity * STRIDE);
        s.mass = new Float32Array(1);
        s.velocityX = new Float32Array(1);
        s.velocityY = new Float32Array(1);
        s.previousVelocityX = new Float32Array(1);
        s.previousVelocityY = new Float32Array(1);
        s.nextVelocityX = new Float32Array(1);
        s.nextVelocityY = new Float32Array(1);
        s.pressure = new Float32Array(1);
        s.densityPixels = new Uint8Array(4);
        s.metaballPixels = new Uint8Array(4);
        s.metaballColumns = 0;
        s.metaballRows = 0;
        s.gridColumns = 0;
        s.gridRows = 0;
        s.cellSize = 1;
        s.count = 0;
        s.seed = 0x6015a5;
        s.pointer = { active: false, id: -1, x: 0, y: 0, dx: 0, dy: 0 };
        s.jetSpawnAccumulator = 0;
        s.pendingGestures = this.pendingGestures;
        s.modeId = 'splash';
        s.initialized = false;
        s.canvas.dataset.pixiLabContextLabel = 'splash-mpm';
        s.gl.bindBuffer(s.gl.ARRAY_BUFFER, s.quadBuffer);
        s.gl.bufferData(s.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), s.gl.STATIC_DRAW);
        s.gl.bindTexture(s.gl.TEXTURE_2D, s.densityTexture);
        s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_MIN_FILTER, s.gl.LINEAR);
        s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_MAG_FILTER, s.gl.LINEAR);
        s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_WRAP_S, s.gl.CLAMP_TO_EDGE);
        s.gl.texParameteri(s.gl.TEXTURE_2D, s.gl.TEXTURE_WRAP_T, s.gl.CLAMP_TO_EDGE);
        s.cleanupPointer = installPointer(s);
        resetFluid(s, preview);
      },
      onReset: (state) => resetFluid(state as SplashMpmState, preview),
      onSettingsChange: (state, change) => {
        const s = state as SplashMpmState;
        if (change?.key === 'resolution' || change?.key === 'maxParticles' || change?.key === 'particleRadius') resetFluid(s, preview);
      },
      onModeChange: (state, mode) => {
        (state as SplashMpmState).modeId = mode === 'jet' ? 'jet' : 'splash';
      },
      render: (state) => {
        const s = state as SplashMpmState;
        ensureGrid(s);
        if (!s.initialized || s.count <= 0) resetFluid(s, preview);
        applyGestures(s);
        updateFeedback(s);
        const dt = Math.min(1 / 30, Math.max(0, s.deltaSeconds));
        emitActiveJet(s, dt);
        simulate(s, dt);
        render(s);
      },
      getDebugStats: (state): RawSceneDebugStats => {
        const s = state as SplashMpmState;
        const tier = renderTier(s.settings);
        return {
          renderer: 'raw-webgl2-splash-mpm',
          simulation: 'cpu-2d-apic-mls-mpm-particle-grid',
          rendering: 'gpu-density-surface-and-point-droplets',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: true,
          particles: s.count,
          maxParticles: maxParticles(s),
          particleRadius: Math.round(particleRadius(s) * 100) / 100,
          basicParticleDiameter: Math.round(basicParticleDiameter(s) * 100) / 100,
          gridResolution: gridResolution(s),
          grid: `${s.gridColumns}x${s.gridRows}`,
          metaballTexture: `${s.metaballColumns}x${s.metaballRows}`,
          cellSize: Math.round(s.cellSize * 100) / 100,
          stiffness: Math.round(finiteNumberSetting(s.settings, 'stiffness', 86)),
          flipness: Math.round(finiteNumberSetting(s.settings, 'flipness', 0.88) * 100) / 100,
          cpuUploadFloats: s.count * STRIDE,
          quality: qualityState.value,
          renderTier: tier,
          mode: s.modeId,
          preview: this.preview,
        };
      },
      onDestroy: (state) => {
        const s = state as SplashMpmState;
        s.cleanupPointer?.();
        if (s.particleBuffer) s.gl.deleteBuffer(s.particleBuffer);
        if (s.quadBuffer) s.gl.deleteBuffer(s.quadBuffer);
        if (s.densityTexture) s.gl.deleteTexture(s.densityTexture);
        if (s.particleProgram) s.gl.deleteProgram(s.particleProgram);
        if (s.surfaceProgram) s.gl.deleteProgram(s.surfaceProgram);
      },
    });
    this.qualityState = qualityState;
  }

  override setQuality(quality: RenderQuality): void {
    this.qualityState.value = quality;
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.pendingGestures.push(...gestures);
  }
}
