import {
  RawGpuParticleState,
  RawWebGL2Scene,
  colorNumberToRgb,
  finiteNumberSetting,
  resolveSideViewPaletteBackdrop,
  type GestureEvent,
  type RawFramebuffer,
  type RawSceneDebugStats,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';
import {
  BUILD_MODE_ID,
  BUILD_OBSTACLE_MESH_COLOR_GLSL,
  BUILD_OBSTACLE_POINT_COLOR_GLSL,
  BuildPathController,
  pushBuildCapsuleTriangles,
  pushBuildFixtureTriangles,
} from '../shared/build-mode.js';
import {
  createRawLiquidSurfaceRenderer,
  destroyRawLiquidSurfaceRenderer,
  liquidSurfaceOptionsFromSettings,
  renderLiquidSurfaceFromTextureParticles,
  type RawLiquidSurfaceRenderer,
} from '../shared/RawLiquidSurfaceRenderer.js';

interface GpuWaterPointer {
  active: boolean;
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface CpuSpatialGrid {
  heads: Int32Array;
  next: Int32Array;
  columns: number;
  rows: number;
  cellSize: number;
}

interface GpuWaterState extends RawWebGL2RenderState {
  particleState: RawGpuParticleState | null;
  densityProgram: WebGLProgram | null;
  blurProgram: WebGLProgram | null;
  compositeProgram: WebGLProgram | null;
  particleProgram: WebGLProgram | null;
  obstacleProgram: WebGLProgram | null;
  obstacleMeshProgram: WebGLProgram | null;
  liquidSurface: RawLiquidSurfaceRenderer | null;
  particleSpriteTexture: WebGLTexture | null;
  quadBuffer: WebGLBuffer | null;
  obstaclePointBuffer: WebGLBuffer | null;
  obstacleMeshBuffer: WebGLBuffer | null;
  densityTarget: RawFramebuffer | null;
  blurTarget: RawFramebuffer | null;
  densityWidth: number;
  densityHeight: number;
  capacity: number;
  activeLimit: number;
  writeIndex: number;
  cpuPositions: Float32Array;
  cpuVelocities: Float32Array;
  cpuForces: Float32Array;
  cpuFoam: Float32Array;
  cpuOldPositions: Float32Array;
  cpuDensity: Float32Array;
  cpuNearDensity: Float32Array;
  cpuPairI: Int32Array;
  cpuPairJ: Int32Array;
  cpuPairNx: Float32Array;
  cpuPairNy: Float32Array;
  cpuPairA: Float32Array;
  cpuUploadPositions: Float32Array;
  cpuUploadVelocities: Float32Array;
  spawnUploadPositions: Float32Array;
  spawnUploadVelocities: Float32Array;
  cpuGridHeads: Int32Array;
  cpuGridNext: Int32Array;
  cpuGridTouched: Int32Array;
  cpuGridTouchedCount: number;
  cpuGridColumns: number;
  cpuGridRows: number;
  cpuNeighborPairs: number;
  cpuNeighborPairLimit: number;
  cpuNeighborPairsDropped: number;
  cpuGridCellCount: number;
  cpuRecycledParticles: number;
  cpuNeedsFullUpload: boolean;
  cpuCount: number;
  seed: number;
  pointer: GpuWaterPointer;
  modeId: string;
  spawnAccumulator: number;
  physicsAccumulator: number;
  physicsStepsLastFrame: number;
  obstaclePoints: Float32Array;
  obstaclePointCount: number;
  obstacleLines: Float32Array;
  obstacleLineCount: number;
  buildController: BuildPathController;
  pendingGestures: GestureEvent[];
  feedbackElement: HTMLDivElement | null;
  cleanupPointer?: () => void;
}

const MAX_OBSTACLE_POINTS = 96;
const MAX_OBSTACLE_LINES = 24;
const OBSTACLE_POINT_STRIDE = 3;
const OBSTACLE_LINE_STRIDE = 5;
const REFERENCE_PARTICLE_SPRITE_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAAklEQVR4AewaftIAAALHSURBVI3B23brJhAAUAaGiyRHdp2mt///uD4kJ5YsxAADdM5KHvrW7g3qGwAY+KKNAAD9EwglhuhijNGbGGP08aUpgUoAgAEAbQQiWkS0xhg0xqARSrQv3FpjUZm5NqHEGKMhABgA0PjFee+D937y3k/OOa+1Nkr03lspJYuUc045ZwKAwkIJBGEEIroQwrwsy8uyLOs8zy/TNC3WWqdErbWklOJ5ns8Y4w4AmojUEK21gQCgjTHovQ/Lsrxcr9fX6/X6uq7r/XK5XJ1zXolSSj6OY9v3/QciWiXGGF20LlALRLQhhHlZlvV2u/0q/rzf77+v6/qL935SIuec9n3/9N4HEMxcmbmK0lpj1FobRLTe+2lZlvV6vb6KP97e3v663W5vIYRZCSI6QwgziFprSSlFIjpTSrHWWlALYww65/w0Tcvlcrmu63q7+3t/cIMe4558TMtffesAtmrjnndBzHZoxBpRQwczmOY3POBSVKKXQcx/Z4PD4ej8f7cRxbzjkxc+0Cxxi9tcZElABAK9EEEcVpmi7WWqdErbWklI4Y4/M4jkeM8UlEqbXGY4yOQzQBAIWIYIzRmbmmlA7nXDDGoBKtNS6lUM45EdGZcyZmLk0MAUoAgAEAjcIYg9Zah4jWGINaa6NE770JFlWU1hr/NMboY4wG6hsAGADQ/2K0AACtxBijf2v92xijjzGaEv8AMTxVs1G/0pUAAAAASUVORK5CYII=';

const MARKUP = `
  <canvas data-gpu-water-canvas class="absolute inset-0 h-full w-full touch-none"></canvas>
  <div data-gpu-water-feedback class="pointer-events-none absolute left-0 top-0 hidden rounded-full border border-cyan-200/35 bg-cyan-200/12"></div>
`;

const QUAD_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const DENSITY_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPositions;
uniform sampler2D uVelocities;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
uniform float uPointScale;
uniform float uActiveLimit;
out float vFoam;
out float vActive;
flat out float vPaletteT;
void main() {
  int id = gl_VertexID;
  int width = int(uTextureSize.x);
  ivec2 pixel = ivec2(id - (id / width) * width, id / width);
  vec4 position = texelFetch(uPositions, pixel, 0);
  vec4 velocity = texelFetch(uVelocities, pixel, 0);
  vActive = step(float(id), uActiveLimit - 0.5) * step(0.0001, position.z);
  vFoam = velocity.w;
  vPaletteT = fract(position.w + sin(float(id) * 12.9898 + 78.233) * 43758.5453);
  vec2 clip = position.xy / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(1.0, position.z * uPointScale) * vActive;
}`;

const DENSITY_FRAGMENT = `#version 300 es
precision highp float;
in float vFoam;
in float vActive;
out vec4 outColor;
void main() {
  if (vActive < 0.5) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float r = sqrt(d2);
  float density = 1.0 - smoothstep(0.58, 1.0, r);
  float nearDensity = density * density;
  float edge = smoothstep(0.5, 0.95, r) * density;
  outColor = vec4(density, nearDensity, density * clamp(vFoam + edge * 0.35, 0.0, 1.0) * 0.12, density);
}`;

const BLUR_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uDirection;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 color = texture(uTexture, vUv) * 0.227027;
  color += texture(uTexture, vUv + uDirection * 1.384615) * 0.316216;
  color += texture(uTexture, vUv - uDirection * 1.384615) * 0.316216;
  color += texture(uTexture, vUv + uDirection * 3.230769) * 0.070270;
  color += texture(uTexture, vUv - uDirection * 3.230769) * 0.070270;
  outColor = color;
}`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uDensity;
uniform vec2 uTexel;
uniform vec3 uFoamColor;
uniform vec3 uSurfaceColor;
uniform vec3 uDeepColor;
uniform vec3 uBackground;
uniform float uOpacity;
in vec2 vUv;
out vec4 outColor;

vec4 packedAt(vec2 uv) {
  return texture(uDensity, clamp(uv, vec2(0.0), vec2(1.0)));
}

float densityAt(vec2 uv) {
  return packedAt(uv).r;
}

float foamAt(vec2 uv) {
  vec4 packed = packedAt(uv);
  return clamp(packed.b / max(0.001, packed.r), 0.0, 1.0);
}

float filteredDensityAt(vec2 uv) {
  vec2 texel = uTexel;
  float center = densityAt(uv);
  float lowBound = center - 0.08;
  float highBound = center + 0.08;
  float sum = center;
  float weight = 1.0;
  for (int y = -2; y <= 2; y += 1) {
    for (int x = -2; x <= 2; x += 1) {
      if (x == 0 && y == 0) continue;
      vec2 offsetCells = vec2(float(x), float(y));
      float sampleDepth = densityAt(uv + offsetCells * texel);
      float w = exp(-dot(offsetCells, offsetCells) * 0.24);
      if (sampleDepth < lowBound) {
        w = 0.0;
      } else if (sampleDepth > highBound) {
        sampleDepth = center + 0.05;
      } else {
        lowBound = min(lowBound, sampleDepth - 0.08);
        highBound = max(highBound, sampleDepth + 0.08);
      }
      sum += sampleDepth * w;
      weight += w;
    }
  }
  return clamp(sum / max(0.001, weight), 0.0, 1.0);
}

float clampedDensityNeighbor(vec2 uv, float anchor) {
  float sampleDepth = densityAt(uv);
  if (sampleDepth < anchor - 0.075) return anchor;
  return min(sampleDepth, anchor + 0.05);
}

float filteredFoamAt(vec2 uv) {
  vec2 texel = uTexel;
  float sum = foamAt(uv) * 0.42;
  float weight = 0.42;
  for (int y = -1; y <= 1; y += 1) {
    for (int x = -1; x <= 1; x += 1) {
      vec2 offsetCells = vec2(float(x), float(y));
      float w = exp(-dot(offsetCells, offsetCells) * 0.45);
      sum += foamAt(uv + offsetCells * texel) * w;
      weight += w;
    }
  }
  return clamp(sum / max(0.001, weight), 0.0, 1.0);
}

void main() {
  float d = densityAt(vUv);
  vec3 background = uBackground * (0.72 + smoothstep(0.92, 0.18, distance(vUv, vec2(0.5))) * 0.28);
  float surfaceCut = 0.22;
  float contourWidth = max(0.0035, fwidth(d) * 1.85);
  float surface = smoothstep(surfaceCut - contourWidth, surfaceCut + contourWidth, d);
  if (surface <= 0.002) {
    outColor = vec4(background, 1.0);
    return;
  }
  float north = clampedDensityNeighbor(vUv + vec2(0.0, uTexel.y), d);
  float south = clampedDensityNeighbor(vUv - vec2(0.0, uTexel.y), d);
  float east = clampedDensityNeighbor(vUv + vec2(uTexel.x, 0.0), d);
  float west = clampedDensityNeighbor(vUv - vec2(uTexel.x, 0.0), d);
  vec3 normal = normalize(vec3((west - east) * 3.9, (south - north) * 3.9, 0.34));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 light = normalize(vec3(-0.35, -0.55, 0.74));
  vec3 halfDir = normalize(light + viewDir);
  float shade = clamp(dot(normal, light), 0.0, 1.0);
  float rim = surface * (1.0 - smoothstep(surfaceCut + contourWidth, surfaceCut + 0.055, d));
  float foam = filteredFoamAt(vUv);
  float depth = smoothstep(surfaceCut, surfaceCut + 0.65, d);
  float fresnel = clamp(0.02 + 0.98 * pow(1.0 - max(0.0, dot(normal, viewDir)), 5.0), 0.0, 1.0) * surface;
  float specular = pow(max(0.0, dot(normal, halfDir)), 142.0) * surface;
  float opticalDepth = clamp(depth * 0.92 + d * 0.22, 0.0, 1.0);
  vec3 transmittance = exp(-opticalDepth * 2.45 * (vec3(1.0) - clamp(uDeepColor, vec3(0.02), vec3(0.98))));
  vec3 refracted = mix(uDeepColor, mix(background, uSurfaceColor, 0.36), transmittance);
  vec3 reflected = mix(uSurfaceColor, uFoamColor, 0.2 + shade * 0.28);
  vec3 water = mix(refracted, reflected, fresnel * 0.52);
  water += uSurfaceColor * shade * 0.08;
  water += uFoamColor * (rim * 0.24 + smoothstep(0.32, 0.88, foam) * 0.22 + specular * 0.48);
  water = mix(water, uDeepColor, rim * 0.1);
  outColor = vec4(mix(background, water, surface * uOpacity), 1.0);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSprite;
uniform vec3 uSurfaceColor;
uniform vec3 uFoamColor;
uniform vec3 uPalette0;
uniform vec3 uPalette1;
uniform vec3 uPalette2;
uniform vec3 uPalette3;
uniform float uOpacity;
uniform float uReferenceRender;
in float vFoam;
in float vActive;
flat in float vPaletteT;
out vec4 outColor;

vec3 sampleParticlePalette(float t) {
  if (t < 0.25) return uPalette0;
  if (t < 0.5) return uPalette1;
  if (t < 0.75) return uPalette2;
  return uPalette3;
}

void main() {
  if (vActive < 0.5) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  if (uReferenceRender < 0.5) {
    float alpha = 1.0 - smoothstep(0.94, 1.0, d2);
    outColor = vec4(sampleParticlePalette(vPaletteT), alpha);
    return;
  }
  vec4 referenceSprite = texture(uSprite, gl_PointCoord);
  float referenceSample = exp(-d2 * 3.55) * smoothstep(1.0, 0.72, d2);
  float basicSample = 1.0 - smoothstep(0.62, 1.0, d2);
  float particleSample = mix(basicSample, referenceSprite.a, uReferenceRender);
  float alpha = particleSample * uOpacity;
  vec3 color = mix(uSurfaceColor, uFoamColor, smoothstep(0.42, 1.0, vFoam));
  vec3 spriteColor = mix(vec3(particleSample), referenceSprite.rgb, uReferenceRender);
  outColor = vec4(color * spriteColor, alpha);
}`;

const OBSTACLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aObstacle;
uniform vec2 uResolution;
void main() {
  vec2 clip = aObstacle.xy / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(2.0, aObstacle.z * 2.0);
}`;

const OBSTACLE_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float shade = 0.72 + 0.28 * sqrt(max(0.0, 1.0 - d2));
  outColor = vec4(${BUILD_OBSTACLE_POINT_COLOR_GLSL} * shade, 1.0);
}`;

const OBSTACLE_MESH_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
uniform vec2 uResolution;
void main() {
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const OBSTACLE_MESH_FRAGMENT = `#version 300 es
precision highp float;
out vec4 outColor;
void main() {
  outColor = vec4(${BUILD_OBSTACLE_MESH_COLOR_GLSL}, 1.0);
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

function createReferenceParticleSprite(gl: WebGL2RenderingContext): WebGLTexture | null {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.bindTexture(gl.TEXTURE_2D, null);
  };
  image.src = REFERENCE_PARTICLE_SPRITE_SRC;
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function random(seed: number): [number, number] {
  let next = seed | 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return [(next >>> 0) / 4294967296, next | 0];
}

function maxParticles(state: GpuWaterState): number {
  return Math.min(state.capacity, Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'maxParticles', 2048))));
}

function particleRadius(state: GpuWaterState): number {
  return finiteNumberSetting(state.settings, 'particleRadius', 3.1);
}

function pourRate(state: GpuWaterState): number {
  const value = finiteNumberSetting(state.settings, 'pourRate', 9000);
  return value < 500 ? value * 25 : value;
}

function viscosityValue(state: GpuWaterState): number {
  const value = finiteNumberSetting(state.settings, 'viscosity', 8.5);
  return value;
}

function neighborPairBudget(state: GpuWaterState, count: number): number {
  const configured = Math.floor(finiteNumberSetting(state.settings, 'neighborPairBudget', 65536));
  return Math.max(count * 6, Math.min(262144, configured));
}

function pointerXY(canvas: HTMLCanvasElement, event: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(1, rect.width);
  const sy = canvas.height / Math.max(1, rect.height);
  return [(event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy];
}

function dropOldestParticles(state: GpuWaterState, dropCount: number): void {
  const count = Math.min(Math.max(0, Math.floor(dropCount)), state.cpuCount);
  if (count <= 0) return;
  const remaining = state.cpuCount - count;
  state.cpuPositions.copyWithin(0, count * 2, state.cpuCount * 2);
  state.cpuVelocities.copyWithin(0, count * 2, state.cpuCount * 2);
  state.cpuForces.copyWithin(0, count * 2, state.cpuCount * 2);
  state.cpuOldPositions.copyWithin(0, count * 2, state.cpuCount * 2);
  state.cpuDensity.copyWithin(0, count, state.cpuCount);
  state.cpuNearDensity.copyWithin(0, count, state.cpuCount);
  state.cpuFoam.copyWithin(0, count, state.cpuCount);
  state.cpuCount = remaining;
  state.activeLimit = remaining;
  state.writeIndex = remaining;
  state.cpuRecycledParticles += count;
  state.cpuNeedsFullUpload = true;
}

function seedGpuParticles(state: GpuWaterState): void {
  if (!state.particleState) return;
  const total = state.particleState.width * state.particleState.height * 4;
  const positions = new Float32Array(total);
  const velocities = new Float32Array(total);
  for (let i = 0; i < state.capacity; i += 1) {
    let value = 0;
    [value, state.seed] = random(state.seed + i * 31);
    const k = i * 4;
    positions[k + 3] = value;
    velocities[k + 2] = particleRadius(state);
  }
  state.particleState.uploadSeed({ positions, velocities });
}

function uploadParticleRange(
  state: GpuWaterState,
  startIndex: number,
  positions: Float32Array,
  velocities: Float32Array,
  count: number,
): void {
  const gpu = state.particleState;
  if (!gpu || count <= 0) return;
  const gl = state.gl;
  let remaining = count;
  let offset = 0;
  let index = startIndex;
  while (remaining > 0) {
    const x = index % gpu.width;
    const y = Math.floor(index / gpu.width);
    const batch = Math.min(remaining, gpu.width - x);
    gl.bindTexture(gl.TEXTURE_2D, gpu.positions.read.texture.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, batch, 1, gl.RGBA, gl.FLOAT, positions.subarray(offset * 4, (offset + batch) * 4));
    gl.bindTexture(gl.TEXTURE_2D, gpu.velocities.read.texture.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, batch, 1, gl.RGBA, gl.FLOAT, velocities.subarray(offset * 4, (offset + batch) * 4));
    index += batch;
    offset += batch;
    remaining -= batch;
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
}

function uploadParticleCluster(state: GpuWaterState, x: number, y: number, count: number, spread: number, baseVx: number, baseVy: number): void {
  const limit = maxParticles(state);
  if (limit <= 0) return;
  const requestedCount = Math.max(0, Math.floor(count));
  const room = Math.max(0, limit - state.cpuCount);
  if (requestedCount > room) {
    const overflow = requestedCount - room;
    const recycleChunk = Math.max(overflow, Math.ceil(limit * 0.06));
    dropOldestParticles(state, recycleChunk);
  }
  const actualCount = Math.min(requestedCount, Math.max(0, limit - state.cpuCount));
  if (actualCount <= 0) return;
  const radius = particleRadius(state);
  const required = actualCount * 4;
  if (state.spawnUploadPositions.length < required) state.spawnUploadPositions = new Float32Array(required);
  if (state.spawnUploadVelocities.length < required) state.spawnUploadVelocities = new Float32Array(required);
  const positions = state.spawnUploadPositions;
  const velocities = state.spawnUploadVelocities;
  const separation = radius * 1.85;
  const effectiveSpread = Math.max(spread, separation * 1.2);
  let made = 0;
  const ring = Math.max(2, Math.ceil(effectiveSpread / Math.max(1, separation)));
  for (let row = -ring; row <= ring && made < actualCount; row += 1) {
    for (let col = -ring; col <= ring && made < actualCount; col += 1) {
      const ox = (col + (row % 2 === 0 ? 0 : 0.5)) * separation;
      const oy = row * separation * 0.866;
      if (ox * ox + oy * oy > effectiveSpread * effectiveSpread) continue;
      let randomValue = 0;
      [randomValue, state.seed] = random(state.seed + made * 19);
      const k = made * 4;
      positions[k] = clamp(x + ox + (randomValue - 0.5) * radius * 0.5, radius + 4, state.width - radius - 4);
      [randomValue, state.seed] = random(state.seed + 31);
      positions[k + 1] = clamp(y + oy + (randomValue - 0.5) * radius * 0.5, radius + 4, state.height - radius - 4);
      positions[k + 2] = radius;
      positions[k + 3] = randomValue;
      state.cpuPositions[(state.cpuCount + made) * 2] = positions[k];
      state.cpuPositions[(state.cpuCount + made) * 2 + 1] = positions[k + 1];
      [randomValue, state.seed] = random(state.seed + 47);
      velocities[k] = baseVx + (randomValue - 0.5) * 110;
      [randomValue, state.seed] = random(state.seed + 59);
      velocities[k + 1] = baseVy + (randomValue - 0.5) * 110;
      velocities[k + 2] = 1;
      velocities[k + 3] = 1;
      state.cpuVelocities[(state.cpuCount + made) * 2] = velocities[k];
      state.cpuVelocities[(state.cpuCount + made) * 2 + 1] = velocities[k + 1];
      state.cpuForces[(state.cpuCount + made) * 2] = 0;
      state.cpuForces[(state.cpuCount + made) * 2 + 1] = 0;
      state.cpuOldPositions[(state.cpuCount + made) * 2] = positions[k];
      state.cpuOldPositions[(state.cpuCount + made) * 2 + 1] = positions[k + 1];
      state.cpuFoam[state.cpuCount + made] = 1;
      made += 1;
    }
  }
  while (made < actualCount) {
    let randomValue = 0;
    [randomValue, state.seed] = random(state.seed + made * 13);
    const angle = randomValue * Math.PI * 2;
    [randomValue, state.seed] = random(state.seed + 23);
    const distance = Math.sqrt(randomValue) * effectiveSpread;
    const k = made * 4;
    positions[k] = clamp(x + Math.cos(angle) * distance, radius + 4, state.width - radius - 4);
    positions[k + 1] = clamp(y + Math.sin(angle) * distance, radius + 4, state.height - radius - 4);
    positions[k + 2] = radius;
    positions[k + 3] = randomValue;
    velocities[k] = baseVx + Math.cos(angle) * 80;
    velocities[k + 1] = baseVy + Math.sin(angle) * 80;
    velocities[k + 2] = 1;
    velocities[k + 3] = 1;
    state.cpuPositions[(state.cpuCount + made) * 2] = positions[k];
    state.cpuPositions[(state.cpuCount + made) * 2 + 1] = positions[k + 1];
    state.cpuVelocities[(state.cpuCount + made) * 2] = velocities[k];
    state.cpuVelocities[(state.cpuCount + made) * 2 + 1] = velocities[k + 1];
    state.cpuForces[(state.cpuCount + made) * 2] = 0;
    state.cpuForces[(state.cpuCount + made) * 2 + 1] = 0;
    state.cpuOldPositions[(state.cpuCount + made) * 2] = positions[k];
    state.cpuOldPositions[(state.cpuCount + made) * 2 + 1] = positions[k + 1];
    state.cpuFoam[state.cpuCount + made] = 1;
    made += 1;
  }
  uploadParticleRange(state, state.cpuCount, positions, velocities, made);
  state.cpuCount += made;
  state.writeIndex = state.cpuCount;
  state.activeLimit = state.cpuCount;
  if (state.cpuNeedsFullUpload) uploadCpuWaterToGpu(state, state.cpuCount, radius);
}

function addObstaclePoint(state: GpuWaterState, x: number, y: number, radius: number): void {
  if (state.obstaclePointCount >= MAX_OBSTACLE_POINTS) return;
  const index = state.obstaclePointCount * OBSTACLE_POINT_STRIDE;
  state.obstaclePoints[index] = x;
  state.obstaclePoints[index + 1] = y;
  state.obstaclePoints[index + 2] = radius;
  state.obstaclePointCount += 1;
}

function addObstacleLine(state: GpuWaterState, ax: number, ay: number, bx: number, by: number, radius: number): void {
  if (state.obstacleLineCount >= MAX_OBSTACLE_LINES) return;
  const index = state.obstacleLineCount * OBSTACLE_LINE_STRIDE;
  state.obstacleLines[index] = ax;
  state.obstacleLines[index + 1] = ay;
  state.obstacleLines[index + 2] = bx;
  state.obstacleLines[index + 3] = by;
  state.obstacleLines[index + 4] = radius;
  state.obstacleLineCount += 1;
}

function resetObstacles(state: GpuWaterState, preview: boolean): void {
  state.obstaclePointCount = 0;
  state.obstacleLineCount = 0;
  state.obstaclePoints.fill(0);
  state.obstacleLines.fill(0);
  const radius = preview
    ? Math.min(10, finiteNumberSetting(state.settings, 'buildRadius', 18))
    : finiteNumberSetting(state.settings, 'buildRadius', 18);
  const ramps = preview ? Math.min(2, Math.floor(finiteNumberSetting(state.settings, 'obstacleRamps', 2))) : Math.floor(finiteNumberSetting(state.settings, 'obstacleRamps', 4));
  const pegs = preview ? Math.min(2, Math.floor(finiteNumberSetting(state.settings, 'obstaclePegs', 2))) : Math.floor(finiteNumberSetting(state.settings, 'obstaclePegs', 3));
  for (let i = 0; i < pegs; i += 1) {
    addObstaclePoint(state, state.width * (0.28 + (i % 3) * 0.22), state.height * (0.36 + Math.floor(i / 3) * 0.18), radius);
  }
  for (let i = 0; i < ramps; i += 1) {
    const left = i % 2 === 0;
    const y = state.height * (0.56 + i * 0.08);
    addObstacleLine(state, state.width * (left ? 0.14 : 0.86), y, state.width * (left ? 0.48 : 0.52), y + state.height * 0.08, radius);
  }
}

function resetWater(state: GpuWaterState, preview: boolean): void {
  state.seed = 0x51f15e;
  state.spawnAccumulator = 0;
  state.physicsAccumulator = 0;
  state.physicsStepsLastFrame = 0;
  state.activeLimit = 0;
  state.writeIndex = 0;
  state.cpuCount = 0;
  state.cpuNeighborPairs = 0;
  state.cpuGridCellCount = 0;
  state.cpuGridColumns = 0;
  state.cpuGridRows = 0;
  state.cpuGridTouchedCount = 0;
  state.cpuRecycledParticles = 0;
  state.cpuNeedsFullUpload = false;
  state.cpuPositions.fill(0);
  state.cpuVelocities.fill(0);
  state.cpuForces.fill(0);
  state.cpuFoam.fill(0);
  state.cpuOldPositions.fill(0);
  state.cpuDensity.fill(0);
  state.cpuNearDensity.fill(0);
  state.buildController.reset();
  seedGpuParticles(state);
  resetObstacles(state, preview);
}

function installPointer(state: GpuWaterState): () => void {
  const down = (event: PointerEvent) => {
    const [x, y] = pointerXY(state.canvas, event);
    state.pointer = { active: true, id: event.pointerId, x, y, vx: 0, vy: 0 };
    state.canvas.setPointerCapture(event.pointerId);
    if (state.modeId === BUILD_MODE_ID) {
      state.buildController.begin(event.pointerId, { x, y });
    }
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    const [x, y] = pointerXY(state.canvas, event);
    state.pointer.vx = (x - state.pointer.x) * 60;
    state.pointer.vy = (y - state.pointer.y) * 60;
    state.pointer.x = x;
    state.pointer.y = y;
    if (state.modeId === BUILD_MODE_ID) {
      state.buildController.move(event.pointerId, { x, y });
    }
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    const [x, y] = pointerXY(state.canvas, event);
    if (state.modeId === BUILD_MODE_ID) {
      const radius = finiteNumberSetting(state.settings, 'buildRadius', 18);
      const fixture = state.buildController.end(event.pointerId, { x, y }, radius);
      if (fixture?.kind === 'line') addObstacleLine(state, fixture.start.x, fixture.start.y, fixture.end.x, fixture.end.y, radius);
      else if (fixture) addObstaclePoint(state, fixture.start.x, fixture.start.y, radius);
    } else {
      state.buildController.cancel(event.pointerId);
    }
    state.pointer.active = false;
    state.feedbackElement?.classList.add('hidden');
    state.canvas.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
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

function ensureQuad(state: GpuWaterState): WebGLBuffer | null {
  if (state.quadBuffer) return state.quadBuffer;
  state.quadBuffer = state.gl.createBuffer();
  if (!state.quadBuffer) return null;
  state.gl.bindBuffer(state.gl.ARRAY_BUFFER, state.quadBuffer);
  state.gl.bufferData(state.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), state.gl.STATIC_DRAW);
  return state.quadBuffer;
}


function enhancedDensityPointScale(state: GpuWaterState): number {
  const blend = clamp(finiteNumberSetting(state.settings, 'metaballBlend', 0.76), 0, 1);
  return 2.35 + blend * 0.3;
}

function ensureDensityTarget(state: GpuWaterState): boolean {
  const target = Math.max(128, Math.min(1024, Math.floor(finiteNumberSetting(state.settings, 'fluidGridResolution', 512))));
  const aspect = state.width / Math.max(1, state.height);
  const width = Math.max(1, Math.round(aspect >= 1 ? target : target * aspect));
  const height = Math.max(1, Math.round(aspect >= 1 ? target / aspect : target));
  if (state.densityTarget && state.blurTarget && state.densityWidth === width && state.densityHeight === height) return true;
  if (state.densityTarget) state.resources.destroyFramebuffer(state.densityTarget);
  if (state.blurTarget) state.resources.destroyFramebuffer(state.blurTarget);
  state.densityTarget = state.resources.createFramebuffer(state.resources.createRenderTexture({ width, height, precision: 'half-float', filter: 'linear' }));
  state.blurTarget = state.resources.createFramebuffer(state.resources.createRenderTexture({ width, height, precision: 'half-float', filter: 'linear' }));
  state.densityWidth = width;
  state.densityHeight = height;
  return true;
}

function unbindTextureUnits(gl: WebGL2RenderingContext): void {
  for (let unit = 0; unit < 4; unit += 1) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}

void renderDensity;
void blurDensity;
void renderComposite;

function renderDensity(state: GpuWaterState): void {
  const gpu = state.particleState;
  if (!gpu || !state.densityProgram || !ensureDensityTarget(state) || !state.densityTarget) return;
  const gl = state.gl;
  unbindTextureUnits(gl);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.densityTarget.framebuffer);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.viewport(0, 0, state.densityWidth, state.densityHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(state.densityProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gpu.positions.read.texture.texture);
  gl.uniform1i(gl.getUniformLocation(state.densityProgram, 'uPositions'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, gpu.velocities.read.texture.texture);
  gl.uniform1i(gl.getUniformLocation(state.densityProgram, 'uVelocities'), 1);
  gl.uniform2f(gl.getUniformLocation(state.densityProgram, 'uResolution'), state.width, state.height);
  gl.uniform2f(gl.getUniformLocation(state.densityProgram, 'uTextureSize'), gpu.width, gpu.height);
  const densityPixelScale = Math.min(
    state.densityWidth / Math.max(1, state.width),
    state.densityHeight / Math.max(1, state.height),
  );
  gl.uniform1f(gl.getUniformLocation(state.densityProgram, 'uPointScale'), enhancedDensityPointScale(state) * densityPixelScale);
  gl.uniform1f(gl.getUniformLocation(state.densityProgram, 'uActiveLimit'), state.activeLimit);
  gl.drawArrays(gl.POINTS, 0, state.activeLimit);
}

function blurDensity(state: GpuWaterState): RawFramebuffer | null {
  if (!state.blurProgram || !state.densityTarget || !state.blurTarget) return state.densityTarget;
  const quad = ensureQuad(state);
  if (!quad) return state.densityTarget;
  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.blurTarget.framebuffer);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.viewport(0, 0, state.densityWidth, state.densityHeight);
  gl.disable(gl.BLEND);
  gl.useProgram(state.blurProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.densityTarget.texture.texture);
  gl.uniform1i(gl.getUniformLocation(state.blurProgram, 'uTexture'), 0);
  gl.uniform2f(gl.getUniformLocation(state.blurProgram, 'uDirection'), 1.35 / Math.max(1, state.densityWidth), 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  unbindTextureUnits(gl);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.densityTarget.framebuffer);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.blurTarget.texture.texture);
  gl.uniform2f(gl.getUniformLocation(state.blurProgram, 'uDirection'), 0, 1.35 / Math.max(1, state.densityHeight));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return state.densityTarget;
}

function renderComposite(state: GpuWaterState, densityTarget: RawFramebuffer | null): void {
  if (!state.compositeProgram || !densityTarget) return;
  const quad = ensureQuad(state);
  if (!quad) return;
  const gl = state.gl;
  const palette = state.style?.palette ?? [0xb8f7ff, 0x4dd8ff, 0x0b4f8a, 0xffffff];
  const foam = colorNumberToRgb(palette[3] ?? palette[0], [0.92, 1, 1]);
  const surface = colorNumberToRgb(palette[0], [0.54, 0.95, 1]);
  const deep = colorNumberToRgb(palette[2] ?? palette[1], [0.02, 0.2, 0.36]);
  const renderStyle = typeof state.settings.renderStyle === 'string' ? state.settings.renderStyle : 'enhanced';
  const background = resolveSideViewPaletteBackdrop(
    state.style,
    renderStyle === 'ultra' ? 'ultra' : renderStyle === 'basic' || renderStyle === 'particles' ? 'basic' : 'enhanced',
    [0.01, 0.02, 0.04],
  ).base;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.drawBuffers([gl.BACK]);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.useProgram(state.compositeProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, densityTarget.texture.texture);
  gl.uniform1i(gl.getUniformLocation(state.compositeProgram, 'uDensity'), 0);
  gl.uniform2f(gl.getUniformLocation(state.compositeProgram, 'uTexel'), 1 / Math.max(1, state.densityWidth), 1 / Math.max(1, state.densityHeight));
  gl.uniform3f(gl.getUniformLocation(state.compositeProgram, 'uFoamColor'), foam[0], foam[1], foam[2]);
  gl.uniform3f(gl.getUniformLocation(state.compositeProgram, 'uSurfaceColor'), surface[0], surface[1], surface[2]);
  gl.uniform3f(gl.getUniformLocation(state.compositeProgram, 'uDeepColor'), deep[0], deep[1], deep[2]);
  gl.uniform3f(gl.getUniformLocation(state.compositeProgram, 'uBackground'), background[0], background[1], background[2]);
  gl.uniform1f(gl.getUniformLocation(state.compositeProgram, 'uOpacity'), finiteNumberSetting(state.settings, 'opacity', 0.74));
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function renderParticleOverlay(state: GpuWaterState): void {
  const renderStyle = typeof state.settings.renderStyle === 'string' ? state.settings.renderStyle : 'enhanced';
  const referenceRender = renderStyle !== 'basic' && renderStyle !== 'particles';
  const gpu = state.particleState;
  if (!gpu || !state.particleProgram) return;
  const gl = state.gl;
  const palette = state.style?.palette ?? [0xb8f7ff, 0x4dd8ff, 0x0b4f8a, 0xffffff];
  const surface = colorNumberToRgb(palette[0], [0.54, 0.95, 1]);
  const foam = colorNumberToRgb(palette[3] ?? palette[0], [0.92, 1, 1]);
  const palette0 = colorNumberToRgb(palette[0], [0.54, 0.95, 1]);
  const palette1 = colorNumberToRgb(palette[1] ?? palette[0], [0.3, 0.85, 1]);
  const palette2 = colorNumberToRgb(palette[2] ?? palette[1] ?? palette[0], [0.04, 0.32, 0.54]);
  const palette3 = colorNumberToRgb(palette[3] ?? palette[2] ?? palette[0], [0.92, 1, 1]);
  gl.enable(gl.BLEND);
  gl.blendFunc(referenceRender ? gl.ONE : gl.SRC_ALPHA, referenceRender ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(state.particleProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gpu.positions.read.texture.texture);
  gl.uniform1i(gl.getUniformLocation(state.particleProgram, 'uPositions'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, gpu.velocities.read.texture.texture);
  gl.uniform1i(gl.getUniformLocation(state.particleProgram, 'uVelocities'), 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, state.particleSpriteTexture);
  gl.uniform1i(gl.getUniformLocation(state.particleProgram, 'uSprite'), 2);
  gl.uniform2f(gl.getUniformLocation(state.particleProgram, 'uResolution'), state.width, state.height);
  gl.uniform2f(gl.getUniformLocation(state.particleProgram, 'uTextureSize'), gpu.width, gpu.height);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uPointScale'), referenceRender ? 2.0 : 1.8);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uActiveLimit'), state.activeLimit);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uSurfaceColor'), surface[0], surface[1], surface[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uFoamColor'), foam[0], foam[1], foam[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uPalette0'), palette0[0], palette0[1], palette0[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uPalette1'), palette1[0], palette1[1], palette1[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uPalette2'), palette2[0], palette2[1], palette2[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uPalette3'), palette3[0], palette3[1], palette3[2]);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uOpacity'), finiteNumberSetting(state.settings, 'opacity', 0.74));
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uReferenceRender'), referenceRender ? 1 : 0);
  gl.drawArrays(gl.POINTS, 0, state.activeLimit);
}

function clearParticleBackground(state: GpuWaterState): void {
  const gl = state.gl;
  const renderStyle = typeof state.settings.renderStyle === 'string' ? state.settings.renderStyle : 'enhanced';
  const background = resolveSideViewPaletteBackdrop(
    state.style,
    renderStyle === 'ultra' ? 'ultra' : renderStyle === 'basic' || renderStyle === 'particles' ? 'basic' : 'enhanced',
    [0.01, 0.02, 0.04],
  ).base;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.clearColor(background[0] * 0.82, background[1] * 0.82, background[2] * 0.82, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function renderObstacles(state: GpuWaterState): void {
  renderObstacleCapsules(state);
  if (!state.obstacleProgram || !state.obstaclePointBuffer || state.obstaclePointCount <= 0) return;
  const gl = state.gl;
  const data = new Float32Array(state.obstaclePointCount * 4);
  for (let i = 0; i < state.obstaclePointCount; i += 1) {
    const src = i * OBSTACLE_POINT_STRIDE;
    const dst = i * 4;
    data[dst] = state.obstaclePoints[src];
    data[dst + 1] = state.obstaclePoints[src + 1];
    data[dst + 2] = state.obstaclePoints[src + 2];
    data[dst + 3] = 1;
  }
  gl.disable(gl.BLEND);
  gl.useProgram(state.obstacleProgram);
  gl.uniform2f(gl.getUniformLocation(state.obstacleProgram, 'uResolution'), state.width, state.height);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.obstaclePointBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
  gl.drawArrays(gl.POINTS, 0, state.obstaclePointCount);
}

function renderObstacleCapsules(state: GpuWaterState): void {
  const buildRadius = finiteNumberSetting(state.settings, 'buildRadius', 18);
  const activeFixtures = state.buildController.activeFixtures(buildRadius);
  if (!state.obstacleMeshProgram || !state.obstacleMeshBuffer || (state.obstacleLineCount <= 0 && activeFixtures.length <= 0)) return;
  const vertices: number[] = [];
  for (let i = 0; i < state.obstacleLineCount; i += 1) {
    const src = i * OBSTACLE_LINE_STRIDE;
    const start = { x: state.obstacleLines[src], y: state.obstacleLines[src + 1] };
    const end = { x: state.obstacleLines[src + 2], y: state.obstacleLines[src + 3] };
    const radius = state.obstacleLines[src + 4];
    pushBuildCapsuleTriangles(vertices, start, end, radius);
  }
  for (const fixture of activeFixtures) {
    pushBuildFixtureTriangles(vertices, fixture, buildRadius);
  }
  if (vertices.length === 0) return;
  const gl = state.gl;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(state.obstacleMeshProgram);
  gl.uniform2f(gl.getUniformLocation(state.obstacleMeshProgram, 'uResolution'), state.width, state.height);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.obstacleMeshBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
}

function updateFeedback(state: GpuWaterState): void {
  const feedback = state.feedbackElement;
  if (!feedback) return;
  if (!state.pointer.active || state.modeId === BUILD_MODE_ID) {
    feedback.classList.add('hidden');
    return;
  }
  const radius = state.modeId === 'splash' ? finiteNumberSetting(state.settings, 'interactionRadius', 76) : finiteNumberSetting(state.settings, 'pourRadius', 22);
  const rect = state.canvas.getBoundingClientRect();
  const sx = rect.width / Math.max(1, state.width);
  const sy = rect.height / Math.max(1, state.height);
  const cssR = radius * Math.max(sx, sy);
  feedback.classList.remove('hidden');
  feedback.style.width = `${cssR * 2}px`;
  feedback.style.height = `${cssR * 2}px`;
  feedback.style.transform = `translate(${state.pointer.x * sx - cssR}px, ${state.pointer.y * sy - cssR}px)`;
  feedback.style.borderColor = state.modeId === 'splash' ? 'rgba(255,255,255,0.34)' : 'rgba(103,232,249,0.42)';
  feedback.style.backgroundColor = state.modeId === 'splash' ? 'rgba(255,255,255,0.12)' : 'rgba(34,211,238,0.12)';
}

function applyGestures(state: GpuWaterState): void {
  if (state.modeId !== 'pour') {
    state.pendingGestures.length = 0;
    return;
  }
  while (state.pendingGestures.length > 0) {
    const gesture = state.pendingGestures.shift();
    if (!gesture) continue;
    const rate = pourRate(state);
    const count = clamp(Math.floor(rate / 24), 48, 420);
    const spread = finiteNumberSetting(state.settings, 'pourRadius', 34);
    uploadParticleCluster(state, gesture.x, gesture.y, count, spread, (gesture.dx ?? 0) * 10, (gesture.dy ?? 0) * 10 + 125);
  }
}

function emitWater(state: GpuWaterState, dt: number): void {
  if (state.modeId !== 'pour' || !state.pointer.active) {
    state.spawnAccumulator = 0;
    return;
  }
  const rate = pourRate(state);
  const pourRadius = finiteNumberSetting(state.settings, 'pourRadius', 34);
  state.spawnAccumulator = Math.min(rate, state.spawnAccumulator + rate * dt);
  const count = Math.min(420, Math.floor(state.spawnAccumulator));
  if (count <= 0) return;
  state.spawnAccumulator -= count;
  uploadParticleCluster(state, state.pointer.x, state.pointer.y, count, pourRadius, state.pointer.vx * 0.1, state.pointer.vy * 0.1 + 125);
}

function applyInteractionField(state: GpuWaterState, dt: number): void {
  if (state.modeId !== 'splash' || !state.pointer.active || state.cpuCount <= 0) return;
  const radius = finiteNumberSetting(state.settings, 'interactionRadius', 76);
  const strength = finiteNumberSetting(state.settings, 'interactionStrength', 18);
  const radiusSquared = radius * radius;
  const px = state.pointer.x;
  const py = state.pointer.y;
  const fieldVx = state.pointer.vx;
  const fieldVy = state.pointer.vy;
  const idleKick = Math.hypot(fieldVx, fieldVy) < 0.001 ? 0 : 1;
  const p = state.cpuPositions;
  const v = state.cpuVelocities;
  for (let i = 0; i < state.cpuCount; i += 1) {
    const k = i * 2;
    const dx = p[k] - px;
    const dy = p[k + 1] - py;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > radiusSquared) continue;
    const distance = Math.sqrt(Math.max(0.0001, distanceSquared));
    const falloff = 1 - distance / Math.max(1, radius);
    const force = falloff * falloff * strength * dt * idleKick;
    v[k] += fieldVx * force;
    v[k + 1] += fieldVy * force;
  }
}

function simulateSphWater(state: GpuWaterState, dt: number): void {
  const count = Math.min(state.cpuCount, maxParticles(state));
  state.cpuCount = count;
  state.activeLimit = count;
  if (count <= 0) return;

  const radius = particleRadius(state);
  const supportRadiusScale = finiteNumberSetting(state.settings, 'supportRadiusScale', 1.35);
  const softContactRadius = radius * 0.92;
  const supportRadius = Math.max(radius * supportRadiusScale, radius * 1.15);
  const densityScale = 1 / Math.max(1, (supportRadius / Math.max(1, radius)) * 0.72);
  const gravity = finiteNumberSetting(state.settings, 'gravity', 1120);
  const restDensity = finiteNumberSetting(state.settings, 'restDensity', 6.4);
  const stiffness = finiteNumberSetting(state.settings, 'stiffness', 0.0061) * radius * 5.5;
  const nearStiffness = finiteNumberSetting(state.settings, 'nearStiffness', 0.625) * radius * 0.95;
  const viscosity = viscosityValue(state);
  const sigma = finiteNumberSetting(state.settings, 'viscositySigma', 0.9);
  const beta = finiteNumberSetting(state.settings, 'viscosityBeta', 0.3);
  const surfaceSettling = finiteNumberSetting(state.settings, 'surfaceTension', 900);
  const maxSpeed = finiteNumberSetting(state.settings, 'maxFluidSpeed', 2400);
  const substeps = Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'substeps', 2)));
  const stepDt = Math.min(1 / 60, dt / substeps);
  const frameDt = Math.max(0.25, Math.min(1, stepDt * 60));
  const positions = state.cpuPositions;
  const velocities = state.cpuVelocities;
  const forces = state.cpuForces;
  const old = state.cpuOldPositions;
  const density = state.cpuDensity;
  const nearDensity = state.cpuNearDensity;

  for (let step = 0; step < substeps; step += 1) {
    for (let i = 0; i < count; i += 1) {
      const k = i * 2;
      const relaxationX = forces[k];
      const relaxationY = forces[k + 1];
      positions[k] += relaxationX;
      positions[k + 1] += relaxationY;
      velocities[k] += clamp(relaxationX / Math.max(0.001, stepDt), -maxSpeed * 0.1, maxSpeed * 0.1);
      velocities[k + 1] += clamp(relaxationY / Math.max(0.001, stepDt), -maxSpeed * 0.1, maxSpeed * 0.1);
      forces[k] = 0;
      forces[k + 1] = 0;
      old[k] = positions[k];
      old[k + 1] = positions[k + 1];
      velocities[k + 1] += gravity * stepDt;
      const speed = Math.hypot(velocities[k], velocities[k + 1]);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        velocities[k] *= scale;
        velocities[k + 1] *= scale;
      }
      density[i] = 0;
      nearDensity[i] = 0;
    }
    if (viscosity > 0.0001 && (sigma > 0.0001 || beta > 0.0001)) {
      const viscosityGrid = buildCpuSpatialGrid(state, count, positions, supportRadius);

      forEachSphPair(count, positions, supportRadius, viscosityGrid, (i, j, nx, ny, _distance, a) => {
        const i2 = i * 2;
        const j2 = j * 2;
        const u = (velocities[i2] - velocities[j2]) * nx + (velocities[i2 + 1] - velocities[j2 + 1]) * ny;
        const uFrame = u * stepDt;
        const rawImpulse = a * (sigma * uFrame + beta * uFrame * Math.abs(uFrame)) * 0.5 * viscosity * frameDt;
        const impulse = clamp(rawImpulse, -Math.abs(uFrame), Math.abs(uFrame)) / Math.max(0.001, stepDt);
        velocities[i2] -= nx * impulse;
        velocities[i2 + 1] -= ny * impulse;
        velocities[j2] += nx * impulse;
        velocities[j2 + 1] += ny * impulse;
      });
    }

    for (let i = 0; i < count; i += 1) {
      const k = i * 2;
      positions[k] += velocities[k] * stepDt;
      positions[k + 1] += velocities[k + 1] * stepDt;
      collideCpuParticle(state, i, radius);
    }

    const pressureGrid = buildCpuSpatialGrid(state, count, positions, supportRadius);
    const neighborPairs = cacheDensityPairs(state, count, positions, supportRadius, pressureGrid, densityScale, neighborPairBudget(state, count));
    state.cpuNeighborPairs = neighborPairs;
    state.cpuGridCellCount = pressureGrid.columns * pressureGrid.rows;

    for (let pair = 0; pair < neighborPairs; pair += 1) {
      const i = state.cpuPairI[pair];
      const j = state.cpuPairJ[pair];
      const nx = state.cpuPairNx[pair];
      const ny = state.cpuPairNy[pair];
      const a = state.cpuPairA[pair];
      const pressureI = stiffness * (density[i] - restDensity);
      const pressureJ = stiffness * (density[j] - restDensity);
      const nearPressure = nearStiffness * (nearDensity[i] + nearDensity[j]) * 0.5;
      const displacement = ((pressureI + pressureJ) * 0.5 * a + nearPressure * a * a) * frameDt * frameDt;
      const distance = supportRadius * (1 - a);
      const overlapPush = Math.max(0, softContactRadius - distance) * 0.08;
      const amount = clamp(displacement * 0.5 + overlapPush, -radius * 0.08, radius * 0.28);
      const dx = nx * amount;
      const dy = ny * amount;
      const i2 = i * 2;
      const j2 = j * 2;
      forces[i2] += dx;
      forces[i2 + 1] += dy;
      forces[j2] -= dx;
      forces[j2 + 1] -= dy;
    }

    for (let i = 0; i < count; i += 1) {
      const k = i * 2;
      const reconstructedX = (positions[k] - old[k]) / Math.max(0.001, stepDt);
      const reconstructedY = (positions[k + 1] - old[k + 1]) / Math.max(0.001, stepDt);
      velocities[k] = velocities[k] * 0.18 + reconstructedX * 0.82;
      velocities[k + 1] = velocities[k + 1] * 0.18 + reconstructedY * 0.82;
      const densityRatio = density[i] / Math.max(0.001, restDensity);
      const exposedSurface = clamp(1 - densityRatio, 0, 1);
      const settlingDamping = 1 / (1 + surfaceSettling * exposedSurface * 0.00022 * frameDt);
      if (velocities[k + 1] < 0) velocities[k + 1] *= settlingDamping;
      velocities[k] *= 1 / (1 + surfaceSettling * exposedSurface * 0.000035 * frameDt);
      velocities[k] *= 0.997;
      velocities[k + 1] *= 0.997;
      if (positions[k + 1] > state.height - radius * 1.45 && Math.hypot(velocities[k], velocities[k + 1]) < radius * 5.5) {
        velocities[k] = 0;
        velocities[k + 1] = 0;
      }
      const foamSpeed = smoothstep(maxSpeed * 0.32, maxSpeed * 0.82, Math.hypot(velocities[k], velocities[k + 1]));
      state.cpuFoam[i] = clamp(state.cpuFoam[i] * 0.998 + foamSpeed * 0.012, 0, 1);
    }
  }

}

function cacheDensityPairs(
  state: GpuWaterState,
  count: number,
  positions: Float32Array,
  supportRadius: number,
  grid: CpuSpatialGrid,
  densityScale: number,
  pairLimit: number,
): number {
  const limit = Math.max(0, Math.floor(pairLimit));
  if (state.cpuPairI.length < limit) {
    state.cpuPairI = new Int32Array(limit);
    state.cpuPairJ = new Int32Array(limit);
    state.cpuPairNx = new Float32Array(limit);
    state.cpuPairNy = new Float32Array(limit);
    state.cpuPairA = new Float32Array(limit);
  }
  state.cpuNeighborPairLimit = limit;
  state.cpuNeighborPairsDropped = 0;
  let pairCount = 0;
  forEachSphPair(
    count,
    positions,
    supportRadius,
    grid,
    (i, j, nx, ny, _distance, a) => {
      const aa = a * a;
      const aaa = aa * a;
      densityScalePair(state, i, j, aa, aaa, densityScale);
      if (pairCount < limit) {
        state.cpuPairI[pairCount] = i;
        state.cpuPairJ[pairCount] = j;
        state.cpuPairNx[pairCount] = nx;
        state.cpuPairNy[pairCount] = ny;
        state.cpuPairA[pairCount] = a;
        pairCount += 1;
      } else {
        state.cpuNeighborPairsDropped += 1;
      }
    },
  );
  return pairCount;
}

function densityScalePair(state: GpuWaterState, i: number, j: number, aa: number, aaa: number, densityScale: number): void {
  state.cpuDensity[i] += aa * densityScale;
  state.cpuDensity[j] += aa * densityScale;
  state.cpuNearDensity[i] += aaa * densityScale;
  state.cpuNearDensity[j] += aaa * densityScale;
}

function forEachSphPair(
  count: number,
  positions: Float32Array,
  supportRadius: number,
  grid: CpuSpatialGrid,
  visit: (i: number, j: number, nx: number, ny: number, distance: number, a: number) => void,
  countPairs = false,
): number {
  let pairCount = 0;
  const supportRadiusSquared = supportRadius * supportRadius;
  for (let i = 0; i < count; i += 1) {
    const i2 = i * 2;
    const gx = clamp(Math.floor(positions[i2] / grid.cellSize), 0, grid.columns - 1);
    const gy = clamp(Math.floor(positions[i2 + 1] / grid.cellSize), 0, grid.rows - 1);
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const cx = gx + ox;
        const cy = gy + oy;
        if (cx < 0 || cy < 0 || cx >= grid.columns || cy >= grid.rows) continue;
        let j = grid.heads[cy * grid.columns + cx];
        while (j >= 0) {
          const current = j;
          j = grid.next[j];
          if (current <= i) continue;
          const j2 = current * 2;
          const dx = positions[i2] - positions[j2];
          const dy = positions[i2 + 1] - positions[j2 + 1];
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > 0.0001 && distanceSquared < supportRadiusSquared) {
            const distance = Math.sqrt(distanceSquared);
            const a = 1 - distance / supportRadius;
            if (countPairs) pairCount += 1;
            visit(i, current, dx / distance, dy / distance, distance, a);
          }
        }
      }
    }
  }
  return pairCount;
}

function buildCpuSpatialGrid(
  state: GpuWaterState,
  count: number,
  positions: Float32Array,
  cellSize: number,
): CpuSpatialGrid {
  const columns = Math.max(1, Math.ceil(state.width / cellSize));
  const rows = Math.max(1, Math.ceil(state.height / cellSize));
  const cellCount = columns * rows;
  const gridShapeChanged = state.cpuGridColumns !== columns || state.cpuGridRows !== rows;
  if (state.cpuGridHeads.length < cellCount) {
    state.cpuGridHeads = new Int32Array(cellCount);
    state.cpuGridHeads.fill(-1);
    state.cpuGridTouchedCount = 0;
  } else if (gridShapeChanged) {
    state.cpuGridHeads.fill(-1, 0, cellCount);
    state.cpuGridTouchedCount = 0;
  } else {
    for (let i = 0; i < state.cpuGridTouchedCount; i += 1) {
      state.cpuGridHeads[state.cpuGridTouched[i]] = -1;
    }
    state.cpuGridTouchedCount = 0;
  }
  if (state.cpuGridNext.length < count) state.cpuGridNext = new Int32Array(Math.max(count, state.capacity));
  if (state.cpuGridTouched.length < cellCount) state.cpuGridTouched = new Int32Array(cellCount);
  state.cpuGridColumns = columns;
  state.cpuGridRows = rows;
  for (let i = 0; i < count; i += 1) {
    const k = i * 2;
    const gx = clamp(Math.floor(positions[k] / cellSize), 0, columns - 1);
    const gy = clamp(Math.floor(positions[k + 1] / cellSize), 0, rows - 1);
    const cell = gy * columns + gx;
    if (state.cpuGridHeads[cell] < 0) {
      state.cpuGridTouched[state.cpuGridTouchedCount] = cell;
      state.cpuGridTouchedCount += 1;
    }
    state.cpuGridNext[i] = state.cpuGridHeads[cell];
    state.cpuGridHeads[cell] = i;
  }
  return {
    heads: state.cpuGridHeads,
    next: state.cpuGridNext,
    columns,
    rows,
    cellSize,
  };
}

function collideCpuParticle(state: GpuWaterState, index: number, radius: number): void {
  const k = index * 2;
  const p = state.cpuPositions;
  const v = state.cpuVelocities;
  const bounce = clamp(finiteNumberSetting(state.settings, 'collisionBounce', 0.04), 0, 0.4);
  const wallFriction = 1 - clamp(finiteNumberSetting(state.settings, 'viscosity', 1) * 0.018, 0.04, 0.34);
  if (p[k] < radius) {
    p[k] = radius;
    v[k] = Math.abs(v[k]) * bounce;
    v[k + 1] *= wallFriction;
  } else if (p[k] > state.width - radius) {
    p[k] = state.width - radius;
    v[k] = -Math.abs(v[k]) * bounce;
    v[k + 1] *= wallFriction;
  }
  if (p[k + 1] < radius) {
    p[k + 1] = radius;
    v[k + 1] = Math.abs(v[k + 1]) * bounce;
    v[k] *= wallFriction;
  } else if (p[k + 1] > state.height - radius) {
    p[k + 1] = state.height - radius;
    v[k + 1] = -Math.abs(v[k + 1]) * bounce;
    v[k] *= wallFriction * 0.72;
  }
  const obstacleRadius = finiteNumberSetting(state.settings, 'buildRadius', 18);
  for (let i = 0; i < state.obstaclePointCount; i += 1) {
    const src = i * OBSTACLE_POINT_STRIDE;
    collideCpuCircle(state, index, state.obstaclePoints[src], state.obstaclePoints[src + 1], state.obstaclePoints[src + 2], bounce);
  }
  for (let i = 0; i < state.obstacleLineCount; i += 1) {
    const src = i * OBSTACLE_LINE_STRIDE;
    const ax = state.obstacleLines[src];
    const ay = state.obstacleLines[src + 1];
    const bx = state.obstacleLines[src + 2];
    const by = state.obstacleLines[src + 3];
    const abx = bx - ax;
    const aby = by - ay;
    const t = clamp(((p[k] - ax) * abx + (p[k + 1] - ay) * aby) / Math.max(1, abx * abx + aby * aby), 0, 1);
    collideCpuCircle(state, index, ax + abx * t, ay + aby * t, obstacleRadius, bounce);
  }
}

function collideCpuCircle(state: GpuWaterState, index: number, cx: number, cy: number, obstacleRadius: number, bounce: number): void {
  const radius = particleRadius(state);
  const k = index * 2;
  const p = state.cpuPositions;
  const v = state.cpuVelocities;
  const dx = p[k] - cx;
  const dy = p[k + 1] - cy;
  const distance = Math.hypot(dx, dy);
  const limit = obstacleRadius + radius;
  if (distance <= 0.0001 || distance >= limit) return;
  const nx = dx / distance;
  const ny = dy / distance;
  p[k] = cx + nx * limit;
  p[k + 1] = cy + ny * limit;
  const vn = v[k] * nx + v[k + 1] * ny;
  if (vn < 0) {
    v[k] -= nx * vn * (1 + bounce);
    v[k + 1] -= ny * vn * (1 + bounce);
    v[k] *= 0.96;
    v[k + 1] *= 0.96;
  }
}

function uploadCpuWaterToGpu(state: GpuWaterState, count: number, radius: number): void {
  if (count <= 0) return;
  const required = count * 4;
  if (state.cpuUploadPositions.length < required) state.cpuUploadPositions = new Float32Array(required);
  if (state.cpuUploadVelocities.length < required) state.cpuUploadVelocities = new Float32Array(required);
  const positions = state.cpuUploadPositions;
  const velocities = state.cpuUploadVelocities;
  for (let i = 0; i < count; i += 1) {
    const src = i * 2;
    const dst = i * 4;
    positions[dst] = state.cpuPositions[src];
    positions[dst + 1] = state.cpuPositions[src + 1];
    positions[dst + 2] = radius;
    positions[dst + 3] = 1;
    velocities[dst] = state.cpuVelocities[src];
    velocities[dst + 1] = state.cpuVelocities[src + 1];
    velocities[dst + 2] = radius;
    velocities[dst + 3] = state.cpuFoam[i];
  }
  uploadParticleRange(state, 0, positions, velocities, count);
  state.cpuNeedsFullUpload = false;
}

function advanceWaterSimulation(state: GpuWaterState): void {
  const frameDt = Math.min(1 / 20, Math.max(0, state.deltaSeconds));
  emitWater(state, frameDt);
  applyInteractionField(state, frameDt);
  state.physicsAccumulator = Math.min(state.physicsAccumulator + frameDt, 1 / 10);
  const fixedDt = 1 / 60;
  const maxSteps = state.cpuCount > 3072 ? 2 : state.cpuCount > 1536 ? 3 : 4;
  let steps = 0;
  while (state.physicsAccumulator >= fixedDt && steps < maxSteps) {
    simulateSphWater(state, fixedDt);
    state.physicsAccumulator -= fixedDt;
    steps += 1;
  }
  if (steps > 0 && state.cpuCount > 0) {
    uploadCpuWaterToGpu(state, state.cpuCount, particleRadius(state));
  }
  if (steps === maxSteps && state.physicsAccumulator >= fixedDt) {
    state.physicsAccumulator = Math.min(state.physicsAccumulator, fixedDt * 0.5);
  }
  state.physicsStepsLastFrame = steps;
}

function renderWater(state: GpuWaterState): void {
  applyGestures(state);
  updateFeedback(state);
  advanceWaterSimulation(state);
  const renderStyle = typeof state.settings.renderStyle === 'string' ? state.settings.renderStyle : 'enhanced';
  if (renderStyle === 'basic' || renderStyle === 'particles') {
    clearParticleBackground(state);
    renderParticleOverlay(state);
    renderObstacles(state);
    return;
  }
  const gpu = state.particleState;
  if (gpu && state.liquidSurface) {
    const options = liquidSurfaceOptionsFromSettings(state.settings, renderStyle);
    renderLiquidSurfaceFromTextureParticles({
      state,
      renderer: state.liquidSurface,
      positionsTexture: gpu.positions.read.texture.texture,
      velocitiesTexture: gpu.velocities.read.texture.texture,
      textureWidth: gpu.width,
      textureHeight: gpu.height,
      activeCount: state.activeLimit,
      palette: {
        palette: state.style?.palette ?? [0xb8f7ff, 0x4dd8ff, 0x0b4f8a, 0xffffff],
        background: state.style?.background,
      },
      options,
      resolution: finiteNumberSetting(state.settings, 'fluidGridResolution', 512) * finiteNumberSetting(state.settings, 'liquidFieldScale', 0.78),
    });
  }
  renderObstacles(state);
}

function destroyWater(state: GpuWaterState): void {
  state.cleanupPointer?.();
  if (state.densityTarget) state.resources.destroyFramebuffer(state.densityTarget);
  if (state.blurTarget) state.resources.destroyFramebuffer(state.blurTarget);
  if (state.particleState) state.particleState.destroy();
  if (state.densityProgram) state.gl.deleteProgram(state.densityProgram);
  if (state.blurProgram) state.gl.deleteProgram(state.blurProgram);
  if (state.compositeProgram) state.gl.deleteProgram(state.compositeProgram);
  if (state.particleProgram) state.gl.deleteProgram(state.particleProgram);
  if (state.obstacleProgram) state.gl.deleteProgram(state.obstacleProgram);
  if (state.obstacleMeshProgram) state.gl.deleteProgram(state.obstacleMeshProgram);
  destroyRawLiquidSurfaceRenderer(state, state.liquidSurface);
  if (state.particleSpriteTexture) state.gl.deleteTexture(state.particleSpriteTexture);
  if (state.quadBuffer) state.gl.deleteBuffer(state.quadBuffer);
  if (state.obstaclePointBuffer) state.gl.deleteBuffer(state.obstaclePointBuffer);
  if (state.obstacleMeshBuffer) state.gl.deleteBuffer(state.obstacleMeshBuffer);
}

export class RawGpuParticleWaterScene extends RawWebGL2Scene {
  private readonly pendingGestures: GestureEvent[] = [];

  constructor(private readonly preview = false) {
    super({
      name: 'Water Tank',
      markup: MARKUP,
      canvasSelector: '[data-gpu-water-canvas]',
      maxDevicePixelRatio: preview ? 1 : 2,
      onInit: (state) => {
        const s = state as GpuWaterState;
        s.capacity = preview ? 2048 : 8192;
        s.activeLimit = 0;
        s.writeIndex = 0;
        s.densityProgram = link(s.gl, DENSITY_VERTEX, DENSITY_FRAGMENT);
        s.blurProgram = link(s.gl, QUAD_VERTEX, BLUR_FRAGMENT);
        s.compositeProgram = link(s.gl, QUAD_VERTEX, COMPOSITE_FRAGMENT);
        s.particleProgram = link(s.gl, DENSITY_VERTEX, PARTICLE_FRAGMENT);
        s.obstacleProgram = link(s.gl, OBSTACLE_VERTEX, OBSTACLE_FRAGMENT);
        s.obstacleMeshProgram = link(s.gl, OBSTACLE_MESH_VERTEX, OBSTACLE_MESH_FRAGMENT);
        s.liquidSurface = createRawLiquidSurfaceRenderer(s.gl);
        s.particleSpriteTexture = createReferenceParticleSprite(s.gl);
        s.quadBuffer = null;
        s.obstaclePointBuffer = s.gl.createBuffer();
        s.obstacleMeshBuffer = s.gl.createBuffer();
        s.densityTarget = null;
        s.blurTarget = null;
        s.densityWidth = 0;
        s.densityHeight = 0;
        s.particleState = new RawGpuParticleState(s.resources, { capacity: s.capacity, precision: 'float' });
        s.cpuPositions = new Float32Array(s.capacity * 2);
        s.cpuVelocities = new Float32Array(s.capacity * 2);
        s.cpuForces = new Float32Array(s.capacity * 2);
        s.cpuFoam = new Float32Array(s.capacity);
        s.cpuOldPositions = new Float32Array(s.capacity * 2);
        s.cpuDensity = new Float32Array(s.capacity);
        s.cpuNearDensity = new Float32Array(s.capacity);
        s.cpuPairI = new Int32Array(65536);
        s.cpuPairJ = new Int32Array(65536);
        s.cpuPairNx = new Float32Array(65536);
        s.cpuPairNy = new Float32Array(65536);
        s.cpuPairA = new Float32Array(65536);
        s.cpuUploadPositions = new Float32Array(s.capacity * 4);
        s.cpuUploadVelocities = new Float32Array(s.capacity * 4);
        s.spawnUploadPositions = new Float32Array(1024);
        s.spawnUploadVelocities = new Float32Array(1024);
        s.cpuGridHeads = new Int32Array(0);
        s.cpuGridNext = new Int32Array(s.capacity);
        s.cpuGridTouched = new Int32Array(0);
        s.cpuGridTouchedCount = 0;
        s.cpuGridColumns = 0;
        s.cpuGridRows = 0;
        s.cpuNeighborPairs = 0;
        s.cpuNeighborPairLimit = 65536;
        s.cpuNeighborPairsDropped = 0;
        s.cpuGridCellCount = 0;
        s.cpuRecycledParticles = 0;
        s.cpuNeedsFullUpload = false;
        s.cpuCount = 0;
        s.pointer = { active: false, id: -1, x: 0, y: 0, vx: 0, vy: 0 };
        s.modeId = 'pour';
        s.spawnAccumulator = 0;
        s.physicsAccumulator = 0;
        s.physicsStepsLastFrame = 0;
        s.seed = 0x51f15e;
        s.obstaclePoints = new Float32Array(MAX_OBSTACLE_POINTS * OBSTACLE_POINT_STRIDE);
        s.obstaclePointCount = 0;
        s.obstacleLines = new Float32Array(MAX_OBSTACLE_LINES * OBSTACLE_LINE_STRIDE);
        s.obstacleLineCount = 0;
        s.buildController = new BuildPathController();
        s.pendingGestures = this.pendingGestures;
        s.feedbackElement = s.canvas.parentElement?.querySelector<HTMLDivElement>('[data-gpu-water-feedback]') ?? null;
        s.canvas.dataset.pixiLabContextLabel = 'water-tank-gpu';
        s.cleanupPointer = installPointer(s);
        resetWater(s, preview);
      },
      onReset: (state) => resetWater(state as GpuWaterState, preview),
      onModeChange: (state, mode) => {
        const waterState = state as GpuWaterState;
        waterState.modeId = mode === 'demo' ? 'pour' : mode === 'interact' ? 'splash' : mode;
        waterState.pendingGestures.length = 0;
        waterState.spawnAccumulator = 0;
        waterState.buildController.reset();
      },
      render: (state) => renderWater(state as GpuWaterState),
      getDebugStats: (state): RawSceneDebugStats => {
        const s = state as GpuWaterState;
        return {
          renderer: 'raw-webgl2-particle-water',
          simulation: 'cpu-spatial-hash-sph-double-density-relaxation',
          rendering: 'gpu-density-metaball-water',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: s.activeLimit > 0,
          cpuUploadFloats: s.activeLimit * 8,
          cpuBroadphase: 'typed-array-spatial-hash',
          cpuGrid: `${s.cpuGridColumns}x${s.cpuGridRows}`,
          cpuGridCells: s.cpuGridCellCount,
          cpuTouchedGridCells: s.cpuGridTouchedCount,
          cpuNeighborPairs: s.cpuNeighborPairs,
          cpuNeighborPairLimit: s.cpuNeighborPairLimit,
          cpuNeighborPairsDropped: s.cpuNeighborPairsDropped,
          cpuRecycledParticles: s.cpuRecycledParticles,
          particles: s.activeLimit,
          maxParticles: maxParticles(s),
          particleTexture: s.particleState ? `${s.particleState.width}x${s.particleState.height}` : null,
          particleRadius: Math.round(particleRadius(s) * 100) / 100,
          supportRadiusScale: finiteNumberSetting(s.settings, 'supportRadiusScale', 1.35),
          restDensity: finiteNumberSetting(s.settings, 'restDensity', 0.72),
          stiffness: finiteNumberSetting(s.settings, 'stiffness', 0.028),
          nearStiffness: finiteNumberSetting(s.settings, 'nearStiffness', 1.15),
          surfaceSettling: finiteNumberSetting(s.settings, 'surfaceTension', 900),
          collisionBounce: finiteNumberSetting(s.settings, 'collisionBounce', 0.04),
          physicsStepsLastFrame: s.physicsStepsLastFrame,
          physicsAccumulatorMs: Math.round(s.physicsAccumulator * 100000) / 100,
          densityTarget: s.densityTarget ? `${s.densityWidth}x${s.densityHeight}` : null,
          gpuBroadphase: 'not-active',
          obstaclePoints: s.obstaclePointCount,
          obstacleLines: s.obstacleLineCount,
          renderStyle: typeof s.settings.renderStyle === 'string' ? s.settings.renderStyle : 'enhanced',
          mode: s.modeId,
          preview: this.preview,
        };
      },
      onDestroy: (state) => destroyWater(state as GpuWaterState),
    });
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.pendingGestures.push(...gestures);
  }
}
