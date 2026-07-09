import {
  AdvancedCollisionStressEngine,
  RawGpuConstraintParticleCellRangeBridge,
  RawGpuConstraintParticleCellOffsetPass,
  RawGpuConstraintParticleCellOccupancyPass,
  RawGpuConstraintParticleCellRangeFromOffsetsPass,
  RawGpuConstraintParticleCellKeyPass,
  RawGpuConstraintParticleCandidateSlotPass,
  RawGpuConstraintParticleCircleCollisionPass,
  RawGpuConstraintParticleGridKeyPass,
  RawGpuConstraintParticleIndexMapBridge,
  RawGpuConstraintParticleIndexMapGatherPass,
  RawGpuConstraintParticleNeighborSlots,
  RawGpuConstraintParticlePointRenderer,
  RawGpuConstraintParticleResidentListCandidatePass,
  RawGpuConstraintParticleResidentListFromSortedKeysPass,
  RawGpuConstraintParticleSortedCellCandidatePass,
  RawGpuConstraintParticleSortedKeyGatherPass,
  RawGpuConstraintParticleSortedKeyRangePass,
  RawGpuConstraintParticleState,
  RawGpuConstraintParticleStepPass,
  RawGpuKeyIndexSortPass,
  RawWebGL2Scene,
  rawGpuMetricsToDebugStats,
  resolveAdvancedPhysicsFidelityProfile,
  type AdvancedCollisionStressSettings,
  type AdvancedCollisionStressSpatialNeighborSlotStats,
  type AdvancedCollisionStressStats,
  type RawGpuConstraintParticleCandidateSlotStats,
  type RawGpuConstraintParticleCellOffsetStats,
  type RawGpuConstraintParticleCellOccupancyStats,
  type RawGpuConstraintParticleCellRangeFromOffsetsStats,
  type RawGpuConstraintParticleCellKeyStats,
  type RawGpuConstraintParticleGridKeyStats,
  type RawGpuKeyIndexSortStats,
  type RawGpuConstraintParticleSortedKeyGatherStats,
  type RawGpuConstraintParticleSortedKeyRangeStats,
  type RawGpuConstraintParticleResidentListCandidateStats,
  type RawGpuConstraintParticleResidentListFromSortedKeysStats,
  type RawGpuConstraintParticleSortedCellCandidateStats,
  type RawWebGL2RenderState,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

type BallPitInputMode = 'single' | 'stream' | 'interact' | 'explosion';
type BallPitGpuCandidateStats = RawGpuConstraintParticleCandidateSlotStats | RawGpuConstraintParticleSortedCellCandidateStats;
type BallPitGpuCollisionSource = 'cpu-spatial-neighbor-slots' | 'gpu-resident-list';

function isSortedCellCandidateStats(stats: BallPitGpuCandidateStats | undefined): stats is RawGpuConstraintParticleSortedCellCandidateStats {
  return stats?.broadphase === 'gpu-sorted-cell-ranges';
}

function resetLiveGpuStepStats(state: BallPitRawState): void {
  state.gpuLiveStepActive = false;
  state.gpuLiveStepSource = 'none';
  state.gpuLiveStepParticleCount = 0;
  state.gpuLiveStepActiveRows = 0;
  state.gpuLiveStepFragmentTexels = 0;
  state.gpuLiveStepDt = 0;
}

function resetLiveGpuDynamicUploadSkipStats(state: BallPitRawState): void {
  state.gpuLiveDynamicUploadSkipped = false;
  state.gpuLiveDynamicUploadSkipBlocker = 'none';
}

interface BallPitRawState extends RawWebGL2RenderState {
  engine?: AdvancedCollisionStressEngine;
  gpuPreviewState?: RawGpuConstraintParticleState;
  gpuPreviewStep?: RawGpuConstraintParticleStepPass;
  gpuPreviewCollision?: RawGpuConstraintParticleCircleCollisionPass;
  gpuPreviewCandidateSlots?: RawGpuConstraintParticleCandidateSlotPass;
  gpuPreviewGridKey?: RawGpuConstraintParticleGridKeyPass;
  gpuPreviewCollisionNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuPreviewCandidateNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuPreviewRenderer?: RawGpuConstraintParticlePointRenderer;
  gpuLiveSortedCandidateState?: RawGpuConstraintParticleState;
  gpuLiveSortedCandidateCellOffsets?: RawGpuConstraintParticleCellOffsetPass;
  gpuLiveSortedCandidateOccupancy?: RawGpuConstraintParticleCellOccupancyPass;
  gpuLiveSortedCandidateCellRanges?: RawGpuConstraintParticleCellRangeFromOffsetsPass;
  gpuLiveSortedCandidateCellKeys?: RawGpuConstraintParticleCellKeyPass;
  gpuLiveSortedCandidateKeySort?: RawGpuKeyIndexSortPass;
  gpuLiveSortedCandidateSortedKeyGather?: RawGpuConstraintParticleSortedKeyGatherPass;
  gpuLiveSortedCandidateSortedKeyRanges?: RawGpuConstraintParticleSortedKeyRangePass;
  gpuLiveSortedCandidateResidentList?: RawGpuConstraintParticleResidentListFromSortedKeysPass;
  gpuLiveResidentListCandidateSlots?: RawGpuConstraintParticleResidentListCandidatePass;
  gpuLiveSortedCandidateGridKey?: RawGpuConstraintParticleGridKeyPass;
  gpuLiveSortedCandidateSlots?: RawGpuConstraintParticleCandidateSlotPass;
  gpuLiveSortedCellCandidateSlots?: RawGpuConstraintParticleSortedCellCandidatePass;
  gpuLiveResidentListCandidateNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuLiveSortedCandidateNeighbors?: RawGpuConstraintParticleNeighborSlots;
  gpuLiveSortedCandidateCellRangeBridge?: RawGpuConstraintParticleCellRangeBridge;
  gpuLiveSortedCandidateIndexMapBridge?: RawGpuConstraintParticleIndexMapBridge;
  gpuLiveSortedCandidateIndexMapGather?: RawGpuConstraintParticleIndexMapGatherPass;
  gpuLiveSortedCandidateIndexMapGatherState?: RawGpuConstraintParticleState;
  gpuLiveSortedCandidatePositions?: Float32Array;
  gpuLiveSortedCandidateKeys?: Float64Array;
  gpuPreviewPositions?: Float32Array;
  gpuPreviewVelocities?: Float32Array;
  gpuPreviewAttributes?: Float32Array;
  gpuPreviewCollisionNeighborData?: Float32Array[];
  inputMode?: BallPitInputMode;
  activeQuality?: RenderQuality;
  pointerDown?: boolean;
  previewDemo?: boolean;
  demoFloorDropped?: boolean;
  pointerX?: number;
  pointerY?: number;
  previousPointerX?: number;
  previousPointerY?: number;
  grabbedIndex?: number;
  pickedBallIndices?: number[];
  shockwaves?: Array<{ x: number; y: number; age: number }>;
  particleData?: Float32Array;
  particleStyleData?: Float32Array;
  shapeData?: Float32Array;
  paletteData?: Float32Array;
  shapeProgram?: WebGLProgram;
  particleVao?: WebGLVertexArrayObject | null;
  shapeVao?: WebGLVertexArrayObject | null;
  quadBuffer?: WebGLBuffer;
  particleBuffer?: WebGLBuffer;
  particleStyleBuffer?: WebGLBuffer;
  shapeBuffer?: WebGLBuffer;
  uResolution?: WebGLUniformLocation | null;
  uPalette?: WebGLUniformLocation | null;
  uPaletteCount?: WebGLUniformLocation | null;
  stats?: AdvancedCollisionStressStats;
  particleStyleUploadedCount?: number;
  particleStyleUploadStart?: number;
  particleStyleUploadFloats?: number;
  particleStyleRadiusKey?: number;
  particlePositionUploadFloats?: number;
  gpuLiveRendered?: boolean;
  gpuLiveRenderSource?: 'cpu-live-texture-bridge' | 'sorted-candidate-gathered-state';
  gpuLiveCollisionSource?: BallPitGpuCollisionSource;
  gpuLiveCollisionAuthoritativeReady?: boolean;
  gpuLiveSortedCandidateFeedbackRenderEligible?: boolean;
  gpuLiveSortedCandidateFeedbackRenderActive?: boolean;
  gpuLiveSortedCandidateFeedbackRenderBlocker?:
    | 'none'
    | 'not-rendered'
    | 'sorted-state-still-cpu-uploaded'
    | 'original-order-gather-not-complete'
    | 'candidate-slots-not-fully-consumed'
    | 'gpu-broadphase-not-spatially-complete'
    | 'gather-state-missing';
  gpuLiveParticleCount?: number;
  gpuLiveUploadedParticleCount?: number;
  gpuLiveCapacity?: number;
  gpuLiveStaticDirty?: boolean;
  gpuLiveDynamicUploadFloats?: number;
  gpuLiveDynamicUploadSkipped?: boolean;
  gpuLiveDynamicUploadSkipBlocker?:
    | 'none'
    | 'particle-count-changed'
    | 'static-state-dirty'
    | 'pointer-active'
    | 'gpu-state-not-seeded';
  gpuLiveStaticUploadFloats?: number;
  gpuLiveStaticUploadMode?: 'none' | 'full' | 'append-range' | 'shrink-range';
  gpuLiveStaticAttributeWriteCount?: number;
  gpuLiveStepActive?: boolean;
  gpuLiveStepSource?: 'none' | 'cpu-seeded-gpu-step-probe' | 'persistent-gpu-step-probe';
  gpuLiveStepParticleCount?: number;
  gpuLiveStepActiveRows?: number;
  gpuLiveStepFragmentTexels?: number;
  gpuLiveStepDt?: number;
  gpuLiveSpatialNeighborStats?: AdvancedCollisionStressSpatialNeighborSlotStats;
  gpuLiveGridKeyStats?: RawGpuConstraintParticleGridKeyStats;
  gpuLiveCandidateSlotStats?: BallPitGpuCandidateStats;
  gpuLiveSortedCandidateParticleCount?: number;
  gpuLiveSortedCandidateCapacity?: number;
  gpuLiveSortedCandidateUploadFloats?: number;
  gpuLiveSortedCandidateUploadMode?: 'none' | 'cpu-sorted-copy' | 'gpu-sorted-key-gather';
  gpuLiveSortedCandidateSource?: 'none' | 'cpu-live-snapshot' | 'persistent-gpu-live-state';
  gpuLiveSortedCandidateRefreshReason?: 'none' | 'initial' | 'particle-count-changed' | 'stale-telemetry' | 'persistent-gpu-frame';
  gpuLiveSortedCandidateDirectUploadFloats?: number;
  gpuLiveSortedCandidatePaddedUploadFloats?: number;
  gpuLiveSortedCandidateCellSize?: number;
  gpuLiveSortedCandidateCellColumns?: number;
  gpuLiveSortedCandidateCellRows?: number;
  gpuLiveSortedCandidateCellRangeWidth?: number;
  gpuLiveSortedCandidateCellRangeHeight?: number;
  gpuLiveSortedCandidateCellRangeUploadFloats?: number;
  gpuLiveSortedCandidateCellRangeSource?: 'none' | 'gpu-sorted-key-range' | 'gpu-occupancy-offset-range' | 'cpu-cell-range-bridge';
  gpuLiveSortedCandidateOccupancyStats?: RawGpuConstraintParticleCellOccupancyStats;
  gpuLiveSortedCandidateCellOffsetStats?: RawGpuConstraintParticleCellOffsetStats;
  gpuLiveSortedCandidateCellRangeStats?: RawGpuConstraintParticleCellRangeFromOffsetsStats;
  gpuLiveSortedCandidateCellKeyStats?: RawGpuConstraintParticleCellKeyStats;
  gpuLiveSortedCandidateKeySortStats?: RawGpuKeyIndexSortStats;
  gpuLiveSortedCandidateSortedKeyGatherStats?: RawGpuConstraintParticleSortedKeyGatherStats;
  gpuLiveSortedCandidateSortedKeyRangeStats?: RawGpuConstraintParticleSortedKeyRangeStats;
  gpuLiveSortedCandidateResidentListStats?: RawGpuConstraintParticleResidentListFromSortedKeysStats;
  gpuLiveResidentListCandidateStats?: RawGpuConstraintParticleResidentListCandidateStats;
  gpuLiveSortedCandidateIndexMapUploadFloats?: number;
  gpuLiveSortedCandidateIndexMapSource?: 'none' | 'cpu-index-map-bridge' | 'skipped-non-gpu-sorted-state';
  gpuLiveSortedCandidateIndexMapGatherFragmentTexels?: number;
  gpuLiveSortedCandidateIndexMapGatherActive?: boolean;
  gpuLiveSortedCandidateMaxCellOccupancy?: number;
  gpuLiveSortedCandidateResidentScanLimit?: number;
  gpuLiveSortedCandidateCollisionBatches?: number;
  gpuLiveSortedCandidateCollisionFragmentTexels?: number;
  gpuLiveSortedCandidateCollisionConsumedSlots?: number;
  gpuLiveSortedCandidateCollisionIgnoredSlots?: number;
  gpuLiveSortedCandidateCollisionSpatiallyComplete?: boolean;
  gpuLiveSortedCandidateCollisionStressActive?: boolean;
  gpuLiveSortedCandidateTelemetryLastSeconds?: number;
  gpuLiveSortedCandidateTelemetryFrame?: number;
  gpuLiveSortedCandidateTelemetrySampled?: boolean;
  gpuLiveSortedCandidateTelemetryStaleSeconds?: number;
  gpuLiveSortedCandidateLastParticleCount?: number;
  gpuLiveSpatialNeighborUploadFloats?: number;
  gpuLiveSpatialNeighborDirectUploadFloats?: number;
  gpuLiveSpatialNeighborPaddedUploadFloats?: number;
  gpuLiveSpatialNeighborActiveRows?: number;
  gpuLiveSpatialNeighborUploadedRows?: number;
  gpuLiveSpatialNeighborReservedRows?: number;
  gpuLiveSpatialNeighborUploadSkipped?: boolean;
  gpuLiveSpatialNeighborUploadSource?: 'none' | 'cpu-spatial-neighbor-slots' | 'gpu-resident-list';
  gpuLiveDirectUploadFloats?: number;
  gpuLivePaddedUploadFloats?: number;
  gpuLivePointDraws?: number;
  gpuPreviewCycle?: number;
  gpuPreviewWidth?: number;
  gpuPreviewHeight?: number;
  gpuPreviewActiveRows?: number;
  gpuPreviewUploadedRows?: number;
  gpuPreviewReservedRows?: number;
  gpuPreviewStressRatio?: number;
  gpuPreviewSpatialSeeded?: boolean;
  gpuPreviewSeedColumns?: number;
  gpuPreviewSeedRows?: number;
  particleCapacity?: number;
  needsRedraw?: boolean;
  cleanupPointer?: () => void;
}

const MAX_PARTICLES = 220_000;
const PREVIEW_MAX_PARTICLES = 256;
const PARTICLE_POSITION_STRIDE = 2;
const PARTICLE_STYLE_STRIDE = 2;
const SHAPE_STRIDE = 6;
const PALETTE_FLOATS = 8 * 3;
const SORTED_CELL_RESIDENT_SCAN_LIMIT = 8;
const FALLBACK_PALETTE = [0x8b5cf6, 0x22d3ee, 0xff6b9d, 0x4ade80, 0xfb923c];

const QUALITY_BODY_PROFILE: Record<RenderQuality, {
  maxBodyScale: number;
  maxSpawnBurst: number;
  radiusScale: number;
}> = {
  basic: { maxBodyScale: 0.25, maxSpawnBurst: 2_500, radiusScale: 0.95 },
  enhanced: { maxBodyScale: 0.55, maxSpawnBurst: 7_500, radiusScale: 1 },
  raw: { maxBodyScale: 1, maxSpawnBurst: 12_000, radiusScale: 1 },
};

const VERTEX = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aUnit;
layout(location = 1) in vec2 aCenter;
layout(location = 2) in vec4 aParams;
uniform vec2 uResolution;
out vec2 vLocal;
out vec4 vParams;
flat out int vKind;
flat out int vId;
flat out float vSeed;
void main() {
  float aaPad = 3.0;
  float kind = aParams.z;
  float outerRadius = kind == 3.0 ? aParams.x + aParams.y : aParams.x;
  vec2 extent = vec2(max(outerRadius, 1.0) + aaPad);
  vec2 local = aUnit * extent;
  vec2 pixel = aCenter + local;
  vec2 clip = pixel / uResolution * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vLocal = local;
  vParams = aParams;
  vKind = int(aParams.z + 0.5);
  vId = int((kind == 0.0 ? aParams.y : aParams.w) + 0.5);
  vSeed = kind == 0.0 ? aParams.y : aParams.w;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 vLocal;
in vec4 vParams;
flat in int vKind;
flat in int vId;
flat in float vSeed;
uniform vec3 uPalette[8];
uniform int uPaletteCount;
out vec4 outColor;

uint hashId(int id) {
  uint x = uint(id) * 747796405u + 2891336453u;
  x = ((x >> 16) ^ x) * 2246822519u;
  x = ((x >> 13) ^ x) * 3266489917u;
  return (x >> 16) ^ x;
}

vec3 paletteColor(int id) {
  int count = max(1, uPaletteCount);
  int index = int(hashId(id) % uint(count));
  return uPalette[index];
}

float circleSdf(vec2 p, float radius) {
  return length(p) - radius;
}

float capsuleSdf(vec2 p, float halfLength, float radius) {
  vec2 q = vec2(max(abs(p.x) - halfLength, 0.0), p.y);
  return length(q) - radius;
}

float roundedBoxSdf(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  float radius = max(0.5, vParams.x);
  float distanceToEdge = circleSdf(vLocal, radius);
  if (vKind == 1) {
    distanceToEdge = capsuleSdf(vLocal, max(0.0, vParams.y), radius);
  } else if (vKind == 2) {
    distanceToEdge = roundedBoxSdf(vLocal, max(vec2(0.0), vParams.xy), radius * 0.35);
  } else if (vKind == 3) {
    distanceToEdge = abs(length(vLocal) - max(1.0, vParams.x)) - max(1.0, vParams.y);
  } else if (vKind == 4) {
    distanceToEdge = circleSdf(vLocal, max(1.0, vParams.x));
  }
  float aa = max(fwidth(distanceToEdge) * 1.5, 0.002);
  float alpha = 1.0 - smoothstep(0.0, aa, distanceToEdge);
  if (alpha <= 0.01) discard;
  if (vKind == 3) {
    float life = clamp(vSeed, 0.0, 1.0);
    vec3 shock = mix(vec3(0.1, 0.75, 1.0), vec3(1.0), life);
    outColor = vec4(shock, alpha * life * 0.85);
    return;
  }
  if (vKind == 4) {
    float influenceRadius = max(1.0, vParams.x);
    float fade = 1.0 - smoothstep(0.0, 1.0, clamp(length(vLocal) / influenceRadius, 0.0, 1.0));
    outColor = vec4(vec3(0.36, 0.9, 1.0), alpha * (0.08 + fade * 0.06));
    return;
  }

  vec2 extent = vec2(radius);
  vec2 unit = clamp(vLocal / max(extent, vec2(1.0)), vec2(-1.0), vec2(1.0));
  float z = sqrt(max(0.0, 1.0 - dot(unit, unit) * 0.45));
  vec3 n = normalize(vec3(unit * 0.65, z));
  float light = 0.38 + 0.62 * max(0.0, dot(n, normalize(vec3(-0.35, -0.55, 0.9))));
  vec3 rim = vec3(0.18, 0.24, 0.35) * (1.0 - z) * 0.4;
  outColor = vec4(paletteColor(vId) * light + rim, alpha);
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
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program');
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
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

function numberSetting(settings: Record<string, unknown>, key: string, fallback: number): number {
  const value = settings[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boolSetting(settings: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = settings[key];
  return typeof value === 'boolean' ? value : fallback;
}

function qualityProfile(quality: RenderQuality) {
  const shared = resolveAdvancedPhysicsFidelityProfile(quality);
  const body = QUALITY_BODY_PROFILE[quality] ?? QUALITY_BODY_PROFILE.raw;
  return { ...shared, ...body };
}

function logicalSize(state: BallPitRawState): { width: number; height: number } {
  return {
    width: Math.max(1, state.canvas.clientWidth || state.width),
    height: Math.max(1, state.canvas.clientHeight || state.height),
  };
}

function engineSettings(state: BallPitRawState, quality: RenderQuality): AdvancedCollisionStressSettings {
  const profile = qualityProfile(quality);
  const preview = state.previewDemo === true;
  const maxParticles = Math.min(state.particleCapacity ?? MAX_PARTICLES, preview ? 96 : Math.floor(numberSetting(state.settings, 'maxParticles', 50_000) * profile.maxBodyScale));
  return {
    shape: 'ball',
    maxParticles: Math.max(1, Math.min(MAX_PARTICLES, maxParticles)),
    radius: (preview ? 9 : numberSetting(state.settings, 'radius', 12)) * profile.radiusScale,
    radiusVariation: preview ? 0.18 : numberSetting(state.settings, 'radiusVariation', 0.15),
    detail: 1,
    solverPasses: preview ? 2 : Math.max(1, Math.floor(numberSetting(state.settings, 'solverPasses', 3))),
    substeps: preview ? 1 : Math.max(1, Math.floor(numberSetting(state.settings, 'substeps', 2))),
    gravity: preview ? 1050 : numberSetting(state.settings, 'gravity', 1300),
    wallBounce: boolSetting(state.settings, 'wallBounce', false),
    wallBounceCoefficient: numberSetting(state.settings, 'wallBounceAmount', 0.18),
    airDragPerSecond: preview ? 0.994 : numberSetting(state.settings, 'airDrag', 0.998),
    solverDampingPerSecond: preview ? 0.982 : numberSetting(state.settings, 'solverDamping', 0.982),
    maxPairPushFactor: preview ? 0.75 : numberSetting(state.settings, 'maxPairPush', 0.75),
    contactFriction: preview ? 0.72 : numberSetting(state.settings, 'friction', 0.72),
    collisionSoftness: preview ? 1.05 : numberSetting(state.settings, 'collisionSoftness', 1.05),
    impactBounceThreshold: preview ? 150 : numberSetting(state.settings, 'impactBounceThreshold', 150),
    openTop: true,
  };
}

function seedInitialBodies(state: BallPitRawState): void {
  const engine = state.engine;
  if (!engine) return;
  engine.clear();
  state.needsRedraw = true;
}

function spawnSingle(state: BallPitRawState, x: number, y: number): void {
  const engine = state.engine;
  if (!engine) return;
  const size = logicalSize(state);
  engine.configure(engineSettings(state, state.activeQuality ?? 'raw'));
  engine.setBounds(size.width, size.height);
  engine.spawnBudget(1, x, y, 0.45, 0);
  state.needsRedraw = true;
}

function applyExplosionForce(state: BallPitRawState, x: number, y: number): void {
  const engine = state.engine;
  if (!engine) return;
  const radius = Math.max(80, numberSetting(state.settings, 'radius', 4) * 42);
  const strength = numberSetting(state.settings, 'burstCount', 5000) * 0.12;
  state.shockwaves = [...(state.shockwaves ?? []), { x, y, age: 0 }].slice(-8);
  state.needsRedraw = true;
  for (let i = 0; i < engine.count; i += 1) {
    const k = i << 1;
    const dx = engine.positions[k] - x;
    const dy = engine.positions[k + 1] - y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0.001 || dist > radius) continue;
    const falloff = 1 - dist / radius;
    const impulse = strength * falloff * falloff;
    engine.velocities[k] += (dx / dist) * impulse;
    engine.velocities[k + 1] += (dy / dist) * impulse;
  }
  engine.wake();
}

function interactionRadius(state: BallPitRawState): number {
  return Math.max(1, numberSetting(state.settings, 'interactionRadius', 56));
}

function pickNearbyBalls(state: BallPitRawState, x: number, y: number): number[] {
  const engine = state.engine;
  if (!engine) return [];
  const radius = interactionRadius(state);
  const picked: number[] = [];
  for (let i = 0; i < engine.count; i += 1) {
    const k = i << 1;
    const dx = engine.positions[k] - x;
    const dy = engine.positions[k + 1] - y;
    const distance = Math.hypot(dx, dy);
    if (distance <= radius) picked.push(i);
  }
  return picked;
}

function applyPickedBallForces(state: BallPitRawState, x: number, y: number): void {
  const engine = state.engine;
  const picked = state.pickedBallIndices ?? [];
  if (!engine || picked.length === 0) return;
  const previousX = state.previousPointerX ?? x;
  const previousY = state.previousPointerY ?? y;
  const pointerVx = (x - previousX) * 18;
  const pointerVy = (y - previousY) * 18;
  const radius = interactionRadius(state);
  const dt = Math.min(1 / 30, Math.max(1 / 240, state.deltaSeconds || 1 / 60));
  const strength = 360;
  for (const index of picked) {
    if (index < 0 || index >= engine.count) continue;
    const k = index << 1;
    const dx = x - engine.positions[k];
    const dy = y - engine.positions[k + 1];
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) continue;
    const normalizedDistance = Math.min(3, distance / Math.max(1, radius));
    const exponentialPull = (Math.exp(normalizedDistance) - 1) / (Math.E - 1);
    const acceleration = strength * exponentialPull;
    engine.velocities[k] += (dx / distance) * acceleration * dt * 60;
    engine.velocities[k + 1] += (dy / distance) * acceleration * dt * 60;
    engine.velocities[k] = engine.velocities[k] * 0.94 + pointerVx * 0.06;
    engine.velocities[k + 1] = engine.velocities[k + 1] * 0.94 + pointerVy * 0.06;
  }
  engine.wake();
  state.previousPointerX = x;
  state.previousPointerY = y;
}

function demoFloorIsDropped(state: BallPitRawState): boolean {
  if (state.mode !== 'demo' && state.previewDemo !== true) return false;
  const cycleSeconds = state.previewDemo === true ? 7 : 10;
  const dropSeconds = state.previewDemo === true ? 1.5 : 2;
  return state.timeSeconds % cycleSeconds >= cycleSeconds - dropSeconds;
}

function pruneEscapedDemoBalls(state: BallPitRawState, visibleHeight: number): void {
  const engine = state.engine;
  if (!engine) return;
  const radius = engineSettings(state, state.activeQuality ?? 'raw').radius;
  const escapeLine = visibleHeight + Math.max(radius * 18, visibleHeight * 0.28, 96);
  const removed = engine.removeCircleParticlesBelow(escapeLine);
  if (removed > 0 && state.pickedBallIndices && state.pickedBallIndices.length > 0) {
    state.pickedBallIndices = [];
  }
  if (removed > 0) state.particleStyleUploadedCount = 0;
}

function installPointer(state: BallPitRawState): void {
  const canvas = state.canvas;
  const toLocal = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const down = (event: PointerEvent) => {
    const p = toLocal(event);
    state.pointerDown = true;
    state.pointerX = p.x;
    state.pointerY = p.y;
    state.needsRedraw = true;
    state.previousPointerX = p.x;
    state.previousPointerY = p.y;
    if (state.inputMode === 'interact') {
      state.pickedBallIndices = pickNearbyBalls(state, p.x, p.y);
      applyPickedBallForces(state, p.x, p.y);
    } else if (state.inputMode === 'explosion') applyExplosionForce(state, p.x, p.y);
    else if (state.inputMode === 'single') spawnSingle(state, p.x, p.y);
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    const p = toLocal(event);
    state.pointerX = p.x;
    state.pointerY = p.y;
    state.needsRedraw = true;
    if (state.inputMode === 'interact' && state.pointerDown) {
      applyPickedBallForces(state, p.x, p.y);
    }
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {
    state.pointerDown = false;
    state.grabbedIndex = -1;
    state.pickedBallIndices = [];
    state.needsRedraw = true;
    canvas.releasePointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  state.cleanupPointer = () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  };
}

function ballPitShouldRender(state: BallPitRawState): boolean {
  if (state.previewDemo === true || state.mode === 'demo') return true;
  if (state.pointerDown === true || state.needsRedraw === true) return true;
  const engine = state.engine;
  if (engine && engine.count > 0) return engine.isAwake;
  if ((state.shockwaves?.length ?? 0) > 0) return true;
  return false;
}

function writePalette(target: Float32Array, palette: readonly number[]): number {
  const source = palette.length > 0 ? palette : FALLBACK_PALETTE;
  const count = Math.min(8, source.length);
  for (let i = 0; i < count; i += 1) {
    const color = source[i] ?? FALLBACK_PALETTE[i % FALLBACK_PALETTE.length] ?? 0xffffff;
    const k = i * 3;
    target[k] = ((color >> 16) & 255) / 255;
    target[k + 1] = ((color >> 8) & 255) / 255;
    target[k + 2] = (color & 255) / 255;
  }
  return count;
}

function previewRandom(index: number, salt: number): number {
  let x = (index * 374761393 + salt * 668265263) | 0;
  x = (x ^ (x >>> 13)) | 0;
  x = Math.imul(x, 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function maxCellOccupancyFromSortedKeys(keys: Float64Array, count: number, sortStride: number): number {
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

function liveGpuCapacityForCount(count: number, maxCapacity: number, currentCapacity = 0): number {
  const target = Math.max(256, Math.ceil(Math.max(1, count) * 1.35));
  if (currentCapacity > 0 && target <= currentCapacity && target >= currentCapacity * 0.25) return currentCapacity;
  let capacity = 256;
  while (capacity < target && capacity < maxCapacity) capacity *= 2;
  return Math.min(maxCapacity, capacity);
}

function destroyLiveSortedCandidateState(state: BallPitRawState): void {
  state.gpuLiveSortedCandidateNeighbors?.destroy();
  state.gpuLiveSortedCandidateCellRangeBridge?.destroy();
  state.gpuLiveSortedCandidateIndexMapBridge?.destroy();
  state.gpuLiveSortedCandidateIndexMapGather?.destroy();
  state.gpuLiveSortedCandidateIndexMapGatherState?.destroy();
  state.gpuLiveResidentListCandidateNeighbors?.destroy();
  state.gpuLiveResidentListCandidateSlots?.destroy();
  state.gpuLiveSortedCellCandidateSlots?.destroy();
  state.gpuLiveSortedCandidateSlots?.destroy();
  state.gpuLiveSortedCandidateOccupancy?.destroy();
  state.gpuLiveSortedCandidateCellOffsets?.destroy();
  state.gpuLiveSortedCandidateCellRanges?.destroy();
  state.gpuLiveSortedCandidateCellKeys?.destroy();
  state.gpuLiveSortedCandidateKeySort?.destroy();
  state.gpuLiveSortedCandidateSortedKeyGather?.destroy();
  state.gpuLiveSortedCandidateSortedKeyRanges?.destroy();
  state.gpuLiveSortedCandidateResidentList?.destroy();
  state.gpuLiveSortedCandidateGridKey?.destroy();
  state.gpuLiveSortedCandidateState?.destroy();
  state.gpuLiveSortedCandidateNeighbors = undefined;
  state.gpuLiveSortedCandidateCellRangeBridge = undefined;
  state.gpuLiveSortedCandidateIndexMapBridge = undefined;
  state.gpuLiveSortedCandidateIndexMapGather = undefined;
  state.gpuLiveSortedCandidateIndexMapGatherState = undefined;
  state.gpuLiveResidentListCandidateNeighbors = undefined;
  state.gpuLiveResidentListCandidateSlots = undefined;
  state.gpuLiveSortedCellCandidateSlots = undefined;
  state.gpuLiveSortedCandidateSlots = undefined;
  state.gpuLiveSortedCandidateOccupancy = undefined;
  state.gpuLiveSortedCandidateCellOffsets = undefined;
  state.gpuLiveSortedCandidateCellRanges = undefined;
  state.gpuLiveSortedCandidateCellKeys = undefined;
  state.gpuLiveSortedCandidateKeySort = undefined;
  state.gpuLiveSortedCandidateSortedKeyGather = undefined;
  state.gpuLiveSortedCandidateSortedKeyRanges = undefined;
  state.gpuLiveSortedCandidateResidentList = undefined;
  state.gpuLiveSortedCandidateGridKey = undefined;
  state.gpuLiveSortedCandidateState = undefined;
  state.gpuLiveSortedCandidatePositions = undefined;
  state.gpuLiveSortedCandidateKeys = undefined;
  state.gpuLiveSortedCandidateCapacity = undefined;
  state.gpuLiveSortedCandidateUploadMode = undefined;
  state.gpuLiveSortedCandidateSource = undefined;
  state.gpuLiveSortedCandidateRefreshReason = undefined;
  state.gpuLiveSortedCandidateCellRangeWidth = undefined;
  state.gpuLiveSortedCandidateCellRangeHeight = undefined;
  state.gpuLiveSortedCandidateCellRangeUploadFloats = undefined;
  state.gpuLiveSortedCandidateCellRangeSource = undefined;
  state.gpuLiveSortedCandidateOccupancyStats = undefined;
  state.gpuLiveSortedCandidateCellOffsetStats = undefined;
  state.gpuLiveSortedCandidateCellRangeStats = undefined;
  state.gpuLiveSortedCandidateCellKeyStats = undefined;
  state.gpuLiveSortedCandidateKeySortStats = undefined;
  state.gpuLiveSortedCandidateSortedKeyGatherStats = undefined;
  state.gpuLiveSortedCandidateSortedKeyRangeStats = undefined;
  state.gpuLiveSortedCandidateResidentListStats = undefined;
  state.gpuLiveResidentListCandidateStats = undefined;
  state.gpuLiveSortedCandidateIndexMapUploadFloats = undefined;
  state.gpuLiveSortedCandidateIndexMapSource = undefined;
  state.gpuLiveSortedCandidateIndexMapGatherFragmentTexels = undefined;
  state.gpuLiveSortedCandidateIndexMapGatherActive = undefined;
  state.gpuLiveSortedCandidateMaxCellOccupancy = undefined;
  state.gpuLiveSortedCandidateResidentScanLimit = undefined;
  state.gpuLiveSortedCandidateCollisionBatches = undefined;
  state.gpuLiveSortedCandidateCollisionFragmentTexels = undefined;
  state.gpuLiveSortedCandidateCollisionConsumedSlots = undefined;
  state.gpuLiveSortedCandidateCollisionIgnoredSlots = undefined;
  state.gpuLiveSortedCandidateCollisionSpatiallyComplete = undefined;
  state.gpuLiveSortedCandidateCollisionStressActive = undefined;
  state.gpuLiveSortedCandidateLastParticleCount = undefined;
}

function ensureLiveSortedCandidateState(state: BallPitRawState, capacity: number): RawGpuConstraintParticleState | null {
  if (state.gpuLiveSortedCandidateState && state.gpuLiveSortedCandidateState.capacity === capacity) return state.gpuLiveSortedCandidateState;
  destroyLiveSortedCandidateState(state);
  const gpu = new RawGpuConstraintParticleState(state.resources, { capacity });
  state.gpuLiveSortedCandidateState = gpu;
  state.gpuLiveSortedCandidateOccupancy = new RawGpuConstraintParticleCellOccupancyPass(state.resources);
  state.gpuLiveSortedCandidateCellOffsets = new RawGpuConstraintParticleCellOffsetPass(state.resources);
  state.gpuLiveSortedCandidateCellRanges = new RawGpuConstraintParticleCellRangeFromOffsetsPass(state.resources);
  state.gpuLiveSortedCandidateCellKeys = new RawGpuConstraintParticleCellKeyPass(state.resources);
  state.gpuLiveSortedCandidateKeySort = new RawGpuKeyIndexSortPass(state.resources);
  state.gpuLiveSortedCandidateSortedKeyGather = new RawGpuConstraintParticleSortedKeyGatherPass(state.gl);
  state.gpuLiveSortedCandidateSortedKeyRanges = new RawGpuConstraintParticleSortedKeyRangePass(state.resources);
  state.gpuLiveSortedCandidateResidentList = new RawGpuConstraintParticleResidentListFromSortedKeysPass(state.resources);
  state.gpuLiveSortedCandidateGridKey = new RawGpuConstraintParticleGridKeyPass(state.resources, gpu);
  state.gpuLiveSortedCandidateSlots = new RawGpuConstraintParticleCandidateSlotPass(state.gl);
  state.gpuLiveResidentListCandidateSlots = new RawGpuConstraintParticleResidentListCandidatePass(state.gl);
  state.gpuLiveSortedCellCandidateSlots = new RawGpuConstraintParticleSortedCellCandidatePass(state.gl);
  state.gpuLiveSortedCandidateCellRangeBridge = new RawGpuConstraintParticleCellRangeBridge(state.resources);
  state.gpuLiveSortedCandidateIndexMapBridge = new RawGpuConstraintParticleIndexMapBridge(state.resources);
  state.gpuLiveSortedCandidateIndexMapGather = new RawGpuConstraintParticleIndexMapGatherPass(state.gl);
  state.gpuLiveSortedCandidateIndexMapGatherState = new RawGpuConstraintParticleState(state.resources, { capacity });
  state.gpuLiveSortedCandidateNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: gpu.width,
    height: gpu.height,
    slots: SORTED_CELL_RESIDENT_SCAN_LIMIT * 9,
  });
  state.gpuLiveResidentListCandidateNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: gpu.width,
    height: gpu.height,
    slots: SORTED_CELL_RESIDENT_SCAN_LIMIT * 9,
  });
  state.gpuLiveSortedCandidateCapacity = capacity;
  return gpu;
}

function uploadLiveSortedCandidateCellRanges(state: BallPitRawState, columns: number, rows: number): void {
  const keys = state.gpuLiveSortedCandidateKeys;
  const count = state.gpuLiveSortedCandidateParticleCount ?? 0;
  const bridge = state.gpuLiveSortedCandidateCellRangeBridge;
  const indexMapBridge = state.gpuLiveSortedCandidateIndexMapBridge;
  if (!keys || !bridge || count <= 0) {
    state.gpuLiveSortedCandidateCellRangeWidth = 0;
    state.gpuLiveSortedCandidateCellRangeHeight = 0;
    state.gpuLiveSortedCandidateMaxCellOccupancy = 0;
    state.gpuLiveSortedCandidateCellRangeUploadFloats = 0;
    state.gpuLiveSortedCandidateCellRangeSource = 'none';
    state.gpuLiveSortedCandidateIndexMapUploadFloats = 0;
    state.gpuLiveSortedCandidateIndexMapSource = 'none';
    return;
  }
  const sortedKeyRanges = state.gpuLiveSortedCandidateSortedKeyRangeStats?.suitableForSortedCandidateBridge === true
    ? state.gpuLiveSortedCandidateSortedKeyRanges?.output
    : undefined;
  const occupancyOffsetRanges = state.gpuLiveSortedCandidateCellRanges?.output;
  const gpuRanges = sortedKeyRanges ?? occupancyOffsetRanges;
  if (gpuRanges) {
    state.gpuLiveSortedCandidateCellRangeWidth = gpuRanges.texture.width;
    state.gpuLiveSortedCandidateCellRangeHeight = gpuRanges.texture.height;
    state.gpuLiveSortedCandidateCellRangeUploadFloats = 0;
    state.gpuLiveSortedCandidateCellRangeSource = sortedKeyRanges
      ? 'gpu-sorted-key-range'
      : 'gpu-occupancy-offset-range';
    state.gpuLiveSortedCandidateMaxCellOccupancy = maxCellOccupancyFromSortedKeys(keys, count, count + 1);
    if (
      indexMapBridge &&
      state.gpuLiveSortedCandidateState &&
      state.gpuLiveSortedCandidateUploadMode === 'gpu-sorted-key-gather'
    ) {
      const sortStride = count + 1;
      const mapResult = indexMapBridge.uploadFromSortedKeys({
        sortedKeys: keys,
        particleCount: count,
        sortStride,
        sortedTextureWidth: state.gpuLiveSortedCandidateState.width,
        targetWidth: state.gpuLiveSortedCandidateState.width,
        targetHeight: state.gpuLiveSortedCandidateState.height,
      });
      state.gpuLiveSortedCandidateIndexMapUploadFloats = mapResult.uploadFloats;
      state.gpuLiveSortedCandidateIndexMapSource = 'cpu-index-map-bridge';
    } else {
      state.gpuLiveSortedCandidateIndexMapUploadFloats = 0;
      state.gpuLiveSortedCandidateIndexMapSource = state.gpuLiveSortedCandidateUploadMode === 'gpu-sorted-key-gather'
        ? 'none'
        : 'skipped-non-gpu-sorted-state';
    }
    return;
  }
  const result = bridge.upload({
    sortedKeys: keys,
    particleCount: count,
    columns,
    rows,
  });
  state.gpuLiveSortedCandidateCellRangeWidth = result.width;
  state.gpuLiveSortedCandidateCellRangeHeight = result.height;
  state.gpuLiveSortedCandidateCellRangeUploadFloats = result.uploadFloats;
  state.gpuLiveSortedCandidateCellRangeSource = 'cpu-cell-range-bridge';
  state.gpuLiveSortedCandidateMaxCellOccupancy = result.maxCellOccupancy;
  if (
    indexMapBridge &&
    state.gpuLiveSortedCandidateState &&
    state.gpuLiveSortedCandidateUploadMode === 'gpu-sorted-key-gather'
  ) {
    const sortStride = count + 1;
    const mapResult = indexMapBridge.uploadFromSortedKeys({
      sortedKeys: keys,
      particleCount: count,
      sortStride,
      sortedTextureWidth: state.gpuLiveSortedCandidateState.width,
      targetWidth: state.gpuLiveSortedCandidateState.width,
      targetHeight: state.gpuLiveSortedCandidateState.height,
    });
    state.gpuLiveSortedCandidateIndexMapUploadFloats = mapResult.uploadFloats;
    state.gpuLiveSortedCandidateIndexMapSource = 'cpu-index-map-bridge';
  } else {
    state.gpuLiveSortedCandidateIndexMapUploadFloats = 0;
    state.gpuLiveSortedCandidateIndexMapSource = state.gpuLiveSortedCandidateUploadMode === 'gpu-sorted-key-gather'
      ? 'none'
      : 'skipped-non-gpu-sorted-state';
  }
}

function solveLiveSortedCandidateCollisionStress(state: BallPitRawState, particleCount: number): void {
  const gpu = state.gpuLiveSortedCandidateState;
  const collision = state.gpuPreviewCollision;
  const neighbors = state.gpuLiveSortedCandidateNeighbors;
  const gather = state.gpuLiveSortedCandidateIndexMapGather;
  const gatherState = state.gpuLiveSortedCandidateIndexMapGatherState;
  const indexMap = state.gpuLiveSortedCandidateIndexMapSource === 'cpu-index-map-bridge'
    ? state.gpuLiveSortedCandidateIndexMapBridge?.framebuffer
    : undefined;
  const candidateStats = state.gpuLiveCandidateSlotStats;
  if (!gpu || !collision || !neighbors || !candidateStats || candidateStats.slotCount <= 0 || particleCount <= 0) {
    state.gpuLiveSortedCandidateCollisionBatches = 0;
    state.gpuLiveSortedCandidateCollisionFragmentTexels = 0;
    state.gpuLiveSortedCandidateCollisionConsumedSlots = 0;
    state.gpuLiveSortedCandidateCollisionIgnoredSlots = 0;
    state.gpuLiveSortedCandidateCollisionSpatiallyComplete = false;
    state.gpuLiveSortedCandidateCollisionStressActive = false;
    state.gpuLiveSortedCandidateIndexMapGatherFragmentTexels = 0;
    state.gpuLiveSortedCandidateIndexMapGatherActive = false;
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
      stiffness: 0.18,
      damping: 0.006,
      spatiallyComplete: candidateStats.spatiallyComplete,
      slotOverflowCount: candidateStats.suitableForAuthoritativeCollision === true ? 0 : Math.max(0, (state.gpuLiveSortedCandidateMaxCellOccupancy ?? 0) - (state.gpuLiveSortedCandidateResidentScanLimit ?? 0)),
    });
    const stats = collision.stats();
    batches += 1;
    fragmentTexels += stats.fragmentTexels;
    consumedSlots += stats.neighborSlotCount;
  }
  state.gpuLiveSortedCandidateCollisionBatches = batches;
  state.gpuLiveSortedCandidateCollisionFragmentTexels = fragmentTexels;
  state.gpuLiveSortedCandidateCollisionConsumedSlots = consumedSlots;
  state.gpuLiveSortedCandidateCollisionIgnoredSlots = Math.max(0, slotCount - consumedSlots);
  state.gpuLiveSortedCandidateCollisionSpatiallyComplete = candidateStats.spatiallyComplete;
  state.gpuLiveSortedCandidateCollisionStressActive = batches > 0;
  if (gather && gatherState && indexMap) {
    gather.gather({
      source: gpu,
      destination: gatherState,
      indexMap,
      particleCount,
    });
    const gatherStats = gather.stats();
    state.gpuLiveSortedCandidateIndexMapGatherFragmentTexels = gatherStats.fragmentTexels;
    state.gpuLiveSortedCandidateIndexMapGatherActive = gatherStats.fragmentTexels > 0;
  } else {
    state.gpuLiveSortedCandidateIndexMapGatherFragmentTexels = 0;
    state.gpuLiveSortedCandidateIndexMapGatherActive = false;
  }
}

function syncLiveSortedCandidateState(state: BallPitRawState, size: { width: number; height: number }, particleCount: number): void {
  const engine = state.engine;
  if (!engine || particleCount <= 0) return;
  const capacity = liveGpuCapacityForCount(particleCount, state.particleCapacity ?? MAX_PARTICLES, state.gpuLiveSortedCandidateState?.capacity ?? 0);
  const gpu = ensureLiveSortedCandidateState(state, capacity);
  if (!gpu) return;
  const requiredLength = gpu.width * gpu.height * 4;
  const positions = state.gpuLiveSortedCandidatePositions && state.gpuLiveSortedCandidatePositions.length === requiredLength
    ? state.gpuLiveSortedCandidatePositions
    : new Float32Array(requiredLength);
  state.gpuLiveSortedCandidatePositions = positions;
  const count = Math.min(particleCount, engine.count, capacity);
  const canUseGpuSortedGather =
    state.gpuPreviewState != null &&
    state.gpuLiveSortedCandidateCellKeys != null &&
    state.gpuLiveSortedCandidateKeySort != null &&
    state.gpuLiveSortedCandidateSortedKeyGather != null;
  const keys = state.gpuLiveSortedCandidateKeys && state.gpuLiveSortedCandidateKeys.length === count
    ? state.gpuLiveSortedCandidateKeys
    : new Float64Array(count);
  state.gpuLiveSortedCandidateKeys = keys;
  const cellSize = state.gpuLiveSpatialNeighborStats?.cellSize ?? Math.max(5, engineSettings(state, state.activeQuality ?? 'raw').radius * 2.4);
  const columns = Math.max(1, Math.ceil(size.width / Math.max(1, cellSize)));
  const rows = Math.max(1, Math.ceil(size.height / Math.max(1, cellSize)));
  const telemetryStaleSeconds = state.timeSeconds - (state.gpuLiveSortedCandidateTelemetryLastSeconds ?? -Infinity);
  const persistentGpuFrame = state.gpuLiveDynamicUploadSkipped === true;
  const refreshReason = state.gpuLiveSortedCandidateTelemetryLastSeconds == null
    ? 'initial'
    : state.gpuLiveSortedCandidateLastParticleCount !== count
      ? 'particle-count-changed'
      : persistentGpuFrame
        ? 'persistent-gpu-frame'
        : telemetryStaleSeconds >= 0.2
          ? 'stale-telemetry'
          : 'none';
  const refreshTelemetry = refreshReason !== 'none';
  state.gpuLiveSortedCandidateTelemetrySampled = false;
  state.gpuLiveSortedCandidateTelemetryStaleSeconds = Number.isFinite(telemetryStaleSeconds) ? Math.max(0, telemetryStaleSeconds) : 0;
  state.gpuLiveSortedCandidateSource = persistentGpuFrame ? 'persistent-gpu-live-state' : 'cpu-live-snapshot';
  state.gpuLiveSortedCandidateRefreshReason = refreshReason;
  if (!refreshTelemetry) return;
  const sortStride = count + 1;
  for (let index = 0; index < count; index += 1) {
    const k = index << 1;
    const cx = Math.max(0, Math.min(columns - 1, Math.floor(engine.positions[k] / cellSize)));
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(engine.positions[k + 1] / cellSize)));
    keys[index] = (cx + cy * columns) * sortStride + index;
  }
  keys.sort();
  for (let sorted = 0; sorted < count; sorted += 1) {
    const sourceIndex = keys[sorted] % sortStride;
    if (!canUseGpuSortedGather) {
      const source = sourceIndex << 1;
      const target = sorted * 4;
      positions[target] = engine.positions[source];
      positions[target + 1] = engine.positions[source + 1];
      positions[target + 2] = engine.radii[sourceIndex];
      positions[target + 3] = engine.seeds[sourceIndex];
    }
  }
  state.gpuLiveSortedCandidateParticleCount = count;
  if (canUseGpuSortedGather) {
    state.gpuLiveSortedCandidateUploadFloats = 0;
    state.gpuLiveSortedCandidateDirectUploadFloats = 0;
    state.gpuLiveSortedCandidatePaddedUploadFloats = 0;
    state.gpuLiveSortedCandidateUploadMode = 'gpu-sorted-key-gather';
  } else {
    gpu.uploadDynamicState({
      positions,
      uploadWriteTargets: false,
      particleCount: count,
    });
    state.gpuLiveSortedCandidateUploadFloats = gpu.dynamicUploadFloats();
    state.gpuLiveSortedCandidateDirectUploadFloats = gpu.directUploadFloats();
    state.gpuLiveSortedCandidatePaddedUploadFloats = gpu.paddedUploadFloats();
    state.gpuLiveSortedCandidateUploadMode = 'cpu-sorted-copy';
  }
  state.gpuLiveSortedCandidateCellSize = cellSize;
  state.gpuLiveSortedCandidateCellColumns = columns;
  state.gpuLiveSortedCandidateCellRows = rows;
  state.gpuLiveSortedCandidateResidentScanLimit = SORTED_CELL_RESIDENT_SCAN_LIMIT;
    state.gpuLiveSortedCandidateOccupancyStats = state.gpuLiveSortedCandidateOccupancy?.compute({
      state: gpu,
      particleCount: count,
      worldMinX: 0,
      worldMinY: 0,
      worldMaxX: size.width,
      worldMaxY: size.height,
      cellSize,
    });
    state.gpuLiveSortedCandidateCellOffsetStats = state.gpuLiveSortedCandidateOccupancy?.output
      ? state.gpuLiveSortedCandidateCellOffsets?.compute({
          occupancy: state.gpuLiveSortedCandidateOccupancy.output,
          gridColumns: state.gpuLiveSortedCandidateOccupancyStats?.gridColumns ?? 1,
          gridRows: state.gpuLiveSortedCandidateOccupancyStats?.gridRows ?? 1,
        })
      : undefined;
  state.gpuLiveSortedCandidateCellRangeStats =
    state.gpuLiveSortedCandidateOccupancy?.output && state.gpuLiveSortedCandidateCellOffsets?.output
      ? state.gpuLiveSortedCandidateCellRanges?.compute({
          occupancy: state.gpuLiveSortedCandidateOccupancy.output,
          inclusiveOffsets: state.gpuLiveSortedCandidateCellOffsets.output,
          gridColumns: state.gpuLiveSortedCandidateOccupancyStats?.gridColumns ?? 1,
          gridRows: state.gpuLiveSortedCandidateOccupancyStats?.gridRows ?? 1,
        })
      : undefined;
  const gpuSortSource = state.gpuPreviewState ?? gpu;
  state.gpuLiveSortedCandidateCellKeyStats = state.gpuLiveSortedCandidateCellKeys?.compute({
    state: gpuSortSource,
    particleCount: count,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: size.width,
    worldMaxY: size.height,
    cellSize,
  });
  state.gpuLiveSortedCandidateKeySortStats = state.gpuLiveSortedCandidateCellKeys?.output
    ? state.gpuLiveSortedCandidateKeySort?.sort({
        source: state.gpuLiveSortedCandidateCellKeys.output,
        sourceWidth: state.gpuLiveSortedCandidateCellKeyStats?.width ?? gpu.width,
        sourceHeight: state.gpuLiveSortedCandidateCellKeyStats?.height ?? 1,
        elementCount: count,
      })
    : undefined;
  state.gpuLiveSortedCandidateSortedKeyRangeStats =
    state.gpuLiveSortedCandidateKeySort?.output && state.gpuLiveSortedCandidateKeySortStats
      ? state.gpuLiveSortedCandidateSortedKeyRanges?.compute({
          sortedKeys: state.gpuLiveSortedCandidateKeySort.output,
          sortedKeyWidth: state.gpuLiveSortedCandidateKeySortStats.width,
          sortedKeyHeight: state.gpuLiveSortedCandidateKeySortStats.height,
          elementCount: count,
          gridColumns: columns,
          gridRows: rows,
        })
      : undefined;
  if (state.gpuLiveSortedCandidateKeySort?.output && state.gpuLiveSortedCandidateKeySortStats) {
    state.gpuLiveSortedCandidateSortedKeyGather?.gather({
      source: gpuSortSource,
      destination: gpu,
      sortedKeys: state.gpuLiveSortedCandidateKeySort.output,
      sortedKeyWidth: state.gpuLiveSortedCandidateKeySortStats.width,
      sortedKeyHeight: state.gpuLiveSortedCandidateKeySortStats.height,
      particleCount: count,
    });
    state.gpuLiveSortedCandidateSortedKeyGatherStats = state.gpuLiveSortedCandidateSortedKeyGather?.stats();
  } else {
    state.gpuLiveSortedCandidateSortedKeyGatherStats = undefined;
  }
  uploadLiveSortedCandidateCellRanges(state, columns, rows);
  state.gpuLiveSortedCandidateResidentListStats =
    state.gpuLiveSortedCandidateKeySort?.output && state.gpuLiveSortedCandidateKeySortStats
      ? state.gpuLiveSortedCandidateResidentList?.compute({
          sortedKeys: state.gpuLiveSortedCandidateKeySort.output,
          sortedKeyWidth: state.gpuLiveSortedCandidateKeySortStats.width,
          sortedKeyHeight: state.gpuLiveSortedCandidateKeySortStats.height,
          elementCount: count,
          gridColumns: columns,
          gridRows: rows,
          residentLimit: state.gpuLiveSortedCandidateResidentScanLimit ?? SORTED_CELL_RESIDENT_SCAN_LIMIT,
          maxCellOccupancy: state.gpuLiveSortedCandidateMaxCellOccupancy ?? 0,
        })
      : undefined;
  state.gpuLiveResidentListCandidateStats =
    state.gpuLiveSortedCandidateCellKeys?.output &&
    state.gpuLiveSortedCandidateResidentList?.output &&
    state.gpuLiveResidentListCandidateSlots &&
    state.gpuLiveResidentListCandidateNeighbors
      ? state.gpuLiveResidentListCandidateSlots.generate({
          state: gpuSortSource,
          gridKeys: state.gpuLiveSortedCandidateCellKeys.output,
          residentList: state.gpuLiveSortedCandidateResidentList.output,
          outputSlots: state.gpuLiveResidentListCandidateNeighbors.framebuffers,
          particleCount: count,
          gridColumns: columns,
          gridRows: rows,
          residentLimit: state.gpuLiveSortedCandidateResidentListStats?.residentLimit ?? SORTED_CELL_RESIDENT_SCAN_LIMIT,
          residentListTextureWidth: state.gpuLiveSortedCandidateResidentList.output.texture.width,
          residentListTextureHeight: state.gpuLiveSortedCandidateResidentList.output.texture.height,
          maxCellOccupancy: state.gpuLiveSortedCandidateMaxCellOccupancy ?? 0,
        })
      : undefined;
  state.gpuLiveSortedCandidateTelemetryLastSeconds = state.timeSeconds;
  state.gpuLiveSortedCandidateTelemetryFrame = (state.gpuLiveSortedCandidateTelemetryFrame ?? 0) + 1;
  state.gpuLiveSortedCandidateTelemetrySampled = true;
  state.gpuLiveSortedCandidateTelemetryStaleSeconds = 0;
  state.gpuLiveSortedCandidateLastParticleCount = count;
  state.gpuLiveGridKeyStats = state.gpuLiveSortedCandidateGridKey?.compute({
    state: gpu,
    particleCount: count,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: size.width,
    worldMaxY: size.height,
    cellSize,
  });
  const cellRangeFramebuffer =
    state.gpuLiveSortedCandidateSortedKeyRanges?.output ??
    state.gpuLiveSortedCandidateCellRanges?.output ??
    state.gpuLiveSortedCandidateCellRangeBridge?.framebuffer;
  state.gpuLiveCandidateSlotStats = state.gpuLiveSortedCandidateGridKey && state.gpuLiveSortedCellCandidateSlots && state.gpuLiveSortedCandidateNeighbors && cellRangeFramebuffer
    ? state.gpuLiveSortedCellCandidateSlots.generate({
      state: gpu,
      gridKeys: state.gpuLiveSortedCandidateGridKey.output,
      cellRanges: cellRangeFramebuffer,
      outputSlots: state.gpuLiveSortedCandidateNeighbors.framebuffers,
      particleCount: count,
      gridColumns: columns,
      gridRows: rows,
      residentScanLimit: SORTED_CELL_RESIDENT_SCAN_LIMIT,
      cellRangeTextureWidth: cellRangeFramebuffer.texture.width,
      cellRangeTextureHeight: cellRangeFramebuffer.texture.height,
      maxCellOccupancy: state.gpuLiveSortedCandidateMaxCellOccupancy ?? 0,
    })
    : undefined;
  solveLiveSortedCandidateCollisionStress(state, count);
}

function resetGpuPreview(state: BallPitRawState, width: number, height: number): void {
  const gpu = state.gpuPreviewState;
  if (!gpu) return;
  const requiredLength = gpu.width * gpu.height * 4;
  const positions = state.gpuPreviewPositions && state.gpuPreviewPositions.length === requiredLength
    ? state.gpuPreviewPositions
    : new Float32Array(requiredLength);
  const velocities = state.gpuPreviewVelocities && state.gpuPreviewVelocities.length === requiredLength
    ? state.gpuPreviewVelocities
    : new Float32Array(requiredLength);
  const attributes = state.gpuPreviewAttributes && state.gpuPreviewAttributes.length === requiredLength
    ? state.gpuPreviewAttributes
    : new Float32Array(requiredLength);
  state.gpuPreviewPositions = positions;
  state.gpuPreviewVelocities = velocities;
  state.gpuPreviewAttributes = attributes;
  const radius = 2.4;
  const seedColumns = Math.max(1, gpu.width);
  const seedRows = Math.max(1, Math.ceil(gpu.capacity / seedColumns));
  for (let index = 0; index < gpu.capacity; index += 1) {
    const offset = index * 4;
    const column = index % seedColumns;
    const row = Math.floor(index / seedColumns);
    const jitterX = previewRandom(index, 11) - 0.5;
    const jitterY = previewRandom(index, 23) - 0.5;
    positions[offset] = ((column + 0.5 + jitterX * 0.42) / seedColumns) * width;
    positions[offset + 1] = -height * (0.08 + ((row + 0.5 + jitterY * 0.42) / seedRows) * 1.4);
    positions[offset + 2] = radius * (0.7 + previewRandom(index, 37) * 0.9);
    positions[offset + 3] = previewRandom(index, 41) * 1000;
    velocities[offset] = (previewRandom(index, 53) - 0.5) * 90;
    velocities[offset + 1] = 80 + previewRandom(index, 67) * 160;
    velocities[offset + 2] = 1;
    velocities[offset + 3] = 0;
    attributes[offset] = positions[offset + 2];
    attributes[offset + 1] = 1;
    attributes[offset + 2] = previewRandom(index, 79) * 1000;
    attributes[offset + 3] = previewRandom(index, 83) * 1000;
  }
  gpu.uploadSeed({ positions, velocities, attributes, uploadWriteTargets: false });
  state.gpuPreviewWidth = width;
  state.gpuPreviewHeight = height;
  state.gpuPreviewActiveRows = gpu.particleActiveRows();
  state.gpuPreviewUploadedRows = gpu.particleUploadedRows();
  state.gpuPreviewReservedRows = gpu.particleReservedRows();
  state.gpuPreviewStressRatio = Math.round((gpu.capacity / Math.max(1, gpu.width * gpu.height)) * 10000) / 10000;
  state.gpuPreviewSpatialSeeded = true;
  state.gpuPreviewSeedColumns = seedColumns;
  state.gpuPreviewSeedRows = seedRows;
  state.gpuLiveStaticDirty = true;
}

function ensureGpuPreview(state: BallPitRawState, capacity: number): boolean {
  if (state.gpuPreviewState && state.gpuPreviewState.capacity === capacity) return true;
  if (state.gpuPreviewState) {
    state.gpuPreviewRenderer?.destroy();
    state.gpuPreviewCandidateNeighbors?.destroy();
    state.gpuPreviewCollisionNeighbors?.destroy();
    state.gpuPreviewCandidateSlots?.destroy();
    state.gpuPreviewGridKey?.destroy();
    state.gpuPreviewCollision?.destroy();
    state.gpuPreviewStep?.destroy();
    state.gpuPreviewState.destroy();
    state.gpuPreviewRenderer = undefined;
    state.gpuPreviewCandidateNeighbors = undefined;
    state.gpuPreviewCollisionNeighbors = undefined;
    state.gpuPreviewCandidateSlots = undefined;
    state.gpuPreviewGridKey = undefined;
    state.gpuPreviewCollision = undefined;
    state.gpuPreviewStep = undefined;
    state.gpuPreviewState = undefined;
    state.gpuPreviewPositions = undefined;
    state.gpuPreviewVelocities = undefined;
    state.gpuPreviewAttributes = undefined;
    state.gpuPreviewCollisionNeighborData = undefined;
    state.gpuPreviewWidth = undefined;
    state.gpuPreviewHeight = undefined;
    state.gpuPreviewCycle = undefined;
    state.gpuPreviewSpatialSeeded = undefined;
    state.gpuPreviewSeedColumns = undefined;
    state.gpuPreviewSeedRows = undefined;
  }
  state.gpuPreviewState = new RawGpuConstraintParticleState(state.resources, { capacity });
  state.gpuPreviewStep = new RawGpuConstraintParticleStepPass(state.gl);
  state.gpuPreviewCollision = new RawGpuConstraintParticleCircleCollisionPass(state.gl);
  state.gpuPreviewCandidateSlots = new RawGpuConstraintParticleCandidateSlotPass(state.gl);
  state.gpuPreviewGridKey = new RawGpuConstraintParticleGridKeyPass(state.resources, state.gpuPreviewState);
  state.gpuPreviewCollisionNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: state.gpuPreviewState.width,
    height: state.gpuPreviewState.height,
    slots: 8,
  });
  state.gpuPreviewCandidateNeighbors = new RawGpuConstraintParticleNeighborSlots(state.resources, {
    width: state.gpuPreviewState.width,
    height: state.gpuPreviewState.height,
    slots: 8,
  });
  state.gpuPreviewRenderer = new RawGpuConstraintParticlePointRenderer(state.gl);
  const size = logicalSize(state);
  resetGpuPreview(state, size.width, size.height);
  return true;
}

function ensureGpuCollisionNeighborData(state: BallPitRawState): Float32Array[] | null {
  const gpu = state.gpuPreviewState;
  const neighbors = state.gpuPreviewCollisionNeighbors;
  if (!gpu || !neighbors) return null;
  const requiredLength = gpu.width * gpu.height * 4;
  const data = state.gpuPreviewCollisionNeighborData ?? [];
  while (data.length < neighbors.slotCount) data.push(new Float32Array(requiredLength));
  for (let slot = 0; slot < data.length; slot += 1) {
    if (data[slot].length !== requiredLength) data[slot] = new Float32Array(requiredLength);
  }
  state.gpuPreviewCollisionNeighborData = data;
  return data;
}

function uploadLiveCpuSpatialNeighbors(state: BallPitRawState, particleCount: number): void {
  const engine = state.engine;
  const neighbors = state.gpuPreviewCollisionNeighbors;
  const neighborData = ensureGpuCollisionNeighborData(state);
  if (!engine || !neighbors || !neighborData) {
    state.gpuLiveSpatialNeighborStats = undefined;
    state.gpuLiveSpatialNeighborUploadFloats = 0;
    state.gpuLiveSpatialNeighborDirectUploadFloats = 0;
    state.gpuLiveSpatialNeighborPaddedUploadFloats = 0;
    state.gpuLiveSpatialNeighborActiveRows = 0;
    state.gpuLiveSpatialNeighborUploadedRows = 0;
    state.gpuLiveSpatialNeighborReservedRows = 0;
    state.gpuLiveSpatialNeighborUploadSkipped = false;
    state.gpuLiveSpatialNeighborUploadSource = 'none';
    return;
  }
  const neighborStats = engine.writeCircleParticleSpatialNeighborSlots(neighborData, particleCount, 1.08);
  neighbors.uploadActiveSlots(neighborData, particleCount);
  state.gpuLiveSpatialNeighborStats = neighborStats;
  state.gpuLiveSpatialNeighborUploadFloats = neighbors.seedUploadFloats();
  state.gpuLiveSpatialNeighborDirectUploadFloats = neighbors.directUploadFloats();
  state.gpuLiveSpatialNeighborPaddedUploadFloats = neighbors.paddedUploadFloats();
  state.gpuLiveSpatialNeighborActiveRows = neighbors.activeRows();
  state.gpuLiveSpatialNeighborUploadedRows = neighbors.uploadedRows();
  state.gpuLiveSpatialNeighborReservedRows = neighbors.reservedRows();
  state.gpuLiveSpatialNeighborUploadSkipped = false;
  state.gpuLiveSpatialNeighborUploadSource = 'cpu-spatial-neighbor-slots';
}

function syncLiveGpuBallPitState(state: BallPitRawState, particleCount: number): RawGpuConstraintParticleState | null {
  const engine = state.engine;
  if (!engine) return null;
  const capacity = liveGpuCapacityForCount(particleCount, state.particleCapacity ?? MAX_PARTICLES, state.gpuPreviewState?.capacity ?? 0);
  const previousCapacity = state.gpuLiveCapacity;
  if (!ensureGpuPreview(state, capacity)) return null;
  const gpu = state.gpuPreviewState;
  if (!gpu) return null;
  if (previousCapacity !== capacity) {
    state.gpuLiveCapacity = capacity;
    state.gpuLiveUploadedParticleCount = 0;
    state.gpuLiveStaticDirty = true;
  }
  const requiredLength = gpu.width * gpu.height * 4;
  const positions = state.gpuPreviewPositions && state.gpuPreviewPositions.length === requiredLength
    ? state.gpuPreviewPositions
    : new Float32Array(requiredLength);
  const attributes = state.gpuPreviewAttributes && state.gpuPreviewAttributes.length === requiredLength
    ? state.gpuPreviewAttributes
    : new Float32Array(requiredLength);
  state.gpuPreviewPositions = positions;
  state.gpuPreviewAttributes = attributes;
  const previousUploaded = state.gpuLiveUploadedParticleCount ?? 0;
  const expectedParticles = Math.min(particleCount, engine.count, capacity);
  const dynamicUploadSkipBlocker =
    previousUploaded !== expectedParticles
      ? 'particle-count-changed'
      : state.gpuLiveStaticDirty === true
        ? 'static-state-dirty'
        : state.pointerDown === true
          ? 'pointer-active'
          : previousUploaded <= 0
            ? 'gpu-state-not-seeded'
            : 'none';
  const skipDynamicUpload = dynamicUploadSkipBlocker === 'none';
  const clearCapacity = skipDynamicUpload ? expectedParticles : Math.max(particleCount, previousUploaded);
  const packedParticles = skipDynamicUpload
    ? expectedParticles
    : engine.writeCircleParticleGpuPositions(positions, clearCapacity);
  state.gpuLiveParticleCount = packedParticles;
  state.gpuLiveDynamicUploadFloats = 0;
  state.gpuLiveDynamicUploadSkipped = skipDynamicUpload;
  state.gpuLiveDynamicUploadSkipBlocker = dynamicUploadSkipBlocker;
  state.gpuLiveStaticUploadFloats = 0;
  state.gpuLiveStaticUploadMode = 'none';
  state.gpuLiveStaticAttributeWriteCount = 0;
  resetLiveGpuStepStats(state);
  state.gpuLiveSpatialNeighborStats = undefined;
  state.gpuLiveGridKeyStats = undefined;
  state.gpuLiveCandidateSlotStats = undefined;
  state.gpuLiveSortedCandidateUploadFloats = 0;
  state.gpuLiveSortedCandidateUploadMode = 'none';
  state.gpuLiveSortedCandidateDirectUploadFloats = 0;
  state.gpuLiveSortedCandidatePaddedUploadFloats = 0;
  state.gpuLiveSortedCandidateCellRangeUploadFloats = 0;
  state.gpuLiveSpatialNeighborUploadFloats = 0;
  state.gpuLiveSpatialNeighborDirectUploadFloats = 0;
  state.gpuLiveSpatialNeighborPaddedUploadFloats = 0;
  state.gpuLiveSpatialNeighborActiveRows = 0;
  state.gpuLiveSpatialNeighborUploadedRows = 0;
  state.gpuLiveSpatialNeighborReservedRows = 0;
  state.gpuLiveSpatialNeighborUploadSkipped = false;
  state.gpuLiveSpatialNeighborUploadSource = 'none';
  state.gpuLiveDirectUploadFloats = 0;
  state.gpuLivePaddedUploadFloats = 0;
  if (!skipDynamicUpload) {
    gpu.uploadDynamicState({
      positions,
      uploadWriteTargets: false,
      particleCount: clearCapacity,
    });
    state.gpuLiveDynamicUploadFloats = gpu.dynamicUploadFloats();
  }
  state.gpuPreviewActiveRows = gpu.particleActiveRows();
  state.gpuPreviewUploadedRows = gpu.particleUploadedRows();
  state.gpuPreviewReservedRows = gpu.particleReservedRows();
  state.gpuLiveDirectUploadFloats += gpu.directUploadFloats();
  state.gpuLivePaddedUploadFloats += gpu.paddedUploadFloats();
  if (state.gpuLiveStaticDirty === true || previousUploaded !== packedParticles) {
    if (state.gpuLiveStaticDirty === true) {
      engine.writeCircleParticleGpuAttributes(attributes, clearCapacity);
      state.gpuLiveStaticAttributeWriteCount = clearCapacity;
      gpu.uploadAttributes({
        attributes,
        particleCount: clearCapacity,
      });
      state.gpuLiveStaticUploadMode = 'full';
    } else if (previousUploaded < packedParticles) {
      const rangeCount = packedParticles - previousUploaded;
      state.gpuLiveStaticAttributeWriteCount = engine.writeCircleParticleGpuAttributesRange(attributes, previousUploaded, rangeCount);
      gpu.uploadAttributeRange(attributes, previousUploaded, rangeCount);
      state.gpuLiveStaticUploadMode = 'append-range';
    } else {
      const rangeCount = previousUploaded - packedParticles;
      state.gpuLiveStaticAttributeWriteCount = engine.writeCircleParticleGpuAttributesRange(attributes, packedParticles, rangeCount);
      gpu.uploadAttributeRange(attributes, packedParticles, rangeCount);
      state.gpuLiveStaticUploadMode = 'shrink-range';
    }
    state.gpuLiveStaticUploadFloats = gpu.attributeUploadFloats();
    state.gpuLiveDirectUploadFloats += gpu.directUploadFloats();
    state.gpuLivePaddedUploadFloats += gpu.paddedUploadFloats();
    state.gpuLiveStaticDirty = false;
  }
  state.gpuLiveUploadedParticleCount = packedParticles;
  state.gpuPreviewStressRatio = Math.round((packedParticles / Math.max(1, gpu.capacity)) * 10000) / 10000;
  return gpu;
}

function runLiveGpuStepProbe(state: BallPitRawState, gpu: RawGpuConstraintParticleState, size: { width: number; height: number }, particleCount: number): boolean {
  const step = state.gpuPreviewStep;
  if (!step) return false;
  const settings = engineSettings(state, state.activeQuality ?? 'raw');
  const dt = Math.min(1 / 30, Math.max(0, state.deltaSeconds || 1 / 60));
  step.step({
    state: gpu,
    dt,
    gravityY: settings.gravity,
    damping: Math.pow(Math.max(0, Math.min(1, settings.airDragPerSecond)), Math.max(1, dt * 60)),
    speedLimit: 2200,
    bounds: {
      minX: 0,
      minY: -size.height * 2,
      maxX: size.width,
      maxY: size.height,
    },
    bounce: settings.wallBounce ? settings.wallBounceCoefficient : 0,
    particleCount,
  });
  const stepStats = step.stats();
  state.gpuLiveStepActive = stepStats.fragmentTexels > 0;
  state.gpuLiveStepSource = state.gpuLiveDynamicUploadSkipped === true ? 'persistent-gpu-step-probe' : 'cpu-seeded-gpu-step-probe';
  state.gpuLiveStepParticleCount = stepStats.activeParticleCount;
  state.gpuLiveStepActiveRows = stepStats.activeRows;
  state.gpuLiveStepFragmentTexels = stepStats.fragmentTexels;
  state.gpuLiveStepDt = dt;
  return stepStats.fragmentTexels > 0;
}

function renderLiveGpuBallPit(state: BallPitRawState, size: { width: number; height: number }, particleCount: number): boolean {
  const gpu = syncLiveGpuBallPitState(state, particleCount);
  const collision = state.gpuPreviewCollision;
  const collisionNeighbors = state.gpuPreviewCollisionNeighbors;
  const renderer = state.gpuPreviewRenderer;
  if (!gpu || !renderer) return false;
  const liveParticleCount = state.gpuLiveParticleCount ?? particleCount;
  const steppedBeforeBroadphase = state.gpuLiveDynamicUploadSkipped === true
    ? runLiveGpuStepProbe(state, gpu, size, liveParticleCount)
    : false;
  syncLiveSortedCandidateState(state, size, state.gpuLiveParticleCount ?? particleCount);
  const residentListCollisionReady =
    state.gpuLiveResidentListCandidateStats?.suitableForAuthoritativeCollision === true &&
    state.gpuLiveResidentListCandidateStats.indexOrder === 'original-index' &&
    state.gpuLiveResidentListCandidateNeighbors != null &&
    state.gpuLiveSortedCandidateTelemetrySampled === true;
  if (residentListCollisionReady) {
    state.gpuLiveSpatialNeighborStats = undefined;
    state.gpuLiveSpatialNeighborUploadFloats = 0;
    state.gpuLiveSpatialNeighborDirectUploadFloats = 0;
    state.gpuLiveSpatialNeighborPaddedUploadFloats = 0;
    state.gpuLiveSpatialNeighborActiveRows = 0;
    state.gpuLiveSpatialNeighborUploadedRows = 0;
    state.gpuLiveSpatialNeighborReservedRows = 0;
    state.gpuLiveSpatialNeighborUploadSkipped = true;
    state.gpuLiveSpatialNeighborUploadSource = 'gpu-resident-list';
  } else {
    uploadLiveCpuSpatialNeighbors(state, state.gpuLiveParticleCount ?? particleCount);
  }
  const liveNeighborSlots = residentListCollisionReady
    ? state.gpuLiveResidentListCandidateNeighbors?.framebuffers
    : collisionNeighbors?.framebuffers;
  const liveCollisionSource: BallPitGpuCollisionSource = residentListCollisionReady ? 'gpu-resident-list' : 'cpu-spatial-neighbor-slots';
  const liveCollisionSpatiallyComplete = residentListCollisionReady
    ? state.gpuLiveResidentListCandidateStats?.spatiallyComplete === true
    : state.gpuLiveSpatialNeighborStats?.spatiallyComplete ?? false;
  const liveCollisionOverflow = residentListCollisionReady
    ? 0
    : state.gpuLiveSpatialNeighborStats?.overflowCount ?? 0;
  state.gpuLiveCollisionSource = liveCollisionSource;
  state.gpuLiveCollisionAuthoritativeReady = residentListCollisionReady;
  if (collision && liveNeighborSlots) {
    collision.solve({
      state: gpu,
      neighborSlots: liveNeighborSlots,
      neighborSlotSource: liveCollisionSource,
      particleCount: liveParticleCount,
      iterations: 1,
      radiusScale: 1,
      stiffness: 0.26,
      damping: 0.01,
      spatiallyComplete: liveCollisionSpatiallyComplete,
      slotOverflowCount: liveCollisionOverflow,
    });
  }
  if (!steppedBeforeBroadphase) runLiveGpuStepProbe(state, gpu, size, liveParticleCount);
  const indexMapGatherStats = state.gpuLiveSortedCandidateIndexMapGather?.stats();
  const originalOrderGatherComplete =
    state.gpuLiveSortedCandidateIndexMapGatherActive === true &&
    indexMapGatherStats?.destinationOrder === 'original-index' &&
    indexMapGatherStats.suitableForOriginalOrderFeedback === true;
  const sortedCandidateStats = isSortedCellCandidateStats(state.gpuLiveCandidateSlotStats)
    ? state.gpuLiveCandidateSlotStats
    : undefined;
  const expectedSortedCandidateSlots =
    sortedCandidateStats?.collisionBatchedConsumableSlotCount ??
    state.gpuLiveCandidateSlotStats?.slotCount ??
    0;
  const sortedCandidateSlotsComplete =
    expectedSortedCandidateSlots > 0 &&
    (state.gpuLiveSortedCandidateCollisionConsumedSlots ?? 0) >= expectedSortedCandidateSlots &&
    (state.gpuLiveSortedCandidateCollisionIgnoredSlots ?? 0) === 0;
  const sortedCandidateSpatiallyComplete =
    state.gpuLiveCandidateSlotStats?.suitableForAuthoritativeCollision === true &&
    state.gpuLiveSortedCandidateCollisionSpatiallyComplete === true;
  const feedbackRenderBlocker =
    state.gpuLiveSortedCandidateUploadMode !== 'gpu-sorted-key-gather'
      ? 'sorted-state-still-cpu-uploaded'
      : !originalOrderGatherComplete
        ? 'original-order-gather-not-complete'
        : !sortedCandidateSlotsComplete
          ? 'candidate-slots-not-fully-consumed'
          : !sortedCandidateSpatiallyComplete
            ? 'gpu-broadphase-not-spatially-complete'
            : !state.gpuLiveSortedCandidateIndexMapGatherState
              ? 'gather-state-missing'
              : 'none';
  const feedbackRenderEligible = feedbackRenderBlocker === 'none';
  const renderState = feedbackRenderEligible ? state.gpuLiveSortedCandidateIndexMapGatherState ?? gpu : gpu;
  state.gpuLiveRenderSource = feedbackRenderEligible ? 'sorted-candidate-gathered-state' : 'cpu-live-texture-bridge';
  state.gpuLiveSortedCandidateFeedbackRenderEligible = feedbackRenderEligible;
  state.gpuLiveSortedCandidateFeedbackRenderActive = feedbackRenderEligible;
  state.gpuLiveSortedCandidateFeedbackRenderBlocker = feedbackRenderBlocker;
  renderer.render({
    state: renderState,
    width: state.width,
    height: state.height,
    worldMinX: 0,
    worldMinY: 0,
    worldMaxX: size.width,
    worldMaxY: size.height,
    palette: state.style?.palette ?? FALLBACK_PALETTE,
    opacity: 1,
    pointScale: 1,
    radiusScale: 1,
    particleCount: liveParticleCount,
  });
  const pointStats = renderer.stats();
  state.gpuLiveRendered = true;
  state.gpuLivePointDraws = pointStats.pointDraws;
  return true;
}

export class BallPitRawWebGL2Scene extends RawWebGL2Scene {
  private qualityState: { value: RenderQuality };

  constructor(previewDemo = false) {
    const qualityState = { value: 'raw' as RenderQuality };
    super({
      name: 'BallPitRawWebGL2',
      canvasSelector: 'canvas',
      markup: '<canvas class="h-full w-full touch-none bg-slate-950"></canvas>',
      maxDevicePixelRatio: 2.5,
      renderScale: () => previewDemo ? 1 : qualityProfile(qualityState.value).renderScale,
      onInit: (state) => {
        const s = state as BallPitRawState;
        const gl = s.gl;
        const size = logicalSize(s);
        const capacity = previewDemo ? PREVIEW_MAX_PARTICLES : MAX_PARTICLES;
        s.inputMode = 'single';
        s.previewDemo = previewDemo;
        s.particleCapacity = capacity;
        s.demoFloorDropped = false;
        s.activeQuality = qualityState.value;
        s.needsRedraw = true;
        s.pointerX = size.width * 0.5;
        s.pointerY = size.height * 0.15;
        s.grabbedIndex = -1;
        s.shockwaves = [];
        s.pickedBallIndices = [];
        s.engine = new AdvancedCollisionStressEngine(capacity);
        s.engine.configure(engineSettings(s, qualityState.value));
        s.engine.setBounds(size.width, size.height);
        s.particleData = new Float32Array(capacity * PARTICLE_POSITION_STRIDE);
        s.particleStyleData = new Float32Array(capacity * PARTICLE_STYLE_STRIDE);
        s.shapeData = new Float32Array(32 * SHAPE_STRIDE);
        s.paletteData = new Float32Array(PALETTE_FLOATS);
        s.particleStyleUploadedCount = 0;
        s.particleStyleUploadStart = 0;
        s.particleStyleUploadFloats = 0;
        s.particleStyleRadiusKey = undefined;
        s.particlePositionUploadFloats = 0;
        s.gpuLiveRendered = false;
        s.gpuLiveRenderSource = 'cpu-live-texture-bridge';
        s.gpuLiveCollisionSource = 'cpu-spatial-neighbor-slots';
        s.gpuLiveCollisionAuthoritativeReady = false;
        s.gpuLiveSortedCandidateFeedbackRenderEligible = false;
        s.gpuLiveSortedCandidateFeedbackRenderActive = false;
        s.gpuLiveSortedCandidateFeedbackRenderBlocker = 'not-rendered';
        s.gpuLiveParticleCount = 0;
        s.gpuLiveUploadedParticleCount = 0;
        s.gpuLiveCapacity = undefined;
        s.gpuLiveStaticDirty = true;
        s.gpuLiveDynamicUploadFloats = 0;
        s.gpuLiveStaticUploadFloats = 0;
        s.gpuLiveStaticUploadMode = 'none';
        s.gpuLiveStaticAttributeWriteCount = 0;
        resetLiveGpuStepStats(s);
        resetLiveGpuDynamicUploadSkipStats(s);
        s.gpuLiveSpatialNeighborStats = undefined;
        s.gpuLiveGridKeyStats = undefined;
        s.gpuLiveCandidateSlotStats = undefined;
        s.gpuLiveSortedCandidateParticleCount = 0;
        s.gpuLiveSortedCandidateUploadFloats = 0;
        s.gpuLiveSortedCandidateUploadMode = 'none';
        s.gpuLiveSortedCandidateSource = 'none';
        s.gpuLiveSortedCandidateRefreshReason = 'none';
        s.gpuLiveSortedCandidateDirectUploadFloats = 0;
        s.gpuLiveSortedCandidatePaddedUploadFloats = 0;
        s.gpuLiveSortedCandidateCellSize = 0;
        s.gpuLiveSortedCandidateCellColumns = 0;
        s.gpuLiveSortedCandidateCellRows = 0;
        s.gpuLiveSortedCandidateCellRangeWidth = 0;
        s.gpuLiveSortedCandidateCellRangeHeight = 0;
        s.gpuLiveSortedCandidateCellRangeUploadFloats = 0;
        s.gpuLiveSortedCandidateCellRangeSource = 'none';
        s.gpuLiveSortedCandidateOccupancyStats = undefined;
        s.gpuLiveSortedCandidateCellOffsetStats = undefined;
        s.gpuLiveSortedCandidateCellRangeStats = undefined;
        s.gpuLiveSortedCandidateCellKeyStats = undefined;
        s.gpuLiveSortedCandidateKeySortStats = undefined;
        s.gpuLiveSortedCandidateSortedKeyGatherStats = undefined;
        s.gpuLiveSortedCandidateSortedKeyRangeStats = undefined;
        s.gpuLiveSortedCandidateResidentListStats = undefined;
        s.gpuLiveResidentListCandidateStats = undefined;
        s.gpuLiveSortedCandidateIndexMapSource = 'none';
        s.gpuLiveSortedCandidateMaxCellOccupancy = 0;
        s.gpuLiveSortedCandidateResidentScanLimit = SORTED_CELL_RESIDENT_SCAN_LIMIT;
        s.gpuLiveSortedCandidateCollisionBatches = 0;
        s.gpuLiveSortedCandidateCollisionFragmentTexels = 0;
        s.gpuLiveSortedCandidateCollisionConsumedSlots = 0;
        s.gpuLiveSortedCandidateCollisionIgnoredSlots = 0;
        s.gpuLiveSortedCandidateCollisionSpatiallyComplete = false;
        s.gpuLiveSortedCandidateCollisionStressActive = false;
        s.gpuLiveSortedCandidateTelemetryLastSeconds = undefined;
        s.gpuLiveSortedCandidateTelemetryFrame = 0;
        s.gpuLiveSortedCandidateTelemetrySampled = false;
        s.gpuLiveSortedCandidateTelemetryStaleSeconds = 0;
        s.gpuLiveSortedCandidateLastParticleCount = undefined;
        s.gpuLiveSpatialNeighborUploadFloats = 0;
        s.gpuLiveSpatialNeighborDirectUploadFloats = 0;
        s.gpuLiveSpatialNeighborPaddedUploadFloats = 0;
        s.gpuLiveSpatialNeighborActiveRows = 0;
        s.gpuLiveSpatialNeighborUploadedRows = 0;
        s.gpuLiveSpatialNeighborReservedRows = 0;
        s.gpuLiveSpatialNeighborUploadSkipped = false;
        s.gpuLiveSpatialNeighborUploadSource = 'none';
        s.gpuLiveDirectUploadFloats = 0;
        s.gpuLivePaddedUploadFloats = 0;
        s.gpuLivePointDraws = 0;
        seedInitialBodies(s);

        s.shapeProgram = link(gl);
        s.particleVao = gl.createVertexArray();
        s.shapeVao = gl.createVertexArray();
        s.quadBuffer = gl.createBuffer() ?? undefined;
        s.particleBuffer = gl.createBuffer() ?? undefined;
        s.particleStyleBuffer = gl.createBuffer() ?? undefined;
        s.shapeBuffer = gl.createBuffer() ?? undefined;
        s.uResolution = gl.getUniformLocation(s.shapeProgram, 'uResolution');
        s.uPalette = gl.getUniformLocation(s.shapeProgram, 'uPalette[0]');
        s.uPaletteCount = gl.getUniformLocation(s.shapeProgram, 'uPaletteCount');

        gl.bindVertexArray(s.shapeVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.quadBuffer ?? null);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(s.particleVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.quadBuffer ?? null);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.particleBuffer ?? null);
        gl.bufferData(gl.ARRAY_BUFFER, capacity * PARTICLE_POSITION_STRIDE * 4, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, PARTICLE_POSITION_STRIDE * 4, 0);
        gl.vertexAttribDivisor(1, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.particleStyleBuffer ?? null);
        gl.bufferData(gl.ARRAY_BUFFER, capacity * PARTICLE_STYLE_STRIDE * 4, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, PARTICLE_STYLE_STRIDE * 4, 0);
        gl.vertexAttribDivisor(2, 1);

        gl.bindVertexArray(s.shapeVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.quadBuffer ?? null);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.shapeBuffer ?? null);
        gl.bufferData(gl.ARRAY_BUFFER, 32 * SHAPE_STRIDE * 4, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, SHAPE_STRIDE * 4, 0);
        gl.vertexAttribDivisor(1, 1);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, SHAPE_STRIDE * 4, 2 * 4);
        gl.vertexAttribDivisor(2, 1);
        gl.bindVertexArray(null);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        installPointer(s);
      },
      onReset: (state) => {
        const s = state as BallPitRawState;
        s.demoFloorDropped = false;
        seedInitialBodies(s);
        s.particleStyleUploadedCount = 0;
        s.particleStyleUploadStart = 0;
        s.particleStyleUploadFloats = 0;
        s.particleStyleRadiusKey = undefined;
        s.particlePositionUploadFloats = 0;
        s.gpuLiveRendered = false;
        s.gpuLiveRenderSource = 'cpu-live-texture-bridge';
        s.gpuLiveCollisionSource = 'cpu-spatial-neighbor-slots';
        s.gpuLiveCollisionAuthoritativeReady = false;
        s.gpuLiveSortedCandidateFeedbackRenderEligible = false;
        s.gpuLiveSortedCandidateFeedbackRenderActive = false;
        s.gpuLiveSortedCandidateFeedbackRenderBlocker = 'not-rendered';
        s.gpuLiveParticleCount = 0;
        s.gpuLiveUploadedParticleCount = 0;
        s.gpuLiveStaticDirty = true;
        s.gpuLiveDynamicUploadFloats = 0;
        s.gpuLiveStaticUploadFloats = 0;
        s.gpuLiveStaticAttributeWriteCount = 0;
        resetLiveGpuStepStats(s);
        resetLiveGpuDynamicUploadSkipStats(s);
        s.gpuLiveDirectUploadFloats = 0;
        s.gpuLivePaddedUploadFloats = 0;
        s.gpuLivePointDraws = 0;
        s.gpuLiveGridKeyStats = undefined;
        s.gpuLiveCandidateSlotStats = undefined;
        s.gpuLiveSortedCandidateParticleCount = 0;
        s.gpuLiveSortedCandidateUploadFloats = 0;
        s.gpuLiveSortedCandidateUploadMode = 'none';
        s.gpuLiveSortedCandidateSource = 'none';
        s.gpuLiveSortedCandidateRefreshReason = 'none';
        s.gpuLiveSortedCandidateDirectUploadFloats = 0;
        s.gpuLiveSortedCandidatePaddedUploadFloats = 0;
        s.gpuLiveSortedCandidateCellSize = 0;
        s.gpuLiveSortedCandidateCellColumns = 0;
        s.gpuLiveSortedCandidateCellRows = 0;
        s.gpuLiveSortedCandidateCellRangeWidth = 0;
        s.gpuLiveSortedCandidateCellRangeHeight = 0;
        s.gpuLiveSortedCandidateCellRangeUploadFloats = 0;
        s.gpuLiveSortedCandidateCellRangeSource = 'none';
        s.gpuLiveSortedCandidateOccupancyStats = undefined;
        s.gpuLiveSortedCandidateCellOffsetStats = undefined;
        s.gpuLiveSortedCandidateCellRangeStats = undefined;
        s.gpuLiveSortedCandidateCellKeyStats = undefined;
        s.gpuLiveSortedCandidateKeySortStats = undefined;
        s.gpuLiveSortedCandidateSortedKeyGatherStats = undefined;
        s.gpuLiveSortedCandidateSortedKeyRangeStats = undefined;
        s.gpuLiveSortedCandidateResidentListStats = undefined;
        s.gpuLiveResidentListCandidateStats = undefined;
        s.gpuLiveSortedCandidateIndexMapSource = 'none';
        s.gpuLiveSortedCandidateMaxCellOccupancy = 0;
        s.gpuLiveSortedCandidateResidentScanLimit = SORTED_CELL_RESIDENT_SCAN_LIMIT;
        s.gpuLiveSortedCandidateCollisionBatches = 0;
        s.gpuLiveSortedCandidateCollisionFragmentTexels = 0;
        s.gpuLiveSortedCandidateCollisionConsumedSlots = 0;
        s.gpuLiveSortedCandidateCollisionIgnoredSlots = 0;
        s.gpuLiveSortedCandidateCollisionSpatiallyComplete = false;
        s.gpuLiveSortedCandidateCollisionStressActive = false;
        s.gpuLiveSortedCandidateTelemetryLastSeconds = undefined;
        s.gpuLiveSortedCandidateTelemetrySampled = false;
        s.gpuLiveSortedCandidateTelemetryStaleSeconds = 0;
        s.gpuLiveSortedCandidateLastParticleCount = undefined;
        if (s.gpuPreviewState) resetGpuPreview(s, logicalSize(s).width, logicalSize(s).height);
        s.needsRedraw = true;
      },
      onSettingsChange: (state) => {
        const s = state as BallPitRawState;
        s.needsRedraw = true;
        s.gpuLiveStaticDirty = true;
        s.engine?.wake();
      },
      onStyleChange: (state) => {
        const s = state as BallPitRawState;
        s.needsRedraw = true;
      },
      onModeChange: (state, mode) => {
        const s = state as BallPitRawState;
        if (mode === 'single' || mode === 'stream' || mode === 'interact' || mode === 'explosion') s.inputMode = mode;
        s.pointerDown = false;
        s.grabbedIndex = -1;
        s.pickedBallIndices = [];
        s.needsRedraw = true;
      },
      shouldRender: (state) => ballPitShouldRender(state as BallPitRawState),
      render: (state) => {
        const s = state as BallPitRawState;
        const gl = s.gl;
        const engine = s.engine;
        if (!engine) return;
        const profile = qualityProfile(qualityState.value);
        const size = logicalSize(s);
        const floorDropped = demoFloorIsDropped(s);
        s.demoFloorDropped = floorDropped;
        const floorHeight = floorDropped ? size.height + Math.max(180, size.height * 1.4) : size.height;
        const nextEngineSettings = engineSettings(s, qualityState.value);
        const nextStyleRadiusKey = Math.round(nextEngineSettings.radius * 10000) / 10000;
        if (s.particleStyleRadiusKey !== undefined && s.particleStyleRadiusKey !== nextStyleRadiusKey) {
          s.particleStyleUploadedCount = 0;
          s.particleStyleUploadStart = 0;
        }
        s.particleStyleRadiusKey = nextStyleRadiusKey;
        engine.configure(nextEngineSettings);
        engine.setBounds(size.width, floorHeight);

        const autoSpawn = s.mode === 'demo' || s.previewDemo === true;
        if (autoSpawn && !s.pointerDown) {
          s.pointerX = size.width * 0.5 + Math.sin(s.timeSeconds * 1.1) * size.width * 0.25;
          const radius = engineSettings(s, qualityState.value).radius;
          s.pointerY = -Math.max(radius * 5, 18) + Math.sin(s.timeSeconds * 1.7) * radius;
        }
        if (((s.inputMode === 'stream' && s.pointerDown) || autoSpawn) && !floorDropped) {
          const spawnRate = s.previewDemo === true ? 14 : numberSetting(s.settings, 'spawnRate', 1200) * profile.spawnRateScale;
          engine.spawnRate(spawnRate, s.deltaSeconds, s.pointerX ?? size.width * 0.5, s.pointerY ?? size.height * 0.15);
        }
        if (s.inputMode === 'interact' && s.pointerDown && s.pointerX != null && s.pointerY != null) {
          applyPickedBallForces(s, s.pointerX, s.pointerY);
        }
        s.stats = engine.step(s.deltaSeconds);
        if (s.mode === 'demo' || s.previewDemo === true) {
          pruneEscapedDemoBalls(s, size.height);
        }

        gl.viewport(0, 0, s.width, s.height);
        gl.clearColor(0.025, 0.032, 0.075, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        s.gpuLiveRendered = false;
        s.gpuLiveRenderSource = 'cpu-live-texture-bridge';
        s.gpuLiveCollisionSource = 'cpu-spatial-neighbor-slots';
        s.gpuLiveCollisionAuthoritativeReady = false;
        s.gpuLiveSortedCandidateFeedbackRenderEligible = false;
        s.gpuLiveSortedCandidateFeedbackRenderActive = false;
        s.gpuLiveSortedCandidateFeedbackRenderBlocker = 'not-rendered';
        s.gpuLivePointDraws = 0;
        s.gpuLiveDynamicUploadFloats = 0;
        s.gpuLiveStaticUploadFloats = 0;
        s.gpuLiveStaticAttributeWriteCount = 0;
        resetLiveGpuStepStats(s);
        resetLiveGpuDynamicUploadSkipStats(s);
        s.gpuLiveDirectUploadFloats = 0;
        s.gpuLivePaddedUploadFloats = 0;
        if (!s.shapeProgram || !s.particleVao || !s.shapeVao || !s.particleBuffer || !s.particleStyleBuffer || !s.shapeBuffer || !s.uResolution || !s.uPalette || !s.uPaletteCount || !s.particleData || !s.particleStyleData || !s.shapeData) return;

        gl.useProgram(s.shapeProgram);
        gl.bindVertexArray(s.shapeVao);
        gl.uniform2f(s.uResolution, size.width, size.height);

        const paletteData = s.paletteData ?? (s.paletteData = new Float32Array(PALETTE_FLOATS));
        const paletteCount = writePalette(paletteData, s.style?.palette ?? FALLBACK_PALETTE);
        gl.uniform3fv(s.uPalette, paletteData);
        gl.uniform1i(s.uPaletteCount, paletteCount);

        if (s.inputMode === 'interact' && s.pointerDown && s.pointerX != null && s.pointerY != null) {
          const radius = interactionRadius(s);
          s.shapeData[0] = s.pointerX;
          s.shapeData[1] = s.pointerY;
          s.shapeData[2] = radius;
          s.shapeData[3] = 0;
          s.shapeData[4] = 4;
          s.shapeData[5] = 0;
          gl.bindBuffer(gl.ARRAY_BUFFER, s.shapeBuffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.shapeData, 0, SHAPE_STRIDE);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
        }

        let shapeCount = 0;
        const particleCount = engine.count;
        s.particlePositionUploadFloats = 0;
        if (particleCount > 0) {
          const useLiveGpuRender = false;
          if (!useLiveGpuRender || !renderLiveGpuBallPit(s, size, particleCount)) {
            const writtenParticleCount = engine.writeCircleParticlePositions(s.particleData, PARTICLE_POSITION_STRIDE);
            s.particlePositionUploadFloats = writtenParticleCount * PARTICLE_POSITION_STRIDE;
            gl.bindVertexArray(s.particleVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, s.particleBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.particleData, 0, writtenParticleCount * PARTICLE_POSITION_STRIDE);
            const uploadedStyleCount = s.particleStyleUploadedCount ?? 0;
            if (uploadedStyleCount !== writtenParticleCount) {
              const styleUploadStart = uploadedStyleCount < writtenParticleCount ? uploadedStyleCount : 0;
              const styleUploadCount = writtenParticleCount - styleUploadStart;
              const writtenStyles = engine.writeCircleParticleStylesRange(s.particleStyleData, PARTICLE_STYLE_STRIDE, styleUploadStart, styleUploadCount);
              gl.bindBuffer(gl.ARRAY_BUFFER, s.particleStyleBuffer);
              gl.bufferSubData(gl.ARRAY_BUFFER, styleUploadStart * PARTICLE_STYLE_STRIDE * 4, s.particleStyleData, styleUploadStart * PARTICLE_STYLE_STRIDE, writtenStyles * PARTICLE_STYLE_STRIDE);
              s.particleStyleUploadedCount = styleUploadStart + writtenStyles;
              s.particleStyleUploadStart = styleUploadStart;
              s.particleStyleUploadFloats = writtenStyles * PARTICLE_STYLE_STRIDE;
            } else {
              s.particleStyleUploadStart = writtenParticleCount;
              s.particleStyleUploadFloats = 0;
            }
            gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, writtenParticleCount);
            gl.bindVertexArray(s.shapeVao);
          } else {
            gl.useProgram(s.shapeProgram);
            gl.bindVertexArray(s.shapeVao);
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.uniform2f(s.uResolution, size.width, size.height);
            gl.uniform3fv(s.uPalette, paletteData);
            gl.uniform1i(s.uPaletteCount, paletteCount);
          }
        }
        const shockwaves = s.shockwaves ?? [];
        for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
          const wave = shockwaves[i];
          wave.age += s.deltaSeconds;
          if (wave.age >= 0.6) {
            shockwaves.splice(i, 1);
            continue;
          }
          const life = 1 - wave.age / 0.6;
          const radius = 24 + wave.age * 680;
          const offset = shapeCount * SHAPE_STRIDE;
          if (offset + SHAPE_STRIDE > s.shapeData.length) break;
          s.shapeData[offset] = wave.x;
          s.shapeData[offset + 1] = wave.y;
          s.shapeData[offset + 2] = radius;
          s.shapeData[offset + 3] = Math.max(3, 12 * life);
          s.shapeData[offset + 4] = 3;
          s.shapeData[offset + 5] = life;
          shapeCount += 1;
        }

        if (shapeCount > 0) {
          gl.bindBuffer(gl.ARRAY_BUFFER, s.shapeBuffer);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, s.shapeData, 0, shapeCount * SHAPE_STRIDE);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, shapeCount);
        }
        gl.bindVertexArray(null);
        s.needsRedraw = false;
      },
      getDebugStats: (state) => {
        const s = state as BallPitRawState;
        const stats = s.stats;
        if ((s.previewDemo === true || s.mode === 'demo') && s.gpuPreviewState) {
          const pointStats = s.gpuPreviewRenderer?.stats();
          const collisionStats = s.gpuPreviewCollision?.stats();
          const gridKeyStats = s.gpuLiveGridKeyStats;
          const candidateStats = s.gpuLiveCandidateSlotStats;
          return scalarDebugStats({
            renderer: s.previewDemo === true ? 'raw-webgl2-ballpit-gpu-preview' : 'raw-webgl2-ballpit-gpu-demo',
            ...rawGpuMetricsToDebugStats(s.gpuPreviewState.metrics({
              engine: s.previewDemo === true ? 'raw-gpu-ballpit-preview' : 'raw-gpu-ballpit-demo',
              passesPerFrame: 1 + (collisionStats?.iterations ?? 0),
            })),
            particles: s.gpuPreviewState.capacity,
            capacity: s.gpuPreviewState.capacity,
            seedUploadFloats: s.gpuPreviewState.seedUploadFloats(),
            activeParticleRows: s.gpuPreviewActiveRows ?? s.gpuPreviewState.height,
            uploadedParticleRows: s.gpuPreviewUploadedRows ?? s.gpuPreviewState.height,
            reservedParticleRows: s.gpuPreviewReservedRows ?? s.gpuPreviewState.height,
            activeParticleCapacityRatio: s.gpuPreviewStressRatio ?? 1,
            gpuPreviewSpatialSeeded: s.gpuPreviewSpatialSeeded === true,
            gpuPreviewSeedColumns: s.gpuPreviewSeedColumns ?? 0,
            gpuPreviewSeedRows: s.gpuPreviewSeedRows ?? 0,
            gpuPointDraws: pointStats?.pointDraws ?? 0,
            gpuCollisionActive: (collisionStats?.fragmentTexels ?? 0) > 0,
            gpuCollisionAuthoritativeReady: false,
            gpuCollisionSpatiallyComplete: collisionStats?.spatiallyComplete ?? false,
            gpuCollisionBroadphase: collisionStats?.broadphase ?? 'texture-adjacency',
            gpuCollisionBroadphaseOwner: collisionStats?.broadphaseOwner ?? 'texture-layout',
            gpuCollisionIterations: collisionStats?.iterations ?? 0,
            gpuCollisionNeighborSamples: collisionStats?.neighborSamples ?? 0,
            gpuCollisionFragmentTexels: collisionStats?.fragmentTexels ?? 0,
            gpuGridKeyActive: (gridKeyStats?.fragmentTexels ?? 0) > 0,
            gpuGridKeyParticleCount: gridKeyStats?.activeParticleCount ?? 0,
            gpuGridKeyRows: gridKeyStats?.activeRows ?? 0,
            gpuGridKeyFragmentTexels: gridKeyStats?.fragmentTexels ?? 0,
            gpuGridKeyColumns: gridKeyStats?.gridColumns ?? 0,
            gpuGridKeyCellRows: gridKeyStats?.gridRows ?? 0,
            gpuGridKeyCellSize: gridKeyStats?.cellSize ?? 0,
            gpuCandidateSlotsActive: (candidateStats?.fragmentTexels ?? 0) > 0,
            gpuCandidateSlotCount: candidateStats?.slotCount ?? 0,
            gpuCandidateSamples: candidateStats?.candidateSamples ?? 0,
            gpuCandidateFragmentTexels: candidateStats?.fragmentTexels ?? 0,
            gpuCandidateBroadphase: candidateStats?.broadphase ?? 'gpu-grid-key-window',
            gpuCandidateBroadphaseOwner: candidateStats?.broadphaseOwner ?? 'gpu',
            gpuCandidateSpatiallyComplete: candidateStats?.spatiallyComplete ?? false,
            gpuCollisionStatus: 'non-authoritative-preview-stress-pass',
            gpuCandidateCoverage: candidateStats?.coverage ?? 'texture-window',
            gpuCandidateLimitation: candidateStats?.limitation ?? 'samples-adjacent-texture-neighbors-only',
            gpuCandidateRequiredReplacement: candidateStats?.requiredReplacement ?? 'gpu-spatial-bin-scatter-or-sort',
            gpuCandidateSuitableForAuthoritativeCollision: candidateStats?.suitableForAuthoritativeCollision ?? false,
            fullCapacityStressCloud: true,
          });
        }
        if (!stats) return null;
        const liveCollisionStats = s.gpuPreviewCollision?.stats();
        const liveSpatialNeighborStats = s.gpuLiveSpatialNeighborStats;
        const liveGridKeyStats = s.gpuLiveGridKeyStats;
        const liveCandidateStats = s.gpuLiveCandidateSlotStats;
        const liveOccupancyStats = s.gpuLiveSortedCandidateOccupancyStats;
        const liveCellOffsetStats = s.gpuLiveSortedCandidateCellOffsetStats;
        const liveCellRangeStats = s.gpuLiveSortedCandidateCellRangeStats;
        const liveCellRangeBridgeStats = s.gpuLiveSortedCandidateCellRangeBridge?.stats();
        const liveCellKeyStats = s.gpuLiveSortedCandidateCellKeyStats;
        const liveKeySortStats = s.gpuLiveSortedCandidateKeySortStats;
        const liveSortedKeyGatherStats = s.gpuLiveSortedCandidateSortedKeyGatherStats;
        const liveSortedKeyRangeStats = s.gpuLiveSortedCandidateSortedKeyRangeStats;
        const liveResidentListStats = s.gpuLiveSortedCandidateResidentListStats;
        const liveResidentListCandidateStats = s.gpuLiveResidentListCandidateStats;
        const liveIndexMapStats = s.gpuLiveSortedCandidateIndexMapBridge?.stats();
        const liveIndexMapGatherStats = s.gpuLiveSortedCandidateIndexMapGather?.stats();
        const liveCpuSpatialSlotWrites = liveSpatialNeighborStats?.slotWrites ?? 0;
        const liveCpuSpatialCandidatePairs = liveSpatialNeighborStats?.candidatePairs ?? 0;
        const liveGpuCandidateCapacity = (liveCandidateStats?.activeParticleCount ?? 0) * (liveCandidateStats?.slotCount ?? 0);
        const liveGpuCandidateVsCpuSlotCapacityRatio = liveCpuSpatialSlotWrites > 0
          ? Math.round((liveGpuCandidateCapacity / liveCpuSpatialSlotWrites) * 10000) / 10000
          : liveGpuCandidateCapacity > 0 ? 1 : 0;
        const liveGpuCandidateVsCpuPairCapacityRatio = liveCpuSpatialCandidatePairs > 0
          ? Math.round((liveGpuCandidateCapacity / liveCpuSpatialCandidatePairs) * 10000) / 10000
          : liveGpuCandidateCapacity > 0 ? 1 : 0;
        const liveGpuCandidateFragmentToCpuUploadRatio = (s.gpuLiveSpatialNeighborUploadFloats ?? 0) > 0
          ? Math.round(((liveCandidateStats?.fragmentTexels ?? 0) / (s.gpuLiveSpatialNeighborUploadFloats ?? 1)) * 10000) / 10000
          : 0;
        const sortedCellCandidateStats = isSortedCellCandidateStats(liveCandidateStats) ? liveCandidateStats : undefined;
        const liveGpuCandidateCollisionSlotCount = liveCandidateStats?.slotCount ?? 0;
        const liveGpuCandidateCollisionPassSlotLimit = sortedCellCandidateStats?.collisionPassSlotLimit ?? 8;
        const liveGpuCandidateCollisionConsumableSlotCount = sortedCellCandidateStats?.collisionConsumableSlotCount ?? Math.min(liveGpuCandidateCollisionPassSlotLimit, liveGpuCandidateCollisionSlotCount);
        const liveGpuCandidateCollisionRequiresBatchedSolve = sortedCellCandidateStats?.collisionRequiresBatchedSolve ?? liveGpuCandidateCollisionSlotCount > liveGpuCandidateCollisionPassSlotLimit;
        const liveGpuCandidateCollisionRequiredBatches = sortedCellCandidateStats?.collisionRequiredBatches ?? (
          liveGpuCandidateCollisionSlotCount > 0 ? Math.ceil(liveGpuCandidateCollisionSlotCount / liveGpuCandidateCollisionPassSlotLimit) : 0
        );
        const liveGpuCandidateCollisionBatchedConsumableSlotCount = sortedCellCandidateStats?.collisionBatchedConsumableSlotCount ?? liveGpuCandidateCollisionSlotCount;
        const liveGpuSortedCandidateCollisionConsumedSlots = s.gpuLiveSortedCandidateCollisionConsumedSlots ?? 0;
        const liveGpuSortedCandidateCollisionExpectedSlots = liveGpuCandidateCollisionBatchedConsumableSlotCount;
        const liveGpuSortedCandidateCollisionConsumptionRatio = liveGpuSortedCandidateCollisionExpectedSlots > 0
          ? Math.round((liveGpuSortedCandidateCollisionConsumedSlots / liveGpuSortedCandidateCollisionExpectedSlots) * 10000) / 10000
          : 0;
        const liveGpuSortedCandidateCollisionBatches = s.gpuLiveSortedCandidateCollisionBatches ?? 0;
        const liveGpuSortedCandidateCollisionBatchesComplete = liveGpuCandidateCollisionRequiredBatches > 0
          ? liveGpuSortedCandidateCollisionBatches >= liveGpuCandidateCollisionRequiredBatches
          : liveGpuSortedCandidateCollisionBatches === 0;
        const liveGpuSortedCandidateCollisionAllSlotsConsumed = liveGpuSortedCandidateCollisionExpectedSlots > 0 && liveGpuSortedCandidateCollisionConsumedSlots >= liveGpuSortedCandidateCollisionExpectedSlots;
        const liveGpuSortedCandidateGatherBackComplete =
          s.gpuLiveSortedCandidateIndexMapGatherActive === true &&
          liveIndexMapGatherStats?.destinationOrder === 'original-index' &&
          liveIndexMapGatherStats.suitableForOriginalOrderFeedback === true;
        const liveGpuSortedCandidateAuthoritativeReady =
          liveGpuSortedCandidateGatherBackComplete &&
          liveGpuSortedCandidateCollisionAllSlotsConsumed &&
          s.gpuLiveSortedCandidateCollisionSpatiallyComplete === true &&
          s.gpuLiveSortedCandidateUploadMode === 'gpu-sorted-key-gather';
        const liveGpuSortedCandidateAuthoritativeBlocker = liveGpuSortedCandidateAuthoritativeReady
          ? 'none'
          : s.gpuLiveSortedCandidateUploadMode !== 'gpu-sorted-key-gather'
            ? 'sorted-state-still-cpu-uploaded'
            : liveGpuSortedCandidateGatherBackComplete !== true
              ? 'original-order-gather-not-complete'
              : liveGpuSortedCandidateCollisionAllSlotsConsumed !== true
                ? 'candidate-slots-not-fully-consumed'
                : s.gpuLiveSortedCandidateCollisionSpatiallyComplete !== true
                  ? 'gpu-broadphase-not-spatially-complete'
                  : 'unknown';
        const liveGpuDynamicCpuUploadEliminated = s.gpuLiveRendered === true && s.gpuLiveDynamicUploadSkipped === true;
        const liveGpuSortedCandidateCpuUploadFloats = s.gpuLiveSortedCandidateUploadMode === 'cpu-sorted-copy'
          ? s.gpuLiveSortedCandidateUploadFloats ?? 0
          : 0;
        const liveGpuRemainingCpuBridgeUploadFloats =
          (s.gpuLiveDynamicUploadFloats ?? 0) +
          (s.gpuLiveStaticUploadFloats ?? 0) +
          (s.gpuLiveSpatialNeighborUploadSkipped === true ? 0 : s.gpuLiveSpatialNeighborUploadFloats ?? 0) +
          liveGpuSortedCandidateCpuUploadFloats +
          (s.gpuLiveSortedCandidateCellRangeUploadFloats ?? 0) +
          (s.gpuLiveSortedCandidateIndexMapUploadFloats ?? 0);
        const liveGpuRecurringCpuBridgeUploadFloats =
          (s.gpuLiveDynamicUploadFloats ?? 0) +
          (s.gpuLiveSpatialNeighborUploadSkipped === true ? 0 : s.gpuLiveSpatialNeighborUploadFloats ?? 0) +
          liveGpuSortedCandidateCpuUploadFloats +
          (s.gpuLiveSortedCandidateCellRangeUploadFloats ?? 0) +
          (s.gpuLiveSortedCandidateIndexMapUploadFloats ?? 0);
        const liveGpuSeedCpuBridgeUploadFloats = s.gpuLiveStaticUploadFloats ?? 0;
        const liveGpuRemainingCpuBridgeBlocker = s.gpuLiveRendered !== true
          ? 'gpu-live-render-inactive'
          : s.gpuLiveDynamicUploadSkipped !== true
            ? `dynamic-upload:${s.gpuLiveDynamicUploadSkipBlocker ?? 'unknown'}`
            : s.gpuLiveSpatialNeighborUploadSkipped !== true
              ? 'cpu-spatial-neighbor-slots'
              : s.gpuLiveSortedCandidateUploadMode !== 'gpu-sorted-key-gather'
                ? 'cpu-sorted-candidate-copy'
                : (s.gpuLiveSortedCandidateCellRangeUploadFloats ?? 0) > 0
                  ? 'cpu-cell-range-bridge'
                  : (s.gpuLiveSortedCandidateIndexMapUploadFloats ?? 0) > 0
                    ? 'cpu-index-map-bridge'
                    : liveGpuSortedCandidateAuthoritativeReady !== true
                      ? liveGpuSortedCandidateAuthoritativeBlocker
                      : 'none';
        return scalarDebugStats({
          renderer: s.gpuLiveRendered === true ? 'raw-webgl2-ballpit-gpu-live-points' : 'raw-webgl2-ballpit-instanced',
          simulation: 'cpu-circle-collision-particles',
          rendering: s.gpuLiveRendered === true ? 'gpu-texture-point-circles-live' : 'gpu-instanced-circle-geometry',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: true,
          cpuUploadKind: s.gpuLiveRendered === true
            ? liveGpuDynamicCpuUploadEliminated
              ? 'gpu-live-state-resident-with-cpu-bridge'
              : 'cpu-seeded-gpu-live-bridge'
            : 'cpu-instanced-render-upload',
          liveGpuDynamicCpuUploadEliminated,
          liveGpuRemainingCpuBridgeUploadFloats,
          liveGpuRecurringCpuBridgeUploadFloats,
          liveGpuSeedCpuBridgeUploadFloats,
          liveGpuRemainingCpuBridgeBlocker,
          particles: stats.particleCount,
          dynamicParticles: stats.dynamicParticleCount,
          links: stats.linkCount,
          capsules: stats.capsuleCount,
          boxes: stats.boxCount,
          contacts: stats.contacts,
          pairs: stats.pairs,
          gridCellSize: Math.round(stats.gridCellSize * 100) / 100,
          awake: stats.awake,
          settledFrames: stats.settledFrames,
          maxVelocity: Math.round(stats.maxVelocity * 100) / 100,
          capacity: s.particleCapacity ?? null,
          gpuUploadFloats: s.gpuLiveRendered === true
            ? (s.gpuLiveDynamicUploadFloats ?? 0) + (s.gpuLiveStaticUploadFloats ?? 0) + (s.gpuLiveSpatialNeighborUploadFloats ?? 0) + (s.shockwaves?.length ?? 0) * SHAPE_STRIDE
            : (s.particlePositionUploadFloats ?? stats.particleCount * PARTICLE_POSITION_STRIDE) + (s.particleStyleUploadFloats ?? 0) + (s.shockwaves?.length ?? 0) * SHAPE_STRIDE,
          particlePositionUploadFloats: s.particlePositionUploadFloats ?? 0,
          particleStyleUploadStart: s.particleStyleUploadStart ?? 0,
          particleStyleUploadFloats: s.particleStyleUploadFloats ?? 0,
          particleStyleRadiusKey: s.particleStyleRadiusKey ?? null,
          liveGpuRendered: s.gpuLiveRendered === true,
          liveGpuRenderSource: s.gpuLiveRenderSource ?? 'cpu-live-texture-bridge',
          liveGpuSortedCandidateFeedbackRenderEligible: s.gpuLiveSortedCandidateFeedbackRenderEligible === true,
          liveGpuSortedCandidateFeedbackRenderActive: s.gpuLiveSortedCandidateFeedbackRenderActive === true,
          liveGpuSortedCandidateFeedbackRenderBlocker: s.gpuLiveSortedCandidateFeedbackRenderBlocker ?? 'not-rendered',
          liveGpuParticleCount: s.gpuLiveParticleCount ?? 0,
          liveGpuCapacity: s.gpuPreviewState?.capacity ?? 0,
          liveGpuCapacityHeadroom: Math.max(0, (s.gpuPreviewState?.capacity ?? 0) - (s.gpuLiveParticleCount ?? 0)),
          liveGpuActiveRows: s.gpuPreviewActiveRows ?? 0,
          liveGpuUploadedRows: s.gpuPreviewUploadedRows ?? 0,
          liveGpuReservedRows: s.gpuPreviewReservedRows ?? 0,
          liveGpuDynamicUploadFloats: s.gpuLiveDynamicUploadFloats ?? 0,
          liveGpuDynamicUploadSkipped: s.gpuLiveDynamicUploadSkipped === true,
          liveGpuDynamicUploadSkipBlocker: s.gpuLiveDynamicUploadSkipBlocker ?? 'none',
          liveGpuStaticUploadFloats: s.gpuLiveStaticUploadFloats ?? 0,
          liveGpuStaticUploadMode: s.gpuLiveStaticUploadMode ?? 'none',
          liveGpuStaticAttributeWriteCount: s.gpuLiveStaticAttributeWriteCount ?? 0,
          liveGpuStepActive: s.gpuLiveStepActive === true,
          liveGpuStepSource: s.gpuLiveStepSource ?? 'none',
          liveGpuStepParticleCount: s.gpuLiveStepParticleCount ?? 0,
          liveGpuStepActiveRows: s.gpuLiveStepActiveRows ?? 0,
          liveGpuStepFragmentTexels: s.gpuLiveStepFragmentTexels ?? 0,
          liveGpuStepDt: Math.round((s.gpuLiveStepDt ?? 0) * 10000) / 10000,
          liveGpuStepAuthoritativeReady: false,
          liveGpuStepStatus: s.gpuLiveStepActive === true
            ? s.gpuLiveStepSource === 'persistent-gpu-step-probe'
              ? 'persistent-gpu-position-velocity-probe'
              : 'cpu-seeded-gpu-position-velocity-probe'
            : 'inactive',
          liveGpuSpatialNeighborUploadFloats: s.gpuLiveSpatialNeighborUploadFloats ?? 0,
          liveGpuSpatialNeighborDirectUploadFloats: s.gpuLiveSpatialNeighborDirectUploadFloats ?? 0,
          liveGpuSpatialNeighborPaddedUploadFloats: s.gpuLiveSpatialNeighborPaddedUploadFloats ?? 0,
          liveGpuSpatialNeighborActiveRows: s.gpuLiveSpatialNeighborActiveRows ?? 0,
          liveGpuSpatialNeighborUploadedRows: s.gpuLiveSpatialNeighborUploadedRows ?? 0,
          liveGpuSpatialNeighborReservedRows: s.gpuLiveSpatialNeighborReservedRows ?? 0,
          liveGpuSpatialNeighborUploadSkipped: s.gpuLiveSpatialNeighborUploadSkipped === true,
          liveGpuSpatialNeighborUploadSource: s.gpuLiveSpatialNeighborUploadSource ?? 'none',
          liveGpuSpatialNeighborSlotWrites: liveSpatialNeighborStats?.slotWrites ?? 0,
          liveGpuSpatialNeighborStagingClearFloats: liveSpatialNeighborStats?.stagingClearFloats ?? 0,
          liveGpuSpatialNeighborStagingWriteFloats: liveSpatialNeighborStats?.stagingWriteFloats ?? 0,
          liveGpuSpatialNeighborCandidatePairs: liveSpatialNeighborStats?.candidatePairs ?? 0,
          liveGpuSpatialNeighborOverflowCount: liveSpatialNeighborStats?.overflowCount ?? 0,
          liveGpuSpatialNeighborCellSize: liveSpatialNeighborStats?.cellSize ?? 0,
          liveGpuSortedCandidateActive: (s.gpuLiveSortedCandidateParticleCount ?? 0) > 0,
          liveGpuSortedCandidateParticleCount: s.gpuLiveSortedCandidateParticleCount ?? 0,
          liveGpuSortedCandidateCapacity: s.gpuLiveSortedCandidateState?.capacity ?? 0,
          liveGpuSortedCandidateActiveRows: s.gpuLiveSortedCandidateState?.width
            ? Math.ceil((s.gpuLiveSortedCandidateParticleCount ?? 0) / s.gpuLiveSortedCandidateState.width)
            : 0,
          liveGpuSortedCandidateUploadedRows: s.gpuLiveSortedCandidateState?.width
            ? Math.ceil((s.gpuLiveSortedCandidateParticleCount ?? 0) / s.gpuLiveSortedCandidateState.width)
            : 0,
          liveGpuSortedCandidateReservedRows: s.gpuLiveSortedCandidateState?.height ?? 0,
          liveGpuSortedCandidateActiveCapacityRatio: (s.gpuLiveSortedCandidateState?.capacity ?? 0) > 0
            ? Math.round(
                ((s.gpuLiveSortedCandidateParticleCount ?? 0) /
                  Math.max(1, s.gpuLiveSortedCandidateState?.capacity ?? 1)) *
                  10000,
              ) / 10000
            : 0,
          liveGpuSortedCandidateUploadFloats: s.gpuLiveSortedCandidateUploadFloats ?? 0,
          liveGpuSortedCandidateDirectUploadFloats: s.gpuLiveSortedCandidateDirectUploadFloats ?? 0,
          liveGpuSortedCandidatePaddedUploadFloats: s.gpuLiveSortedCandidatePaddedUploadFloats ?? 0,
          liveGpuSortedCandidateCellSize: s.gpuLiveSortedCandidateCellSize ?? 0,
          liveGpuSortedCandidateCellColumns: s.gpuLiveSortedCandidateCellColumns ?? 0,
          liveGpuSortedCandidateCellRows: s.gpuLiveSortedCandidateCellRows ?? 0,
          liveGpuSortedCandidateCellRangeWidth: s.gpuLiveSortedCandidateCellRangeWidth ?? 0,
          liveGpuSortedCandidateCellRangeHeight: s.gpuLiveSortedCandidateCellRangeHeight ?? 0,
          liveGpuSortedCandidateCellRangeUploadFloats: s.gpuLiveSortedCandidateCellRangeUploadFloats ?? 0,
          liveGpuSortedCandidateCellRangeSource: s.gpuLiveSortedCandidateCellRangeSource ?? 'none',
          liveGpuSortedCandidateCellRangeBridgeActiveRows: liveCellRangeBridgeStats?.activeRows ?? 0,
          liveGpuSortedCandidateCellRangeBridgeUploadedRows: liveCellRangeBridgeStats?.uploadedRows ?? 0,
          liveGpuSortedCandidateCellRangeBridgeReservedRows: liveCellRangeBridgeStats?.reservedRows ?? 0,
          liveGpuSortedCandidateCellRangeBridgeUploadRowStart: liveCellRangeBridgeStats?.uploadRowStart ?? 0,
          liveGpuSortedCandidateCellRangeBridgeActiveCellStart: liveCellRangeBridgeStats?.activeCellStart ?? 0,
          liveGpuSortedCandidateCellRangeBridgeActiveCellCount: liveCellRangeBridgeStats?.activeCellCount ?? 0,
          liveGpuSortedCandidateUploadMode: s.gpuLiveSortedCandidateUploadMode ?? 'none',
          liveGpuSortedCandidateSource: s.gpuLiveSortedCandidateSource ?? 'none',
          liveGpuSortedCandidateRefreshReason: s.gpuLiveSortedCandidateRefreshReason ?? 'none',
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
          liveGpuSortedCandidateIndexMapUploadFloats: s.gpuLiveSortedCandidateIndexMapUploadFloats ?? 0,
          liveGpuSortedCandidateIndexMapSource: s.gpuLiveSortedCandidateIndexMapSource ?? 'none',
          liveGpuSortedCandidateIndexMapActiveRows: liveIndexMapStats?.activeRows ?? 0,
          liveGpuSortedCandidateIndexMapUploadedRows: liveIndexMapStats?.uploadedRows ?? 0,
          liveGpuSortedCandidateIndexMapReservedRows: liveIndexMapStats?.reservedRows ?? 0,
          liveGpuSortedCandidateIndexMapGatherReady: s.gpuLiveSortedCandidateIndexMapGather != null,
          liveGpuSortedCandidateIndexMapGatherActive: s.gpuLiveSortedCandidateIndexMapGatherActive === true,
          liveGpuSortedCandidateIndexMapGatherFragmentTexels: s.gpuLiveSortedCandidateIndexMapGatherFragmentTexels ?? 0,
          liveGpuSortedCandidateIndexMapGatherRows: liveIndexMapGatherStats?.activeRows ?? 0,
          liveGpuSortedCandidateIndexMapGatherSourceOrder: liveIndexMapGatherStats?.sourceOrder ?? 'sorted-cell-key',
          liveGpuSortedCandidateIndexMapGatherDestinationOrder: liveIndexMapGatherStats?.destinationOrder ?? 'original-index',
          liveGpuSortedCandidateIndexMapGatherPreservesPositionVelocity: liveIndexMapGatherStats?.gathersPositionVelocity ?? false,
          liveGpuSortedCandidateIndexMapGatherPreservesAttributes: liveIndexMapGatherStats?.gathersAttributes ?? false,
          liveGpuSortedCandidateGatherBackComplete,
          liveGpuSortedCandidateAuthoritativeReady,
          liveGpuSortedCandidateAuthoritativeBlocker,
          liveGpuSortedCandidateMaxCellOccupancy: s.gpuLiveSortedCandidateMaxCellOccupancy ?? 0,
          liveGpuSortedCandidateResidentScanLimit: s.gpuLiveSortedCandidateResidentScanLimit ?? SORTED_CELL_RESIDENT_SCAN_LIMIT,
          liveGpuSortedCandidateCollisionStressActive: s.gpuLiveSortedCandidateCollisionStressActive === true,
          liveGpuSortedCandidateCollisionBatches,
          liveGpuSortedCandidateCollisionRequiredBatches: liveGpuCandidateCollisionRequiredBatches,
          liveGpuSortedCandidateCollisionBatchesComplete,
          liveGpuSortedCandidateCollisionFragmentTexels: s.gpuLiveSortedCandidateCollisionFragmentTexels ?? 0,
          liveGpuSortedCandidateCollisionExpectedSlots,
          liveGpuSortedCandidateCollisionConsumedSlots,
          liveGpuSortedCandidateCollisionIgnoredSlots: s.gpuLiveSortedCandidateCollisionIgnoredSlots ?? 0,
          liveGpuSortedCandidateCollisionConsumptionRatio,
          liveGpuSortedCandidateCollisionAllSlotsConsumed,
          liveGpuSortedCandidateCollisionSpatiallyComplete: s.gpuLiveSortedCandidateCollisionSpatiallyComplete === true,
          liveGpuSortedCandidateTelemetrySampled: s.gpuLiveSortedCandidateTelemetrySampled === true,
          liveGpuSortedCandidateTelemetryFrame: s.gpuLiveSortedCandidateTelemetryFrame ?? 0,
          liveGpuSortedCandidateTelemetryStaleSeconds: Math.round((s.gpuLiveSortedCandidateTelemetryStaleSeconds ?? 0) * 1000) / 1000,
          liveGpuSortedCandidateStateOwner: liveSortedKeyGatherStats?.gpuGatheredSortedState === true
            ? 'gpu-sorted-key-gather-probe'
            : 'hybrid-sorted-cell-candidate-copy',
          liveGpuGridKeyActive: (liveGridKeyStats?.fragmentTexels ?? 0) > 0,
          liveGpuGridKeyParticleCount: liveGridKeyStats?.activeParticleCount ?? 0,
          liveGpuGridKeyRows: liveGridKeyStats?.activeRows ?? 0,
          liveGpuGridKeyFragmentTexels: liveGridKeyStats?.fragmentTexels ?? 0,
          liveGpuGridKeyColumns: liveGridKeyStats?.gridColumns ?? 0,
          liveGpuGridKeyCellRows: liveGridKeyStats?.gridRows ?? 0,
          liveGpuGridKeyCellSize: liveGridKeyStats?.cellSize ?? 0,
          liveGpuGridKeyBroadphaseOwner: liveGridKeyStats?.broadphaseOwner ?? 'gpu',
          liveGpuGridKeyProducesCandidateSlots: liveGridKeyStats?.producesCandidateSlots ?? false,
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
          liveGpuCandidateCollisionConsumableSlotCount,
          liveGpuCandidateCollisionBatchedConsumableSlotCount,
          liveGpuCandidateCollisionPassSlotLimit,
          liveGpuCandidateCollisionRequiresBatchedSolve,
          liveGpuCandidateCollisionRequiredBatches,
          liveGpuCandidateCapacity,
          liveGpuCandidateVsCpuSlotCapacityRatio,
          liveGpuCandidateVsCpuPairCapacityRatio,
          liveGpuCandidateFragmentToCpuUploadRatio,
          liveGpuCandidateCoverageStatus: liveCandidateStats?.spatiallyComplete === true
            ? liveCandidateStats.broadphaseOwner === 'hybrid'
              ? 'spatially-complete-hybrid-not-fully-gpu-owned'
              : 'spatially-complete'
            : liveGpuCandidateCapacity >= liveCpuSpatialSlotWrites && liveCpuSpatialSlotWrites > 0
              ? 'capacity-ok-but-bounded-not-authoritative'
              : 'insufficient-or-bounded-not-authoritative',
          liveGpuDirectUploadFloats: s.gpuLiveDirectUploadFloats ?? 0,
          liveGpuPaddedUploadFloats: s.gpuLivePaddedUploadFloats ?? 0,
          liveGpuPointDraws: s.gpuLivePointDraws ?? 0,
          gpuCollisionBackend: 'RawGpuConstraintParticleCircleCollisionPass',
          gpuCollisionActive: (liveCollisionStats?.fragmentTexels ?? 0) > 0,
          gpuCollisionSpatiallyComplete: liveCollisionStats?.spatiallyComplete ?? false,
          gpuCollisionBroadphase: liveCollisionStats?.broadphase ?? 'cpu-spatial-neighbor-slots',
          gpuCollisionBroadphaseOwner: liveCollisionStats?.broadphaseOwner ?? 'cpu',
          gpuCollisionNeighborSamples: liveCollisionStats?.neighborSamples ?? 0,
          gpuCollisionNeighborSlotCount: liveCollisionStats?.neighborSlotCount ?? 0,
          gpuCollisionProvidedNeighborSlotCount: liveCollisionStats?.providedNeighborSlotCount ?? 0,
          gpuCollisionIgnoredNeighborSlotCount: liveCollisionStats?.ignoredNeighborSlotCount ?? 0,
          gpuCollisionRequiresBatchedNeighborSlots: liveCollisionStats?.requiresBatchedNeighborSlots ?? false,
          gpuCollisionIterations: liveCollisionStats?.iterations ?? 0,
          gpuCollisionFragmentTexels: liveCollisionStats?.fragmentTexels ?? 0,
          gpuCollisionSlotOverflowCount: liveCollisionStats?.slotOverflowCount ?? 0,
          gpuCollisionSupportsIterations: true,
          gpuCollisionAuthoritativeReady: false,
          gpuCollisionLiveBroadphaseAuthoritativeReady: s.gpuLiveCollisionAuthoritativeReady === true,
          gpuCollisionStatus: s.gpuLiveSortedCandidateCollisionStressActive === true
            ? s.gpuLiveCollisionSource === 'gpu-resident-list'
              ? 'gpu-resident-list-live-render-collision-with-sorted-cell-gpu-stress-copy'
              : 'cpu-authoritative-live-with-sorted-cell-gpu-stress-copy'
            : s.gpuLiveCollisionSource === 'gpu-resident-list'
              ? 'gpu-resident-list-live-render-collision'
              : liveCollisionStats?.spatiallyComplete === true ? 'cpu-spatial-neighbor-slots-render-bridge-not-authoritative' : 'bounded-cpu-spatial-neighbor-slots-render-bridge',
          gpuCollisionLiveSource: s.gpuLiveCollisionSource ?? 'cpu-spatial-neighbor-slots',
          activeParticleRows: s.gpuPreviewActiveRows ?? null,
          uploadedParticleRows: s.gpuPreviewUploadedRows ?? null,
          reservedParticleRows: s.gpuPreviewReservedRows ?? null,
          activeParticleCapacityRatio: s.gpuPreviewStressRatio ?? null,
          hostSkippedRenderFrames: s.skippedRenderFrames,
          hostPendingRenderDeltaSeconds: Math.round(s.pendingRenderDeltaSeconds * 10000) / 10000,
          needsRedraw: s.needsRedraw ?? false,
          sleepRenderGateEligible: s.needsRedraw !== true && s.pointerDown !== true && stats.awake === false,
        });
      },
      onDestroy: (state) => {
        const s = state as BallPitRawState;
        s.cleanupPointer?.();
        if (s.particleBuffer) s.gl.deleteBuffer(s.particleBuffer);
        if (s.particleStyleBuffer) s.gl.deleteBuffer(s.particleStyleBuffer);
        if (s.shapeBuffer) s.gl.deleteBuffer(s.shapeBuffer);
        if (s.quadBuffer) s.gl.deleteBuffer(s.quadBuffer);
        if (s.particleVao) s.gl.deleteVertexArray(s.particleVao);
        if (s.shapeVao) s.gl.deleteVertexArray(s.shapeVao);
        if (s.shapeProgram) s.gl.deleteProgram(s.shapeProgram);
        s.gpuPreviewRenderer?.destroy();
        s.gpuPreviewCandidateNeighbors?.destroy();
        s.gpuPreviewCollisionNeighbors?.destroy();
        s.gpuPreviewCandidateSlots?.destroy();
        s.gpuPreviewGridKey?.destroy();
        s.gpuPreviewCollision?.destroy();
        s.gpuPreviewStep?.destroy();
        s.gpuPreviewState?.destroy();
        destroyLiveSortedCandidateState(s);
      },
    });
    this.qualityState = qualityState;
  }

  setQuality(quality: RenderQuality): void {
    this.qualityState.value = quality;
  }
}
