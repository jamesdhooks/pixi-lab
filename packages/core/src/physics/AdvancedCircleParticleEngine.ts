import type { AdvancedPhysicsEngine, AdvancedPhysicsEngineKind } from './AdvancedPhysicsEngine.js';

export interface AdvancedCircleParticleSettings {
  readonly radius: number;
  readonly maxActiveParticles: number;
  readonly gravity: number;
  readonly solverPasses: number;
  readonly substeps: number;
  readonly wallBounce: boolean;
  readonly wallBounceCoefficient: number;
  readonly airDragPerSecond: number;
  readonly solverDampingPerSecond: number;
  readonly maxFrameDt: number;
  readonly maxPairPushFactor: number;
  readonly impactBounceThreshold: number;
  readonly collisionSoftness: number;
  readonly contactFriction: number;
  readonly linkSolverPasses: number;
  readonly sameGroupCollisions: boolean;
  readonly adjacentGroupCollisions: boolean;
}

export interface AdvancedCircleSpawnOptions {
  readonly power?: number;
  readonly spreadRadians?: number;
  readonly baseSpeed?: number;
  readonly speedJitter?: number;
  readonly lateralJitter?: number;
  readonly group?: number;
  readonly localStart?: number;
}

export interface AdvancedParticleOptions {
  readonly radius?: number;
  readonly inverseMass?: number;
  readonly velocityX?: number;
  readonly velocityY?: number;
  readonly group?: number;
  readonly local?: number;
  readonly seed?: number;
}

export interface AdvancedDistanceConstraintOptions {
  readonly restLength?: number;
  readonly stiffness?: number;
}

export interface AdvancedCircleParticleStats {
  readonly count: number;
  readonly dynamicCount: number;
  readonly staticCount: number;
  readonly linkCount: number;
  readonly capacity: number;
  readonly collisionHits: number;
  readonly gridColumns: number;
  readonly gridRows: number;
  readonly cellSize: number;
  readonly awake: boolean;
  readonly settledFrames: number;
  readonly maxVelocity: number;
  readonly maxCorrection: number;
}

export interface AdvancedCircleParticleNeighborSlotSeed {
  readonly slot: number;
  readonly data: Float32Array;
}

export interface AdvancedCircleParticleSpatialNeighborSlotStats {
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

const DEFAULT_SETTINGS: AdvancedCircleParticleSettings = {
  radius: 4,
  maxActiveParticles: 220_000,
  gravity: 1300,
  solverPasses: 3,
  substeps: 2,
  wallBounce: false,
  wallBounceCoefficient: 0.16,
  airDragPerSecond: 0.992,
  solverDampingPerSecond: 0.982,
  maxFrameDt: 1 / 30,
  maxPairPushFactor: 0.38,
  impactBounceThreshold: 150,
  collisionSoftness: 0.82,
  contactFriction: 0,
  linkSolverPasses: 1,
  sameGroupCollisions: true,
  adjacentGroupCollisions: false,
};

function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Dense PBD-style circle solver for raw browser simulations.
 *
 * The first implementation is circle-only, but the memory layout and stepping
 * model are intentionally renderer-free so future capsule, rope, peg, and
 * soft-body experiments can reuse the same broadphase and integration loop.
 */
export class AdvancedCircleParticleEngine implements AdvancedPhysicsEngine<AdvancedCircleParticleSettings, AdvancedCircleParticleStats> {
  readonly kind: AdvancedPhysicsEngineKind = 'advanced-circle-particles';
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly previousPositions: Float32Array;
  readonly radii: Float32Array;
  readonly inverseMasses: Float32Array;
  readonly seeds: Float32Array;
  readonly groups: Int32Array;
  readonly locals: Int32Array;

  private readonly next: Int32Array;
  private readonly contactCounts: Uint16Array;
  private readonly correctionDeltas: Float32Array;
  private readonly linkA: Int32Array;
  private readonly linkB: Int32Array;
  private readonly linkRestLengths: Float32Array;
  private readonly linkStiffnesses: Float32Array;
  private readonly linkAdjacencyHead: Int32Array;
  private readonly linkAdjacencyNext: Int32Array;
  private head = new Int32Array(1024);
  private settings: AdvancedCircleParticleSettings = DEFAULT_SETTINGS;
  private activeCount = 0;
  private activeLinkCount = 0;
  private width = 1;
  private height = 1;
  private cellSize = 8;
  private invCellSize = 1 / 8;
  private gridColumns = 1;
  private gridRows = 1;
  private gridCells = 1;
  private seed: number;
  private lastCollisionHits = 0;
  private dynamicCount = 0;
  private awake = true;
  private settledFrames = 0;
  private stepMaxVelocity = 0;
  private stepMaxCorrection = 0;
  private lastMaxVelocity = 0;
  private lastMaxCorrection = 0;
  private lastRadius = DEFAULT_SETTINGS.radius;
  private largestParticleRadius = DEFAULT_SETTINGS.radius;
  private solvedPairX = 0;
  private solvedPairY = 0;
  private neighborSlotDirtyStart = Number.POSITIVE_INFINITY;
  private neighborSlotDirtyEnd = -1;

  constructor(readonly capacity: number, seed = 0x9e3779b9, readonly linkCapacity = Math.max(1024, capacity * 2)) {
    this.positions = new Float32Array(capacity * 2);
    this.velocities = new Float32Array(capacity * 2);
    this.previousPositions = new Float32Array(capacity * 2);
    this.radii = new Float32Array(capacity);
    this.inverseMasses = new Float32Array(capacity);
    this.seeds = new Float32Array(capacity);
    this.groups = new Int32Array(capacity);
    this.locals = new Int32Array(capacity);
    this.next = new Int32Array(capacity);
    this.contactCounts = new Uint16Array(capacity);
    this.correctionDeltas = new Float32Array(capacity * 2);
    this.linkA = new Int32Array(this.linkCapacity);
    this.linkB = new Int32Array(this.linkCapacity);
    this.linkRestLengths = new Float32Array(this.linkCapacity);
    this.linkStiffnesses = new Float32Array(this.linkCapacity);
    this.linkAdjacencyHead = new Int32Array(capacity);
    this.linkAdjacencyNext = new Int32Array(this.linkCapacity * 2);
    this.seed = seed | 0;
    this.groups.fill(-1);
    this.linkAdjacencyHead.fill(-1);
    this.linkAdjacencyNext.fill(-1);
  }

  get count(): number {
    return this.activeCount;
  }

  get isAwake(): boolean {
    return this.awake;
  }

  wake(): void {
    this.awake = this.dynamicCount > 0;
    this.settledFrames = 0;
  }

  configure(settings: Partial<AdvancedCircleParticleSettings>): void {
    const current = this.settings;
    const radius = clamp(finite(settings.radius ?? current.radius, DEFAULT_SETTINGS.radius), 0.5, 128);
    const maxActiveParticles = Math.max(
      0,
      Math.min(this.capacity, Math.floor(finite(settings.maxActiveParticles ?? current.maxActiveParticles, this.capacity))),
    );

    this.settings = {
      radius,
      maxActiveParticles,
      gravity: finite(settings.gravity ?? current.gravity, DEFAULT_SETTINGS.gravity),
      solverPasses: Math.max(1, Math.min(16, Math.floor(finite(settings.solverPasses ?? current.solverPasses, DEFAULT_SETTINGS.solverPasses)))),
      substeps: Math.max(1, Math.min(8, Math.floor(finite(settings.substeps ?? current.substeps, DEFAULT_SETTINGS.substeps)))),
      wallBounce: settings.wallBounce ?? current.wallBounce,
      wallBounceCoefficient: clamp(
        finite(settings.wallBounceCoefficient ?? current.wallBounceCoefficient, DEFAULT_SETTINGS.wallBounceCoefficient),
        0,
        1,
      ),
      airDragPerSecond: clamp(finite(settings.airDragPerSecond ?? current.airDragPerSecond, DEFAULT_SETTINGS.airDragPerSecond), 0, 1),
      solverDampingPerSecond: clamp(
        finite(settings.solverDampingPerSecond ?? current.solverDampingPerSecond, DEFAULT_SETTINGS.solverDampingPerSecond),
        0,
        1,
      ),
      maxFrameDt: clamp(finite(settings.maxFrameDt ?? current.maxFrameDt, DEFAULT_SETTINGS.maxFrameDt), 1 / 240, 1 / 10),
      maxPairPushFactor: clamp(
        finite(settings.maxPairPushFactor ?? current.maxPairPushFactor, DEFAULT_SETTINGS.maxPairPushFactor),
        0.02,
        2,
      ),
      impactBounceThreshold: Math.max(
        0,
        finite(settings.impactBounceThreshold ?? current.impactBounceThreshold, DEFAULT_SETTINGS.impactBounceThreshold),
      ),
      collisionSoftness: clamp(finite(settings.collisionSoftness ?? current.collisionSoftness, DEFAULT_SETTINGS.collisionSoftness), 0.05, 1.5),
      contactFriction: clamp(finite(settings.contactFriction ?? current.contactFriction, DEFAULT_SETTINGS.contactFriction), 0, 1),
      linkSolverPasses: Math.max(
        0,
        Math.min(12, Math.floor(finite(settings.linkSolverPasses ?? current.linkSolverPasses, DEFAULT_SETTINGS.linkSolverPasses))),
      ),
      sameGroupCollisions: settings.sameGroupCollisions ?? current.sameGroupCollisions,
      adjacentGroupCollisions: settings.adjacentGroupCollisions ?? current.adjacentGroupCollisions,
    };

    if (this.activeCount > maxActiveParticles) {
      for (let i = maxActiveParticles; i < this.activeCount; i += 1) {
        if (this.inverseMasses[i] > 0) this.dynamicCount -= 1;
      }
      this.activeCount = maxActiveParticles;
      if (this.dynamicCount < 0) this.dynamicCount = 0;
      this.wake();
    }
    if (this.lastRadius !== radius) {
      for (let i = 0; i < this.activeCount; i += 1) {
        this.radii[i] = radius;
      }
      this.lastRadius = radius;
      this.largestParticleRadius = radius;
      this.wake();
    }
    this.rebuildGridShape();
  }

  setBounds(width: number, height: number): void {
    const nextWidth = Math.max(1, finite(width, 1));
    const nextHeight = Math.max(1, finite(height, 1));
    if (Math.abs(nextWidth - this.width) > 0.01 || Math.abs(nextHeight - this.height) > 0.01) this.wake();
    this.width = nextWidth;
    this.height = nextHeight;
    this.rebuildGridShape();
  }

  clear(): void {
    this.activeCount = 0;
    this.activeLinkCount = 0;
    this.dynamicCount = 0;
    this.linkAdjacencyHead.fill(-1);
    this.linkAdjacencyNext.fill(-1);
    this.neighborSlotDirtyStart = Number.POSITIVE_INFINITY;
    this.neighborSlotDirtyEnd = -1;
    this.lastCollisionHits = 0;
    this.awake = false;
    this.settledFrames = 0;
    this.lastMaxVelocity = 0;
    this.lastMaxCorrection = 0;
    this.largestParticleRadius = this.settings.radius;
  }

  addParticle(x: number, y: number, options: AdvancedParticleOptions = {}): number {
    if (this.activeCount >= this.settings.maxActiveParticles) return -1;
    const index = this.activeCount;
    this.activeCount += 1;
    const k = index << 1;
    const radius = clamp(finite(options.radius ?? this.settings.radius, this.settings.radius), 0.5, 128);
    const px = clamp(finite(x, this.width * 0.5), radius, this.width - radius);
    const py = clamp(finite(y, this.height * 0.5), radius, this.height - radius);

    this.positions[k] = px;
    this.positions[k + 1] = py;
    this.previousPositions[k] = px;
    this.previousPositions[k + 1] = py;
    this.velocities[k] = finite(options.velocityX ?? 0, 0);
    this.velocities[k + 1] = finite(options.velocityY ?? 0, 0);
    this.radii[index] = radius;
    if (radius > this.largestParticleRadius) {
      this.largestParticleRadius = radius;
      this.rebuildGridShape();
    }
    this.inverseMasses[index] = Math.max(0, finite(options.inverseMass ?? 1, 1));
    if (this.inverseMasses[index] > 0) this.dynamicCount += 1;
    const seedValue = options.seed ?? this.random();
    this.seeds[index] = finite(seedValue, 0);
    this.groups[index] = Math.floor(finite(options.group ?? -1, -1));
    this.locals[index] = Math.floor(finite(options.local ?? 0, 0));
    if (this.inverseMasses[index] > 0) this.wake();
    return index;
  }

  addDistanceConstraint(a: number, b: number, options: AdvancedDistanceConstraintOptions = {}): number {
    if (this.activeLinkCount >= this.linkCapacity) return -1;
    if (a < 0 || b < 0 || a >= this.activeCount || b >= this.activeCount || a === b) return -1;
    const linkIndex = this.activeLinkCount;
    this.activeLinkCount += 1;
    const ax = this.positions[a << 1];
    const ay = this.positions[(a << 1) + 1];
    const bx = this.positions[b << 1];
    const by = this.positions[(b << 1) + 1];
    const dx = bx - ax;
    const dy = by - ay;

    this.linkA[linkIndex] = a;
    this.linkB[linkIndex] = b;
    this.linkRestLengths[linkIndex] = Math.max(0.001, finite(options.restLength ?? Math.sqrt(dx * dx + dy * dy), 1));
    this.linkStiffnesses[linkIndex] = clamp(finite(options.stiffness ?? 1, 1), 0, 1);
    this.addLinkAdjacency(a, linkIndex * 2);
    this.addLinkAdjacency(b, linkIndex * 2 + 1);
    this.markNeighborSlotsDirty(a, b);
    this.wake();
    return linkIndex;
  }

  setDistanceConstraintStiffness(linkIndex: number, stiffness: number): void {
    if (linkIndex < 0 || linkIndex >= this.activeLinkCount) return;
    const nextStiffness = clamp(finite(stiffness, this.linkStiffnesses[linkIndex]), 0, 1);
    if (Math.abs(nextStiffness - this.linkStiffnesses[linkIndex]) <= 0.0001) return;
    this.linkStiffnesses[linkIndex] = nextStiffness;
    this.wake();
  }

  spawnStream(count: number, x: number, y: number, options: AdvancedCircleSpawnOptions = {}): number {
    const settings = this.settings;
    const radius = settings.radius;
    const left = radius;
    const right = this.width - radius;
    const top = radius;
    const bottom = this.height - radius;
    const baseX = clamp(x, left, right);
    const baseY = clamp(y, top, bottom);
    const power = options.power ?? 1;
    const spreadRadians = options.spreadRadians ?? 1.25;
    const baseSpeed = options.baseSpeed ?? 180;
    const speedJitter = options.speedJitter ?? 480;
    const lateralJitter = options.lateralJitter ?? 80;
    const target = Math.max(0, Math.floor(count));
    let made = 0;

    for (; made < target && this.activeCount < settings.maxActiveParticles; made += 1) {
      const angle = this.random() * Math.PI * 2;
      const dist = Math.sqrt(this.random()) * radius * 2.8;
      const px = clamp(baseX + Math.cos(angle) * dist, left, right);
      const py = clamp(baseY + Math.sin(angle) * dist, top, bottom);
      const spread = (this.random() - 0.5) * spreadRadians;
      const speed = (baseSpeed + speedJitter * this.random()) * power;
      const index = this.addParticle(px, py, {
        radius,
        velocityX: Math.sin(spread) * speed + (this.random() - 0.5) * lateralJitter,
        velocityY: Math.cos(spread) * speed - 180 * this.random(),
        group: options.group,
        local: (options.localStart ?? 0) + made,
      });
      if (index === -1) break;
    }

    return made;
  }

  step(deltaSeconds: number): AdvancedCircleParticleStats {
    if (this.activeCount === 0) return this.stats(0);
    if (this.dynamicCount <= 0) {
      this.awake = false;
      return this.stats(0);
    }
    if (!this.awake) return this.stats(0);

    const dt = Math.min(this.settings.maxFrameDt, Math.max(0, finite(deltaSeconds, 0)));
    if (dt <= 0) return this.stats(0);

    let totalHits = 0;
    const substeps = this.settings.substeps;
    const stepDt = dt / substeps;
    this.stepMaxVelocity = 0;
    this.stepMaxCorrection = 0;
    this.contactCounts.fill(0, 0, this.activeCount);
    this.correctionDeltas.fill(0, 0, this.activeCount * 2);

    for (let s = 0; s < substeps; s += 1) {
      this.integrate(stepDt);
      this.projectBounds();
      for (let pass = 0; pass < this.settings.solverPasses; pass += 1) {
        this.solveLinks();
        this.buildGrid();
        totalHits += this.solveCollisions();
        this.projectBounds();
      }
      this.syncVelocities(stepDt);
    }

    this.lastCollisionHits = totalHits;
    this.lastMaxVelocity = this.stepMaxVelocity;
    this.lastMaxCorrection = this.stepMaxCorrection;
    if (this.lastMaxVelocity < 8 && this.lastMaxCorrection < 0.2) {
      this.settledFrames += 1;
      if (this.settledFrames > 50) {
        this.awake = false;
        this.zeroDynamicVelocities();
      }
    } else {
      this.settledFrames = 0;
    }
    return this.stats(totalHits);
  }

  getStats(): AdvancedCircleParticleStats {
    return this.stats(this.lastCollisionHits);
  }

  writeDistanceConstraintNeighborSlots(slots: readonly Float32Array[], clearCapacity = this.activeCount): number {
    if (slots.length <= 0) return 0;
    const clearFloats = Math.max(0, Math.floor(clearCapacity)) * 4;
    for (let slot = 0; slot < slots.length; slot += 1) {
      const data = slots[slot];
      const limit = Math.min(data.length, clearFloats);
      for (let index = 0; index < limit; index += 4) {
        data[index] = -1;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 0;
      }
    }

    let written = 0;
    for (let link = 0; link < this.activeLinkCount; link += 1) {
      const a = this.linkA[link];
      const b = this.linkB[link];
      const rest = this.linkRestLengths[link];
      const stiffness = this.linkStiffnesses[link];
      if (this.writeNeighborSlot(slots, a, b, rest, stiffness)) written += 1;
      if (this.writeNeighborSlot(slots, b, a, rest, stiffness)) written += 1;
    }
    return written;
  }

  writeDistanceConstraintNeighborSlotsRange(slots: readonly Float32Array[], start: number, count: number): number {
    if (slots.length <= 0 || count <= 0) return 0;
    const first = Math.max(0, Math.min(this.activeCount, Math.floor(start)));
    const end = Math.max(first, Math.min(this.activeCount, first + Math.max(0, Math.floor(count))));
    if (end <= first) return 0;
    for (let slot = 0; slot < slots.length; slot += 1) {
      const data = slots[slot];
      for (let index = first * 4; index < end * 4 && index + 3 < data.length; index += 4) {
        data[index] = -1;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 0;
      }
    }

    let written = 0;
    for (let particle = first; particle < end; particle += 1) {
      for (let entry = this.linkAdjacencyHead[particle]; entry !== -1; entry = this.linkAdjacencyNext[entry]) {
        const link = entry >> 1;
        if (link < 0 || link >= this.activeLinkCount) continue;
        const a = this.linkA[link];
        const b = this.linkB[link];
        const neighbor = a === particle ? b : a;
        if (neighbor < 0 || neighbor >= this.activeCount) continue;
        const rest = this.linkRestLengths[link];
        const stiffness = this.linkStiffnesses[link];
        if (this.writeNeighborSlot(slots, particle, neighbor, rest, stiffness)) written += 1;
      }
    }
    return written;
  }

  writeSpatialCollisionNeighborSlots(slots: readonly Float32Array[], clearCapacity = this.activeCount, radiusScale = 1.08): AdvancedCircleParticleSpatialNeighborSlotStats {
    if (slots.length <= 0 || this.activeCount <= 0) {
      return {
        particleCount: this.activeCount,
        slotCount: slots.length,
        slotWrites: 0,
        candidatePairs: 0,
        overflowCount: 0,
        stagingClearFloats: 0,
        stagingWriteFloats: 0,
        cellSize: this.cellSize,
        spatiallyComplete: true,
      };
    }
    const maxCount = Math.min(
      this.activeCount,
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
        cellSize: this.cellSize,
        spatiallyComplete: true,
      };
    }

    this.buildGrid();
    const radiusMultiplier = Math.max(0.1, finite(radiusScale, 1.08));
    let slotWrites = 0;
    let candidatePairs = 0;
    let overflowCount = 0;
    const writePair = (i: number, j: number): void => {
      if (i >= maxCount || j >= maxCount || this.shouldSkipPair(i, j)) return;
      const ik = i << 1;
      const jk = j << 1;
      const dx = this.positions[jk] - this.positions[ik];
      const dy = this.positions[jk + 1] - this.positions[ik + 1];
      const rest = (this.radii[i] + this.radii[j]) * radiusMultiplier;
      if (dx * dx + dy * dy > rest * rest) return;
      candidatePairs += 1;
      if (this.writeNeighborSlot(slots, i, j, rest, 1)) slotWrites += 1;
      else overflowCount += 1;
      if (this.writeNeighborSlot(slots, j, i, rest, 1)) slotWrites += 1;
      else overflowCount += 1;
    };

    const columns = this.gridColumns;
    const rows = this.gridRows;
    for (let cy = 0; cy < rows; cy += 1) {
      const row = cy * columns;
      const nextRow = row + columns;
      for (let cx = 0; cx < columns; cx += 1) {
        const cell = row + cx;
        if (this.head[cell] === -1) continue;
        for (let i = this.head[cell]; i !== -1; i = this.next[i]) {
          for (let j = this.next[i]; j !== -1; j = this.next[j]) writePair(i, j);
        }
        if (cx + 1 < columns) {
          for (let i = this.head[cell]; i !== -1; i = this.next[i]) {
            for (let j = this.head[cell + 1]; j !== -1; j = this.next[j]) writePair(i, j);
          }
        }
        if (cy + 1 < rows) {
          for (let i = this.head[cell]; i !== -1; i = this.next[i]) {
            for (let j = this.head[nextRow + cx]; j !== -1; j = this.next[j]) writePair(i, j);
          }
          if (cx > 0) {
            for (let i = this.head[cell]; i !== -1; i = this.next[i]) {
              for (let j = this.head[nextRow + cx - 1]; j !== -1; j = this.next[j]) writePair(i, j);
            }
          }
          if (cx + 1 < columns) {
            for (let i = this.head[cell]; i !== -1; i = this.next[i]) {
              for (let j = this.head[nextRow + cx + 1]; j !== -1; j = this.next[j]) writePair(i, j);
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
      cellSize: this.cellSize,
      spatiallyComplete: overflowCount <= 0,
    };
  }

  private addLinkAdjacency(particle: number, entry: number): void {
    if (particle < 0 || particle >= this.capacity || entry < 0 || entry >= this.linkAdjacencyNext.length) return;
    this.linkAdjacencyNext[entry] = this.linkAdjacencyHead[particle];
    this.linkAdjacencyHead[particle] = entry;
  }

  consumeDistanceConstraintNeighborDirtyRange(): { start: number; count: number } | null {
    if (!Number.isFinite(this.neighborSlotDirtyStart) || this.neighborSlotDirtyEnd < this.neighborSlotDirtyStart) return null;
    const start = Math.max(0, Math.min(this.activeCount, Math.floor(this.neighborSlotDirtyStart)));
    const end = Math.max(start, Math.min(this.activeCount, Math.floor(this.neighborSlotDirtyEnd) + 1));
    this.neighborSlotDirtyStart = Number.POSITIVE_INFINITY;
    this.neighborSlotDirtyEnd = -1;
    if (end <= start) return null;
    return { start, count: end - start };
  }

  writeParticlePositions(data: Float32Array, stride = 2): number {
    if (stride < 2) return 0;
    const count = Math.min(this.activeCount, Math.floor(data.length / stride));
    for (let index = 0; index < count; index += 1) {
      const source = index << 1;
      const target = index * stride;
      data[target] = this.positions[source];
      data[target + 1] = this.positions[source + 1];
    }
    return count;
  }

  writeGpuParticleState(positions: Float32Array, velocities: Float32Array, attributes: Float32Array, capacity: number, clearCapacity = capacity): number {
    const clearFloats = Math.min(
      Math.max(0, Math.floor(clearCapacity)) * 4,
      positions.length,
      velocities.length,
      attributes.length,
    );
    positions.fill(0, 0, clearFloats);
    velocities.fill(0, 0, clearFloats);
    attributes.fill(0, 0, clearFloats);
    const count = Math.min(
      this.activeCount,
      Math.max(0, Math.floor(capacity)),
      Math.floor(positions.length / 4),
      Math.floor(velocities.length / 4),
      Math.floor(attributes.length / 4),
    );
    for (let index = 0; index < count; index += 1) {
      const source = index << 1;
      const target = index * 4;
      positions[target] = this.positions[source];
      positions[target + 1] = this.positions[source + 1];
      positions[target + 2] = this.radii[index];
      positions[target + 3] = this.groups[index];
      velocities[target] = this.velocities[source];
      velocities[target + 1] = this.velocities[source + 1];
      velocities[target + 2] = this.inverseMasses[index];
      velocities[target + 3] = 0;
      attributes[target] = this.radii[index];
      attributes[target + 1] = this.inverseMasses[index];
      attributes[target + 2] = this.locals[index];
      attributes[target + 3] = this.seeds[index];
    }
    return count;
  }

  writeGpuParticleDynamicState(positions: Float32Array, velocities: Float32Array, capacity: number, clearCapacity = capacity): number {
    const clearFloats = Math.min(
      Math.max(0, Math.floor(clearCapacity)) * 4,
      positions.length,
      velocities.length,
    );
    positions.fill(0, 0, clearFloats);
    velocities.fill(0, 0, clearFloats);
    const count = Math.min(
      this.activeCount,
      Math.max(0, Math.floor(capacity)),
      Math.floor(positions.length / 4),
      Math.floor(velocities.length / 4),
    );
    for (let index = 0; index < count; index += 1) {
      const source = index << 1;
      const target = index * 4;
      positions[target] = this.positions[source];
      positions[target + 1] = this.positions[source + 1];
      positions[target + 2] = this.radii[index];
      positions[target + 3] = this.groups[index];
      velocities[target] = this.velocities[source];
      velocities[target + 1] = this.velocities[source + 1];
      velocities[target + 2] = this.inverseMasses[index];
      velocities[target + 3] = 0;
    }
    return count;
  }

  writeGpuParticlePositionState(positions: Float32Array, capacity: number, clearCapacity = capacity): number {
    const clearFloats = Math.min(
      Math.max(0, Math.floor(clearCapacity)) * 4,
      positions.length,
    );
    positions.fill(0, 0, clearFloats);
    const count = Math.min(
      this.activeCount,
      Math.max(0, Math.floor(capacity)),
      Math.floor(positions.length / 4),
    );
    for (let index = 0; index < count; index += 1) {
      const source = index << 1;
      const target = index * 4;
      positions[target] = this.positions[source];
      positions[target + 1] = this.positions[source + 1];
      positions[target + 2] = this.radii[index];
      positions[target + 3] = this.groups[index];
    }
    return count;
  }

  writeGpuParticleAttributeState(attributes: Float32Array, capacity: number, clearCapacity = capacity): number {
    const clearFloats = Math.min(
      Math.max(0, Math.floor(clearCapacity)) * 4,
      attributes.length,
    );
    attributes.fill(0, 0, clearFloats);
    const count = Math.min(
      this.activeCount,
      Math.max(0, Math.floor(capacity)),
      Math.floor(attributes.length / 4),
    );
    for (let index = 0; index < count; index += 1) {
      const target = index * 4;
      attributes[target] = this.radii[index];
      attributes[target + 1] = this.inverseMasses[index];
      attributes[target + 2] = this.locals[index];
      attributes[target + 3] = this.seeds[index];
    }
    return count;
  }

  writeGpuParticleAttributeStateRange(attributes: Float32Array, start: number, count: number): number {
    const maxCount = Math.floor(attributes.length / 4);
    const first = Math.max(0, Math.min(maxCount, Math.floor(start)));
    const end = Math.max(first, Math.min(maxCount, first + Math.max(0, Math.floor(count))));
    for (let index = first; index < end; index += 1) {
      const target = index * 4;
      if (index < this.activeCount) {
        attributes[target] = this.radii[index];
        attributes[target + 1] = this.inverseMasses[index];
        attributes[target + 2] = this.locals[index];
        attributes[target + 3] = this.seeds[index];
      } else {
        attributes[target] = 0;
        attributes[target + 1] = 0;
        attributes[target + 2] = 0;
        attributes[target + 3] = 0;
      }
    }
    return end - first;
  }

  private stats(collisionHits: number): AdvancedCircleParticleStats {
    return {
      count: this.activeCount,
      dynamicCount: this.dynamicCount,
      staticCount: this.activeCount - this.dynamicCount,
      linkCount: this.activeLinkCount,
      capacity: this.capacity,
      collisionHits,
      gridColumns: this.gridColumns,
      gridRows: this.gridRows,
      cellSize: this.cellSize,
      awake: this.awake,
      settledFrames: this.settledFrames,
      maxVelocity: this.lastMaxVelocity,
      maxCorrection: this.lastMaxCorrection,
    };
  }

  private random(): number {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967296;
  }

  private rebuildGridShape(): void {
    const radius = Math.max(this.settings.radius, this.largestParticleRadius);
    this.cellSize = Math.max(4, radius * 2.02);
    this.invCellSize = 1 / this.cellSize;
    this.gridColumns = Math.max(1, Math.ceil(this.width / this.cellSize));
    this.gridRows = Math.max(1, Math.ceil(this.height / this.cellSize));
    this.gridCells = this.gridColumns * this.gridRows;
    if (this.head.length < this.gridCells) {
      this.head = new Int32Array(this.gridCells);
    }
  }

  private integrate(dt: number): void {
    const positions = this.positions;
    const velocities = this.velocities;
    const previousPositions = this.previousPositions;
    const gravityDt = this.settings.gravity * dt;
    const drag = Math.pow(this.settings.airDragPerSecond, dt * 60);
    const maxSpeed = Math.max(1200, Math.min(this.width, this.height) * 5);
    const maxSpeed2 = maxSpeed * maxSpeed;

    for (let i = 0; i < this.activeCount; i += 1) {
      const k = i << 1;
      const x = positions[k];
      const y = positions[k + 1];
      previousPositions[k] = x;
      previousPositions[k + 1] = y;

      if (this.inverseMasses[i] <= 0) {
        velocities[k] = 0;
        velocities[k + 1] = 0;
        continue;
      }

      let vx = velocities[k] * drag;
      let vy = (velocities[k + 1] + gravityDt) * drag;
      const speed2 = vx * vx + vy * vy;
      if (speed2 > maxSpeed2) {
        const scale = maxSpeed / Math.sqrt(speed2);
        vx *= scale;
        vy *= scale;
      }

      positions[k] = x + vx * dt;
      positions[k + 1] = y + vy * dt;
      velocities[k] = vx;
      velocities[k + 1] = vy;
    }
  }

  private buildGrid(): void {
    this.head.fill(-1, 0, this.gridCells);
    const positions = this.positions;

    for (let i = 0; i < this.activeCount; i += 1) {
      const k = i << 1;
      let cx = (positions[k] * this.invCellSize) | 0;
      let cy = (positions[k + 1] * this.invCellSize) | 0;
      if (cx < 0) cx = 0;
      else if (cx >= this.gridColumns) cx = this.gridColumns - 1;
      if (cy < 0) cy = 0;
      else if (cy >= this.gridRows) cy = this.gridRows - 1;

      const cell = cx + cy * this.gridColumns;
      this.next[i] = this.head[cell];
      this.head[cell] = i;
    }
  }

  private solveCollisions(): number {
    const columns = this.gridColumns;
    const rows = this.gridRows;
    let collisionHits = 0;

    for (let cy = 0; cy < rows; cy += 1) {
      const row = cy * columns;
      const nextRow = row + columns;
      for (let cx = 0; cx < columns; cx += 1) {
        const cell = row + cx;
        if (this.head[cell] === -1) continue;

        collisionHits += this.collideSelfCell(cell);
        if (cx + 1 < columns) collisionHits += this.collideCellPair(cell, cell + 1);
        if (cy + 1 < rows) {
          collisionHits += this.collideCellPair(cell, nextRow + cx);
          if (cx > 0) collisionHits += this.collideCellPair(cell, nextRow + cx - 1);
          if (cx + 1 < columns) collisionHits += this.collideCellPair(cell, nextRow + cx + 1);
        }
      }
    }

    return collisionHits;
  }

  private collideSelfCell(cell: number): number {
    const head = this.head[cell];
    if (head === -1) return 0;
    let hits = 0;

    for (let i = head; i !== -1; i = this.next[i]) {
      const ia = i << 1;
      let xi = this.positions[ia];
      let yi = this.positions[ia + 1];

      for (let j = this.next[i]; j !== -1; j = this.next[j]) {
        if (!this.solvePair(i, j, xi, yi)) continue;
        xi = this.solvedPairX;
        yi = this.solvedPairY;
        hits += 1;
      }

      this.positions[ia] = xi;
      this.positions[ia + 1] = yi;
    }

    return hits;
  }

  private collideCellPair(a: number, b: number): number {
    const headA = this.head[a];
    const headB = this.head[b];
    if (headA === -1 || headB === -1) return 0;
    let hits = 0;

    for (let i = headA; i !== -1; i = this.next[i]) {
      const ia = i << 1;
      let xi = this.positions[ia];
      let yi = this.positions[ia + 1];

      for (let j = headB; j !== -1; j = this.next[j]) {
        if (!this.solvePair(i, j, xi, yi)) continue;
        xi = this.solvedPairX;
        yi = this.solvedPairY;
        hits += 1;
      }

      this.positions[ia] = xi;
      this.positions[ia + 1] = yi;
    }

    return hits;
  }

  private solvePair(i: number, j: number, xi: number, yi: number): boolean {
    if (this.shouldSkipPair(i, j)) return false;
    const positions = this.positions;
    const ja = j << 1;
    let dx = positions[ja] - xi;
    let dy = positions[ja + 1] - yi;
    let d2 = dx * dx + dy * dy;
    const minDist = this.radii[i] + this.radii[j];
    const minDist2 = minDist * minDist;

    if (d2 >= minDist2) return false;

    if (d2 < 1e-8) {
      const angle = ((i * 19349663 ^ j * 83492791) >>> 0) * 2.3283064365386963e-10 * Math.PI * 2;
      dx = Math.cos(angle) * 0.0001;
      dy = Math.sin(angle) * 0.0001;
      d2 = dx * dx + dy * dy;
    }

    const invD = 1 / Math.sqrt(d2);
    const dist = d2 * invD;
    const ux = dx * invD;
    const uy = dy * invD;
    const totalPush = (minDist - dist) * this.settings.collisionSoftness;
    const maxPush = minDist * 0.5 * this.settings.maxPairPushFactor;
    const wi = this.particleWeight(i, yi);
    const wj = this.particleWeight(j, positions[ja + 1]);
    const weightSum = wi + wj;
    if (weightSum <= 0) return false;
    if (this.contactCounts[i] < 65535) this.contactCounts[i] += 1;
    if (this.contactCounts[j] < 65535) this.contactCounts[j] += 1;
    const invWeight = 1 / weightSum;
    let pushI = totalPush * wi * invWeight;
    let pushJ = totalPush * wj * invWeight;

    if (pushI > maxPush) pushI = maxPush;
    if (pushJ > maxPush) pushJ = maxPush;

    const jdx = ux * pushJ;
    const jdy = uy * pushJ;
    const idx = -ux * pushI;
    const idy = -uy * pushI;
    const nextXi = xi + idx;
    const nextYi = yi + idy;
    const nextXj = positions[ja] + jdx;
    const nextYj = positions[ja + 1] + jdy;
    positions[ja] = nextXj;
    positions[ja + 1] = nextYj;
    this.addCorrection(i, idx, idy);
    this.addCorrection(j, jdx, jdy);
    this.applyContactFriction(i, j, nextXi, nextYi, nextXj, nextYj, ux, uy, wi, wj, invWeight);
    this.solvedPairX = nextXi;
    this.solvedPairY = nextYi;
    return true;
  }

  private applyContactFriction(i: number, j: number, xi: number, yi: number, xj: number, yj: number, normalX: number, normalY: number, wi: number, wj: number, invWeight: number): void {
    const friction = this.settings.contactFriction;
    if (friction <= 0) return;
    const previousPositions = this.previousPositions;
    const ik = i << 1;
    const jk = j << 1;
    const tangentX = -normalY;
    const tangentY = normalX;
    const viT = (xi - previousPositions[ik]) * tangentX + (yi - previousPositions[ik + 1]) * tangentY;
    const vjT = (xj - previousPositions[jk]) * tangentX + (yj - previousPositions[jk + 1]) * tangentY;
    const relativeTangent = vjT - viT;
    if (relativeTangent > -1e-5 && relativeTangent < 1e-5) return;
    const tangentImpulse = relativeTangent * Math.min(0.62, friction * 0.48);
    if (wi > 0) {
      const correction = tangentImpulse * wi * invWeight;
      previousPositions[ik] -= tangentX * correction;
      previousPositions[ik + 1] -= tangentY * correction;
    }
    if (wj > 0) {
      const correction = tangentImpulse * wj * invWeight;
      previousPositions[jk] += tangentX * correction;
      previousPositions[jk + 1] += tangentY * correction;
    }
  }

  private projectBounds(): void {
    const positions = this.positions;

    for (let i = 0; i < this.activeCount; i += 1) {
      const k = i << 1;
      const radius = this.radii[i];
      const minX = radius;
      const maxX = this.width - radius;
      const minY = radius;
      const maxY = this.height - radius;
      const nextX = clamp(positions[k], minX, maxX);
      const nextY = clamp(positions[k + 1], minY, maxY);
      if (nextX !== positions[k] || nextY !== positions[k + 1]) {
        this.addCorrection(i, nextX - positions[k], nextY - positions[k + 1]);
        positions[k] = nextX;
        positions[k + 1] = nextY;
      }
    }
  }

  private syncVelocities(dt: number): void {
    const positions = this.positions;
    const previousPositions = this.previousPositions;
    const velocities = this.velocities;
    const invDt = 1 / Math.max(dt, 1e-6);
    const damping = Math.pow(this.settings.solverDampingPerSecond, dt * 60);
    const bounce = this.settings.wallBounce ? this.settings.wallBounceCoefficient : 0;
    const wallFriction = 1 - this.settings.contactFriction * 0.92;

    for (let i = 0; i < this.activeCount; i += 1) {
      const k = i << 1;
      const x = positions[k];
      const y = positions[k + 1];
      const radius = this.radii[i];
      const minX = radius;
      const maxX = this.width - radius;
      const minY = radius;
      const maxY = this.height - radius;
      if (this.inverseMasses[i] <= 0) {
        velocities[k] = 0;
        velocities[k + 1] = 0;
        continue;
      }
      let vx = (x - previousPositions[k]) * invDt * damping;
      let vy = (y - previousPositions[k + 1]) * invDt * damping;

      if (x <= minX + 0.001 && vx < 0) {
        vx = -vx > this.settings.impactBounceThreshold ? -vx * bounce : 0;
        vy *= wallFriction;
      } else if (x >= maxX - 0.001 && vx > 0) {
        vx = vx > this.settings.impactBounceThreshold ? -vx * bounce : 0;
        vy *= wallFriction;
      }

      if (y <= minY + 0.001 && vy < 0) {
        vy = -vy > this.settings.impactBounceThreshold ? -vy * bounce : 0;
        vx *= wallFriction;
      }
      else if (y >= maxY - 0.001 && vy > 0) {
        vy = vy > this.settings.impactBounceThreshold ? -vy * bounce : 0;
        vx *= wallFriction;
      }

      if (vx > -2.5 && vx < 2.5) vx = 0;
      if (vy > -2.5 && vy < 2.5) vy = 0;

      velocities[k] = vx;
      velocities[k + 1] = vy;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > this.stepMaxVelocity) this.stepMaxVelocity = speed;
      const correctionX = this.correctionDeltas[k];
      const correctionY = this.correctionDeltas[k + 1];
      const correction = Math.sqrt(correctionX * correctionX + correctionY * correctionY);
      if (correction > this.stepMaxCorrection) this.stepMaxCorrection = correction;
    }
  }

  private zeroDynamicVelocities(): void {
    for (let i = 0; i < this.activeCount; i += 1) {
      if (this.inverseMasses[i] <= 0) continue;
      const k = i << 1;
      this.velocities[k] = 0;
      this.velocities[k + 1] = 0;
      this.previousPositions[k] = this.positions[k];
      this.previousPositions[k + 1] = this.positions[k + 1];
    }
  }

  private solveLinks(): void {
    if (this.activeLinkCount === 0 || this.settings.linkSolverPasses <= 0) return;

    for (let pass = 0; pass < this.settings.linkSolverPasses; pass += 1) {
      for (let i = 0; i < this.activeLinkCount; i += 1) {
        const a = this.linkA[i];
        const b = this.linkB[i];
        const ak = a << 1;
        const bk = b << 1;
        const ax = this.positions[ak];
        const ay = this.positions[ak + 1];
        const bx = this.positions[bk];
        const by = this.positions[bk + 1];
        let dx = bx - ax;
        let dy = by - ay;
        const d2 = dx * dx + dy * dy;
        if (d2 < 1e-8) continue;
        const distance = Math.sqrt(d2);
        dx /= distance;
        dy /= distance;
        const wa = this.inverseMasses[a];
        const wb = this.inverseMasses[b];
        const weightSum = wa + wb;
        if (weightSum <= 0) continue;
        const correction = (distance - this.linkRestLengths[i]) * this.linkStiffnesses[i] / weightSum;

        const adx = dx * correction * wa;
        const ady = dy * correction * wa;
        const bdx = -dx * correction * wb;
        const bdy = -dy * correction * wb;
        this.positions[ak] += adx;
        this.positions[ak + 1] += ady;
        this.positions[bk] += bdx;
        this.positions[bk + 1] += bdy;
        this.addCorrection(a, adx, ady);
        this.addCorrection(b, bdx, bdy);
      }
    }
  }

  private addCorrection(index: number, dx: number, dy: number): void {
    const k = index << 1;
    this.correctionDeltas[k] += dx;
    this.correctionDeltas[k + 1] += dy;
  }

  private markNeighborSlotsDirty(a: number, b: number): void {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    this.neighborSlotDirtyStart = Math.min(this.neighborSlotDirtyStart, min);
    this.neighborSlotDirtyEnd = Math.max(this.neighborSlotDirtyEnd, max);
  }

  private shouldSkipPair(i: number, j: number): boolean {
    const group = this.groups[i];
    if (group < 0 || group !== this.groups[j]) return false;
    if (!this.settings.sameGroupCollisions) return true;
    if (!this.settings.adjacentGroupCollisions && Math.abs(this.locals[i] - this.locals[j]) <= 1) return true;
    return false;
  }

  private particleWeight(index: number, y: number): number {
    const inverseMass = this.inverseMasses[index];
    if (inverseMass <= 0) return 0;
    if (this.settings.gravity <= 0) return inverseMass;
    return inverseMass * (0.22 + 0.78 * (1 - y / this.height));
  }

  private writeNeighborSlot(slots: readonly Float32Array[], index: number, neighbor: number, rest: number, stiffness: number): boolean {
    if (index < 0 || index >= this.activeCount || neighbor < 0 || neighbor >= this.activeCount) return false;
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
}
