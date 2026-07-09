export type AdvancedCollisionStressShape = 'ball' | 'pill' | 'box';

export interface AdvancedCollisionStressSettings {
  readonly shape: AdvancedCollisionStressShape;
  readonly maxParticles: number;
  readonly radius: number;
  readonly radiusVariation: number;
  readonly detail: number;
  readonly solverPasses: number;
  readonly substeps: number;
  readonly gravity: number;
  readonly wallBounce: boolean;
  readonly wallBounceCoefficient: number;
  readonly airDragPerSecond: number;
  readonly solverDampingPerSecond: number;
  readonly maxPairPushFactor: number;
  readonly contactFriction: number;
  readonly collisionSoftness: number;
  readonly impactBounceThreshold: number;
  readonly openTop: boolean;
}

export interface AdvancedCollisionStressStats {
  readonly particleCount: number;
  readonly dynamicParticleCount: number;
  readonly linkCount: number;
  readonly capsuleCount: number;
  readonly boxCount: number;
  readonly contacts: number;
  readonly pairs: number;
  readonly gridCellSize: number;
  readonly awake: boolean;
  readonly settledFrames: number;
  readonly maxVelocity: number;
}

export interface AdvancedCollisionStressRenderShapeBuffer {
  readonly data: Float32Array;
  readonly stride: number;
}

export interface AdvancedCollisionStressSpatialNeighborSlotStats {
  readonly particleCount: number;
  readonly slotCount: number;
  readonly slotWrites: number;
  readonly candidatePairs: number;
  readonly overflowCount: number;
  readonly stagingClearFloats: number;
  readonly stagingWriteFloats: number;
  readonly cellSize: number;
  readonly spatiallyComplete: boolean;
}

interface BoxData {
  cx: number;
  cy: number;
  axx: number;
  axy: number;
  ayx: number;
  ayy: number;
  hx: number;
  hy: number;
  start: number;
}

const EPS = 1e-6;
const MAX_LINK_MULTIPLIER = 2;
const BOX_CORNER_OFFSETS = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);

function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function writeSpatialNeighborSlot(slots: readonly Float32Array[], index: number, neighbor: number, rest: number, stiffness: number): boolean {
  const offset = index * 4;
  for (let slot = 0; slot < slots.length; slot += 1) {
    const data = slots[slot];
    if (offset + 3 >= data.length || data[offset + 3] > 0) continue;
    data[offset] = neighbor;
    data[offset + 1] = rest;
    data[offset + 2] = stiffness;
    data[offset + 3] = 1;
    return true;
  }
  return false;
}

class UniformGrid {
  readonly next: Int32Array;
  private head = new Int32Array(1);
  private columns = 1;
  private rows = 1;
  private cellSize = 16;

  constructor(maxItems: number) {
    this.next = new Int32Array(maxItems);
  }

  get cols(): number {
    return this.columns;
  }

  get rowCount(): number {
    return this.rows;
  }

  get cell(): number {
    return this.cellSize;
  }

  cellHead(index: number): number {
    return this.head[index];
  }

  configure(width: number, height: number, cellSize: number): void {
    this.cellSize = Math.max(2, finite(cellSize, 16));
    this.columns = Math.max(1, Math.ceil(width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(height / this.cellSize));
    const needed = this.columns * this.rows;
    if (this.head.length < needed) this.head = new Int32Array(needed);
    this.head.fill(-1, 0, needed);
  }

  insert(index: number, x: number, y: number): void {
    let cx = (x / this.cellSize) | 0;
    let cy = (y / this.cellSize) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.columns) cx = this.columns - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    const cellIndex = cx + cy * this.columns;
    this.next[index] = this.head[cellIndex];
    this.head[cellIndex] = index;
  }
}

const DEFAULT_SETTINGS: AdvancedCollisionStressSettings = {
  shape: 'ball',
  maxParticles: 50_000,
  radius: 4,
  radiusVariation: 0,
  detail: 8,
  solverPasses: 3,
  substeps: 2,
  gravity: 1300,
  wallBounce: false,
  wallBounceCoefficient: 0.18,
  airDragPerSecond: 0.998,
  solverDampingPerSecond: 0.982,
  maxPairPushFactor: 0.38,
  contactFriction: 0.72,
  collisionSoftness: 0.82,
  impactBounceThreshold: 150,
  openTop: false,
};

export class AdvancedCollisionStressEngine {
  readonly positions: Float32Array;
  readonly previousPositions: Float32Array;
  readonly velocities: Float32Array;
  readonly radii: Float32Array;
  readonly inverseMasses: Float32Array;
  readonly seeds: Float32Array;
  readonly groups: Int32Array;
  readonly locals: Int32Array;

  private readonly linkA: Int32Array;
  private readonly linkB: Int32Array;
  private readonly linkRest: Float32Array;
  private readonly linkStiffness: Float32Array;
  private readonly capsuleA: Int32Array;
  private readonly capsuleB: Int32Array;
  private readonly capsuleRadius: Float32Array;
  private readonly capsuleSeed: Float32Array;
  private readonly boxStart: Int32Array;
  private readonly boxSeed: Float32Array;
  private readonly boxHalfWidth: Float32Array;
  private readonly boxHalfHeight: Float32Array;
  private readonly particleGrid: UniformGrid;
  private readonly capsuleGrid: UniformGrid;
  private readonly boxGrid: UniformGrid;
  private readonly maxCapsules: number;
  private readonly maxBoxes: number;
  private settings: AdvancedCollisionStressSettings = DEFAULT_SETTINGS;
  private width = 1;
  private height = 1;
  private particleCount = 0;
  private activeLinkCount = 0;
  private activeCapsuleCount = 0;
  private activeBoxCount = 0;
  private nextGroupId = 1;
  private spawnAccumulator = 0;
  private randomState: number;
  private contactsLast = 0;
  private pairsLast = 0;
  private gridCellLast = 0;
  private awake = true;
  private settledFrames = 0;
  private stepMaxVelocity = 0;
  private lastMaxVelocity = 0;
  private readonly renderBox: BoxData = { cx: 0, cy: 0, axx: 1, axy: 0, ayx: 0, ayy: 1, hx: 1, hy: 1, start: 0 };
  private readonly scratchBoxA: BoxData = { cx: 0, cy: 0, axx: 1, axy: 0, ayx: 0, ayy: 1, hx: 1, hy: 1, start: 0 };
  private readonly scratchBoxB: BoxData = { cx: 0, cy: 0, axx: 1, axy: 0, ayx: 0, ayy: 1, hx: 1, hy: 1, start: 0 };
  private segmentS = 0;
  private segmentT = 0;
  private projectMin = 0;
  private projectMax = 0;
  private cornerHitNx = 0;
  private cornerHitNy = 0;
  private cornerHitPen = 0;

  constructor(readonly capacity: number, seed = 0x1234abcd) {
    const linkCapacity = Math.max(1024, capacity * MAX_LINK_MULTIPLIER);
    this.maxCapsules = Math.max(1, Math.floor(capacity / 2));
    this.maxBoxes = Math.max(1, Math.floor(capacity / 4));
    this.positions = new Float32Array(capacity * 2);
    this.previousPositions = new Float32Array(capacity * 2);
    this.velocities = new Float32Array(capacity * 2);
    this.radii = new Float32Array(capacity);
    this.inverseMasses = new Float32Array(capacity);
    this.seeds = new Float32Array(capacity);
    this.groups = new Int32Array(capacity);
    this.locals = new Int32Array(capacity);
    this.linkA = new Int32Array(linkCapacity);
    this.linkB = new Int32Array(linkCapacity);
    this.linkRest = new Float32Array(linkCapacity);
    this.linkStiffness = new Float32Array(linkCapacity);
    this.capsuleA = new Int32Array(this.maxCapsules);
    this.capsuleB = new Int32Array(this.maxCapsules);
    this.capsuleRadius = new Float32Array(this.maxCapsules);
    this.capsuleSeed = new Float32Array(this.maxCapsules);
    this.boxStart = new Int32Array(this.maxBoxes);
    this.boxSeed = new Float32Array(this.maxBoxes);
    this.boxHalfWidth = new Float32Array(this.maxBoxes);
    this.boxHalfHeight = new Float32Array(this.maxBoxes);
    this.particleGrid = new UniformGrid(capacity);
    this.capsuleGrid = new UniformGrid(this.maxCapsules);
    this.boxGrid = new UniformGrid(this.maxBoxes);
    this.groups.fill(-1);
    this.randomState = seed | 0;
  }

  get count(): number {
    return this.particleCount;
  }

  get isAwake(): boolean {
    return this.awake;
  }

  wake(): void {
    this.awake = this.particleCount > 0;
    this.settledFrames = 0;
  }

  configure(settings: Partial<AdvancedCollisionStressSettings>): void {
    const current = this.settings;
    const shape = settings.shape ?? current.shape;
    this.settings = {
      shape: shape === 'pill' || shape === 'box' ? shape : 'ball',
      maxParticles: Math.max(0, Math.min(this.capacity, Math.floor(finite(settings.maxParticles ?? current.maxParticles, DEFAULT_SETTINGS.maxParticles)))),
      radius: clamp(finite(settings.radius ?? current.radius, DEFAULT_SETTINGS.radius), 0.5, 128),
      radiusVariation: clamp(finite(settings.radiusVariation ?? current.radiusVariation, DEFAULT_SETTINGS.radiusVariation), 0, 1),
      detail: clamp(finite(settings.detail ?? current.detail, DEFAULT_SETTINGS.detail), 0, 64),
      solverPasses: Math.max(1, Math.min(16, Math.floor(finite(settings.solverPasses ?? current.solverPasses, DEFAULT_SETTINGS.solverPasses)))),
      substeps: Math.max(1, Math.min(8, Math.floor(finite(settings.substeps ?? current.substeps, DEFAULT_SETTINGS.substeps)))),
      gravity: finite(settings.gravity ?? current.gravity, DEFAULT_SETTINGS.gravity),
      wallBounce: settings.wallBounce ?? current.wallBounce,
      wallBounceCoefficient: clamp(finite(settings.wallBounceCoefficient ?? current.wallBounceCoefficient, DEFAULT_SETTINGS.wallBounceCoefficient), 0, 1),
      airDragPerSecond: clamp(finite(settings.airDragPerSecond ?? current.airDragPerSecond, DEFAULT_SETTINGS.airDragPerSecond), 0, 1),
      solverDampingPerSecond: clamp(finite(settings.solverDampingPerSecond ?? current.solverDampingPerSecond, DEFAULT_SETTINGS.solverDampingPerSecond), 0, 1),
      maxPairPushFactor: clamp(finite(settings.maxPairPushFactor ?? current.maxPairPushFactor, DEFAULT_SETTINGS.maxPairPushFactor), 0.02, 2),
      contactFriction: clamp(finite(settings.contactFriction ?? current.contactFriction, DEFAULT_SETTINGS.contactFriction), 0, 2),
      collisionSoftness: clamp(finite(settings.collisionSoftness ?? current.collisionSoftness, DEFAULT_SETTINGS.collisionSoftness), 0.05, 1.5),
      impactBounceThreshold: Math.max(0, finite(settings.impactBounceThreshold ?? current.impactBounceThreshold, DEFAULT_SETTINGS.impactBounceThreshold)),
      openTop: settings.openTop ?? current.openTop,
    };
    if (this.particleCount > this.settings.maxParticles) this.clear();
  }

  setBounds(width: number, height: number): void {
    const nextWidth = Math.max(1, finite(width, 1));
    const nextHeight = Math.max(1, finite(height, 1));
    if (Math.abs(nextWidth - this.width) > 0.01 || Math.abs(nextHeight - this.height) > 0.01) this.wake();
    this.width = nextWidth;
    this.height = nextHeight;
  }

  clear(): void {
    this.particleCount = 0;
    this.activeLinkCount = 0;
    this.activeCapsuleCount = 0;
    this.activeBoxCount = 0;
    this.nextGroupId = 1;
    this.spawnAccumulator = 0;
    this.contactsLast = 0;
    this.pairsLast = 0;
    this.awake = false;
    this.settledFrames = 0;
    this.lastMaxVelocity = 0;
  }

  removeCircleParticlesBelow(y: number): number {
    if (this.settings.shape !== 'ball' || this.particleCount <= 0) return 0;
    const threshold = finite(y, Infinity);
    let write = 0;
    const originalCount = this.particleCount;
    for (let read = 0; read < originalCount; read += 1) {
      const readK = read << 1;
      if (this.positions[readK + 1] > threshold) continue;
      if (write !== read) {
        const writeK = write << 1;
        this.positions[writeK] = this.positions[readK];
        this.positions[writeK + 1] = this.positions[readK + 1];
        this.previousPositions[writeK] = this.previousPositions[readK];
        this.previousPositions[writeK + 1] = this.previousPositions[readK + 1];
        this.velocities[writeK] = this.velocities[readK];
        this.velocities[writeK + 1] = this.velocities[readK + 1];
        this.radii[write] = this.radii[read];
        this.inverseMasses[write] = this.inverseMasses[read];
        this.seeds[write] = this.seeds[read];
        this.groups[write] = this.groups[read];
        this.locals[write] = this.locals[read];
      }
      write += 1;
    }
    this.particleCount = write;
    if (write !== originalCount) this.wake();
    return originalCount - write;
  }

  spawnBudget(particleBudget: number, x: number, y: number, power = 1, spreadScale = 1): number {
    let remaining = Math.max(0, Math.floor(particleBudget));
    let spawnedParticles = 0;
    let guard = 0;
    while (remaining > 0 && guard < 12_000) {
      guard += 1;
      const cost = this.spawnOne(x, y, power, spreadScale);
      if (!Number.isFinite(cost)) break;
      remaining -= Math.max(1, cost);
      spawnedParticles += cost;
    }
    if (spawnedParticles > 0) this.wake();
    return spawnedParticles;
  }

  spawnRate(rate: number, deltaSeconds: number, x: number, y: number, spreadScale = 1): number {
    this.spawnAccumulator += Math.max(0, rate) * Math.max(0, deltaSeconds);
    let spawned = 0;
    let guard = 0;
    while (this.spawnAccumulator >= this.spawnCostEstimate() && guard < 12_000) {
      guard += 1;
      const cost = this.spawnOne(x, y, 1, spreadScale);
      if (!Number.isFinite(cost)) {
        this.spawnAccumulator = 0;
        break;
      }
      this.spawnAccumulator -= Math.max(1, cost);
      spawned += cost;
    }
    if (spawned > 0) this.wake();
    return spawned;
  }

  step(deltaSeconds: number): AdvancedCollisionStressStats {
    if (this.particleCount <= 0) return this.stats();
    if (!this.awake) return this.stats();
    const dt = clamp(finite(deltaSeconds, 0), 0, 1 / 30);
    if (dt <= 0) return this.stats();
    const substeps = this.settings.substeps;
    const stepDt = dt / substeps;
    this.contactsLast = 0;
    this.pairsLast = 0;
    this.stepMaxVelocity = 0;

    for (let substep = 0; substep < substeps; substep += 1) {
      this.integrate(stepDt);
      for (let pass = 0; pass < this.settings.solverPasses; pass += 1) {
        const passFrac = pass / Math.max(1, this.settings.solverPasses - 1);
        const relax = 0.76 - 0.16 * passFrac;
        if (this.settings.shape === 'pill') {
          this.solveLinks();
          this.solveWalls();
          const cell = Math.max(16, this.settings.radius * (this.settings.detail + 2.6));
          this.gridCellLast = cell;
          this.rebuildCapsuleGrid(cell);
          this.solveCapsuleCollisions(relax);
          this.solveLinks();
          this.solveWalls();
        } else if (this.settings.shape === 'box') {
          this.solveLinks();
          this.stabilizeBoxes(0.18);
          this.solveWalls();
          const cell = Math.max(18, this.settings.radius * (this.settings.detail / 3 + 4));
          this.gridCellLast = cell;
          this.rebuildBoxGrid(cell);
          this.solveBoxCollisions(0.68);
          this.solveLinks();
          this.stabilizeBoxes(0.12);
          this.solveWalls();
        } else {
          this.solveWalls();
          const cell = Math.max(5, this.maxCircleParticleRadius() * 2.4);
          this.gridCellLast = cell;
          this.rebuildParticleGrid(cell);
          this.solveCircleCollisions(relax);
          this.solveWalls();
        }
      }
      this.finalizeVelocities(stepDt);
    }

    this.lastMaxVelocity = this.stepMaxVelocity;
    if (this.lastMaxVelocity < 8) {
      this.settledFrames += 1;
      if (this.settledFrames > 50) {
        this.awake = false;
        this.zeroVelocities();
      }
    } else {
      this.settledFrames = 0;
    }
    return this.stats();
  }

  writeRenderShapes(buffer: AdvancedCollisionStressRenderShapeBuffer): number {
    const data = buffer.data;
    const stride = buffer.stride;
    let n = 0;
    if (this.settings.shape === 'pill') {
      for (let i = 0; i < this.activeCapsuleCount; i += 1) {
        const a = this.capsuleA[i];
        const b = this.capsuleB[i];
        const ak = a << 1;
        const bk = b << 1;
        const dx = this.positions[bk] - this.positions[ak];
        const dy = this.positions[bk + 1] - this.positions[ak + 1];
        const len = Math.max(0.0001, Math.sqrt(dx * dx + dy * dy));
        this.writeShape(data, stride, n, (this.positions[ak] + this.positions[bk]) * 0.5, (this.positions[ak + 1] + this.positions[bk + 1]) * 0.5, dx / len, dy / len, len * 0.5, 0, this.capsuleRadius[i], 1, this.capsuleSeed[i]);
        n += 1;
      }
      return n;
    }

    if (this.settings.shape === 'box') {
      const box = this.renderBox;
      for (let i = 0; i < this.activeBoxCount; i += 1) {
        if (!this.readBox(i, box)) continue;
        this.writeShape(data, stride, n, box.cx, box.cy, box.axx, box.axy, box.hx, box.hy, Math.max(1, this.settings.radius * 0.12), 2, this.boxSeed[i]);
        n += 1;
      }
      return n;
    }

    for (let i = 0; i < this.particleCount; i += 1) {
      const k = i << 1;
      this.writeShape(data, stride, n, this.positions[k], this.positions[k + 1], 1, 0, 0, 0, this.radii[i], 0, this.seeds[i]);
      n += 1;
    }
    return n;
  }

  writeCircleParticleInstances(data: Float32Array, stride = 4): number {
    if (this.settings.shape !== 'ball' || stride < 4) return 0;
    const count = Math.min(this.particleCount, Math.floor(data.length / stride));
    for (let i = 0; i < count; i += 1) {
      const source = i << 1;
      const target = i * stride;
      data[target] = this.positions[source];
      data[target + 1] = this.positions[source + 1];
      data[target + 2] = this.radii[i];
      data[target + 3] = this.seeds[i];
    }
    return count;
  }

  writeCircleParticlePositions(data: Float32Array, stride = 2): number {
    if (this.settings.shape !== 'ball' || stride < 2) return 0;
    const count = Math.min(this.particleCount, Math.floor(data.length / stride));
    for (let i = 0; i < count; i += 1) {
      const source = i << 1;
      const target = i * stride;
      data[target] = this.positions[source];
      data[target + 1] = this.positions[source + 1];
    }
    return count;
  }

  writeCircleParticleStyles(data: Float32Array, stride = 2): number {
    if (this.settings.shape !== 'ball' || stride < 2) return 0;
    const count = Math.min(this.particleCount, Math.floor(data.length / stride));
    for (let i = 0; i < count; i += 1) {
      const target = i * stride;
      data[target] = this.radii[i];
      data[target + 1] = this.seeds[i];
    }
    return count;
  }

  writeCircleParticleStylesRange(data: Float32Array, stride = 2, start = 0, count = this.particleCount - start): number {
    if (this.settings.shape !== 'ball' || stride < 2) return 0;
    const first = Math.max(0, Math.floor(start));
    const maxCount = Math.min(this.particleCount, Math.floor(data.length / stride));
    if (first >= maxCount) return 0;
    const end = Math.min(maxCount, first + Math.max(0, Math.floor(count)));
    for (let i = first; i < end; i += 1) {
      const target = i * stride;
      data[target] = this.radii[i];
      data[target + 1] = this.seeds[i];
    }
    return end - first;
  }

  writeCircleParticleGpuPositions(data: Float32Array, clearCapacity = this.particleCount): number {
    if (this.settings.shape !== 'ball') return 0;
    const maxCount = Math.floor(data.length / 4);
    const count = Math.min(this.particleCount, maxCount);
    const clearCount = Math.min(maxCount, Math.max(count, Math.floor(clearCapacity)));
    for (let i = 0; i < count; i += 1) {
      const source = i << 1;
      const target = i * 4;
      data[target] = this.positions[source];
      data[target + 1] = this.positions[source + 1];
      data[target + 2] = this.radii[i];
      data[target + 3] = this.seeds[i];
    }
    for (let i = count; i < clearCount; i += 1) {
      const target = i * 4;
      data[target] = 0;
      data[target + 1] = 0;
      data[target + 2] = 0;
      data[target + 3] = 0;
    }
    return count;
  }

  writeCircleParticleGpuAttributes(data: Float32Array, clearCapacity = this.particleCount): number {
    if (this.settings.shape !== 'ball') return 0;
    const maxCount = Math.floor(data.length / 4);
    const count = Math.min(this.particleCount, maxCount);
    const clearCount = Math.min(maxCount, Math.max(count, Math.floor(clearCapacity)));
    for (let i = 0; i < count; i += 1) {
      const target = i * 4;
      data[target] = this.radii[i];
      data[target + 1] = this.inverseMasses[i];
      data[target + 2] = this.locals[i];
      data[target + 3] = this.seeds[i];
    }
    for (let i = count; i < clearCount; i += 1) {
      const target = i * 4;
      data[target] = 0;
      data[target + 1] = 0;
      data[target + 2] = 0;
      data[target + 3] = 0;
    }
    return count;
  }

  writeCircleParticleGpuAttributesRange(data: Float32Array, start = 0, count = this.particleCount - start): number {
    if (this.settings.shape !== 'ball') return 0;
    const maxCount = Math.floor(data.length / 4);
    const first = Math.max(0, Math.min(maxCount, Math.floor(start)));
    const end = Math.max(first, Math.min(maxCount, first + Math.max(0, Math.floor(count))));
    for (let i = first; i < end; i += 1) {
      const target = i * 4;
      if (i < this.particleCount) {
        data[target] = this.radii[i];
        data[target + 1] = this.inverseMasses[i];
        data[target + 2] = this.locals[i];
        data[target + 3] = this.seeds[i];
      } else {
        data[target] = 0;
        data[target + 1] = 0;
        data[target + 2] = 0;
        data[target + 3] = 0;
      }
    }
    return end - first;
  }

  writeCircleParticleSpatialNeighborSlots(slots: readonly Float32Array[], clearCapacity = this.particleCount, radiusScale = 1.08): AdvancedCollisionStressSpatialNeighborSlotStats {
    if (this.settings.shape !== 'ball' || slots.length <= 0 || this.particleCount <= 0) {
      return {
        particleCount: this.settings.shape === 'ball' ? this.particleCount : 0,
        slotCount: slots.length,
        slotWrites: 0,
        candidatePairs: 0,
        overflowCount: 0,
        stagingClearFloats: 0,
        stagingWriteFloats: 0,
        cellSize: 0,
        spatiallyComplete: true,
      };
    }
    const maxCount = Math.min(
      this.particleCount,
      ...slots.map((slot) => Math.floor(slot.length / 4)),
    );
    const clearCount = Math.min(
      Math.max(0, Math.floor(clearCapacity)),
      ...slots.map((slot) => Math.floor(slot.length / 4)),
    );
    for (let slot = 0; slot < slots.length; slot += 1) {
      const data = slots[slot];
      data.fill(0, 0, clearCount * 4);
      for (let index = 0; index < clearCount; index += 1) {
        const target = index * 4;
        data[target] = -1;
      }
    }
    const stagingClearFloats = clearCount * slots.length * 4;
    if (maxCount <= 0) {
      return {
        particleCount: 0,
        slotCount: slots.length,
        slotWrites: 0,
        candidatePairs: 0,
        overflowCount: 0,
        stagingClearFloats,
        stagingWriteFloats: 0,
        cellSize: 0,
        spatiallyComplete: true,
      };
    }
    const scaledRadius = Math.max(0.001, this.maxCircleParticleRadius() * Math.max(0.1, finite(radiusScale, 1.08)));
    const cellSize = Math.max(8, scaledRadius * 2.35);
    this.rebuildParticleGrid(cellSize);
    const grid = this.particleGrid;
    const columns = grid.cols;
    const rows = grid.rowCount;
    let candidatePairs = 0;
    let slotWrites = 0;
    let overflowCount = 0;
    const writePair = (i: number, j: number): void => {
      if (i >= maxCount || j >= maxCount) return;
      const ik = i << 1;
      const jk = j << 1;
      const dx = this.positions[jk] - this.positions[ik];
      const dy = this.positions[jk + 1] - this.positions[ik + 1];
      const rest = (this.radii[i] + this.radii[j]) * Math.max(0.1, finite(radiusScale, 1.08));
      if (dx * dx + dy * dy > rest * rest) return;
      candidatePairs += 1;
      if (writeSpatialNeighborSlot(slots, i, j, rest, 1)) slotWrites += 1;
      else overflowCount += 1;
      if (writeSpatialNeighborSlot(slots, j, i, rest, 1)) slotWrites += 1;
      else overflowCount += 1;
    };
    for (let cy = 0; cy < rows; cy += 1) {
      const row = cy * columns;
      const nextRow = row + columns;
      for (let cx = 0; cx < columns; cx += 1) {
        const cell = row + cx;
        if (grid.cellHead(cell) === -1) continue;
        for (let i = grid.cellHead(cell); i !== -1; i = grid.next[i]) {
          for (let j = grid.next[i]; j !== -1; j = grid.next[j]) writePair(i, j);
        }
        if (cx + 1 < columns) {
          for (let i = grid.cellHead(cell); i !== -1; i = grid.next[i]) {
            for (let j = grid.cellHead(cell + 1); j !== -1; j = grid.next[j]) writePair(i, j);
          }
        }
        if (cy + 1 < rows) {
          for (let i = grid.cellHead(cell); i !== -1; i = grid.next[i]) {
            for (let j = grid.cellHead(nextRow + cx); j !== -1; j = grid.next[j]) writePair(i, j);
          }
          if (cx > 0) {
            for (let i = grid.cellHead(cell); i !== -1; i = grid.next[i]) {
              for (let j = grid.cellHead(nextRow + cx - 1); j !== -1; j = grid.next[j]) writePair(i, j);
            }
          }
          if (cx + 1 < columns) {
            for (let i = grid.cellHead(cell); i !== -1; i = grid.next[i]) {
              for (let j = grid.cellHead(nextRow + cx + 1); j !== -1; j = grid.next[j]) writePair(i, j);
            }
          }
        }
      }
    }
    return {
      particleCount: maxCount,
      slotCount: slots.length,
      slotWrites,
      candidatePairs,
      overflowCount,
      stagingClearFloats,
      stagingWriteFloats: slotWrites * 4,
      cellSize,
      spatiallyComplete: overflowCount <= 0,
    };
  }

  private writeShape(data: Float32Array, stride: number, index: number, cx: number, cy: number, ax: number, ay: number, halfLength: number, halfWidth: number, radius: number, kind: number, seed: number): void {
    const offset = index * stride;
    data[offset] = cx;
    data[offset + 1] = cy;
    data[offset + 2] = ax;
    data[offset + 3] = ay;
    data[offset + 4] = halfLength;
    data[offset + 5] = halfWidth;
    data[offset + 6] = radius;
    data[offset + 7] = kind;
    data[offset + 8] = seed;
  }

  private maxCircleParticleRadius(): number {
    if (this.settings.shape !== 'ball' || this.particleCount <= 0) return this.settings.radius;
    let maxRadius = Math.max(0.5, this.settings.radius);
    for (let i = 0; i < this.particleCount; i += 1) {
      const radius = this.radii[i];
      if (Number.isFinite(radius) && radius > maxRadius) maxRadius = radius;
    }
    return maxRadius;
  }

  private spawnOne(x: number, y: number, power: number, spreadScale: number): number {
    if (this.settings.shape === 'pill') return this.spawnCapsule(x, y);
    if (this.settings.shape === 'box') return this.spawnBox(x, y);
    return this.spawnCircle(x, y, power, spreadScale);
  }

  private spawnCostEstimate(): number {
    if (this.settings.shape === 'pill') return 2;
    if (this.settings.shape === 'box') return 4;
    return 1;
  }

  private spawnCircle(cx: number, cy: number, power: number, spreadScale: number): number {
    const baseRadius = this.settings.radius;
    const radiusVariation = this.settings.radiusVariation;
    const radius = Math.max(0.5, baseRadius * (1 + this.range(-radiusVariation, radiusVariation)));
    const spread = radius * 2.8 * clamp(finite(spreadScale, 1), 0, 1);
    const minY = this.settings.openTop ? -radius * 12 : radius + 1;
    const x = clamp(cx + this.range(-spread, spread), radius + 1, this.width - radius - 1);
    const y = clamp(cy + this.range(-spread, spread), minY, this.height - radius - 1);
    const particle = this.addParticle(x, y, radius, 1, this.range(0, 10_000), -1, 0);
    if (particle < 0) return Infinity;
    const k = particle << 1;
    this.velocities[k] = this.range(-90, 90) * power;
    this.velocities[k + 1] = this.range(-60, 80) * power;
    return 1;
  }

  private spawnCapsule(cx: number, cy: number): number {
    if (this.particleCount + 2 > this.settings.maxParticles || this.activeCapsuleCount >= this.maxCapsules || this.activeLinkCount >= this.linkA.length) return Infinity;
    const radius = this.settings.radius;
    const segmentLength = Math.max(radius * 2.2, radius * this.settings.detail);
    const angle = this.range(-0.35, 0.35);
    const hx = Math.cos(angle) * segmentLength * 0.5;
    const hy = Math.sin(angle) * segmentLength * 0.5;
    const spread = radius * 3;
    const x = clamp(cx + this.range(-spread, spread), radius + segmentLength * 0.5 + 1, this.width - radius - segmentLength * 0.5 - 1);
    const y = clamp(cy + this.range(-spread, spread), radius + 1, this.height - radius - 1);
    const group = this.nextGroupId;
    this.nextGroupId += 1;
    const seed = this.range(0, 10_000);
    const a = this.addParticle(x - hx, y - hy, radius, 1, seed, group, 0);
    const b = this.addParticle(x + hx, y + hy, radius, 1, seed, group, 1);
    if (a < 0 || b < 0) return Infinity;
    this.setPairVelocity(a, b, this.range(-55, 55), this.range(-30, 70));
    this.addLink(a, b, segmentLength, 0.98);
    const capsule = this.activeCapsuleCount;
    this.activeCapsuleCount += 1;
    this.capsuleA[capsule] = a;
    this.capsuleB[capsule] = b;
    this.capsuleRadius[capsule] = radius;
    this.capsuleSeed[capsule] = seed;
    return 2;
  }

  private spawnBox(cx: number, cy: number): number {
    if (this.particleCount + 4 > this.settings.maxParticles || this.activeLinkCount + 6 > this.linkA.length || this.activeBoxCount >= this.maxBoxes) return Infinity;
    const base = this.settings.radius;
    const aspect = clamp(this.settings.detail / 10, 0.25, 2.8);
    const hx = base * Math.max(0.8, aspect) * this.range(0.85, 1.15);
    const hy = base * Math.max(0.65, 1 / Math.sqrt(aspect)) * this.range(0.85, 1.15);
    const angle = this.range(-0.65, 0.65);
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const x = clamp(cx + this.range(-base * 2, base * 2), hx + hy + 1, this.width - hx - hy - 1);
    const y = clamp(cy + this.range(-base * 2, base * 2), hx + hy + 1, this.height - hx - hy - 1);
    const group = this.nextGroupId;
    this.nextGroupId += 1;
    const seed = this.range(0, 10_000);
    const start = this.particleCount;
    for (let i = 0; i < 4; i += 1) {
      const cornerOffset = i << 1;
      const cornerX = BOX_CORNER_OFFSETS[cornerOffset] * hx;
      const cornerY = BOX_CORNER_OFFSETS[cornerOffset + 1] * hy;
      const p = this.addParticle(x + ca * cornerX - sa * cornerY, y + sa * cornerX + ca * cornerY, 0, 1, seed, group, i);
      if (p < 0) return Infinity;
      const k = p << 1;
      this.velocities[k] = this.range(-45, 45);
      this.velocities[k + 1] = this.range(-18, 55);
    }
    this.addLink(start, start + 1, hx * 2, 0.96);
    this.addLink(start + 1, start + 2, hy * 2, 0.96);
    this.addLink(start + 2, start + 3, hx * 2, 0.96);
    this.addLink(start + 3, start, hy * 2, 0.96);
    const diagonal = Math.sqrt(hx * hx * 4 + hy * hy * 4);
    this.addLink(start, start + 2, diagonal, 0.96);
    this.addLink(start + 1, start + 3, diagonal, 0.96);
    const box = this.activeBoxCount;
    this.activeBoxCount += 1;
    this.boxStart[box] = start;
    this.boxSeed[box] = seed;
    this.boxHalfWidth[box] = hx;
    this.boxHalfHeight[box] = hy;
    return 4;
  }

  private addParticle(x: number, y: number, radius: number, inverseMass: number, seed: number, group: number, local: number): number {
    if (this.particleCount >= this.settings.maxParticles) return -1;
    const index = this.particleCount;
    this.particleCount += 1;
    const k = index << 1;
    this.positions[k] = x;
    this.positions[k + 1] = y;
    this.previousPositions[k] = x;
    this.previousPositions[k + 1] = y;
    this.velocities[k] = this.range(-30, 30);
    this.velocities[k + 1] = this.range(-25, 25);
    this.radii[index] = radius;
    this.inverseMasses[index] = inverseMass;
    this.seeds[index] = seed;
    this.groups[index] = group;
    this.locals[index] = local;
    return index;
  }

  private addLink(a: number, b: number, rest: number, stiffness: number): void {
    if (a < 0 || b < 0 || this.activeLinkCount >= this.linkA.length) return;
    const index = this.activeLinkCount;
    this.activeLinkCount += 1;
    this.linkA[index] = a;
    this.linkB[index] = b;
    this.linkRest[index] = rest;
    this.linkStiffness[index] = stiffness;
  }

  private setPairVelocity(a: number, b: number, vx: number, vy: number): void {
    const ak = a << 1;
    const bk = b << 1;
    this.velocities[ak] = vx;
    this.velocities[ak + 1] = vy;
    this.velocities[bk] = vx;
    this.velocities[bk + 1] = vy;
  }

  private integrate(dt: number): void {
    const drag = Math.pow(this.settings.airDragPerSecond, dt * 60);
    for (let i = 0; i < this.particleCount; i += 1) {
      if (this.inverseMasses[i] <= 0) continue;
      const k = i << 1;
      this.previousPositions[k] = this.positions[k];
      this.previousPositions[k + 1] = this.positions[k + 1];
      this.velocities[k] *= drag;
      this.velocities[k + 1] = this.velocities[k + 1] * drag + this.settings.gravity * dt;
      this.positions[k] += this.velocities[k] * dt;
      this.positions[k + 1] += this.velocities[k + 1] * dt;
    }
  }

  private solveWalls(): void {
    for (let i = 0; i < this.particleCount; i += 1) {
      if (this.inverseMasses[i] <= 0) continue;
      const k = i << 1;
      const radius = this.radii[i];
      this.positions[k] = clamp(this.positions[k], radius, this.width - radius);
      const top = this.settings.openTop ? -radius * 16 : radius;
      this.positions[k + 1] = clamp(this.positions[k + 1], top, this.height - radius);
    }
  }

  private finalizeVelocities(dt: number): void {
    const invDt = 1 / Math.max(dt, EPS);
    const bounce = this.settings.wallBounce ? this.settings.wallBounceCoefficient : 0;
    const maxSpeed = 5200;
    for (let i = 0; i < this.particleCount; i += 1) {
      if (this.inverseMasses[i] <= 0) continue;
      const k = i << 1;
      const radius = this.radii[i];
      const damping = Math.pow(this.settings.solverDampingPerSecond, dt * 60);
      const wallFriction = Math.max(0, 1 - this.settings.contactFriction * 0.12);
      let vx = (this.positions[k] - this.previousPositions[k]) * invDt * damping;
      let vy = (this.positions[k + 1] - this.previousPositions[k + 1]) * invDt * damping;
      if (this.positions[k] <= radius + 0.25 && vx < 0) {
        vx = -vx > this.settings.impactBounceThreshold ? -vx * bounce : 0;
        vy *= wallFriction;
      } else if (this.positions[k] >= this.width - radius - 0.25 && vx > 0) {
        vx = vx > this.settings.impactBounceThreshold ? -vx * bounce : 0;
        vy *= wallFriction;
      }
      if (!this.settings.openTop && this.positions[k + 1] <= radius + 0.25 && vy < 0) {
        vy = -vy > this.settings.impactBounceThreshold ? -vy * bounce : 0;
        vx *= wallFriction;
      } else if (this.positions[k + 1] >= this.height - radius - 0.25 && vy > 0) {
        vy = vy > this.settings.impactBounceThreshold ? -vy * bounce : 0;
        vx *= wallFriction;
      }
      const speed2 = vx * vx + vy * vy;
      if (speed2 > maxSpeed * maxSpeed) {
        const scale = maxSpeed / Math.sqrt(speed2);
        vx *= scale;
        vy *= scale;
      }
      this.velocities[k] = vx;
      this.velocities[k + 1] = vy;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > this.stepMaxVelocity) this.stepMaxVelocity = speed;
    }
  }

  private zeroVelocities(): void {
    for (let i = 0; i < this.particleCount; i += 1) {
      const k = i << 1;
      this.velocities[k] = 0;
      this.velocities[k + 1] = 0;
      this.previousPositions[k] = this.positions[k];
      this.previousPositions[k + 1] = this.positions[k + 1];
    }
  }

  private solveLinks(): void {
    for (let i = 0; i < this.activeLinkCount; i += 1) {
      const a = this.linkA[i];
      const b = this.linkB[i];
      const ak = a << 1;
      const bk = b << 1;
      const dx = this.positions[bk] - this.positions[ak];
      const dy = this.positions[bk + 1] - this.positions[ak + 1];
      const d2 = dx * dx + dy * dy;
      if (d2 < EPS) continue;
      const distance = Math.sqrt(d2);
      const wa = this.inverseMasses[a];
      const wb = this.inverseMasses[b];
      const ws = wa + wb;
      if (ws <= 0) continue;
      const correction = ((distance - this.linkRest[i]) / distance) * this.linkStiffness[i];
      const cx = dx * correction;
      const cy = dy * correction;
      this.positions[ak] += cx * (wa / ws);
      this.positions[ak + 1] += cy * (wa / ws);
      this.positions[bk] -= cx * (wb / ws);
      this.positions[bk + 1] -= cy * (wb / ws);
    }
  }

  private rebuildParticleGrid(cellSize: number): void {
    this.particleGrid.configure(this.width, this.height, cellSize);
    for (let i = 0; i < this.particleCount; i += 1) {
      const k = i << 1;
      this.particleGrid.insert(i, this.positions[k], this.positions[k + 1]);
    }
  }

  private solveCircleCollisions(relax: number): void {
    const grid = this.particleGrid;
    const columns = grid.cols;
    const rows = grid.rowCount;
    for (let cy = 0; cy < rows; cy += 1) {
      const row = cy * columns;
      const nextRow = row + columns;
      for (let cx = 0; cx < columns; cx += 1) {
        const cell = row + cx;
        if (grid.cellHead(cell) === -1) continue;
        this.solveCircleSelfCell(cell, relax);
        if (cx + 1 < columns) this.solveCircleCellPair(cell, cell + 1, relax);
        if (cy + 1 < rows) {
          this.solveCircleCellPair(cell, nextRow + cx, relax);
          if (cx > 0) this.solveCircleCellPair(cell, nextRow + cx - 1, relax);
          if (cx + 1 < columns) this.solveCircleCellPair(cell, nextRow + cx + 1, relax);
        }
      }
    }
  }

  private solveCircleSelfCell(cell: number, relax: number): void {
    const grid = this.particleGrid;
    for (let i = grid.cellHead(cell); i !== -1; i = grid.next[i]) {
      for (let j = grid.next[i]; j !== -1; j = grid.next[j]) {
        this.pairsLast += 1;
        if (this.solveCirclePair(i, j, relax)) this.contactsLast += 1;
      }
    }
  }

  private solveCircleCellPair(cellA: number, cellB: number, relax: number): void {
    const grid = this.particleGrid;
    for (let i = grid.cellHead(cellA); i !== -1; i = grid.next[i]) {
      for (let j = grid.cellHead(cellB); j !== -1; j = grid.next[j]) {
        this.pairsLast += 1;
        if (this.solveCirclePair(i, j, relax)) this.contactsLast += 1;
      }
    }
  }

  private solveCirclePair(i: number, j: number, relax: number): boolean {
    const ik = i << 1;
    const jk = j << 1;
    let dx = this.positions[jk] - this.positions[ik];
    let dy = this.positions[jk + 1] - this.positions[ik + 1];
    const rr = this.radii[i] + this.radii[j];
    let d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return false;
    let distance = Math.sqrt(Math.max(d2, EPS));
    if (distance < 0.0001) {
      const angle = (i * 12.9898 + j * 78.233) % (Math.PI * 2);
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      distance = 1;
    } else {
      dx /= distance;
      dy /= distance;
    }
    const wi = this.particleWeight(i);
    const wj = this.particleWeight(j);
    const ws = wi + wj;
    if (ws <= 0) return false;
    const invWeight = 1 / ws;
    const totalPush = (rr - distance) * this.settings.collisionSoftness * relax;
    const maxPush = rr * 0.5 * this.settings.maxPairPushFactor;
    const pushI = Math.min(totalPush * wi * invWeight, maxPush);
    const pushJ = Math.min(totalPush * wj * invWeight, maxPush);
    this.positions[ik] -= dx * pushI;
    this.positions[ik + 1] -= dy * pushI;
    this.positions[jk] += dx * pushJ;
    this.positions[jk + 1] += dy * pushJ;
    this.applyCircleContactFriction(i, j, dx, dy, wi, wj, invWeight);
    return true;
  }

  private applyCircleContactFriction(i: number, j: number, normalX: number, normalY: number, wi: number, wj: number, invWeight: number): void {
    const friction = this.settings.contactFriction;
    if (friction <= 0) return;
    const ik = i << 1;
    const jk = j << 1;
    const tangentX = -normalY;
    const tangentY = normalX;
    const viT = (this.positions[ik] - this.previousPositions[ik]) * tangentX + (this.positions[ik + 1] - this.previousPositions[ik + 1]) * tangentY;
    const vjT = (this.positions[jk] - this.previousPositions[jk]) * tangentX + (this.positions[jk + 1] - this.previousPositions[jk + 1]) * tangentY;
    const relativeTangent = vjT - viT;
    if (relativeTangent > -1e-5 && relativeTangent < 1e-5) return;
    const tangentImpulse = relativeTangent * Math.min(0.62, friction * 0.48);
    if (wi > 0) {
      const correction = tangentImpulse * wi * invWeight;
      this.previousPositions[ik] -= tangentX * correction;
      this.previousPositions[ik + 1] -= tangentY * correction;
    }
    if (wj > 0) {
      const correction = tangentImpulse * wj * invWeight;
      this.previousPositions[jk] += tangentX * correction;
      this.previousPositions[jk + 1] += tangentY * correction;
    }
  }

  private rebuildCapsuleGrid(cellSize: number): void {
    this.capsuleGrid.configure(this.width, this.height, cellSize);
    for (let i = 0; i < this.activeCapsuleCount; i += 1) {
      const a = this.capsuleA[i] << 1;
      const b = this.capsuleB[i] << 1;
      this.capsuleGrid.insert(i, (this.positions[a] + this.positions[b]) * 0.5, (this.positions[a + 1] + this.positions[b + 1]) * 0.5);
    }
  }

  private solveCapsuleCollisions(relax: number): void {
    const grid = this.capsuleGrid;
    const columns = grid.cols;
    const rows = grid.rowCount;
    for (let cy = 0; cy < rows; cy += 1) {
      const row = cy * columns;
      const nextRow = row + columns;
      for (let cx = 0; cx < columns; cx += 1) {
        const cell = row + cx;
        if (grid.cellHead(cell) === -1) continue;
        this.solveCapsuleSelfCell(cell, relax);
        if (cx + 1 < columns) this.solveCapsuleCellPair(cell, cell + 1, relax);
        if (cy + 1 < rows) {
          this.solveCapsuleCellPair(cell, nextRow + cx, relax);
          if (cx > 0) this.solveCapsuleCellPair(cell, nextRow + cx - 1, relax);
          if (cx + 1 < columns) this.solveCapsuleCellPair(cell, nextRow + cx + 1, relax);
        }
      }
    }
  }

  private solveCapsuleSelfCell(cell: number, relax: number): void {
    const grid = this.capsuleGrid;
    for (let i = grid.cellHead(cell); i !== -1; i = grid.next[i]) {
      for (let j = grid.next[i]; j !== -1; j = grid.next[j]) {
        this.pairsLast += 1;
        if (this.solveCapsulePair(i, j, relax)) this.contactsLast += 1;
      }
    }
  }

  private solveCapsuleCellPair(cellA: number, cellB: number, relax: number): void {
    const grid = this.capsuleGrid;
    for (let i = grid.cellHead(cellA); i !== -1; i = grid.next[i]) {
      for (let j = grid.cellHead(cellB); j !== -1; j = grid.next[j]) {
        this.pairsLast += 1;
        if (this.solveCapsulePair(i, j, relax)) this.contactsLast += 1;
      }
    }
  }

  private solveCapsulePair(i: number, j: number, relax: number): boolean {
    const a0 = this.capsuleA[i];
    const a1 = this.capsuleB[i];
    const b0 = this.capsuleA[j];
    const b1 = this.capsuleB[j];
    const a0k = a0 << 1;
    const a1k = a1 << 1;
    const b0k = b0 << 1;
    const b1k = b1 << 1;
    this.segmentParameters(this.positions[a0k], this.positions[a0k + 1], this.positions[a1k], this.positions[a1k + 1], this.positions[b0k], this.positions[b0k + 1], this.positions[b1k], this.positions[b1k + 1]);
    const p1x = this.positions[a0k] + (this.positions[a1k] - this.positions[a0k]) * this.segmentS;
    const p1y = this.positions[a0k + 1] + (this.positions[a1k + 1] - this.positions[a0k + 1]) * this.segmentS;
    const p2x = this.positions[b0k] + (this.positions[b1k] - this.positions[b0k]) * this.segmentT;
    const p2y = this.positions[b0k + 1] + (this.positions[b1k + 1] - this.positions[b0k + 1]) * this.segmentT;
    let nx = p2x - p1x;
    let ny = p2y - p1y;
    const rr = this.capsuleRadius[i] + this.capsuleRadius[j];
    const d2 = nx * nx + ny * ny;
    if (d2 >= rr * rr) return false;
    let distance = Math.sqrt(Math.max(d2, EPS));
    if (distance < 0.0001) {
      const angle = ((i + 1) * 19.19 + (j + 3) * 7.17) % (Math.PI * 2);
      nx = Math.cos(angle);
      ny = Math.sin(angle);
      distance = 1;
    } else {
      nx /= distance;
      ny /= distance;
    }
    const wa0 = (1 - this.segmentS) * this.particleWeight(a0);
    const wa1 = this.segmentS * this.particleWeight(a1);
    const wb0 = (1 - this.segmentT) * this.particleWeight(b0);
    const wb1 = this.segmentT * this.particleWeight(b1);
    const ws = wa0 + wa1 + wb0 + wb1;
    if (ws <= 0) return false;
    const correction = Math.min(rr - distance, rr * 0.42) * relax / ws;
    this.positions[a0k] -= nx * correction * wa0;
    this.positions[a0k + 1] -= ny * correction * wa0;
    this.positions[a1k] -= nx * correction * wa1;
    this.positions[a1k + 1] -= ny * correction * wa1;
    this.positions[b0k] += nx * correction * wb0;
    this.positions[b0k + 1] += ny * correction * wb0;
    this.positions[b1k] += nx * correction * wb1;
    this.positions[b1k + 1] += ny * correction * wb1;
    return true;
  }

  private rebuildBoxGrid(cellSize: number): void {
    this.boxGrid.configure(this.width, this.height, cellSize);
    for (let i = 0; i < this.activeBoxCount; i += 1) {
      const s = this.boxStart[i];
      const p0 = s << 1;
      const p1 = (s + 1) << 1;
      const p2 = (s + 2) << 1;
      const p3 = (s + 3) << 1;
      this.boxGrid.insert(i, (this.positions[p0] + this.positions[p1] + this.positions[p2] + this.positions[p3]) * 0.25, (this.positions[p0 + 1] + this.positions[p1 + 1] + this.positions[p2 + 1] + this.positions[p3 + 1]) * 0.25);
    }
  }

  private solveBoxCollisions(relax: number): void {
    const grid = this.boxGrid;
    const columns = grid.cols;
    const rows = grid.rowCount;
    for (let cy = 0; cy < rows; cy += 1) {
      const row = cy * columns;
      const nextRow = row + columns;
      for (let cx = 0; cx < columns; cx += 1) {
        const cell = row + cx;
        if (grid.cellHead(cell) === -1) continue;
        this.solveBoxSelfCell(cell, relax);
        if (cx + 1 < columns) this.solveBoxCellPair(cell, cell + 1, relax);
        if (cy + 1 < rows) {
          this.solveBoxCellPair(cell, nextRow + cx, relax);
          if (cx > 0) this.solveBoxCellPair(cell, nextRow + cx - 1, relax);
          if (cx + 1 < columns) this.solveBoxCellPair(cell, nextRow + cx + 1, relax);
        }
      }
    }
  }

  private solveBoxSelfCell(cell: number, relax: number): void {
    const grid = this.boxGrid;
    for (let i = grid.cellHead(cell); i !== -1; i = grid.next[i]) {
      for (let j = grid.next[i]; j !== -1; j = grid.next[j]) {
        this.pairsLast += 1;
        if (this.solveBoxPair(i, j, relax)) this.contactsLast += 1;
      }
    }
  }

  private solveBoxCellPair(cellA: number, cellB: number, relax: number): void {
    const grid = this.boxGrid;
    for (let i = grid.cellHead(cellA); i !== -1; i = grid.next[i]) {
      for (let j = grid.cellHead(cellB); j !== -1; j = grid.next[j]) {
        this.pairsLast += 1;
        if (this.solveBoxPair(i, j, relax)) this.contactsLast += 1;
      }
    }
  }

  private stabilizeBoxes(stiffness: number): void {
    const box = this.scratchBoxA;

    for (let i = 0; i < this.activeBoxCount; i += 1) {
      if (!this.readBox(i, box)) continue;
      const hx = this.boxHalfWidth[i] || box.hx;
      const hy = this.boxHalfHeight[i] || box.hy;
      for (let c = 0; c < 4; c += 1) {
        const cornerX = c === 0 || c === 3 ? -1 : 1;
        const cornerY = c < 2 ? -1 : 1;
        const targetX = box.cx + box.axx * cornerX * hx + box.ayx * cornerY * hy;
        const targetY = box.cy + box.axy * cornerX * hx + box.ayy * cornerY * hy;
        const k = (box.start + c) << 1;
        this.positions[k] += (targetX - this.positions[k]) * stiffness;
        this.positions[k + 1] += (targetY - this.positions[k + 1]) * stiffness;
      }
    }
  }

  private solveBoxPair(i: number, j: number, relax: number): boolean {
    const a = this.scratchBoxA;
    const b = this.scratchBoxB;
    if (!this.readBox(i, a) || !this.readBox(j, b)) return false;
    let bestOverlap = Infinity;
    let bestNx = 0;
    let bestNy = 0;
    for (let axis = 0; axis < 4; axis += 1) {
      let nx = 1;
      let ny = 0;
      if (axis === 0) {
        nx = a.axx;
        ny = a.axy;
      } else if (axis === 1) {
        nx = a.ayx;
        ny = a.ayy;
      } else if (axis === 2) {
        nx = b.axx;
        ny = b.axy;
      } else {
        nx = b.ayx;
        ny = b.ayy;
      }
      this.projectBox(a, nx, ny);
      const aMin = this.projectMin;
      const aMax = this.projectMax;
      this.projectBox(b, nx, ny);
      const overlap = Math.min(aMax, this.projectMax) - Math.max(aMin, this.projectMin);
      if (overlap <= 0) return false;
      if (overlap < bestOverlap) {
        if ((b.cx - a.cx) * nx + (b.cy - a.cy) * ny < 0) {
          nx = -nx;
          ny = -ny;
        }
        bestOverlap = overlap;
        bestNx = nx;
        bestNy = ny;
      }
    }
    let hits = 0;
    for (let c = 0; c < 4; c += 1) {
      if (this.pushCorner(a.start + c, j, b, relax, bestOverlap)) hits += 1;
      if (this.pushCorner(b.start + c, i, a, relax, bestOverlap)) hits += 1;
    }
    if (hits === 0) {
      const pen = Math.min(bestOverlap, Math.max(a.hx, a.hy, b.hx, b.hy) * 0.22) * relax * 0.5;
      this.translateBox(i, -bestNx * pen, -bestNy * pen);
      this.translateBox(j, bestNx * pen, bestNy * pen);
    }
    return true;
  }

  private pushCorner(point: number, otherBoxIndex: number, otherBox: BoxData, relax: number, bestOverlap: number): boolean {
    if (!this.cornerInsideBox(point, otherBox)) return false;
    const pen = Math.min(this.cornerHitPen, bestOverlap * 1.15) * relax;
    const k = point << 1;
    this.positions[k] += this.cornerHitNx * pen * 0.62;
    this.positions[k + 1] += this.cornerHitNy * pen * 0.62;
    this.translateBox(otherBoxIndex, -this.cornerHitNx * pen * 0.095, -this.cornerHitNy * pen * 0.095);
    return true;
  }

  private readBox(index: number, out: BoxData): boolean {
    const start = this.boxStart[index];
    if (start < 0 || start + 3 >= this.particleCount) return false;
    const p0 = start << 1;
    const p1 = (start + 1) << 1;
    const p2 = (start + 2) << 1;
    const p3 = (start + 3) << 1;
    out.cx = (this.positions[p0] + this.positions[p1] + this.positions[p2] + this.positions[p3]) * 0.25;
    out.cy = (this.positions[p0 + 1] + this.positions[p1 + 1] + this.positions[p2 + 1] + this.positions[p3 + 1]) * 0.25;
    let axx = (this.positions[p1] - this.positions[p0] + this.positions[p2] - this.positions[p3]) * 0.5;
    let axy = (this.positions[p1 + 1] - this.positions[p0 + 1] + this.positions[p2 + 1] - this.positions[p3 + 1]) * 0.5;
    let ayx = (this.positions[p3] - this.positions[p0] + this.positions[p2] - this.positions[p1]) * 0.5;
    let ayy = (this.positions[p3 + 1] - this.positions[p0 + 1] + this.positions[p2 + 1] - this.positions[p1 + 1]) * 0.5;
    let lx = Math.sqrt(axx * axx + axy * axy);
    let ly = Math.sqrt(ayx * ayx + ayy * ayy);
    if (lx < EPS) {
      axx = 1;
      axy = 0;
      lx = 1;
    }
    if (ly < EPS) {
      ayx = -axy;
      ayy = axx;
      ly = 1;
    }
    out.axx = axx / lx;
    out.axy = axy / lx;
    out.ayx = ayx / ly;
    out.ayy = ayy / ly;
    out.hx = lx * 0.5;
    out.hy = ly * 0.5;
    out.start = start;
    return true;
  }

  private projectBox(box: BoxData, ax: number, ay: number): void {
    let min = this.positions[box.start << 1] * ax + this.positions[(box.start << 1) + 1] * ay;
    let max = min;
    for (let i = 1; i < 4; i += 1) {
      const k = (box.start + i) << 1;
      const projection = this.positions[k] * ax + this.positions[k + 1] * ay;
      if (projection < min) min = projection;
      if (projection > max) max = projection;
    }
    this.projectMin = min;
    this.projectMax = max;
  }

  private cornerInsideBox(point: number, box: BoxData): boolean {
    const k = point << 1;
    const dx = this.positions[k] - box.cx;
    const dy = this.positions[k + 1] - box.cy;
    const lx = dx * box.axx + dy * box.axy;
    const ly = dx * box.ayx + dy * box.ayy;
    if (Math.abs(lx) >= box.hx || Math.abs(ly) >= box.hy) return false;
    const px = box.hx - Math.abs(lx);
    const py = box.hy - Math.abs(ly);
    if (px < py) {
      const sign = lx < 0 ? -1 : 1;
      this.cornerHitNx = box.axx * sign;
      this.cornerHitNy = box.axy * sign;
      this.cornerHitPen = px;
      return true;
    }
    const sign = ly < 0 ? -1 : 1;
    this.cornerHitNx = box.ayx * sign;
    this.cornerHitNy = box.ayy * sign;
    this.cornerHitPen = py;
    return true;
  }

  private translateBox(index: number, dx: number, dy: number): void {
    const start = this.boxStart[index];
    for (let i = 0; i < 4; i += 1) {
      const k = (start + i) << 1;
      this.positions[k] += dx;
      this.positions[k + 1] += dy;
    }
  }

  private segmentParameters(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): void {
    const ux = bx - ax;
    const uy = by - ay;
    const vx = dx - cx;
    const vy = dy - cy;
    const wx = ax - cx;
    const wy = ay - cy;
    const a = ux * ux + uy * uy;
    const b = ux * vx + uy * vy;
    const c = vx * vx + vy * vy;
    const d = ux * wx + uy * wy;
    const e = vx * wx + vy * wy;
    const determinant = a * c - b * b;
    let sNumerator: number;
    let sDenominator = determinant;
    let tNumerator: number;
    let tDenominator = determinant;
    if (determinant < EPS) {
      sNumerator = 0;
      sDenominator = 1;
      tNumerator = e;
      tDenominator = c;
    } else {
      sNumerator = b * e - c * d;
      tNumerator = a * e - b * d;
      if (sNumerator < 0) {
        sNumerator = 0;
        tNumerator = e;
        tDenominator = c;
      } else if (sNumerator > sDenominator) {
        sNumerator = sDenominator;
        tNumerator = e + b;
        tDenominator = c;
      }
    }
    if (tNumerator < 0) {
      tNumerator = 0;
      if (-d < 0) sNumerator = 0;
      else if (-d > a) sNumerator = sDenominator;
      else {
        sNumerator = -d;
        sDenominator = a;
      }
    } else if (tNumerator > tDenominator) {
      tNumerator = tDenominator;
      if (-d + b < 0) sNumerator = 0;
      else if (-d + b > a) sNumerator = sDenominator;
      else {
        sNumerator = -d + b;
        sDenominator = a;
      }
    }
    this.segmentS = Math.abs(sNumerator) < EPS ? 0 : sNumerator / Math.max(EPS, sDenominator);
    this.segmentT = Math.abs(tNumerator) < EPS ? 0 : tNumerator / Math.max(EPS, tDenominator);
  }

  private particleWeight(index: number): number {
    const inverseMass = this.inverseMasses[index];
    if (inverseMass <= 0) return 0;
    if (this.settings.gravity <= 0) return inverseMass;
    const y = this.positions[(index << 1) + 1];
    return inverseMass * (1 - 0.62 * clamp(y / Math.max(1, this.height), 0, 1));
  }

  private stats(): AdvancedCollisionStressStats {
    return {
      particleCount: this.particleCount,
      dynamicParticleCount: this.particleCount,
      linkCount: this.activeLinkCount,
      capsuleCount: this.activeCapsuleCount,
      boxCount: this.activeBoxCount,
      contacts: this.contactsLast,
      pairs: this.pairsLast,
      gridCellSize: this.gridCellLast,
      awake: this.awake,
      settledFrames: this.settledFrames,
      maxVelocity: this.lastMaxVelocity,
    };
  }

  private random(): number {
    this.randomState ^= this.randomState << 13;
    this.randomState ^= this.randomState >>> 17;
    this.randomState ^= this.randomState << 5;
    return (this.randomState >>> 0) / 4294967296;
  }

  private range(low: number, high: number): number {
    return low + (high - low) * this.random();
  }
}
