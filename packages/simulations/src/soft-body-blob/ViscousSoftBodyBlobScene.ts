import {
  RawGpuConstraintParticleCellRangeBridge,
  RawGpuConstraintParticleCellOffsetPass,
  RawGpuConstraintParticleCellOccupancyPass,
  RawGpuConstraintParticleCellRangeFromOffsetsPass,
  RawGpuConstraintParticleCellKeyPass,
  RawGpuConstraintParticleSortedKeyGatherPass,
  RawGpuConstraintParticleSortedKeyRangePass,
  RawGpuConstraintParticleCircleCollisionPass,
  RawGpuConstraintParticleBodyMetadataBridge,
  RawGpuConstraintParticleBodyShapePass,
  RawGpuConstraintParticleGridKeyPass,
  RawGpuConstraintParticleIndexMapBridge,
  RawGpuConstraintParticleIndexMapGatherPass,
  RawGpuConstraintParticleNeighborSlots,
  RawGpuConstraintParticlePressurePass,
  RawGpuConstraintParticleResidentListCandidatePass,
  RawGpuConstraintParticleResidentListFromSortedKeysPass,
  RawGpuConstraintParticleSortedCellCandidatePass,
  RawGpuConstraintParticleState,
  RawGpuConstraintParticleViscosityPass,
  RawGpuKeyIndexSortPass,
  RawWebGL2Scene,
  colorNumberToRgb,
  finiteNumberSetting,
  type RawGpuConstraintParticleGridKeyStats,
  type RawGpuConstraintParticleCellOffsetStats,
  type RawGpuConstraintParticleCellOccupancyStats,
  type RawGpuConstraintParticleCellRangeFromOffsetsStats,
  type RawGpuConstraintParticleCellKeyStats,
  type RawGpuConstraintParticleSortedKeyGatherStats,
  type RawGpuConstraintParticleSortedKeyRangeStats,
  type RawGpuConstraintParticleSortedCellCandidateStats,
  type RawGpuConstraintParticleResidentListCandidateStats,
  type RawGpuConstraintParticleResidentListFromSortedKeysStats,
  type RawWebGL2RenderState,
  type RawGpuKeyIndexSortStats,
} from '@hooksjam/pixi-lab-core';

const SOFT_BLOB_SORTED_CELL_RESIDENT_SCAN_LIMIT = 8;

interface SoftBlobRuntime extends RawWebGL2RenderState {
  blob?: SoftBlobWorld;
}

interface PointerState {
  id: number | null;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  down: boolean;
  drawing: boolean;
  dragging: boolean;
  building: boolean;
  spawnAccumulator: number;
  drawPoints: Array<{ x: number; y: number }>;
  grabbedBodies: number[];
}

interface SoftBlobPrograms {
  skin: WebGLProgram;
  circle: WebGLProgram;
  density: WebGLProgram;
  densityComposite: WebGLProgram;
}

interface SoftBlobProgramUniforms {
  resolution: WebGLUniformLocation | null;
  palette: Array<WebGLUniformLocation | null>;
}

interface SoftBlobUniforms {
  skin: SoftBlobProgramUniforms;
  circle: SoftBlobProgramUniforms;
}

interface SoftBlobBuffers {
  skinVao: WebGLVertexArrayObject;
  skinVbo: WebGLBuffer;
  skinIbo: WebGLBuffer;
  circleVao: WebGLVertexArrayObject;
  densityVao: WebGLVertexArrayObject;
  compositeVao: WebGLVertexArrayObject;
  quadVbo: WebGLBuffer;
  circleVbo: WebGLBuffer;
  compositeVbo: WebGLBuffer;
}

type SoftBlobGpuCandidateStressSource = 'gpu-sorted-cell-ranges' | 'gpu-resident-list';
type SoftBlobGpuCandidateStressStats = RawGpuConstraintParticleSortedCellCandidateStats | RawGpuConstraintParticleResidentListCandidateStats;

interface SoftBlobGpuCandidateStressInput {
  state: RawGpuConstraintParticleState;
  neighbors: RawGpuConstraintParticleNeighborSlots;
  stats: SoftBlobGpuCandidateStressStats;
  source: SoftBlobGpuCandidateStressSource;
}

interface SoftBlobWorld {
  preview: boolean;
  programs: SoftBlobPrograms;
  uniforms: SoftBlobUniforms;
  buffers: SoftBlobBuffers;
  cleanup: Array<() => void>;
  pointer: PointerState;
  overlay: HTMLCanvasElement | null;
  overlayContext: CanvasRenderingContext2D | null;
  bodyCount: number;
  particleCount: number;
  resetFloorTimer: number;
  demoSpawnTimer: number;
  floorOpenTimer: number;
  contactCount: number;
  pairChecks: number;
  gridBuilds: number;
  skinVertexCount: number;
  skinIndexCount: number;
  circleRenderCount: number;
  gpuUploadFloats: number;
  gpuCandidateSourceState?: RawGpuConstraintParticleState;
  gpuCandidateState?: RawGpuConstraintParticleState;
  gpuCandidateCellOffsets?: RawGpuConstraintParticleCellOffsetPass;
  gpuCandidateOccupancy?: RawGpuConstraintParticleCellOccupancyPass;
  gpuCandidateCellRanges?: RawGpuConstraintParticleCellRangeFromOffsetsPass;
  gpuCandidateCellKeys?: RawGpuConstraintParticleCellKeyPass;
  gpuCandidateKeySort?: RawGpuKeyIndexSortPass;
  gpuCandidateSortedKeyGather?: RawGpuConstraintParticleSortedKeyGatherPass;
  gpuCandidateSortedKeyRanges?: RawGpuConstraintParticleSortedKeyRangePass;
  gpuCandidateCollision?: RawGpuConstraintParticleCircleCollisionPass;
  gpuCandidateViscosity?: RawGpuConstraintParticleViscosityPass;
  gpuCandidatePressure?: RawGpuConstraintParticlePressurePass;
  gpuCandidateBodyMetadataBridge?: RawGpuConstraintParticleBodyMetadataBridge;
  gpuCandidateBodyShape?: RawGpuConstraintParticleBodyShapePass;
  gpuCandidateGridKey?: RawGpuConstraintParticleGridKeyPass;
  gpuCandidateSlots?: RawGpuConstraintParticleSortedCellCandidatePass;
  gpuCandidateNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuCandidateResidentList?: RawGpuConstraintParticleResidentListFromSortedKeysPass;
  gpuResidentListCandidateSlots?: RawGpuConstraintParticleResidentListCandidatePass;
  gpuResidentListCandidateNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuCandidateCellRangeBridge?: RawGpuConstraintParticleCellRangeBridge;
  gpuCandidateIndexMapBridge?: RawGpuConstraintParticleIndexMapBridge;
  gpuCandidateIndexMapGather?: RawGpuConstraintParticleIndexMapGatherPass;
  gpuCandidateIndexMapGatherState?: RawGpuConstraintParticleState;
  gpuCandidatePositions?: Float32Array;
  gpuCandidateVelocities?: Float32Array;
  gpuCandidateAttributes?: Float32Array;
  gpuCandidateKeys?: Float32Array;
  gpuCandidateSortedKeys?: Float32Array;
  gpuCandidateOrder?: Uint32Array;
  gpuCandidateGridKeyStats?: RawGpuConstraintParticleGridKeyStats;
  gpuCandidateSlotStats?: RawGpuConstraintParticleSortedCellCandidateStats;
  gpuCandidateResidentListStats?: RawGpuConstraintParticleResidentListFromSortedKeysStats;
  gpuResidentListCandidateStats?: RawGpuConstraintParticleResidentListCandidateStats;
  gpuCandidateUploadFloats: number;
  gpuCandidateUploadMode?: 'none' | 'cpu-sorted-copy' | 'gpu-sorted-key-gather';
  gpuCandidateCellRangeUploadFloats: number;
  gpuCandidateOccupancyStats?: RawGpuConstraintParticleCellOccupancyStats;
  gpuCandidateCellOffsetStats?: RawGpuConstraintParticleCellOffsetStats;
  gpuCandidateCellRangeStats?: RawGpuConstraintParticleCellRangeFromOffsetsStats;
  gpuCandidateCellKeyStats?: RawGpuConstraintParticleCellKeyStats;
  gpuCandidateKeySortStats?: RawGpuKeyIndexSortStats;
  gpuCandidateSortedKeyGatherStats?: RawGpuConstraintParticleSortedKeyGatherStats;
  gpuCandidateSortedKeyRangeStats?: RawGpuConstraintParticleSortedKeyRangeStats;
  gpuCandidateIndexMapUploadFloats: number;
  gpuCandidateBodyMetadataUploadFloats: number;
  gpuCandidateIndexMapGatherFragmentTexels: number;
  gpuCandidateIndexMapGatherActive: boolean;
  gpuCandidateCollisionBatches: number;
  gpuCandidateCollisionFragmentTexels: number;
  gpuCandidateCollisionConsumedSlots: number;
  gpuCandidateCollisionIgnoredSlots: number;
  gpuCandidateCollisionSpatiallyComplete: boolean;
  gpuCandidateCollisionStressActive: boolean;
  gpuCandidateViscosityBatches: number;
  gpuCandidateViscosityFragmentTexels: number;
  gpuCandidateViscosityConsumedSlots: number;
  gpuCandidateViscosityIgnoredSlots: number;
  gpuCandidateViscosityStressActive: boolean;
  gpuCandidatePressureBatches: number;
  gpuCandidatePressureFragmentTexels: number;
  gpuCandidatePressureConsumedSlots: number;
  gpuCandidatePressureIgnoredSlots: number;
  gpuCandidatePressureStressActive: boolean;
  gpuCandidateStressSource: SoftBlobGpuCandidateStressSource;
  gpuCandidateResidentListStressReady: boolean;
  gpuCandidateBodyShapeFragmentTexels: number;
  gpuCandidateBodyShapeStressActive: boolean;
  gpuCandidateMaxCellOccupancy: number;
  gpuCandidateCellSize: number;
  gpuCandidateCellColumns: number;
  gpuCandidateCellRows: number;
  gpuCandidateTelemetryLastSeconds: number;
  gpuCandidateTelemetryFrame: number;
  gpuCandidateTelemetrySampled: boolean;
  gpuCandidateTelemetryStaleSeconds: number;
  gpuCandidateLastParticleCount: number;
  densityWidth: number;
  densityHeight: number;
  densityTexture: WebGLTexture;
  densityFramebuffer: WebGLFramebuffer;
  uDensityResolution: WebGLUniformLocation | null;
  uDensityFieldScale: WebGLUniformLocation | null;
  uDensityCompositeTexture: WebGLUniformLocation | null;
  uDensityCompositeResolution: WebGLUniformLocation | null;
  uDensityCompositePalette0: WebGLUniformLocation | null;
  uDensityCompositePalette1: WebGLUniformLocation | null;
  uDensityCompositeThreshold: WebGLUniformLocation | null;
  gridCellSize: number;
  gridWidth: number;
  gridHeight: number;
  gridHeads: Int32Array;
  gridNext: Int32Array;
  x: Float32Array;
  y: Float32Array;
  oldX: Float32Array;
  oldY: Float32Array;
  radius: Float32Array;
  bodyOf: Int16Array;
  boundaryIndex: Int16Array;
  fixed: Uint8Array;
  bodyBase: Int32Array;
  bodyBoundaryCount: Int16Array;
  bodyInteriorCount: Int16Array;
  bodyParticleCount: Int16Array;
  bodySize: Float32Array;
  bodyRestArea: Float32Array;
  bodyAge: Float32Array;
  bodySeed: Float32Array;
  bodyColorIndex: Float32Array;
  bodyCenterX: Float32Array;
  bodyCenterY: Float32Array;
  bodyExtent: Float32Array;
  edgeRest: Float32Array;
  edgeBase: Float32Array;
  bendRest: Float32Array;
  bendBase: Float32Array;
  skinVertices: Float32Array;
  skinIndices: Uint32Array;
  circleInstances: Float32Array;
  paletteData: Float32Array;
  backgroundData: Float32Array;
  areaGradientX: Float32Array;
  areaGradientY: Float32Array;
  contourX: Float32Array;
  contourY: Float32Array;
  localBoundaryX: Float32Array;
  localBoundaryY: Float32Array;
  localInteriorX: Float32Array;
  localInteriorY: Float32Array;
}

const BOUNDARY_COUNT = 128;
const INTERIOR_COUNT = 129;
const PARTICLES_PER_BODY = BOUNDARY_COUNT + INTERIOR_COUNT;
const SKIN_SUBDIVISIONS = 4;
const CONTOUR_COUNT = BOUNDARY_COUNT * SKIN_SUBDIVISIONS;
const SKIN_FLOATS = 5;
const SKIN_VERTICES_PER_BODY = 1 + CONTOUR_COUNT * 2;
const SKIN_INDICES_PER_BODY = CONTOUR_COUNT * 9;
const MAX_BODIES = 160;
const MAX_PARTICLES = MAX_BODIES * PARTICLES_PER_BODY;
const MAX_SKIN_VERTICES = MAX_BODIES * SKIN_VERTICES_PER_BODY;
const MAX_SKIN_INDICES = MAX_BODIES * SKIN_INDICES_PER_BODY;
const SOFT_BLOB_METABALL_BOUNDARY_RADIUS_SCALE = 0.74;
const SOFT_BLOB_METABALL_INTERIOR_RADIUS_SCALE = 1.18;
const SOFT_BLOB_METABALL_FIELD_SCALE = 2.22;
const SOFT_BLOB_METABALL_THRESHOLD = 0.064;
const TWO_PI = Math.PI * 2;
const EPSILON = 0.000001;
const CIRCLE_QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);

const MARKUP = `
  <div class="relative h-full w-full overflow-hidden bg-slate-950">
    <canvas data-soft-body-blob-canvas class="absolute inset-0 h-full w-full touch-none"></canvas>
    <canvas data-soft-body-blob-overlay class="pointer-events-none absolute inset-0 h-full w-full"></canvas>
  </div>
`;

const SKIN_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in float a_alpha;
in float a_mix;
in float a_edge;
uniform vec2 u_resolution;
out float v_alpha;
out float v_mix;
out float v_edge;
void main() {
  vec2 clip = a_position / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_alpha = a_alpha;
  v_mix = a_mix;
  v_edge = a_edge;
}`;

const SKIN_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec3 u_palette0;
uniform vec3 u_palette1;
uniform vec3 u_palette2;
uniform vec3 u_palette3;
in float v_alpha;
in float v_mix;
in float v_edge;
out vec4 outColor;
vec3 paletteColor(float indexValue) {
  int index = int(floor(indexValue + 0.5));
  if (index == 4) return vec3(0.58, 0.58, 0.58);
  if (index == 1) return u_palette1;
  if (index == 2) return u_palette2;
  if (index == 3) return u_palette3;
  return u_palette0;
}
void main() {
  vec3 core = paletteColor(v_mix);
  float rim = smoothstep(0.0, 1.0, v_edge);
  float bodyShade = mix(0.42, 1.28, rim);
  float softSpecular = pow(max(0.0, rim), 2.15) * 0.18;
  vec3 color = core * bodyShade + core * softSpecular;
  outColor = vec4(color, v_alpha);
}`;

const CIRCLE_VERTEX_SHADER = `#version 300 es
in vec2 a_quad;
in vec4 a_instance;
uniform vec2 u_resolution;
out vec2 v_uv;
out float v_kind;
void main() {
  vec2 position = a_instance.xy + a_quad * a_instance.z;
  vec2 clip = position / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_quad;
  v_kind = a_instance.w;
}`;

const CIRCLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec3 u_palette0;
uniform vec3 u_palette1;
uniform vec3 u_palette2;
uniform vec3 u_palette3;
in vec2 v_uv;
in float v_kind;
out vec4 outColor;
vec3 paletteColor(float indexValue) {
  int index = int(floor(indexValue + 0.5));
  if (index == 4) return vec3(0.58, 0.58, 0.58);
  if (index == 1) return u_palette1;
  if (index == 2) return u_palette2;
  if (index == 3) return u_palette3;
  return u_palette0;
}
void main() {
  float d = dot(v_uv, v_uv);
  if (d > 1.0) discard;
  float alpha = smoothstep(1.0, 0.72, d);
  vec3 color = paletteColor(v_kind);
  outColor = vec4(color, alpha * 0.76);
}`;

const DENSITY_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_quad;
layout(location = 1) in vec4 a_instance;
uniform vec2 u_resolution;
uniform float u_fieldScale;
out vec2 v_uv;
out float v_enabled;
void main() {
  float radius = max(0.0, a_instance.z * u_fieldScale);
  vec2 position = a_instance.xy + a_quad * radius;
  vec2 clip = position / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_quad;
  v_enabled = radius > 0.001 ? 1.0 : 0.0;
}`;

const DENSITY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
in float v_enabled;
out vec4 outColor;
void main() {
  if (v_enabled <= 0.0) discard;
  float d2 = dot(v_uv, v_uv);
  if (d2 > 1.0) discard;
  float density = exp(-d2 * 3.05) * (1.0 - smoothstep(0.8, 1.0, d2));
  outColor = vec4(density, density, density, density);
}`;

const DENSITY_COMPOSITE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_clip;
out vec2 v_uv;
void main() {
  v_uv = a_clip * 0.5 + 0.5;
  gl_Position = vec4(a_clip, 0.0, 1.0);
}`;

const DENSITY_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_density;
uniform vec2 u_resolution;
uniform vec3 u_palette0;
uniform vec3 u_palette1;
uniform float u_threshold;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec2 px = 1.0 / max(u_resolution, vec2(1.0));
  float center = texture(u_density, v_uv).r;
  float left = texture(u_density, v_uv - vec2(px.x, 0.0)).r;
  float right = texture(u_density, v_uv + vec2(px.x, 0.0)).r;
  float up = texture(u_density, v_uv + vec2(0.0, px.y)).r;
  float down = texture(u_density, v_uv - vec2(0.0, px.y)).r;
  float d = center * 0.48 + (left + right + up + down) * 0.115;
  d += (
    texture(u_density, v_uv + px * vec2(-1.0, -1.0)).r +
    texture(u_density, v_uv + px * vec2(1.0, -1.0)).r +
    texture(u_density, v_uv + px * vec2(-1.0, 1.0)).r +
    texture(u_density, v_uv + px * vec2(1.0, 1.0)).r
  ) * 0.025;
  float alpha = smoothstep(u_threshold, u_threshold + 0.05, d);
  if (alpha <= 0.001) discard;
  vec2 gradient = vec2(right - left, up - down);
  vec3 normal = normalize(vec3(-gradient * 5.5, 0.78));
  float light = clamp(dot(normal, normalize(vec3(-0.42, -0.58, 1.0))) * 0.5 + 0.5, 0.0, 1.0);
  float rim = smoothstep(u_threshold, u_threshold + 0.025, d) * (1.0 - smoothstep(u_threshold + 0.08, u_threshold + 0.18, d));
  vec3 color = mix(u_palette1, u_palette0, 0.42 + light * 0.46);
  color = color * mix(0.74, 1.2, light) + rim * vec3(0.16, 0.22, 0.28);
  outColor = vec4(color, alpha);
}`;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return Math.sqrt(dx * dx + dy * dy);
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function hash01(seed: number): number {
  const value = Math.sin(seed * 127.17 + 91.31) * 43758.5453123;
  return value - Math.floor(value);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate soft-body shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? 'unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(`Soft-body shader compile failed: ${info}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to allocate soft-body program.');
  const vertexShader = compile(gl, gl.VERTEX_SHADER, vertex);
  const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? 'unknown shader link error';
    gl.deleteProgram(program);
    throw new Error(`Soft-body shader link failed: ${info}`);
  }
  return program;
}

function makeBodyBlueprint(): Pick<SoftBlobWorld, 'localBoundaryX' | 'localBoundaryY' | 'localInteriorX' | 'localInteriorY'> {
  const localBoundaryX = new Float32Array(BOUNDARY_COUNT);
  const localBoundaryY = new Float32Array(BOUNDARY_COUNT);
  const localInteriorX = new Float32Array(INTERIOR_COUNT);
  const localInteriorY = new Float32Array(INTERIOR_COUNT);

  for (let index = 0; index < BOUNDARY_COUNT; index += 1) {
    const angle = (index / BOUNDARY_COUNT) * TWO_PI;
    localBoundaryX[index] = Math.cos(angle);
    localBoundaryY[index] = Math.sin(angle);
  }

  let cursor = 0;
  localInteriorX[cursor] = 0;
  localInteriorY[cursor] = 0;
  cursor += 1;
  const rings = [
    { count: 8, radius: 0.29, offset: 0.18 },
    { count: 12, radius: 0.52, offset: 0.06 },
    { count: 16, radius: 0.73, offset: 0.12 },
  ];
  for (const ring of rings) {
    for (let index = 0; index < ring.count && cursor < INTERIOR_COUNT; index += 1) {
      const angle = (index / ring.count + ring.offset) * TWO_PI;
      localInteriorX[cursor] = Math.cos(angle) * ring.radius;
      localInteriorY[cursor] = Math.sin(angle) * ring.radius;
      cursor += 1;
    }
  }

  return { localBoundaryX, localBoundaryY, localInteriorX, localInteriorY };
}

function createWorld(state: RawWebGL2RenderState, preview: boolean): SoftBlobWorld {
  const gl = state.gl;
  const programs = {
    skin: link(gl, SKIN_VERTEX_SHADER, SKIN_FRAGMENT_SHADER),
    circle: link(gl, CIRCLE_VERTEX_SHADER, CIRCLE_FRAGMENT_SHADER),
    density: link(gl, DENSITY_VERTEX_SHADER, DENSITY_FRAGMENT_SHADER),
    densityComposite: link(gl, DENSITY_COMPOSITE_VERTEX_SHADER, DENSITY_COMPOSITE_FRAGMENT_SHADER),
  };
  const uniforms: SoftBlobUniforms = {
    skin: {
      resolution: gl.getUniformLocation(programs.skin, 'u_resolution'),
      palette: [
        gl.getUniformLocation(programs.skin, 'u_palette0'),
        gl.getUniformLocation(programs.skin, 'u_palette1'),
        gl.getUniformLocation(programs.skin, 'u_palette2'),
        gl.getUniformLocation(programs.skin, 'u_palette3'),
      ],
    },
    circle: {
      resolution: gl.getUniformLocation(programs.circle, 'u_resolution'),
      palette: [
        gl.getUniformLocation(programs.circle, 'u_palette0'),
        gl.getUniformLocation(programs.circle, 'u_palette1'),
        gl.getUniformLocation(programs.circle, 'u_palette2'),
        gl.getUniformLocation(programs.circle, 'u_palette3'),
      ],
    },
  };
  const skinVao = gl.createVertexArray();
  const skinVbo = gl.createBuffer();
  const skinIbo = gl.createBuffer();
  const circleVao = gl.createVertexArray();
  const densityVao = gl.createVertexArray();
  const compositeVao = gl.createVertexArray();
  const quadVbo = gl.createBuffer();
  const circleVbo = gl.createBuffer();
  const compositeVbo = gl.createBuffer();
  const densityTexture = gl.createTexture();
  const densityFramebuffer = gl.createFramebuffer();

  if (!skinVao || !skinVbo || !skinIbo || !circleVao || !densityVao || !compositeVao || !quadVbo || !circleVbo || !compositeVbo || !densityTexture || !densityFramebuffer) {
    throw new Error('Unable to allocate soft-body WebGL buffers.');
  }

  const blueprint = makeBodyBlueprint();
  const skinVertices = new Float32Array(MAX_SKIN_VERTICES * SKIN_FLOATS);
  const skinIndices = new Uint32Array(MAX_SKIN_INDICES);
  const circleInstances = new Float32Array(MAX_PARTICLES * 4);
  const world: SoftBlobWorld = {
    preview,
    programs,
    uniforms,
    buffers: { skinVao, skinVbo, skinIbo, circleVao, densityVao, compositeVao, quadVbo, circleVbo, compositeVbo },
    cleanup: [],
    pointer: {
      id: null,
      x: 0,
      y: 0,
      lastX: 0,
      lastY: 0,
      down: false,
      drawing: false,
      dragging: false,
      building: false,
      spawnAccumulator: 0,
      drawPoints: [],
      grabbedBodies: [],
    },
    overlay: state.canvas.parentElement?.querySelector<HTMLCanvasElement>('[data-soft-body-blob-overlay]') ?? null,
    overlayContext: null,
    bodyCount: 0,
    particleCount: 0,
    resetFloorTimer: 0,
    demoSpawnTimer: 0,
    floorOpenTimer: 0,
    contactCount: 0,
    pairChecks: 0,
    gridBuilds: 0,
    skinVertexCount: 0,
    skinIndexCount: 0,
    circleRenderCount: 0,
    gpuUploadFloats: 0,
    gpuCandidateUploadFloats: 0,
    gpuCandidateUploadMode: 'none',
    gpuCandidateCellRangeUploadFloats: 0,
    gpuCandidateIndexMapUploadFloats: 0,
    gpuCandidateBodyMetadataUploadFloats: 0,
    gpuCandidateIndexMapGatherFragmentTexels: 0,
    gpuCandidateIndexMapGatherActive: false,
    gpuCandidateCollisionBatches: 0,
    gpuCandidateCollisionFragmentTexels: 0,
    gpuCandidateCollisionConsumedSlots: 0,
    gpuCandidateCollisionIgnoredSlots: 0,
    gpuCandidateCollisionSpatiallyComplete: false,
    gpuCandidateCollisionStressActive: false,
    gpuCandidateViscosityBatches: 0,
    gpuCandidateViscosityFragmentTexels: 0,
    gpuCandidateViscosityConsumedSlots: 0,
    gpuCandidateViscosityIgnoredSlots: 0,
    gpuCandidateViscosityStressActive: false,
    gpuCandidatePressureBatches: 0,
    gpuCandidatePressureFragmentTexels: 0,
    gpuCandidatePressureConsumedSlots: 0,
    gpuCandidatePressureIgnoredSlots: 0,
    gpuCandidatePressureStressActive: false,
    gpuCandidateStressSource: 'gpu-sorted-cell-ranges',
    gpuCandidateResidentListStressReady: false,
    gpuCandidateBodyShapeFragmentTexels: 0,
    gpuCandidateBodyShapeStressActive: false,
    gpuCandidateMaxCellOccupancy: 0,
    gpuCandidateCellSize: 0,
    gpuCandidateCellColumns: 0,
    gpuCandidateCellRows: 0,
    gpuCandidateTelemetryLastSeconds: -Infinity,
    gpuCandidateTelemetryFrame: 0,
    gpuCandidateTelemetrySampled: false,
    gpuCandidateTelemetryStaleSeconds: 0,
    gpuCandidateLastParticleCount: 0,
    densityWidth: 0,
    densityHeight: 0,
    densityTexture,
    densityFramebuffer,
    uDensityResolution: gl.getUniformLocation(programs.density, 'u_resolution'),
    uDensityFieldScale: gl.getUniformLocation(programs.density, 'u_fieldScale'),
    uDensityCompositeTexture: gl.getUniformLocation(programs.densityComposite, 'u_density'),
    uDensityCompositeResolution: gl.getUniformLocation(programs.densityComposite, 'u_resolution'),
    uDensityCompositePalette0: gl.getUniformLocation(programs.densityComposite, 'u_palette0'),
    uDensityCompositePalette1: gl.getUniformLocation(programs.densityComposite, 'u_palette1'),
    uDensityCompositeThreshold: gl.getUniformLocation(programs.densityComposite, 'u_threshold'),
    gridCellSize: 24,
    gridWidth: 1,
    gridHeight: 1,
    gridHeads: new Int32Array(1),
    gridNext: new Int32Array(MAX_PARTICLES),
    x: new Float32Array(MAX_PARTICLES),
    y: new Float32Array(MAX_PARTICLES),
    oldX: new Float32Array(MAX_PARTICLES),
    oldY: new Float32Array(MAX_PARTICLES),
    radius: new Float32Array(MAX_PARTICLES),
    bodyOf: new Int16Array(MAX_PARTICLES),
    boundaryIndex: new Int16Array(MAX_PARTICLES),
    fixed: new Uint8Array(MAX_PARTICLES),
    bodyBase: new Int32Array(MAX_BODIES),
    bodyBoundaryCount: new Int16Array(MAX_BODIES),
    bodyInteriorCount: new Int16Array(MAX_BODIES),
    bodyParticleCount: new Int16Array(MAX_BODIES),
    bodySize: new Float32Array(MAX_BODIES),
    bodyRestArea: new Float32Array(MAX_BODIES),
    bodyAge: new Float32Array(MAX_BODIES),
    bodySeed: new Float32Array(MAX_BODIES),
    bodyColorIndex: new Float32Array(MAX_BODIES),
    bodyCenterX: new Float32Array(MAX_BODIES),
    bodyCenterY: new Float32Array(MAX_BODIES),
    bodyExtent: new Float32Array(MAX_BODIES),
    edgeRest: new Float32Array(MAX_BODIES * BOUNDARY_COUNT),
    edgeBase: new Float32Array(MAX_BODIES * BOUNDARY_COUNT),
    bendRest: new Float32Array(MAX_BODIES * BOUNDARY_COUNT),
    bendBase: new Float32Array(MAX_BODIES * BOUNDARY_COUNT),
    skinVertices,
    skinIndices,
    circleInstances,
    paletteData: new Float32Array(12),
    backgroundData: new Float32Array(3),
    areaGradientX: new Float32Array(BOUNDARY_COUNT),
    areaGradientY: new Float32Array(BOUNDARY_COUNT),
    contourX: new Float32Array(CONTOUR_COUNT),
    contourY: new Float32Array(CONTOUR_COUNT),
    ...blueprint,
  };

  world.overlayContext = world.overlay?.getContext('2d') ?? null;
  setupBuffers(state, world);
  attachPointerHandlers(state, world);
  return world;
}

function setupBuffers(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const gl = state.gl;
  const { skinVao, skinVbo, skinIbo, circleVao, densityVao, compositeVao, quadVbo, circleVbo, compositeVbo } = world.buffers;

  gl.bindVertexArray(skinVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, skinVbo);
  gl.bufferData(gl.ARRAY_BUFFER, world.skinVertices.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skinIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, world.skinIndices.byteLength, gl.DYNAMIC_DRAW);
  let location = gl.getAttribLocation(world.programs.skin, 'a_position');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, SKIN_FLOATS * 4, 0);
  location = gl.getAttribLocation(world.programs.skin, 'a_alpha');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 1, gl.FLOAT, false, SKIN_FLOATS * 4, 2 * 4);
  location = gl.getAttribLocation(world.programs.skin, 'a_mix');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 1, gl.FLOAT, false, SKIN_FLOATS * 4, 3 * 4);
  location = gl.getAttribLocation(world.programs.skin, 'a_edge');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 1, gl.FLOAT, false, SKIN_FLOATS * 4, 4 * 4);
  gl.bindVertexArray(null);

  gl.bindVertexArray(circleVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  gl.bufferData(gl.ARRAY_BUFFER, CIRCLE_QUAD, gl.STATIC_DRAW);
  location = gl.getAttribLocation(world.programs.circle, 'a_quad');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, circleVbo);
  gl.bufferData(gl.ARRAY_BUFFER, world.circleInstances.byteLength, gl.DYNAMIC_DRAW);
  location = gl.getAttribLocation(world.programs.circle, 'a_instance');
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(location, 1);
  gl.bindVertexArray(null);

  gl.bindVertexArray(densityVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, circleVbo);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.bindVertexArray(null);

  gl.bindVertexArray(compositeVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, compositeVbo);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
}

function cssPointToWorld(state: RawWebGL2RenderState, event: PointerEvent): { x: number; y: number } {
  const rect = state.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * state.width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * state.height,
  };
}

function attachPointerHandlers(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const canvas = state.canvas;
  const onPointerDown = (event: PointerEvent) => {
    const point = cssPointToWorld(state, event);
    world.pointer.id = event.pointerId;
    world.pointer.x = point.x;
    world.pointer.y = point.y;
    world.pointer.lastX = point.x;
    world.pointer.lastY = point.y;
    world.pointer.down = true;
    world.pointer.dragging = state.mode === 'interact';
    world.pointer.drawing = state.mode === 'draw';
    world.pointer.building = state.mode === 'build';
    world.pointer.spawnAccumulator = 0;
    world.pointer.drawPoints = world.pointer.drawing || world.pointer.building ? [point] : [];
    world.pointer.grabbedBodies = world.pointer.dragging ? pickInteractionBodies(state, world, point.x, point.y) : [];
    canvas.setPointerCapture(event.pointerId);
    if (!world.pointer.drawing && !world.pointer.dragging && !world.pointer.building) spawnAtPointer(state, world, point.x, point.y);
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent) => {
    if (world.pointer.id !== event.pointerId) return;
    const point = cssPointToWorld(state, event);
    world.pointer.lastX = world.pointer.x;
    world.pointer.lastY = world.pointer.y;
    world.pointer.x = point.x;
    world.pointer.y = point.y;
    if (world.pointer.drawing || world.pointer.building) {
      const last = world.pointer.drawPoints[world.pointer.drawPoints.length - 1];
      if (!last || distance(last.x, last.y, point.x, point.y) > 5) world.pointer.drawPoints.push(point);
    }
  };
  const onPointerUp = (event: PointerEvent) => {
    if (world.pointer.id !== event.pointerId) return;
    if (world.pointer.drawing) spawnDrawnBlob(state, world);
    if (world.pointer.building) spawnBuildFixture(state, world);
    world.pointer.id = null;
    world.pointer.down = false;
    world.pointer.dragging = false;
    world.pointer.drawing = false;
    world.pointer.building = false;
    world.pointer.drawPoints = [];
    world.pointer.grabbedBodies = [];
    canvas.releasePointerCapture(event.pointerId);
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (world.pointer.id !== event.pointerId) return;
    world.pointer.id = null;
    world.pointer.down = false;
    world.pointer.dragging = false;
    world.pointer.drawing = false;
    world.pointer.building = false;
    world.pointer.drawPoints = [];
    world.pointer.grabbedBodies = [];
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  world.cleanup.push(() => canvas.removeEventListener('pointerdown', onPointerDown));
  world.cleanup.push(() => canvas.removeEventListener('pointermove', onPointerMove));
  world.cleanup.push(() => canvas.removeEventListener('pointerup', onPointerUp));
  world.cleanup.push(() => canvas.removeEventListener('pointercancel', onPointerCancel));
}

function blobSize(state: RawWebGL2RenderState): number {
  return clamp(finiteNumberSetting(state.settings, 'blobSize', 42), 18, 82);
}

function nodeDensity(state: RawWebGL2RenderState): number {
  return clamp(finiteNumberSetting(state.settings, 'nodeDensity', 1), 0.35, 2.5);
}

function drawSmoothing(state: RawWebGL2RenderState): number {
  return clamp(finiteNumberSetting(state.settings, 'drawSmoothing', 0.45), 0, 1);
}

function targetNodeSpacingForDensity(density: number): number {
  return nodeRadiusForDensity(density) * 1.32;
}

function nodeRadiusForDensity(density: number): number {
  const t = clamp((density - 0.35) / (2.5 - 0.35), 0, 1);
  const eased = Math.sqrt(t);
  return 22 + (8.5 - 22) * eased;
}

function boundaryCountForSize(size: number, density: number): number {
  return Math.max(12, Math.min(BOUNDARY_COUNT, Math.round((TWO_PI * size) / targetNodeSpacingForDensity(density))));
}

function boundaryCountForPerimeter(perimeter: number, density: number): number {
  return Math.max(12, Math.min(BOUNDARY_COUNT, Math.round(perimeter / targetNodeSpacingForDensity(density))));
}

function interiorCountForBoundary(boundaryCount: number): number {
  const normalized = boundaryCount / BOUNDARY_COUNT;
  return Math.max(2, Math.min(INTERIOR_COUNT, Math.round(boundaryCount * 0.32 + normalized * normalized * 42)));
}

function spawnAtPointer(state: RawWebGL2RenderState, world: SoftBlobWorld, x: number, y: number): void {
  const density = nodeDensity(state);
  const radius = blobSize(state) * (0.9 + density * 0.08) * randomRange(0.9, 1.12);
  spawnBlob(world, clamp(x, radius + 10, state.width - radius - 10), clamp(y, radius + 10, state.height - radius - 10), radius, undefined, undefined, density);
}

function spawnDrawnBlob(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const points = world.pointer.drawPoints;
  if (points.length < 5) return;
  const density = nodeDensity(state);
  const optimizedPoints = optimizeDrawnShape(points, drawSmoothing(state));
  const boundaryCount = boundaryCountForPerimeter(closedPolylineLength(optimizedPoints), density);
  const outline = resampleClosedOutline(optimizedPoints, boundaryCount);
  if (outline.length !== boundaryCount) return;
  if (signedPolygonArea(outline) < 0) outline.reverse();
  let centerX = 0;
  let centerY = 0;
  for (const point of outline) {
    centerX += point.x;
    centerY += point.y;
  }
  centerX /= outline.length;
  centerY /= outline.length;
  let averageRadius = 0;
  for (const point of outline) averageRadius += distance(centerX, centerY, point.x, point.y);
  averageRadius = clamp(averageRadius / outline.length, 18, 86);
  const area = Math.max(Math.abs(signedPolygonArea(outline)), Math.PI * averageRadius * averageRadius * 0.35);
  const clampedCenterX = clamp(centerX, averageRadius + 10, state.width - averageRadius - 10);
  const clampedCenterY = clamp(centerY, averageRadius + 10, state.height - averageRadius - 10);
  const offsetX = clampedCenterX - centerX;
  const offsetY = clampedCenterY - centerY;
  for (const point of outline) {
    point.x += offsetX;
    point.y += offsetY;
  }
  spawnBlob(world, clampedCenterX, clampedCenterY, averageRadius, outline, area, density);
}

function spawnBuildFixture(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const points = world.pointer.drawPoints;
  if (points.length === 0) return;
  const density = nodeDensity(state);
  const radius = nodeRadiusForDensity(density);
  const start = points[0];
  const end = points[points.length - 1];
  if (points.length < 3 || distance(start.x, start.y, end.x, end.y) < radius * 1.5) {
    addFixedParticle(world, start.x, start.y, radius);
    return;
  }
  const samples = sampleOpenPathByDistance([start, end], radius * 1.55);
  for (const sample of samples) addFixedParticle(world, sample.x, sample.y, radius);
}

function addFixedParticle(world: SoftBlobWorld, x: number, y: number, radius: number): boolean {
  if (world.particleCount >= MAX_PARTICLES) return false;
  const particle = world.particleCount;
  world.particleCount += 1;
  world.x[particle] = x;
  world.y[particle] = y;
  world.oldX[particle] = x;
  world.oldY[particle] = y;
  world.radius[particle] = radius;
  world.bodyOf[particle] = -1;
  world.boundaryIndex[particle] = -1;
  world.fixed[particle] = 1;
  return true;
}

function sampleOpenPathByDistance(points: Array<{ x: number; y: number }>, spacing: number): Array<{ x: number; y: number }> {
  if (points.length < 2) return points;
  const samples: Array<{ x: number; y: number }> = [{ x: points[0].x, y: points[0].y }];
  let distanceSinceSample = 0;
  let cursor = { x: points[0].x, y: points[0].y };
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const target = points[pointIndex];
    let dx = target.x - cursor.x;
    let dy = target.y - cursor.y;
    let segmentLength = Math.sqrt(dx * dx + dy * dy);
    while (distanceSinceSample + segmentLength >= spacing && segmentLength > 0.0001) {
      const remaining = spacing - distanceSinceSample;
      const t = remaining / segmentLength;
      cursor = { x: cursor.x + dx * t, y: cursor.y + dy * t };
      samples.push({ x: cursor.x, y: cursor.y });
      distanceSinceSample = 0;
      dx = target.x - cursor.x;
      dy = target.y - cursor.y;
      segmentLength = Math.sqrt(dx * dx + dy * dy);
    }
    distanceSinceSample += segmentLength;
    cursor = { x: target.x, y: target.y };
  }
  const last = samples[samples.length - 1];
  const final = points[points.length - 1];
  const finalDx = final.x - last.x;
  const finalDy = final.y - last.y;
  if (finalDx * finalDx + finalDy * finalDy > spacing * spacing * 0.2025) samples.push({ x: final.x, y: final.y });
  return samples;
}

function optimizeDrawnShape(points: Array<{ x: number; y: number }>, smoothing: number): Array<{ x: number; y: number }> {
  const minSpacing = 3 + smoothing * 8;
  const cleaned: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (!previous || distance(previous.x, previous.y, point.x, point.y) >= minSpacing) cleaned.push({ x: point.x, y: point.y });
  }
  if (cleaned.length < 5) return cleaned;
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (distance(first.x, first.y, last.x, last.y) < minSpacing) cleaned.pop();

  let smoothed = cleaned;
  const passes = Math.round(smoothing * 4);
  const cut = 0.18 + smoothing * 0.14;
  for (let pass = 0; pass < passes; pass += 1) {
    const nextShape: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < smoothed.length; index += 1) {
      const a = smoothed[index];
      const b = smoothed[(index + 1) % smoothed.length];
      nextShape.push({
        x: a.x + (b.x - a.x) * cut,
        y: a.y + (b.y - a.y) * cut,
      });
      nextShape.push({
        x: a.x + (b.x - a.x) * (1 - cut),
        y: a.y + (b.y - a.y) * (1 - cut),
      });
    }
    smoothed = nextShape;
  }

  if (smoothing <= 0.01) return smoothed;
  const relaxation = smoothing * 0.18;
  const relaxed: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < smoothed.length; index += 1) {
    const point = smoothed[index];
    const previous = smoothed[(index + smoothed.length - 1) % smoothed.length];
    const next = smoothed[(index + 1) % smoothed.length];
    const averageX = (previous.x + point.x + next.x) / 3;
    const averageY = (previous.y + point.y + next.y) / 3;
    relaxed.push({
      x: point.x + (averageX - point.x) * relaxation,
      y: point.y + (averageY - point.y) * relaxation,
    });
  }
  return relaxed;
}

function resampleClosedOutline(points: Array<{ x: number; y: number }>, count: number): Array<{ x: number; y: number }> {
  const cleaned: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    const previous = cleaned[cleaned.length - 1];
    if (!previous || distance(previous.x, previous.y, point.x, point.y) > 3) cleaned.push({ x: point.x, y: point.y });
  }
  if (cleaned.length < 5) return [];
  const lengths: number[] = [];
  let total = 0;
  for (let index = 0; index < cleaned.length; index += 1) {
    const next = (index + 1) % cleaned.length;
    total += distance(cleaned[index].x, cleaned[index].y, cleaned[next].x, cleaned[next].y);
    lengths.push(total);
  }
  if (total < 48) return [];
  const result: Array<{ x: number; y: number }> = [];
  for (let sample = 0; sample < count; sample += 1) {
    const target = (sample / count) * total;
    let segment = 0;
    while (segment < lengths.length - 1 && lengths[segment] < target) segment += 1;
    const previousLength = segment === 0 ? 0 : lengths[segment - 1];
    const segmentLength = Math.max(0.0001, lengths[segment] - previousLength);
    const t = (target - previousLength) / segmentLength;
    const a = cleaned[segment];
    const b = cleaned[(segment + 1) % cleaned.length];
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}

function closedPolylineLength(points: Array<{ x: number; y: number }>): number {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    total += distance(points[index].x, points[index].y, points[next].x, points[next].y);
  }
  return total;
}

function signedPolygonArea(points: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    area += points[index].x * points[next].y - points[index].y * points[next].x;
  }
  return area * 0.5;
}

function spawnBlob(world: SoftBlobWorld, centerX: number, centerY: number, size: number, outline?: Array<{ x: number; y: number }>, restArea?: number, density = 1): boolean {
  const boundaryCount = outline?.length ?? boundaryCountForSize(size, density);
  const interiorCount = interiorCountForBoundary(boundaryCount);
  const particleTotal = boundaryCount + interiorCount;
  if (world.bodyCount >= MAX_BODIES || world.particleCount + particleTotal > MAX_PARTICLES) return false;
  const body = world.bodyCount;
  const base = world.particleCount;
  const rotation = randomRange(0, TWO_PI);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const jitter = size * 0.025;
  const particleRadius = nodeRadiusForDensity(density);

  world.bodyCount += 1;
  world.particleCount += particleTotal;
  world.bodyBase[body] = base;
  world.bodyBoundaryCount[body] = boundaryCount;
  world.bodyInteriorCount[body] = interiorCount;
  world.bodyParticleCount[body] = particleTotal;
  world.bodySize[body] = size;
  world.bodyRestArea[body] = restArea ?? Math.PI * size * size;
  world.bodyAge[body] = 0;
  world.bodySeed[body] = hash01(body * 17.13 + size);
  world.bodyColorIndex[body] = body % 4;
  world.bodyCenterX[body] = centerX;
  world.bodyCenterY[body] = centerY;
  world.bodyExtent[body] = size;

  for (let index = 0; index < boundaryCount; index += 1) {
    const particle = base + index;
    let px = centerX;
    let py = centerY;
    if (outline && outline.length >= 5) {
      const sample = outline[Math.floor((index / boundaryCount) * outline.length) % outline.length];
      px = sample.x;
      py = sample.y;
    } else {
      const angle = (index / boundaryCount) * TWO_PI;
      const lx = Math.cos(angle) * size;
      const ly = Math.sin(angle) * size;
      px = centerX + lx * cos - ly * sin + randomRange(-jitter, jitter);
      py = centerY + lx * sin + ly * cos + randomRange(-jitter, jitter);
    }
    world.x[particle] = px;
    world.y[particle] = py;
    world.oldX[particle] = px;
    world.oldY[particle] = py;
    world.radius[particle] = particleRadius;
    world.bodyOf[particle] = body;
    world.boundaryIndex[particle] = index;
    world.fixed[particle] = 0;
  }

  for (let index = 0; index < interiorCount; index += 1) {
    const particle = base + boundaryCount + index;
    const normalized = (index + 0.5) / interiorCount;
    const angle = index * 2.399963229728653 + rotation * 0.37;
    const radial = Math.sqrt(normalized) * 0.74;
    const lx = Math.cos(angle) * radial * size;
    const ly = Math.sin(angle) * radial * size;
    const px = centerX + lx * cos - ly * sin + randomRange(-jitter, jitter);
    const py = centerY + lx * sin + ly * cos + randomRange(-jitter, jitter);
    world.x[particle] = px;
    world.y[particle] = py;
    world.oldX[particle] = px;
    world.oldY[particle] = py;
    world.radius[particle] = particleRadius;
    world.bodyOf[particle] = body;
    world.boundaryIndex[particle] = -1;
    world.fixed[particle] = 0;
  }

  const fallbackEdge = 2 * size * Math.sin(Math.PI / boundaryCount);
  const fallbackBend = 2 * size * Math.sin((2 * Math.PI) / boundaryCount);
  for (let index = 0; index < boundaryCount; index += 1) {
    const constraint = body * BOUNDARY_COUNT + index;
    const edge = outline
      ? distance(world.x[base + index], world.y[base + index], world.x[base + ((index + 1) % boundaryCount)], world.y[base + ((index + 1) % boundaryCount)])
      : fallbackEdge;
    const bend = outline
      ? distance(world.x[base + index], world.y[base + index], world.x[base + ((index + 2) % boundaryCount)], world.y[base + ((index + 2) % boundaryCount)])
      : fallbackBend;
    world.edgeRest[constraint] = edge;
    world.edgeBase[constraint] = edge;
    world.bendRest[constraint] = bend;
    world.bendBase[constraint] = bend;
  }
  return true;
}

function clearWorld(world: SoftBlobWorld): void {
  world.bodyCount = 0;
  world.particleCount = 0;
  world.pointer.spawnAccumulator = 0;
  world.demoSpawnTimer = 0;
  world.resetFloorTimer = 0;
  world.floorOpenTimer = 0;
}

function settingsNumber(state: RawWebGL2RenderState, key: string, fallback: number, min: number, max: number): number {
  return clamp(finiteNumberSetting(state.settings, key, fallback), min, max);
}

function boundsBottom(state: RawWebGL2RenderState, world: SoftBlobWorld): number {
  return world.floorOpenTimer > 0 ? state.height + 420 : state.height;
}

function updateGridShape(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  let largestRadius = 4;
  for (let particle = 0; particle < world.particleCount; particle += 1) largestRadius = Math.max(largestRadius, world.radius[particle]);
  world.gridCellSize = Math.max(18, largestRadius * 6.25);
  world.gridWidth = Math.ceil(state.width / world.gridCellSize) + 2;
  world.gridHeight = Math.ceil(state.height / world.gridCellSize) + 5;
  const required = world.gridWidth * world.gridHeight;
  if (world.gridHeads.length !== required) world.gridHeads = new Int32Array(required);
}

function buildGrid(world: SoftBlobWorld): void {
  world.gridBuilds += 1;
  world.gridHeads.fill(-1);
  for (let particle = 0; particle < world.particleCount; particle += 1) {
    const gx = clamp(Math.floor(world.x[particle] / world.gridCellSize), 0, world.gridWidth - 1);
    const gy = clamp(Math.floor(world.y[particle] / world.gridCellSize), 0, world.gridHeight - 1);
    const head = gy * world.gridWidth + gx;
    world.gridNext[particle] = world.gridHeads[head];
    world.gridHeads[head] = particle;
  }
}

function destroyGpuCandidateBridge(world: SoftBlobWorld): void {
  world.gpuCandidateCellRangeBridge?.destroy();
  world.gpuCandidateOccupancy?.destroy();
  world.gpuCandidateCellOffsets?.destroy();
  world.gpuCandidateCellRanges?.destroy();
  world.gpuCandidateCellKeys?.destroy();
  world.gpuCandidateKeySort?.destroy();
  world.gpuCandidateSortedKeyGather?.destroy();
  world.gpuCandidateSortedKeyRanges?.destroy();
  world.gpuCandidateCollision?.destroy();
  world.gpuCandidateViscosity?.destroy();
  world.gpuCandidatePressure?.destroy();
  world.gpuCandidateBodyMetadataBridge?.destroy();
  world.gpuCandidateBodyShape?.destroy();
  world.gpuCandidateIndexMapBridge?.destroy();
  world.gpuCandidateIndexMapGather?.destroy();
  world.gpuCandidateIndexMapGatherState?.destroy();
  world.gpuCandidateNeighbors?.destroy();
  world.gpuCandidateSlots?.destroy();
  world.gpuResidentListCandidateNeighbors?.destroy();
  world.gpuResidentListCandidateSlots?.destroy();
  world.gpuCandidateResidentList?.destroy();
  world.gpuCandidateGridKey?.destroy();
  world.gpuCandidateSourceState?.destroy();
  world.gpuCandidateState?.destroy();
  world.gpuCandidateCellRangeBridge = undefined;
  world.gpuCandidateOccupancy = undefined;
  world.gpuCandidateCellOffsets = undefined;
  world.gpuCandidateCellRanges = undefined;
  world.gpuCandidateCellKeys = undefined;
  world.gpuCandidateKeySort = undefined;
  world.gpuCandidateSortedKeyGather = undefined;
  world.gpuCandidateSortedKeyRanges = undefined;
  world.gpuCandidateCollision = undefined;
  world.gpuCandidateViscosity = undefined;
  world.gpuCandidatePressure = undefined;
  world.gpuCandidateBodyMetadataBridge = undefined;
  world.gpuCandidateBodyShape = undefined;
  world.gpuCandidateIndexMapBridge = undefined;
  world.gpuCandidateIndexMapGather = undefined;
  world.gpuCandidateIndexMapGatherState = undefined;
  world.gpuCandidateNeighbors = undefined;
  world.gpuCandidateSlots = undefined;
  world.gpuResidentListCandidateNeighbors = undefined;
  world.gpuResidentListCandidateSlots = undefined;
  world.gpuCandidateResidentList = undefined;
  world.gpuCandidateGridKey = undefined;
  world.gpuCandidateSourceState = undefined;
  world.gpuCandidateState = undefined;
  world.gpuCandidatePositions = undefined;
  world.gpuCandidateVelocities = undefined;
  world.gpuCandidateAttributes = undefined;
  world.gpuCandidateKeys = undefined;
  world.gpuCandidateSortedKeys = undefined;
  world.gpuCandidateOrder = undefined;
  world.gpuCandidateGridKeyStats = undefined;
  world.gpuCandidateSlotStats = undefined;
  world.gpuCandidateResidentListStats = undefined;
  world.gpuResidentListCandidateStats = undefined;
  world.gpuCandidateUploadFloats = 0;
  world.gpuCandidateUploadMode = 'none';
  world.gpuCandidateCellRangeUploadFloats = 0;
  world.gpuCandidateOccupancyStats = undefined;
  world.gpuCandidateCellOffsetStats = undefined;
  world.gpuCandidateCellRangeStats = undefined;
  world.gpuCandidateCellKeyStats = undefined;
  world.gpuCandidateKeySortStats = undefined;
  world.gpuCandidateSortedKeyGatherStats = undefined;
  world.gpuCandidateSortedKeyRangeStats = undefined;
  world.gpuCandidateIndexMapUploadFloats = 0;
  world.gpuCandidateBodyMetadataUploadFloats = 0;
  world.gpuCandidateIndexMapGatherFragmentTexels = 0;
  world.gpuCandidateIndexMapGatherActive = false;
  world.gpuCandidateCollisionBatches = 0;
  world.gpuCandidateCollisionFragmentTexels = 0;
  world.gpuCandidateCollisionConsumedSlots = 0;
  world.gpuCandidateCollisionIgnoredSlots = 0;
  world.gpuCandidateCollisionSpatiallyComplete = false;
  world.gpuCandidateCollisionStressActive = false;
  world.gpuCandidateViscosityBatches = 0;
  world.gpuCandidateViscosityFragmentTexels = 0;
  world.gpuCandidateViscosityConsumedSlots = 0;
  world.gpuCandidateViscosityIgnoredSlots = 0;
  world.gpuCandidateViscosityStressActive = false;
  world.gpuCandidatePressureBatches = 0;
  world.gpuCandidatePressureFragmentTexels = 0;
  world.gpuCandidatePressureConsumedSlots = 0;
  world.gpuCandidatePressureIgnoredSlots = 0;
  world.gpuCandidatePressureStressActive = false;
  world.gpuCandidateStressSource = 'gpu-sorted-cell-ranges';
  world.gpuCandidateResidentListStressReady = false;
  world.gpuCandidateBodyShapeFragmentTexels = 0;
  world.gpuCandidateBodyShapeStressActive = false;
  world.gpuCandidateMaxCellOccupancy = 0;
  world.gpuCandidateCellSize = 0;
  world.gpuCandidateCellColumns = 0;
  world.gpuCandidateCellRows = 0;
  world.gpuCandidateTelemetryLastSeconds = -Infinity;
  world.gpuCandidateTelemetryFrame = 0;
  world.gpuCandidateTelemetrySampled = false;
  world.gpuCandidateTelemetryStaleSeconds = 0;
  world.gpuCandidateLastParticleCount = 0;
}

function ensureGpuCandidateBridge(state: RawWebGL2RenderState, world: SoftBlobWorld): RawGpuConstraintParticleState {
  const existing = world.gpuCandidateState;
  if (
    existing &&
    existing.capacity === MAX_PARTICLES &&
    world.gpuCandidateCollision &&
    world.gpuCandidateViscosity &&
    world.gpuCandidatePressure &&
    world.gpuCandidateBodyMetadataBridge &&
    world.gpuCandidateBodyShape &&
    world.gpuCandidateGridKey &&
    world.gpuCandidateSlots &&
    world.gpuCandidateNeighbors &&
    world.gpuCandidateResidentList &&
    world.gpuResidentListCandidateSlots &&
    world.gpuResidentListCandidateNeighbors &&
    world.gpuCandidateCellRangeBridge &&
    world.gpuCandidateOccupancy &&
    world.gpuCandidateCellKeys &&
    world.gpuCandidateKeySort &&
    world.gpuCandidateSortedKeyGather &&
    world.gpuCandidateSortedKeyRanges &&
    world.gpuCandidateIndexMapBridge &&
    world.gpuCandidateIndexMapGather &&
    world.gpuCandidateIndexMapGatherState &&
    world.gpuCandidateSourceState
  ) return existing;
  destroyGpuCandidateBridge(world);
  world.gpuCandidateSourceState = new RawGpuConstraintParticleState(state.resources, { capacity: MAX_PARTICLES });
  const gpu = new RawGpuConstraintParticleState(state.resources, { capacity: MAX_PARTICLES });
  world.gpuCandidateState = gpu;
  world.gpuCandidateCollision = new RawGpuConstraintParticleCircleCollisionPass(state.gl);
  world.gpuCandidateViscosity = new RawGpuConstraintParticleViscosityPass(state.gl);
  world.gpuCandidatePressure = new RawGpuConstraintParticlePressurePass(state.gl);
  world.gpuCandidateBodyMetadataBridge = new RawGpuConstraintParticleBodyMetadataBridge(state.resources);
  world.gpuCandidateBodyShape = new RawGpuConstraintParticleBodyShapePass(state.gl);
  world.gpuCandidateGridKey = new RawGpuConstraintParticleGridKeyPass(state.resources, gpu);
  world.gpuCandidateSlots = new RawGpuConstraintParticleSortedCellCandidatePass(state.gl);
  world.gpuCandidateNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: gpu.width,
    height: gpu.height,
    slots: SOFT_BLOB_SORTED_CELL_RESIDENT_SCAN_LIMIT * 9,
  });
  world.gpuCandidateResidentList = new RawGpuConstraintParticleResidentListFromSortedKeysPass(state.resources);
  world.gpuResidentListCandidateSlots = new RawGpuConstraintParticleResidentListCandidatePass(state.gl);
  world.gpuResidentListCandidateNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: gpu.width,
    height: gpu.height,
    slots: SOFT_BLOB_SORTED_CELL_RESIDENT_SCAN_LIMIT * 9,
  });
  world.gpuCandidateCellRangeBridge = new RawGpuConstraintParticleCellRangeBridge(state.resources);
  world.gpuCandidateOccupancy = new RawGpuConstraintParticleCellOccupancyPass(state.resources);
  world.gpuCandidateCellOffsets = new RawGpuConstraintParticleCellOffsetPass(state.resources);
  world.gpuCandidateCellRanges = new RawGpuConstraintParticleCellRangeFromOffsetsPass(state.resources);
  world.gpuCandidateCellKeys = new RawGpuConstraintParticleCellKeyPass(state.resources);
  world.gpuCandidateKeySort = new RawGpuKeyIndexSortPass(state.resources);
  world.gpuCandidateSortedKeyGather = new RawGpuConstraintParticleSortedKeyGatherPass(state.gl);
  world.gpuCandidateSortedKeyRanges = new RawGpuConstraintParticleSortedKeyRangePass(state.resources);
  world.gpuCandidateIndexMapBridge = new RawGpuConstraintParticleIndexMapBridge(state.resources);
  world.gpuCandidateIndexMapGather = new RawGpuConstraintParticleIndexMapGatherPass(state.gl);
  world.gpuCandidateIndexMapGatherState = new RawGpuConstraintParticleState(state.resources, { capacity: MAX_PARTICLES });
  return gpu;
}

function maxGpuCandidateCellOccupancyFromSortedKeys(keys: Float32Array, count: number, sortStride: number): number {
  let maxOccupancy = 0;
  let previousCell = -1;
  let occupancy = 0;
  for (let index = 0; index < count; index += 1) {
    const cell = Math.floor(keys[index] / sortStride);
    if (cell === previousCell) {
      occupancy += 1;
    } else {
      if (occupancy > maxOccupancy) maxOccupancy = occupancy;
      previousCell = cell;
      occupancy = 1;
    }
  }
  return Math.max(maxOccupancy, occupancy);
}

function gpuCandidateStressInput(world: SoftBlobWorld): SoftBlobGpuCandidateStressInput | null {
  const residentReady =
    world.gpuCandidateUploadMode === 'gpu-sorted-key-gather' &&
    world.gpuResidentListCandidateStats?.suitableForAuthoritativeCollision === true &&
    world.gpuResidentListCandidateStats.indexOrder === 'original-index' &&
    world.gpuCandidateSourceState != null &&
    world.gpuResidentListCandidateNeighbors != null;
  if (residentReady && world.gpuCandidateSourceState && world.gpuResidentListCandidateNeighbors && world.gpuResidentListCandidateStats) {
    world.gpuCandidateStressSource = 'gpu-resident-list';
    world.gpuCandidateResidentListStressReady = true;
    return {
      state: world.gpuCandidateSourceState,
      neighbors: world.gpuResidentListCandidateNeighbors,
      stats: world.gpuResidentListCandidateStats,
      source: 'gpu-resident-list',
    };
  }
  if (world.gpuCandidateState && world.gpuCandidateNeighbors && world.gpuCandidateSlotStats) {
    world.gpuCandidateStressSource = 'gpu-sorted-cell-ranges';
    world.gpuCandidateResidentListStressReady = false;
    return {
      state: world.gpuCandidateState,
      neighbors: world.gpuCandidateNeighbors,
      stats: world.gpuCandidateSlotStats,
      source: 'gpu-sorted-cell-ranges',
    };
  }
  world.gpuCandidateStressSource = 'gpu-sorted-cell-ranges';
  world.gpuCandidateResidentListStressReady = false;
  return null;
}

function solveGpuCandidateCollisionStress(world: SoftBlobWorld, particleCount: number): void {
  const collision = world.gpuCandidateCollision;
  const stressInput = gpuCandidateStressInput(world);
  if (!stressInput || !collision || stressInput.stats.slotCount <= 0 || particleCount <= 0) {
    world.gpuCandidateCollisionBatches = 0;
    world.gpuCandidateCollisionFragmentTexels = 0;
    world.gpuCandidateCollisionConsumedSlots = 0;
    world.gpuCandidateCollisionIgnoredSlots = 0;
    world.gpuCandidateCollisionSpatiallyComplete = false;
    world.gpuCandidateCollisionStressActive = false;
    return;
  }
  const slotCount = Math.min(stressInput.stats.slotCount, stressInput.neighbors.framebuffers.length);
  let batches = 0;
  let fragmentTexels = 0;
  let consumedSlots = 0;
  for (let slotOffset = 0; slotOffset < slotCount; slotOffset += 8) {
    collision.solve({
      state: stressInput.state,
      neighborSlots: stressInput.neighbors.framebuffers,
      neighborSlotOffset: slotOffset,
      neighborSlotSource: stressInput.source,
      particleCount,
      iterations: 1,
      radiusScale: 1,
      stiffness: 0.16,
      damping: 0.01,
      spatiallyComplete: stressInput.stats.spatiallyComplete,
      slotOverflowCount: stressInput.stats.suitableForAuthoritativeCollision === true ? 0 : Math.max(0, world.gpuCandidateMaxCellOccupancy - SOFT_BLOB_SORTED_CELL_RESIDENT_SCAN_LIMIT),
    });
    const stats = collision.stats();
    batches += 1;
    fragmentTexels += stats.fragmentTexels;
    consumedSlots += stats.neighborSlotCount;
  }
  world.gpuCandidateCollisionBatches = batches;
  world.gpuCandidateCollisionFragmentTexels = fragmentTexels;
  world.gpuCandidateCollisionConsumedSlots = consumedSlots;
  world.gpuCandidateCollisionIgnoredSlots = Math.max(0, slotCount - consumedSlots);
  world.gpuCandidateCollisionSpatiallyComplete = stressInput.stats.spatiallyComplete;
  world.gpuCandidateCollisionStressActive = batches > 0;
}

function solveGpuCandidateViscosityStress(world: SoftBlobWorld, particleCount: number): void {
  const viscosity = world.gpuCandidateViscosity;
  const stressInput = gpuCandidateStressInput(world);
  if (!stressInput || !viscosity || stressInput.stats.slotCount <= 0 || particleCount <= 0) {
    world.gpuCandidateViscosityBatches = 0;
    world.gpuCandidateViscosityFragmentTexels = 0;
    world.gpuCandidateViscosityConsumedSlots = 0;
    world.gpuCandidateViscosityIgnoredSlots = 0;
    world.gpuCandidateViscosityStressActive = false;
    return;
  }
  const slotCount = Math.min(stressInput.stats.slotCount, stressInput.neighbors.framebuffers.length);
  let batches = 0;
  let fragmentTexels = 0;
  let consumedSlots = 0;
  for (let slotOffset = 0; slotOffset < slotCount; slotOffset += 8) {
    viscosity.solve({
      state: stressInput.state,
      neighborSlots: stressInput.neighbors.framebuffers,
      neighborSlotOffset: slotOffset,
      particleCount,
      radiusScale: 1.15,
      strength: 0.08,
      damping: 0.996,
      spatiallyComplete: stressInput.stats.spatiallyComplete,
      slotOverflowCount: stressInput.stats.suitableForAuthoritativeCollision === true ? 0 : Math.max(0, world.gpuCandidateMaxCellOccupancy - SOFT_BLOB_SORTED_CELL_RESIDENT_SCAN_LIMIT),
    });
    const stats = viscosity.stats();
    batches += 1;
    fragmentTexels += stats.fragmentTexels;
    consumedSlots += stats.neighborSlotCount;
  }
  world.gpuCandidateViscosityBatches = batches;
  world.gpuCandidateViscosityFragmentTexels = fragmentTexels;
  world.gpuCandidateViscosityConsumedSlots = consumedSlots;
  world.gpuCandidateViscosityIgnoredSlots = Math.max(0, slotCount - consumedSlots);
  world.gpuCandidateViscosityStressActive = batches > 0;
}

function solveGpuCandidatePressureStress(world: SoftBlobWorld, particleCount: number): void {
  const pressure = world.gpuCandidatePressure;
  const stressInput = gpuCandidateStressInput(world);
  if (!stressInput || !pressure || stressInput.stats.slotCount <= 0 || particleCount <= 0) {
    world.gpuCandidatePressureBatches = 0;
    world.gpuCandidatePressureFragmentTexels = 0;
    world.gpuCandidatePressureConsumedSlots = 0;
    world.gpuCandidatePressureIgnoredSlots = 0;
    world.gpuCandidatePressureStressActive = false;
    return;
  }
  const slotCount = Math.min(stressInput.stats.slotCount, stressInput.neighbors.framebuffers.length);
  let batches = 0;
  let fragmentTexels = 0;
  let consumedSlots = 0;
  for (let slotOffset = 0; slotOffset < slotCount; slotOffset += 8) {
    pressure.solve({
      state: stressInput.state,
      neighborSlots: stressInput.neighbors.framebuffers,
      neighborSlotOffset: slotOffset,
      particleCount,
      radiusScale: 1.08,
      restDistanceScale: 0.96,
      stiffness: 0.055,
      velocityBlend: 0.14,
      sameBodyOnly: true,
      spatiallyComplete: stressInput.stats.spatiallyComplete,
      slotOverflowCount: stressInput.stats.suitableForAuthoritativeCollision === true ? 0 : Math.max(0, world.gpuCandidateMaxCellOccupancy - SOFT_BLOB_SORTED_CELL_RESIDENT_SCAN_LIMIT),
    });
    const stats = pressure.stats();
    batches += 1;
    fragmentTexels += stats.fragmentTexels;
    consumedSlots += stats.neighborSlotCount;
  }
  world.gpuCandidatePressureBatches = batches;
  world.gpuCandidatePressureFragmentTexels = fragmentTexels;
  world.gpuCandidatePressureConsumedSlots = consumedSlots;
  world.gpuCandidatePressureIgnoredSlots = Math.max(0, slotCount - consumedSlots);
  world.gpuCandidatePressureStressActive = batches > 0;
}

function solveGpuCandidateBodyShapeStress(world: SoftBlobWorld, particleCount: number): void {
  const gpu = gpuCandidateStressInput(world)?.state;
  const bodyShape = world.gpuCandidateBodyShape;
  const bodyMetadata = world.gpuCandidateBodyMetadataBridge?.framebuffer;
  if (!gpu || !bodyShape || !bodyMetadata || world.bodyCount <= 0 || particleCount <= 0) {
    world.gpuCandidateBodyShapeFragmentTexels = 0;
    world.gpuCandidateBodyShapeStressActive = false;
    return;
  }
  bodyShape.solve({
    state: gpu,
    bodyMetadata,
    particleCount,
    bodyCount: world.bodyCount,
    minRadiusScale: 0.1,
    maxRadiusScale: 1.12,
    stiffness: 0.05,
    velocityBlend: 0.1,
  });
  const stats = bodyShape.stats();
  world.gpuCandidateBodyShapeFragmentTexels = stats.fragmentTexels;
  world.gpuCandidateBodyShapeStressActive = stats.fragmentTexels > 0;
}

function updateGpuCandidateBridge(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const count = world.particleCount;
  world.gpuCandidateTelemetrySampled = false;
  const staleSeconds = state.timeSeconds - world.gpuCandidateTelemetryLastSeconds;
  world.gpuCandidateTelemetryStaleSeconds = Number.isFinite(staleSeconds) ? Math.max(0, staleSeconds) : 0;
  if (count <= 0) {
    world.gpuCandidateGridKeyStats = undefined;
    world.gpuCandidateSlotStats = undefined;
    world.gpuCandidateResidentListStats = undefined;
    world.gpuResidentListCandidateStats = undefined;
    world.gpuCandidateSortedKeyGatherStats = undefined;
    world.gpuCandidateSortedKeyRangeStats = undefined;
    world.gpuCandidateUploadFloats = 0;
    world.gpuCandidateUploadMode = 'none';
    world.gpuCandidateCellRangeUploadFloats = 0;
    world.gpuCandidateMaxCellOccupancy = 0;
    world.gpuCandidateLastParticleCount = 0;
    return;
  }
  const shouldSample = count !== world.gpuCandidateLastParticleCount || world.gpuCandidateTelemetryLastSeconds === -Infinity || world.gpuCandidateTelemetryStaleSeconds >= 0.2;
  if (!shouldSample) return;
  const gpu = ensureGpuCandidateBridge(state, world);
  const requiredFloats = gpu.width * gpu.height * 4;
  if (!world.gpuCandidatePositions || world.gpuCandidatePositions.length !== requiredFloats) {
    world.gpuCandidatePositions = new Float32Array(requiredFloats);
    world.gpuCandidateVelocities = new Float32Array(requiredFloats);
    world.gpuCandidateAttributes = new Float32Array(requiredFloats);
  }
  if (
    !world.gpuCandidateKeys ||
    !world.gpuCandidateSortedKeys ||
    !world.gpuCandidateOrder ||
    world.gpuCandidateKeys.length !== count ||
    world.gpuCandidateSortedKeys.length !== count ||
    world.gpuCandidateOrder.length !== count
  ) {
    world.gpuCandidateKeys = new Float32Array(count);
    world.gpuCandidateSortedKeys = new Float32Array(count);
    world.gpuCandidateOrder = new Uint32Array(count);
  }
  const positions = world.gpuCandidatePositions;
  const velocities = world.gpuCandidateVelocities;
  const attributes = world.gpuCandidateAttributes;
  const keys = world.gpuCandidateKeys;
  const sortedKeys = world.gpuCandidateSortedKeys;
  const order = world.gpuCandidateOrder;
  if (!positions || !velocities || !attributes || !keys || !sortedKeys || !order) return;
  const cellSize = world.gridCellSize;
  const columns = Math.max(1, world.gridWidth);
  const rows = Math.max(1, world.gridHeight);
  const sourceGpu = world.gpuCandidateSourceState ?? gpu;
  const canUseGpuSortedGather =
    world.gpuCandidateSourceState != null &&
    world.gpuCandidateCellKeys != null &&
    world.gpuCandidateKeySort != null &&
    world.gpuCandidateSortedKeyGather != null;
  const sortStride = count + 1;
  for (let particle = 0; particle < count; particle += 1) {
    const cx = clamp(Math.floor(world.x[particle] / cellSize), 0, columns - 1);
    const cy = clamp(Math.floor(world.y[particle] / cellSize), 0, rows - 1);
    keys[particle] = (cy * columns + cx) * sortStride + particle;
    order[particle] = particle;
    if (canUseGpuSortedGather) {
      const target = particle * 4;
      positions[target] = world.x[particle];
      positions[target + 1] = world.y[particle];
      positions[target + 2] = world.radius[particle];
      positions[target + 3] = world.bodyOf[particle];
      velocities[target] = world.x[particle] - world.oldX[particle];
      velocities[target + 1] = world.y[particle] - world.oldY[particle];
      velocities[target + 2] = world.fixed[particle] ? 0 : 1;
      velocities[target + 3] = 0;
      attributes[target] = world.radius[particle];
      attributes[target + 1] = world.fixed[particle] ? 0 : 1;
      attributes[target + 2] = world.bodyOf[particle];
      attributes[target + 3] = particle;
    }
  }
  order.sort((a, b) => keys[a] - keys[b]);
  for (let sortedIndex = 0; sortedIndex < count; sortedIndex += 1) {
    const particle = order[sortedIndex];
    const target = sortedIndex * 4;
    sortedKeys[sortedIndex] = keys[particle];
    if (!canUseGpuSortedGather) {
      positions[target] = world.x[particle];
      positions[target + 1] = world.y[particle];
      positions[target + 2] = world.radius[particle];
      positions[target + 3] = world.bodyOf[particle];
      velocities[target] = world.x[particle] - world.oldX[particle];
      velocities[target + 1] = world.y[particle] - world.oldY[particle];
      velocities[target + 2] = world.fixed[particle] ? 0 : 1;
      velocities[target + 3] = 0;
      attributes[target] = world.radius[particle];
      attributes[target + 1] = world.fixed[particle] ? 0 : 1;
      attributes[target + 2] = world.bodyOf[particle];
      attributes[target + 3] = particle;
    }
  }
  if (canUseGpuSortedGather) {
    sourceGpu.uploadSeed({ positions, velocities, attributes, uploadWriteTargets: false, particleCount: count });
    world.gpuCandidateUploadFloats = sourceGpu.seedUploadFloats();
    world.gpuCandidateUploadMode = 'gpu-sorted-key-gather';
  } else {
    gpu.uploadSeed({ positions, velocities, attributes, uploadWriteTargets: false, particleCount: count });
    world.gpuCandidateUploadFloats = gpu.seedUploadFloats();
    world.gpuCandidateUploadMode = 'cpu-sorted-copy';
  }
  world.gpuCandidateCellSize = cellSize;
  world.gpuCandidateCellColumns = columns;
  world.gpuCandidateCellRows = rows;
  world.gpuCandidateOccupancyStats = world.gpuCandidateOccupancy?.compute({
    state: canUseGpuSortedGather ? sourceGpu : gpu,
    particleCount: count,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: state.width,
    worldMaxY: state.height,
    cellSize,
  });
  world.gpuCandidateCellOffsetStats = world.gpuCandidateOccupancy?.output
    ? world.gpuCandidateCellOffsets?.compute({
        occupancy: world.gpuCandidateOccupancy.output,
        gridColumns: world.gpuCandidateOccupancyStats?.gridColumns ?? 1,
        gridRows: world.gpuCandidateOccupancyStats?.gridRows ?? 1,
      })
    : undefined;
  world.gpuCandidateCellRangeStats =
    world.gpuCandidateOccupancy?.output && world.gpuCandidateCellOffsets?.output
      ? world.gpuCandidateCellRanges?.compute({
          occupancy: world.gpuCandidateOccupancy.output,
          inclusiveOffsets: world.gpuCandidateCellOffsets.output,
          gridColumns: world.gpuCandidateOccupancyStats?.gridColumns ?? 1,
          gridRows: world.gpuCandidateOccupancyStats?.gridRows ?? 1,
        })
      : undefined;
  world.gpuCandidateCellKeyStats = world.gpuCandidateCellKeys?.compute({
    state: canUseGpuSortedGather ? sourceGpu : gpu,
    particleCount: count,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: state.width,
    worldMaxY: state.height,
    cellSize,
  });
  world.gpuCandidateKeySortStats = world.gpuCandidateCellKeys?.output
    ? world.gpuCandidateKeySort?.sort({
        source: world.gpuCandidateCellKeys.output,
        sourceWidth: world.gpuCandidateCellKeyStats?.width ?? gpu.width,
        sourceHeight: world.gpuCandidateCellKeyStats?.height ?? 1,
        elementCount: count,
      })
    : undefined;
  world.gpuCandidateSortedKeyRangeStats = world.gpuCandidateKeySort?.output && world.gpuCandidateKeySortStats
    ? world.gpuCandidateSortedKeyRanges?.compute({
        sortedKeys: world.gpuCandidateKeySort.output,
        sortedKeyWidth: world.gpuCandidateKeySortStats.width,
        sortedKeyHeight: world.gpuCandidateKeySortStats.height,
        elementCount: count,
        gridColumns: columns,
        gridRows: rows,
      })
    : undefined;
  if (world.gpuCandidateKeySort?.output && world.gpuCandidateKeySortStats) {
    world.gpuCandidateSortedKeyGather?.gather({
      source: canUseGpuSortedGather ? sourceGpu : gpu,
      destination: gpu,
      sortedKeys: world.gpuCandidateKeySort.output,
      sortedKeyWidth: world.gpuCandidateKeySortStats.width,
      sortedKeyHeight: world.gpuCandidateKeySortStats.height,
      particleCount: count,
      gatherAttributes: true,
    });
    world.gpuCandidateSortedKeyGatherStats = world.gpuCandidateSortedKeyGather?.stats();
  } else {
    world.gpuCandidateSortedKeyGatherStats = undefined;
  }
  const gpuCellRanges = world.gpuCandidateSortedKeyRanges?.output ?? world.gpuCandidateCellRanges?.output;
  const range = gpuCellRanges
    ? undefined
    : world.gpuCandidateCellRangeBridge?.upload({
        sortedKeys,
        particleCount: count,
        columns,
        rows,
      });
  world.gpuCandidateCellRangeUploadFloats = gpuCellRanges ? 0 : range?.uploadFloats ?? 0;
  world.gpuCandidateMaxCellOccupancy = gpuCellRanges
    ? maxGpuCandidateCellOccupancyFromSortedKeys(sortedKeys, count, sortStride)
    : range?.maxCellOccupancy ?? 0;
  world.gpuCandidateResidentListStats = world.gpuCandidateKeySort?.output && world.gpuCandidateKeySortStats && world.gpuCandidateResidentList
    ? world.gpuCandidateResidentList.compute({
        sortedKeys: world.gpuCandidateKeySort.output,
        sortedKeyWidth: world.gpuCandidateKeySortStats.width,
        sortedKeyHeight: world.gpuCandidateKeySortStats.height,
        elementCount: count,
        gridColumns: columns,
        gridRows: rows,
        residentLimit: SOFT_BLOB_SORTED_CELL_RESIDENT_SCAN_LIMIT,
        maxCellOccupancy: world.gpuCandidateMaxCellOccupancy,
      })
    : undefined;
  world.gpuResidentListCandidateStats =
    world.gpuCandidateCellKeys?.output &&
    world.gpuCandidateResidentList?.output &&
    world.gpuResidentListCandidateSlots &&
    world.gpuResidentListCandidateNeighbors &&
    sourceGpu
      ? world.gpuResidentListCandidateSlots.generate({
          state: sourceGpu,
          gridKeys: world.gpuCandidateCellKeys.output,
          residentList: world.gpuCandidateResidentList.output,
          outputSlots: world.gpuResidentListCandidateNeighbors.framebuffers,
          particleCount: count,
          gridColumns: columns,
          gridRows: rows,
          residentLimit: world.gpuCandidateResidentListStats?.residentLimit ?? SOFT_BLOB_SORTED_CELL_RESIDENT_SCAN_LIMIT,
          residentListTextureWidth: world.gpuCandidateResidentList.output.texture.width,
          residentListTextureHeight: world.gpuCandidateResidentList.output.texture.height,
          maxCellOccupancy: world.gpuCandidateMaxCellOccupancy,
        })
      : undefined;
  const mapResult = world.gpuCandidateIndexMapBridge?.uploadFromSortedKeys({
    sortedKeys,
    particleCount: count,
    sortStride,
    sortedTextureWidth: gpu.width,
    targetWidth: gpu.width,
    targetHeight: gpu.height,
  });
  world.gpuCandidateIndexMapUploadFloats = mapResult?.uploadFloats ?? 0;
  const bodyMetadata = world.gpuCandidateBodyMetadataBridge?.upload({
    bodyCount: world.bodyCount,
    centerX: world.bodyCenterX,
    centerY: world.bodyCenterY,
    restArea: world.bodyRestArea,
  });
  world.gpuCandidateBodyMetadataUploadFloats = bodyMetadata?.uploadFloats ?? 0;
  world.gpuCandidateGridKeyStats = world.gpuCandidateGridKey?.compute({
    state: gpu,
    particleCount: count,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: state.width,
    worldMaxY: state.height,
    cellSize,
  });
  const cellRanges = world.gpuCandidateSortedKeyRanges?.output ?? world.gpuCandidateCellRanges?.output ?? world.gpuCandidateCellRangeBridge?.framebuffer;
  world.gpuCandidateSlotStats = world.gpuCandidateGridKey && world.gpuCandidateSlots && world.gpuCandidateNeighbors && cellRanges
    ? world.gpuCandidateSlots.generate({
      state: gpu,
      gridKeys: world.gpuCandidateGridKey.output,
      cellRanges,
      outputSlots: world.gpuCandidateNeighbors.framebuffers,
      particleCount: count,
      gridColumns: columns,
      gridRows: rows,
      residentScanLimit: SOFT_BLOB_SORTED_CELL_RESIDENT_SCAN_LIMIT,
      cellRangeTextureWidth: cellRanges.texture.width,
      cellRangeTextureHeight: cellRanges.texture.height,
      maxCellOccupancy: world.gpuCandidateMaxCellOccupancy,
    })
    : undefined;
  solveGpuCandidateCollisionStress(world, count);
  solveGpuCandidateViscosityStress(world, count);
  solveGpuCandidatePressureStress(world, count);
  solveGpuCandidateBodyShapeStress(world, count);
  const indexMap = world.gpuCandidateIndexMapBridge?.framebuffer;
  if (
    world.gpuCandidateStressSource !== 'gpu-resident-list' &&
    world.gpuCandidateIndexMapGather &&
    world.gpuCandidateIndexMapGatherState &&
    indexMap
  ) {
    world.gpuCandidateIndexMapGather.gather({
      source: gpu,
      destination: world.gpuCandidateIndexMapGatherState,
      indexMap,
      particleCount: count,
    });
    const gatherStats = world.gpuCandidateIndexMapGather.stats();
    world.gpuCandidateIndexMapGatherFragmentTexels = gatherStats.fragmentTexels;
    world.gpuCandidateIndexMapGatherActive = gatherStats.fragmentTexels > 0;
  } else {
    world.gpuCandidateIndexMapGatherFragmentTexels = 0;
    world.gpuCandidateIndexMapGatherActive = false;
  }
  world.gpuCandidateTelemetryLastSeconds = state.timeSeconds;
  world.gpuCandidateTelemetryFrame += 1;
  world.gpuCandidateTelemetrySampled = true;
  world.gpuCandidateTelemetryStaleSeconds = 0;
  world.gpuCandidateLastParticleCount = count;
}

function removeOffscreenBodies(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const fixedParticles: Array<{ x: number; y: number; oldX: number; oldY: number; radius: number }> = [];
  for (let particle = 0; particle < world.particleCount; particle += 1) {
    if (!world.fixed[particle]) continue;
    fixedParticles.push({
      x: world.x[particle],
      y: world.y[particle],
      oldX: world.oldX[particle],
      oldY: world.oldY[particle],
      radius: world.radius[particle],
    });
  }
  let targetBody = 0;
  let targetParticle = 0;
  for (let body = 0; body < world.bodyCount; body += 1) {
    const base = world.bodyBase[body];
    const particleTotal = world.bodyParticleCount[body];
    let keep = false;
    for (let index = 0; index < particleTotal; index += 1) {
      const particle = base + index;
      if (world.y[particle] < state.height + 260) {
        keep = true;
        break;
      }
    }
    if (!keep) continue;
    if (targetBody !== body) {
      const nextBase = targetParticle;
      world.bodyBase[targetBody] = nextBase;
      world.bodyBoundaryCount[targetBody] = world.bodyBoundaryCount[body];
      world.bodyInteriorCount[targetBody] = world.bodyInteriorCount[body];
      world.bodyParticleCount[targetBody] = particleTotal;
      world.bodySize[targetBody] = world.bodySize[body];
      world.bodyRestArea[targetBody] = world.bodyRestArea[body];
      world.bodyAge[targetBody] = world.bodyAge[body];
      world.bodySeed[targetBody] = world.bodySeed[body];
      world.bodyColorIndex[targetBody] = world.bodyColorIndex[body];
      world.bodyCenterX[targetBody] = world.bodyCenterX[body];
      world.bodyCenterY[targetBody] = world.bodyCenterY[body];
      world.bodyExtent[targetBody] = world.bodyExtent[body];
      for (let index = 0; index < BOUNDARY_COUNT; index += 1) {
        const from = body * BOUNDARY_COUNT + index;
        const to = targetBody * BOUNDARY_COUNT + index;
        world.edgeRest[to] = world.edgeRest[from];
        world.edgeBase[to] = world.edgeBase[from];
        world.bendRest[to] = world.bendRest[from];
        world.bendBase[to] = world.bendBase[from];
      }
      for (let index = 0; index < particleTotal; index += 1) {
        const from = base + index;
        const to = nextBase + index;
        world.x[to] = world.x[from];
        world.y[to] = world.y[from];
        world.oldX[to] = world.oldX[from];
        world.oldY[to] = world.oldY[from];
        world.radius[to] = world.radius[from];
        world.bodyOf[to] = targetBody;
        world.boundaryIndex[to] = world.boundaryIndex[from];
        world.fixed[to] = world.fixed[from];
      }
    }
    targetBody += 1;
    targetParticle += particleTotal;
  }
  for (const fixed of fixedParticles) {
    if (targetParticle >= MAX_PARTICLES) break;
    world.x[targetParticle] = fixed.x;
    world.y[targetParticle] = fixed.y;
    world.oldX[targetParticle] = fixed.oldX;
    world.oldY[targetParticle] = fixed.oldY;
    world.radius[targetParticle] = fixed.radius;
    world.bodyOf[targetParticle] = -1;
    world.boundaryIndex[targetParticle] = -1;
    world.fixed[targetParticle] = 1;
    targetParticle += 1;
  }
  world.bodyCount = targetBody;
  world.particleCount = targetParticle;
}

function runDemo(state: RawWebGL2RenderState, world: SoftBlobWorld, dt: number): void {
  if (!world.preview && state.mode !== 'demo') return;
  world.demoSpawnTimer += dt;
  const interval = world.preview ? 0.42 : 0.24;
  while (world.demoSpawnTimer >= interval) {
    world.demoSpawnTimer -= interval;
    const density = nodeDensity(state);
    const size = blobSize(state) * (0.9 + density * 0.08) * (world.preview ? 0.52 : 1) * randomRange(0.9, 1.12);
    const x = state.width * (0.26 + hash01(state.frame + world.bodyCount * 11.3) * 0.48);
    const y = -size * randomRange(0.8, 2.4);
    spawnBlob(world, x, y, size, undefined, undefined, density);
  }
  world.resetFloorTimer += dt;
  if (world.resetFloorTimer > (world.preview ? 5.8 : 8.5)) {
    world.resetFloorTimer = 0;
    world.floorOpenTimer = world.preview ? 1.35 : 1.8;
  }
}

function integrate(state: RawWebGL2RenderState, world: SoftBlobWorld, dt: number): void {
  const gravity = settingsNumber(state, 'gravity', 1250, 0, 2400);
  const viscosity = settingsNumber(state, 'viscosity', 0.64, 0, 1);
  const damping = 0.996 - viscosity * 0.01;
  const acceleration = gravity * dt * dt;
  for (let particle = 0; particle < world.particleCount; particle += 1) {
    if (world.fixed[particle]) {
      world.oldX[particle] = world.x[particle];
      world.oldY[particle] = world.y[particle];
      continue;
    }
    const velocityX = (world.x[particle] - world.oldX[particle]) * damping;
    const velocityY = (world.y[particle] - world.oldY[particle]) * damping;
    world.oldX[particle] = world.x[particle];
    world.oldY[particle] = world.y[particle];
    world.x[particle] += velocityX;
    world.y[particle] += velocityY + acceleration;
  }
  for (let body = 0; body < world.bodyCount; body += 1) world.bodyAge[body] += dt;
}

function applyPointerForces(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  if (!world.pointer.dragging) return;
  const radius = settingsNumber(state, 'interactionRadius', 72, 16, 280);
  const moveX = world.pointer.x - world.pointer.lastX;
  const moveY = world.pointer.y - world.pointer.lastY;
  if (world.pointer.grabbedBodies.length === 0) {
    world.pointer.grabbedBodies = pickInteractionBodies(state, world, world.pointer.x, world.pointer.y);
  }
  for (const body of world.pointer.grabbedBodies) {
    if (body < 0 || body >= world.bodyCount) continue;
    const base = world.bodyBase[body];
    const particleTotal = world.bodyParticleCount[body];
    const centerX = world.bodyCenterX[body];
    const centerY = world.bodyCenterY[body];
    const effectiveRadius = Math.max(radius, world.bodyExtent[body] * 0.9);
    const dx = world.pointer.x - centerX;
    const dy = world.pointer.y - centerY;
    const distanceToPointer = Math.sqrt(dx * dx + dy * dy);
    const weight = Math.exp(-Math.max(0, distanceToPointer - world.bodyExtent[body]) / Math.max(1, effectiveRadius));
    const springX = dx * 0.022 * weight;
    const springY = dy * 0.022 * weight;
    const carryX = moveX * (0.92 + weight * 0.18) + springX;
    const carryY = moveY * (0.92 + weight * 0.18) + springY;
    const releaseVelocityX = moveX * 0.09 * weight;
    const releaseVelocityY = moveY * 0.09 * weight;
    for (let index = 0; index < particleTotal; index += 1) {
      const particle = base + index;
      world.x[particle] += carryX;
      world.y[particle] += carryY;
      world.oldX[particle] += carryX - releaseVelocityX;
      world.oldY[particle] += carryY - releaseVelocityY;
    }
  }
}

function pickInteractionBodies(state: RawWebGL2RenderState, world: SoftBlobWorld, x: number, y: number): number[] {
  const radius = settingsNumber(state, 'interactionRadius', 72, 16, 280);
  const picked: number[] = [];
  let nearestBody = -1;
  let nearestDistance2 = Number.POSITIVE_INFINITY;
  for (let body = 0; body < world.bodyCount; body += 1) {
    const dx = world.bodyCenterX[body] - x;
    const dy = world.bodyCenterY[body] - y;
    const dist2 = dx * dx + dy * dy;
    const reach = radius + world.bodyExtent[body] * 0.72;
    if (dist2 < nearestDistance2) {
      nearestDistance2 = dist2;
      nearestBody = body;
    }
    if (dist2 <= reach * reach) picked.push(body);
  }
  if (picked.length === 0 && nearestBody >= 0 && nearestDistance2 <= radius * radius * 3.24) picked.push(nearestBody);
  return picked;
}

function solveWalls(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const left = 16;
  const right = state.width - 16;
  const top = -160;
  const bottom = boundsBottom(state, world);
  const friction = 0.74 + settingsNumber(state, 'viscosity', 0.64, 0, 1) * 0.12;
  for (let particle = 0; particle < world.particleCount; particle += 1) {
    if (world.fixed[particle]) continue;
    const radius = world.radius[particle];
    if (world.x[particle] < left + radius) {
      world.x[particle] = left + radius;
      if (world.x[particle] - world.oldX[particle] < 0) world.oldX[particle] = world.x[particle];
    } else if (world.x[particle] > right - radius) {
      world.x[particle] = right - radius;
      if (world.x[particle] - world.oldX[particle] > 0) world.oldX[particle] = world.x[particle];
    }
    if (world.y[particle] < top + radius) {
      world.y[particle] = top + radius;
      if (world.y[particle] - world.oldY[particle] < 0) world.oldY[particle] = world.y[particle];
    } else if (world.y[particle] > bottom - radius) {
      world.y[particle] = bottom - radius;
      const velocityX = world.x[particle] - world.oldX[particle];
      if (world.y[particle] - world.oldY[particle] > 0) world.oldY[particle] = world.y[particle];
      world.oldX[particle] = world.x[particle] - velocityX * friction;
    }
  }
}

function solveDistance(world: SoftBlobWorld, a: number, b: number, rest: number, stiffness: number): void {
  const dx = world.x[b] - world.x[a];
  const dy = world.y[b] - world.y[a];
  const distSquared = dx * dx + dy * dy;
  if (distSquared < EPSILON) return;
  const dist = Math.sqrt(distSquared);
  const correction = ((dist - rest) / dist) * 0.5 * stiffness;
  const cx = dx * correction;
  const cy = dy * correction;
  world.x[a] += cx;
  world.y[a] += cy;
  world.x[b] -= cx;
  world.y[b] -= cy;
}

function solveBodyStructure(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const squish = settingsNumber(state, 'squishiness', 0.78, 0, 2);
  const surface = settingsNumber(state, 'surfaceTension', 0.28, 0, 1);
  const softness = clamp(squish / 2, 0, 1);
  const previewSoftness = world.preview ? 0.42 : 1;
  const edgeStiffness = (0.20 + (1 - softness) * 0.40) * previewSoftness;
  const bendStiffness = (0.01 + (1 - softness) * 0.09) * (world.preview ? 0.22 : 1);
  const areaStiffness = (0.045 + (1 - softness) * 0.15) * (world.preview ? 0.32 : 1);
  const surfaceStiffness = surface * 0.06 * (world.preview ? 0.18 : 1);
  for (let body = 0; body < world.bodyCount; body += 1) {
    const base = world.bodyBase[body];
    const boundaryCount = world.bodyBoundaryCount[body];
    for (let index = 0; index < boundaryCount; index += 1) {
      solveDistance(world, base + index, base + ((index + 1) % boundaryCount), world.edgeRest[body * BOUNDARY_COUNT + index], edgeStiffness);
    }
    for (let index = 0; index < boundaryCount; index += 1) {
      solveDistance(world, base + index, base + ((index + 2) % boundaryCount), world.bendRest[body * BOUNDARY_COUNT + index], bendStiffness);
    }
    solveArea(state, world, body, areaStiffness);
    solveSurfaceTension(world, body, surfaceStiffness);
    solveInteriorMembrane(world, body);
  }
}

function solveArea(state: RawWebGL2RenderState, world: SoftBlobWorld, body: number, stiffness: number): void {
  const base = world.bodyBase[body];
  const boundaryCount = world.bodyBoundaryCount[body];
  let area = 0;
  let denominator = 0;
  const gradientsX = world.areaGradientX;
  const gradientsY = world.areaGradientY;
  for (let index = 0; index < boundaryCount; index += 1) {
    const previous = base + ((index + boundaryCount - 1) % boundaryCount);
    const particle = base + index;
    const next = base + ((index + 1) % boundaryCount);
    area += world.x[particle] * world.y[next] - world.y[particle] * world.x[next];
    const gradientX = 0.5 * (world.y[next] - world.y[previous]);
    const gradientY = 0.5 * (world.x[previous] - world.x[next]);
    gradientsX[index] = gradientX;
    gradientsY[index] = gradientY;
    denominator += gradientX * gradientX + gradientY * gradientY;
  }
  area *= 0.5;
  const target = world.bodyRestArea[body];
  const constraint = area - target;
  if (Math.abs(constraint) < target * 0.002 || denominator < EPSILON) return;
  const lambda = (-constraint / denominator) * stiffness;
  const maxCorrection = blobSize(state) * 0.06;
  for (let index = 0; index < boundaryCount; index += 1) {
    let correctionX = lambda * gradientsX[index];
    let correctionY = lambda * gradientsY[index];
    const correctionLength2 = correctionX * correctionX + correctionY * correctionY;
    if (correctionLength2 > maxCorrection * maxCorrection) {
      const correctionLength = Math.sqrt(correctionLength2);
      const scale = maxCorrection / (correctionLength + EPSILON);
      correctionX *= scale;
      correctionY *= scale;
    }
    const particle = base + index;
    world.x[particle] += correctionX;
    world.y[particle] += correctionY;
  }
}

function solveSurfaceTension(world: SoftBlobWorld, body: number, stiffness: number): void {
  if (stiffness <= 0) return;
  const base = world.bodyBase[body];
  const boundaryCount = world.bodyBoundaryCount[body];
  for (let index = 0; index < boundaryCount; index += 1) {
    const particle = base + index;
    const previous = base + ((index + boundaryCount - 1) % boundaryCount);
    const next = base + ((index + 1) % boundaryCount);
    const targetX = (world.x[previous] + world.x[next]) * 0.5;
    const targetY = (world.y[previous] + world.y[next]) * 0.5;
    world.x[particle] += (targetX - world.x[particle]) * stiffness;
    world.y[particle] += (targetY - world.y[particle]) * stiffness;
  }
}

function solveInteriorMembrane(world: SoftBlobWorld, body: number): void {
  const base = world.bodyBase[body];
  const boundaryCount = world.bodyBoundaryCount[body];
  const interiorCount = world.bodyInteriorCount[body];
  const stiffness = 0.72;
  for (let interior = 0; interior < interiorCount; interior += 1) {
    const particle = base + boundaryCount + interior;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let boundary = 0; boundary < boundaryCount; boundary += 1) {
      const a = base + boundary;
      const b = base + ((boundary + 1) % boundaryCount);
      const ax = world.x[a];
      const ay = world.y[a];
      const bx = world.x[b];
      const by = world.y[b];
      const segmentX = bx - ax;
      const segmentY = by - ay;
      const lengthSquared = segmentX * segmentX + segmentY * segmentY + EPSILON;
      const t = clamp(((world.x[particle] - ax) * segmentX + (world.y[particle] - ay) * segmentY) / lengthSquared, 0, 1);
      const closestX = ax + segmentX * t;
      const closestY = ay + segmentY * t;
      const d = distance(world.x[particle], world.y[particle], closestX, closestY);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = boundary;
      }
    }
    const a = base + bestIndex;
    const b = base + ((bestIndex + 1) % boundaryCount);
    const ax = world.x[a];
    const ay = world.y[a];
    const bx = world.x[b];
    const by = world.y[b];
    const edgeX = bx - ax;
    const edgeY = by - ay;
    const length = Math.sqrt(edgeX * edgeX + edgeY * edgeY) + EPSILON;
    const normalX = -edgeY / length;
    const normalY = edgeX / length;
    const side = (world.x[particle] - ax) * normalX + (world.y[particle] - ay) * normalY;
    const minDistance = world.radius[particle] * 0.85;
    if (side < minDistance) {
      const correction = (minDistance - side) * stiffness;
      world.x[particle] += normalX * correction;
      world.y[particle] += normalY * correction;
      world.x[a] -= normalX * correction * 0.035;
      world.y[a] -= normalY * correction * 0.035;
      world.x[b] -= normalX * correction * 0.035;
      world.y[b] -= normalY * correction * 0.035;
    }
  }
}

function adjacentBoundary(world: SoftBlobWorld, a: number, b: number): boolean {
  const ia = world.boundaryIndex[a];
  const ib = world.boundaryIndex[b];
  if (ia < 0 || ib < 0) return false;
  const boundaryCount = world.bodyBoundaryCount[world.bodyOf[a]];
  const wrappedDiff = Math.min(Math.abs(ia - ib), boundaryCount - Math.abs(ia - ib));
  return wrappedDiff <= 1;
}

function solveContacts(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const squish = settingsNumber(state, 'squishiness', 0.78, 0, 2);
  const softness = clamp(squish / 2, 0, 1);
  const sameBodyStrength = (0.14 + (1 - softness) * 0.22) * (world.preview ? 0.58 : 1);
  const otherBodyStrength = (0.42 + (1 - softness) * 0.13) * (world.preview ? 0.72 : 1);
  world.contactCount = 0;
  world.pairChecks = 0;
  const columns = world.gridWidth;
  const rows = world.gridHeight;
  for (let gy = 0; gy < rows; gy += 1) {
    const row = gy * columns;
    const nextRow = row + columns;
    for (let gx = 0; gx < columns; gx += 1) {
      const cell = row + gx;
      if (world.gridHeads[cell] === -1) continue;
      solveContactSelfCell(world, cell, sameBodyStrength, otherBodyStrength);
      if (gx + 1 < columns) solveContactCellPair(world, cell, cell + 1, sameBodyStrength, otherBodyStrength);
      if (gy + 1 < rows) {
        solveContactCellPair(world, cell, nextRow + gx, sameBodyStrength, otherBodyStrength);
        if (gx > 0) solveContactCellPair(world, cell, nextRow + gx - 1, sameBodyStrength, otherBodyStrength);
        if (gx + 1 < columns) solveContactCellPair(world, cell, nextRow + gx + 1, sameBodyStrength, otherBodyStrength);
      }
    }
  }
}

function solveContactSelfCell(world: SoftBlobWorld, cell: number, sameBodyStrength: number, otherBodyStrength: number): void {
  for (let a = world.gridHeads[cell]; a !== -1; a = world.gridNext[a]) {
    for (let b = world.gridNext[a]; b !== -1; b = world.gridNext[b]) {
      solveContactPair(world, a, b, sameBodyStrength, otherBodyStrength);
    }
  }
}

function solveContactCellPair(world: SoftBlobWorld, cellA: number, cellB: number, sameBodyStrength: number, otherBodyStrength: number): void {
  for (let a = world.gridHeads[cellA]; a !== -1; a = world.gridNext[a]) {
    for (let b = world.gridHeads[cellB]; b !== -1; b = world.gridNext[b]) {
      solveContactPair(world, a, b, sameBodyStrength, otherBodyStrength);
    }
  }
}

function solveContactPair(world: SoftBlobWorld, a: number, b: number, sameBodyStrength: number, otherBodyStrength: number): void {
  world.pairChecks += 1;
  const aFixed = world.fixed[a] === 1;
  const bFixed = world.fixed[b] === 1;
  if (aFixed && bFixed) return;
  const same = !aFixed && !bFixed && world.bodyOf[a] === world.bodyOf[b];
  if (same && adjacentBoundary(world, a, b)) return;
  const minDistance = (world.radius[a] + world.radius[b]) * (same ? 0.88 : 1);
  const dx = world.x[b] - world.x[a];
  const dy = world.y[b] - world.y[a];
  const d2 = dx * dx + dy * dy;
  if (d2 >= minDistance * minDistance || d2 < EPSILON) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const correction = Math.min((minDistance - d) * (same ? sameBodyStrength : otherBodyStrength), Math.min(world.radius[a], world.radius[b]) * 0.56);
  if (aFixed) {
    world.x[b] += nx * correction;
    world.y[b] += ny * correction;
  } else if (bFixed) {
    world.x[a] -= nx * correction;
    world.y[a] -= ny * correction;
  } else {
    world.x[a] -= nx * correction * 0.5;
    world.y[a] -= ny * correction * 0.5;
    world.x[b] += nx * correction * 0.5;
    world.y[b] += ny * correction * 0.5;
  }
  world.contactCount += 1;
}

function applyPlasticity(state: RawWebGL2RenderState, world: SoftBlobWorld, dt: number): void {
  const plasticity = settingsNumber(state, 'plasticFlow', 0.18, 0, 1);
  const rate = plasticity * 0.55 * dt;
  if (rate <= 0) return;
  for (let body = 0; body < world.bodyCount; body += 1) {
    const base = world.bodyBase[body];
    const boundaryCount = world.bodyBoundaryCount[body];
    for (let index = 0; index < boundaryCount; index += 1) {
      const next = (index + 1) % boundaryCount;
      const next2 = (index + 2) % boundaryCount;
      const constraint = body * BOUNDARY_COUNT + index;
      const edgeLength = distance(world.x[base + index], world.y[base + index], world.x[base + next], world.y[base + next]);
      const bendLength = distance(world.x[base + index], world.y[base + index], world.x[base + next2], world.y[base + next2]);
      world.edgeRest[constraint] = clamp(world.edgeRest[constraint] + (edgeLength - world.edgeRest[constraint]) * rate, world.edgeBase[constraint] * 0.68, world.edgeBase[constraint] * 1.52);
      world.bendRest[constraint] = clamp(world.bendRest[constraint] + (bendLength - world.bendRest[constraint]) * rate, world.bendBase[constraint] * 0.65, world.bendBase[constraint] * 1.58);
    }
  }
}

function applyViscosity(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const viscosity = settingsNumber(state, 'viscosity', 0.64, 0, 1);
  if (viscosity <= 0.001) return;
  const blendBase = 0.045 + viscosity * 0.155;
  buildGrid(world);
  const columns = world.gridWidth;
  const rows = world.gridHeight;
  for (let gy = 0; gy < rows; gy += 1) {
    const row = gy * columns;
    const nextRow = row + columns;
    for (let gx = 0; gx < columns; gx += 1) {
      const cell = row + gx;
      if (world.gridHeads[cell] === -1) continue;
      solveViscositySelfCell(world, cell, blendBase);
      if (gx + 1 < columns) solveViscosityCellPair(world, cell, cell + 1, blendBase);
      if (gy + 1 < rows) {
        solveViscosityCellPair(world, cell, nextRow + gx, blendBase);
        if (gx > 0) solveViscosityCellPair(world, cell, nextRow + gx - 1, blendBase);
        if (gx + 1 < columns) solveViscosityCellPair(world, cell, nextRow + gx + 1, blendBase);
      }
    }
  }
}

function solveViscositySelfCell(world: SoftBlobWorld, cell: number, blendBase: number): void {
  for (let a = world.gridHeads[cell]; a !== -1; a = world.gridNext[a]) {
    for (let b = world.gridNext[a]; b !== -1; b = world.gridNext[b]) solveViscosityPair(world, a, b, blendBase);
  }
}

function solveViscosityCellPair(world: SoftBlobWorld, cellA: number, cellB: number, blendBase: number): void {
  for (let a = world.gridHeads[cellA]; a !== -1; a = world.gridNext[a]) {
    for (let b = world.gridHeads[cellB]; b !== -1; b = world.gridNext[b]) solveViscosityPair(world, a, b, blendBase);
  }
}

function solveViscosityPair(world: SoftBlobWorld, a: number, b: number, blendBase: number): void {
  if (world.fixed[a] || world.fixed[b] || world.bodyOf[a] !== world.bodyOf[b] || adjacentBoundary(world, a, b)) return;
  const range = (world.radius[a] + world.radius[b]) * 2.85;
  const dx = world.x[b] - world.x[a];
  const dy = world.y[b] - world.y[a];
  const d2 = dx * dx + dy * dy;
  if (d2 >= range * range || d2 < EPSILON) return;
  const weight = 1 - Math.sqrt(d2) / range;
  const velocityAX = world.x[a] - world.oldX[a];
  const velocityAY = world.y[a] - world.oldY[a];
  const velocityBX = world.x[b] - world.oldX[b];
  const velocityBY = world.y[b] - world.oldY[b];
  const blend = blendBase * weight * weight;
  const impulseX = (velocityBX - velocityAX) * blend;
  const impulseY = (velocityBY - velocityAY) * blend;
  world.oldX[a] -= impulseX;
  world.oldY[a] -= impulseY;
  world.oldX[b] += impulseX;
  world.oldY[b] += impulseY;
}

function settleContactVelocities(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const damping = 0.18 + settingsNumber(state, 'viscosity', 0.64, 0, 1) * 0.36;
  buildGrid(world);
  const columns = world.gridWidth;
  const rows = world.gridHeight;
  for (let gy = 0; gy < rows; gy += 1) {
    const row = gy * columns;
    const nextRow = row + columns;
    for (let gx = 0; gx < columns; gx += 1) {
      const cell = row + gx;
      if (world.gridHeads[cell] === -1) continue;
      solveSettlingSelfCell(world, cell, damping);
      if (gx + 1 < columns) solveSettlingCellPair(world, cell, cell + 1, damping);
      if (gy + 1 < rows) {
        solveSettlingCellPair(world, cell, nextRow + gx, damping);
        if (gx > 0) solveSettlingCellPair(world, cell, nextRow + gx - 1, damping);
        if (gx + 1 < columns) solveSettlingCellPair(world, cell, nextRow + gx + 1, damping);
      }
    }
  }
}

function solveSettlingSelfCell(world: SoftBlobWorld, cell: number, damping: number): void {
  for (let a = world.gridHeads[cell]; a !== -1; a = world.gridNext[a]) {
    for (let b = world.gridNext[a]; b !== -1; b = world.gridNext[b]) solveSettlingPair(world, a, b, damping);
  }
}

function solveSettlingCellPair(world: SoftBlobWorld, cellA: number, cellB: number, damping: number): void {
  for (let a = world.gridHeads[cellA]; a !== -1; a = world.gridNext[a]) {
    for (let b = world.gridHeads[cellB]; b !== -1; b = world.gridNext[b]) solveSettlingPair(world, a, b, damping);
  }
}

function solveSettlingPair(world: SoftBlobWorld, a: number, b: number, damping: number): void {
  if (world.fixed[a] || world.fixed[b]) return;
  const minDistance = (world.radius[a] + world.radius[b]) * 1.03;
  const dx = world.x[b] - world.x[a];
  const dy = world.y[b] - world.y[a];
  const d2 = dx * dx + dy * dy;
  if (d2 >= minDistance * minDistance || d2 < EPSILON) return;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const rvx = (world.x[b] - world.oldX[b]) - (world.x[a] - world.oldX[a]);
  const rvy = (world.y[b] - world.oldY[b]) - (world.y[a] - world.oldY[a]);
  const normalVelocity = rvx * nx + rvy * ny;
  if (normalVelocity >= 0) return;
  const impulse = -normalVelocity * damping * 0.5;
  world.oldX[a] += nx * impulse;
  world.oldY[a] += ny * impulse;
  world.oldX[b] -= nx * impulse;
  world.oldY[b] -= ny * impulse;
}

function updateCenters(world: SoftBlobWorld): void {
  for (let body = 0; body < world.bodyCount; body += 1) {
    const base = world.bodyBase[body];
    const boundaryCount = world.bodyBoundaryCount[body];
    const particleTotal = world.bodyParticleCount[body];
    let centerX = 0;
    let centerY = 0;
    for (let index = 0; index < particleTotal; index += 1) {
      centerX += world.x[base + index];
      centerY += world.y[base + index];
    }
    centerX /= particleTotal;
    centerY /= particleTotal;
    let extent = 0;
    for (let index = 0; index < boundaryCount; index += 1) extent = Math.max(extent, distance(centerX, centerY, world.x[base + index], world.y[base + index]));
    world.bodyCenterX[body] = centerX;
    world.bodyCenterY[body] = centerY;
    world.bodyExtent[body] = extent;
  }
}

function simulate(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const dt = Math.min(state.deltaSeconds, 1 / 30);
  if (dt <= 0) return;
  world.gridBuilds = 0;
  world.gpuUploadFloats = 0;
  runDemo(state, world, dt);
  if (world.floorOpenTimer > 0) world.floorOpenTimer = Math.max(0, world.floorOpenTimer - dt);
  removeOffscreenBodies(state, world);
  if (world.pointer.down && !world.pointer.dragging && !world.pointer.drawing && !world.pointer.building) {
    world.pointer.spawnAccumulator += dt * 10;
    while (world.pointer.spawnAccumulator >= 1) {
      spawnAtPointer(state, world, world.pointer.x + randomRange(-16, 16), world.pointer.y + randomRange(-16, 16));
      world.pointer.spawnAccumulator -= 1;
    }
  }
  updateGridShape(state, world);
  const substeps = Math.max(1, Math.floor(settingsNumber(state, 'substeps', 2, 1, 5)));
  const passes = Math.max(2, Math.floor(settingsNumber(state, 'constraintPasses', 7, 2, 14)));
  const step = dt / substeps;
  for (let substep = 0; substep < substeps; substep += 1) {
    integrate(state, world, step);
    applyPointerForces(state, world);
    for (let pass = 0; pass < passes; pass += 1) {
      solveWalls(state, world);
      solveBodyStructure(state, world);
      buildGrid(world);
      solveContacts(state, world);
    }
    solveWalls(state, world);
    applyPlasticity(state, world, step);
    settleContactVelocities(state, world);
    applyViscosity(state, world);
  }
  updateCenters(world);
  world.pointer.lastX = world.pointer.x;
  world.pointer.lastY = world.pointer.y;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function pushSkinVertex(world: SoftBlobWorld, offset: number, x: number, y: number, alpha: number, mix: number, edge: number): void {
  world.skinVertices[offset] = x;
  world.skinVertices[offset + 1] = y;
  world.skinVertices[offset + 2] = alpha;
  world.skinVertices[offset + 3] = mix;
  world.skinVertices[offset + 4] = edge;
}

function buildSkinMesh(state: RawWebGL2RenderState, world: SoftBlobWorld): { vertices: number; indices: number } {
  const contourX = world.contourX;
  const contourY = world.contourY;
  const smoothing = settingsNumber(state, 'skinSmoothing', 0.46, 0, 0.85);
  let vertexCount = 0;
  let indexCount = 0;
  for (let body = 0; body < world.bodyCount; body += 1) {
    const base = world.bodyBase[body];
    const boundaryCount = world.bodyBoundaryCount[body];
    const contourCount = boundaryCount * SKIN_SUBDIVISIONS;
    let centerX = 0;
    let centerY = 0;
    for (let index = 0; index < boundaryCount; index += 1) {
      centerX += world.x[base + index];
      centerY += world.y[base + index];
    }
    centerX /= boundaryCount;
    centerY /= boundaryCount;
    let cursor = 0;
    const membraneOffset = Math.max(2.2, world.radius[base] * 1.02);
    for (let index = 0; index < boundaryCount; index += 1) {
      const p0 = base + ((index + boundaryCount - 1) % boundaryCount);
      const p1 = base + index;
      const p2 = base + ((index + 1) % boundaryCount);
      const p3 = base + ((index + 2) % boundaryCount);
      for (let sub = 0; sub < SKIN_SUBDIVISIONS; sub += 1) {
        const t = sub / SKIN_SUBDIVISIONS;
        const linearX = world.x[p1] + (world.x[p2] - world.x[p1]) * t;
        const linearY = world.y[p1] + (world.y[p2] - world.y[p1]) * t;
        const curveX = catmull(world.x[p0], world.x[p1], world.x[p2], world.x[p3], t);
        const curveY = catmull(world.y[p0], world.y[p1], world.y[p2], world.y[p3], t);
        let skinX = linearX + (curveX - linearX) * smoothing;
        let skinY = linearY + (curveY - linearY) * smoothing;
        let normalX = skinX - centerX;
        let normalY = skinY - centerY;
        const invLength = 1 / Math.sqrt(normalX * normalX + normalY * normalY + EPSILON);
        normalX *= invLength;
        normalY *= invLength;
        skinX += normalX * membraneOffset;
        skinY += normalY * membraneOffset;
        contourX[cursor] = skinX;
        contourY[cursor] = skinY;
        cursor += 1;
      }
    }

    const start = vertexCount;
        const fillAlpha = 1;
    const rimAlpha = 1;
    const feather = 0;
    pushSkinVertex(world, vertexCount * SKIN_FLOATS, centerX, centerY, fillAlpha, world.bodyColorIndex[body], 0);
    vertexCount += 1;

    for (let index = 0; index < contourCount; index += 1) {
      let normalX = contourX[index] - centerX;
      let normalY = contourY[index] - centerY;
      const invLength = 1 / Math.sqrt(normalX * normalX + normalY * normalY + EPSILON);
      normalX *= invLength;
      normalY *= invLength;
      pushSkinVertex(world, vertexCount * SKIN_FLOATS, contourX[index], contourY[index], rimAlpha, world.bodyColorIndex[body], 0.25);
      vertexCount += 1;
      pushSkinVertex(world, vertexCount * SKIN_FLOATS, contourX[index] + normalX * feather, contourY[index] + normalY * feather, 0, world.bodyColorIndex[body], 1);
      vertexCount += 1;
    }

    for (let index = 0; index < contourCount; index += 1) {
      const next = (index + 1) % contourCount;
      const inner = start + 1 + index * 2;
      const outer = inner + 1;
      const nextInner = start + 1 + next * 2;
      const nextOuter = nextInner + 1;
      world.skinIndices[indexCount] = start;
      world.skinIndices[indexCount + 1] = inner;
      world.skinIndices[indexCount + 2] = nextInner;
      world.skinIndices[indexCount + 3] = inner;
      world.skinIndices[indexCount + 4] = outer;
      world.skinIndices[indexCount + 5] = nextOuter;
      world.skinIndices[indexCount + 6] = inner;
      world.skinIndices[indexCount + 7] = nextOuter;
      world.skinIndices[indexCount + 8] = nextInner;
      indexCount += 9;
    }
  }
  return { vertices: vertexCount, indices: indexCount };
}

function renderOverlay(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const overlay = world.overlay;
  const context = world.overlayContext;
  if (!overlay || !context) return;
  if (overlay.width !== state.width || overlay.height !== state.height) {
    overlay.width = state.width;
    overlay.height = state.height;
  }
  context.clearRect(0, 0, overlay.width, overlay.height);
  if (world.pointer.dragging) {
    const radius = settingsNumber(state, 'interactionRadius', 72, 16, 280);
    context.fillStyle = 'rgba(125, 249, 255, 0.14)';
    context.beginPath();
    context.arc(world.pointer.x, world.pointer.y, radius, 0, TWO_PI);
    context.fill();
  }
  if ((world.pointer.drawing || world.pointer.building) && world.pointer.drawPoints.length > 1) {
    const previewPoints = world.pointer.building
      ? [world.pointer.drawPoints[0], world.pointer.drawPoints[world.pointer.drawPoints.length - 1]]
      : world.pointer.drawPoints;
    context.strokeStyle = world.pointer.building ? 'rgba(148, 148, 148, 0.82)' : 'rgba(255, 255, 255, 0.72)';
    context.lineWidth = Math.max(2, state.width * 0.002);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(previewPoints[0].x, previewPoints[0].y);
    for (let index = 1; index < previewPoints.length; index += 1) {
      const point = previewPoints[index];
      context.lineTo(point.x, point.y);
    }
    if (world.pointer.drawing && world.pointer.drawPoints.length > 8) context.closePath();
    context.stroke();
  }
}

function updatePalette(state: RawWebGL2RenderState, world: SoftBlobWorld): void {
  const colors = state.style?.palette ?? [];
  const fallbackColors: Array<[number, number, number]> = [
    [1, 0.44, 0.68],
    [0.49, 0.98, 1],
    [1, 0.82, 0.4],
    [0.72, 1, 0.42],
  ];
  for (let index = 0; index < 4; index += 1) {
    const color = colorNumberToRgb(colors[index], fallbackColors[index]);
    const offset = index * 3;
    world.paletteData[offset] = color[0];
    world.paletteData[offset + 1] = color[1];
    world.paletteData[offset + 2] = color[2];
  }
  const background = colorNumberToRgb(state.style?.background, [0.04, 0.02, 0.07]);
  world.backgroundData[0] = background[0];
  world.backgroundData[1] = background[1];
  world.backgroundData[2] = background[2];
}

function setPaletteUniforms(gl: WebGL2RenderingContext, uniforms: SoftBlobProgramUniforms, colors: Float32Array): void {
  for (let index = 0; index < 4; index += 1) {
    const offset = index * 3;
    gl.uniform3f(uniforms.palette[index] ?? null, colors[offset], colors[offset + 1], colors[offset + 2]);
  }
}

function ensureDensityTarget(state: RawWebGL2RenderState, world: SoftBlobWorld): boolean {
  const gl = state.gl;
  const width = Math.max(1, state.width | 0);
  const height = Math.max(1, state.height | 0);
  if (world.densityWidth === width && world.densityHeight === height) return true;
  world.densityWidth = width;
  world.densityHeight = height;
  gl.bindTexture(gl.TEXTURE_2D, world.densityTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, world.densityFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, world.densityTexture, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return complete;
}

function renderDensitySkin(state: RawWebGL2RenderState, world: SoftBlobWorld, instanceCount: number): boolean {
  if (instanceCount <= 0 || !ensureDensityTarget(state, world)) return false;
  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, world.densityFramebuffer);
  gl.viewport(0, 0, world.densityWidth, world.densityHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(world.programs.density);
  gl.uniform2f(world.uDensityResolution, state.width, state.height);
  gl.uniform1f(world.uDensityFieldScale, SOFT_BLOB_METABALL_FIELD_SCALE);
  gl.bindVertexArray(world.buffers.densityVao);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.useProgram(world.programs.densityComposite);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, world.densityTexture);
  gl.uniform1i(world.uDensityCompositeTexture, 0);
  gl.uniform2f(world.uDensityCompositeResolution, world.densityWidth, world.densityHeight);
  gl.uniform3f(world.uDensityCompositePalette0, world.paletteData[0], world.paletteData[1], world.paletteData[2]);
  gl.uniform3f(world.uDensityCompositePalette1, world.paletteData[3], world.paletteData[4], world.paletteData[5]);
  gl.uniform1f(world.uDensityCompositeThreshold, SOFT_BLOB_METABALL_THRESHOLD);
  gl.bindVertexArray(world.buffers.compositeVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindVertexArray(null);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

function renderScene(state: RawWebGL2RenderState): void {
  const runtime = state as SoftBlobRuntime;
  const world = runtime.blob;
  if (!world) return;
  simulate(state, world);
  updateGpuCandidateBridge(state, world);
  const gl = state.gl;
  updatePalette(state, world);
  gl.viewport(0, 0, state.width, state.height);
  gl.clearColor(world.backgroundData[0], world.backgroundData[1], world.backgroundData[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const style = String(state.settings.renderStyle ?? 'basic');
  const useMetaballSkin = style === 'metaball';
  let enhancedFixedStart = 0;
  let enhancedFixedCount = 0;
  if (style === 'enhanced' || useMetaballSkin) {
    world.skinVertexCount = 0;
    world.skinIndexCount = 0;
    let densityCount = 0;
    for (let particle = 0; particle < world.particleCount; particle += 1) {
      if (world.fixed[particle]) {
        const offset = (world.particleCount - 1 - enhancedFixedCount) * 4;
        world.circleInstances[offset] = world.x[particle];
        world.circleInstances[offset + 1] = world.y[particle];
        world.circleInstances[offset + 2] = world.radius[particle];
        world.circleInstances[offset + 3] = 4;
        enhancedFixedCount += 1;
        continue;
      }
      if (!useMetaballSkin) continue;
      const offset = densityCount * 4;
      const body = world.bodyOf[particle];
      const local = particle - world.bodyBase[body];
      const isBoundary = local >= 0 && local < world.bodyBoundaryCount[body];
      world.circleInstances[offset] = world.x[particle];
      world.circleInstances[offset + 1] = world.y[particle];
      world.circleInstances[offset + 2] = world.radius[particle] * (isBoundary ? SOFT_BLOB_METABALL_BOUNDARY_RADIUS_SCALE : SOFT_BLOB_METABALL_INTERIOR_RADIUS_SCALE);
      world.circleInstances[offset + 3] = world.bodyColorIndex[body];
      densityCount += 1;
    }
    const densityRendered = useMetaballSkin && densityCount > 0;
    if (densityRendered) {
      gl.bindBuffer(gl.ARRAY_BUFFER, world.buffers.circleVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, world.circleInstances, 0, densityCount * 4);
      world.gpuUploadFloats += densityCount * 4;
    }
    if (!useMetaballSkin || !densityRendered || !renderDensitySkin(state, world, densityCount)) {
      const mesh = buildSkinMesh(state, world);
      world.skinVertexCount = mesh.vertices;
      world.skinIndexCount = mesh.indices;
      if (mesh.indices > 0) {
        gl.disable(gl.BLEND);
        gl.useProgram(world.programs.skin);
        gl.uniform2f(world.uniforms.skin.resolution, state.width, state.height);
        setPaletteUniforms(gl, world.uniforms.skin, world.paletteData);
        gl.bindVertexArray(world.buffers.skinVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, world.buffers.skinVbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, world.skinVertices, 0, mesh.vertices * SKIN_FLOATS);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, world.buffers.skinIbo);
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, world.skinIndices, 0, mesh.indices);
        world.gpuUploadFloats += mesh.vertices * SKIN_FLOATS + mesh.indices;
        gl.drawElements(gl.TRIANGLES, mesh.indices, gl.UNSIGNED_INT, 0);
      }
    }
    enhancedFixedStart = world.particleCount - enhancedFixedCount;
  } else {
    world.skinVertexCount = 0;
    world.skinIndexCount = 0;
  }

  if (world.particleCount > 0) {
    let renderCount = style === 'enhanced' || useMetaballSkin ? enhancedFixedCount : 0;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (style !== 'enhanced' && !useMetaballSkin) {
      for (let particle = 0; particle < world.particleCount; particle += 1) {
        const offset = renderCount * 4;
        world.circleInstances[offset] = world.x[particle];
        world.circleInstances[offset + 1] = world.y[particle];
        world.circleInstances[offset + 2] = world.radius[particle];
        world.circleInstances[offset + 3] = world.fixed[particle] ? 4 : world.bodyColorIndex[world.bodyOf[particle]];
        renderCount += 1;
      }
    }
    world.circleRenderCount = renderCount;
    if (renderCount > 0) {
      gl.useProgram(world.programs.circle);
      gl.uniform2f(world.uniforms.circle.resolution, state.width, state.height);
      setPaletteUniforms(gl, world.uniforms.circle, world.paletteData);
      gl.bindVertexArray(world.buffers.circleVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, world.buffers.circleVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, world.circleInstances, enhancedFixedStart * 4, renderCount * 4);
      world.gpuUploadFloats += renderCount * 4;
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, renderCount);
    }
  } else {
    world.circleRenderCount = 0;
  }
  gl.bindVertexArray(null);
  renderOverlay(state, world);
}

function destroyWorld(state: RawWebGL2RenderState): void {
  const runtime = state as SoftBlobRuntime;
  const world = runtime.blob;
  if (!world) return;
  destroyGpuCandidateBridge(world);
  for (const cleanup of world.cleanup) cleanup();
  const gl = state.gl;
  gl.deleteProgram(world.programs.skin);
  gl.deleteProgram(world.programs.circle);
  gl.deleteProgram(world.programs.density);
  gl.deleteProgram(world.programs.densityComposite);
  gl.deleteVertexArray(world.buffers.skinVao);
  gl.deleteVertexArray(world.buffers.circleVao);
  gl.deleteVertexArray(world.buffers.densityVao);
  gl.deleteVertexArray(world.buffers.compositeVao);
  gl.deleteBuffer(world.buffers.skinVbo);
  gl.deleteBuffer(world.buffers.skinIbo);
  gl.deleteBuffer(world.buffers.quadVbo);
  gl.deleteBuffer(world.buffers.circleVbo);
  gl.deleteBuffer(world.buffers.compositeVbo);
  gl.deleteTexture(world.densityTexture);
  gl.deleteFramebuffer(world.densityFramebuffer);
  runtime.blob = undefined;
}

export class ViscousSoftBodyBlobScene extends RawWebGL2Scene {
  constructor(preview = false) {
    super({
      name: preview ? 'Soft-Body Blobs Preview' : 'Soft-Body Blobs',
      markup: MARKUP,
      canvasSelector: '[data-soft-body-blob-canvas]',
      webglOptions: { antialias: true, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' },
      maxDevicePixelRatio: preview ? 1.25 : 2,
      onInit: (state) => {
        const runtime = state as SoftBlobRuntime;
        runtime.blob = createWorld(state, preview);
        state.mode = preview ? 'demo' : 'draw';
        if (preview) {
          state.settings = {
            ...state.settings,
            renderStyle: 'enhanced',
            blobSize: 28,
            nodeDensity: 0.74,
            gravity: 1700,
            viscosity: 0.58,
            surfaceTension: 0,
            plasticFlow: 0.62,
            skinSmoothing: 0.72,
            substeps: 2,
            constraintPasses: 2,
            squishiness: 2,
          };
        }
      },
      onReset: (state) => {
        const world = (state as SoftBlobRuntime).blob;
        if (world) clearWorld(world);
      },
      render: renderScene,
      getDebugStats: (state) => {
        const world = (state as SoftBlobRuntime).blob;
        if (!world) return null;
        const gridKeyStats = world.gpuCandidateGridKeyStats;
        const candidateStats = world.gpuCandidateSlotStats;
        const occupancyStats = world.gpuCandidateOccupancyStats;
        const cellOffsetStats = world.gpuCandidateCellOffsetStats;
        const cellRangeStats = world.gpuCandidateCellRangeStats;
        const cellRangeBridgeStats = world.gpuCandidateCellRangeBridge?.stats();
        const cellKeyStats = world.gpuCandidateCellKeyStats;
        const keySortStats = world.gpuCandidateKeySortStats;
        const sortedKeyGatherStats = world.gpuCandidateSortedKeyGatherStats;
        const sortedKeyRangeStats = world.gpuCandidateSortedKeyRangeStats;
        const residentListStats = world.gpuCandidateResidentListStats;
        const residentListCandidateStats = world.gpuResidentListCandidateStats;
        const indexMapStats = world.gpuCandidateIndexMapBridge?.stats();
        const indexMapGatherStats = world.gpuCandidateIndexMapGather?.stats();
        const candidateUploadState = world.gpuCandidateUploadMode === 'gpu-sorted-key-gather'
          ? world.gpuCandidateSourceState
          : world.gpuCandidateState;
        const gpuCandidateCollisionAllSlotsConsumed = world.gpuCandidateCollisionStressActive && world.gpuCandidateCollisionIgnoredSlots === 0;
        const gpuCandidateViscosityAllSlotsConsumed = world.gpuCandidateViscosityStressActive && world.gpuCandidateViscosityIgnoredSlots === 0;
        const gpuCandidatePressureAllSlotsConsumed = world.gpuCandidatePressureStressActive && world.gpuCandidatePressureIgnoredSlots === 0;
        const gpuCandidateGatherBackComplete =
          world.gpuCandidateIndexMapGatherActive &&
          indexMapGatherStats?.destinationOrder === 'original-index' &&
          indexMapGatherStats.suitableForOriginalOrderFeedback === true;
        const gpuCandidateFeedbackReady =
          gpuCandidateGatherBackComplete &&
          gpuCandidateCollisionAllSlotsConsumed &&
          gpuCandidateViscosityAllSlotsConsumed &&
          gpuCandidatePressureAllSlotsConsumed &&
          world.gpuCandidateUploadMode === 'gpu-sorted-key-gather';
        const gpuCandidateAuthoritativeReady = false;
        const gpuCandidateAuthoritativeBlocker = world.gpuCandidateUploadMode !== 'gpu-sorted-key-gather'
          ? 'sorted-state-still-cpu-uploaded'
          : world.gpuCandidateStressSource === 'gpu-resident-list'
            ? 'resident-list-original-order-stress-not-yet-feedback-owned'
            : gpuCandidateGatherBackComplete !== true
              ? 'original-order-gather-not-complete'
              : gpuCandidateCollisionAllSlotsConsumed !== true
                ? 'collision-slots-not-fully-consumed'
                : gpuCandidateViscosityAllSlotsConsumed !== true
                  ? 'viscosity-slots-not-fully-consumed'
                  : gpuCandidatePressureAllSlotsConsumed !== true
                    ? 'pressure-slots-not-fully-consumed'
                    : world.gpuCandidateCollisionSpatiallyComplete !== true
                      ? 'gpu-broadphase-not-spatially-complete'
                      : 'body-area-and-skin-model-still-cpu-owned';
        return {
          renderer: 'raw-webgl2-viscous-soft-bodies',
          simulation: 'cpu-viscous-soft-body',
          rendering: String(state.settings.renderStyle ?? 'basic') === 'metaball'
            ? 'gpu-density-metaball-composite'
            : String(state.settings.renderStyle ?? 'basic') === 'enhanced'
              ? 'gpu-boundary-skin-mesh'
              : 'gpu-instanced-circles',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: true,
          collisionBroadphase: 'cpu-grid-cell-pairs',
          collisionBroadphaseOwner: 'cpu',
          gpuBroadphaseMigrationTarget: 'RawGpuConstraintParticleCellRangeBridge',
          gpuBroadphaseReusableFor: 'ball-pit-snakes-soft-bodies',
          gpuCandidateTelemetrySampled: world.gpuCandidateTelemetrySampled,
          gpuCandidateStressSource: world.gpuCandidateStressSource,
          gpuCandidateResidentListStressReady: world.gpuCandidateResidentListStressReady,
          gpuCandidateTelemetryFrame: world.gpuCandidateTelemetryFrame,
          gpuCandidateTelemetryStaleSeconds: Math.round(world.gpuCandidateTelemetryStaleSeconds * 1000) / 1000,
          gpuCandidateStateOrder: world.gpuCandidateUploadMode === 'gpu-sorted-key-gather' ? 'gpu-sorted-key-gather' : 'cpu-sorted-cell-range-bridge',
          gpuCandidateActiveRows: candidateUploadState?.particleActiveRows() ?? 0,
          gpuCandidateUploadedRows: candidateUploadState?.particleUploadedRows() ?? 0,
          gpuCandidateReservedRows: candidateUploadState?.particleReservedRows() ?? 0,
          gpuCandidateActiveCapacityRatio: (world.gpuCandidateState?.capacity ?? 0) > 0
            ? Math.round((world.particleCount / Math.max(1, world.gpuCandidateState?.capacity ?? 1)) * 10000) /
              10000
            : 0,
          gpuCandidateUploadFloats: world.gpuCandidateUploadFloats,
          gpuCandidateUploadMode: world.gpuCandidateUploadMode ?? 'none',
          gpuCandidateCellRangeUploadFloats: world.gpuCandidateCellRangeUploadFloats,
          gpuCandidateCellRangeBridgeActiveRows: cellRangeBridgeStats?.activeRows ?? 0,
          gpuCandidateCellRangeBridgeUploadedRows: cellRangeBridgeStats?.uploadedRows ?? 0,
          gpuCandidateCellRangeBridgeReservedRows: cellRangeBridgeStats?.reservedRows ?? 0,
          gpuCandidateCellRangeBridgeUploadRowStart: cellRangeBridgeStats?.uploadRowStart ?? 0,
          gpuCandidateCellRangeBridgeActiveCellStart: cellRangeBridgeStats?.activeCellStart ?? 0,
          gpuCandidateCellRangeBridgeActiveCellCount: cellRangeBridgeStats?.activeCellCount ?? 0,
          gpuCandidateOccupancyActive: occupancyStats?.gpuOwnedOccupancy ?? false,
          gpuCandidateOccupancyPointDraws: occupancyStats?.pointDraws ?? 0,
          gpuCandidateOccupancyFragmentCells: occupancyStats?.fragmentCells ?? 0,
          gpuCandidateOccupancyColumns: occupancyStats?.gridColumns ?? 0,
          gpuCandidateOccupancyRows: occupancyStats?.gridRows ?? 0,
          gpuCandidateOccupancyAdditiveBlend: occupancyStats?.additiveBlend ?? false,
          gpuCandidateOccupancyProducesCellRanges: occupancyStats?.producesCellRanges ?? false,
          gpuCandidateOccupancyAuthoritativeReady: occupancyStats?.suitableForAuthoritativeBroadphase ?? false,
          gpuCandidateOccupancyRequiredReplacement: occupancyStats?.requiredReplacement ?? 'gpu-prefix-sum-or-sort-scatter',
          gpuCandidateCellOffsetActive: cellOffsetStats?.gpuOwnedCellOffsets ?? false,
          gpuCandidateCellOffsetPrefixPasses: cellOffsetStats?.prefixPasses ?? 0,
          gpuCandidateCellOffsetFragmentTexels: cellOffsetStats?.fragmentTexels ?? 0,
          gpuCandidateCellOffsetCells: cellOffsetStats?.cellCount ?? 0,
          gpuCandidateCellOffsetScatterReady: cellOffsetStats?.suitableForScatterOffsets ?? false,
          gpuCandidateCellOffsetRequiredNextStep: cellOffsetStats?.requiredNextStep ?? 'particle-cell-scatter',
          gpuCandidateCellRangeGpuOwned: cellRangeStats?.gpuOwnedCellRanges ?? false,
          gpuCandidateCellRangeFragmentTexels: cellRangeStats?.fragmentTexels ?? 0,
          gpuCandidateCellRangeSortedStateRequired: cellRangeStats?.sortedStateRequired ?? true,
          gpuCandidateCellRangeResidentLists: cellRangeStats?.producesResidentLists ?? false,
          gpuCandidateCellRangeRequiredNextStep: cellRangeStats?.requiredNextStep ?? 'particle-cell-scatter',
          gpuCandidateCellKeyActive: cellKeyStats?.gpuOwnedCellKeys ?? false,
          gpuCandidateCellKeyFragmentTexels: cellKeyStats?.fragmentTexels ?? 0,
          gpuCandidateCellKeyParticles: cellKeyStats?.activeParticleCount ?? 0,
          gpuCandidateCellKeySuitableForSort: cellKeyStats?.suitableForGpuSort ?? false,
          gpuCandidateKeySortActive: keySortStats?.gpuSorted ?? false,
          gpuCandidateKeySortAlgorithm: keySortStats?.sortAlgorithm ?? 'bitonic-texture',
          gpuCandidateKeySortCapacity: keySortStats?.sortCapacity ?? 0,
          gpuCandidateKeySortPasses: keySortStats?.passCount ?? 0,
          gpuCandidateKeySortFragmentTexels: keySortStats?.fragmentTexels ?? 0,
          gpuCandidateKeySortRangeReady: keySortStats?.suitableForCellRangeDerivation ?? false,
          gpuCandidateSortedKeyRangeActive: sortedKeyRangeStats?.gpuDerivedCellRanges ?? false,
          gpuCandidateSortedKeyRangeFragmentTexels: sortedKeyRangeStats?.fragmentTexels ?? 0,
          gpuCandidateSortedKeyRangeBinarySearchSteps: sortedKeyRangeStats?.binarySearchSteps ?? 0,
          gpuCandidateSortedKeyRangeCells: sortedKeyRangeStats?.cellCount ?? 0,
          gpuCandidateSortedKeyRangeSuitableForCandidateBridge: sortedKeyRangeStats?.suitableForSortedCandidateBridge ?? false,
          gpuCandidateSortedKeyRangeRequiredNextStep: sortedKeyRangeStats?.requiredNextStep ?? 'sorted-state-gather-or-scatter',
          gpuCandidateSortedKeyGatherActive: sortedKeyGatherStats?.gpuGatheredSortedState ?? false,
          gpuCandidateSortedKeyGatherFragmentTexels: sortedKeyGatherStats?.fragmentTexels ?? 0,
          gpuCandidateSortedKeyGatherAttributeFragmentTexels: sortedKeyGatherStats?.attributeFragmentTexels ?? 0,
          gpuCandidateSortedKeyGatherAttributesActive: sortedKeyGatherStats?.gpuGatheredSortedAttributes ?? false,
          gpuCandidateSortedKeyGatherRows: sortedKeyGatherStats?.activeRows ?? 0,
          gpuCandidateSortedKeyGatherOutputOrder: sortedKeyGatherStats?.outputOrder ?? 'sorted-cell-key',
          gpuCandidateIndexMapUploadFloats: world.gpuCandidateIndexMapUploadFloats,
          gpuCandidateIndexMapActiveRows: indexMapStats?.activeRows ?? 0,
          gpuCandidateIndexMapUploadedRows: indexMapStats?.uploadedRows ?? 0,
          gpuCandidateIndexMapReservedRows: indexMapStats?.reservedRows ?? 0,
          gpuCandidateBodyMetadataUploadFloats: world.gpuCandidateBodyMetadataUploadFloats,
          gpuCandidateIndexMapGatherReady: world.gpuCandidateIndexMapGather != null && world.gpuCandidateIndexMapGatherState != null,
          gpuCandidateIndexMapGatherActive: world.gpuCandidateIndexMapGatherActive,
          gpuCandidateIndexMapGatherFragmentTexels: world.gpuCandidateIndexMapGatherFragmentTexels,
          gpuCandidateIndexMapGatherRows: indexMapGatherStats?.activeRows ?? 0,
          gpuCandidateIndexMapGatherSourceOrder: indexMapGatherStats?.sourceOrder ?? 'sorted-cell-key',
          gpuCandidateIndexMapGatherDestinationOrder: indexMapGatherStats?.destinationOrder ?? 'original-index',
          gpuCandidateIndexMapGatherPreservesPositionVelocity: indexMapGatherStats?.gathersPositionVelocity ?? false,
          gpuCandidateIndexMapGatherPreservesAttributes: indexMapGatherStats?.gathersAttributes ?? false,
          gpuCandidateGatherBackComplete,
          gpuCandidateFeedbackReady,
          gpuCandidateAuthoritativeReady,
          gpuCandidateAuthoritativeBlocker,
          gpuCandidateCollisionStressActive: world.gpuCandidateCollisionStressActive,
          gpuCandidateCollisionBatches: world.gpuCandidateCollisionBatches,
          gpuCandidateCollisionFragmentTexels: world.gpuCandidateCollisionFragmentTexels,
          gpuCandidateCollisionConsumedSlots: world.gpuCandidateCollisionConsumedSlots,
          gpuCandidateCollisionIgnoredSlots: world.gpuCandidateCollisionIgnoredSlots,
          gpuCandidateCollisionAllSlotsConsumed,
          gpuCandidateCollisionSpatiallyComplete: world.gpuCandidateCollisionSpatiallyComplete,
          gpuCandidateViscosityStressActive: world.gpuCandidateViscosityStressActive,
          gpuCandidateViscosityBatches: world.gpuCandidateViscosityBatches,
          gpuCandidateViscosityFragmentTexels: world.gpuCandidateViscosityFragmentTexels,
          gpuCandidateViscosityConsumedSlots: world.gpuCandidateViscosityConsumedSlots,
          gpuCandidateViscosityIgnoredSlots: world.gpuCandidateViscosityIgnoredSlots,
          gpuCandidateViscosityAllSlotsConsumed,
          gpuCandidatePressureStressActive: world.gpuCandidatePressureStressActive,
          gpuCandidatePressureBatches: world.gpuCandidatePressureBatches,
          gpuCandidatePressureFragmentTexels: world.gpuCandidatePressureFragmentTexels,
          gpuCandidatePressureConsumedSlots: world.gpuCandidatePressureConsumedSlots,
          gpuCandidatePressureIgnoredSlots: world.gpuCandidatePressureIgnoredSlots,
          gpuCandidatePressureAllSlotsConsumed,
          gpuCandidateBodyShapeStressActive: world.gpuCandidateBodyShapeStressActive,
          gpuCandidateBodyShapeFragmentTexels: world.gpuCandidateBodyShapeFragmentTexels,
          gpuCandidateMaxCellOccupancy: world.gpuCandidateMaxCellOccupancy,
          gpuCandidateCellSize: Math.round(world.gpuCandidateCellSize * 100) / 100,
          gpuCandidateCellColumns: world.gpuCandidateCellColumns,
          gpuCandidateCellRows: world.gpuCandidateCellRows,
          gpuGridKeyActive: (gridKeyStats?.fragmentTexels ?? 0) > 0,
          gpuGridKeyParticleCount: gridKeyStats?.activeParticleCount ?? 0,
          gpuGridKeyFragmentTexels: gridKeyStats?.fragmentTexels ?? 0,
          gpuCandidateSlotsActive: (candidateStats?.fragmentTexels ?? 0) > 0,
          gpuCandidateSlotCount: candidateStats?.slotCount ?? 0,
          gpuCandidateSamples: candidateStats?.candidateSamples ?? 0,
          gpuCandidateFragmentTexels: candidateStats?.fragmentTexels ?? 0,
          gpuCandidateBroadphase: candidateStats?.broadphase ?? 'gpu-sorted-cell-ranges',
          gpuCandidateBroadphaseOwner: candidateStats?.broadphaseOwner ?? 'hybrid',
          gpuCandidateSpatiallyComplete: candidateStats?.spatiallyComplete ?? false,
          gpuCandidateCoverage: candidateStats?.coverage ?? 'bounded-world-cell-residents',
          gpuCandidateLimitation: candidateStats?.limitation ?? 'requires-sorted-particle-state-and-cell-ranges',
          gpuCandidateRequiredReplacement: candidateStats?.requiredReplacement ?? 'gpu-owned-sort-or-cell-scatter',
          gpuCandidateSuitableForAuthoritativeCollision: candidateStats?.suitableForAuthoritativeCollision ?? false,
          gpuCandidateResidentListActive: residentListStats?.gpuDerivedResidentLists ?? false,
          gpuCandidateResidentListWidth: residentListStats?.width ?? 0,
          gpuCandidateResidentListHeight: residentListStats?.height ?? 0,
          gpuCandidateResidentListFragmentTexels: residentListStats?.fragmentTexels ?? 0,
          gpuCandidateResidentListResidentLimit: residentListStats?.residentLimit ?? 0,
          gpuCandidateResidentListMaxCellOccupancy: residentListStats?.maxCellOccupancy ?? 0,
          gpuCandidateResidentListAuthoritativeReady: residentListStats?.suitableForAuthoritativeUnsortedBroadphase ?? false,
          gpuResidentListCandidateActive: (residentListCandidateStats?.fragmentTexels ?? 0) > 0,
          gpuResidentListCandidateSlotCount: residentListCandidateStats?.slotCount ?? 0,
          gpuResidentListCandidateSamples: residentListCandidateStats?.candidateSamples ?? 0,
          gpuResidentListCandidateFragmentTexels: residentListCandidateStats?.fragmentTexels ?? 0,
          gpuResidentListCandidateBroadphase: residentListCandidateStats?.broadphase ?? 'gpu-resident-list',
          gpuResidentListCandidateBroadphaseOwner: residentListCandidateStats?.broadphaseOwner ?? 'gpu',
          gpuResidentListCandidateIndexOrder: residentListCandidateStats?.indexOrder ?? 'original-index',
          gpuResidentListCandidateSpatiallyComplete: residentListCandidateStats?.spatiallyComplete ?? false,
          gpuResidentListCandidateCoverage: residentListCandidateStats?.coverage ?? 'bounded-world-cell-residents',
          gpuResidentListCandidateSuitableForAuthoritativeCollision: residentListCandidateStats?.suitableForAuthoritativeCollision ?? false,
          bodies: world.bodyCount,
          particles: world.particleCount,
          contacts: world.contactCount,
          pairs: world.pairChecks,
          gridBuilds: world.gridBuilds,
          grid: `${world.gridWidth}x${world.gridHeight}`,
          cellSize: Math.round(world.gridCellSize * 100) / 100,
          skinVertices: world.skinVertexCount,
          skinIndices: world.skinIndexCount,
          renderedCircles: world.circleRenderCount,
          skinVertexCapacity: MAX_SKIN_VERTICES,
          skinIndexCapacity: MAX_SKIN_INDICES,
          gpuUploadFloats: world.gpuUploadFloats,
        };
      },
      onDestroy: destroyWorld,
    });
  }
}
