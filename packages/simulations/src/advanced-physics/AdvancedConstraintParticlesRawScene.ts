import {
  AdvancedCircleParticleEngine,
  RawGpuConstraintParticleBodyMetadataBridge,
  RawGpuConstraintParticleBodyShapePass,
  RawGpuConstraintParticleCellOffsetPass,
  RawGpuConstraintParticleCellOccupancyPass,
  RawGpuConstraintParticleCellRangeFromOffsetsPass,
  RawGpuConstraintParticleCellKeyPass,
  RawGpuConstraintParticleSortedKeyGatherPass,
  RawGpuConstraintParticleSortedKeyRangePass,
  RawGpuConstraintParticleCandidateSlotPass,
  RawGpuConstraintParticleCellRangeBridge,
  RawGpuConstraintParticleCircleCollisionPass,
  RawGpuConstraintParticleDensityRenderer,
  RawGpuConstraintParticleGridKeyPass,
  RawGpuConstraintParticleIndexMapBridge,
  RawGpuConstraintParticleIndexMapGatherPass,
  RawGpuConstraintParticleJacobiPass,
  RawGpuConstraintParticleNeighborSlots,
  RawGpuConstraintParticlePressurePass,
  RawGpuConstraintParticleResidentListCandidatePass,
  RawGpuConstraintParticleResidentListFromSortedKeysPass,
  RawGpuConstraintParticleSortedCellCandidatePass,
  RawGpuConstraintParticleState,
  RawGpuConstraintParticleStepPass,
  RawGpuKeyIndexSortPass,
  RawWebGL2Scene,
  finiteNumberSetting,
  rawGpuMetricsToDebugStats,
  resolveAdvancedPhysicsFidelityProfile,
  type AdvancedCircleParticleSettings,
  type AdvancedCircleParticleSpatialNeighborSlotStats,
  type AdvancedCircleParticleStats,
  type RawGpuConstraintParticleCandidateSlotStats,
  type RawGpuConstraintParticleCellOffsetStats,
  type RawGpuConstraintParticleCellOccupancyStats,
  type RawGpuConstraintParticleCellRangeFromOffsetsStats,
  type RawGpuConstraintParticleCellKeyStats,
  type RawGpuConstraintParticleSortedKeyGatherStats,
  type RawGpuConstraintParticleSortedKeyRangeStats,
  type RawGpuConstraintParticleGridKeyStats,
  type RawGpuConstraintParticleResidentListCandidateStats,
  type RawGpuConstraintParticleResidentListFromSortedKeysStats,
  type RawGpuConstraintParticleSortedCellCandidateStats,
  type RawGpuKeyIndexSortStats,
  type RawWebGL2RenderState,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';
import { BUILD_MODE_ID, sampleBuildFixture } from '../shared/build-mode.js';
import {
  createRawLiquidSurfaceRenderer,
  destroyRawLiquidSurfaceRenderer,
  liquidSurfaceOptionsFromSettings,
  renderLiquidSurfaceFromBufferParticles,
  type RawLiquidSurfaceRenderer,
} from '../shared/RawLiquidSurfaceRenderer.js';

type ConstraintDemoKind = 'chain-rain' | 'soft-blob';
type ConstraintGpuCollisionSource = 'cpu-spatial-neighbor-slots' | 'gpu-resident-list';
type ConstraintGpuStepSource = 'none' | 'cpu-seeded-gpu-step-probe' | 'persistent-gpu-step-probe';
type ConstraintGpuDynamicUploadSkipBlocker =
  | 'none'
  | 'not-demo-or-preview'
  | 'particle-count-changed'
  | 'topology-dirty'
  | 'static-state-dirty'
  | 'pointer-active'
  | 'gpu-state-not-seeded';
type ConstraintGpuCandidateStats =
  | RawGpuConstraintParticleCandidateSlotStats
  | RawGpuConstraintParticleSortedCellCandidateStats
  | RawGpuConstraintParticleResidentListCandidateStats;

const CONSTRAINT_SORTED_CELL_RESIDENT_SCAN_LIMIT = 8;

interface RenderPoint {
  x: number;
  y: number;
}

interface IndexedRenderPoint extends RenderPoint {
  index: number;
}

interface ClosedSkinMesh {
  fill: Float32Array;
  fillLength: number;
  feather: Float32Array;
  featherLength: number;
}

interface GeometrySlice {
  data: Float32Array;
  length: number;
}

interface ConstraintRawState extends RawWebGL2RenderState {
  engine?: AdvancedCircleParticleEngine;
  program: WebGLProgram | null;
  drawProgram?: WebGLProgram;
  densityProgram?: WebGLProgram;
  densityCompositeProgram?: WebGLProgram;
  vao: WebGLVertexArrayObject | null;
  drawVao?: WebGLVertexArrayObject | null;
  densityVao?: WebGLVertexArrayObject | null;
  quadBuffer?: WebGLBuffer;
  centerBuffer?: WebGLBuffer;
  centerUploadData?: Float32Array;
  drawBuffer?: WebGLBuffer;
  drawBufferCapacity?: number;
  drawPreviewData?: Float32Array;
  densityQuadBuffer?: WebGLBuffer;
  densityCenterBuffer?: WebGLBuffer;
  densityCenterCapacity?: number;
  densityCenterScratch?: Float32Array;
  densityUploadFloats?: number;
  gpuConstraintState?: RawGpuConstraintParticleState;
  gpuConstraintStep?: RawGpuConstraintParticleStepPass;
  gpuConstraintJacobi?: RawGpuConstraintParticleJacobiPass;
  gpuConstraintCollision?: RawGpuConstraintParticleCircleCollisionPass;
  gpuConstraintCandidateSlots?: RawGpuConstraintParticleCandidateSlotPass;
  gpuConstraintGridKey?: RawGpuConstraintParticleGridKeyPass;
  gpuConstraintNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuConstraintCollisionNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuConstraintCandidateNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuConstraintDensityRenderer?: RawGpuConstraintParticleDensityRenderer;
  gpuConstraintSortedCandidateState?: RawGpuConstraintParticleState;
  gpuConstraintSortedCandidateCellOffsets?: RawGpuConstraintParticleCellOffsetPass;
  gpuConstraintSortedCandidateOccupancy?: RawGpuConstraintParticleCellOccupancyPass;
  gpuConstraintSortedCandidateCellRanges?: RawGpuConstraintParticleCellRangeFromOffsetsPass;
  gpuConstraintSortedCandidateCellKeys?: RawGpuConstraintParticleCellKeyPass;
  gpuConstraintSortedCandidateKeySort?: RawGpuKeyIndexSortPass;
  gpuConstraintSortedCandidateSortedKeyGather?: RawGpuConstraintParticleSortedKeyGatherPass;
  gpuConstraintSortedCandidateSortedKeyRanges?: RawGpuConstraintParticleSortedKeyRangePass;
  gpuConstraintSortedCandidateResidentList?: RawGpuConstraintParticleResidentListFromSortedKeysPass;
  gpuConstraintSortedCandidateGridKey?: RawGpuConstraintParticleGridKeyPass;
  gpuConstraintResidentListCandidateSlots?: RawGpuConstraintParticleResidentListCandidatePass;
  gpuConstraintSortedCellCandidateSlots?: RawGpuConstraintParticleSortedCellCandidatePass;
  gpuConstraintSortedCandidatePressure?: RawGpuConstraintParticlePressurePass;
  gpuConstraintSortedCandidateBodyMetadataBridge?: RawGpuConstraintParticleBodyMetadataBridge;
  gpuConstraintSortedCandidateBodyShape?: RawGpuConstraintParticleBodyShapePass;
  gpuConstraintResidentListCandidateNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuConstraintSortedCandidateNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuConstraintSortedCandidateCellRangeBridge?: RawGpuConstraintParticleCellRangeBridge;
  gpuConstraintSortedCandidateIndexMapBridge?: RawGpuConstraintParticleIndexMapBridge;
  gpuConstraintSortedCandidateIndexMapGather?: RawGpuConstraintParticleIndexMapGatherPass;
  gpuConstraintSortedCandidateIndexMapGatherState?: RawGpuConstraintParticleState;
  gpuConstraintPositions?: Float32Array;
  gpuConstraintVelocities?: Float32Array;
  gpuConstraintAttributes?: Float32Array;
  gpuConstraintSortedCandidatePositions?: Float32Array;
  gpuConstraintSortedCandidateVelocities?: Float32Array;
  gpuConstraintSortedCandidateAttributes?: Float32Array;
  gpuConstraintSortedCandidateKeys?: Float32Array;
  gpuConstraintSortedCandidateSortedKeys?: Float32Array;
  gpuConstraintSortedCandidateOrder?: Uint32Array;
  gpuConstraintNeighborData?: Float32Array[];
  gpuConstraintCollisionNeighborData?: Float32Array[];
  gpuConstraintCollisionNeighborStats?: AdvancedCircleParticleSpatialNeighborSlotStats;
  gpuConstraintGridKeyStats?: RawGpuConstraintParticleGridKeyStats;
  gpuConstraintCandidateSlotStats?: ConstraintGpuCandidateStats;
  gpuConstraintSortedCandidateUploadFloats?: number;
  gpuConstraintSortedCandidateUploadMode?: 'none' | 'cpu-sorted-copy' | 'gpu-sorted-key-gather';
  gpuConstraintSortedCandidateCellRangeUploadFloats?: number;
  gpuConstraintSortedCandidateCellRangeSource?: 'none' | 'gpu-sorted-key-range' | 'gpu-occupancy-offset-range' | 'cpu-cell-range-bridge';
  gpuConstraintSortedCandidateOccupancyStats?: RawGpuConstraintParticleCellOccupancyStats;
  gpuConstraintSortedCandidateCellOffsetStats?: RawGpuConstraintParticleCellOffsetStats;
  gpuConstraintSortedCandidateCellRangeStats?: RawGpuConstraintParticleCellRangeFromOffsetsStats;
  gpuConstraintSortedCandidateCellKeyStats?: RawGpuConstraintParticleCellKeyStats;
  gpuConstraintSortedCandidateKeySortStats?: RawGpuKeyIndexSortStats;
  gpuConstraintSortedCandidateSortedKeyGatherStats?: RawGpuConstraintParticleSortedKeyGatherStats;
  gpuConstraintSortedCandidateSortedKeyRangeStats?: RawGpuConstraintParticleSortedKeyRangeStats;
  gpuConstraintSortedCandidateResidentListStats?: RawGpuConstraintParticleResidentListFromSortedKeysStats;
  gpuConstraintResidentListCandidateStats?: RawGpuConstraintParticleResidentListCandidateStats;
  gpuConstraintSortedCandidateIndexMapUploadFloats?: number;
  gpuConstraintSortedCandidateIndexMapSource?: 'none' | 'cpu-index-map-bridge' | 'skipped-non-gpu-sorted-state';
  gpuConstraintSortedCandidateBodyMetadataUploadFloats?: number;
  gpuConstraintSortedCandidateIndexMapGatherFragmentTexels?: number;
  gpuConstraintSortedCandidateIndexMapGatherActive?: boolean;
  gpuConstraintSortedCandidateMaxCellOccupancy?: number;
  gpuConstraintSortedCandidateCellSize?: number;
  gpuConstraintSortedCandidateCellColumns?: number;
  gpuConstraintSortedCandidateCellRows?: number;
  gpuConstraintSortedCandidateCollisionBatches?: number;
  gpuConstraintSortedCandidateCollisionFragmentTexels?: number;
  gpuConstraintSortedCandidateCollisionConsumedSlots?: number;
  gpuConstraintSortedCandidateCollisionIgnoredSlots?: number;
  gpuConstraintSortedCandidateCollisionSpatiallyComplete?: boolean;
  gpuConstraintSortedCandidateCollisionStressActive?: boolean;
  gpuConstraintSortedCandidatePressureBatches?: number;
  gpuConstraintSortedCandidatePressureFragmentTexels?: number;
  gpuConstraintSortedCandidatePressureConsumedSlots?: number;
  gpuConstraintSortedCandidatePressureIgnoredSlots?: number;
  gpuConstraintSortedCandidatePressureStressActive?: boolean;
  gpuConstraintSortedCandidateBodyShapeFragmentTexels?: number;
  gpuConstraintSortedCandidateBodyShapeStressActive?: boolean;
  gpuConstraintSortedCandidateBodyMetadataCenterX?: Float32Array;
  gpuConstraintSortedCandidateBodyMetadataCenterY?: Float32Array;
  gpuConstraintSortedCandidateBodyMetadataRestRadius?: Float32Array;
  gpuConstraintSortedCandidateBodyMetadataCount?: number;
  gpuConstraintCandidateTelemetryLastSeconds?: number;
  gpuConstraintCandidateTelemetryFrame?: number;
  gpuConstraintCandidateTelemetrySampled?: boolean;
  gpuConstraintCandidateTelemetryStaleSeconds?: number;
  gpuConstraintCollisionNeighborUploadFloats?: number;
  gpuConstraintCollisionNeighborDirectUploadFloats?: number;
  gpuConstraintCollisionNeighborPaddedUploadFloats?: number;
  gpuConstraintCollisionNeighborActiveRows?: number;
  gpuConstraintCollisionNeighborUploadedRows?: number;
  gpuConstraintCollisionNeighborReservedRows?: number;
  gpuConstraintCollisionNeighborUploadSkipped?: boolean;
  gpuConstraintCollisionNeighborUploadSource?: 'none' | 'cpu-spatial-neighbor-slots' | 'gpu-resident-list';
  gpuConstraintCollisionSource?: ConstraintGpuCollisionSource;
  gpuConstraintCollisionLiveBroadphaseAuthoritativeReady?: boolean;
  gpuConstraintParticleCount?: number;
  gpuConstraintLinkCount?: number;
  gpuConstraintUploadedParticleCount?: number;
  gpuConstraintNeedsSeed?: boolean;
  gpuConstraintSeededThisFrame?: boolean;
  gpuConstraintNeedsTopologySeed?: boolean;
  gpuConstraintForceFullStaticUpload?: boolean;
  gpuConstraintForceFullTopologyUpload?: boolean;
  gpuConstraintStateSeedUploadFloats?: number;
  gpuConstraintTopologySeedUploadFloats?: number;
  gpuConstraintActiveRows?: number;
  gpuConstraintUploadedRows?: number;
  liveGpuStepSource?: ConstraintGpuStepSource;
  liveGpuStepParticleCount?: number;
  liveGpuStepActiveRows?: number;
  liveGpuStepFragmentTexels?: number;
  liveGpuStepDt?: number;
  liveGpuDynamicUploadSkipped?: boolean;
  liveGpuDynamicUploadSkipBlocker?: ConstraintGpuDynamicUploadSkipBlocker;
  liveGpuDensityRendered?: boolean;
  liveGpuDensityPointDraws?: number;
  liveGpuDensitySource?: 'cpu-live-state' | 'sorted-candidate-gathered-state';
  liveGpuSortedCandidateFeedbackRenderEligible?: boolean;
  liveGpuSortedCandidateFeedbackRenderActive?: boolean;
  liveGpuSortedCandidateFeedbackRenderBlocker?:
    | 'none'
    | 'not-rendered'
    | 'not-snakes'
    | 'sorted-state-still-cpu-uploaded'
    | 'original-order-gather-not-complete'
    | 'candidate-slots-not-fully-consumed'
    | 'gpu-broadphase-not-spatially-complete'
    | 'gather-state-missing';
  liveGpuDynamicUploadFloats?: number;
  liveGpuStaticUploadFloats?: number;
  liveGpuStaticUploadMode?: 'none' | 'full' | 'append-range' | 'shrink-range';
  liveGpuStaticAttributeWriteCount?: number;
  liveGpuDirectUploadFloats?: number;
  liveGpuPaddedUploadFloats?: number;
  liveGpuNeighborDirectUploadFloats?: number;
  liveGpuNeighborPaddedUploadFloats?: number;
  liveGpuNeighborSlotWriteCount?: number;
  liveGpuNeighborTopologyRangeStart?: number;
  liveGpuNeighborTopologyRangeCount?: number;
  liveGpuVelocityUploadSkipped?: boolean;
  softBlobGradientX?: Float32Array;
  softBlobGradientY?: Float32Array;
  densityFramebuffer?: WebGLFramebuffer | null;
  densityTexture?: WebGLTexture | null;
  densityWidth?: number;
  densityHeight?: number;
  spawnAccumulator?: number;
  nextGroupId?: number;
  blobEdgeLinks?: number[];
  blobBendLinks?: number[];
  blobRadialLinks?: number[];
  blobRestAreas?: Map<number, number>;
  blobRestRadii?: Map<number, number>;
  groupedParticleScratch?: Map<number, number[]>;
  renderPointScratch?: RenderPoint[];
  liquidSurface?: RawLiquidSurfaceRenderer;
  liquidParticleBuffer?: WebGLBuffer;
  liquidParticleData?: Float32Array;
  boundaryPointScratch?: IndexedRenderPoint[];
  closedRawScratch?: RenderPoint[];
  closedSmoothScratch?: RenderPoint[];
  closedContourScratch?: RenderPoint[];
  closedOuterScratch?: RenderPoint[];
  smoothOpenPointScratch?: RenderPoint[];
  closedFillScratch?: Float32Array;
  closedFeatherScratch?: Float32Array;
  tubeGeometryScratch?: Float32Array;
  diskGeometryScratch?: Float32Array;
  smoothOpenGeometryScratch?: Float32Array;
  closedTubeGeometryScratch?: Float32Array;
  fanGeometryScratch?: Float32Array;
  interactionRadiusData?: Float32Array;
  demoFloorDropped?: boolean;
  inputMode?: 'interact' | 'draw' | 'build' | 'rain';
  grabbedIndex?: number;
  pickedParticleIndices?: number[];
  pointerDown?: boolean;
  drawing?: boolean;
  drawPointerId?: number;
  drawPoints?: Array<{ x: number; y: number }>;
  pointerX?: number;
  pointerY?: number;
  previousPointerX?: number;
  previousPointerY?: number;
  needsRedraw?: boolean;
  activeQuality?: RenderQuality;
  stats?: AdvancedCircleParticleStats;
  uResolution?: WebGLUniformLocation | null;
  uRadius?: WebGLUniformLocation | null;
  uPrimary?: WebGLUniformLocation | null;
  uSecondary?: WebGLUniformLocation | null;
  uDrawResolution?: WebGLUniformLocation | null;
  uDrawColor?: WebGLUniformLocation | null;
  uDensityResolution?: WebGLUniformLocation | null;
  uDensityRadius?: WebGLUniformLocation | null;
  uDensityCompositeTexture?: WebGLUniformLocation | null;
  uDensityCompositeResolution?: WebGLUniformLocation | null;
  uDensityCompositePrimary?: WebGLUniformLocation | null;
  uDensityCompositeSecondary?: WebGLUniformLocation | null;
  uDensityCompositeThreshold?: WebGLUniformLocation | null;
  cleanupPointer?: () => void;
}

const VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aUnit;
layout(location = 1) in vec2 aCenter;
uniform vec2 uResolution;
uniform float uRadius;
out vec2 vUnit;
void main() {
  vec2 pixel = aCenter + aUnit * uRadius;
  vec2 clip = pixel / uResolution * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vUnit = aUnit;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUnit;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
out vec4 outColor;
void main() {
  float d2 = dot(vUnit, vUnit);
  if (d2 > 1.0) discard;
  float z = sqrt(max(0.0, 1.0 - d2));
  float alpha = 1.0 - smoothstep(0.94, 1.0, d2);
  vec3 color = mix(uSecondary, uPrimary, 0.35 + 0.65 * z);
  outColor = vec4(color, alpha);
}`;

const DRAW_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPoint;
uniform vec2 uResolution;
void main() {
  vec2 clip = aPoint / uResolution * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const DRAW_FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  outColor = uColor;
}`;

const DENSITY_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aUnit;
layout(location = 1) in vec2 aCenter;
uniform vec2 uResolution;
uniform float uRadius;
out vec2 vUnit;
void main() {
  vec2 pixel = aCenter + aUnit * uRadius;
  vec2 clip = pixel / uResolution * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vUnit = aUnit;
}`;

const DENSITY_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUnit;
out vec4 outColor;
void main() {
  float d2 = dot(vUnit, vUnit);
  if (d2 > 1.0) discard;
  float density = exp(-d2 * 3.15) * (1.0 - smoothstep(0.82, 1.0, d2));
  outColor = vec4(density, density, density, density);
}`;

const DENSITY_COMPOSITE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aClip;
out vec2 vUv;
void main() {
  vUv = aClip * 0.5 + 0.5;
  gl_Position = vec4(aClip, 0.0, 1.0);
}`;

const DENSITY_COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uDensity;
uniform vec2 uResolution;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform float uThreshold;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 px = 1.0 / max(uResolution, vec2(1.0));
  float center = texture(uDensity, vUv).r;
  float left = texture(uDensity, vUv - vec2(px.x, 0.0)).r;
  float right = texture(uDensity, vUv + vec2(px.x, 0.0)).r;
  float up = texture(uDensity, vUv + vec2(0.0, px.y)).r;
  float down = texture(uDensity, vUv - vec2(0.0, px.y)).r;
  float d = center * 0.44 + (left + right + up + down) * 0.11;
  d += (
    texture(uDensity, vUv + px * vec2(-1.0, -1.0)).r +
    texture(uDensity, vUv + px * vec2(1.0, -1.0)).r +
    texture(uDensity, vUv + px * vec2(-1.0, 1.0)).r +
    texture(uDensity, vUv + px * vec2(1.0, 1.0)).r
  ) * 0.03;
  float alpha = smoothstep(uThreshold, uThreshold + 0.055, d);
  if (alpha <= 0.001) discard;
  vec2 grad = vec2(right - left, up - down);
  vec3 normal = normalize(vec3(-grad * 4.8, 0.82));
  float light = clamp(dot(normal, normalize(vec3(-0.45, -0.62, 1.0))) * 0.5 + 0.5, 0.0, 1.0);
  float rim = smoothstep(uThreshold, uThreshold + 0.018, d) * (1.0 - smoothstep(uThreshold + 0.07, uThreshold + 0.16, d));
  vec3 color = mix(uSecondary, uPrimary, 0.36 + light * 0.54);
  color = mix(color * 0.72, color, alpha);
  color += rim * vec3(0.16, 0.24, 0.3);
  outColor = vec4(color, alpha * 0.96);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext): WebGLProgram {
  return linkSources(gl, VERTEX, FRAGMENT);
}

function linkSources(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program');
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

function colorToRgb(value: number | undefined, fallback: [number, number, number]): [number, number, number] {
  if (typeof value !== 'number') return fallback;
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function colorToRgba(value: number | undefined, fallback: [number, number, number], alpha: number): [number, number, number, number] {
  const [r, g, b] = colorToRgb(value, fallback);
  return [r, g, b, alpha];
}

function paletteOptionColor(
  palette: number[],
  optionIndex: number,
  fallback: [number, number, number],
  alpha: number,
): [number, number, number, number] {
  const color = palette[((optionIndex % 4) + 4) % 4];
  return colorToRgba(color, fallback, alpha);
}

function brightenRgba(color: [number, number, number, number], amount: number, alpha = color[3]): [number, number, number, number] {
  return [
    color[0] + (1 - color[0]) * amount,
    color[1] + (1 - color[1]) * amount,
    color[2] + (1 - color[2]) * amount,
    alpha,
  ];
}

const DENSITY_QUAD = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1,
]);
const PARTICLE_QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const SOFT_BLOB_DENSITY_RINGS = new Float32Array([0.18, 0.34, 0.5, 0.66, 0.8, 0.92, 1]);
const GPU_DEMO_CAPACITY = 4096;
const LIQUID_STRIDE_FLOATS = 6;
const LIQUID_STRIDE_BYTES = LIQUID_STRIDE_FLOATS * Float32Array.BYTES_PER_ELEMENT;

function initDensityRenderer(state: ConstraintRawState): void {
  const gl = state.gl;
  state.densityProgram = linkSources(gl, DENSITY_VERTEX, DENSITY_FRAGMENT);
  state.densityCompositeProgram = linkSources(gl, DENSITY_COMPOSITE_VERTEX, DENSITY_COMPOSITE_FRAGMENT);
  state.uDensityResolution = gl.getUniformLocation(state.densityProgram, 'uResolution');
  state.uDensityRadius = gl.getUniformLocation(state.densityProgram, 'uRadius');
  state.uDensityCompositeTexture = gl.getUniformLocation(state.densityCompositeProgram, 'uDensity');
  state.uDensityCompositeResolution = gl.getUniformLocation(state.densityCompositeProgram, 'uResolution');
  state.uDensityCompositePrimary = gl.getUniformLocation(state.densityCompositeProgram, 'uPrimary');
  state.uDensityCompositeSecondary = gl.getUniformLocation(state.densityCompositeProgram, 'uSecondary');
  state.uDensityCompositeThreshold = gl.getUniformLocation(state.densityCompositeProgram, 'uThreshold');
  state.densityVao = gl.createVertexArray();
  state.densityQuadBuffer = gl.createBuffer() ?? undefined;
  state.densityCenterBuffer = gl.createBuffer() ?? undefined;
  if (!state.densityVao || !state.densityQuadBuffer || !state.densityCenterBuffer) return;
  gl.bindVertexArray(state.densityVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.densityQuadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, DENSITY_QUAD, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.densityCenterBuffer);
  state.densityCenterCapacity = 128;
  gl.bufferData(gl.ARRAY_BUFFER, state.densityCenterCapacity * 2 * 4, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.bindVertexArray(null);
}

function ensureDensityTarget(state: ConstraintRawState): boolean {
  const gl = state.gl;
  const width = Math.max(1, state.width | 0);
  const height = Math.max(1, state.height | 0);
  if (state.densityTexture && state.densityFramebuffer && state.densityWidth === width && state.densityHeight === height) return true;
  if (!state.densityTexture) state.densityTexture = gl.createTexture();
  if (!state.densityFramebuffer) state.densityFramebuffer = gl.createFramebuffer();
  if (!state.densityTexture || !state.densityFramebuffer) return false;
  state.densityWidth = width;
  state.densityHeight = height;
  gl.bindTexture(gl.TEXTURE_2D, state.densityTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.densityFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.densityTexture, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return complete;
}

function ensureDensityCenterScratch(state: ConstraintRawState, floats: number): Float32Array {
  if (!state.densityCenterScratch || state.densityCenterScratch.length < floats) {
    const nextLength = Math.max(floats, state.densityCenterScratch ? state.densityCenterScratch.length * 2 : 1024);
    state.densityCenterScratch = new Float32Array(nextLength);
  }
  return state.densityCenterScratch;
}

function ensureCenterUploadData(state: ConstraintRawState, floats: number): Float32Array {
  if (!state.centerUploadData || state.centerUploadData.length < floats) {
    state.centerUploadData = new Float32Array(Math.max(floats, state.centerUploadData ? state.centerUploadData.length * 2 : 1024));
  }
  return state.centerUploadData;
}

function buildSoftBlobDensityCenters(state: ConstraintRawState, engine: AdvancedCircleParticleEngine): GeometrySlice {
  const groups = groupedParticleIndices(engine, state);
  if (groups.size === 0) return { data: engine.positions, length: engine.count * 2 };
  const density = softBlobNodeDensity(state);
  const edgeSteps = density >= 2.4 ? 2 : density >= 1.2 ? 3 : 4;
  const ringCount = density >= 2.4 ? 4 : density >= 1.2 ? 5 : SOFT_BLOB_DENSITY_RINGS.length;
  const estimatedCenters = Math.max(engine.count, engine.count * edgeSteps * ringCount);
  const centers = ensureDensityCenterScratch(state, estimatedCenters * 2);
  let offset = 0;
  for (const indices of groups.values()) {
    if (indices.length < 4) {
      for (const index of indices) {
        const k = index << 1;
        centers[offset] = engine.positions[k];
        centers[offset + 1] = engine.positions[k + 1];
        offset += 2;
      }
      continue;
    }
    let centerIndex = indices[0];
    for (let cursor = 1; cursor < indices.length; cursor += 1) {
      const index = indices[cursor];
      if (engine.locals[index] > engine.locals[centerIndex]) centerIndex = index;
    }
    const centerK = centerIndex << 1;
    const cx = engine.positions[centerK];
    const cy = engine.positions[centerK + 1];
    centers[offset] = cx;
    centers[offset + 1] = cy;
    offset += 2;
    for (let i = 0; i < indices.length; i += 1) {
      const index = indices[i];
      if (index === centerIndex) continue;
      let nextCursor = (i + 1) % indices.length;
      while (indices[nextCursor] === centerIndex) {
        nextCursor = (nextCursor + 1) % indices.length;
      }
      const nextIndex = indices[nextCursor];
      const k = index << 1;
      const x = engine.positions[k];
      const y = engine.positions[k + 1];
      const nextK = nextIndex << 1;
      const nextX = engine.positions[nextK];
      const nextY = engine.positions[nextK + 1];
      for (let edgeStep = 0; edgeStep < edgeSteps; edgeStep += 1) {
        const edgeT = edgeStep / edgeSteps;
        const bx = x + (nextX - x) * edgeT;
        const by = y + (nextY - y) * edgeT;
        for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
          const ring = SOFT_BLOB_DENSITY_RINGS[ringIndex];
          centers[offset] = cx + (bx - cx) * ring;
          centers[offset + 1] = cy + (by - cy) * ring;
          offset += 2;
        }
      }
    }
  }
  return { data: centers, length: offset };
}

function drawDensityBody(state: ConstraintRawState, kind: ConstraintDemoKind, size: { width: number; height: number }): boolean {
  const engine = state.engine;
  const gl = state.gl;
  if (!engine || engine.count <= 0 || !state.densityProgram || !state.densityCompositeProgram || !state.densityVao || !state.densityCenterBuffer) return false;
  if (!state.uDensityResolution || !state.uDensityRadius || !state.uDensityCompositeTexture || !state.uDensityCompositeResolution || !state.uDensityCompositePrimary || !state.uDensityCompositeSecondary || !state.uDensityCompositeThreshold) return false;
  if (!ensureDensityTarget(state) || !state.densityFramebuffer || !state.densityTexture) return false;

  const palette = state.style?.palette ?? [];
  const radius = kind === 'chain-rain' ? finiteNumberSetting(state.settings, 'nodeRadius', 5) : softBlobNodeRadius(state);
  const fieldRadius = radius * (kind === 'chain-rain' ? 2.35 : 2.85);
  const threshold = kind === 'chain-rain' ? 0.058 : 0.072;

  gl.bindFramebuffer(gl.FRAMEBUFFER, state.densityFramebuffer);
  gl.viewport(0, 0, state.densityWidth ?? state.width, state.densityHeight ?? state.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(state.densityProgram);
  gl.bindVertexArray(state.densityVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.densityCenterBuffer);
  const densityCenters = kind === 'soft-blob' ? buildSoftBlobDensityCenters(state, engine) : { data: engine.positions, length: engine.count * 2 };
  const densityCount = densityCenters.length >> 1;
  state.densityUploadFloats = densityCenters.length;
  if ((state.densityCenterCapacity ?? 0) < densityCount) {
    state.densityCenterCapacity = Math.max(densityCount, (state.densityCenterCapacity ?? 128) * 2);
    gl.bufferData(gl.ARRAY_BUFFER, state.densityCenterCapacity * 2 * 4, gl.DYNAMIC_DRAW);
  }
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, densityCenters.data, 0, densityCenters.length);
  gl.uniform2f(state.uDensityResolution, size.width, size.height);
  gl.uniform1f(state.uDensityRadius, fieldRadius);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, densityCount);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.useProgram(state.densityCompositeProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.densityTexture);
  gl.uniform1i(state.uDensityCompositeTexture, 0);
  gl.uniform2f(state.uDensityCompositeResolution, state.densityWidth ?? state.width, state.densityHeight ?? state.height);
  gl.uniform3fv(state.uDensityCompositePrimary, colorToRgb(palette[0], kind === 'chain-rain' ? [0.45, 0.9, 1] : [1, 0.42, 0.68]));
  gl.uniform3fv(state.uDensityCompositeSecondary, colorToRgb(palette[1], kind === 'chain-rain' ? [0.9, 0.95, 1] : [0.6, 0.95, 1]));
  gl.uniform1f(state.uDensityCompositeThreshold, threshold);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

function compositeDensityBody(state: ConstraintRawState, kind: ConstraintDemoKind): boolean {
  const gl = state.gl;
  if (!state.densityTexture || !state.densityCompositeProgram || !state.uDensityCompositeTexture || !state.uDensityCompositeResolution || !state.uDensityCompositePrimary || !state.uDensityCompositeSecondary || !state.uDensityCompositeThreshold) return false;
  const palette = state.style?.palette ?? [];
  const threshold = kind === 'chain-rain' ? 0.058 : 0.072;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.useProgram(state.densityCompositeProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.densityTexture);
  gl.uniform1i(state.uDensityCompositeTexture, 0);
  gl.uniform2f(state.uDensityCompositeResolution, state.densityWidth ?? state.width, state.densityHeight ?? state.height);
  gl.uniform3fv(state.uDensityCompositePrimary, colorToRgb(palette[0], kind === 'chain-rain' ? [0.45, 0.9, 1] : [1, 0.42, 0.68]));
  gl.uniform3fv(state.uDensityCompositeSecondary, colorToRgb(palette[1], kind === 'chain-rain' ? [0.9, 0.95, 1] : [0.6, 0.95, 1]));
  gl.uniform1f(state.uDensityCompositeThreshold, threshold);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return true;
}

function ensureGpuConstraintBuffers(state: ConstraintRawState): boolean {
  const gpu = state.gpuConstraintState;
  if (!gpu) return false;
  const requiredLength = gpu.width * gpu.height * 4;
  if (!state.gpuConstraintPositions || state.gpuConstraintPositions.length !== requiredLength) state.gpuConstraintPositions = new Float32Array(requiredLength);
  if (!state.gpuConstraintVelocities || state.gpuConstraintVelocities.length !== requiredLength) state.gpuConstraintVelocities = new Float32Array(requiredLength);
  if (!state.gpuConstraintAttributes || state.gpuConstraintAttributes.length !== requiredLength) state.gpuConstraintAttributes = new Float32Array(requiredLength);
  const slotCount = state.gpuConstraintNeighbors?.slotCount ?? 0;
  const neighborData = state.gpuConstraintNeighborData ?? [];
  while (neighborData.length < slotCount) neighborData.push(new Float32Array(requiredLength));
  for (let slot = 0; slot < neighborData.length; slot += 1) {
    if (neighborData[slot].length !== requiredLength) neighborData[slot] = new Float32Array(requiredLength);
  }
  state.gpuConstraintNeighborData = neighborData;
  const collisionSlotCount = state.gpuConstraintCollisionNeighbors?.slotCount ?? 0;
  const collisionNeighborData = state.gpuConstraintCollisionNeighborData ?? [];
  while (collisionNeighborData.length < collisionSlotCount) collisionNeighborData.push(new Float32Array(requiredLength));
  for (let slot = 0; slot < collisionNeighborData.length; slot += 1) {
    if (collisionNeighborData[slot].length !== requiredLength) collisionNeighborData[slot] = new Float32Array(requiredLength);
  }
  state.gpuConstraintCollisionNeighborData = collisionNeighborData;
  return true;
}

function maxConstraintCellOccupancyFromSortedKeys(keys: Float32Array, count: number, sortStride: number): number {
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

function scalarDebugStats(
  stats: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(stats)) out[key] = value ?? null;
  return out;
}

function ensureGpuConstraintPreviewState(state: ConstraintRawState, kind: ConstraintDemoKind, capacity: number): boolean {
  const slotCount = kind === 'chain-rain' ? 4 : 6;
  if (
    state.gpuConstraintState &&
    state.gpuConstraintState.capacity === capacity &&
    state.gpuConstraintStep &&
    state.gpuConstraintJacobi &&
    state.gpuConstraintCollision &&
    state.gpuConstraintNeighbors &&
    state.gpuConstraintCollisionNeighbors &&
    state.gpuConstraintNeighbors.slotCount === slotCount &&
    state.gpuConstraintCollisionNeighbors.slotCount === 8 &&
    state.gpuConstraintDensityRenderer
  ) return true;
  if (state.gpuConstraintState) {
    destroyGpuConstraintSortedCandidateState(state);
    state.gpuConstraintDensityRenderer?.destroy();
    state.gpuConstraintCandidateNeighbors?.destroy();
    state.gpuConstraintCollisionNeighbors?.destroy();
    state.gpuConstraintNeighbors?.destroy();
    state.gpuConstraintCandidateSlots?.destroy();
    state.gpuConstraintGridKey?.destroy();
    state.gpuConstraintCollision?.destroy();
    state.gpuConstraintJacobi?.destroy();
    state.gpuConstraintStep?.destroy();
    state.gpuConstraintState.destroy();
    state.gpuConstraintDensityRenderer = undefined;
    state.gpuConstraintCandidateNeighbors = undefined;
    state.gpuConstraintCollisionNeighbors = undefined;
    state.gpuConstraintNeighbors = undefined;
    state.gpuConstraintCandidateSlots = undefined;
    state.gpuConstraintGridKey = undefined;
    state.gpuConstraintCollision = undefined;
    state.gpuConstraintJacobi = undefined;
    state.gpuConstraintStep = undefined;
    state.gpuConstraintState = undefined;
    state.gpuConstraintPositions = undefined;
    state.gpuConstraintVelocities = undefined;
    state.gpuConstraintAttributes = undefined;
    state.gpuConstraintNeighborData = undefined;
    state.gpuConstraintCollisionNeighborData = undefined;
    state.gpuConstraintCollisionNeighborStats = undefined;
    state.gpuConstraintGridKeyStats = undefined;
    state.gpuConstraintCandidateSlotStats = undefined;
    state.gpuConstraintCandidateTelemetryLastSeconds = undefined;
    state.gpuConstraintCandidateTelemetryFrame = undefined;
    state.gpuConstraintCandidateTelemetrySampled = undefined;
    state.gpuConstraintCandidateTelemetryStaleSeconds = undefined;
    state.gpuConstraintCollisionNeighborUploadFloats = undefined;
    state.gpuConstraintCollisionNeighborDirectUploadFloats = undefined;
    state.gpuConstraintCollisionNeighborPaddedUploadFloats = undefined;
    state.gpuConstraintCollisionNeighborActiveRows = undefined;
    state.gpuConstraintCollisionNeighborUploadedRows = undefined;
    state.gpuConstraintCollisionNeighborReservedRows = undefined;
    state.gpuConstraintCollisionNeighborUploadSkipped = undefined;
    state.gpuConstraintCollisionNeighborUploadSource = undefined;
    state.gpuConstraintCollisionSource = undefined;
    state.gpuConstraintCollisionLiveBroadphaseAuthoritativeReady = undefined;
    state.gpuConstraintParticleCount = undefined;
    state.gpuConstraintLinkCount = undefined;
    state.gpuConstraintUploadedParticleCount = undefined;
    state.gpuConstraintNeedsSeed = undefined;
    state.gpuConstraintSeededThisFrame = undefined;
    state.gpuConstraintNeedsTopologySeed = undefined;
    state.gpuConstraintForceFullStaticUpload = undefined;
    state.gpuConstraintForceFullTopologyUpload = undefined;
    state.gpuConstraintStateSeedUploadFloats = undefined;
    state.gpuConstraintTopologySeedUploadFloats = undefined;
    state.gpuConstraintActiveRows = undefined;
    state.gpuConstraintUploadedRows = undefined;
  }
  const gpu = new RawGpuConstraintParticleState(state.resources, { capacity });
  state.gpuConstraintState = gpu;
  state.gpuConstraintStep = new RawGpuConstraintParticleStepPass(state.gl);
  state.gpuConstraintJacobi = new RawGpuConstraintParticleJacobiPass(state.gl);
  state.gpuConstraintCollision = new RawGpuConstraintParticleCircleCollisionPass(state.gl);
  state.gpuConstraintCandidateSlots = new RawGpuConstraintParticleCandidateSlotPass(state.gl);
  state.gpuConstraintGridKey = new RawGpuConstraintParticleGridKeyPass(state.resources, gpu);
  state.gpuConstraintNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: gpu.width,
    height: gpu.height,
    slots: slotCount,
  });
  state.gpuConstraintCollisionNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: gpu.width,
    height: gpu.height,
    slots: 8,
  });
  state.gpuConstraintCandidateNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: gpu.width,
    height: gpu.height,
    slots: 8,
  });
  state.gpuConstraintDensityRenderer = new RawGpuConstraintParticleDensityRenderer(state.gl);
  state.gpuConstraintNeedsSeed = true;
  state.gpuConstraintNeedsTopologySeed = true;
  state.gpuConstraintForceFullStaticUpload = true;
  state.gpuConstraintForceFullTopologyUpload = true;
  return true;
}

function destroyGpuConstraintSortedCandidateState(state: ConstraintRawState): void {
  state.gpuConstraintSortedCandidateCellRangeBridge?.destroy();
  state.gpuConstraintSortedCandidateIndexMapBridge?.destroy();
  state.gpuConstraintSortedCandidateIndexMapGather?.destroy();
  state.gpuConstraintSortedCandidateIndexMapGatherState?.destroy();
  state.gpuConstraintResidentListCandidateNeighbors?.destroy();
  state.gpuConstraintResidentListCandidateSlots?.destroy();
  state.gpuConstraintSortedCandidateNeighbors?.destroy();
  state.gpuConstraintSortedCandidatePressure?.destroy();
  state.gpuConstraintSortedCandidateBodyMetadataBridge?.destroy();
  state.gpuConstraintSortedCandidateBodyShape?.destroy();
  state.gpuConstraintSortedCandidateOccupancy?.destroy();
  state.gpuConstraintSortedCandidateCellOffsets?.destroy();
  state.gpuConstraintSortedCandidateCellRanges?.destroy();
  state.gpuConstraintSortedCandidateCellKeys?.destroy();
  state.gpuConstraintSortedCandidateKeySort?.destroy();
  state.gpuConstraintSortedCandidateSortedKeyGather?.destroy();
  state.gpuConstraintSortedCandidateSortedKeyRanges?.destroy();
  state.gpuConstraintSortedCandidateResidentList?.destroy();
  state.gpuConstraintSortedCellCandidateSlots?.destroy();
  state.gpuConstraintSortedCandidateGridKey?.destroy();
  state.gpuConstraintSortedCandidateState?.destroy();
  state.gpuConstraintSortedCandidateCellRangeBridge = undefined;
  state.gpuConstraintSortedCandidateIndexMapBridge = undefined;
  state.gpuConstraintSortedCandidateIndexMapGather = undefined;
  state.gpuConstraintSortedCandidateIndexMapGatherState = undefined;
  state.gpuConstraintResidentListCandidateNeighbors = undefined;
  state.gpuConstraintResidentListCandidateSlots = undefined;
  state.gpuConstraintSortedCandidateNeighbors = undefined;
  state.gpuConstraintSortedCandidatePressure = undefined;
  state.gpuConstraintSortedCandidateBodyMetadataBridge = undefined;
  state.gpuConstraintSortedCandidateBodyShape = undefined;
  state.gpuConstraintSortedCandidateOccupancy = undefined;
  state.gpuConstraintSortedCandidateCellOffsets = undefined;
  state.gpuConstraintSortedCandidateCellRanges = undefined;
  state.gpuConstraintSortedCandidateCellKeys = undefined;
  state.gpuConstraintSortedCandidateKeySort = undefined;
  state.gpuConstraintSortedCandidateSortedKeyGather = undefined;
  state.gpuConstraintSortedCandidateSortedKeyRanges = undefined;
  state.gpuConstraintSortedCandidateResidentList = undefined;
  state.gpuConstraintSortedCellCandidateSlots = undefined;
  state.gpuConstraintSortedCandidateGridKey = undefined;
  state.gpuConstraintSortedCandidateState = undefined;
  state.gpuConstraintSortedCandidatePositions = undefined;
  state.gpuConstraintSortedCandidateVelocities = undefined;
  state.gpuConstraintSortedCandidateAttributes = undefined;
  state.gpuConstraintSortedCandidateKeys = undefined;
  state.gpuConstraintSortedCandidateSortedKeys = undefined;
  state.gpuConstraintSortedCandidateOrder = undefined;
  state.gpuConstraintSortedCandidateUploadFloats = undefined;
  state.gpuConstraintSortedCandidateUploadMode = undefined;
  state.gpuConstraintSortedCandidateCellRangeUploadFloats = undefined;
  state.gpuConstraintSortedCandidateCellRangeSource = undefined;
  state.gpuConstraintSortedCandidateOccupancyStats = undefined;
  state.gpuConstraintSortedCandidateCellOffsetStats = undefined;
  state.gpuConstraintSortedCandidateCellRangeStats = undefined;
  state.gpuConstraintSortedCandidateCellKeyStats = undefined;
  state.gpuConstraintSortedCandidateKeySortStats = undefined;
  state.gpuConstraintSortedCandidateSortedKeyGatherStats = undefined;
  state.gpuConstraintSortedCandidateSortedKeyRangeStats = undefined;
  state.gpuConstraintSortedCandidateResidentListStats = undefined;
  state.gpuConstraintResidentListCandidateStats = undefined;
  state.gpuConstraintSortedCandidateIndexMapUploadFloats = undefined;
  state.gpuConstraintSortedCandidateIndexMapSource = undefined;
  state.gpuConstraintSortedCandidateBodyMetadataUploadFloats = undefined;
  state.gpuConstraintSortedCandidateIndexMapGatherFragmentTexels = undefined;
  state.gpuConstraintSortedCandidateIndexMapGatherActive = undefined;
  state.gpuConstraintSortedCandidateMaxCellOccupancy = undefined;
  state.gpuConstraintSortedCandidateCellSize = undefined;
  state.gpuConstraintSortedCandidateCellColumns = undefined;
  state.gpuConstraintSortedCandidateCellRows = undefined;
  state.gpuConstraintSortedCandidateCollisionBatches = undefined;
  state.gpuConstraintSortedCandidateCollisionFragmentTexels = undefined;
  state.gpuConstraintSortedCandidateCollisionConsumedSlots = undefined;
  state.gpuConstraintSortedCandidateCollisionIgnoredSlots = undefined;
  state.gpuConstraintSortedCandidateCollisionSpatiallyComplete = undefined;
  state.gpuConstraintSortedCandidateCollisionStressActive = undefined;
  state.gpuConstraintSortedCandidatePressureBatches = undefined;
  state.gpuConstraintSortedCandidatePressureFragmentTexels = undefined;
  state.gpuConstraintSortedCandidatePressureConsumedSlots = undefined;
  state.gpuConstraintSortedCandidatePressureIgnoredSlots = undefined;
  state.gpuConstraintSortedCandidatePressureStressActive = undefined;
  state.gpuConstraintSortedCandidateBodyShapeFragmentTexels = undefined;
  state.gpuConstraintSortedCandidateBodyShapeStressActive = undefined;
  state.gpuConstraintSortedCandidateBodyMetadataCenterX = undefined;
  state.gpuConstraintSortedCandidateBodyMetadataCenterY = undefined;
  state.gpuConstraintSortedCandidateBodyMetadataRestRadius = undefined;
  state.gpuConstraintSortedCandidateBodyMetadataCount = undefined;
}

function ensureGpuConstraintSortedCandidateState(state: ConstraintRawState, capacity: number): RawGpuConstraintParticleState {
  const existing = state.gpuConstraintSortedCandidateState;
  if (
    existing &&
    existing.capacity === capacity &&
    state.gpuConstraintSortedCandidateGridKey &&
    state.gpuConstraintSortedCellCandidateSlots &&
    state.gpuConstraintSortedCandidatePressure &&
    state.gpuConstraintSortedCandidateBodyMetadataBridge &&
    state.gpuConstraintSortedCandidateBodyShape &&
    state.gpuConstraintSortedCandidateOccupancy &&
    state.gpuConstraintSortedCandidateCellKeys &&
    state.gpuConstraintSortedCandidateKeySort &&
    state.gpuConstraintSortedCandidateSortedKeyGather &&
    state.gpuConstraintSortedCandidateSortedKeyRanges &&
    state.gpuConstraintSortedCandidateResidentList &&
    state.gpuConstraintResidentListCandidateSlots &&
    state.gpuConstraintResidentListCandidateNeighbors &&
    state.gpuConstraintSortedCandidateNeighbors &&
    state.gpuConstraintSortedCandidateCellRangeBridge
  ) return existing;
  destroyGpuConstraintSortedCandidateState(state);
  const gpu = new RawGpuConstraintParticleState(state.resources, { capacity });
  state.gpuConstraintSortedCandidateState = gpu;
  state.gpuConstraintSortedCandidateGridKey = new RawGpuConstraintParticleGridKeyPass(state.resources, gpu);
  state.gpuConstraintSortedCandidateOccupancy = new RawGpuConstraintParticleCellOccupancyPass(state.resources);
  state.gpuConstraintSortedCandidateCellOffsets = new RawGpuConstraintParticleCellOffsetPass(state.resources);
  state.gpuConstraintSortedCandidateCellRanges = new RawGpuConstraintParticleCellRangeFromOffsetsPass(state.resources);
  state.gpuConstraintSortedCandidateCellKeys = new RawGpuConstraintParticleCellKeyPass(state.resources);
  state.gpuConstraintSortedCandidateKeySort = new RawGpuKeyIndexSortPass(state.resources);
  state.gpuConstraintSortedCandidateSortedKeyGather = new RawGpuConstraintParticleSortedKeyGatherPass(state.gl);
  state.gpuConstraintSortedCandidateSortedKeyRanges = new RawGpuConstraintParticleSortedKeyRangePass(state.resources);
  state.gpuConstraintSortedCandidateResidentList = new RawGpuConstraintParticleResidentListFromSortedKeysPass(state.resources);
  state.gpuConstraintResidentListCandidateSlots = new RawGpuConstraintParticleResidentListCandidatePass(state.gl);
  state.gpuConstraintSortedCellCandidateSlots = new RawGpuConstraintParticleSortedCellCandidatePass(state.gl);
  state.gpuConstraintSortedCandidatePressure = new RawGpuConstraintParticlePressurePass(state.gl);
  state.gpuConstraintSortedCandidateBodyMetadataBridge = new RawGpuConstraintParticleBodyMetadataBridge(state.resources);
  state.gpuConstraintSortedCandidateBodyShape = new RawGpuConstraintParticleBodyShapePass(state.gl);
  state.gpuConstraintSortedCandidateNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: gpu.width,
    height: gpu.height,
    slots: CONSTRAINT_SORTED_CELL_RESIDENT_SCAN_LIMIT * 9,
  });
  state.gpuConstraintResidentListCandidateNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: gpu.width,
    height: gpu.height,
    slots: CONSTRAINT_SORTED_CELL_RESIDENT_SCAN_LIMIT * 9,
  });
  state.gpuConstraintSortedCandidateCellRangeBridge = new RawGpuConstraintParticleCellRangeBridge(state.resources);
  state.gpuConstraintSortedCandidateIndexMapBridge = new RawGpuConstraintParticleIndexMapBridge(state.resources);
  state.gpuConstraintSortedCandidateIndexMapGather = new RawGpuConstraintParticleIndexMapGatherPass(state.gl);
  state.gpuConstraintSortedCandidateIndexMapGatherState = new RawGpuConstraintParticleState(state.resources, { capacity });
  return gpu;
}

function uploadSortedConstraintGroupMetadata(state: ConstraintRawState, engine: AdvancedCircleParticleEngine, kind: ConstraintDemoKind): void {
  const bridge = state.gpuConstraintSortedCandidateBodyMetadataBridge;
  if (!bridge || engine.count <= 0) {
    state.gpuConstraintSortedCandidateBodyMetadataUploadFloats = 0;
    state.gpuConstraintSortedCandidateBodyMetadataCount = 0;
    return;
  }
  const groups = groupedParticleIndices(engine, state);
  let maxGroup = 0;
  for (const group of groups.keys()) maxGroup = Math.max(maxGroup, group);
  const bodyCount = maxGroup + 1;
  if (bodyCount <= 1) {
    state.gpuConstraintSortedCandidateBodyMetadataUploadFloats = 0;
    state.gpuConstraintSortedCandidateBodyMetadataCount = 0;
    return;
  }
  if (
    !state.gpuConstraintSortedCandidateBodyMetadataCenterX ||
    !state.gpuConstraintSortedCandidateBodyMetadataCenterY ||
    !state.gpuConstraintSortedCandidateBodyMetadataRestRadius ||
    state.gpuConstraintSortedCandidateBodyMetadataCenterX.length < bodyCount ||
    state.gpuConstraintSortedCandidateBodyMetadataCenterY.length < bodyCount ||
    state.gpuConstraintSortedCandidateBodyMetadataRestRadius.length < bodyCount
  ) {
    const nextLength = Math.max(bodyCount, state.gpuConstraintSortedCandidateBodyMetadataCenterX?.length ?? 16, 16) * 2;
    state.gpuConstraintSortedCandidateBodyMetadataCenterX = new Float32Array(nextLength);
    state.gpuConstraintSortedCandidateBodyMetadataCenterY = new Float32Array(nextLength);
    state.gpuConstraintSortedCandidateBodyMetadataRestRadius = new Float32Array(nextLength);
  }
  const centerX = state.gpuConstraintSortedCandidateBodyMetadataCenterX;
  const centerY = state.gpuConstraintSortedCandidateBodyMetadataCenterY;
  const restRadius = state.gpuConstraintSortedCandidateBodyMetadataRestRadius;
  centerX.fill(0, 0, bodyCount);
  centerY.fill(0, 0, bodyCount);
  restRadius.fill(0, 0, bodyCount);
  for (const [group, indices] of groups.entries()) {
    if (group <= 0 || indices.length === 0) continue;
    let cx = 0;
    let cy = 0;
    for (const index of indices) {
      const offset = index << 1;
      cx += engine.positions[offset];
      cy += engine.positions[offset + 1];
    }
    cx /= indices.length;
    cy /= indices.length;
    let radius = 0;
    for (const index of indices) {
      const offset = index << 1;
      const dx = engine.positions[offset] - cx;
      const dy = engine.positions[offset + 1] - cy;
      radius = Math.max(radius, Math.sqrt(dx * dx + dy * dy) + engine.radii[index]);
    }
    centerX[group] = cx;
    centerY[group] = cy;
    restRadius[group] = Math.max(kind === 'chain-rain' ? 12 : 8, radius);
  }
  const result = bridge.upload({
    bodyCount,
    centerX,
    centerY,
    restRadius,
  });
  state.gpuConstraintSortedCandidateBodyMetadataUploadFloats = result.uploadFloats;
  state.gpuConstraintSortedCandidateBodyMetadataCount = bodyCount;
}

function solveSortedConstraintCandidateCollisionStress(state: ConstraintRawState, kind: ConstraintDemoKind, particleCount: number): void {
  const gpu = state.gpuConstraintSortedCandidateState;
  const collision = state.gpuConstraintCollision;
  const pressure = state.gpuConstraintSortedCandidatePressure;
  const bodyShape = state.gpuConstraintSortedCandidateBodyShape;
  const neighbors = state.gpuConstraintSortedCandidateNeighbors;
  const gather = state.gpuConstraintSortedCandidateIndexMapGather;
  const gatherState = state.gpuConstraintSortedCandidateIndexMapGatherState;
  const indexMap = state.gpuConstraintSortedCandidateIndexMapSource === 'cpu-index-map-bridge'
    ? state.gpuConstraintSortedCandidateIndexMapBridge?.framebuffer
    : undefined;
  const candidateStats = state.gpuConstraintCandidateSlotStats;
  if (!gpu || !collision || !neighbors || !candidateStats || candidateStats.slotCount <= 0 || particleCount <= 0) {
    state.gpuConstraintSortedCandidateCollisionBatches = 0;
    state.gpuConstraintSortedCandidateCollisionFragmentTexels = 0;
    state.gpuConstraintSortedCandidateCollisionConsumedSlots = 0;
    state.gpuConstraintSortedCandidateCollisionIgnoredSlots = 0;
    state.gpuConstraintSortedCandidateCollisionSpatiallyComplete = false;
    state.gpuConstraintSortedCandidateCollisionStressActive = false;
    state.gpuConstraintSortedCandidatePressureBatches = 0;
    state.gpuConstraintSortedCandidatePressureFragmentTexels = 0;
    state.gpuConstraintSortedCandidatePressureConsumedSlots = 0;
    state.gpuConstraintSortedCandidatePressureIgnoredSlots = 0;
    state.gpuConstraintSortedCandidatePressureStressActive = false;
    state.gpuConstraintSortedCandidateBodyShapeFragmentTexels = 0;
    state.gpuConstraintSortedCandidateBodyShapeStressActive = false;
    state.gpuConstraintSortedCandidateIndexMapGatherFragmentTexels = 0;
    state.gpuConstraintSortedCandidateIndexMapGatherActive = false;
    return;
  }
  const slotCount = Math.min(candidateStats.slotCount, neighbors.framebuffers.length);
  let batches = 0;
  let fragmentTexels = 0;
  let consumedSlots = 0;
  for (let slotOffset = 0; slotOffset < slotCount; slotOffset += 8) {
    collision.solve({
      state: gpu,
      neighborSlots: neighbors.framebuffers,
      neighborSlotOffset: slotOffset,
      neighborSlotSource: 'gpu-sorted-cell-ranges',
      particleCount,
      iterations: 1,
      radiusScale: 1,
      stiffness: kind === 'chain-rain' ? 0.18 : 0.22,
      damping: kind === 'chain-rain' ? 0.006 : 0.008,
      spatiallyComplete: candidateStats.spatiallyComplete,
      slotOverflowCount: candidateStats.suitableForAuthoritativeCollision === true ? 0 : Math.max(0, (state.gpuConstraintSortedCandidateMaxCellOccupancy ?? 0) - CONSTRAINT_SORTED_CELL_RESIDENT_SCAN_LIMIT),
    });
    const stats = collision.stats();
    batches += 1;
    fragmentTexels += stats.fragmentTexels;
    consumedSlots += stats.neighborSlotCount;
  }
  state.gpuConstraintSortedCandidateCollisionBatches = batches;
  state.gpuConstraintSortedCandidateCollisionFragmentTexels = fragmentTexels;
  state.gpuConstraintSortedCandidateCollisionConsumedSlots = consumedSlots;
  state.gpuConstraintSortedCandidateCollisionIgnoredSlots = Math.max(0, slotCount - consumedSlots);
  state.gpuConstraintSortedCandidateCollisionSpatiallyComplete = candidateStats.spatiallyComplete;
  state.gpuConstraintSortedCandidateCollisionStressActive = batches > 0;
  if (pressure) {
    let pressureBatches = 0;
    let pressureFragmentTexels = 0;
    let pressureConsumedSlots = 0;
    for (let slotOffset = 0; slotOffset < slotCount; slotOffset += 8) {
      pressure.solve({
        state: gpu,
        neighborSlots: neighbors.framebuffers,
        neighborSlotOffset: slotOffset,
        particleCount,
        radiusScale: kind === 'chain-rain' ? 1.22 : 1.08,
        restDistanceScale: kind === 'chain-rain' ? 0.92 : 0.96,
        stiffness: kind === 'chain-rain' ? 0.045 : 0.055,
        velocityBlend: 0.12,
        sameBodyOnly: true,
        spatiallyComplete: candidateStats.spatiallyComplete,
        slotOverflowCount: candidateStats.suitableForAuthoritativeCollision === true ? 0 : Math.max(0, (state.gpuConstraintSortedCandidateMaxCellOccupancy ?? 0) - CONSTRAINT_SORTED_CELL_RESIDENT_SCAN_LIMIT),
      });
      const pressureStats = pressure.stats();
      pressureBatches += 1;
      pressureFragmentTexels += pressureStats.fragmentTexels;
      pressureConsumedSlots += pressureStats.neighborSlotCount;
    }
    state.gpuConstraintSortedCandidatePressureBatches = pressureBatches;
    state.gpuConstraintSortedCandidatePressureFragmentTexels = pressureFragmentTexels;
    state.gpuConstraintSortedCandidatePressureConsumedSlots = pressureConsumedSlots;
    state.gpuConstraintSortedCandidatePressureIgnoredSlots = Math.max(0, slotCount - pressureConsumedSlots);
    state.gpuConstraintSortedCandidatePressureStressActive = pressureBatches > 0;
  } else {
    state.gpuConstraintSortedCandidatePressureBatches = 0;
    state.gpuConstraintSortedCandidatePressureFragmentTexels = 0;
    state.gpuConstraintSortedCandidatePressureConsumedSlots = 0;
    state.gpuConstraintSortedCandidatePressureIgnoredSlots = 0;
    state.gpuConstraintSortedCandidatePressureStressActive = false;
  }
  const bodyMetadata = state.gpuConstraintSortedCandidateBodyMetadataBridge?.framebuffer;
  const bodyCount = state.gpuConstraintSortedCandidateBodyMetadataCount ?? 0;
  if (bodyShape && bodyMetadata && bodyCount > 1) {
    bodyShape.solve({
      state: gpu,
      bodyMetadata,
      particleCount,
      bodyCount,
      minRadiusScale: kind === 'chain-rain' ? 0 : 0.1,
      maxRadiusScale: kind === 'chain-rain' ? 1.04 : 1.12,
      stiffness: kind === 'chain-rain' ? 0.035 : 0.05,
      velocityBlend: 0.1,
    });
    const bodyShapeStats = bodyShape.stats();
    state.gpuConstraintSortedCandidateBodyShapeFragmentTexels = bodyShapeStats.fragmentTexels;
    state.gpuConstraintSortedCandidateBodyShapeStressActive = bodyShapeStats.fragmentTexels > 0;
  } else {
    state.gpuConstraintSortedCandidateBodyShapeFragmentTexels = 0;
    state.gpuConstraintSortedCandidateBodyShapeStressActive = false;
  }
  if (gather && gatherState && indexMap) {
    gather.gather({
      source: gpu,
      destination: gatherState,
      indexMap,
      particleCount,
    });
    const gatherStats = gather.stats();
    state.gpuConstraintSortedCandidateIndexMapGatherFragmentTexels = gatherStats.fragmentTexels;
    state.gpuConstraintSortedCandidateIndexMapGatherActive = gatherStats.fragmentTexels > 0;
  } else {
    state.gpuConstraintSortedCandidateIndexMapGatherFragmentTexels = 0;
    state.gpuConstraintSortedCandidateIndexMapGatherActive = false;
  }
}

function uploadSortedConstraintCandidateState(
  state: ConstraintRawState,
  engine: AdvancedCircleParticleEngine,
  size: { width: number; height: number },
  kind: ConstraintDemoKind,
): void {
  const count = engine.count;
  if (count <= 0) return;
  const gpu = ensureGpuConstraintSortedCandidateState(state, Math.max(1, engine.capacity));
  const requiredFloats = gpu.width * gpu.height * 4;
  const requiredCount = Math.max(1, count);
  if (!state.gpuConstraintSortedCandidatePositions || state.gpuConstraintSortedCandidatePositions.length !== requiredFloats) {
    state.gpuConstraintSortedCandidatePositions = new Float32Array(requiredFloats);
    state.gpuConstraintSortedCandidateVelocities = new Float32Array(requiredFloats);
    state.gpuConstraintSortedCandidateAttributes = new Float32Array(requiredFloats);
  }
  if (
    !state.gpuConstraintSortedCandidateKeys ||
    !state.gpuConstraintSortedCandidateSortedKeys ||
    !state.gpuConstraintSortedCandidateOrder ||
    state.gpuConstraintSortedCandidateKeys.length !== requiredCount ||
    state.gpuConstraintSortedCandidateSortedKeys.length !== requiredCount ||
    state.gpuConstraintSortedCandidateOrder.length !== requiredCount
  ) {
    state.gpuConstraintSortedCandidateKeys = new Float32Array(requiredCount);
    state.gpuConstraintSortedCandidateSortedKeys = new Float32Array(requiredCount);
    state.gpuConstraintSortedCandidateOrder = new Uint32Array(requiredCount);
  }
  const positions = state.gpuConstraintSortedCandidatePositions;
  const velocities = state.gpuConstraintSortedCandidateVelocities;
  const attributes = state.gpuConstraintSortedCandidateAttributes;
  const keys = state.gpuConstraintSortedCandidateKeys;
  const sortedKeys = state.gpuConstraintSortedCandidateSortedKeys;
  const order = state.gpuConstraintSortedCandidateOrder;
  if (!positions || !velocities || !attributes || !keys || !sortedKeys || !order) return;
  const cellSize = gpuConstraintGridCellSize(state, kind);
  const columns = Math.max(1, Math.ceil(size.width / Math.max(1, cellSize)));
  const rows = Math.max(1, Math.ceil(size.height / Math.max(1, cellSize)));
  const gpuSortSource = state.gpuConstraintState ?? gpu;
  const canUseGpuSortedGather =
    state.gpuConstraintState != null &&
    state.gpuConstraintSortedCandidateCellKeys != null &&
    state.gpuConstraintSortedCandidateKeySort != null &&
    state.gpuConstraintSortedCandidateSortedKeyGather != null;
  const sortStride = count + 1;
  for (let i = 0; i < count; i += 1) {
    const source = i << 1;
    const x = engine.positions[source];
    const y = engine.positions[source + 1];
    const cx = Math.max(0, Math.min(columns - 1, Math.floor(x / cellSize)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(y / cellSize)));
    keys[i] = (cy * columns + cx) * sortStride + i;
    order[i] = i;
  }
  order.sort((a, b) => keys[a] - keys[b]);
  for (let sortedIndex = 0; sortedIndex < count; sortedIndex += 1) {
    const sourceIndex = order[sortedIndex];
    const source = sourceIndex << 1;
    const target = sortedIndex * 4;
    sortedKeys[sortedIndex] = keys[sourceIndex];
    if (!canUseGpuSortedGather) {
      positions[target] = engine.positions[source];
      positions[target + 1] = engine.positions[source + 1];
      positions[target + 2] = engine.radii[sourceIndex];
      positions[target + 3] = engine.groups[sourceIndex];
      velocities[target] = engine.velocities[source];
      velocities[target + 1] = engine.velocities[source + 1];
      velocities[target + 2] = engine.inverseMasses[sourceIndex];
      velocities[target + 3] = 0;
      attributes[target] = engine.radii[sourceIndex];
      attributes[target + 1] = engine.inverseMasses[sourceIndex];
      attributes[target + 2] = engine.groups[sourceIndex];
      attributes[target + 3] = sourceIndex;
    }
  }
  if (canUseGpuSortedGather) {
    state.gpuConstraintSortedCandidateUploadFloats = 0;
    state.gpuConstraintSortedCandidateUploadMode = 'gpu-sorted-key-gather';
  } else {
    gpu.uploadSeed({ positions, velocities, attributes, uploadWriteTargets: false, particleCount: count });
    state.gpuConstraintSortedCandidateUploadFloats = gpu.seedUploadFloats();
    state.gpuConstraintSortedCandidateUploadMode = 'cpu-sorted-copy';
  }
  state.gpuConstraintSortedCandidateCellSize = cellSize;
  state.gpuConstraintSortedCandidateCellColumns = columns;
  state.gpuConstraintSortedCandidateCellRows = rows;
  state.gpuConstraintSortedCandidateOccupancyStats = state.gpuConstraintSortedCandidateOccupancy?.compute({
    state: canUseGpuSortedGather ? gpuSortSource : gpu,
    particleCount: count,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: size.width,
    worldMaxY: size.height,
    cellSize,
  });
  state.gpuConstraintSortedCandidateCellOffsetStats = state.gpuConstraintSortedCandidateOccupancy?.output
    ? state.gpuConstraintSortedCandidateCellOffsets?.compute({
        occupancy: state.gpuConstraintSortedCandidateOccupancy.output,
        gridColumns: state.gpuConstraintSortedCandidateOccupancyStats?.gridColumns ?? 1,
        gridRows: state.gpuConstraintSortedCandidateOccupancyStats?.gridRows ?? 1,
      })
    : undefined;
  state.gpuConstraintSortedCandidateCellRangeStats =
    state.gpuConstraintSortedCandidateOccupancy?.output && state.gpuConstraintSortedCandidateCellOffsets?.output
      ? state.gpuConstraintSortedCandidateCellRanges?.compute({
          occupancy: state.gpuConstraintSortedCandidateOccupancy.output,
          inclusiveOffsets: state.gpuConstraintSortedCandidateCellOffsets.output,
          gridColumns: state.gpuConstraintSortedCandidateOccupancyStats?.gridColumns ?? 1,
          gridRows: state.gpuConstraintSortedCandidateOccupancyStats?.gridRows ?? 1,
        })
      : undefined;
  state.gpuConstraintSortedCandidateCellKeyStats = state.gpuConstraintSortedCandidateCellKeys?.compute({
    state: gpuSortSource,
    particleCount: count,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: size.width,
    worldMaxY: size.height,
    cellSize,
  });
  state.gpuConstraintSortedCandidateKeySortStats = state.gpuConstraintSortedCandidateCellKeys?.output
    ? state.gpuConstraintSortedCandidateKeySort?.sort({
        source: state.gpuConstraintSortedCandidateCellKeys.output,
        sourceWidth: state.gpuConstraintSortedCandidateCellKeyStats?.width ?? gpu.width,
        sourceHeight: state.gpuConstraintSortedCandidateCellKeyStats?.height ?? 1,
        elementCount: count,
      })
    : undefined;
  state.gpuConstraintSortedCandidateSortedKeyRangeStats = state.gpuConstraintSortedCandidateKeySort?.output && state.gpuConstraintSortedCandidateKeySortStats
    ? state.gpuConstraintSortedCandidateSortedKeyRanges?.compute({
        sortedKeys: state.gpuConstraintSortedCandidateKeySort.output,
        sortedKeyWidth: state.gpuConstraintSortedCandidateKeySortStats.width,
        sortedKeyHeight: state.gpuConstraintSortedCandidateKeySortStats.height,
        elementCount: count,
        gridColumns: columns,
        gridRows: rows,
      })
    : undefined;
  if (state.gpuConstraintSortedCandidateKeySort?.output && state.gpuConstraintSortedCandidateKeySortStats) {
    state.gpuConstraintSortedCandidateSortedKeyGather?.gather({
      source: gpuSortSource,
      destination: gpu,
      sortedKeys: state.gpuConstraintSortedCandidateKeySort.output,
      sortedKeyWidth: state.gpuConstraintSortedCandidateKeySortStats.width,
      sortedKeyHeight: state.gpuConstraintSortedCandidateKeySortStats.height,
      particleCount: count,
    });
    state.gpuConstraintSortedCandidateSortedKeyGatherStats = state.gpuConstraintSortedCandidateSortedKeyGather?.stats();
  } else {
    state.gpuConstraintSortedCandidateSortedKeyGatherStats = undefined;
  }
  const sortedKeyRanges = state.gpuConstraintSortedCandidateSortedKeyRangeStats?.suitableForSortedCandidateBridge === true
    ? state.gpuConstraintSortedCandidateSortedKeyRanges?.output
    : undefined;
  const occupancyOffsetRanges = state.gpuConstraintSortedCandidateCellRanges?.output;
  const gpuCellRanges = sortedKeyRanges ?? occupancyOffsetRanges;
  const range = gpuCellRanges
    ? undefined
    : state.gpuConstraintSortedCandidateCellRangeBridge?.upload({
        sortedKeys,
        particleCount: count,
        columns,
        rows,
      });
  state.gpuConstraintSortedCandidateCellRangeUploadFloats = gpuCellRanges ? 0 : range?.uploadFloats ?? 0;
  state.gpuConstraintSortedCandidateCellRangeSource = sortedKeyRanges
    ? 'gpu-sorted-key-range'
    : occupancyOffsetRanges
      ? 'gpu-occupancy-offset-range'
      : range
        ? 'cpu-cell-range-bridge'
        : 'none';
  state.gpuConstraintSortedCandidateMaxCellOccupancy = gpuCellRanges
    ? maxConstraintCellOccupancyFromSortedKeys(sortedKeys, count, sortStride)
    : range?.maxCellOccupancy ?? 0;
  state.gpuConstraintSortedCandidateResidentListStats =
    state.gpuConstraintSortedCandidateKeySort?.output && state.gpuConstraintSortedCandidateKeySortStats
      ? state.gpuConstraintSortedCandidateResidentList?.compute({
          sortedKeys: state.gpuConstraintSortedCandidateKeySort.output,
          sortedKeyWidth: state.gpuConstraintSortedCandidateKeySortStats.width,
          sortedKeyHeight: state.gpuConstraintSortedCandidateKeySortStats.height,
          elementCount: count,
          gridColumns: columns,
          gridRows: rows,
          residentLimit: CONSTRAINT_SORTED_CELL_RESIDENT_SCAN_LIMIT,
          maxCellOccupancy: state.gpuConstraintSortedCandidateMaxCellOccupancy ?? 0,
        })
      : undefined;
  state.gpuConstraintResidentListCandidateStats =
    state.gpuConstraintSortedCandidateCellKeys?.output &&
    state.gpuConstraintSortedCandidateResidentList?.output &&
    state.gpuConstraintResidentListCandidateSlots &&
    state.gpuConstraintResidentListCandidateNeighbors
      ? state.gpuConstraintResidentListCandidateSlots.generate({
          state: gpuSortSource,
          gridKeys: state.gpuConstraintSortedCandidateCellKeys.output,
          residentList: state.gpuConstraintSortedCandidateResidentList.output,
          outputSlots: state.gpuConstraintResidentListCandidateNeighbors.framebuffers,
          particleCount: count,
          gridColumns: columns,
          gridRows: rows,
          residentLimit: state.gpuConstraintSortedCandidateResidentListStats?.residentLimit ?? CONSTRAINT_SORTED_CELL_RESIDENT_SCAN_LIMIT,
          residentListTextureWidth: state.gpuConstraintSortedCandidateResidentList.output.texture.width,
          residentListTextureHeight: state.gpuConstraintSortedCandidateResidentList.output.texture.height,
          maxCellOccupancy: state.gpuConstraintSortedCandidateMaxCellOccupancy ?? 0,
        })
      : undefined;
  if (
    state.gpuConstraintSortedCandidateIndexMapBridge &&
    state.gpuConstraintSortedCandidateUploadMode === 'gpu-sorted-key-gather'
  ) {
    const mapResult = state.gpuConstraintSortedCandidateIndexMapBridge.uploadFromSortedKeys({
      sortedKeys,
      particleCount: count,
      sortStride,
      sortedTextureWidth: gpu.width,
      targetWidth: gpu.width,
      targetHeight: gpu.height,
    });
    state.gpuConstraintSortedCandidateIndexMapUploadFloats = mapResult.uploadFloats;
    state.gpuConstraintSortedCandidateIndexMapSource = 'cpu-index-map-bridge';
  } else {
    state.gpuConstraintSortedCandidateIndexMapUploadFloats = 0;
    state.gpuConstraintSortedCandidateIndexMapSource = state.gpuConstraintSortedCandidateUploadMode === 'gpu-sorted-key-gather'
      ? 'none'
      : 'skipped-non-gpu-sorted-state';
  }
  uploadSortedConstraintGroupMetadata(state, engine, kind);
  state.gpuConstraintGridKeyStats = state.gpuConstraintSortedCandidateGridKey?.compute({
    state: gpu,
    particleCount: count,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: size.width,
    worldMaxY: size.height,
    cellSize,
  });
  const cellRanges = sortedKeyRanges ?? occupancyOffsetRanges ?? state.gpuConstraintSortedCandidateCellRangeBridge?.framebuffer;
  state.gpuConstraintCandidateSlotStats = state.gpuConstraintSortedCandidateGridKey && state.gpuConstraintSortedCellCandidateSlots && state.gpuConstraintSortedCandidateNeighbors && cellRanges
    ? state.gpuConstraintSortedCellCandidateSlots.generate({
      state: gpu,
      gridKeys: state.gpuConstraintSortedCandidateGridKey.output,
      cellRanges,
      outputSlots: state.gpuConstraintSortedCandidateNeighbors.framebuffers,
      particleCount: count,
      gridColumns: columns,
      gridRows: rows,
      residentScanLimit: CONSTRAINT_SORTED_CELL_RESIDENT_SCAN_LIMIT,
      cellRangeTextureWidth: cellRanges.texture.width,
      cellRangeTextureHeight: cellRanges.texture.height,
      maxCellOccupancy: state.gpuConstraintSortedCandidateMaxCellOccupancy ?? 0,
    })
    : undefined;
}

function markGpuConstraintDirty(state: ConstraintRawState, topologyChanged = true): void {
  state.needsRedraw = true;
  state.gpuConstraintNeedsSeed = true;
  if (topologyChanged) {
    state.gpuConstraintNeedsTopologySeed = true;
    state.gpuConstraintCandidateTelemetryLastSeconds = undefined;
    state.gpuConstraintCandidateTelemetryStaleSeconds = 0;
  }
}

function resetLiveGpuStepTelemetry(state: ConstraintRawState): void {
  state.liveGpuStepSource = 'none';
  state.liveGpuStepParticleCount = 0;
  state.liveGpuStepActiveRows = 0;
  state.liveGpuStepFragmentTexels = 0;
  state.liveGpuStepDt = 0;
}

function resetLiveGpuDynamicUploadSkipTelemetry(state: ConstraintRawState): void {
  state.liveGpuDynamicUploadSkipped = false;
  state.liveGpuDynamicUploadSkipBlocker = 'gpu-state-not-seeded';
}

function gpuConstraintDynamicUploadSkipBlocker(
  state: ConstraintRawState,
  stats: Pick<AdvancedCircleParticleStats, 'count' | 'linkCount'>,
  previewLike: boolean,
): ConstraintGpuDynamicUploadSkipBlocker {
  if (!previewLike) return 'not-demo-or-preview';
  if (state.pointerDown === true || state.drawing === true) return 'pointer-active';
  if (state.gpuConstraintUploadedParticleCount == null || state.gpuConstraintNeedsSeed !== false) return 'gpu-state-not-seeded';
  if (state.gpuConstraintUploadedParticleCount !== stats.count) return 'particle-count-changed';
  if (state.gpuConstraintNeedsTopologySeed !== false || state.gpuConstraintLinkCount !== stats.linkCount) return 'topology-dirty';
  if (state.gpuConstraintForceFullStaticUpload === true || state.gpuConstraintForceFullTopologyUpload === true) return 'static-state-dirty';
  return 'none';
}

function constraintSceneShouldRender(state: ConstraintRawState, preview: boolean): boolean {
  if (preview || state.mode === 'demo') return true;
  if (state.needsRedraw === true || state.pointerDown === true || state.drawing === true) return true;
  const engine = state.engine;
  if (engine && engine.count > 0) return engine.isAwake;
  if ((state.drawPoints?.length ?? 0) > 0) return true;
  return false;
}

function syncGpuConstraintStateFromEngine(state: ConstraintRawState, includeStatic = true, includeVelocities = true): void {
  const engine = state.engine;
  const gpu = state.gpuConstraintState;
  const neighbors = state.gpuConstraintNeighbors;
  if (!engine || !gpu || !neighbors || !ensureGpuConstraintBuffers(state)) return;
  const positions = state.gpuConstraintPositions;
  const velocities = state.gpuConstraintVelocities;
  const attributes = state.gpuConstraintAttributes;
  const neighborData = state.gpuConstraintNeighborData;
  if (!positions || !velocities || !attributes || !neighborData) return;
  const stats = engine.getStats();
  const particleUploadCount = Math.max(stats.count, state.gpuConstraintUploadedParticleCount ?? 0, 1);
  const previousUploadedParticleCount = state.gpuConstraintUploadedParticleCount;
  resetLiveGpuDynamicUploadSkipTelemetry(state);
  state.gpuConstraintSeededThisFrame = false;
  state.gpuConstraintActiveRows = activeTextureRows(stats.count, gpu.width, gpu.height);
  state.gpuConstraintUploadedRows = activeTextureRows(particleUploadCount, gpu.width, gpu.height);
  if (state.gpuConstraintNeedsSeed !== false) {
    state.gpuConstraintSeededThisFrame = true;
    state.liveGpuDirectUploadFloats = 0;
    state.liveGpuPaddedUploadFloats = 0;
    state.liveGpuStaticAttributeWriteCount = 0;
    state.liveGpuStaticUploadMode = 'none';
    if (includeStatic) {
      if (includeVelocities) {
        engine.writeGpuParticleState(positions, velocities, attributes, gpu.capacity, particleUploadCount);
        gpu.uploadSeed({ positions, velocities, attributes, uploadWriteTargets: false, particleCount: particleUploadCount });
        state.gpuConstraintActiveRows = gpu.particleActiveRows();
        state.gpuConstraintUploadedRows = gpu.particleUploadedRows();
        state.gpuConstraintStateSeedUploadFloats = gpu.seedUploadFloats();
        state.liveGpuDynamicUploadFloats = 0;
        state.liveGpuStaticUploadFloats = state.gpuConstraintStateSeedUploadFloats;
        state.liveGpuStaticUploadMode = 'full';
        state.liveGpuDirectUploadFloats += gpu.directUploadFloats();
        state.liveGpuPaddedUploadFloats += gpu.paddedUploadFloats();
        state.liveGpuVelocityUploadSkipped = false;
      } else {
        engine.writeGpuParticlePositionState(positions, gpu.capacity, particleUploadCount);
        const fullStaticUpload = state.gpuConstraintForceFullStaticUpload === true || previousUploadedParticleCount == null || previousUploadedParticleCount === stats.count;
        if (fullStaticUpload) {
          state.liveGpuStaticAttributeWriteCount = engine.writeGpuParticleAttributeState(attributes, gpu.capacity, particleUploadCount);
          state.liveGpuStaticUploadMode = 'full';
        } else if (previousUploadedParticleCount < stats.count) {
          state.liveGpuStaticAttributeWriteCount = engine.writeGpuParticleAttributeStateRange(attributes, previousUploadedParticleCount, stats.count - previousUploadedParticleCount);
          state.liveGpuStaticUploadMode = 'append-range';
        } else {
          state.liveGpuStaticAttributeWriteCount = engine.writeGpuParticleAttributeStateRange(attributes, stats.count, previousUploadedParticleCount - stats.count);
          state.liveGpuStaticUploadMode = 'shrink-range';
        }
        gpu.uploadDynamicState({ positions, uploadWriteTargets: false, particleCount: particleUploadCount });
        state.gpuConstraintActiveRows = gpu.particleActiveRows();
        state.gpuConstraintUploadedRows = gpu.particleUploadedRows();
        state.liveGpuDirectUploadFloats += gpu.directUploadFloats();
        state.liveGpuPaddedUploadFloats += gpu.paddedUploadFloats();
        if (fullStaticUpload) {
          gpu.uploadAttributes({ attributes, particleCount: particleUploadCount });
        } else if (previousUploadedParticleCount < stats.count) {
          gpu.uploadAttributeRange(attributes, previousUploadedParticleCount, stats.count - previousUploadedParticleCount);
        } else {
          gpu.uploadAttributeRange(attributes, stats.count, previousUploadedParticleCount - stats.count);
        }
        state.gpuConstraintStateSeedUploadFloats = gpu.dynamicUploadFloats();
        state.liveGpuDynamicUploadFloats = gpu.dynamicUploadFloats();
        state.liveGpuStaticUploadFloats = gpu.attributeUploadFloats();
        state.liveGpuDirectUploadFloats += gpu.directUploadFloats();
        state.liveGpuPaddedUploadFloats += gpu.paddedUploadFloats();
        state.liveGpuVelocityUploadSkipped = true;
      }
    } else {
      if (includeVelocities) {
        engine.writeGpuParticleDynamicState(positions, velocities, gpu.capacity, particleUploadCount);
        gpu.uploadDynamicState({ positions, velocities, uploadWriteTargets: false, particleCount: particleUploadCount });
        state.gpuConstraintActiveRows = gpu.particleActiveRows();
        state.gpuConstraintUploadedRows = gpu.particleUploadedRows();
        state.liveGpuDirectUploadFloats += gpu.directUploadFloats();
        state.liveGpuPaddedUploadFloats += gpu.paddedUploadFloats();
        state.liveGpuVelocityUploadSkipped = false;
      } else {
        engine.writeGpuParticlePositionState(positions, gpu.capacity, particleUploadCount);
        gpu.uploadDynamicState({ positions, uploadWriteTargets: false, particleCount: particleUploadCount });
        state.gpuConstraintActiveRows = gpu.particleActiveRows();
        state.gpuConstraintUploadedRows = gpu.particleUploadedRows();
        state.liveGpuDirectUploadFloats += gpu.directUploadFloats();
        state.liveGpuPaddedUploadFloats += gpu.paddedUploadFloats();
        state.liveGpuVelocityUploadSkipped = true;
      }
      state.gpuConstraintStateSeedUploadFloats = gpu.dynamicUploadFloats();
      state.liveGpuDynamicUploadFloats = state.gpuConstraintStateSeedUploadFloats;
      state.liveGpuStaticUploadFloats = 0;
      state.liveGpuStaticUploadMode = 'none';
    }
  }
  state.liveGpuNeighborDirectUploadFloats = 0;
  state.liveGpuNeighborPaddedUploadFloats = 0;
  state.liveGpuNeighborSlotWriteCount = 0;
  state.liveGpuNeighborTopologyRangeStart = 0;
  state.liveGpuNeighborTopologyRangeCount = 0;
  if (state.gpuConstraintNeedsTopologySeed !== false) {
    const dirtyTopologyRange = engine.consumeDistanceConstraintNeighborDirtyRange();
    if (state.gpuConstraintForceFullTopologyUpload === true || previousUploadedParticleCount == null || dirtyTopologyRange == null) {
      state.liveGpuNeighborSlotWriteCount = engine.writeDistanceConstraintNeighborSlots(neighborData, particleUploadCount);
      neighbors.uploadActiveSlots(neighborData, particleUploadCount);
      state.liveGpuNeighborTopologyRangeStart = 0;
      state.liveGpuNeighborTopologyRangeCount = particleUploadCount;
    } else {
      state.liveGpuNeighborSlotWriteCount = engine.writeDistanceConstraintNeighborSlotsRange(neighborData, dirtyTopologyRange.start, dirtyTopologyRange.count);
      neighbors.uploadActiveSlotRange(neighborData, dirtyTopologyRange.start, dirtyTopologyRange.count);
      state.liveGpuNeighborTopologyRangeStart = dirtyTopologyRange.start;
      state.liveGpuNeighborTopologyRangeCount = dirtyTopologyRange.count;
    }
    state.gpuConstraintTopologySeedUploadFloats = neighbors.seedUploadFloats();
    state.liveGpuNeighborDirectUploadFloats = neighbors.directUploadFloats();
    state.liveGpuNeighborPaddedUploadFloats = neighbors.paddedUploadFloats();
  }
  state.gpuConstraintParticleCount = stats.count;
  state.gpuConstraintLinkCount = stats.linkCount;
  state.stats = stats;
  state.gpuConstraintUploadedParticleCount = stats.count;
  state.gpuConstraintNeedsSeed = false;
  state.gpuConstraintNeedsTopologySeed = false;
  state.gpuConstraintForceFullStaticUpload = false;
  state.gpuConstraintForceFullTopologyUpload = false;
}

function activeTextureRows(count: number, width: number, height: number): number {
  return Math.max(1, Math.min(height, Math.ceil(Math.max(1, Math.floor(count)) / Math.max(1, width))));
}

function gpuConstraintGridCellSize(state: ConstraintRawState, kind: ConstraintDemoKind): number {
  const engineCellSize = state.stats?.cellSize ?? state.engine?.getStats().cellSize;
  if (typeof engineCellSize === 'number' && Number.isFinite(engineCellSize) && engineCellSize > 0) return engineCellSize;
  return kind === 'chain-rain'
    ? Math.max(4, finiteNumberSetting(state.settings, 'nodeRadius', 5) * 2.5)
    : Math.max(4, softBlobNodeRadius(state) * 2.5);
}

function liveGpuConstraintCapacityForCount(count: number, maxCapacity: number, currentCapacity = 0): number {
  const target = Math.max(256, Math.ceil(Math.max(1, count) * 1.35));
  if (currentCapacity > 0 && target <= currentCapacity && target >= currentCapacity * 0.25) return currentCapacity;
  let capacity = 256;
  while (capacity < target && capacity < maxCapacity) capacity *= 2;
  return Math.min(maxCapacity, capacity);
}

function renderGpuConstraintPreview(state: ConstraintRawState, kind: ConstraintDemoKind, size: { width: number; height: number }): boolean {
  const gpu = state.gpuConstraintState;
  const step = state.gpuConstraintStep;
  const jacobi = state.gpuConstraintJacobi;
  const collision = state.gpuConstraintCollision;
  const candidateSlots = state.gpuConstraintCandidateSlots;
  const gridKey = state.gpuConstraintGridKey;
  const neighbors = state.gpuConstraintNeighbors;
  const candidateNeighbors = state.gpuConstraintCandidateNeighbors;
  const densityRenderer = state.gpuConstraintDensityRenderer;
  if (!gpu || !step || !jacobi || !collision || !neighbors || !densityRenderer) return false;
  const dt = Math.min(1 / 30, state.deltaSeconds || 1 / 60);
  const particleCount = state.gpuConstraintParticleCount ?? gpu.capacity;
  const uploadSkipBlocker = gpuConstraintDynamicUploadSkipBlocker(state, state.stats ?? state.engine?.getStats() ?? {
    count: particleCount,
    linkCount: state.gpuConstraintLinkCount ?? 0,
  }, true);
  const persistentStep = state.gpuConstraintSeededThisFrame !== true && uploadSkipBlocker === 'none';
  state.liveGpuStepSource = persistentStep ? 'persistent-gpu-step-probe' : 'cpu-seeded-gpu-step-probe';
  step.step({
    state: gpu,
    dt,
    gravityY: finiteNumberSetting(state.settings, 'gravity', 1100),
    damping: 0.996,
    speedLimit: 2400,
    bounds: {
      minX: 0,
      minY: -size.height * 0.45,
      maxX: size.width,
      maxY: size.height,
    },
    bounce: 0.08,
    particleCount,
  });
  const stepStats = step.stats();
  state.liveGpuStepParticleCount = particleCount;
  state.liveGpuStepActiveRows = stepStats.activeRows;
  state.liveGpuStepFragmentTexels = stepStats.fragmentTexels;
  state.liveGpuStepDt = dt;
  state.liveGpuDynamicUploadSkipped = persistentStep;
  state.liveGpuDynamicUploadSkipBlocker = persistentStep
    ? 'none'
    : state.gpuConstraintSeededThisFrame === true
      ? 'gpu-state-not-seeded'
      : uploadSkipBlocker;
  const passes = Math.max(1, Math.min(8, Math.floor(finiteNumberSetting(state.settings, 'solverPasses', 3))));
  for (let pass = 0; pass < passes; pass += 1) {
    jacobi.solve({
      state: gpu,
      neighborSlots: neighbors.framebuffers,
      stiffnessScale: finiteNumberSetting(state.settings, 'constraintStiffness', 0.78),
      damping: 0.02,
      particleCount,
    });
  }
  state.gpuConstraintCollisionNeighborStats = undefined;
  state.gpuConstraintGridKeyStats = gridKey?.compute({
    state: gpu,
    particleCount,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: size.width,
    worldMaxY: size.height,
    cellSize: gpuConstraintGridCellSize(state, kind),
  });
  state.gpuConstraintCandidateSlotStats = gridKey && candidateSlots && candidateNeighbors
    ? candidateSlots.generate({
      state: gpu,
      gridKeys: gridKey.output,
      outputSlots: candidateNeighbors.framebuffers,
      particleCount,
    })
    : undefined;
  state.gpuConstraintCollisionNeighborUploadFloats = 0;
  state.gpuConstraintCollisionNeighborDirectUploadFloats = 0;
  state.gpuConstraintCollisionNeighborPaddedUploadFloats = 0;
  state.gpuConstraintCollisionNeighborActiveRows = 0;
  state.gpuConstraintCollisionNeighborUploadedRows = 0;
  state.gpuConstraintCollisionNeighborReservedRows = state.gpuConstraintCollisionNeighbors?.reservedRows() ?? 0;
  collision.solve({
    state: gpu,
    ...(candidateNeighbors ? {
      neighborSlots: candidateNeighbors.framebuffers,
      neighborSlotSource: 'gpu-grid-key-window' as const,
    } : {}),
    particleCount,
    iterations: kind === 'chain-rain' ? 1 : 2,
    neighborhood: 'moore3x3',
    stiffness: kind === 'chain-rain' ? 0.24 : 0.32,
    damping: 0.012,
    spatiallyComplete: false,
  });
  if (!ensureDensityTarget(state) || !state.densityFramebuffer) return false;
  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.densityFramebuffer);
  gl.viewport(0, 0, state.densityWidth ?? state.width, state.densityHeight ?? state.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const gatherStats = state.gpuConstraintSortedCandidateIndexMapGather?.stats();
  const originalOrderGatherComplete =
    state.gpuConstraintSortedCandidateIndexMapGatherActive === true &&
    gatherStats?.suitableForOriginalOrderFeedback === true &&
    gatherStats.destinationOrder === 'original-index';
  const sortedCandidateSlotsComplete =
    state.gpuConstraintSortedCandidateCollisionStressActive === true &&
    (state.gpuConstraintSortedCandidateCollisionIgnoredSlots ?? 0) === 0;
  const sortedCandidateSpatiallyComplete =
    Boolean(state.gpuConstraintCandidateSlotStats?.suitableForAuthoritativeCollision) &&
    state.gpuConstraintSortedCandidateCollisionSpatiallyComplete === true;
  const sortedCandidateStateIsGpuOwned = state.gpuConstraintSortedCandidateUploadMode === 'gpu-sorted-key-gather';
  const feedbackRenderBlocker =
    kind !== 'chain-rain'
      ? 'not-snakes'
      : !sortedCandidateStateIsGpuOwned
        ? 'sorted-state-still-cpu-uploaded'
        : !originalOrderGatherComplete
          ? 'original-order-gather-not-complete'
          : !sortedCandidateSlotsComplete
            ? 'candidate-slots-not-fully-consumed'
            : !sortedCandidateSpatiallyComplete
              ? 'gpu-broadphase-not-spatially-complete'
              : !state.gpuConstraintSortedCandidateIndexMapGatherState
                ? 'gather-state-missing'
                : 'none';
  const feedbackRenderEligible = feedbackRenderBlocker === 'none';
  const densityState = feedbackRenderEligible ? state.gpuConstraintSortedCandidateIndexMapGatherState ?? gpu : gpu;
  state.liveGpuDensitySource = feedbackRenderEligible ? 'sorted-candidate-gathered-state' : 'cpu-live-state';
  state.liveGpuSortedCandidateFeedbackRenderEligible = feedbackRenderEligible;
  state.liveGpuSortedCandidateFeedbackRenderActive = feedbackRenderEligible;
  state.liveGpuSortedCandidateFeedbackRenderBlocker = feedbackRenderBlocker;
  densityRenderer.render({
    state: densityState,
    target: state.densityFramebuffer,
    width: state.densityWidth ?? state.width,
    height: state.densityHeight ?? state.height,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: size.width,
    worldMaxY: size.height,
    opacity: 1,
    fieldScale: kind === 'chain-rain' ? 2.35 : 2.85,
    particleCount,
  });
  return compositeDensityBody(state, kind);
}

function renderLiveGpuDensityBody(state: ConstraintRawState, kind: ConstraintDemoKind, size: { width: number; height: number }): boolean {
  const engine = state.engine;
  if (!engine || engine.count <= 0) return false;
  const liveCapacity = liveGpuConstraintCapacityForCount(engine.count, engine.capacity, state.gpuConstraintState?.capacity ?? 0);
  if (!ensureGpuConstraintPreviewState(state, kind, liveCapacity)) return false;
  const gpu = state.gpuConstraintState;
  const collision = state.gpuConstraintCollision;
  const collisionNeighbors = state.gpuConstraintCollisionNeighbors;
  const densityRenderer = state.gpuConstraintDensityRenderer;
  if (!gpu || !densityRenderer || !ensureDensityTarget(state) || !state.densityFramebuffer) return false;
  const stats = engine.getStats();
  const topologyChanged = stats.count !== state.gpuConstraintParticleCount || stats.linkCount !== state.gpuConstraintLinkCount;
  const includeStatic = topologyChanged || state.gpuConstraintUploadedParticleCount == null || state.gpuConstraintNeedsTopologySeed !== false;
  resetLiveGpuStepTelemetry(state);
  state.liveGpuDynamicUploadSkipped = false;
  state.liveGpuDynamicUploadSkipBlocker = gpuConstraintDynamicUploadSkipBlocker(state, stats, false);
  state.gpuConstraintNeedsSeed = true;
  if (includeStatic) state.gpuConstraintNeedsTopologySeed = true;
  syncGpuConstraintStateFromEngine(state, includeStatic, false);
  const particleCount = state.gpuConstraintParticleCount ?? stats.count;
  const candidateTelemetryStaleSeconds = state.timeSeconds - (state.gpuConstraintCandidateTelemetryLastSeconds ?? -Infinity);
  const refreshCandidateTelemetry = topologyChanged || state.gpuConstraintCandidateTelemetryLastSeconds == null || candidateTelemetryStaleSeconds >= 0.2;
  state.gpuConstraintCandidateTelemetrySampled = false;
  state.gpuConstraintCandidateTelemetryStaleSeconds = Number.isFinite(candidateTelemetryStaleSeconds) ? Math.max(0, candidateTelemetryStaleSeconds) : 0;
  if (refreshCandidateTelemetry) {
    uploadSortedConstraintCandidateState(state, engine, size, kind);
    solveSortedConstraintCandidateCollisionStress(state, kind, particleCount);
    state.gpuConstraintCandidateTelemetryLastSeconds = state.timeSeconds;
    state.gpuConstraintCandidateTelemetryFrame = (state.gpuConstraintCandidateTelemetryFrame ?? 0) + 1;
    state.gpuConstraintCandidateTelemetrySampled = true;
    state.gpuConstraintCandidateTelemetryStaleSeconds = 0;
  }
  const residentListCollisionReady =
    Boolean(state.gpuConstraintCandidateTelemetrySampled) &&
    state.gpuConstraintResidentListCandidateStats?.suitableForAuthoritativeCollision === true &&
    state.gpuConstraintResidentListCandidateStats.indexOrder === 'original-index' &&
    state.gpuConstraintResidentListCandidateNeighbors != null;
  const liveNeighborSlots = residentListCollisionReady
    ? state.gpuConstraintResidentListCandidateNeighbors?.framebuffers
    : collisionNeighbors?.framebuffers;
  const liveCollisionSource: ConstraintGpuCollisionSource = residentListCollisionReady ? 'gpu-resident-list' : 'cpu-spatial-neighbor-slots';
  state.gpuConstraintCollisionSource = liveCollisionSource;
  state.gpuConstraintCollisionLiveBroadphaseAuthoritativeReady = residentListCollisionReady;
  const collisionNeighborData = state.gpuConstraintCollisionNeighborData;
  if (residentListCollisionReady) {
    state.gpuConstraintCollisionNeighborStats = undefined;
    state.gpuConstraintCollisionNeighborUploadFloats = 0;
    state.gpuConstraintCollisionNeighborDirectUploadFloats = 0;
    state.gpuConstraintCollisionNeighborPaddedUploadFloats = 0;
    state.gpuConstraintCollisionNeighborActiveRows = 0;
    state.gpuConstraintCollisionNeighborUploadedRows = 0;
    state.gpuConstraintCollisionNeighborReservedRows = 0;
    state.gpuConstraintCollisionNeighborUploadSkipped = true;
    state.gpuConstraintCollisionNeighborUploadSource = 'gpu-resident-list';
  } else if (collisionNeighbors && collisionNeighborData) {
    const collisionNeighborStats = engine.writeSpatialCollisionNeighborSlots(collisionNeighborData, particleCount, kind === 'chain-rain' ? 1.15 : 1.08);
    collisionNeighbors.uploadActiveSlots(collisionNeighborData, particleCount);
    state.gpuConstraintCollisionNeighborStats = collisionNeighborStats;
    state.gpuConstraintCollisionNeighborUploadFloats = collisionNeighbors.seedUploadFloats();
    state.gpuConstraintCollisionNeighborDirectUploadFloats = collisionNeighbors.directUploadFloats();
    state.gpuConstraintCollisionNeighborPaddedUploadFloats = collisionNeighbors.paddedUploadFloats();
    state.gpuConstraintCollisionNeighborActiveRows = collisionNeighbors.activeRows();
    state.gpuConstraintCollisionNeighborUploadedRows = collisionNeighbors.uploadedRows();
    state.gpuConstraintCollisionNeighborReservedRows = collisionNeighbors.reservedRows();
    state.gpuConstraintCollisionNeighborUploadSkipped = false;
    state.gpuConstraintCollisionNeighborUploadSource = 'cpu-spatial-neighbor-slots';
  }
  if (collision && liveNeighborSlots) {
    collision.solve({
      state: gpu,
      neighborSlots: liveNeighborSlots,
      neighborSlotSource: liveCollisionSource,
      particleCount,
      iterations: 1,
      stiffness: kind === 'chain-rain' ? 0.22 : 0.28,
      damping: 0.01,
      spatiallyComplete: residentListCollisionReady
        ? state.gpuConstraintResidentListCandidateStats?.spatiallyComplete === true
        : state.gpuConstraintCollisionNeighborStats?.spatiallyComplete ?? false,
      slotOverflowCount: residentListCollisionReady ? 0 : state.gpuConstraintCollisionNeighborStats?.overflowCount ?? 0,
    });
  } else {
    state.gpuConstraintCollisionNeighborStats = undefined;
    state.gpuConstraintCollisionNeighborUploadFloats = 0;
    state.gpuConstraintCollisionNeighborDirectUploadFloats = 0;
    state.gpuConstraintCollisionNeighborPaddedUploadFloats = 0;
    state.gpuConstraintCollisionNeighborActiveRows = 0;
    state.gpuConstraintCollisionNeighborUploadedRows = 0;
    state.gpuConstraintCollisionNeighborReservedRows = collisionNeighbors?.reservedRows() ?? 0;
    state.gpuConstraintCollisionNeighborUploadSkipped = false;
    state.gpuConstraintCollisionNeighborUploadSource = 'none';
  }

  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.densityFramebuffer);
  gl.viewport(0, 0, state.densityWidth ?? state.width, state.densityHeight ?? state.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  densityRenderer.render({
    state: gpu,
    target: state.densityFramebuffer,
    width: state.densityWidth ?? state.width,
    height: state.densityHeight ?? state.height,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: size.width,
    worldMaxY: size.height,
    opacity: 1,
    fieldScale: kind === 'chain-rain' ? 2.35 : 2.85,
    particleCount: state.gpuConstraintParticleCount ?? stats.count,
  });
  const densityStats = densityRenderer.stats();
  state.liveGpuDensityRendered = true;
  state.liveGpuDensityPointDraws = densityStats.pointDraws;
  state.densityUploadFloats = (
    (state.gpuConstraintStateSeedUploadFloats ?? 0) +
    (includeStatic ? state.gpuConstraintTopologySeedUploadFloats ?? 0 : 0) +
    (state.gpuConstraintCollisionNeighborUploadFloats ?? 0)
  );
  return compositeDensityBody(state, kind);
}

function logicalSize(state: ConstraintRawState): { width: number; height: number } {
  return {
    width: Math.max(1, state.canvas.clientWidth || state.width),
    height: Math.max(1, state.canvas.clientHeight || state.height),
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function length2d(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function renderStyleIsEnhanced(state: ConstraintRawState): boolean {
  return state.settings.renderStyle === 'enhanced';
}

function renderStyleIsUltra(state: ConstraintRawState): boolean {
  return state.settings.renderStyle === 'ultra';
}

function softBlobNodeDensity(state: ConstraintRawState): number {
  return Math.max(0.1, Math.min(4, finiteNumberSetting(state.settings, 'nodeDensity', 1)));
}

function softBlobNodeRadius(state: ConstraintRawState): number {
  const density = softBlobNodeDensity(state);
  return Math.max(2.4, Math.min(20, 5.8 / Math.sqrt(density)));
}

function softBlobRadius(state: ConstraintRawState): number {
  const density = softBlobNodeDensity(state);
  return Math.max(18, Math.min(120, 32 * Math.pow(density, 0.12)));
}

function softBlobSpacing(state: ConstraintRawState): number {
  return Math.max(1.4, softBlobNodeRadius(state) * 0.68);
}

function groupedParticleIndices(engine: AdvancedCircleParticleEngine, state?: ConstraintRawState): Map<number, number[]> {
  const groups = state?.groupedParticleScratch ?? new Map<number, number[]>();
  if (state) state.groupedParticleScratch = groups;
  for (const indices of groups.values()) indices.length = 0;
  for (let index = 0; index < engine.count; index += 1) {
    const group = engine.groups[index];
    if (group < 0) continue;
    const existing = groups.get(group);
    if (existing) existing.push(index);
    else groups.set(group, [index]);
  }
  if (state) {
    for (const [group, indices] of groups.entries()) {
      if (indices.length === 0) groups.delete(group);
    }
  }
  for (const indices of groups.values()) {
    indices.sort((a, b) => engine.locals[a] - engine.locals[b]);
  }
  return groups;
}

function renderPointsForIndices(state: ConstraintRawState, engine: AdvancedCircleParticleEngine, indices: readonly number[]): RenderPoint[] {
  const points = state.renderPointScratch ?? (state.renderPointScratch = []);
  points.length = indices.length;
  for (let cursor = 0; cursor < indices.length; cursor += 1) {
    const index = indices[cursor];
    const k = index << 1;
    const point = points[cursor] ?? (points[cursor] = { x: 0, y: 0 });
    point.x = engine.positions[k];
    point.y = engine.positions[k + 1];
  }
  return points;
}

function boundaryPointsForIndices(
  state: ConstraintRawState,
  engine: AdvancedCircleParticleEngine,
  indices: readonly number[],
  centerIndex: number,
): IndexedRenderPoint[] {
  const points = state.boundaryPointScratch ?? (state.boundaryPointScratch = []);
  let cursor = 0;
  for (const index of indices) {
    if (index === centerIndex) continue;
    const k = index << 1;
    const point = points[cursor] ?? (points[cursor] = { index, x: 0, y: 0 });
    point.index = index;
    point.x = engine.positions[k];
    point.y = engine.positions[k + 1];
    cursor += 1;
  }
  points.length = cursor;
  return points;
}

function ensureRenderPointArray(points: RenderPoint[] | undefined, length: number): RenderPoint[] {
  const out = points ?? [];
  for (let index = out.length; index < length; index += 1) {
    out[index] = { x: 0, y: 0 };
  }
  out.length = length;
  return out;
}

function ensureFloatScratch(buffer: Float32Array | undefined, length: number): Float32Array {
  if (!buffer || buffer.length < length) return new Float32Array(Math.max(length, buffer ? buffer.length * 2 : 1024));
  return buffer;
}

function writeClampedRenderPoint(
  target: RenderPoint,
  x: number,
  y: number,
  bounds?: { width: number; height: number },
): RenderPoint {
  if (bounds) {
    target.x = Math.max(0, Math.min(bounds.width, x));
    target.y = Math.max(0, Math.min(bounds.height, y));
    return target;
  }
  target.x = x;
  target.y = y;
  return target;
}

function ensureSoftBlobGradientScratch(state: ConstraintRawState, length: number): { x: Float32Array; y: Float32Array } {
  if (!state.softBlobGradientX || state.softBlobGradientX.length < length) {
    state.softBlobGradientX = new Float32Array(Math.max(length, state.softBlobGradientX ? state.softBlobGradientX.length * 2 : 128));
  }
  if (!state.softBlobGradientY || state.softBlobGradientY.length < length) {
    state.softBlobGradientY = new Float32Array(Math.max(length, state.softBlobGradientY ? state.softBlobGradientY.length * 2 : 128));
  }
  return { x: state.softBlobGradientX, y: state.softBlobGradientY };
}

function clampRenderPoint(point: { x: number; y: number }, bounds?: { width: number; height: number }): { x: number; y: number } {
  if (!bounds) return point;
  return {
    x: Math.max(0, Math.min(bounds.width, point.x)),
    y: Math.max(0, Math.min(bounds.height, point.y)),
  };
}

function uploadDynamicGeometry(
  state: ConstraintRawState,
  size: { width: number; height: number },
  data: Float32Array,
  color: [number, number, number, number],
  mode: number,
  floatLength = data.length,
): void {
  if (!state.drawProgram || !state.drawVao || !state.drawBuffer || !state.uDrawResolution || !state.uDrawColor) return;
  const gl = state.gl;
  gl.useProgram(state.drawProgram);
  gl.bindVertexArray(state.drawVao);
  uploadDrawBuffer(state, data, floatLength);
  gl.uniform2f(state.uDrawResolution, size.width, size.height);
  gl.uniform4f(state.uDrawColor, color[0], color[1], color[2], color[3]);
  gl.drawArrays(mode, 0, floatLength / 2);
  gl.bindVertexArray(null);
}

function uploadDrawBuffer(state: ConstraintRawState, data: Float32Array, floatLength = data.length): void {
  if (!state.drawBuffer) return;
  const gl = state.gl;
  const floatCapacity = floatLength;
  gl.bindBuffer(gl.ARRAY_BUFFER, state.drawBuffer);
  if ((state.drawBufferCapacity ?? 0) < floatCapacity) {
    state.drawBufferCapacity = Math.max(floatCapacity, (state.drawBufferCapacity ?? 512) * 2);
    gl.bufferData(gl.ARRAY_BUFFER, state.drawBufferCapacity * 4, gl.DYNAMIC_DRAW);
  }
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, floatLength);
}

function buildTubeTriangles(state: ConstraintRawState, points: Array<{ x: number; y: number }>, halfWidth: number): GeometrySlice {
  const floatLength = points.length >= 2 ? (points.length - 1) * 12 : 0;
  const vertices = ensureFloatScratch(state.tubeGeometryScratch, floatLength);
  state.tubeGeometryScratch = vertices;
  if (points.length < 2) return { data: vertices, length: 0 };
  let offset = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.max(0.0001, length2d(dx, dy));
    const nx = -dy / length * halfWidth;
    const ny = dx / length * halfWidth;
    vertices[offset] = a.x + nx;
    vertices[offset + 1] = a.y + ny;
    vertices[offset + 2] = a.x - nx;
    vertices[offset + 3] = a.y - ny;
    vertices[offset + 4] = b.x + nx;
    vertices[offset + 5] = b.y + ny;
    vertices[offset + 6] = b.x + nx;
    vertices[offset + 7] = b.y + ny;
    vertices[offset + 8] = a.x - nx;
    vertices[offset + 9] = a.y - ny;
    vertices[offset + 10] = b.x - nx;
    vertices[offset + 11] = b.y - ny;
    offset += 12;
  }
  return { data: vertices, length: offset };
}

function buildDiskTriangles(state: ConstraintRawState, center: { x: number; y: number }, radius: number, segments = 18): GeometrySlice {
  const floatLength = Math.max(0, segments) * 6;
  const vertices = ensureFloatScratch(state.diskGeometryScratch, floatLength);
  state.diskGeometryScratch = vertices;
  let offset = 0;
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    vertices[offset] = center.x;
    vertices[offset + 1] = center.y;
    vertices[offset + 2] = center.x + Math.cos(a) * radius;
    vertices[offset + 3] = center.y + Math.sin(a) * radius;
    vertices[offset + 4] = center.x + Math.cos(b) * radius;
    vertices[offset + 5] = center.y + Math.sin(b) * radius;
    offset += 6;
  }
  return { data: vertices, length: offset };
}

function buildSmoothOpenSkinTriangles(state: ConstraintRawState, points: Array<{ x: number; y: number }>, halfWidth: number): GeometrySlice {
  if (points.length < 2) {
    const vertices = ensureFloatScratch(state.smoothOpenGeometryScratch, 0);
    state.smoothOpenGeometryScratch = vertices;
    return { data: vertices, length: 0 };
  }
  const smooth = smoothOpenPath(state, points, Math.max(5, Math.min(10, Math.round(points.length * 0.32))));
  if (smooth.length < 2) {
    const vertices = ensureFloatScratch(state.smoothOpenGeometryScratch, 0);
    state.smoothOpenGeometryScratch = vertices;
    return { data: vertices, length: 0 };
  }
  const capSegments = 20;
  const vertices = ensureFloatScratch(state.smoothOpenGeometryScratch, (smooth.length - 1) * 12 + capSegments * 12);
  state.smoothOpenGeometryScratch = vertices;
  let offset = 0;
  for (let i = 0; i < smooth.length - 1; i += 1) {
    const current = smooth[i];
    const following = smooth[i + 1];
    const previous = smooth[Math.max(0, i - 1)];
    const next = smooth[Math.min(smooth.length - 1, i + 1)];
    const afterNext = smooth[Math.min(smooth.length - 1, i + 2)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const nextDx = afterNext.x - current.x;
    const nextDy = afterNext.y - current.y;
    const length = Math.max(0.0001, length2d(dx, dy));
    const nextLength = Math.max(0.0001, length2d(nextDx, nextDy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const nextNormalX = -nextDy / nextLength;
    const nextNormalY = nextDx / nextLength;
    const leftX = current.x + normalX * halfWidth;
    const leftY = current.y + normalY * halfWidth;
    const rightX = current.x - normalX * halfWidth;
    const rightY = current.y - normalY * halfWidth;
    const nextLeftX = following.x + nextNormalX * halfWidth;
    const nextLeftY = following.y + nextNormalY * halfWidth;
    const nextRightX = following.x - nextNormalX * halfWidth;
    const nextRightY = following.y - nextNormalY * halfWidth;
    vertices[offset] = leftX;
    vertices[offset + 1] = leftY;
    vertices[offset + 2] = rightX;
    vertices[offset + 3] = rightY;
    vertices[offset + 4] = nextLeftX;
    vertices[offset + 5] = nextLeftY;
    vertices[offset + 6] = nextLeftX;
    vertices[offset + 7] = nextLeftY;
    vertices[offset + 8] = rightX;
    vertices[offset + 9] = rightY;
    vertices[offset + 10] = nextRightX;
    vertices[offset + 11] = nextRightY;
    offset += 12;
  }
  for (let capIndex = 0; capIndex < 2; capIndex += 1) {
    const center = capIndex === 0 ? smooth[0] : smooth[smooth.length - 1];
    for (let i = 0; i < capSegments; i += 1) {
      const a = (i / capSegments) * Math.PI * 2;
      const b = ((i + 1) / capSegments) * Math.PI * 2;
      vertices[offset] = center.x;
      vertices[offset + 1] = center.y;
      vertices[offset + 2] = center.x + Math.cos(a) * halfWidth;
      vertices[offset + 3] = center.y + Math.sin(a) * halfWidth;
      vertices[offset + 4] = center.x + Math.cos(b) * halfWidth;
      vertices[offset + 5] = center.y + Math.sin(b) * halfWidth;
      offset += 6;
    }
  }
  return { data: vertices, length: offset };
}

function buildClosedSmoothTubeTriangles(state: ConstraintRawState, points: Array<{ x: number; y: number }>, halfWidth: number, subdivisions: number): GeometrySlice {
  if (points.length < 3) {
    const vertices = ensureFloatScratch(state.closedTubeGeometryScratch, 0);
    state.closedTubeGeometryScratch = vertices;
    return { data: vertices, length: 0 };
  }
  const steps = Math.max(1, subdivisions | 0);
  const segmentCount = points.length * steps;
  const vertices = ensureFloatScratch(state.closedTubeGeometryScratch, segmentCount * 12);
  state.closedTubeGeometryScratch = vertices;
  const current: RenderPoint = { x: 0, y: 0 };
  const next: RenderPoint = { x: 0, y: 0 };
  let offset = 0;
  for (let segment = 0; segment < segmentCount; segment += 1) {
    const index = (segment / steps) | 0;
    const step = segment - index * steps;
    const nextStep = step + 1;
    const nextIndex = nextStep >= steps ? (index + 1) % points.length : index;
    writeCatmullClosed(points, index, step / steps, current);
    writeCatmullClosed(points, nextIndex, nextStep >= steps ? 0 : nextStep / steps, next);
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.max(0.0001, length2d(dx, dy));
    const nx = -dy / length * halfWidth;
    const ny = dx / length * halfWidth;
    vertices[offset] = current.x + nx;
    vertices[offset + 1] = current.y + ny;
    vertices[offset + 2] = current.x - nx;
    vertices[offset + 3] = current.y - ny;
    vertices[offset + 4] = next.x + nx;
    vertices[offset + 5] = next.y + ny;
    vertices[offset + 6] = next.x + nx;
    vertices[offset + 7] = next.y + ny;
    vertices[offset + 8] = current.x - nx;
    vertices[offset + 9] = current.y - ny;
    vertices[offset + 10] = next.x - nx;
    vertices[offset + 11] = next.y - ny;
    offset += 12;
  }
  return { data: vertices, length: offset };
}

function writeCatmullRomPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
  target: RenderPoint,
): void {
  const t2 = t * t;
  const t3 = t2 * t;
  target.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  target.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
}

function smoothClosedBoundary(state: ConstraintRawState, points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length < 4) return points;
  const smooth = ensureRenderPointArray(state.closedSmoothScratch, points.length * 4);
  state.closedSmoothScratch = smooth;
  let offset = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];
    for (let step = 0; step < 4; step += 1) {
      writeCatmullRomPoint(p0, p1, p2, p3, step / 4, smooth[offset]);
      offset += 1;
    }
  }
  smooth.length = offset;
  return smooth;
}

function buildFanTriangles(state: ConstraintRawState, center: { x: number; y: number }, boundary: Array<{ x: number; y: number }>): GeometrySlice {
  const vertices = ensureFloatScratch(state.fanGeometryScratch, boundary.length * 6);
  state.fanGeometryScratch = vertices;
  let offset = 0;
  for (let i = 0; i < boundary.length; i += 1) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    vertices[offset] = center.x;
    vertices[offset + 1] = center.y;
    vertices[offset + 2] = a.x;
    vertices[offset + 3] = a.y;
    vertices[offset + 4] = b.x;
    vertices[offset + 5] = b.y;
    offset += 6;
  }
  return { data: vertices, length: offset };
}

function nextGroup(state: ConstraintRawState): number {
  const next = state.nextGroupId ?? 1;
  state.nextGroupId = next + 1;
  return next;
}

function blobConstraintStiffness(state: ConstraintRawState): number {
  const squishiness = Math.max(0, Math.min(2, finiteNumberSetting(state.settings, 'squishiness', 0.72)));
  const firmness = Math.max(0, 1 - squishiness * 0.5);
  return Math.max(0.001, firmness * firmness * firmness);
}

function blobConstraintStiffnesses(state: ConstraintRawState): { edge: number; bend: number; radial: number } {
  const stiffness = blobConstraintStiffness(state);
  return {
    edge: Math.max(0.18, 0.86 - finiteNumberSetting(state.settings, 'squishiness', 0.72) * 0.12),
    bend: Math.max(0.04, stiffness * 0.48),
    radial: 0,
  };
}

function applyBlobConstraintStiffness(state: ConstraintRawState): void {
  const engine = state.engine;
  if (!engine) return;
  const stiffness = blobConstraintStiffnesses(state);
  for (const linkIndex of state.blobEdgeLinks ?? []) engine.setDistanceConstraintStiffness(linkIndex, stiffness.edge);
  for (const linkIndex of state.blobBendLinks ?? []) engine.setDistanceConstraintStiffness(linkIndex, stiffness.bend);
  for (const linkIndex of state.blobRadialLinks ?? []) engine.setDistanceConstraintStiffness(linkIndex, stiffness.radial);
}

function polygonArea(points: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - a.y * b.x;
  }
  return area * 0.5;
}

function blobBoundaryPoints(state: ConstraintRawState, engine: AdvancedCircleParticleEngine, indices: number[], centerIndex: number): IndexedRenderPoint[] {
  return boundaryPointsForIndices(state, engine, indices, centerIndex);
}

function moveSoftBlobParticle(engine: AdvancedCircleParticleEngine, index: number, dx: number, dy: number): void {
  const k = index << 1;
  engine.positions[k] += dx;
  engine.positions[k + 1] += dy;
  engine.previousPositions[k] += dx;
  engine.previousPositions[k + 1] += dy;
}

function clampSoftBlobParticleToBounds(state: ConstraintRawState, index: number): void {
  const engine = state.engine;
  if (!engine) return;
  const size = logicalSize(state);
  const k = index << 1;
  const radius = engine.radii[index];
  const x = Math.max(radius, Math.min(size.width - radius, engine.positions[k]));
  const y = Math.max(radius, Math.min(size.height - radius, engine.positions[k + 1]));
  const dx = x - engine.positions[k];
  const dy = y - engine.positions[k + 1];
  if (dx !== 0 || dy !== 0) moveSoftBlobParticle(engine, index, dx, dy);
}

function applySoftBlobAmoebaConstraints(state: ConstraintRawState, passScale = 1): void {
  const engine = state.engine;
  if (!engine) return;
  const groups = groupedParticleIndices(engine, state);
  const squishiness = Math.max(0, Math.min(2, finiteNumberSetting(state.settings, 'squishiness', 0.72)));
  const areaStiffness = Math.max(0.32, 1.08 - squishiness * 0.28) * passScale;
  const shapeStiffness = Math.max(0.035, 0.24 - squishiness * 0.07) * passScale;
  for (const [group, indices] of groups.entries()) {
    if (indices.length < 5) continue;
    let centerIndex = indices[0];
    for (let cursor = 1; cursor < indices.length; cursor += 1) {
      const index = indices[cursor];
      if (engine.locals[index] > engine.locals[centerIndex]) centerIndex = index;
    }
    const boundary = blobBoundaryPoints(state, engine, indices, centerIndex);
    if (boundary.length < 4) continue;
    let cx = 0;
    let cy = 0;
    for (const point of boundary) {
      cx += point.x;
      cy += point.y;
    }
    cx /= boundary.length;
    cy /= boundary.length;
    const centerK = centerIndex << 1;
    engine.positions[centerK] = cx;
    engine.positions[centerK + 1] = cy;
    engine.previousPositions[centerK] = cx;
    engine.previousPositions[centerK + 1] = cy;

    const currentArea = polygonArea(boundary);
    const restArea = state.blobRestAreas?.get(group) ?? Math.abs(currentArea);
    const areaError = Math.max(-restArea * 0.42, Math.min(restArea * 0.42, Math.abs(currentArea) - restArea));
    let gradientDenom = 0;
    const gradients = ensureSoftBlobGradientScratch(state, boundary.length);
    const gradX = gradients.x;
    const gradY = gradients.y;
    for (let i = 0; i < boundary.length; i += 1) {
      const previous = boundary[(i + boundary.length - 1) % boundary.length];
      const next = boundary[(i + 1) % boundary.length];
      const gx = 0.5 * (next.y - previous.y);
      const gy = 0.5 * (previous.x - next.x);
      gradX[i] = gx;
      gradY[i] = gy;
      gradientDenom += gx * gx + gy * gy;
    }
    if (gradientDenom > 0.000001) {
      const signed = currentArea >= 0 ? 1 : -1;
      const lambda = -areaStiffness * areaError * signed / gradientDenom;
      for (let i = 0; i < boundary.length; i += 1) {
        moveSoftBlobParticle(engine, boundary[i].index, lambda * gradX[i], lambda * gradY[i]);
      }
    }

    const averageRadius = state.blobRestRadii?.get(group) ?? Math.sqrt(restArea / Math.PI);
    let aa = 0;
    let bb = 0;
    for (let i = 0; i < boundary.length; i += 1) {
      const angle = (i / boundary.length) * Math.PI * 2;
      const qx = Math.cos(angle) * averageRadius;
      const qy = Math.sin(angle) * averageRadius;
      const k = boundary[i].index << 1;
      const dx = engine.positions[k] - cx;
      const dy = engine.positions[k + 1] - cy;
      aa += qx * dx + qy * dy;
      bb += qx * dy - qy * dx;
    }
    const inverseRotationLength = 1 / Math.max(0.000001, length2d(aa, bb));
    const co = aa * inverseRotationLength;
    const si = bb * inverseRotationLength;
    for (let i = 0; i < boundary.length; i += 1) {
      const angle = (i / boundary.length) * Math.PI * 2;
      const qx = Math.cos(angle) * averageRadius;
      const qy = Math.sin(angle) * averageRadius;
      const targetX = cx + qx * co - qy * si;
      const targetY = cy + qx * si + qy * co;
      const k = boundary[i].index << 1;
      moveSoftBlobParticle(
        engine,
        boundary[i].index,
        (targetX - engine.positions[k]) * shapeStiffness,
        (targetY - engine.positions[k + 1]) * shapeStiffness,
      );
      clampSoftBlobParticleToBounds(state, boundary[i].index);
    }
  }
}

function solveSoftBlobAmoebaConstraints(state: ConstraintRawState): void {
  const passes = clampInt(finiteNumberSetting(state.settings, 'constraintPasses', 5), 2, 14);
  for (let pass = 0; pass < passes; pass += 1) {
    applySoftBlobAmoebaConstraints(state, 1 / Math.max(1, passes * 0.72));
  }
}

function engineSettings(state: ConstraintRawState, kind: ConstraintDemoKind, quality: RenderQuality, preview: boolean): AdvancedCircleParticleSettings {
  const profile = resolveAdvancedPhysicsFidelityProfile(quality);
  const radius = kind === 'chain-rain' ? finiteNumberSetting(state.settings, 'nodeRadius', 5) : softBlobNodeRadius(state);
  const snakeFriction = kind === 'chain-rain' ? clamp01(finiteNumberSetting(state.settings, 'friction', 0.35)) : 0;
  const rawMax = preview
    ? (kind === 'chain-rain' ? 360 : 240)
    : (kind === 'chain-rain' ? finiteNumberSetting(state.settings, 'maxNodes', 28_000) : Math.round(24_000 + softBlobNodeDensity(state) * 18_000));
  return {
    radius,
    maxActiveParticles: Math.max(1, Math.floor(rawMax * profile.particleScale)),
    gravity: preview ? (kind === 'chain-rain' ? 900 : 650) : finiteNumberSetting(state.settings, 'gravity', kind === 'chain-rain' ? 1250 : 900),
    solverPasses: preview ? 2 : clampInt(finiteNumberSetting(state.settings, 'solverPasses', 3), 1, profile.solverPassCap),
    substeps: preview ? 1 : clampInt(finiteNumberSetting(state.settings, 'substeps', 2), 1, profile.substepCap),
    wallBounce: false,
    wallBounceCoefficient: 0.12,
    airDragPerSecond: finiteNumberSetting(state.settings, 'airDrag', 0.992),
    solverDampingPerSecond: finiteNumberSetting(state.settings, 'solverDamping', 0.982),
    maxFrameDt: 1 / 30,
    maxPairPushFactor: 0.34,
    impactBounceThreshold: 120,
    collisionSoftness: finiteNumberSetting(state.settings, 'collisionSoftness', 0.82),
    contactFriction: snakeFriction,
    linkSolverPasses: preview ? (kind === 'chain-rain' ? 1 : 2) : clampInt(finiteNumberSetting(state.settings, 'constraintPasses', kind === 'chain-rain' ? 2 : 4), 1, 8),
    sameGroupCollisions: kind === 'chain-rain',
    adjacentGroupCollisions: false,
  };
}

function snakeNodeVarianceAmount(state: ConstraintRawState): number {
  return Math.max(0, Math.min(1.5, finiteNumberSetting(state.settings, 'nodeVariance', 0.28)));
}

function snakeNodeVarianceWavelength(state: ConstraintRawState): number {
  return Math.max(2, Math.min(48, finiteNumberSetting(state.settings, 'nodeVarianceWavelength', 14)));
}

function snakeNodeVarianceRoughness(state: ConstraintRawState): number {
  return Math.max(0, Math.min(1, finiteNumberSetting(state.settings, 'nodeVarianceRoughness', 0.35)));
}

function snakeNodeRadiusAt(state: ConstraintRawState, baseRadius: number, local: number, length: number, phase: number): number {
  const amount = snakeNodeVarianceAmount(state);
  if (amount <= 0) return baseRadius;
  const wavelength = snakeNodeVarianceWavelength(state);
  const roughness = snakeNodeVarianceRoughness(state);
  const wave = (local / wavelength) * Math.PI * 2 + phase;
  const primary = Math.sin(wave);
  const secondary = Math.sin(wave * 0.47 + phase * 1.73);
  const detail = Math.sin(wave * 2.19 + phase * 0.31);
  const endpoint = length <= 1 ? 1 : Math.min(local / Math.max(1, length - 1), (length - 1 - local) / Math.max(1, length - 1));
  const envelope = 0.72 + Math.min(1, endpoint * 5.5) * 0.28;
  const signal = (primary * 0.62 + secondary * 0.28 + detail * roughness * 0.18) * envelope;
  return baseRadius * Math.max(0.35, Math.min(2.35, 1 + signal * amount));
}

function spawnChain(state: ConstraintRawState): void {
  const engine = state.engine;
  if (!engine) return;
  const size = logicalSize(state);
  const radius = finiteNumberSetting(state.settings, 'nodeRadius', 5);
  const baseLength = clampInt(finiteNumberSetting(state.settings, 'chainLength', 16), 3, 96);
  const rainSpawn = state.inputMode === 'rain' || state.mode === 'demo';
  const length = rainSpawn
    ? clampInt(Math.round(baseLength * (0.55 + Math.random() * 1.45)), 4, 96)
    : baseLength;
  const stiffness = finiteNumberSetting(state.settings, 'constraintStiffness', 0.92);
  const group = nextGroup(state);
  const spacing = radius * 1.85;
  const angle = rainSpawn ? Math.PI * (0.16 + Math.random() * 0.68) : -Math.PI * 0.5;
  const radiusPhase = Math.random() * Math.PI * 2;
  const minX = radius * 4 + Math.max(0, -Math.cos(angle) * spacing * Math.max(0, length - 1));
  const maxX = Math.max(minX, size.width - radius * 4 - Math.max(0, Math.cos(angle) * spacing * Math.max(0, length - 1)));
  const x = rainSpawn ? minX + Math.random() * Math.max(radius * 4, maxX - minX) : radius * 4 + Math.random() * Math.max(radius * 8, size.width - radius * 8);
  const verticalSpan = Math.max(0, Math.sin(angle) * spacing * Math.max(0, length - 1));
  const y = rainSpawn ? -verticalSpan - radius * (1.1 + Math.random() * 2.4) : radius * 2;
  const lateralVelocity = rainSpawn ? Math.cos(angle) * (40 + Math.random() * 110) : 0;
  const downwardVelocity = rainSpawn ? 70 + Math.random() * 130 : 0;
  let previous = -1;
  let previousRadius = radius;
  for (let i = 0; i < length; i += 1) {
    const nodeRadius = snakeNodeRadiusAt(state, radius, i, length, radiusPhase);
    const jitter = (Math.random() - 0.5) * radius * (rainSpawn ? 0.7 : 1);
    const node = engine.addParticle(
      x + Math.cos(angle) * i * spacing + jitter,
      y + Math.sin(angle) * i * spacing + (Math.random() - 0.5) * radius * 0.45,
      {
        radius: nodeRadius,
        velocityX: lateralVelocity + (Math.random() - 0.5) * 70,
        velocityY: downwardVelocity + Math.random() * 90,
        group,
        local: i,
      },
    );
    if (node < 0) break;
    if (previous >= 0) engine.addDistanceConstraint(previous, node, { restLength: Math.max(radius * 0.25, (previousRadius + nodeRadius) * 0.94), stiffness });
    previous = node;
    previousRadius = nodeRadius;
  }
}

function spawnBlob(state: ConstraintRawState): void {
  const engine = state.engine;
  if (!engine) return;
  const size = logicalSize(state);
  const radius = softBlobNodeRadius(state);
  const blobRadius = softBlobRadius(state);
  const denseNodeCount = Math.ceil((Math.PI * 2 * blobRadius) / softBlobSpacing(state));
  const nodeCount = clampInt(denseNodeCount, 12, 384);
  const stiffness = blobConstraintStiffnesses(state);
  const group = nextGroup(state);
  const spawnPad = blobRadius + radius * 4;
  const spawnHeight = Math.max(spawnPad * 2, size.height * 0.24);
  const minClearance = blobRadius * 2.65 + radius * 6;
  const isClearPlacement = (candidateX: number, candidateY: number): boolean => {
    if (candidateX < spawnPad || candidateX > size.width - spawnPad || candidateY < spawnPad || candidateY > size.height - spawnPad) return false;
    for (let i = 0; i < engine.count; i += 1) {
      const k = i << 1;
      const dx = engine.positions[k] - candidateX;
      const dy = engine.positions[k + 1] - candidateY;
      if (dx * dx + dy * dy < minClearance * minClearance) return false;
    }
    return true;
  };
  let centerX = 0;
  let centerY = 0;
  let foundPlacement = false;
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const candidateX = spawnPad + Math.random() * Math.max(0, size.width - spawnPad * 2);
    const candidateY = spawnPad + Math.random() * Math.max(0, spawnHeight - spawnPad);
    if (isClearPlacement(candidateX, candidateY)) {
      centerX = candidateX;
      centerY = candidateY;
      foundPlacement = true;
      break;
    }
  }
  if (!foundPlacement) {
    const step = Math.max(minClearance, blobRadius * 2.8);
    const columns = Math.max(1, Math.floor((size.width - spawnPad * 2) / step) + 1);
    const rows = Math.max(1, Math.floor((spawnHeight - spawnPad) / step) + 1);
    const offset = Math.floor(Math.random() * columns * rows);
    for (let n = 0; n < columns * rows; n += 1) {
      const slot = (n + offset) % (columns * rows);
      const column = slot % columns;
      const row = Math.floor(slot / columns);
      const candidateX = columns === 1 ? size.width * 0.5 : spawnPad + (column / (columns - 1)) * Math.max(0, size.width - spawnPad * 2);
      const candidateY = rows === 1 ? spawnPad : spawnPad + (row / (rows - 1)) * Math.max(0, spawnHeight - spawnPad);
      if (isClearPlacement(candidateX, candidateY)) {
        centerX = candidateX;
        centerY = candidateY;
        foundPlacement = true;
        break;
      }
    }
  }
  if (!foundPlacement) return;
  const center = engine.addParticle(centerX, centerY, { radius: 0.001, inverseMass: 0, velocityX: 0, velocityY: 0, group, local: nodeCount });
  if (center < 0) return;
  const nodes: number[] = [];
  for (let i = 0; i < nodeCount; i += 1) {
    const angle = (i / nodeCount) * Math.PI * 2;
    const node = engine.addParticle(centerX + Math.cos(angle) * blobRadius, centerY + Math.sin(angle) * blobRadius, {
      radius,
      velocityX: (Math.random() - 0.5) * 80,
      velocityY: Math.random() * 60,
      group,
      local: i,
    });
    if (node >= 0) nodes.push(node);
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    const b = nodes[(i + 1) % nodes.length];
    const c = nodes[(i + 2) % nodes.length];
    const edgeLink = engine.addDistanceConstraint(a, b, { stiffness: stiffness.edge });
    const bendLink = engine.addDistanceConstraint(a, c, { stiffness: stiffness.bend });
    if (edgeLink >= 0) (state.blobEdgeLinks ??= []).push(edgeLink);
    if (bendLink >= 0) (state.blobBendLinks ??= []).push(bendLink);
  }
  const restPoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const index = nodes[i];
    const k = index << 1;
    restPoints.push({ x: engine.positions[k], y: engine.positions[k + 1] });
  }
  (state.blobRestAreas ??= new Map()).set(group, Math.abs(polygonArea(restPoints)));
  (state.blobRestRadii ??= new Map()).set(group, blobRadius);
}

function spawnDrawnChain(state: ConstraintRawState): void {
  const engine = state.engine;
  const points = state.drawPoints ?? [];
  if (!engine || points.length < 2) return;
  const radius = finiteNumberSetting(state.settings, 'nodeRadius', 5);
  const stiffness = finiteNumberSetting(state.settings, 'constraintStiffness', 0.92);
  const group = nextGroup(state);
  const spacing = radius * 2.02;
  const samples = sampleOpenPathByDistance(points, spacing);
  if (samples.length < 2) return;
  const radiusPhase = Math.random() * Math.PI * 2;
  let previous = -1;
  let previousRadius = radius;
  for (let local = 0; local < samples.length; local += 1) {
    const sample = samples[local];
    const nodeRadius = snakeNodeRadiusAt(state, radius, local, samples.length, radiusPhase);
    const node = engine.addParticle(sample.x, sample.y, { radius: nodeRadius, velocityX: 0, velocityY: 0, group, local });
    if (node < 0) return;
    if (previous >= 0) {
      const previousSample = samples[local - 1];
      engine.addDistanceConstraint(previous, node, {
        restLength: Math.max((previousRadius + nodeRadius) * 0.94, length2d(sample.x - previousSample.x, sample.y - previousSample.y)),
        stiffness,
      });
    }
    previous = node;
    previousRadius = nodeRadius;
  }
}

function spawnBuildFixture(state: ConstraintRawState): void {
  const engine = state.engine;
  const points = state.drawPoints ?? [];
  if (!engine || points.length === 0) return;
  const radius = finiteNumberSetting(state.settings, 'nodeRadius', 5);
  const fixtureRadius = radius * 2.25;
  const group = nextGroup(state);
  const fixture = sampleBuildFixture(points, fixtureRadius, { spacingScale: 1.35, clickDistanceScale: radius / fixtureRadius * 1.5 });
  if (!fixture) return;
  if (fixture.kind === 'point') {
    engine.addParticle(fixture.start.x, fixture.start.y, { radius: fixtureRadius, inverseMass: 0, velocityX: 0, velocityY: 0, group, local: 0 });
    return;
  }
  fixture.samples.forEach((sample, local) => {
    engine.addParticle(sample.x, sample.y, { radius: fixtureRadius, inverseMass: 0, velocityX: 0, velocityY: 0, group, local });
  });
}

function seedChainRainBuildFixtures(state: ConstraintRawState, preview: boolean): void {
  const size = logicalSize(state);
  const radius = finiteNumberSetting(state.settings, 'nodeRadius', 5);
  const margin = Math.max(radius * 8, Math.min(size.width, size.height) * 0.08);
  const count = preview ? 6 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 5);
  const minX = margin;
  const maxX = Math.max(minX, size.width - margin);
  const minY = Math.max(margin, size.height * 0.28);
  const maxY = Math.max(minY, size.height * 0.82);
  const randomPoint = () => ({
    x: minX + Math.random() * Math.max(1, maxX - minX),
    y: minY + Math.random() * Math.max(1, maxY - minY),
  });
  for (let index = 0; index < count; index += 1) {
    const start = randomPoint();
    const lineRoll = Math.random();
    if (lineRoll < (preview ? 0.68 : 0.46)) {
      const length = margin * (1.25 + Math.random() * (preview ? 2.4 : 2.8));
      const angle = -Math.PI * 0.86 + Math.random() * Math.PI * 0.72;
      const end = {
        x: Math.max(minX, Math.min(maxX, start.x + Math.cos(angle) * length)),
        y: Math.max(minY, Math.min(maxY, start.y + Math.sin(angle) * length)),
      };
      state.drawPoints = [start, end];
    } else {
      state.drawPoints = [start];
    }
    spawnBuildFixture(state);
  }
  state.drawPoints = [];
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
    let segmentLength = length2d(dx, dy);
    while (distanceSinceSample + segmentLength >= spacing && segmentLength > 0.0001) {
      const remaining = spacing - distanceSinceSample;
      const t = remaining / segmentLength;
      cursor = { x: cursor.x + dx * t, y: cursor.y + dy * t };
      samples.push({ x: cursor.x, y: cursor.y });
      distanceSinceSample = 0;
      dx = target.x - cursor.x;
      dy = target.y - cursor.y;
      segmentLength = length2d(dx, dy);
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

function addClosedBlobFromSamples(
  state: ConstraintRawState,
  sampled: Array<{ x: number; y: number }>,
  radius: number,
  stiffness: { edge: number; bend: number; radial: number },
): boolean {
  const engine = state.engine;
  if (!engine || sampled.length < 3) return false;
  let centerX = 0;
  let centerY = 0;
  for (const point of sampled) {
    centerX += point.x;
    centerY += point.y;
  }
  centerX /= sampled.length;
  centerY /= sampled.length;
  const group = nextGroup(state);
  const center = engine.addParticle(centerX, centerY, { radius: 0.001, inverseMass: 0, velocityX: 0, velocityY: 0, group, local: sampled.length });
  if (center < 0) return false;
  const nodes: number[] = [];
  sampled.forEach((point, index) => {
    const node = engine.addParticle(point.x, point.y, { radius, velocityX: 0, velocityY: 0, group, local: index });
    if (node >= 0) nodes.push(node);
  });
  if (nodes.length < 3) return false;
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    const b = nodes[(i + 1) % nodes.length];
    const c = nodes[(i + 2) % nodes.length];
    const edgeLink = engine.addDistanceConstraint(a, b, { stiffness: stiffness.edge });
    const bendLink = engine.addDistanceConstraint(a, c, { stiffness: stiffness.bend });
    if (edgeLink >= 0) (state.blobEdgeLinks ??= []).push(edgeLink);
    if (bendLink >= 0) (state.blobBendLinks ??= []).push(bendLink);
  }
  (state.blobRestAreas ??= new Map()).set(group, Math.abs(polygonArea(sampled)));
  let restRadius = 0;
  for (const point of sampled) restRadius += length2d(point.x - centerX, point.y - centerY);
  restRadius /= sampled.length;
  (state.blobRestRadii ??= new Map()).set(group, restRadius);
  return true;
}

function fallbackBlobSamplesFromDraw(points: Array<{ x: number; y: number }>, radius: number): Array<{ x: number; y: number }> {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const first = points[0] ?? { x: 0, y: 0 };
  const cx = Number.isFinite(minX + maxX) ? (minX + maxX) * 0.5 : first.x;
  const cy = Number.isFinite(minY + maxY) ? (minY + maxY) * 0.5 : first.y;
  const rx = Math.max(radius * 6, Math.abs(maxX - minX) * 0.5);
  const ry = Math.max(radius * 6, Math.abs(maxY - minY) * 0.5);
  const count = Math.max(16, Math.min(320, Math.round(((rx + ry) * Math.PI) / Math.max(radius * 0.72, 1.4))));
  const samples: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    samples.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  }
  return samples;
}

function spawnDrawnBlob(state: ConstraintRawState): boolean {
  const points = state.drawPoints ?? [];
  if (points.length < 2) return false;
  const radius = softBlobNodeRadius(state);
  const stiffness = blobConstraintStiffnesses(state);
  const configuredNodes = clampInt(Math.round(48 * softBlobNodeDensity(state)), 12, 384);
  const targetSpacing = softBlobSpacing(state);
  const closedPath = stableClosedBlobPath(points, radius);
  const sampled = resampleClosedPath(closedPath, targetSpacing, configuredNodes);
  return addClosedBlobFromSamples(state, sampled, radius, stiffness)
    || addClosedBlobFromSamples(state, fallbackBlobSamplesFromDraw(points, radius), radius, stiffness);
}

function stableClosedBlobPath(points: Array<{ x: number; y: number }>, radius: number): Array<{ x: number; y: number }> {
  if (points.length < 3) return fallbackClosedPathFromStroke(points, radius);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    minX = Math.min(minX, a.x);
    minY = Math.min(minY, a.y);
    maxX = Math.max(maxX, a.x);
    maxY = Math.max(maxY, a.y);
    area += a.x * b.y - b.x * a.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const minDimension = Math.min(width, height);
  const minArea = Math.max(radius * radius * 18, width * height * 0.035);
  if (minDimension < radius * 3.5 || Math.abs(area) * 0.5 < minArea) {
    return fallbackClosedPathFromStroke(points, radius);
  }
  const stablePath: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    stablePath.push({ x: point.x, y: point.y });
  }
  return stablePath;
}

function fallbackClosedPathFromStroke(points: Array<{ x: number; y: number }>, radius: number): Array<{ x: number; y: number }> {
  const a = points[0];
  const b = points[points.length - 1] ?? a;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(0.0001, length2d(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const halfWidth = Math.max(radius * 4, length * 0.18, 16);
  return [
    { x: a.x + nx * halfWidth, y: a.y + ny * halfWidth },
    { x: b.x + nx * halfWidth, y: b.y + ny * halfWidth },
    { x: b.x - nx * halfWidth, y: b.y - ny * halfWidth },
    { x: a.x - nx * halfWidth, y: a.y - ny * halfWidth },
  ];
}

function resampleClosedPath(points: Array<{ x: number; y: number }>, spacing: number, configuredNodes: number): Array<{ x: number; y: number }> {
  const clean: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    const previous = clean[clean.length - 1];
    const dx = point.x - (previous?.x ?? point.x);
    const dy = point.y - (previous?.y ?? point.y);
    if (!previous || dx * dx + dy * dy >= 4) clean.push(point);
  }
  if (clean.length < 3) return clean;

  let perimeter = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const a = clean[i];
    const b = clean[(i + 1) % clean.length];
    perimeter += length2d(b.x - a.x, b.y - a.y);
  }

  const nodeCount = clampInt(Math.max(configuredNodes, Math.round(perimeter / spacing)), 10, 512);
  const sampled: Array<{ x: number; y: number }> = [];
  let segmentIndex = 0;
  let segmentStart = clean[0];
  let segmentEnd = clean[1 % clean.length];
  let segmentLength = Math.max(0.0001, length2d(segmentEnd.x - segmentStart.x, segmentEnd.y - segmentStart.y));
  let distanceAtSegmentStart = 0;

  for (let n = 0; n < nodeCount; n += 1) {
    const targetDistance = (n / nodeCount) * perimeter;
    while (targetDistance > distanceAtSegmentStart + segmentLength && segmentIndex < clean.length + 1) {
      distanceAtSegmentStart += segmentLength;
      segmentIndex += 1;
      segmentStart = clean[segmentIndex % clean.length];
      segmentEnd = clean[(segmentIndex + 1) % clean.length];
      segmentLength = Math.max(0.0001, length2d(segmentEnd.x - segmentStart.x, segmentEnd.y - segmentStart.y));
    }
    const t = Math.max(0, Math.min(1, (targetDistance - distanceAtSegmentStart) / segmentLength));
    sampled.push({
      x: segmentStart.x + (segmentEnd.x - segmentStart.x) * t,
      y: segmentStart.y + (segmentEnd.y - segmentStart.y) * t,
    });
  }

  return sampled;
}


function writeCatmullClosed(points: Array<{ x: number; y: number }>, index: number, t: number, target: RenderPoint): void {
  const count = points.length;
  const p0 = points[(index + count - 1) % count];
  const p1 = points[index % count];
  const p2 = points[(index + 1) % count];
  const p3 = points[(index + 2) % count];
  const t2 = t * t;
  const t3 = t2 * t;
  target.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  target.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
}

function writeCatmullOpen(points: Array<{ x: number; y: number }>, index: number, t: number, target: RenderPoint): void {
  const last = points.length - 1;
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[Math.max(0, Math.min(last, index))];
  const p2 = points[Math.max(0, Math.min(last, index + 1))];
  const p3 = points[Math.max(0, Math.min(last, index + 2))];
  const t2 = t * t;
  const t3 = t2 * t;
  target.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  target.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
}

function smoothOpenPath(state: ConstraintRawState, points: Array<{ x: number; y: number }>, subdivisions: number): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;
  const smoothLength = (points.length - 1) * subdivisions + 1;
  const smoothed = ensureRenderPointArray(state.smoothOpenPointScratch, smoothLength);
  state.smoothOpenPointScratch = smoothed;
  let offset = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    for (let step = 0; step < subdivisions; step += 1) {
      writeCatmullOpen(points, index, step / subdivisions, smoothed[offset]);
      offset += 1;
    }
  }
  const last = points[points.length - 1];
  smoothed[offset].x = last.x;
  smoothed[offset].y = last.y;
  offset += 1;
  smoothed.length = offset;
  return smoothed;
}

function buildClosedSkinTriangles(
  state: ConstraintRawState,
  boundary: Array<{ x: number; y: number }>,
  center: { x: number; y: number },
  nodeRadius: number,
  smoothAmount: number,
  subdivisions: number,
  feather: number,
  bounds?: { width: number; height: number },
): ClosedSkinMesh {
  if (boundary.length < 3) {
    state.closedFillScratch = ensureFloatScratch(state.closedFillScratch, 0);
    state.closedFeatherScratch = ensureFloatScratch(state.closedFeatherScratch, 0);
    return { fill: state.closedFillScratch, fillLength: 0, feather: state.closedFeatherScratch, featherLength: 0 };
  }
  const raw = ensureRenderPointArray(state.closedRawScratch, boundary.length);
  state.closedRawScratch = raw;
  for (let index = 0; index < boundary.length; index += 1) {
    const point = boundary[index];
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const length = Math.max(0.0001, length2d(dx, dy));
    writeClampedRenderPoint(raw[index], point.x + (dx / length) * nodeRadius, point.y + (dy / length) * nodeRadius, bounds);
  }
  const smooth = ensureRenderPointArray(state.closedSmoothScratch, raw.length);
  state.closedSmoothScratch = smooth;
  for (let index = 0; index < raw.length; index += 1) {
    const point = raw[index];
    const previous = raw[(index + raw.length - 1) % raw.length];
    const next = raw[(index + 1) % raw.length];
    smooth[index].x = point.x * (1 - smoothAmount) + (previous.x + next.x) * 0.5 * smoothAmount;
    smooth[index].y = point.y * (1 - smoothAmount) + (previous.y + next.y) * 0.5 * smoothAmount;
  }
  const contourLength = smooth.length * subdivisions;
  const contour = ensureRenderPointArray(state.closedContourScratch, contourLength);
  state.closedContourScratch = contour;
  let contourOffset = 0;
  for (let index = 0; index < smooth.length; index += 1) {
    for (let step = 0; step < subdivisions; step += 1) {
      const point = contour[contourOffset];
      writeCatmullClosed(smooth, index, step / subdivisions, point);
      writeClampedRenderPoint(point, point.x, point.y, bounds);
      contourOffset += 1;
    }
  }
  const fillLength = contour.length * 6;
  const fill = ensureFloatScratch(state.closedFillScratch, fillLength);
  state.closedFillScratch = fill;
  let fillOffset = 0;
  for (let index = 0; index < contour.length; index += 1) {
    const a = contour[index];
    const b = contour[(index + 1) % contour.length];
    fill[fillOffset++] = center.x; fill[fillOffset++] = center.y;
    fill[fillOffset++] = a.x; fill[fillOffset++] = a.y;
    fill[fillOffset++] = b.x; fill[fillOffset++] = b.y;
  }
  const outer = ensureRenderPointArray(state.closedOuterScratch, contour.length);
  state.closedOuterScratch = outer;
  for (let index = 0; index < contour.length; index += 1) {
    const point = contour[index];
    const previous = contour[(index + contour.length - 1) % contour.length];
    const next = contour[(index + 1) % contour.length];
    const tx = next.x - previous.x;
    const ty = next.y - previous.y;
    let nx = ty;
    let ny = -tx;
    const length = Math.max(0.0001, length2d(nx, ny));
    nx /= length;
    ny /= length;
    if (nx * (point.x - center.x) + ny * (point.y - center.y) < 0) {
      nx = -nx;
      ny = -ny;
    }
    writeClampedRenderPoint(outer[index], point.x + nx * feather, point.y + ny * feather, bounds);
  }
  const featherLength = contour.length * 12;
  const featherData = ensureFloatScratch(state.closedFeatherScratch, featherLength);
  state.closedFeatherScratch = featherData;
  let featherOffset = 0;
  for (let index = 0; index < contour.length; index += 1) {
    const a = contour[index];
    const b = contour[(index + 1) % contour.length];
    const oa = outer[index];
    const ob = outer[(index + 1) % outer.length];
    featherData[featherOffset++] = a.x; featherData[featherOffset++] = a.y;
    featherData[featherOffset++] = oa.x; featherData[featherOffset++] = oa.y;
    featherData[featherOffset++] = b.x; featherData[featherOffset++] = b.y;
    featherData[featherOffset++] = b.x; featherData[featherOffset++] = b.y;
    featherData[featherOffset++] = oa.x; featherData[featherOffset++] = oa.y;
    featherData[featherOffset++] = ob.x; featherData[featherOffset++] = ob.y;
  }
  return { fill, fillLength, feather: featherData, featherLength };
}

function drawSkinMeshBlobs(state: ConstraintRawState, size: { width: number; height: number }): void {
  const engine = state.engine;
  if (!engine) return;
  const palette = state.style?.palette ?? [];
  const groups = groupedParticleIndices(engine, state);
  const radius = softBlobNodeRadius(state);
  const fillColor = colorToRgba(palette[0], [1, 0.42, 0.68], 0.68);
  const featherColor = colorToRgba(palette[1], [0.6, 0.95, 1], 0.16);
  const rimColor = colorToRgba(palette[1], [0.6, 0.95, 1], 0.2);
  const smoothAmount = Math.max(0.08, Math.min(0.52, 0.18 + finiteNumberSetting(state.settings, 'squishiness', 0.72) * 0.08));
  for (const indices of groups.values()) {
    if (indices.length < 4) continue;
    let centerIndex = indices[0];
    for (let cursor = 1; cursor < indices.length; cursor += 1) {
      const index = indices[cursor];
      if (engine.locals[index] > engine.locals[centerIndex]) centerIndex = index;
    }
    const centerK = centerIndex << 1;
    const center = { x: engine.positions[centerK], y: engine.positions[centerK + 1] };
    const boundary = boundaryPointsForIndices(state, engine, indices, centerIndex);
    const mesh = buildClosedSkinTriangles(state, boundary, center, radius, smoothAmount, 4, Math.max(2.2, radius * 0.8), size);
    if (mesh.fillLength > 0) uploadDynamicGeometry(state, size, mesh.fill, fillColor, state.gl.TRIANGLES, mesh.fillLength);
    if (mesh.featherLength > 0) uploadDynamicGeometry(state, size, mesh.feather, featherColor, state.gl.TRIANGLES, mesh.featherLength);
    if (boundary.length >= 3) {
      const rim = buildClosedSmoothTubeTriangles(state, boundary, Math.max(1.2, radius * 0.24), 3);
      if (rim.length > 0) uploadDynamicGeometry(state, size, rim.data, rimColor, state.gl.TRIANGLES, rim.length);
    }
  }
}

function drawSkinMeshChains(state: ConstraintRawState, size: { width: number; height: number }): void {
  const engine = state.engine;
  if (!engine) return;
  const palette = state.style?.palette ?? [];
  const groups = groupedParticleIndices(engine, state);
  const skinWidth = Math.max(0.75, Math.min(2.4, finiteNumberSetting(state.settings, 'skinWidth', 1.08)));
  const highlightWidth = Math.max(0, Math.min(1.4, finiteNumberSetting(state.settings, 'skinHighlightWidth', 0.34)));
  const highlightStrength = Math.max(0, Math.min(1.5, finiteNumberSetting(state.settings, 'skinHighlightStrength', 0.72)));
  const highlightOpacity = Math.max(0, Math.min(1, finiteNumberSetting(state.settings, 'skinHighlightOpacity', 0.42)));
  state.gl.disable(state.gl.BLEND);
  for (const [group, indices] of groups.entries()) {
    const isFixture = indices.every((index) => engine.inverseMasses[index] <= 0);
    let radius = 0;
    for (const index of indices) {
      if (engine.radii[index] > radius) radius = engine.radii[index];
    }
    const bodyColor: [number, number, number, number] = isFixture ? [0.58, 0.58, 0.58, 1] : paletteOptionColor(palette, group - 1, [0.45, 0.9, 1], 1);
    if (indices.length === 1) {
      const k = indices[0] << 1;
      const disk = buildDiskTriangles(state, { x: engine.positions[k], y: engine.positions[k + 1] }, radius * skinWidth, 20);
      if (disk.length > 0) uploadDynamicGeometry(state, size, disk.data, bodyColor, state.gl.TRIANGLES, disk.length);
      continue;
    }
    if (indices.length < 2) continue;
    const points = renderPointsForIndices(state, engine, indices);
    const body = buildSmoothOpenSkinTriangles(state, points, radius * skinWidth);
    if (body.length > 0) uploadDynamicGeometry(state, size, body.data, bodyColor, state.gl.TRIANGLES, body.length);
    if (highlightWidth > 0 && highlightOpacity > 0 && highlightStrength > 0) {
      state.gl.enable(state.gl.BLEND);
      state.gl.blendFunc(state.gl.SRC_ALPHA, state.gl.ONE_MINUS_SRC_ALPHA);
      const highlight = buildSmoothOpenSkinTriangles(state, points, radius * highlightWidth);
      if (highlight.length > 0) uploadDynamicGeometry(state, size, highlight.data, brightenRgba(bodyColor, highlightStrength, highlightOpacity), state.gl.TRIANGLES, highlight.length);
      state.gl.disable(state.gl.BLEND);
    }
  }
  state.gl.enable(state.gl.BLEND);
}

function pushLiquidSnakeParticle(
  data: Float32Array,
  count: number,
  x: number,
  y: number,
  velocityX: number,
  velocityY: number,
  radius: number,
  thermal: number,
): number {
  const capacity = Math.floor(data.length / LIQUID_STRIDE_FLOATS);
  if (count >= capacity) return count;
  const offset = count * LIQUID_STRIDE_FLOATS;
  data[offset] = x;
  data[offset + 1] = y;
  data[offset + 2] = velocityX;
  data[offset + 3] = velocityY;
  data[offset + 4] = radius;
  data[offset + 5] = thermal;
  return count + 1;
}

function drawFixtureChains(state: ConstraintRawState, size: { width: number; height: number }, groups: Map<number, number[]>): void {
  const engine = state.engine;
  if (!engine) return;
  const color: [number, number, number, number] = [0.58, 0.58, 0.58, 1];
  state.gl.disable(state.gl.BLEND);
  for (const indices of groups.values()) {
    if (!indices.every((index) => engine.inverseMasses[index] <= 0)) continue;
    let radius = 0;
    for (const index of indices) radius = Math.max(radius, engine.radii[index]);
    if (indices.length === 1) {
      const k = indices[0] << 1;
      const disk = buildDiskTriangles(state, { x: engine.positions[k], y: engine.positions[k + 1] }, radius * 1.08, 20);
      if (disk.length > 0) uploadDynamicGeometry(state, size, disk.data, color, state.gl.TRIANGLES, disk.length);
      continue;
    }
    const points = renderPointsForIndices(state, engine, indices);
    const body = buildSmoothOpenSkinTriangles(state, points, radius * 1.08);
    if (body.length > 0) uploadDynamicGeometry(state, size, body.data, color, state.gl.TRIANGLES, body.length);
  }
  state.gl.enable(state.gl.BLEND);
}

function renderLiquidSnakeSurface(state: ConstraintRawState, size: { width: number; height: number }): boolean {
  const engine = state.engine;
  const renderer = state.liquidSurface;
  const buffer = state.liquidParticleBuffer;
  const data = state.liquidParticleData;
  if (!engine || !renderer || !buffer || !data || engine.count <= 0) return false;
  const groups = groupedParticleIndices(engine, state);
  const liquidRadius = Math.max(0.55, Math.min(7.5, finiteNumberSetting(state.settings, 'liquidParticleRadius', 1.45)));
  const visualRadiusScale = 0.78 + liquidRadius * 0.46;
  const bridgeFill = Math.max(0, Math.min(3, finiteNumberSetting(state.settings, 'liquidFillDensity', 1.1)));
  const bridgeSpacingScale = Math.max(0.32, 1.25 - bridgeFill * 0.24);
  const scaleX = state.width / Math.max(1, size.width);
  const scaleY = state.height / Math.max(1, size.height);
  const radiusScale = Math.sqrt(Math.max(0.0001, scaleX * scaleY));
  let count = 0;
  for (const [group, indices] of groups.entries()) {
    if (indices.length <= 0 || indices.every((index) => engine.inverseMasses[index] <= 0)) continue;
    const thermal = Math.max(0, Math.min(1, ((group - 1) % 4) / 3));
    for (let cursor = 0; cursor < indices.length; cursor += 1) {
      const index = indices[cursor];
      const k = index << 1;
      const x = engine.positions[k] * scaleX;
      const y = engine.positions[k + 1] * scaleY;
      const velocityX = engine.velocities[k] * scaleX;
      const velocityY = engine.velocities[k + 1] * scaleY;
      const radius = engine.radii[index] * visualRadiusScale * radiusScale;
      const speed = length2d(engine.velocities[k], engine.velocities[k + 1]);
      count = pushLiquidSnakeParticle(
        data,
        count,
        x,
        y,
        velocityX,
        velocityY,
        radius,
        Math.max(thermal * 0.72, Math.min(1, speed / 900) * 0.38),
      );
      if (cursor >= indices.length - 1) continue;
      const next = indices[cursor + 1];
      const nk = next << 1;
      const nextX = engine.positions[nk] * scaleX;
      const nextY = engine.positions[nk + 1] * scaleY;
      const nextVelocityX = engine.velocities[nk] * scaleX;
      const nextVelocityY = engine.velocities[nk + 1] * scaleY;
      const dx = nextX - x;
      const dy = nextY - y;
      const distance = length2d(dx, dy);
      const averageRadius = (engine.radii[index] + engine.radii[next]) * 0.5 * visualRadiusScale * radiusScale;
      const bridgeCount = Math.max(0, Math.min(12, Math.ceil(distance / Math.max(1, averageRadius * bridgeSpacingScale)) - 1));
      for (let bridge = 1; bridge <= bridgeCount; bridge += 1) {
        const t = bridge / (bridgeCount + 1);
        count = pushLiquidSnakeParticle(
          data,
          count,
          x + dx * t,
          y + dy * t,
          velocityX + (nextVelocityX - velocityX) * t,
          velocityY + (nextVelocityY - velocityY) * t,
          averageRadius,
          thermal * 0.72,
        );
      }
    }
  }
  if (count <= 0) return false;
  const gl = state.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * LIQUID_STRIDE_FLOATS), gl.DYNAMIC_DRAW);
  state.densityUploadFloats = count * LIQUID_STRIDE_FLOATS;
  const palette = state.style?.palette?.length ? state.style.palette.slice(0, 4) : [0x72e8ff, 0xe6fbff, 0x78a8ff, 0xffffff];
  while (palette.length < 4) palette.push(palette[palette.length - 1] ?? 0xffffff);
  const options = {
    ...liquidSurfaceOptionsFromSettings(state.settings, 'ultra'),
    pointScale: 1 + liquidRadius * 0.34,
    densityScale: Math.max(0.45, Math.min(2.5, finiteNumberSetting(state.settings, 'liquidSplatDensity', 1.14))),
  };
  const fieldScale = Math.max(0.35, Math.min(1.5, finiteNumberSetting(state.settings, 'liquidFieldScale', 0.78)));
  const resolution = Math.max(96, Math.round(Math.max(state.width, state.height) * fieldScale));
  const rendered = renderLiquidSurfaceFromBufferParticles({
    state,
    renderer,
    particleBuffer: buffer,
    particleCount: count,
    strideBytes: LIQUID_STRIDE_BYTES,
    positionOffsetBytes: 0,
    velocityOffsetBytes: 2 * Float32Array.BYTES_PER_ELEMENT,
    renderDataOffsetBytes: 4 * Float32Array.BYTES_PER_ELEMENT,
    palette: { palette, background: state.style?.background },
    options,
    resolution,
  });
  drawFixtureChains(state, size, groups);
  return rendered;
}

void clampRenderPoint;
void buildTubeTriangles;
void smoothClosedBoundary;
void buildFanTriangles;

function seedStarterBodies(state: ConstraintRawState, kind: ConstraintDemoKind, preview = false, forceDemoFixtures = false): void {
  state.engine?.clear();
  state.nextGroupId = 1;
  state.spawnAccumulator = 0;
  if (kind === 'chain-rain' && (preview || forceDemoFixtures || state.mode === 'demo')) {
    seedChainRainBuildFixtures(state, preview);
  }
  for (let i = 0; i < (preview ? (kind === 'chain-rain' ? 2 : 1) : (kind === 'chain-rain' ? 5 : 4)); i += 1) {
    if (kind === 'chain-rain') spawnChain(state);
    else spawnBlob(state);
  }
  markGpuConstraintDirty(state, true);
}

function demoFloorIsDropped(state: ConstraintRawState, preview: boolean): boolean {
  if (!preview && state.inputMode !== 'rain' && state.mode !== 'demo') return false;
  const cycleSeconds = preview ? 8 : 11;
  const dropSeconds = preview ? 1.75 : 2.4;
  return state.timeSeconds % cycleSeconds >= cycleSeconds - dropSeconds;
}

function interactionRadius(state: ConstraintRawState): number {
  return Math.max(1, finiteNumberSetting(state.settings, 'interactionRadius', 56));
}

function pickNearbyParticles(state: ConstraintRawState, x: number, y: number): number[] {
  const engine = state.engine;
  const picked = state.pickedParticleIndices ?? (state.pickedParticleIndices = []);
  picked.length = 0;
  if (!engine) return picked;
  const radius = interactionRadius(state);
  const radius2 = radius * radius;
  for (let i = 0; i < engine.count; i += 1) {
    const k = i << 1;
    const dx = engine.positions[k] - x;
    const dy = engine.positions[k + 1] - y;
    if (dx * dx + dy * dy <= radius2) picked.push(i);
  }
  return picked;
}

function applyPickedParticleForces(state: ConstraintRawState, kind: ConstraintDemoKind, x: number, y: number): void {
  const engine = state.engine;
  const picked = state.pickedParticleIndices ?? [];
  if (!engine || picked.length === 0) return;
  const previousX = state.previousPointerX ?? x;
  const previousY = state.previousPointerY ?? y;
  const pointerVx = (x - previousX) * 16;
  const pointerVy = (y - previousY) * 16;
  const radius = interactionRadius(state);
  const dt = Math.min(1 / 30, Math.max(1 / 240, state.deltaSeconds || 1 / 60));
  const strength = kind === 'chain-rain' ? 300 : 240;
  for (const index of picked) {
    if (index < 0 || index >= engine.count) continue;
    const k = index << 1;
    const dx = x - engine.positions[k];
    const dy = y - engine.positions[k + 1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= 0.001) continue;
    const normalizedDistance = Math.min(3, distance / Math.max(1, radius));
    const exponentialPull = (Math.exp(normalizedDistance) - 1) / (Math.E - 1);
    const acceleration = strength * exponentialPull;
    engine.velocities[k] += (dx / distance) * acceleration * dt * 60;
    engine.velocities[k + 1] += (dy / distance) * acceleration * dt * 60;
    engine.velocities[k] = engine.velocities[k] * 0.95 + pointerVx * 0.05;
    engine.velocities[k + 1] = engine.velocities[k + 1] * 0.95 + pointerVy * 0.05;
  }
  state.previousPointerX = x;
  state.previousPointerY = y;
}

function drawInteractionRadius(state: ConstraintRawState, kind: ConstraintDemoKind, size: { width: number; height: number }): void {
  if (state.inputMode !== 'interact' || !state.pointerDown || state.pointerX == null || state.pointerY == null) return;
  if (!state.drawProgram || !state.drawVao || !state.drawBuffer || !state.uDrawResolution || !state.uDrawColor) return;
  const gl = state.gl;
  const radius = interactionRadius(state);
  const segments = 72;
  const floatLength = (segments + 2) * 2;
  const data = ensureFloatScratch(state.interactionRadiusData, floatLength);
  state.interactionRadiusData = data;
  data[0] = state.pointerX;
  data[1] = state.pointerY;
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const offset = (i + 1) * 2;
    data[offset] = state.pointerX + Math.cos(angle) * radius;
    data[offset + 1] = state.pointerY + Math.sin(angle) * radius;
  }
  gl.useProgram(state.drawProgram);
  gl.bindVertexArray(state.drawVao);
  uploadDrawBuffer(state, data, floatLength);
  gl.uniform2f(state.uDrawResolution, size.width, size.height);
  gl.uniform4f(state.uDrawColor, kind === 'chain-rain' ? 0.36 : 1, kind === 'chain-rain' ? 0.9 : 0.42, kind === 'chain-rain' ? 1 : 0.78, 0.14);
  gl.drawArrays(gl.TRIANGLE_FAN, 0, floatLength / 2);
  gl.bindVertexArray(null);
}

function installPointer(state: ConstraintRawState, kind: ConstraintDemoKind): void {
  const canvas = state.canvas;
  const toLocal = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const commitDrawnShape = (): void => {
    const points = state.drawPoints ?? [];
    const beforeCount = state.engine?.count ?? 0;
    state.drawing = false;
    state.drawPointerId = undefined;
    if (points.length >= (state.inputMode === BUILD_MODE_ID ? 1 : 2)) {
      if (state.inputMode === BUILD_MODE_ID) spawnBuildFixture(state);
      else if (kind === 'chain-rain') spawnDrawnChain(state);
      else if (!spawnDrawnBlob(state) && (state.engine?.count ?? 0) <= beforeCount) {
        const radius = finiteNumberSetting(state.settings, 'nodeRadius', 4);
        const stiffness = blobConstraintStiffnesses(state);
        addClosedBlobFromSamples(state, fallbackBlobSamplesFromDraw(points, radius), radius, stiffness);
      }
      if ((state.engine?.count ?? 0) !== beforeCount) markGpuConstraintDirty(state, true);
    }
    points.length = 0;
    state.drawPoints = points;
  };
  const down = (event: PointerEvent) => {
    const point = toLocal(event);
    if (state.inputMode === 'draw' || state.inputMode === BUILD_MODE_ID) {
      state.needsRedraw = true;
      state.drawing = true;
      state.drawPointerId = event.pointerId;
      const points = state.drawPoints ?? (state.drawPoints = []);
      points.length = 0;
      points.push(point);
      try {
        canvas.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture is best-effort; drawing still works through normal pointer events.
      }
      event.preventDefault();
      return;
    }
    if (state.inputMode !== 'interact') return;
    state.pointerDown = true;
    state.needsRedraw = true;
    state.pointerX = point.x;
    state.pointerY = point.y;
    state.previousPointerX = point.x;
    state.previousPointerY = point.y;
    pickNearbyParticles(state, point.x, point.y);
    applyPickedParticleForces(state, kind, point.x, point.y);
    state.engine?.wake();
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is best-effort; interaction still works through normal pointer events.
    }
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (state.drawing) {
      state.needsRedraw = true;
      const point = toLocal(event);
      const points = state.drawPoints ?? [];
      const previous = points[points.length - 1];
      const dx = point.x - (previous?.x ?? point.x);
      const dy = point.y - (previous?.y ?? point.y);
      if (!previous || dx * dx + dy * dy > 16) {
        points.push(point);
        if (points.length > 256) points.splice(0, points.length - 256);
        state.drawPoints = points;
      }
      event.preventDefault();
      return;
    }
    if (state.inputMode !== 'interact' || !state.pointerDown) return;
    const point = toLocal(event);
    state.pointerX = point.x;
    state.pointerY = point.y;
    state.needsRedraw = true;
    applyPickedParticleForces(state, kind, point.x, point.y);
    state.engine?.wake();
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {
    if (state.drawing) {
      state.needsRedraw = true;
      const point = toLocal(event);
      const points = state.drawPoints ?? [];
      const previous = points[points.length - 1];
      const dx = point.x - (previous?.x ?? point.x);
      const dy = point.y - (previous?.y ?? point.y);
      if (!previous || dx * dx + dy * dy >= 4) {
        points.push(point);
        if (points.length > 256) points.splice(0, points.length - 256);
        state.drawPoints = points;
      }
      commitDrawnShape();
      event.preventDefault();
    }
    state.pointerDown = false;
    state.needsRedraw = true;
    state.grabbedIndex = -1;
    if (state.pickedParticleIndices) state.pickedParticleIndices.length = 0;
    try {
      canvas.releasePointerCapture?.(event.pointerId);
    } catch {
      // Ignore browsers that reject release after a cancelled capture.
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  state.cleanupPointer = () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
}

export class AdvancedConstraintParticlesRawScene extends RawWebGL2Scene {
  private readonly qualityState: { value: RenderQuality };

  constructor(kind: ConstraintDemoKind, preview = false) {
    const qualityState = { value: 'raw' as RenderQuality };
    const sceneCapacity = preview ? (kind === 'chain-rain' ? 2400 : 320) : 80_000;
    super({
      name: kind,
      canvasSelector: 'canvas',
      markup: '<canvas class="h-full w-full touch-none bg-slate-950"></canvas>',
      maxDevicePixelRatio: 2,
      renderScale: () => resolveAdvancedPhysicsFidelityProfile(qualityState.value).renderScale,
      onInit: (state) => {
        const s = state as ConstraintRawState;
        const gl = s.gl;
        const size = logicalSize(s);
        s.activeQuality = qualityState.value;
        s.inputMode = preview ? 'rain' : 'draw';
        s.nextGroupId = 1;
        s.blobEdgeLinks = [];
        s.blobBendLinks = [];
        s.blobRadialLinks = [];
        s.blobRestAreas = new Map();
        s.spawnAccumulator = 0;
        s.demoFloorDropped = false;
        s.pointerDown = false;
        s.grabbedIndex = -1;
        s.needsRedraw = true;
        s.pickedParticleIndices = [];
        s.drawPoints = [];
        s.engine = new AdvancedCircleParticleEngine(sceneCapacity);
        s.engine.configure(engineSettings(s, kind, qualityState.value, preview));
        s.engine.setBounds(size.width, size.height);
        seedStarterBodies(s, kind, preview);
        if (preview && ensureGpuConstraintPreviewState(s, kind, sceneCapacity)) syncGpuConstraintStateFromEngine(s);

        s.program = link(gl);
        s.drawProgram = linkSources(gl, DRAW_VERTEX, DRAW_FRAGMENT);
        s.vao = gl.createVertexArray();
        s.drawVao = gl.createVertexArray();
        s.quadBuffer = gl.createBuffer() ?? undefined;
        s.centerBuffer = gl.createBuffer() ?? undefined;
        s.liquidSurface = createRawLiquidSurfaceRenderer(gl);
        s.liquidParticleBuffer = gl.createBuffer() ?? undefined;
        s.liquidParticleData = new Float32Array(sceneCapacity * 8 * LIQUID_STRIDE_FLOATS);
        s.drawBuffer = gl.createBuffer() ?? undefined;
        s.drawPreviewData = new Float32Array(514);
        s.uResolution = gl.getUniformLocation(s.program, 'uResolution');
        s.uRadius = gl.getUniformLocation(s.program, 'uRadius');
        s.uPrimary = gl.getUniformLocation(s.program, 'uPrimary');
        s.uSecondary = gl.getUniformLocation(s.program, 'uSecondary');
        s.uDrawResolution = gl.getUniformLocation(s.drawProgram, 'uResolution');
        s.uDrawColor = gl.getUniformLocation(s.drawProgram, 'uColor');
        initDensityRenderer(s);

        gl.bindVertexArray(s.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.quadBuffer ?? null);
        gl.bufferData(gl.ARRAY_BUFFER, PARTICLE_QUAD, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.centerBuffer ?? null);
        gl.bufferData(gl.ARRAY_BUFFER, sceneCapacity * 2 * 4, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(1, 1);
        gl.bindVertexArray(null);

        gl.bindVertexArray(s.drawVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.drawBuffer ?? null);
        s.drawBufferCapacity = 257 * 2;
        gl.bufferData(gl.ARRAY_BUFFER, s.drawBufferCapacity * 4, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        installPointer(s, kind);
      },
      onReset: (state) => {
        const s = state as ConstraintRawState;
        s.demoFloorDropped = false;
        s.blobEdgeLinks = [];
        s.blobBendLinks = [];
        s.blobRadialLinks = [];
        s.blobRestAreas = new Map();
        seedStarterBodies(s, kind, preview);
        s.needsRedraw = true;
        markGpuConstraintDirty(s, true);
        s.gpuConstraintForceFullStaticUpload = true;
        s.gpuConstraintForceFullTopologyUpload = true;
        if (preview) syncGpuConstraintStateFromEngine(s);
      },
      onSettingsChange: (state) => {
        const s = state as ConstraintRawState;
        s.needsRedraw = true;
        s.engine?.wake();
        markGpuConstraintDirty(s, true);
        s.gpuConstraintForceFullStaticUpload = true;
        s.gpuConstraintForceFullTopologyUpload = true;
      },
      onStyleChange: (state) => {
        const s = state as ConstraintRawState;
        s.needsRedraw = true;
      },
      onModeChange: (state, mode) => {
        const s = state as ConstraintRawState;
        s.needsRedraw = true;
        if (mode === 'interact' || mode === 'draw' || mode === BUILD_MODE_ID || mode === 'rain') s.inputMode = mode;
        else if (mode === 'demo') {
          s.inputMode = 'rain';
          seedStarterBodies(s, kind, preview, true);
          markGpuConstraintDirty(s, true);
          s.gpuConstraintForceFullStaticUpload = true;
          s.gpuConstraintForceFullTopologyUpload = true;
          if (ensureGpuConstraintPreviewState(s, kind, preview ? sceneCapacity : GPU_DEMO_CAPACITY)) syncGpuConstraintStateFromEngine(s);
        }
        s.pointerDown = false;
        s.grabbedIndex = -1;
        if (s.pickedParticleIndices) s.pickedParticleIndices.length = 0;
        s.drawing = false;
        if (s.drawPoints) s.drawPoints.length = 0;
      },
      shouldRender: (state) => constraintSceneShouldRender(state as ConstraintRawState, preview),
      render: (state) => {
        const s = state as ConstraintRawState;
        const gl = s.gl;
        const engine = s.engine;
        if (!engine) return;
        const profile = resolveAdvancedPhysicsFidelityProfile(qualityState.value);
        const size = logicalSize(s);
        s.activeQuality = qualityState.value;
        const gpuDemoActive = kind !== 'chain-rain' && (preview || (s.mode === 'demo' && !s.pointerDown));
        const floorDropped = preview && kind === 'chain-rain' ? false : demoFloorIsDropped(s, preview);
        if (s.demoFloorDropped === true && !floorDropped) {
          seedStarterBodies(s, kind, preview);
          markGpuConstraintDirty(s, true);
          s.gpuConstraintForceFullStaticUpload = true;
          s.gpuConstraintForceFullTopologyUpload = true;
          if (gpuDemoActive && ensureGpuConstraintPreviewState(s, kind, preview ? sceneCapacity : GPU_DEMO_CAPACITY)) syncGpuConstraintStateFromEngine(s);
        }
        s.demoFloorDropped = floorDropped;
        const floorHeight = floorDropped ? size.height + Math.max(180, size.height * 1.35) : size.height;
        engine.configure(engineSettings(s, kind, qualityState.value, preview));
        engine.setBounds(size.width, floorHeight);

        if (gpuDemoActive && ensureGpuConstraintPreviewState(s, kind, preview ? sceneCapacity : GPU_DEMO_CAPACITY) && s.gpuConstraintState) {
          if (s.gpuConstraintNeedsSeed !== false || s.gpuConstraintNeedsTopologySeed !== false) syncGpuConstraintStateFromEngine(s);
          gl.viewport(0, 0, s.width, s.height);
          gl.clearColor(0.02, 0.025, 0.055, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          if (renderGpuConstraintPreview(s, kind, size)) {
            s.needsRedraw = false;
            return;
          }
        }

        const previewSnakeRain = preview && kind === 'chain-rain';
        const belowPreviewLimit = !preview || engine.count < (kind === 'chain-rain' ? 2200 : 80);
        if ((previewSnakeRain || !floorDropped) && (s.inputMode === 'rain' || preview) && belowPreviewLimit) {
          const spawnRate = (preview ? (kind === 'chain-rain' ? 3.25 : 0.35) : finiteNumberSetting(s.settings, 'spawnRate', kind === 'chain-rain' ? 5 : 2)) * profile.spawnRateScale;
          s.spawnAccumulator = (s.spawnAccumulator ?? 0) + spawnRate * s.deltaSeconds;
          const spawnCount = Math.min(8, s.spawnAccumulator | 0);
          for (let i = 0; i < spawnCount; i += 1) {
            if (kind === 'chain-rain') spawnChain(s);
            else spawnBlob(s);
          }
          s.spawnAccumulator -= spawnCount;
        }
        if (s.inputMode === 'interact' && s.pointerDown && s.pointerX != null && s.pointerY != null) {
          applyPickedParticleForces(s, kind, s.pointerX, s.pointerY);
        }
        if (kind === 'soft-blob') applyBlobConstraintStiffness(s);
        s.stats = engine.step(s.deltaSeconds);
        if (kind === 'soft-blob') solveSoftBlobAmoebaConstraints(s);

        gl.viewport(0, 0, s.width, s.height);
        gl.clearColor(0.02, 0.025, 0.055, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        drawInteractionRadius(s, kind, size);
        if (!s.program || !s.vao || !s.centerBuffer || !s.uResolution || !s.uRadius || !s.uPrimary || !s.uSecondary) return;

        const ultra = kind === 'chain-rain' && renderStyleIsUltra(s);
        const enhanced = renderStyleIsEnhanced(s);
        if (ultra || enhanced) {
          s.liveGpuDensityRendered = false;
          s.liveGpuDensityPointDraws = 0;
          s.liveGpuDensitySource = 'cpu-live-state';
          s.liveGpuSortedCandidateFeedbackRenderEligible = false;
          s.liveGpuSortedCandidateFeedbackRenderActive = false;
          s.liveGpuSortedCandidateFeedbackRenderBlocker = 'not-rendered';
          s.densityUploadFloats = 0;
          if (ultra) {
            if (!renderLiquidSnakeSurface(s, size)) drawSkinMeshChains(s, size);
          } else if (kind === 'chain-rain') drawSkinMeshChains(s, size);
          else if (!renderLiveGpuDensityBody(s, kind, size) && !drawDensityBody(s, kind, size)) drawSkinMeshBlobs(s, size);
        } else {
          s.liveGpuDensityRendered = false;
          s.liveGpuDensityPointDraws = 0;
          s.liveGpuDensitySource = 'cpu-live-state';
          s.liveGpuSortedCandidateFeedbackRenderEligible = false;
          s.liveGpuSortedCandidateFeedbackRenderActive = false;
          s.liveGpuSortedCandidateFeedbackRenderBlocker = 'not-rendered';
          s.densityUploadFloats = engine.count * 2;
          const palette = s.style?.palette ?? [];
          gl.useProgram(s.program);
          gl.bindVertexArray(s.vao);
          gl.uniform2f(s.uResolution, size.width, size.height);
          gl.uniform1f(s.uRadius, kind === 'chain-rain' ? finiteNumberSetting(s.settings, 'nodeRadius', 5) : softBlobNodeRadius(s));
          gl.uniform3fv(s.uPrimary, colorToRgb(palette[0], kind === 'chain-rain' ? [0.45, 0.9, 1] : [1, 0.42, 0.68]));
          gl.uniform3fv(s.uSecondary, colorToRgb(palette[1], kind === 'chain-rain' ? [0.9, 0.95, 1] : [0.6, 0.95, 1]));
          if (engine.count > 0) {
            const centerUploadData = ensureCenterUploadData(s, engine.count * 2);
            const centerCount = engine.writeParticlePositions(centerUploadData, 2);
            gl.bindBuffer(gl.ARRAY_BUFFER, s.centerBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, centerUploadData, 0, centerCount * 2);
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, centerCount);
          }
          gl.bindVertexArray(null);
        }

        if ((s.inputMode === 'draw' || s.inputMode === BUILD_MODE_ID) && s.drawing && s.drawPoints && s.drawPoints.length > 1 && s.drawProgram && s.drawVao && s.drawBuffer && s.uDrawResolution && s.uDrawColor) {
          const sourcePoints = s.drawPoints;
          const sourceCount = Math.min(256, sourcePoints.length);
          const buildLine = s.inputMode === BUILD_MODE_ID && sourceCount > 1;
          const pointCount = buildLine ? 2 : kind === 'soft-blob' && sourceCount > 2 ? sourceCount + 1 : sourceCount;
          const data = s.drawPreviewData && s.drawPreviewData.length >= pointCount * 2
            ? s.drawPreviewData
            : (s.drawPreviewData = new Float32Array(pointCount * 2));
          for (let index = 0; index < pointCount; index += 1) {
            const sourceIndex = buildLine ? (index === 0 ? 0 : sourceCount - 1) : index === sourceCount ? 0 : index;
            const point = sourcePoints[sourceIndex];
            if (!point) continue;
            data[index * 2] = point.x;
            data[index * 2 + 1] = point.y;
          }
          gl.useProgram(s.drawProgram);
          gl.bindVertexArray(s.drawVao);
          uploadDrawBuffer(s, data, pointCount * 2);
          gl.uniform2f(s.uDrawResolution, size.width, size.height);
          gl.uniform4f(s.uDrawColor, s.inputMode === BUILD_MODE_ID ? 0.58 : (kind === 'chain-rain' ? 0.45 : 1), s.inputMode === BUILD_MODE_ID ? 0.58 : (kind === 'chain-rain' ? 0.92 : 0.42), s.inputMode === BUILD_MODE_ID ? 0.58 : (kind === 'chain-rain' ? 1 : 0.78), 0.86);
          gl.drawArrays(gl.LINE_STRIP, 0, pointCount);
          gl.bindVertexArray(null);
        }
        s.needsRedraw = false;
      },
      getDebugStats: (state) => {
        const s = state as ConstraintRawState;
        const stats = s.stats ?? s.engine?.getStats();
        if (!stats) return null;
        if ((preview || s.mode === 'demo') && s.gpuConstraintState) {
          const gpuPreviewLabel = preview ? 'preview' : 'demo';
          const stepStats = s.gpuConstraintStep?.stats();
          const jacobiStats = s.gpuConstraintJacobi?.stats();
          const collisionStats = s.gpuConstraintCollision?.stats();
          const collisionNeighborStats = s.gpuConstraintCollisionNeighborStats;
          const gridKeyStats = s.gpuConstraintGridKeyStats;
          const candidateStats = s.gpuConstraintCandidateSlotStats;
          const densityStats = s.gpuConstraintDensityRenderer?.stats();
          const jacobiPasses = Math.max(1, Math.min(8, Math.floor(finiteNumberSetting(s.settings, 'solverPasses', 3))));
          return scalarDebugStats({
            renderer: kind === 'chain-rain' ? `raw-webgl2-snakes-gpu-density-${gpuPreviewLabel}` : `raw-webgl2-soft-blob-gpu-density-${gpuPreviewLabel}`,
            ...rawGpuMetricsToDebugStats(s.gpuConstraintState.metrics({
              engine: kind === 'chain-rain' ? `raw-gpu-constraint-snakes-${gpuPreviewLabel}` : `raw-gpu-constraint-soft-blobs-${gpuPreviewLabel}`,
              passesPerFrame: 1 + jacobiPasses + (collisionStats?.iterations ?? 0),
            })),
            rendering: 'gpu-texture-density-metaball-composite',
            gpuSimulated: true,
            gpuRendered: true,
            cpuTopology: true,
            cpuUpload: (s.gpuConstraintStateSeedUploadFloats ?? 0) > 0 || (s.gpuConstraintTopologySeedUploadFloats ?? 0) > 0,
            gpuConstraintJacobiActive: (jacobiStats?.fragmentTexels ?? 0) > 0,
            gpuConstraintStepActive: (stepStats?.fragmentTexels ?? 0) > 0,
            gpuConstraintStepSource: s.liveGpuStepSource ?? 'none',
            gpuConstraintCollisionActive: (collisionStats?.fragmentTexels ?? 0) > 0,
            particles: s.gpuConstraintParticleCount ?? stats.count,
            dynamicParticles: stats.dynamicCount,
            links: s.gpuConstraintLinkCount ?? stats.linkCount,
            capacity: stats.capacity,
            awake: stats.awake,
            settledFrames: stats.settledFrames,
            maxVelocity: Math.round(stats.maxVelocity * 100) / 100,
            maxCorrection: Math.round(stats.maxCorrection * 1000) / 1000,
            seedUploadFloats: s.gpuConstraintStateSeedUploadFloats ?? s.gpuConstraintState.seedUploadFloats(),
            staticUploadMode: s.liveGpuStaticUploadMode ?? 'none',
            staticAttributeWriteCount: s.liveGpuStaticAttributeWriteCount ?? 0,
            neighborSeedUploadFloats: s.gpuConstraintTopologySeedUploadFloats ?? s.gpuConstraintNeighbors?.seedUploadFloats() ?? 0,
            neighborDirectUploadFloats: s.liveGpuNeighborDirectUploadFloats ?? s.gpuConstraintNeighbors?.directUploadFloats() ?? 0,
            neighborPaddedUploadFloats: s.liveGpuNeighborPaddedUploadFloats ?? s.gpuConstraintNeighbors?.paddedUploadFloats() ?? 0,
            neighborSlotWriteCount: s.liveGpuNeighborSlotWriteCount ?? 0,
            neighborTopologyRangeStart: s.liveGpuNeighborTopologyRangeStart ?? 0,
            neighborTopologyRangeCount: s.liveGpuNeighborTopologyRangeCount ?? 0,
            activeParticleRows: s.gpuConstraintActiveRows ?? 0,
            uploadedParticleRows: s.gpuConstraintUploadedRows ?? 0,
            reservedParticleRows: s.gpuConstraintState.height,
            stepActiveRows: stepStats?.activeRows ?? 0,
            jacobiActiveRows: jacobiStats?.activeRows ?? 0,
            gpuStepFragmentTexels: stepStats?.fragmentTexels ?? 0,
            gpuStepDt: Math.round((s.liveGpuStepDt ?? 0) * 10000) / 10000,
            gpuJacobiFragmentTexels: jacobiStats?.fragmentTexels ?? 0,
            gpuCollisionFragmentTexels: collisionStats?.fragmentTexels ?? 0,
            gpuCollisionIterations: collisionStats?.iterations ?? 0,
            gpuCollisionNeighborSamples: collisionStats?.neighborSamples ?? 0,
            gpuCollisionBroadphase: collisionStats?.broadphase ?? 'texture-adjacency',
            gpuCollisionBroadphaseOwner: collisionStats?.broadphaseOwner ?? 'texture-layout',
            gpuCollisionSpatiallyComplete: collisionStats?.spatiallyComplete ?? false,
            gpuCollisionNeighborSlotWrites: collisionNeighborStats?.slotWrites ?? 0,
            gpuCollisionNeighborStagingClearFloats: collisionNeighborStats?.stagingClearFloats ?? 0,
            gpuCollisionNeighborStagingWriteFloats: collisionNeighborStats?.stagingWriteFloats ?? 0,
            gpuCollisionNeighborCandidatePairs: collisionNeighborStats?.candidatePairs ?? 0,
            gpuCollisionNeighborOverflowCount: collisionNeighborStats?.overflowCount ?? 0,
            gpuCollisionNeighborUploadFloats: s.gpuConstraintCollisionNeighborUploadFloats ?? 0,
            gpuCollisionNeighborDirectUploadFloats: s.gpuConstraintCollisionNeighborDirectUploadFloats ?? 0,
            gpuCollisionNeighborPaddedUploadFloats: s.gpuConstraintCollisionNeighborPaddedUploadFloats ?? 0,
            gpuCollisionNeighborActiveRows: s.gpuConstraintCollisionNeighborActiveRows ?? 0,
            gpuCollisionNeighborUploadedRows: s.gpuConstraintCollisionNeighborUploadedRows ?? 0,
            gpuCollisionNeighborReservedRows: s.gpuConstraintCollisionNeighborReservedRows ?? 0,
            gpuGridKeyActive: (gridKeyStats?.fragmentTexels ?? 0) > 0,
            gpuGridKeyParticleCount: gridKeyStats?.activeParticleCount ?? 0,
            gpuGridKeyRows: gridKeyStats?.activeRows ?? 0,
            gpuGridKeyFragmentTexels: gridKeyStats?.fragmentTexels ?? 0,
            gpuGridKeyColumns: gridKeyStats?.gridColumns ?? 0,
            gpuGridKeyCellRows: gridKeyStats?.gridRows ?? 0,
            gpuGridKeyCellSize: gridKeyStats?.cellSize ?? 0,
            gpuGridKeyBroadphaseOwner: gridKeyStats?.broadphaseOwner ?? 'gpu',
            gpuGridKeyProducesCandidateSlots: gridKeyStats?.producesCandidateSlots ?? false,
            gpuCandidateSlotsActive: (candidateStats?.fragmentTexels ?? 0) > 0,
            gpuCandidateSlotCount: candidateStats?.slotCount ?? 0,
            gpuCandidateSamples: candidateStats?.candidateSamples ?? 0,
            gpuCandidateFragmentTexels: candidateStats?.fragmentTexels ?? 0,
            gpuCandidateBroadphase: candidateStats?.broadphase ?? 'gpu-grid-key-window',
            gpuCandidateBroadphaseOwner: candidateStats?.broadphaseOwner ?? 'gpu',
            gpuCandidateSpatiallyComplete: candidateStats?.spatiallyComplete ?? false,
            gpuCandidateProducesCandidateSlots: candidateStats?.producesCandidateSlots ?? false,
            gpuCandidateCoverage: candidateStats?.coverage ?? 'texture-window',
            gpuCandidateLimitation: candidateStats?.limitation ?? 'samples-adjacent-texture-neighbors-only',
            gpuCandidateRequiredReplacement: candidateStats?.requiredReplacement ?? 'gpu-spatial-bin-scatter-or-sort',
            gpuCandidateSuitableForAuthoritativeCollision: candidateStats?.suitableForAuthoritativeCollision ?? false,
            gpuCollisionAuthoritativeReady: false,
            gpuCollisionStatus: 'non-authoritative-constraint-preview-stress-pass',
            gpuDensityPointDraws: densityStats?.pointDraws ?? 0,
            activeParticleCapacityRatio: Math.round(((s.gpuConstraintParticleCount ?? stats.count) / Math.max(1, s.gpuConstraintState.capacity)) * 10000) / 10000,
            seedDirty: s.gpuConstraintNeedsSeed !== false,
            topologySeedDirty: s.gpuConstraintNeedsTopologySeed !== false,
            liveGpuDynamicUploadSkipped: s.liveGpuDynamicUploadSkipped === true,
            liveGpuDynamicUploadSkipBlocker: s.liveGpuDynamicUploadSkipBlocker ?? 'gpu-state-not-seeded',
            hostSkippedRenderFrames: s.skippedRenderFrames,
            hostPendingRenderDeltaSeconds: Math.round(s.pendingRenderDeltaSeconds * 1000) / 1000,
            needsRedraw: s.needsRedraw === true,
            sleepRenderGateEligible: s.needsRedraw !== true && s.pointerDown !== true && s.drawing !== true && stats.awake === false,
          });
        }
        const liveCollisionStats = s.liveGpuDensityRendered === true ? s.gpuConstraintCollision?.stats() : undefined;
        const liveCollisionNeighborStats = s.liveGpuDensityRendered === true ? s.gpuConstraintCollisionNeighborStats : undefined;
        const liveGridKeyStats = s.liveGpuDensityRendered === true ? s.gpuConstraintGridKeyStats : undefined;
        const liveCandidateStats = s.liveGpuDensityRendered === true ? s.gpuConstraintCandidateSlotStats : undefined;
        const liveOccupancyStats = s.gpuConstraintSortedCandidateOccupancyStats;
        const liveCellOffsetStats = s.gpuConstraintSortedCandidateCellOffsetStats;
        const liveCellRangeStats = s.gpuConstraintSortedCandidateCellRangeStats;
        const liveCellRangeBridgeStats = s.gpuConstraintSortedCandidateCellRangeBridge?.stats();
        const liveCellKeyStats = s.gpuConstraintSortedCandidateCellKeyStats;
        const liveKeySortStats = s.gpuConstraintSortedCandidateKeySortStats;
        const liveSortedKeyGatherStats = s.gpuConstraintSortedCandidateSortedKeyGatherStats;
        const liveSortedKeyRangeStats = s.gpuConstraintSortedCandidateSortedKeyRangeStats;
        const liveResidentListStats = s.gpuConstraintSortedCandidateResidentListStats;
        const liveResidentListCandidateStats = s.gpuConstraintResidentListCandidateStats;
        const liveIndexMapStats = s.gpuConstraintSortedCandidateIndexMapBridge?.stats();
        const liveIndexMapGatherStats = s.gpuConstraintSortedCandidateIndexMapGather?.stats();
        const liveCpuSpatialSlotWrites = liveCollisionNeighborStats?.slotWrites ?? 0;
        const liveCpuSpatialCandidatePairs = liveCollisionNeighborStats?.candidatePairs ?? 0;
        const liveGpuCandidateCapacity = (liveCandidateStats?.activeParticleCount ?? 0) * (liveCandidateStats?.slotCount ?? 0);
        const liveGpuCandidateVsCpuSlotCapacityRatio = liveCpuSpatialSlotWrites > 0
          ? Math.round((liveGpuCandidateCapacity / liveCpuSpatialSlotWrites) * 10000) / 10000
          : liveGpuCandidateCapacity > 0 ? 1 : 0;
        const liveGpuCandidateVsCpuPairCapacityRatio = liveCpuSpatialCandidatePairs > 0
          ? Math.round((liveGpuCandidateCapacity / liveCpuSpatialCandidatePairs) * 10000) / 10000
          : liveGpuCandidateCapacity > 0 ? 1 : 0;
        const liveGpuCandidateFragmentToCpuUploadRatio = (s.gpuConstraintCollisionNeighborUploadFloats ?? 0) > 0
          ? Math.round(((liveCandidateStats?.fragmentTexels ?? 0) / (s.gpuConstraintCollisionNeighborUploadFloats ?? 1)) * 10000) / 10000
          : 0;
        const liveGpuSortedCandidateCollisionAllSlotsConsumed = (s.gpuConstraintSortedCandidateCollisionStressActive === true) && (s.gpuConstraintSortedCandidateCollisionIgnoredSlots ?? 0) === 0;
        const liveGpuSortedCandidateGatherBackComplete =
          s.gpuConstraintSortedCandidateIndexMapGatherActive === true &&
          liveIndexMapGatherStats?.destinationOrder === 'original-index' &&
          liveIndexMapGatherStats.suitableForOriginalOrderFeedback === true;
        const liveGpuSortedCandidateAuthoritativeReady =
          liveGpuSortedCandidateGatherBackComplete &&
          liveGpuSortedCandidateCollisionAllSlotsConsumed &&
          s.gpuConstraintSortedCandidateCollisionSpatiallyComplete === true &&
          s.gpuConstraintSortedCandidateUploadMode === 'gpu-sorted-key-gather';
        const liveGpuSortedCandidateAuthoritativeBlocker = liveGpuSortedCandidateAuthoritativeReady
          ? 'none'
          : s.gpuConstraintSortedCandidateUploadMode !== 'gpu-sorted-key-gather'
            ? 'sorted-state-still-cpu-uploaded'
            : liveGpuSortedCandidateGatherBackComplete !== true
              ? 'original-order-gather-not-complete'
              : liveGpuSortedCandidateCollisionAllSlotsConsumed !== true
                ? 'candidate-slots-not-fully-consumed'
                : s.gpuConstraintSortedCandidateCollisionSpatiallyComplete !== true
                  ? 'gpu-broadphase-not-spatially-complete'
                  : 'unknown';
        const liveGpuDynamicCpuUploadEliminated =
          s.liveGpuDensityRendered === true && s.liveGpuDynamicUploadSkipped === true;
        const liveGpuSortedCandidateCpuUploadFloats = s.gpuConstraintSortedCandidateUploadMode === 'cpu-sorted-copy'
          ? s.gpuConstraintSortedCandidateUploadFloats ?? 0
          : 0;
        const liveGpuRemainingCpuBridgeUploadFloats =
          (s.liveGpuDynamicUploadFloats ?? 0) +
          (s.liveGpuStaticUploadFloats ?? 0) +
          (s.gpuConstraintTopologySeedUploadFloats ?? 0) +
          (s.gpuConstraintCollisionNeighborUploadSkipped === true ? 0 : s.gpuConstraintCollisionNeighborUploadFloats ?? 0) +
          liveGpuSortedCandidateCpuUploadFloats +
          (s.gpuConstraintSortedCandidateCellRangeUploadFloats ?? 0) +
          (s.gpuConstraintSortedCandidateIndexMapUploadFloats ?? 0) +
          (s.gpuConstraintSortedCandidateBodyMetadataUploadFloats ?? 0);
        const liveGpuRecurringCpuBridgeUploadFloats =
          (s.liveGpuDynamicUploadFloats ?? 0) +
          (s.gpuConstraintCollisionNeighborUploadSkipped === true ? 0 : s.gpuConstraintCollisionNeighborUploadFloats ?? 0) +
          liveGpuSortedCandidateCpuUploadFloats +
          (s.gpuConstraintSortedCandidateCellRangeUploadFloats ?? 0) +
          (s.gpuConstraintSortedCandidateIndexMapUploadFloats ?? 0) +
          (s.gpuConstraintSortedCandidateBodyMetadataUploadFloats ?? 0);
        const liveGpuSeedCpuBridgeUploadFloats =
          (s.liveGpuStaticUploadFloats ?? 0) +
          (s.gpuConstraintTopologySeedUploadFloats ?? 0);
        const liveGpuRemainingCpuBridgeBlocker = s.liveGpuDensityRendered !== true
          ? 'gpu-live-density-render-inactive'
          : s.liveGpuDynamicUploadSkipped !== true
            ? `dynamic-upload:${s.liveGpuDynamicUploadSkipBlocker ?? 'unknown'}`
            : (s.gpuConstraintTopologySeedUploadFloats ?? 0) > 0
              ? 'cpu-topology-neighbor-seed'
              : s.gpuConstraintCollisionNeighborUploadSkipped !== true
                ? 'cpu-spatial-neighbor-slots'
                : s.gpuConstraintSortedCandidateUploadMode !== 'gpu-sorted-key-gather'
                  ? 'cpu-sorted-candidate-copy'
                  : (s.gpuConstraintSortedCandidateCellRangeUploadFloats ?? 0) > 0
                    ? 'cpu-cell-range-bridge'
                    : (s.gpuConstraintSortedCandidateIndexMapUploadFloats ?? 0) > 0
                      ? 'cpu-index-map-bridge'
                      : (s.gpuConstraintSortedCandidateBodyMetadataUploadFloats ?? 0) > 0
                        ? 'cpu-body-metadata-bridge'
                        : liveGpuSortedCandidateAuthoritativeReady !== true
                          ? liveGpuSortedCandidateAuthoritativeBlocker
                          : 'none';
        return scalarDebugStats({
          renderer: kind === 'chain-rain' ? 'raw-webgl2-snakes' : 'raw-webgl2-constraint-blobs',
          simulation: 'cpu-constraint-particles',
          rendering: renderStyleIsUltra(s)
            ? 'gpu-shared-liquid-surface-composite'
            : renderStyleIsEnhanced(s)
              ? s.liveGpuDensityRendered === true
                ? 'gpu-texture-density-metaball-composite-live'
                : 'gpu-density-metaball-composite'
            : 'gpu-instanced-particles',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: true,
          cpuUploadKind: s.liveGpuDensityRendered === true
            ? liveGpuDynamicCpuUploadEliminated
              ? 'gpu-live-state-resident-with-cpu-bridge'
              : 'cpu-seeded-gpu-live-bridge'
            : 'cpu-instanced-render-upload',
          liveGpuDynamicCpuUploadEliminated,
          liveGpuRemainingCpuBridgeUploadFloats,
          liveGpuRecurringCpuBridgeUploadFloats,
          liveGpuSeedCpuBridgeUploadFloats,
          liveGpuRemainingCpuBridgeBlocker,
          gpuConstraintStateActive: s.gpuConstraintState != null,
          liveGpuSimulationActive: false,
          liveGpuJacobiActive: false,
          liveGpuStepSource: s.liveGpuStepSource ?? 'none',
          liveGpuStepParticleCount: s.liveGpuStepParticleCount ?? 0,
          liveGpuStepActiveRows: s.liveGpuStepActiveRows ?? 0,
          liveGpuStepFragmentTexels: s.liveGpuStepFragmentTexels ?? 0,
          liveGpuStepDt: Math.round((s.liveGpuStepDt ?? 0) * 10000) / 10000,
          liveGpuRenderBridgeOnly: s.liveGpuDensityRendered === true,
          liveCollisionBroadphase: liveCollisionStats?.broadphase ?? 'none',
          liveCollisionBroadphaseOwner: liveCollisionStats?.broadphaseOwner ?? 'none',
          gpuBroadphaseMigrationTarget: 'RawGpuConstraintParticleCellRangeBridge',
          gpuBroadphaseReusableFor: 'ball-pit-snakes-soft-bodies',
          solver: s.engine?.kind ?? null,
          particles: stats.count,
          dynamicParticles: stats.dynamicCount,
          staticParticles: stats.staticCount,
          links: stats.linkCount,
          capacity: stats.capacity,
          awake: stats.awake,
          settledFrames: stats.settledFrames,
          maxVelocity: Math.round(stats.maxVelocity * 100) / 100,
          maxCorrection: Math.round(stats.maxCorrection * 1000) / 1000,
          collisions: stats.collisionHits,
          grid: `${stats.gridColumns}x${stats.gridRows}`,
          cellSize: Math.round(stats.cellSize * 100) / 100,
          gpuUploadFloats: s.densityUploadFloats ?? stats.count * 2,
          liveGpuDensityRendered: s.liveGpuDensityRendered === true,
          liveGpuDensityPointDraws: s.liveGpuDensityPointDraws ?? 0,
          liveGpuDensitySource: s.liveGpuDensitySource ?? 'cpu-live-state',
          liveGpuSortedCandidateFeedbackRenderEligible: s.liveGpuSortedCandidateFeedbackRenderEligible === true,
          liveGpuSortedCandidateFeedbackRenderActive: s.liveGpuSortedCandidateFeedbackRenderActive === true,
          liveGpuSortedCandidateFeedbackRenderBlocker: s.liveGpuSortedCandidateFeedbackRenderBlocker ?? 'not-rendered',
          liveGpuSeedUploadFloats: s.gpuConstraintStateSeedUploadFloats ?? 0,
          liveGpuDynamicUploadFloats: s.liveGpuDynamicUploadFloats ?? 0,
          liveGpuDynamicUploadSkipped: s.liveGpuDynamicUploadSkipped === true,
          liveGpuDynamicUploadSkipBlocker: s.liveGpuDynamicUploadSkipBlocker ?? 'gpu-state-not-seeded',
          liveGpuStaticUploadFloats: s.liveGpuStaticUploadFloats ?? 0,
          liveGpuStaticUploadMode: s.liveGpuStaticUploadMode ?? 'none',
          liveGpuStaticAttributeWriteCount: s.liveGpuStaticAttributeWriteCount ?? 0,
          liveGpuDirectUploadFloats: s.liveGpuDirectUploadFloats ?? 0,
          liveGpuPaddedUploadFloats: s.liveGpuPaddedUploadFloats ?? 0,
          liveGpuVelocityUploadSkipped: s.liveGpuVelocityUploadSkipped === true,
          liveGpuTopologyUploadFloats: s.gpuConstraintTopologySeedUploadFloats ?? 0,
          liveGpuNeighborDirectUploadFloats: s.liveGpuNeighborDirectUploadFloats ?? 0,
          liveGpuNeighborPaddedUploadFloats: s.liveGpuNeighborPaddedUploadFloats ?? 0,
          liveGpuNeighborSlotWriteCount: s.liveGpuNeighborSlotWriteCount ?? 0,
          liveGpuNeighborTopologyRangeStart: s.liveGpuNeighborTopologyRangeStart ?? 0,
          liveGpuNeighborTopologyRangeCount: s.liveGpuNeighborTopologyRangeCount ?? 0,
          liveGpuCollisionActive: (liveCollisionStats?.fragmentTexels ?? 0) > 0,
          liveGpuCollisionBroadphase: liveCollisionStats?.broadphase ?? 'none',
          liveGpuCollisionBroadphaseOwner: liveCollisionStats?.broadphaseOwner ?? 'none',
          liveGpuCollisionSpatiallyComplete: liveCollisionStats?.spatiallyComplete ?? false,
          liveGpuCollisionIterations: liveCollisionStats?.iterations ?? 0,
          liveGpuCollisionNeighborSamples: liveCollisionStats?.neighborSamples ?? 0,
          liveGpuCollisionFragmentTexels: liveCollisionStats?.fragmentTexels ?? 0,
          liveGpuCollisionNeighborSlotWrites: liveCollisionNeighborStats?.slotWrites ?? 0,
          liveGpuCollisionNeighborStagingClearFloats: liveCollisionNeighborStats?.stagingClearFloats ?? 0,
          liveGpuCollisionNeighborStagingWriteFloats: liveCollisionNeighborStats?.stagingWriteFloats ?? 0,
          liveGpuCollisionNeighborCandidatePairs: liveCollisionNeighborStats?.candidatePairs ?? 0,
          liveGpuCollisionNeighborOverflowCount: liveCollisionNeighborStats?.overflowCount ?? 0,
          liveGpuCollisionNeighborUploadFloats: s.gpuConstraintCollisionNeighborUploadFloats ?? 0,
          liveGpuCollisionNeighborDirectUploadFloats: s.gpuConstraintCollisionNeighborDirectUploadFloats ?? 0,
          liveGpuCollisionNeighborPaddedUploadFloats: s.gpuConstraintCollisionNeighborPaddedUploadFloats ?? 0,
          liveGpuCollisionNeighborActiveRows: s.gpuConstraintCollisionNeighborActiveRows ?? 0,
          liveGpuCollisionNeighborUploadedRows: s.gpuConstraintCollisionNeighborUploadedRows ?? 0,
          liveGpuCollisionNeighborReservedRows: s.gpuConstraintCollisionNeighborReservedRows ?? 0,
          liveGpuCollisionNeighborUploadSkipped: s.gpuConstraintCollisionNeighborUploadSkipped === true,
          liveGpuCollisionNeighborUploadSource: s.gpuConstraintCollisionNeighborUploadSource ?? 'none',
          liveGpuCollisionLiveSource: s.gpuConstraintCollisionSource ?? 'cpu-spatial-neighbor-slots',
          liveGpuCollisionLiveBroadphaseAuthoritativeReady: s.gpuConstraintCollisionLiveBroadphaseAuthoritativeReady === true,
          liveGpuGridKeyActive: (liveGridKeyStats?.fragmentTexels ?? 0) > 0,
          liveGpuGridKeyParticleCount: liveGridKeyStats?.activeParticleCount ?? 0,
          liveGpuGridKeyRows: liveGridKeyStats?.activeRows ?? 0,
          liveGpuGridKeyFragmentTexels: liveGridKeyStats?.fragmentTexels ?? 0,
          liveGpuGridKeyColumns: liveGridKeyStats?.gridColumns ?? 0,
          liveGpuGridKeyCellRows: liveGridKeyStats?.gridRows ?? 0,
          liveGpuGridKeyCellSize: liveGridKeyStats?.cellSize ?? 0,
          liveGpuGridKeyBroadphaseOwner: liveGridKeyStats?.broadphaseOwner ?? 'gpu',
          liveGpuGridKeyProducesCandidateSlots: liveGridKeyStats?.producesCandidateSlots ?? false,
          liveGpuCandidateTelemetrySampled: s.gpuConstraintCandidateTelemetrySampled === true,
          liveGpuCandidateTelemetryFrame: s.gpuConstraintCandidateTelemetryFrame ?? 0,
          liveGpuCandidateTelemetryStaleSeconds: Math.round((s.gpuConstraintCandidateTelemetryStaleSeconds ?? 0) * 1000) / 1000,
          liveGpuCandidateStateOrder: 'cpu-sorted-cell-range-bridge',
          liveGpuSortedCandidateUploadFloats: s.gpuConstraintSortedCandidateUploadFloats ?? 0,
          liveGpuSortedCandidateUploadMode: s.gpuConstraintSortedCandidateUploadMode ?? 'none',
          liveGpuSortedCandidateActiveRows: s.gpuConstraintSortedCandidateState?.width
            ? Math.ceil((s.gpuConstraintParticleCount ?? stats.count) / s.gpuConstraintSortedCandidateState.width)
            : 0,
          liveGpuSortedCandidateUploadedRows: s.gpuConstraintSortedCandidateState?.width
            ? Math.ceil((s.gpuConstraintParticleCount ?? stats.count) / s.gpuConstraintSortedCandidateState.width)
            : 0,
          liveGpuSortedCandidateReservedRows: s.gpuConstraintSortedCandidateState?.height ?? 0,
          liveGpuSortedCandidateActiveCapacityRatio: (s.gpuConstraintSortedCandidateState?.capacity ?? 0) > 0
            ? Math.round(
                ((s.gpuConstraintParticleCount ?? stats.count) /
                  Math.max(1, s.gpuConstraintSortedCandidateState?.capacity ?? 1)) *
                  10000,
              ) / 10000
            : 0,
          liveGpuSortedCandidateCellRangeUploadFloats: s.gpuConstraintSortedCandidateCellRangeUploadFloats ?? 0,
          liveGpuSortedCandidateCellRangeSource: s.gpuConstraintSortedCandidateCellRangeSource ?? 'none',
          liveGpuSortedCandidateCellRangeBridgeActiveRows: liveCellRangeBridgeStats?.activeRows ?? 0,
          liveGpuSortedCandidateCellRangeBridgeUploadedRows: liveCellRangeBridgeStats?.uploadedRows ?? 0,
          liveGpuSortedCandidateCellRangeBridgeReservedRows: liveCellRangeBridgeStats?.reservedRows ?? 0,
          liveGpuSortedCandidateCellRangeBridgeUploadRowStart: liveCellRangeBridgeStats?.uploadRowStart ?? 0,
          liveGpuSortedCandidateCellRangeBridgeActiveCellStart: liveCellRangeBridgeStats?.activeCellStart ?? 0,
          liveGpuSortedCandidateCellRangeBridgeActiveCellCount: liveCellRangeBridgeStats?.activeCellCount ?? 0,
          liveGpuSortedCandidateOccupancyActive: liveOccupancyStats?.gpuOwnedOccupancy ?? false,
          liveGpuSortedCandidateOccupancyPointDraws: liveOccupancyStats?.pointDraws ?? 0,
          liveGpuSortedCandidateOccupancyFragmentCells: liveOccupancyStats?.fragmentCells ?? 0,
          liveGpuSortedCandidateOccupancyColumns: liveOccupancyStats?.gridColumns ?? 0,
          liveGpuSortedCandidateOccupancyRows: liveOccupancyStats?.gridRows ?? 0,
          liveGpuSortedCandidateOccupancyAdditiveBlend: liveOccupancyStats?.additiveBlend ?? false,
          liveGpuSortedCandidateOccupancyProducesCellRanges: liveOccupancyStats?.producesCellRanges ?? false,
          liveGpuSortedCandidateOccupancyAuthoritativeReady: liveOccupancyStats?.suitableForAuthoritativeBroadphase ?? false,
          liveGpuSortedCandidateOccupancyRequiredReplacement: liveOccupancyStats?.requiredReplacement ?? 'gpu-prefix-sum-or-sort-scatter',
          liveGpuSortedCandidateCellOffsetActive: liveCellOffsetStats?.gpuOwnedCellOffsets ?? false,
          liveGpuSortedCandidateCellOffsetPrefixPasses: liveCellOffsetStats?.prefixPasses ?? 0,
          liveGpuSortedCandidateCellOffsetFragmentTexels: liveCellOffsetStats?.fragmentTexels ?? 0,
          liveGpuSortedCandidateCellOffsetCells: liveCellOffsetStats?.cellCount ?? 0,
          liveGpuSortedCandidateCellOffsetScatterReady: liveCellOffsetStats?.suitableForScatterOffsets ?? false,
          liveGpuSortedCandidateCellOffsetRequiredNextStep: liveCellOffsetStats?.requiredNextStep ?? 'particle-cell-scatter',
          liveGpuSortedCandidateCellRangeGpuOwned: liveCellRangeStats?.gpuOwnedCellRanges ?? false,
          liveGpuSortedCandidateCellRangeFragmentTexels: liveCellRangeStats?.fragmentTexels ?? 0,
          liveGpuSortedCandidateCellRangeSortedStateRequired: liveCellRangeStats?.sortedStateRequired ?? true,
          liveGpuSortedCandidateCellRangeResidentLists: liveCellRangeStats?.producesResidentLists ?? false,
          liveGpuSortedCandidateCellRangeRequiredNextStep: liveCellRangeStats?.requiredNextStep ?? 'particle-cell-scatter',
          liveGpuSortedCandidateCellKeyActive: liveCellKeyStats?.gpuOwnedCellKeys ?? false,
          liveGpuSortedCandidateCellKeyFragmentTexels: liveCellKeyStats?.fragmentTexels ?? 0,
          liveGpuSortedCandidateCellKeyParticles: liveCellKeyStats?.activeParticleCount ?? 0,
          liveGpuSortedCandidateCellKeySuitableForSort: liveCellKeyStats?.suitableForGpuSort ?? false,
          liveGpuSortedCandidateKeySortActive: liveKeySortStats?.gpuSorted ?? false,
          liveGpuSortedCandidateKeySortAlgorithm: liveKeySortStats?.sortAlgorithm ?? 'bitonic-texture',
          liveGpuSortedCandidateKeySortCapacity: liveKeySortStats?.sortCapacity ?? 0,
          liveGpuSortedCandidateKeySortPasses: liveKeySortStats?.passCount ?? 0,
          liveGpuSortedCandidateKeySortFragmentTexels: liveKeySortStats?.fragmentTexels ?? 0,
          liveGpuSortedCandidateKeySortRangeReady: liveKeySortStats?.suitableForCellRangeDerivation ?? false,
          liveGpuSortedCandidateSortedKeyRangeActive: liveSortedKeyRangeStats?.gpuDerivedCellRanges ?? false,
          liveGpuSortedCandidateSortedKeyRangeFragmentTexels: liveSortedKeyRangeStats?.fragmentTexels ?? 0,
          liveGpuSortedCandidateSortedKeyRangeBinarySearchSteps: liveSortedKeyRangeStats?.binarySearchSteps ?? 0,
          liveGpuSortedCandidateSortedKeyRangeCells: liveSortedKeyRangeStats?.cellCount ?? 0,
          liveGpuSortedCandidateSortedKeyRangeSuitableForCandidateBridge: liveSortedKeyRangeStats?.suitableForSortedCandidateBridge ?? false,
          liveGpuSortedCandidateSortedKeyRangeRequiredNextStep: liveSortedKeyRangeStats?.requiredNextStep ?? 'sorted-state-gather-or-scatter',
          liveGpuSortedCandidateResidentListActive: liveResidentListStats?.gpuDerivedResidentLists ?? false,
          liveGpuSortedCandidateResidentListWidth: liveResidentListStats?.width ?? 0,
          liveGpuSortedCandidateResidentListHeight: liveResidentListStats?.height ?? 0,
          liveGpuSortedCandidateResidentListFragmentTexels: liveResidentListStats?.fragmentTexels ?? 0,
          liveGpuSortedCandidateResidentListBinarySearchSteps: liveResidentListStats?.binarySearchSteps ?? 0,
          liveGpuSortedCandidateResidentListLimit: liveResidentListStats?.residentLimit ?? 0,
          liveGpuSortedCandidateResidentListMaxCellOccupancy: liveResidentListStats?.maxCellOccupancy ?? 0,
          liveGpuSortedCandidateResidentListSpatiallyComplete: liveResidentListStats?.residentListsSpatiallyComplete ?? false,
          liveGpuSortedCandidateResidentListCandidateReady: liveResidentListStats?.suitableForCandidateGeneration ?? false,
          liveGpuSortedCandidateResidentListAuthoritativeReady: liveResidentListStats?.suitableForAuthoritativeUnsortedBroadphase ?? false,
          liveGpuSortedCandidateResidentListRequiredNextStep: liveResidentListStats?.requiredNextStep ?? 'resident-list-candidate-generation',
          liveGpuResidentListCandidateActive: (liveResidentListCandidateStats?.fragmentTexels ?? 0) > 0,
          liveGpuResidentListCandidateSlotCount: liveResidentListCandidateStats?.slotCount ?? 0,
          liveGpuResidentListCandidateSamples: liveResidentListCandidateStats?.candidateSamples ?? 0,
          liveGpuResidentListCandidateFragmentTexels: liveResidentListCandidateStats?.fragmentTexels ?? 0,
          liveGpuResidentListCandidateBroadphase: liveResidentListCandidateStats?.broadphase ?? 'gpu-resident-list',
          liveGpuResidentListCandidateBroadphaseOwner: liveResidentListCandidateStats?.broadphaseOwner ?? 'gpu',
          liveGpuResidentListCandidateSpatiallyComplete: liveResidentListCandidateStats?.spatiallyComplete ?? false,
          liveGpuResidentListCandidateSuitableForAuthoritativeCollision: liveResidentListCandidateStats?.suitableForAuthoritativeCollision ?? false,
          liveGpuResidentListCandidateCoverage: liveResidentListCandidateStats?.coverage ?? 'gpu-resident-list-world-cells',
          liveGpuResidentListCandidateLimitation: liveResidentListCandidateStats?.limitation ?? 'resident-list-limit-must-cover-max-cell-occupancy',
          liveGpuResidentListCandidateRequiredReplacement: liveResidentListCandidateStats?.requiredReplacement ?? 'none-when-resident-list-spatially-complete',
          liveGpuResidentListCandidateIndexOrder: liveResidentListCandidateStats?.indexOrder ?? 'original-index',
          liveGpuResidentListCandidateResidentLimit: liveResidentListCandidateStats?.residentLimit ?? 0,
          liveGpuResidentListCandidateMaxCellOccupancy: liveResidentListCandidateStats?.maxCellOccupancy ?? 0,
          liveGpuResidentListCandidateCollisionBatchedConsumableSlotCount: liveResidentListCandidateStats?.collisionBatchedConsumableSlotCount ?? 0,
          liveGpuResidentListCandidateCollisionRequiredBatches: liveResidentListCandidateStats?.collisionRequiredBatches ?? 0,
          liveGpuSortedCandidateSortedKeyGatherActive: liveSortedKeyGatherStats?.gpuGatheredSortedState ?? false,
          liveGpuSortedCandidateSortedKeyGatherFragmentTexels: liveSortedKeyGatherStats?.fragmentTexels ?? 0,
          liveGpuSortedCandidateSortedKeyGatherAttributeFragmentTexels: liveSortedKeyGatherStats?.attributeFragmentTexels ?? 0,
          liveGpuSortedCandidateSortedKeyGatherAttributesActive: liveSortedKeyGatherStats?.gpuGatheredSortedAttributes ?? false,
          liveGpuSortedCandidateSortedKeyGatherRows: liveSortedKeyGatherStats?.activeRows ?? 0,
          liveGpuSortedCandidateSortedKeyGatherOutputOrder: liveSortedKeyGatherStats?.outputOrder ?? 'sorted-cell-key',
          liveGpuSortedCandidateIndexMapUploadFloats: s.gpuConstraintSortedCandidateIndexMapUploadFloats ?? 0,
          liveGpuSortedCandidateIndexMapSource: s.gpuConstraintSortedCandidateIndexMapSource ?? 'none',
          liveGpuSortedCandidateIndexMapActiveRows: liveIndexMapStats?.activeRows ?? 0,
          liveGpuSortedCandidateIndexMapUploadedRows: liveIndexMapStats?.uploadedRows ?? 0,
          liveGpuSortedCandidateIndexMapReservedRows: liveIndexMapStats?.reservedRows ?? 0,
          liveGpuSortedCandidateBodyMetadataUploadFloats: s.gpuConstraintSortedCandidateBodyMetadataUploadFloats ?? 0,
          liveGpuSortedCandidateBodyMetadataCount: s.gpuConstraintSortedCandidateBodyMetadataCount ?? 0,
          liveGpuSortedCandidateIndexMapGatherReady: s.gpuConstraintSortedCandidateIndexMapGather != null,
          liveGpuSortedCandidateIndexMapGatherActive: s.gpuConstraintSortedCandidateIndexMapGatherActive === true,
          liveGpuSortedCandidateIndexMapGatherFragmentTexels: s.gpuConstraintSortedCandidateIndexMapGatherFragmentTexels ?? 0,
          liveGpuSortedCandidateIndexMapGatherRows: liveIndexMapGatherStats?.activeRows ?? 0,
          liveGpuSortedCandidateIndexMapGatherSourceOrder: liveIndexMapGatherStats?.sourceOrder ?? 'sorted-cell-key',
          liveGpuSortedCandidateIndexMapGatherDestinationOrder: liveIndexMapGatherStats?.destinationOrder ?? 'original-index',
          liveGpuSortedCandidateIndexMapGatherPreservesPositionVelocity: liveIndexMapGatherStats?.gathersPositionVelocity ?? false,
          liveGpuSortedCandidateIndexMapGatherPreservesAttributes: liveIndexMapGatherStats?.gathersAttributes ?? false,
          liveGpuSortedCandidateGatherBackComplete,
          liveGpuSortedCandidateAuthoritativeReady,
          liveGpuSortedCandidateAuthoritativeBlocker,
          liveGpuSortedCandidateMaxCellOccupancy: s.gpuConstraintSortedCandidateMaxCellOccupancy ?? 0,
          liveGpuSortedCandidateCellSize: s.gpuConstraintSortedCandidateCellSize ?? 0,
          liveGpuSortedCandidateCellColumns: s.gpuConstraintSortedCandidateCellColumns ?? 0,
          liveGpuSortedCandidateCellRows: s.gpuConstraintSortedCandidateCellRows ?? 0,
          liveGpuSortedCandidateCollisionStressActive: s.gpuConstraintSortedCandidateCollisionStressActive === true,
          liveGpuSortedCandidateCollisionBatches: s.gpuConstraintSortedCandidateCollisionBatches ?? 0,
          liveGpuSortedCandidateCollisionFragmentTexels: s.gpuConstraintSortedCandidateCollisionFragmentTexels ?? 0,
          liveGpuSortedCandidateCollisionConsumedSlots: s.gpuConstraintSortedCandidateCollisionConsumedSlots ?? 0,
          liveGpuSortedCandidateCollisionIgnoredSlots: s.gpuConstraintSortedCandidateCollisionIgnoredSlots ?? 0,
          liveGpuSortedCandidateCollisionAllSlotsConsumed,
          liveGpuSortedCandidateCollisionSpatiallyComplete: s.gpuConstraintSortedCandidateCollisionSpatiallyComplete === true,
          liveGpuSortedCandidatePressureStressActive: s.gpuConstraintSortedCandidatePressureStressActive === true,
          liveGpuSortedCandidatePressureBatches: s.gpuConstraintSortedCandidatePressureBatches ?? 0,
          liveGpuSortedCandidatePressureFragmentTexels: s.gpuConstraintSortedCandidatePressureFragmentTexels ?? 0,
          liveGpuSortedCandidatePressureConsumedSlots: s.gpuConstraintSortedCandidatePressureConsumedSlots ?? 0,
          liveGpuSortedCandidatePressureIgnoredSlots: s.gpuConstraintSortedCandidatePressureIgnoredSlots ?? 0,
          liveGpuSortedCandidatePressureAllSlotsConsumed: (s.gpuConstraintSortedCandidatePressureStressActive === true) && (s.gpuConstraintSortedCandidatePressureIgnoredSlots ?? 0) === 0,
          liveGpuSortedCandidateBodyShapeStressActive: s.gpuConstraintSortedCandidateBodyShapeStressActive === true,
          liveGpuSortedCandidateBodyShapeFragmentTexels: s.gpuConstraintSortedCandidateBodyShapeFragmentTexels ?? 0,
          liveGpuCandidateSlotsActive: (liveCandidateStats?.fragmentTexels ?? 0) > 0,
          liveGpuCandidateSlotCount: liveCandidateStats?.slotCount ?? 0,
          liveGpuCandidateSamples: liveCandidateStats?.candidateSamples ?? 0,
          liveGpuCandidateFragmentTexels: liveCandidateStats?.fragmentTexels ?? 0,
          liveGpuCandidateBroadphase: liveCandidateStats?.broadphase ?? 'gpu-sorted-cell-ranges',
          liveGpuCandidateBroadphaseOwner: liveCandidateStats?.broadphaseOwner ?? 'hybrid',
          liveGpuCandidateSpatiallyComplete: liveCandidateStats?.spatiallyComplete ?? false,
          liveGpuCandidateProducesCandidateSlots: liveCandidateStats?.producesCandidateSlots ?? false,
          liveGpuCandidateCoverage: liveCandidateStats?.coverage ?? 'bounded-world-cell-residents',
          liveGpuCandidateLimitation: liveCandidateStats?.limitation ?? 'requires-sorted-particle-state-and-cell-ranges',
          liveGpuCandidateRequiredReplacement: liveCandidateStats?.requiredReplacement ?? 'gpu-owned-sort-or-cell-scatter',
          liveGpuCandidateSuitableForAuthoritativeCollision: liveCandidateStats?.suitableForAuthoritativeCollision ?? false,
          liveGpuCandidateCapacity,
          liveGpuCandidateVsCpuSlotCapacityRatio,
          liveGpuCandidateVsCpuPairCapacityRatio,
          liveGpuCandidateFragmentToCpuUploadRatio,
          liveGpuCandidateCoverageStatus: liveCandidateStats?.spatiallyComplete === true
            ? 'spatially-complete'
            : liveGpuCandidateCapacity >= liveCpuSpatialSlotWrites && liveCpuSpatialSlotWrites > 0
              ? 'capacity-ok-but-windowed-not-authoritative'
              : 'insufficient-or-windowed-not-authoritative',
          liveGpuCollisionStatus: s.gpuConstraintCollisionSource === 'gpu-resident-list'
            ? 'gpu-resident-list-live-render-collision'
            : liveCollisionStats?.broadphase === 'cpu-spatial-neighbor-slots'
              ? 'cpu-spatial-neighbor-slots-render-bridge-not-authoritative'
              : 'inactive-or-texture-layout-preview-state',
          liveGpuCapacity: s.gpuConstraintState?.capacity ?? 0,
          liveGpuCapacityHeadroom: Math.max(0, (s.gpuConstraintState?.capacity ?? 0) - stats.count),
          groupedParticleGroups: s.groupedParticleScratch?.size ?? 0,
          drawBufferCapacityFloats: s.drawBufferCapacity ?? 0,
          densityCenterCapacity: s.densityCenterCapacity ?? 0,
          centerUploadCapacityFloats: s.centerUploadData?.length ?? 0,
          closedFillCapacityFloats: s.closedFillScratch?.length ?? 0,
          closedFeatherCapacityFloats: s.closedFeatherScratch?.length ?? 0,
          tubeGeometryCapacityFloats: s.tubeGeometryScratch?.length ?? 0,
          diskGeometryCapacityFloats: s.diskGeometryScratch?.length ?? 0,
          smoothOpenPointCapacity: s.smoothOpenPointScratch?.length ?? 0,
          smoothOpenGeometryCapacityFloats: s.smoothOpenGeometryScratch?.length ?? 0,
          closedTubeGeometryCapacityFloats: s.closedTubeGeometryScratch?.length ?? 0,
          fanGeometryCapacityFloats: s.fanGeometryScratch?.length ?? 0,
          hostSkippedRenderFrames: s.skippedRenderFrames,
          hostPendingRenderDeltaSeconds: Math.round(s.pendingRenderDeltaSeconds * 1000) / 1000,
          needsRedraw: s.needsRedraw === true,
          sleepRenderGateEligible: s.needsRedraw !== true && s.pointerDown !== true && s.drawing !== true && stats.awake === false,
        });
      },
      onDestroy: (state) => {
        const s = state as ConstraintRawState;
        s.cleanupPointer?.();
        if (s.densityTexture) s.gl.deleteTexture(s.densityTexture);
        if (s.densityFramebuffer) s.gl.deleteFramebuffer(s.densityFramebuffer);
        if (s.densityCenterBuffer) s.gl.deleteBuffer(s.densityCenterBuffer);
        if (s.liquidSurface) destroyRawLiquidSurfaceRenderer(s, s.liquidSurface);
        if (s.liquidParticleBuffer) s.gl.deleteBuffer(s.liquidParticleBuffer);
        if (s.densityQuadBuffer) s.gl.deleteBuffer(s.densityQuadBuffer);
        if (s.drawBuffer) s.gl.deleteBuffer(s.drawBuffer);
        if (s.centerBuffer) s.gl.deleteBuffer(s.centerBuffer);
        if (s.quadBuffer) s.gl.deleteBuffer(s.quadBuffer);
        if (s.densityVao) s.gl.deleteVertexArray(s.densityVao);
        if (s.drawVao) s.gl.deleteVertexArray(s.drawVao);
        if (s.vao) s.gl.deleteVertexArray(s.vao);
        if (s.densityCompositeProgram) s.gl.deleteProgram(s.densityCompositeProgram);
        if (s.densityProgram) s.gl.deleteProgram(s.densityProgram);
        if (s.drawProgram) s.gl.deleteProgram(s.drawProgram);
        if (s.program) s.gl.deleteProgram(s.program);
        s.gpuConstraintDensityRenderer?.destroy();
        destroyGpuConstraintSortedCandidateState(s);
        s.gpuConstraintCandidateNeighbors?.destroy();
        s.gpuConstraintCollisionNeighbors?.destroy();
        s.gpuConstraintNeighbors?.destroy();
        s.gpuConstraintCandidateSlots?.destroy();
        s.gpuConstraintGridKey?.destroy();
        s.gpuConstraintCollision?.destroy();
        s.gpuConstraintJacobi?.destroy();
        s.gpuConstraintStep?.destroy();
        s.gpuConstraintState?.destroy();
      },
    });
    this.qualityState = qualityState;
  }

  setQuality(quality: RenderQuality): void {
    this.qualityState.value = quality;
  }
}
