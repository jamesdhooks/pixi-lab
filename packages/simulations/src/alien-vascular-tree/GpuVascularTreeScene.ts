import {
  RawGpuInstancedSegmentField,
  RawGpuInstancedSegments,
  RawGpuTexturePointSampler,
  RawWebGL2Scene,
  finiteNumberSetting,
  renderSideViewPaletteBackdrop,
  type GestureEvent,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';

type VascularMode = 'guide' | 'feed' | 'prune';

interface Vec2 {
  x: number;
  y: number;
}

interface GrowthNode {
  x: number;
  y: number;
  parent: number;
  energy: number;
  thickness: number;
  age: number;
  active: boolean;
  activeSlot: number;
  segmentIndex: number;
}

interface VascularState extends RawWebGL2RenderState {
  model?: VascularGrowthModel;
  branchRenderer?: RawGpuInstancedSegments;
  branchField?: RawGpuInstancedSegmentField;
  fieldSampler?: RawGpuTexturePointSampler;
  markerRenderer?: RawGpuInstancedSegments;
  fieldSamplePoints?: Float32Array;
  branchSegmentData?: Float32Array;
  branchStyleData?: Float32Array;
  glowStyleData?: Float32Array;
  markerSegmentData?: Float32Array;
  markerStyleData?: Float32Array;
  segmentCapacity?: number;
  branchSegmentCount?: number;
  glowSegmentCount?: number;
  markerSegmentCount?: number;
  gpuUploadFloats?: number;
  packedGeometryRevision?: number;
  packedStyleRevision?: number;
  packedMarkerRevision?: number;
  branchGeometryUploadFloats?: number;
  branchGeometryUploadMode?: 'none' | 'full' | 'append-range';
  branchStyleUploadFloats?: number;
  branchStyleUploadMode?: 'none' | 'full' | 'dirty-range';
  branchStyleUploadStart?: number;
  branchStyleUploadCount?: number;
  branchStyleRepackCount?: number;
  markerUploadFloats?: number;
  branchFieldUploadFloats?: number;
  branchFieldDrawCount?: number;
  branchFieldWidth?: number;
  branchFieldHeight?: number;
  branchFieldResolutionTarget?: number;
  branchFieldScale?: number;
  branchFieldFragmentPixels?: number;
  branchFieldFeedbackPixels?: number;
  branchFieldFeedbackDecay?: number;
  branchFieldSampleCount?: number;
  branchFieldSampleUploadFloats?: number;
  branchFieldSampleReadbackFloats?: number;
  branchFieldSampleFragmentPixels?: number;
  vascularFieldFeedbackEnergy?: number;
  vascularFieldInputImpulseCount?: number;
  vascularFieldInputImpulsePixels?: number;
  vascularFieldInputImpulseMode?: VascularMode | 'none';
  branchGeometryUploadedCount?: number;
  branchGeometryUploadStart?: number;
  branchGeometryUploadCount?: number;
  branchDrawCount?: number;
  markerDrawCount?: number;
  skippedBranchPackWalk?: boolean;
  skippedStyleScan?: boolean;
  styleScanStart?: number;
  styleScanCount?: number;
  styleScanTotal?: number;
  styleScanEffectiveDt?: number;
  styleScanBudgetScale?: number;
  styleScanAvoidedCount?: number;
  skippedGpuDraw?: boolean;
  vascularStyleDt?: number;
  vascularCpuUpdateSkippedByGpuFeedback?: boolean;
  vascularGpuFeedbackThrottleSeconds?: number;
  vascularGpuFeedbackThrottleWindow?: number;
  vascularGpuFeedbackThrottleSkips?: number;
  vascularGpuFeedbackAvoidedCpuUpdateSeconds?: number;
  vascularGpuFeedbackAvoidedCpuUpdateFrames?: number;
  vascularGpuFeedbackAvoidedStyleScanNodes?: number;
  vascularGpuFeedbackAssistedFrames?: number;
  vascularGpuFeedbackUsefulFrames?: number;
  vascularGpuFeedbackWeakFrames?: number;
  vascularGpuFeedbackSampleCoverage?: number;
  vascularGpuFeedbackSampleStart?: number;
  vascularGpuFeedbackSampleStride?: number;
  vascularGpuFeedbackReadbackFloatsTotal?: number;
  vascularGpuFeedbackUploadFloatsTotal?: number;
  vascularGpuFeedbackReadbackFloatsPerAvoidedSecond?: number;
  vascularGpuFeedbackCpuAvoidanceRatio?: number;
  vascularGpuFeedbackStatus?: 'inactive' | 'weak' | 'useful';
  vascularGpuFeedbackHostFrameInterval?: number;
  vascularGpuFeedbackHostGateReason?: 'active' | 'unsaturated' | 'weak-feedback' | 'feedback-throttle';
  vascularCpuUpdateEffectiveDt?: number;
  vascularCpuUpdateMode?: 'cpu-topology-update' | 'gpu-feedback-throttle';
  vascularNeedsRedraw?: boolean;
  lastDrawWidth?: number;
  lastDrawHeight?: number;
  lastHostRenderSeconds?: number;
  paletteData?: Float32Array;
  backgroundData?: Float32Array;
  inputMode?: VascularMode;
  pointerDown?: boolean;
  pointerId?: number;
  previousPointerX?: number;
  previousPointerY?: number;
  cleanupPointer?: () => void;
}

const PALETTE_FALLBACKS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0.37, 0.56],
  [0.13, 0.83, 0.93],
  [1, 0.81, 0.43],
  [1, 1, 1],
];
const BACKGROUND_FALLBACK: readonly [number, number, number] = [0.035, 0.016, 0.04];

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function writeColor(target: Float32Array, offset: number, value: number | undefined, fallback: readonly [number, number, number]): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    target[offset] = ((value >> 16) & 255) / 255;
    target[offset + 1] = ((value >> 8) & 255) / 255;
    target[offset + 2] = (value & 255) / 255;
    return;
  }
  target[offset] = fallback[0];
  target[offset + 1] = fallback[1];
  target[offset + 2] = fallback[2];
}

function palette(state: VascularState): Float32Array {
  const colors = state.style?.palette ?? [];
  const out = state.paletteData ?? (state.paletteData = new Float32Array(12));
  for (let i = 0; i < 4; i += 1) writeColor(out, i * 3, colors[i], PALETTE_FALLBACKS[i] ?? PALETTE_FALLBACKS[0]);
  return out;
}

function background(state: VascularState): Float32Array {
  const out = state.backgroundData ?? (state.backgroundData = new Float32Array(3));
  writeColor(out, 0, state.style?.background, BACKGROUND_FALLBACK);
  return out;
}

function modeFromHost(mode: string | null): VascularMode {
  if (mode === 'feed' || mode === 'prune' || mode === 'guide') return mode;
  return 'guide';
}

function vascularFieldScale(state: VascularState, preview: boolean): number {
  const targetResolution = finiteNumberSetting(state.settings, 'resolution', preview ? 96 : 128);
  const longestEdge = Math.max(1, state.width, state.height);
  const targetScale = targetResolution / longestEdge;
  const previewScale = preview ? 0.18 : 0.12;
  return clamp(targetScale, previewScale, preview ? 0.42 : 0.75);
}

function vascularFieldImpulseForMode(mode: VascularMode, event: GestureEvent): { radius: number; strength: number } {
  const velocity = clamp(event.velocity ?? 0, 0, 90);
  const dragBoost = event.kind === 'drag' || event.kind === 'fast_swipe' ? 1 + velocity / 140 : 1;
  if (mode === 'prune') return { radius: 82, strength: -1.08 * dragBoost };
  if (mode === 'feed') return { radius: event.kind === 'fast_swipe' ? 112 : 86, strength: 1.05 * dragBoost };
  return { radius: 118, strength: 0.88 * dragBoost };
}

function ensurePackedSegmentCapacity(state: VascularState, capacity: number): void {
  const nextCapacity = Math.max(8, Math.floor(capacity));
  if ((state.segmentCapacity ?? 0) >= nextCapacity) return;
  state.segmentCapacity = Math.max(nextCapacity, (state.segmentCapacity ?? 0) * 2, 512);
  state.branchSegmentData = new Float32Array(state.segmentCapacity * 4);
  state.branchStyleData = new Float32Array(state.segmentCapacity * 2);
  state.glowStyleData = new Float32Array(state.segmentCapacity * 2);
  state.markerSegmentData = new Float32Array(8 * 4);
  state.markerStyleData = new Float32Array(8 * 2);
  state.packedGeometryRevision = -1;
  state.packedStyleRevision = -1;
  state.packedMarkerRevision = -1;
  state.branchGeometryUploadedCount = 0;
}

class VascularGrowthModel {
  private width = 1;
  private height = 1;
  private readonly nodes: GrowthNode[] = [];
  private readonly activeIndices: number[] = [];
  private readonly light: Vec2 = { x: 0, y: 0 };
  private growAccumulator = 0;
  private styleAccumulator = 0;
  private styleScanCursor = 0;
  private lastStyleScanStart = 0;
  private lastStyleScanCount = 0;
  private lastStyleScanTotal = 0;
  private lastStyleScanEffectiveDt = 0;
  private lastStyleScanBudgetScale = 1;
  private lastStyleScanAvoidedCount = 0;
  private activeTipSampleCursor = 0;
  private lastActiveTipSampleStart = 0;
  private lastActiveTipSampleStride = 0;
  private readonly activeTipSampleIndices: number[] = [];
  private geometryRevision = 0;
  private styleRevision = 0;
  private markerRevision = 0;
  private packedBranchCount = 0;
  private readonly segmentNodeIndices: number[] = [];
  private styleDirtyStart = Number.POSITIVE_INFINITY;
  private styleDirtyEnd = -1;

  reset(width: number, height: number, settings: Record<string, unknown>): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.nodes.length = 0;
    this.activeIndices.length = 0;
    this.light.x = this.width * 0.5;
    this.light.y = this.height * 0.2;
    this.styleAccumulator = 0;
    this.styleScanCursor = 0;
    this.lastStyleScanStart = 0;
    this.lastStyleScanCount = 0;
    this.lastStyleScanTotal = 0;
    this.lastStyleScanEffectiveDt = 0;
    this.activeTipSampleCursor = 0;
    this.lastActiveTipSampleStart = 0;
    this.lastActiveTipSampleStride = 0;
    this.activeTipSampleIndices.length = 0;
    this.packedBranchCount = 0;
    this.segmentNodeIndices.length = 0;
    this.styleDirtyStart = Number.POSITIVE_INFINITY;
    this.styleDirtyEnd = -1;
    this.geometryRevision += 1;
    this.styleRevision += 1;
    this.markAllStylesDirty();
    this.markerRevision += 1;
    const roots = 3;
    for (let i = 0; i < roots; i += 1) {
      this.addNode({
        x: this.width * (0.18 + (i / Math.max(1, roots - 1)) * 0.64),
        y: this.height * (0.78 + (Math.random() - 0.5) * 0.05),
        parent: -1,
        energy: 1,
        thickness: 5.2,
        age: 0,
        active: true,
      });
    }
    const initial = Math.floor(finiteNumberSetting(settings, 'branchBudget', 120) * 0.42);
    for (let i = 0; i < initial; i += 1) this.grow(true);
  }

  resize(width: number, height: number): void {
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    if (Math.abs(nextWidth - this.width) < 1 && Math.abs(nextHeight - this.height) < 1) return;
    const sx = nextWidth / Math.max(1, this.width);
    const sy = nextHeight / Math.max(1, this.height);
    this.width = nextWidth;
    this.height = nextHeight;
    this.light.x *= sx;
    this.light.y *= sy;
    for (const node of this.nodes) {
      node.x *= sx;
      node.y *= sy;
    }
    this.geometryRevision += 1;
    this.markerRevision += 1;
  }

  update(dt: number, settings: Record<string, unknown>, styleScanBudgetScale = 1): number {
    const growthRate = finiteNumberSetting(settings, 'growthRate', 0.75);
    this.growAccumulator += dt * growthRate * 42;
    const budget = Math.floor(finiteNumberSetting(settings, 'branchBudget', 260));
    while (this.growAccumulator >= 1 && this.nodes.length < budget) {
      this.growAccumulator -= 1;
      this.grow(false);
    }
    const saturated = this.nodes.length >= budget;
    this.styleAccumulator += dt;
    const styleInterval = saturated ? 1 / 12 : 0;
    if (styleInterval > 0 && this.styleAccumulator < styleInterval) return 0;
    const styleDt = styleInterval > 0 ? this.styleAccumulator : dt;
    this.styleAccumulator = 0;
    let styleChanged = false;
    const scanTotal = this.nodes.length;
    const scanStart = saturated ? this.styleScanCursor % Math.max(1, scanTotal) : 0;
    const scanBudgetScale = saturated ? clamp(styleScanBudgetScale, 0.2, 1) : 1;
    const fullSaturatedScanCount = Math.min(scanTotal, Math.max(256, Math.ceil(scanTotal / 8)));
    const scanCount = saturated
      ? Math.min(scanTotal, Math.max(64, Math.ceil(fullSaturatedScanCount * scanBudgetScale)))
      : scanTotal;
    this.lastStyleScanStart = scanStart;
    this.lastStyleScanCount = scanCount;
    this.lastStyleScanTotal = scanTotal;
    this.lastStyleScanBudgetScale = scanBudgetScale;
    this.lastStyleScanAvoidedCount = saturated ? Math.max(0, fullSaturatedScanCount - scanCount) : 0;
    const scanDt = saturated && scanCount > 0 ? styleDt * (scanTotal / scanCount) : styleDt;
    this.lastStyleScanEffectiveDt = scanDt;
    const prune = finiteNumberSetting(settings, 'pruneRate', 0.22);
    const nutrientFlow = finiteNumberSetting(settings, 'nutrientFlow', 1);
    for (let offset = 0; offset < scanCount; offset += 1) {
      const index = saturated ? (scanStart + offset) % Math.max(1, scanTotal) : offset;
      const node = this.nodes[index];
      if (!node) continue;
      node.age += scanDt;
      const lightGain = Math.max(0, 1 - Math.hypot(node.x - this.light.x, node.y - this.light.y) / Math.max(this.width, this.height) * 1.7) * nutrientFlow * scanDt * 0.1;
      const nextEnergy = clamp(node.energy + lightGain - prune * scanDt * 0.035, 0, 1.9);
      if (Math.abs(nextEnergy - node.energy) > 0.0001) {
        node.energy = nextEnergy;
        this.markNodeStyleDirty(index);
        styleChanged = true;
      }
      if (node.active && node.energy < 0.035 && node.age > 1.2 && Math.random() < prune * scanDt * 0.8) {
        this.setNodeActive(index, false);
        styleChanged = true;
      }
      if (!node.active && node.energy > 0.48 && Math.random() < 0.12) {
        this.setNodeActive(index, true);
        styleChanged = true;
      }
    }
    if (saturated) this.styleScanCursor = (scanStart + scanCount) % Math.max(1, scanTotal);
    if (styleChanged) this.styleRevision += 1;
    return styleDt;
  }

  interact(event: GestureEvent, mode: VascularMode): void {
    if (mode === 'guide') {
      const nextLightX = clamp(event.x, 0, this.width);
      const nextLightY = clamp(event.y, 0, this.height);
      if (Math.abs(nextLightX - this.light.x) > 0.5 || Math.abs(nextLightY - this.light.y) > 0.5) {
        this.markerRevision += 1;
      }
      this.light.x = nextLightX;
      this.light.y = nextLightY;
      this.feed(this.light.x, this.light.y, event.kind === 'fast_swipe' ? 150 : 124, event.kind === 'fast_swipe' ? 1.6 : 1.2);
      const forcedGrowth = event.kind === 'fast_swipe' ? 18 : event.kind === 'drag' ? 9 : 4;
      for (let i = 0; i < forcedGrowth; i += 1) this.grow(true);
    } else if (mode === 'prune') {
      this.feed(event.x, event.y, 92, -1.25);
    } else {
      this.light.x = clamp(event.x, 0, this.width);
      this.light.y = clamp(event.y, 0, this.height);
      this.markerRevision += 1;
      this.feed(event.x, event.y, event.kind === 'fast_swipe' ? 134 : 98, event.kind === 'fast_swipe' ? 1.65 : 1.15);
      const forcedGrowth = event.kind === 'fast_swipe' ? 16 : event.kind === 'drag' ? 7 : 3;
      for (let i = 0; i < forcedGrowth; i += 1) this.grow(true);
    }
  }

  writePackedSegments(state: VascularState): void {
    const branches = state.branchSegmentData;
    const branchStyles = state.branchStyleData;
    const glowStyles = state.glowStyleData;
    const markers = state.markerSegmentData;
    const markerStyles = state.markerStyleData;
    if (!branches || !branchStyles || !glowStyles || !markers || !markerStyles) return;
    const writeGeometry = state.packedGeometryRevision !== this.geometryRevision;
    const writeStyle = state.packedStyleRevision !== this.styleRevision || writeGeometry;
    const writeMarker = state.packedMarkerRevision !== this.markerRevision;
    let branchCount = this.packedBranchCount;
    let markerCount = 0;
    let branchStyleUploadStart = 0;
    let branchStyleUploadCount = 0;
    state.skippedBranchPackWalk = !writeGeometry && !writeStyle;
    if (writeGeometry) {
      branchCount = 0;
      for (let i = 0; i < this.nodes.length; i += 1) {
        const node = this.nodes[i];
        if (!node || node.parent < 0) continue;
        const parent = this.nodes[node.parent];
        if (!parent) continue;
        node.segmentIndex = branchCount;
        this.segmentNodeIndices[branchCount] = i;
        const branchOffset = branchCount * 4;
        branches[branchOffset] = parent.x;
        branches[branchOffset + 1] = parent.y;
        branches[branchOffset + 2] = node.x;
        branches[branchOffset + 3] = node.y;
        if (writeStyle) this.writeNodeStyle(node, branchStyles, glowStyles);
        branchCount += 1;
      }
      this.packedBranchCount = branchCount;
      this.segmentNodeIndices.length = branchCount;
      if (writeStyle) {
        branchStyleUploadStart = 0;
        branchStyleUploadCount = branchCount;
      }
    } else if (writeStyle) {
      const start = Math.max(0, Math.min(branchCount, Math.floor(this.styleDirtyStart)));
      const end = Math.max(start - 1, Math.min(branchCount - 1, Math.floor(this.styleDirtyEnd)));
      if (end >= start) {
        for (let segment = start; segment <= end; segment += 1) {
          const nodeIndex = this.segmentNodeIndices[segment] ?? -1;
          const node = this.nodes[nodeIndex];
          if (!node) continue;
          this.writeNodeStyle(node, branchStyles, glowStyles);
        }
        branchStyleUploadStart = start;
        branchStyleUploadCount = end - start + 1;
      }
    }
    if (writeMarker) markerCount = this.writePackedMarker(markers, markerStyles, markerCount, this.light.x, this.light.y, 13, 1.2);
    else markerCount = state.markerSegmentCount ?? 0;
    state.branchSegmentCount = branchCount;
    state.glowSegmentCount = branchCount;
    state.markerSegmentCount = markerCount;
    if (writeGeometry) state.packedGeometryRevision = this.geometryRevision;
    if (writeStyle) {
      state.packedStyleRevision = this.styleRevision;
      this.styleDirtyStart = Number.POSITIVE_INFINITY;
      this.styleDirtyEnd = -1;
    }
    if (writeMarker) state.packedMarkerRevision = this.markerRevision;
    state.branchStyleUploadStart = branchStyleUploadStart;
    state.branchStyleUploadCount = branchStyleUploadCount;
    state.branchStyleRepackCount = branchStyleUploadCount;
  }

  revisions(): { geometry: number; style: number; marker: number } {
    return {
      geometry: this.geometryRevision,
      style: this.styleRevision,
      marker: this.markerRevision,
    };
  }

  stats(): { nodes: number; activeTips: number } {
    return { nodes: this.nodes.length, activeTips: this.activeIndices.length };
  }

  styleScanStats(): { start: number; count: number; total: number; effectiveDt: number; budgetScale: number; avoidedCount: number } {
    return {
      start: this.lastStyleScanStart,
      count: this.lastStyleScanCount,
      total: this.lastStyleScanTotal,
      effectiveDt: this.lastStyleScanEffectiveDt,
      budgetScale: this.lastStyleScanBudgetScale,
      avoidedCount: this.lastStyleScanAvoidedCount,
    };
  }

  writeActiveTipSamplePoints(target: Float32Array, maxSamples: number): number {
    const sampleCount = Math.max(0, Math.min(Math.floor(maxSamples), this.activeIndices.length, Math.floor(target.length / 2)));
    if (sampleCount <= 0) {
      this.lastActiveTipSampleStart = 0;
      this.lastActiveTipSampleStride = 0;
      this.activeTipSampleIndices.length = 0;
      return 0;
    }
    const stride = Math.max(1, Math.floor(this.activeIndices.length / sampleCount));
    const start = this.activeTipSampleCursor % Math.max(1, this.activeIndices.length);
    this.lastActiveTipSampleStart = start;
    this.lastActiveTipSampleStride = stride;
    for (let sample = 0; sample < sampleCount; sample += 1) {
      const activeIndex = this.activeIndices[(start + sample * stride) % this.activeIndices.length] ?? -1;
      this.activeTipSampleIndices[sample] = activeIndex;
      const node = this.nodes[activeIndex];
      const offset = sample * 2;
      target[offset] = node?.x ?? 0;
      target[offset + 1] = node?.y ?? 0;
    }
    this.activeTipSampleIndices.length = sampleCount;
    this.activeTipSampleCursor = (start + Math.max(1, Math.floor(stride * 0.5))) % Math.max(1, this.activeIndices.length);
    return sampleCount;
  }

  activeTipSampleStats(): { start: number; stride: number } {
    return {
      start: this.lastActiveTipSampleStart,
      stride: this.lastActiveTipSampleStride,
    };
  }

  applyGpuFieldFeedback(samples: Float32Array, sampleCount: number): number {
    const count = Math.max(0, Math.min(Math.floor(sampleCount), this.activeIndices.length, Math.floor(samples.length / 4)));
    if (count <= 0) return 0;
    const stride = Math.max(1, Math.floor(this.activeIndices.length / count));
    let totalEnergy = 0;
    let changed = false;
    for (let sample = 0; sample < count; sample += 1) {
      const activeIndex = this.activeTipSampleIndices[sample] ?? this.activeIndices[Math.min(this.activeIndices.length - 1, sample * stride)] ?? -1;
      const node = this.nodes[activeIndex];
      if (!node) continue;
      const energy = clamp(samples[sample * 4] ?? 0, 0, 2);
      totalEnergy += energy;
      const feedback = (0.5 - Math.min(0.5, energy * 0.25)) * 0.018;
      const nextEnergy = clamp(node.energy + feedback, 0, 1.9);
      if (Math.abs(nextEnergy - node.energy) > 0.0001) {
        node.energy = nextEnergy;
        this.markNodeStyleDirty(activeIndex);
        changed = true;
      }
    }
    if (changed) this.styleRevision += 1;
    return totalEnergy / count;
  }

  isSaturated(settings: Record<string, unknown>): boolean {
    return this.nodes.length >= Math.floor(finiteNumberSetting(settings, 'branchBudget', 260));
  }

  private grow(force: boolean): void {
    if (this.activeIndices.length === 0) return;
    let pickedIndex = this.activeIndices[Math.floor(Math.random() * this.activeIndices.length)] ?? 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    const candidateCount = Math.min(10, this.activeIndices.length);
    for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
      const index = this.activeIndices[Math.floor(Math.random() * this.activeIndices.length)] ?? pickedIndex;
      const candidate = this.nodes[index];
      if (!candidate) continue;
      const lightDistance = Math.hypot(candidate.x - this.light.x, candidate.y - this.light.y) / Math.max(this.width, this.height, 1);
      const score = candidate.energy * 1.25 + (1 - lightDistance) * 0.55 + Math.random() * 0.28;
      if (score > bestScore) {
        bestScore = score;
        pickedIndex = index;
      }
    }
    const parent = this.nodes[pickedIndex];
    if (!parent) return;
    let angle = Math.atan2(this.light.y - parent.y, this.light.x - parent.x);
    const upwardBias = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
    const lightWeight = force ? 0.84 : 0.58;
    const upwardWeight = force ? 0.16 : 0.42;
    const jitter = force ? 0.34 : 0.72;
    angle = angle * lightWeight + upwardBias * upwardWeight + (Math.random() - 0.5) * jitter;
    const length = force ? 18 + Math.random() * 34 : 14 + Math.random() * 28;
    const x = clamp(parent.x + Math.cos(angle) * length, 6, this.width - 6);
    const y = clamp(parent.y + Math.sin(angle) * length, 6, this.height - 6);
    const childThickness = Math.max(1.15, parent.thickness * (0.78 + Math.random() * 0.14));
    this.addNode({ x, y, parent: pickedIndex, energy: Math.max(0.08, parent.energy * (0.7 + Math.random() * 0.2)), thickness: childThickness, age: 0, active: true });
    this.packedBranchCount += 1;
    parent.energy *= force ? 0.88 : 0.72;
    parent.thickness = Math.max(parent.thickness, childThickness + 0.28);
    this.markNodeStyleDirty(pickedIndex);
    this.markNodeStyleDirty(this.nodes.length - 1);
    if (!force && Math.random() < 0.58) this.setNodeActive(pickedIndex, false);
    this.geometryRevision += 1;
    this.styleRevision += 1;
  }

  private feed(px: number, py: number, radius: number, amount: number): void {
    let changed = false;
    for (let index = 0; index < this.nodes.length; index += 1) {
      const node = this.nodes[index];
      if (!node) continue;
      const d = Math.hypot(node.x - px, node.y - py);
      if (d > radius) continue;
      const falloff = Math.cos((d / radius) * Math.PI * 0.5);
      const nextEnergy = clamp(node.energy + amount * falloff, 0, 1.8);
      if (Math.abs(nextEnergy - node.energy) > 0.0001) {
        node.energy = nextEnergy;
        this.markNodeStyleDirty(index);
        changed = true;
      }
      if (amount > 0 && falloff > 0.2 && !node.active) {
        this.setNodeActive(index, true);
        changed = true;
      }
      if (amount < 0 && falloff > 0.5 && node.active) {
        this.setNodeActive(index, false);
        changed = true;
      }
    }
    if (changed) this.styleRevision += 1;
  }

  private addNode(input: Omit<GrowthNode, 'activeSlot' | 'segmentIndex'>): number {
    const index = this.nodes.length;
    const segmentIndex = input.parent >= 0 ? this.packedBranchCount : -1;
    const node: GrowthNode = {
      ...input,
      activeSlot: -1,
      segmentIndex,
    };
    this.nodes.push(node);
    if (segmentIndex >= 0) this.segmentNodeIndices[segmentIndex] = index;
    if (node.active) {
      node.activeSlot = this.activeIndices.length;
      this.activeIndices.push(index);
    }
    return index;
  }

  private writeNodeStyle(node: GrowthNode, branchStyles: Float32Array, glowStyles: Float32Array): void {
    const segmentIndex = node.segmentIndex;
    if (segmentIndex < 0) return;
    const radius = Math.max(1.2, node.thickness * (0.7 + node.energy * 0.28));
    const intensity = Math.max(0.25, Math.min(1.5, 0.48 + node.energy * 0.72));
    const branchStyleOffset = segmentIndex * 2;
    branchStyles[branchStyleOffset] = radius;
    branchStyles[branchStyleOffset + 1] = intensity;
    glowStyles[branchStyleOffset] = radius * 2.8;
    glowStyles[branchStyleOffset + 1] = intensity * 0.75;
  }

  private markAllStylesDirty(): void {
    this.styleDirtyStart = 0;
    this.styleDirtyEnd = Math.max(0, this.packedBranchCount - 1);
  }

  private markNodeStyleDirty(index: number): void {
    const node = this.nodes[index];
    if (!node || node.segmentIndex < 0) return;
    this.styleDirtyStart = Math.min(this.styleDirtyStart, node.segmentIndex);
    this.styleDirtyEnd = Math.max(this.styleDirtyEnd, node.segmentIndex);
  }

  private setNodeActive(index: number, active: boolean): void {
    const node = this.nodes[index];
    if (!node || node.active === active) return;
    node.active = active;
    if (active) {
      node.activeSlot = this.activeIndices.length;
      this.activeIndices.push(index);
      return;
    }
    const slot = node.activeSlot;
    node.activeSlot = -1;
    if (slot < 0 || slot >= this.activeIndices.length) return;
    const lastSlot = this.activeIndices.length - 1;
    const movedIndex = this.activeIndices[lastSlot] ?? -1;
    if (slot !== lastSlot) this.activeIndices[slot] = movedIndex;
    this.activeIndices.pop();
    if (slot !== lastSlot) {
      const moved = this.nodes[movedIndex];
      if (moved) moved.activeSlot = slot;
    }
  }

  private writePackedMarker(segments: Float32Array, styles: Float32Array, offset: number, x: number, y: number, radius: number, intensity: number): number {
    const horizontalOffset = offset * 4;
    const horizontalStyleOffset = offset * 2;
    segments[horizontalOffset] = x - radius;
    segments[horizontalOffset + 1] = y;
    segments[horizontalOffset + 2] = x + radius;
    segments[horizontalOffset + 3] = y;
    styles[horizontalStyleOffset] = 2.2;
    styles[horizontalStyleOffset + 1] = intensity;
    const verticalOffset = offset + 1;
    const verticalSegmentOffset = verticalOffset * 4;
    const verticalStyleOffset = verticalOffset * 2;
    segments[verticalSegmentOffset] = x;
    segments[verticalSegmentOffset + 1] = y - radius;
    segments[verticalSegmentOffset + 2] = x;
    segments[verticalSegmentOffset + 3] = y + radius;
    styles[verticalStyleOffset] = 2.2;
    styles[verticalStyleOffset + 1] = intensity;
    return verticalOffset + 1;
  }
}

function pushGesture(state: VascularState, event: GestureEvent): void {
  const mode = state.inputMode ?? modeFromHost(state.mode);
  state.model?.interact(event, mode);
  const impulse = vascularFieldImpulseForMode(mode, event);
  const impulsePixels = state.branchField?.applyImpulse({
    x: clamp(event.x, 0, state.width),
    y: clamp(event.y, 0, state.height),
    radius: impulse.radius,
    strength: impulse.strength,
    worldWidth: state.width,
    worldHeight: state.height,
  }) ?? 0;
  state.vascularFieldInputImpulsePixels = impulsePixels;
  state.vascularFieldInputImpulseMode = impulsePixels > 0 ? mode : 'none';
  if (impulsePixels > 0) state.vascularFieldInputImpulseCount = (state.vascularFieldInputImpulseCount ?? 0) + 1;
  state.vascularNeedsRedraw = true;
}

function installPointer(state: VascularState): void {
  const canvas = state.canvas;
  const local = (event: PointerEvent): Vec2 => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = state.width / Math.max(1, rect.width);
    const scaleY = state.height / Math.max(1, rect.height);
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  };
  const down = (event: PointerEvent) => {
    const point = local(event);
    state.pointerDown = true;
    state.pointerId = event.pointerId;
    state.previousPointerX = point.x;
    state.previousPointerY = point.y;
    pushGesture(state, { kind: 'tap', x: point.x, y: point.y, timestamp: performance.now() });
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!state.pointerDown || event.pointerId !== state.pointerId) return;
    const point = local(event);
    const dx = point.x - (state.previousPointerX ?? point.x);
    const dy = point.y - (state.previousPointerY ?? point.y);
    state.previousPointerX = point.x;
    state.previousPointerY = point.y;
    pushGesture(state, { kind: 'drag', x: point.x, y: point.y, dx, dy, velocity: Math.hypot(dx, dy), timestamp: performance.now() });
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId === state.pointerId) {
      state.pointerDown = false;
      state.pointerId = undefined;
    }
    try {
      canvas.releasePointerCapture?.(event.pointerId);
    } catch {
      // Ignore browsers that reject release after cancellation.
    }
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

function vascularShouldRender(state: VascularState): boolean {
  const model = state.model;
  if (!model) return true;
  if (state.pointerDown === true || state.vascularNeedsRedraw === true) {
    state.vascularGpuFeedbackHostFrameInterval = 0;
    state.vascularGpuFeedbackHostGateReason = 'active';
    return true;
  }
  if (state.lastDrawWidth !== state.width || state.lastDrawHeight !== state.height) {
    state.vascularGpuFeedbackHostFrameInterval = 0;
    state.vascularGpuFeedbackHostGateReason = 'active';
    return true;
  }
  if (!model.isSaturated(state.settings)) {
    state.vascularGpuFeedbackHostFrameInterval = 0;
    state.vascularGpuFeedbackHostGateReason = 'unsaturated';
    return true;
  }
  const feedbackEnergy = state.vascularFieldFeedbackEnergy ?? 0;
  const feedbackConfidence = clamp((feedbackEnergy - 0.62) / 0.46, 0, 1);
  const resolution = finiteNumberSetting(state.settings, 'resolution', 128);
  const resolutionConfidence = clamp((resolution - 96) / 416, 0, 1);
  const interval = feedbackEnergy > 0.62
    ? (1 / 12) + feedbackConfidence * (1 / 8) + resolutionConfidence * (1 / 16)
    : 1 / 12;
  state.vascularGpuFeedbackHostFrameInterval = interval;
  state.vascularGpuFeedbackHostGateReason = feedbackEnergy > 0.62 ? 'feedback-throttle' : 'weak-feedback';
  return state.timeSeconds - (state.lastHostRenderSeconds ?? 0) >= interval;
}

export class GpuVascularTreeScene extends RawWebGL2Scene {
  constructor(preview = false) {
    super({
      name: 'alien-vascular-tree',
      markup: '<canvas class="h-full w-full touch-none bg-slate-950"></canvas>',
      canvasSelector: 'canvas',
      maxDevicePixelRatio: preview ? 1.25 : 2,
      renderScale: () => preview ? 0.75 : 1,
      onInit: (rawState) => {
        const state = rawState as VascularState;
        state.inputMode = 'guide';
        state.model = new VascularGrowthModel();
        state.model.reset(state.width, state.height, state.settings);
        state.branchRenderer = new RawGpuInstancedSegments(state.gl);
        state.branchField = new RawGpuInstancedSegmentField(state.resources);
        state.fieldSampler = new RawGpuTexturePointSampler(state.resources, { maxSamples: preview ? 32 : 128 });
        state.markerRenderer = new RawGpuInstancedSegments(state.gl);
        state.vascularNeedsRedraw = true;
        state.vascularCpuUpdateSkippedByGpuFeedback = false;
        state.vascularGpuFeedbackThrottleSeconds = 0;
        state.vascularGpuFeedbackThrottleWindow = 0;
        state.vascularGpuFeedbackThrottleSkips = 0;
        state.vascularGpuFeedbackAvoidedCpuUpdateSeconds = 0;
        state.vascularGpuFeedbackAvoidedCpuUpdateFrames = 0;
        state.vascularGpuFeedbackAvoidedStyleScanNodes = 0;
        state.vascularGpuFeedbackAssistedFrames = 0;
        state.vascularGpuFeedbackUsefulFrames = 0;
        state.vascularGpuFeedbackWeakFrames = 0;
        state.vascularGpuFeedbackSampleCoverage = 0;
        state.vascularGpuFeedbackReadbackFloatsTotal = 0;
        state.vascularGpuFeedbackUploadFloatsTotal = 0;
        state.vascularGpuFeedbackReadbackFloatsPerAvoidedSecond = 0;
        state.vascularGpuFeedbackCpuAvoidanceRatio = 0;
        state.vascularGpuFeedbackStatus = 'inactive';
        state.vascularGpuFeedbackHostFrameInterval = 0;
        state.vascularGpuFeedbackHostGateReason = 'active';
        state.vascularFieldInputImpulseCount = 0;
        state.vascularFieldInputImpulsePixels = 0;
        state.vascularFieldInputImpulseMode = 'none';
        state.vascularCpuUpdateEffectiveDt = 0;
        state.vascularCpuUpdateMode = 'cpu-topology-update';
        ensurePackedSegmentCapacity(state, finiteNumberSetting(state.settings, 'branchBudget', 320) + 8);
        installPointer(state);
      },
      onReset: (rawState) => {
        const state = rawState as VascularState;
        state.model?.reset(state.width, state.height, state.settings);
        state.branchGeometryUploadedCount = 0;
        state.vascularCpuUpdateSkippedByGpuFeedback = false;
        state.vascularGpuFeedbackThrottleSeconds = 0;
        state.vascularGpuFeedbackThrottleWindow = 0;
        state.vascularGpuFeedbackThrottleSkips = 0;
        state.vascularGpuFeedbackAvoidedCpuUpdateSeconds = 0;
        state.vascularGpuFeedbackAvoidedCpuUpdateFrames = 0;
        state.vascularGpuFeedbackAssistedFrames = 0;
        state.vascularGpuFeedbackUsefulFrames = 0;
        state.vascularGpuFeedbackWeakFrames = 0;
        state.vascularGpuFeedbackSampleCoverage = 0;
        state.vascularGpuFeedbackReadbackFloatsTotal = 0;
        state.vascularGpuFeedbackUploadFloatsTotal = 0;
        state.vascularGpuFeedbackReadbackFloatsPerAvoidedSecond = 0;
        state.vascularGpuFeedbackCpuAvoidanceRatio = 0;
        state.vascularGpuFeedbackStatus = 'inactive';
        state.vascularGpuFeedbackHostFrameInterval = 0;
        state.vascularGpuFeedbackHostGateReason = 'active';
        state.vascularFieldInputImpulseCount = 0;
        state.vascularFieldInputImpulsePixels = 0;
        state.vascularFieldInputImpulseMode = 'none';
        state.vascularCpuUpdateEffectiveDt = 0;
        state.vascularCpuUpdateMode = 'cpu-topology-update';
        state.vascularNeedsRedraw = true;
      },
      onSettingsChange: (rawState) => {
        const state = rawState as VascularState;
        state.vascularNeedsRedraw = true;
      },
      onStyleChange: (rawState) => {
        const state = rawState as VascularState;
        state.vascularNeedsRedraw = true;
      },
      onModeChange: (rawState, mode) => {
        const state = rawState as VascularState;
        state.inputMode = modeFromHost(mode);
        state.vascularNeedsRedraw = true;
      },
      shouldRender: (rawState) => vascularShouldRender(rawState as VascularState),
      render: (rawState) => {
        const state = rawState as VascularState;
        const gl = state.gl;
        const model = state.model;
        if (!model || !state.branchRenderer || !state.markerRenderer) return;
        state.lastHostRenderSeconds = state.timeSeconds;
        ensurePackedSegmentCapacity(state, finiteNumberSetting(state.settings, 'branchBudget', 320) + 8);
        const branchSegmentData = state.branchSegmentData;
        const branchStyleData = state.branchStyleData;
        const glowStyleData = state.glowStyleData;
        const markerSegmentData = state.markerSegmentData;
        const markerStyleData = state.markerStyleData;
        if (!branchSegmentData || !branchStyleData || !glowStyleData || !markerSegmentData || !markerStyleData) return;
        model.resize(state.width, state.height);
        const previousFeedbackEnergy = state.vascularFieldFeedbackEnergy ?? 0;
        const gpuFeedbackThrottleEligible = state.pointerDown !== true && model.isSaturated(state.settings) && previousFeedbackEnergy > 0.62;
        const feedbackConfidence = clamp((previousFeedbackEnergy - 0.62) / 0.46, 0, 1);
        const requestedFieldResolution = finiteNumberSetting(state.settings, 'resolution', preview ? 96 : 128);
        const resolutionConfidence = clamp((requestedFieldResolution - 96) / 416, 0, 1);
        const gpuFeedbackThrottleWindow = gpuFeedbackThrottleEligible
          ? (1 / 12) + feedbackConfidence * (preview ? 1 / 12 : 1 / 4) + resolutionConfidence * (preview ? 1 / 24 : 1 / 8)
          : 0;
        const gpuFeedbackThrottleSeconds = gpuFeedbackThrottleEligible
          ? (state.vascularGpuFeedbackThrottleSeconds ?? 0) + state.deltaSeconds
          : 0;
        const skipCpuUpdateForGpuFeedback = gpuFeedbackThrottleEligible && gpuFeedbackThrottleSeconds < gpuFeedbackThrottleWindow;
        state.vascularGpuFeedbackThrottleSeconds = gpuFeedbackThrottleSeconds;
        state.vascularGpuFeedbackThrottleWindow = gpuFeedbackThrottleWindow;
        state.vascularCpuUpdateSkippedByGpuFeedback = skipCpuUpdateForGpuFeedback;
        state.vascularCpuUpdateMode = skipCpuUpdateForGpuFeedback ? 'gpu-feedback-throttle' : 'cpu-topology-update';
        const cpuUpdateEffectiveDt = skipCpuUpdateForGpuFeedback ? 0 : state.deltaSeconds + (gpuFeedbackThrottleEligible ? gpuFeedbackThrottleSeconds : 0);
        state.vascularCpuUpdateEffectiveDt = cpuUpdateEffectiveDt;
        if (skipCpuUpdateForGpuFeedback) {
          state.vascularGpuFeedbackThrottleSkips = (state.vascularGpuFeedbackThrottleSkips ?? 0) + 1;
          state.vascularGpuFeedbackAvoidedCpuUpdateFrames = (state.vascularGpuFeedbackAvoidedCpuUpdateFrames ?? 0) + 1;
          state.vascularGpuFeedbackAvoidedCpuUpdateSeconds = (state.vascularGpuFeedbackAvoidedCpuUpdateSeconds ?? 0) + state.deltaSeconds;
        }
        const styleScanBudgetScale = gpuFeedbackThrottleEligible
          ? clamp(1 - feedbackConfidence * 0.55 - resolutionConfidence * 0.2, 0.25, 1)
          : 1;
        const styleDt = skipCpuUpdateForGpuFeedback ? 0 : model.update(cpuUpdateEffectiveDt, state.settings, styleScanBudgetScale);
        if (!skipCpuUpdateForGpuFeedback) state.vascularGpuFeedbackThrottleSeconds = 0;
        const styleScan = model.styleScanStats();
        state.skippedStyleScan = styleDt <= 0;
        state.styleScanStart = styleScan.start;
        state.styleScanCount = styleScan.count;
        state.styleScanTotal = styleScan.total;
        state.styleScanEffectiveDt = styleScan.effectiveDt;
        state.styleScanBudgetScale = skipCpuUpdateForGpuFeedback ? 0 : styleScan.budgetScale;
        state.styleScanAvoidedCount = skipCpuUpdateForGpuFeedback ? styleScan.total : styleScan.avoidedCount;
        if ((state.styleScanAvoidedCount ?? 0) > 0) {
          state.vascularGpuFeedbackAvoidedStyleScanNodes = (state.vascularGpuFeedbackAvoidedStyleScanNodes ?? 0) + (state.styleScanAvoidedCount ?? 0);
        }
        state.vascularStyleDt = styleDt;
        const revisions = model.revisions();
        const uploadGeometry = state.packedGeometryRevision !== revisions.geometry;
        const uploadStyle = state.packedStyleRevision !== revisions.style || uploadGeometry;
        const uploadMarker = state.packedMarkerRevision !== revisions.marker;
        const sizeChanged = state.lastDrawWidth !== state.width || state.lastDrawHeight !== state.height;
        if (!uploadGeometry && !uploadStyle && !uploadMarker && !sizeChanged && state.vascularNeedsRedraw !== true && state.pointerDown !== true) {
          state.gpuUploadFloats = 0;
          state.branchGeometryUploadFloats = 0;
          state.branchGeometryUploadMode = 'none';
          state.branchStyleUploadFloats = 0;
          state.branchStyleUploadMode = 'none';
          state.branchStyleUploadStart = 0;
          state.branchStyleUploadCount = 0;
          state.branchStyleRepackCount = 0;
          state.markerUploadFloats = 0;
          state.branchFieldUploadFloats = 0;
          state.branchFieldDrawCount = 0;
          state.branchFieldFragmentPixels = state.branchField?.stats().lastFragmentPixels ?? 0;
          state.branchFieldFeedbackPixels = state.branchField?.stats().lastFeedbackFragmentPixels ?? 0;
          state.branchFieldFeedbackDecay = state.branchField?.stats().feedbackDecay ?? 0;
          state.branchFieldWidth = state.branchField?.stats().fieldWidth ?? 0;
          state.branchFieldHeight = state.branchField?.stats().fieldHeight ?? 0;
          state.branchFieldResolutionTarget = finiteNumberSetting(state.settings, 'resolution', preview ? 96 : 128);
          state.branchFieldScale = vascularFieldScale(state, preview);
          state.branchFieldSampleCount = 0;
          state.branchFieldSampleUploadFloats = 0;
          state.branchFieldSampleReadbackFloats = 0;
          state.branchFieldSampleFragmentPixels = 0;
          state.branchGeometryUploadStart = 0;
          state.branchGeometryUploadCount = 0;
          state.branchDrawCount = 0;
          state.markerDrawCount = 0;
          state.skippedGpuDraw = true;
          state.skippedBranchPackWalk = true;
          return;
        }
        const previousBranchCount = state.branchSegmentCount ?? 0;
        const previousUploadedGeometryCount = state.branchGeometryUploadedCount ?? 0;
        const previousRendererCapacity = state.branchRenderer.stats().segmentCapacity;
        model.writePackedSegments(state);
        const branchSegmentCount = state.branchSegmentCount ?? 0;
        const fullGeometryUpload = uploadGeometry && (
          sizeChanged ||
          previousUploadedGeometryCount <= 0 ||
          previousBranchCount > branchSegmentCount ||
          previousRendererCapacity < branchSegmentCount
        );
        const branchGeometryUploadStart = uploadGeometry
          ? fullGeometryUpload
            ? 0
            : Math.min(previousUploadedGeometryCount, previousBranchCount, branchSegmentCount)
          : 0;
        const branchGeometryUploadCount = uploadGeometry
          ? Math.max(0, branchSegmentCount - branchGeometryUploadStart)
          : 0;
        const branchStyleUploadCount = state.branchStyleUploadCount ?? branchSegmentCount;
        const branchStyleUploadMode = uploadStyle
          ? (state.branchStyleUploadStart === 0 && branchStyleUploadCount >= branchSegmentCount ? 'full' : 'dirty-range')
          : 'none';
        const colors = palette(state);
        const baseBackground = background(state);
        renderSideViewPaletteBackdrop(gl, {
          width: state.width,
          height: state.height,
          style: state.style,
          renderStyle: 'enhanced',
          fallbackBackground: [baseBackground[0] ?? 0.02, baseBackground[1] ?? 0.025, baseBackground[2] ?? 0.055],
        });
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        let gpuUploadFloats = 0;
        const branchGeometryUploadFloats = state.branchRenderer.renderPacked({
          width: state.width,
          height: state.height,
          color: [colors[3] ?? 1, colors[4] ?? 0.82, colors[5] ?? 0.93, 0.16],
          segmentData: branchSegmentData,
          styleData: glowStyleData,
          count: state.glowSegmentCount ?? 0,
          uploadSegmentData: uploadGeometry,
          uploadSegmentStart: branchGeometryUploadStart,
          uploadSegmentCount: branchGeometryUploadCount,
          uploadStyleData: uploadStyle,
          uploadStyleStart: state.branchStyleUploadStart ?? 0,
          uploadStyleCount: state.branchStyleUploadCount ?? state.glowSegmentCount ?? 0,
        });
        state.branchDrawCount = state.glowSegmentCount ?? 0;
        gpuUploadFloats += branchGeometryUploadFloats;
        const branchFieldResolutionTarget = finiteNumberSetting(state.settings, 'resolution', preview ? 96 : 128);
        const branchFieldScale = vascularFieldScale(state, preview);
        const branchFieldUploadFloats = state.branchField?.renderPacked({
          width: state.width,
          height: state.height,
          fieldScale: branchFieldScale,
          feedbackDecay: preview ? 0.78 : 0.9,
          segmentData: branchSegmentData,
          styleData: branchStyleData,
          count: state.branchSegmentCount ?? 0,
          uploadSegmentData: uploadGeometry,
          uploadSegmentStart: branchGeometryUploadStart,
          uploadSegmentCount: branchGeometryUploadCount,
          uploadStyleData: uploadStyle,
          uploadStyleStart: state.branchStyleUploadStart ?? 0,
          uploadStyleCount: state.branchStyleUploadCount ?? state.branchSegmentCount ?? 0,
        }) ?? 0;
        const branchFieldStats = state.branchField?.stats();
        state.branchFieldUploadFloats = branchFieldUploadFloats;
        state.branchFieldDrawCount = branchFieldStats?.lastDrawCount ?? 0;
        state.branchFieldWidth = branchFieldStats?.fieldWidth ?? 0;
        state.branchFieldHeight = branchFieldStats?.fieldHeight ?? 0;
        state.branchFieldResolutionTarget = branchFieldResolutionTarget;
        state.branchFieldScale = branchFieldScale;
        state.branchFieldFragmentPixels = branchFieldStats?.lastFragmentPixels ?? 0;
        state.branchFieldFeedbackPixels = branchFieldStats?.lastFeedbackFragmentPixels ?? 0;
        state.branchFieldFeedbackDecay = branchFieldStats?.feedbackDecay ?? 0;
        const fieldTexture = state.branchField?.texture;
        if (fieldTexture && state.fieldSampler) {
          const resolutionDrivenSamples = Math.ceil(Math.sqrt(Math.max(1, branchFieldResolutionTarget)) * (preview ? 2.5 : 4));
          const maxSamples = Math.max(preview ? 16 : 32, Math.min(preview ? 32 : 128, resolutionDrivenSamples));
          const points = state.fieldSamplePoints && state.fieldSamplePoints.length >= maxSamples * 2
            ? state.fieldSamplePoints
            : (state.fieldSamplePoints = new Float32Array(maxSamples * 2));
          const activeTips = model.stats().activeTips;
          const sampleCount = model.writeActiveTipSamplePoints(points, maxSamples);
          if (sampleCount > 0) {
            const samples = state.fieldSampler.sample({
              source: fieldTexture,
              sourceWidth: fieldTexture.texture.width,
              sourceHeight: fieldTexture.texture.height,
              points,
              pointCount: sampleCount,
              worldWidth: state.width,
              worldHeight: state.height,
            });
            state.vascularFieldFeedbackEnergy = model.applyGpuFieldFeedback(samples, sampleCount);
            const samplerStats = state.fieldSampler.stats();
            state.branchFieldSampleCount = samplerStats.lastSampleCount;
            state.branchFieldSampleUploadFloats = samplerStats.lastUploadFloats;
            state.branchFieldSampleReadbackFloats = samplerStats.lastReadbackFloats;
            state.branchFieldSampleFragmentPixels = samplerStats.lastFragmentPixels;
            state.vascularGpuFeedbackAssistedFrames = (state.vascularGpuFeedbackAssistedFrames ?? 0) + 1;
            state.vascularGpuFeedbackSampleCoverage = activeTips > 0 ? sampleCount / activeTips : 0;
            const sampleStats = model.activeTipSampleStats();
            state.vascularGpuFeedbackSampleStart = sampleStats.start;
            state.vascularGpuFeedbackSampleStride = sampleStats.stride;
            state.vascularGpuFeedbackReadbackFloatsTotal = (state.vascularGpuFeedbackReadbackFloatsTotal ?? 0) + samplerStats.lastReadbackFloats;
            state.vascularGpuFeedbackUploadFloatsTotal = (state.vascularGpuFeedbackUploadFloatsTotal ?? 0) + samplerStats.lastUploadFloats;
            if ((state.vascularFieldFeedbackEnergy ?? 0) > 0.62) {
              state.vascularGpuFeedbackUsefulFrames = (state.vascularGpuFeedbackUsefulFrames ?? 0) + 1;
              state.vascularGpuFeedbackStatus = 'useful';
            } else {
              state.vascularGpuFeedbackWeakFrames = (state.vascularGpuFeedbackWeakFrames ?? 0) + 1;
              state.vascularGpuFeedbackStatus = 'weak';
            }
            state.vascularGpuFeedbackReadbackFloatsPerAvoidedSecond = (state.vascularGpuFeedbackAvoidedCpuUpdateSeconds ?? 0) > 0
              ? (state.vascularGpuFeedbackReadbackFloatsTotal ?? 0) / Math.max(0.0001, state.vascularGpuFeedbackAvoidedCpuUpdateSeconds ?? 0)
              : 0;
            state.vascularGpuFeedbackCpuAvoidanceRatio = (state.vascularGpuFeedbackAssistedFrames ?? 0) > 0
              ? (state.vascularGpuFeedbackAvoidedCpuUpdateFrames ?? 0) / Math.max(1, state.vascularGpuFeedbackAssistedFrames ?? 0)
              : 0;
          } else {
            state.branchFieldSampleCount = 0;
            state.branchFieldSampleUploadFloats = 0;
            state.branchFieldSampleReadbackFloats = 0;
            state.branchFieldSampleFragmentPixels = 0;
            state.vascularFieldFeedbackEnergy = 0;
            state.vascularGpuFeedbackSampleCoverage = 0;
            state.vascularGpuFeedbackStatus = 'inactive';
          }
        } else {
          state.branchFieldSampleCount = 0;
          state.branchFieldSampleUploadFloats = 0;
          state.branchFieldSampleReadbackFloats = 0;
          state.branchFieldSampleFragmentPixels = 0;
          state.vascularFieldFeedbackEnergy = 0;
          state.vascularGpuFeedbackSampleCoverage = 0;
          state.vascularGpuFeedbackStatus = 'inactive';
        }
        gl.viewport(0, 0, state.width, state.height);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        const branchStyleUploadFloats = state.branchRenderer.renderPacked({
          width: state.width,
          height: state.height,
          color: [colors[0] ?? 1, colors[1] ?? 0.37, colors[2] ?? 0.56, 0.95],
          segmentData: branchSegmentData,
          styleData: branchStyleData,
          count: state.branchSegmentCount ?? 0,
          uploadSegmentData: false,
          uploadStyleData: uploadStyle,
          uploadStyleStart: state.branchStyleUploadStart ?? 0,
          uploadStyleCount: state.branchStyleUploadCount ?? state.branchSegmentCount ?? 0,
        });
        state.branchDrawCount = (state.branchDrawCount ?? 0) + (state.branchSegmentCount ?? 0);
        gpuUploadFloats += branchStyleUploadFloats;
        const markerUploadFloats = state.markerRenderer.renderPacked({
          width: state.width,
          height: state.height,
          color: [colors[6] ?? 1, colors[7] ?? 0.81, colors[8] ?? 0.43, 0.9],
          segmentData: markerSegmentData,
          styleData: markerStyleData,
          count: state.markerSegmentCount ?? 0,
          uploadSegmentData: uploadMarker,
          uploadStyleData: uploadMarker,
        });
        state.markerDrawCount = state.markerSegmentCount ?? 0;
        gpuUploadFloats += markerUploadFloats;
        state.branchGeometryUploadFloats = branchGeometryUploadFloats;
        state.branchGeometryUploadMode = uploadGeometry ? (fullGeometryUpload ? 'full' : 'append-range') : 'none';
        state.branchStyleUploadFloats = branchStyleUploadFloats;
        state.branchStyleUploadMode = branchStyleUploadMode;
        state.markerUploadFloats = markerUploadFloats;
        gpuUploadFloats += branchFieldUploadFloats;
        state.gpuUploadFloats = gpuUploadFloats;
        if (uploadGeometry) state.branchGeometryUploadedCount = branchSegmentCount;
        state.branchGeometryUploadStart = branchGeometryUploadStart;
        state.branchGeometryUploadCount = branchGeometryUploadCount;
        state.skippedGpuDraw = false;
        state.vascularNeedsRedraw = false;
        state.lastDrawWidth = state.width;
        state.lastDrawHeight = state.height;
      },
      getDebugStats: (rawState) => {
        const state = rawState as VascularState;
        const stats = state.model?.stats();
        const branchGpu = state.branchRenderer?.stats();
        const markerGpu = state.markerRenderer?.stats();
        const fieldGpu = state.branchField?.stats();
        return {
          renderer: 'raw-webgl2-gpu-instanced-vascular-tree',
          simulation: 'sparse-cpu-topology',
          rendering: 'gpu-instanced-vessels',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: true,
          textureUpload: 'none',
          gpuPasses: 3,
          nodes: stats?.nodes ?? 0,
          activeTips: stats?.activeTips ?? 0,
          segments: state.branchSegmentCount ?? 0,
          glowSegments: state.glowSegmentCount ?? 0,
          markerSegments: state.markerSegmentCount ?? 0,
          packedSegmentCapacity: state.segmentCapacity ?? 0,
          branchSegmentCapacity: branchGpu?.segmentCapacity ?? 0,
          branchSegmentDataFloats: branchGpu?.segmentDataFloats ?? 0,
          branchDrawCount: state.branchDrawCount ?? 0,
          branchLastDrawCount: branchGpu?.lastDrawCount ?? 0,
          markerSegmentCapacity: markerGpu?.segmentCapacity ?? 0,
          markerSegmentDataFloats: markerGpu?.segmentDataFloats ?? 0,
          markerDrawCount: state.markerDrawCount ?? 0,
          markerLastDrawCount: markerGpu?.lastDrawCount ?? 0,
          branchFieldResident: fieldGpu?.gpuFieldResident ?? false,
          branchFieldAdditiveBlend: fieldGpu?.additiveBlend ?? false,
          branchFieldResolutionTarget: state.branchFieldResolutionTarget ?? finiteNumberSetting(state.settings, 'resolution', preview ? 96 : 128),
          branchFieldScale: Math.round((state.branchFieldScale ?? vascularFieldScale(state, preview)) * 10000) / 10000,
          branchFieldWidth: state.branchFieldWidth ?? fieldGpu?.fieldWidth ?? 0,
          branchFieldHeight: state.branchFieldHeight ?? fieldGpu?.fieldHeight ?? 0,
          branchFieldFragmentPixels: state.branchFieldFragmentPixels ?? fieldGpu?.lastFragmentPixels ?? 0,
          branchFieldFeedbackPixels: state.branchFieldFeedbackPixels ?? fieldGpu?.lastFeedbackFragmentPixels ?? 0,
          branchFieldPersistentFeedback: fieldGpu?.persistentFeedback ?? false,
          branchFieldFeedbackDecay: state.branchFieldFeedbackDecay ?? fieldGpu?.feedbackDecay ?? 0,
          branchFieldFeedbackGpuAssisted: (state.branchFieldSampleCount ?? 0) > 0,
          branchFieldSampleCount: state.branchFieldSampleCount ?? 0,
          branchFieldSampleUploadFloats: state.branchFieldSampleUploadFloats ?? 0,
          branchFieldSampleReadbackFloats: state.branchFieldSampleReadbackFloats ?? 0,
          branchFieldSampleFragmentPixels: state.branchFieldSampleFragmentPixels ?? 0,
          vascularFieldFeedbackEnergy: Math.round((state.vascularFieldFeedbackEnergy ?? 0) * 10000) / 10000,
          vascularFieldInputImpulseCount: state.vascularFieldInputImpulseCount ?? fieldGpu?.fieldImpulseCount ?? 0,
          vascularFieldInputImpulsePixels: state.vascularFieldInputImpulsePixels ?? fieldGpu?.lastImpulseFragmentPixels ?? 0,
          vascularFieldInputImpulseMode: state.vascularFieldInputImpulseMode ?? 'none',
          vascularCpuUpdateSkippedByGpuFeedback: state.vascularCpuUpdateSkippedByGpuFeedback === true,
          vascularCpuUpdateMode: state.vascularCpuUpdateMode ?? 'cpu-topology-update',
          vascularCpuUpdateEffectiveDt: Math.round((state.vascularCpuUpdateEffectiveDt ?? 0) * 10000) / 10000,
          vascularGpuFeedbackThrottleSeconds: Math.round((state.vascularGpuFeedbackThrottleSeconds ?? 0) * 10000) / 10000,
          vascularGpuFeedbackThrottleWindow: Math.round((state.vascularGpuFeedbackThrottleWindow ?? 0) * 10000) / 10000,
          vascularGpuFeedbackThrottleSkips: state.vascularGpuFeedbackThrottleSkips ?? 0,
          vascularGpuFeedbackAvoidedCpuUpdateSeconds: Math.round((state.vascularGpuFeedbackAvoidedCpuUpdateSeconds ?? 0) * 10000) / 10000,
          vascularGpuFeedbackAvoidedCpuUpdateFrames: state.vascularGpuFeedbackAvoidedCpuUpdateFrames ?? 0,
          vascularGpuFeedbackAvoidedStyleScanNodes: state.vascularGpuFeedbackAvoidedStyleScanNodes ?? 0,
          vascularGpuFeedbackAssistedFrames: state.vascularGpuFeedbackAssistedFrames ?? 0,
          vascularGpuFeedbackUsefulFrames: state.vascularGpuFeedbackUsefulFrames ?? 0,
          vascularGpuFeedbackWeakFrames: state.vascularGpuFeedbackWeakFrames ?? 0,
          vascularGpuFeedbackSampleCoverage: Math.round((state.vascularGpuFeedbackSampleCoverage ?? 0) * 10000) / 10000,
          vascularGpuFeedbackSampleStart: state.vascularGpuFeedbackSampleStart ?? 0,
          vascularGpuFeedbackSampleStride: state.vascularGpuFeedbackSampleStride ?? 0,
          vascularGpuFeedbackStatus: state.vascularGpuFeedbackStatus ?? 'inactive',
          vascularGpuFeedbackHostFrameInterval: Math.round((state.vascularGpuFeedbackHostFrameInterval ?? 0) * 10000) / 10000,
          vascularGpuFeedbackHostGateReason: state.vascularGpuFeedbackHostGateReason ?? 'active',
          vascularGpuFeedbackReadbackFloatsTotal: state.vascularGpuFeedbackReadbackFloatsTotal ?? 0,
          vascularGpuFeedbackUploadFloatsTotal: state.vascularGpuFeedbackUploadFloatsTotal ?? 0,
          vascularGpuFeedbackReadbackFloatsPerAvoidedSecond: Math.round((state.vascularGpuFeedbackReadbackFloatsPerAvoidedSecond ?? 0) * 100) / 100,
          vascularGpuFeedbackCpuAvoidanceRatio: Math.round((state.vascularGpuFeedbackCpuAvoidanceRatio ?? 0) * 10000) / 10000,
          branchFieldSegmentCapacity: fieldGpu?.segmentCapacity ?? 0,
          branchFieldSegmentDataFloats: fieldGpu?.segmentDataFloats ?? 0,
          branchFieldStyleDataFloats: fieldGpu?.styleDataFloats ?? 0,
          branchFieldDrawCount: state.branchFieldDrawCount ?? fieldGpu?.lastDrawCount ?? 0,
          gpuUploadFloats: state.gpuUploadFloats ?? 0,
          branchGeometryUploadFloats: state.branchGeometryUploadFloats ?? 0,
          branchGeometryUploadMode: state.branchGeometryUploadMode ?? 'none',
          branchStyleUploadFloats: state.branchStyleUploadFloats ?? 0,
          branchStyleUploadMode: state.branchStyleUploadMode ?? 'none',
          branchFieldUploadFloats: state.branchFieldUploadFloats ?? fieldGpu?.lastUploadFloats ?? 0,
          branchStyleUploadStart: state.branchStyleUploadStart ?? 0,
          branchStyleUploadCount: state.branchStyleUploadCount ?? 0,
          branchStyleRepackCount: state.branchStyleRepackCount ?? 0,
          markerUploadFloats: state.markerUploadFloats ?? 0,
          branchGeometryUploadedCount: state.branchGeometryUploadedCount ?? 0,
          branchGeometryUploadStart: state.branchGeometryUploadStart ?? 0,
          branchGeometryUploadCount: state.branchGeometryUploadCount ?? 0,
          skippedBranchPackWalk: state.skippedBranchPackWalk ?? false,
          skippedStyleScan: state.skippedStyleScan ?? false,
          styleScanStart: state.styleScanStart ?? 0,
          styleScanCount: state.styleScanCount ?? 0,
          styleScanTotal: state.styleScanTotal ?? 0,
          styleScanEffectiveDt: Math.round((state.styleScanEffectiveDt ?? 0) * 10000) / 10000,
          styleScanBudgetScale: Math.round((state.styleScanBudgetScale ?? 1) * 10000) / 10000,
          styleScanAvoidedCount: state.styleScanAvoidedCount ?? 0,
          skippedGpuDraw: state.skippedGpuDraw ?? false,
          hostSkippedRenderFrames: state.skippedRenderFrames,
          hostPendingRenderDeltaSeconds: Math.round(state.pendingRenderDeltaSeconds * 10000) / 10000,
          vascularStyleDt: state.vascularStyleDt ?? 0,
          paletteUniformFloats: state.paletteData?.length ?? 0,
          backgroundUniformFloats: state.backgroundData?.length ?? 0,
        };
      },
      onDestroy: (rawState) => {
        const state = rawState as VascularState;
        state.cleanupPointer?.();
        state.branchRenderer?.destroy();
        state.branchField?.destroy();
        state.fieldSampler?.destroy();
        state.markerRenderer?.destroy();
      },
    });
  }
}
