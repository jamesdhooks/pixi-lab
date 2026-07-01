import { ScalarField, SeededRng } from '@hooksjam/pixi-lab-core';
import type { GestureEvent, RenderQuality, StagnationReport, Vec2 } from '@hooksjam/pixi-lab-core';

export interface HarmonicEmitter {
  position: Vec2;
  frequency: number;
  phase: number;
  amplitude: number;
  /** 0 = normal, 0–1 = deletion animation in progress. */
  deleteProgress: number;
}

export interface HarmonicSandModelOptions {
  seed: number;
  width: number;
  height: number;
  quality: RenderQuality;
  /** Number of columns in the scalar field grid. Rows are computed proportionally. */
  fieldColumns: number;
  emitterCount: number;
  baseFrequency: number;
  wavePeriod?: number;
}

export class HarmonicSandModel {
  readonly emitters: HarmonicEmitter[] = [];
  private _field: ScalarField;
  private readonly rng: SeededRng;
  private time = 0;
  private stagnantMs = 0;
  /** Index of the emitter currently being deleted, -1 if none. */
  private pendingDeleteIndex = -1;
  /** Seconds elapsed since the deletion animation started. */
  private pendingDeleteElapsed = 0;
  /** Total seconds for the deletion animation before the emitter is removed. */
  private static readonly DELETE_DURATION = 0.38;

  /** The live scalar field — read-only externally. */
  get field(): ScalarField { return this._field; }

  constructor(private readonly options: HarmonicSandModelOptions) {
    const rows = this.computeRows(options.fieldColumns);
    this._field = new ScalarField(options.fieldColumns, rows);
    this.rng = new SeededRng(options.seed);
    this.reset(options.seed);
  }

  private computeRows(cols: number): number {
    return Math.max(1, Math.round(cols * this.options.height / Math.max(1, this.options.width)));
  }

  reset(seed = this.options.seed): void {
    this.emitters.length = 0;
    this.pendingDeleteIndex = -1;
    this.pendingDeleteElapsed = 0;
    const resetRng = new SeededRng(seed);
    const count = Math.max(0, Math.floor(this.options.emitterCount));
    for (let i = 0; i < count; i++) {
      this.emitters.push({
        position: {
          x: resetRng.range(this.options.width * 0.15, this.options.width * 0.85),
          y: resetRng.range(this.options.height * 0.15, this.options.height * 0.85),
        },
        frequency: this.options.baseFrequency + resetRng.range(-0.45, 0.45),
        phase: resetRng.range(0, Math.PI * 2),
        amplitude: resetRng.range(0.75, 1.2),
        deleteProgress: 0,
      });
    }
    this.time = 0;
    this.stagnantMs = 0;
  }

  /** Remove all emitters without touching the scalar field — avoids the black
   *  flash that occurs when the full reset recreates the field at zero. */
  clearEmitters(): void {
    this.emitters.length = 0;
    this.pendingDeleteIndex = -1;
    this.pendingDeleteElapsed = 0;
  }

  /** Seconds elapsed since last reset — used for emitter pulse animation. */
  get elapsedTime(): number {
    return this.time;
  }

  setQuality(_quality: RenderQuality): void {
    // Quality is a rendering concern handled by SimulationCanvasLayer.
    // The physics simulation is always quality-agnostic.
  }

  /** Resize the scalar field grid live — takes effect from the next update tick. */
  setFieldResolution(cols: number): void {
    this.options.fieldColumns = cols;
    this._field = new ScalarField(cols, this.computeRows(cols));
  }

  /** Add or remove emitters to match the requested count. New emitters are
   *  placed randomly and inherit a frequency near the current base. */
  setEmitterCount(count: number): void {
    this.options.emitterCount = count;
    const target = Math.max(1, Math.floor(count));
    while (this.emitters.length > target) {
      this.emitters.pop();
    }
    while (this.emitters.length < target) {
      this.emitters.push({
        position: {
          x: this.rng.range(this.options.width * 0.15, this.options.width * 0.85),
          y: this.rng.range(this.options.height * 0.15, this.options.height * 0.85),
        },
        frequency: this.options.baseFrequency + this.rng.range(-0.45, 0.45),
        phase: this.rng.range(0, Math.PI * 2),
        amplitude: this.rng.range(0.75, 1.2),
        deleteProgress: 0,
      });
    }
  }

  /** Update all emitter frequencies around the new base value. */
  setBaseFrequency(freq: number): void {
    this.options.baseFrequency = freq;
    for (const emitter of this.emitters) {
      emitter.frequency = freq + this.rng.range(-0.45, 0.45);
    }
  }

  /** Wave period in seconds-ish: larger values make phase travel slower. */
  setWavePeriod(period: number): void {
    this.options.wavePeriod = Math.max(0.1, period);
  }

  update(dt: number): void {
    const configuredPeriod = typeof this.options.wavePeriod === 'number' ? this.options.wavePeriod : 1;
    const period = Math.max(0.1, configuredPeriod);
    this.time += dt / period;
    // Advance deletion animation, remove emitter when complete.
    if (this.pendingDeleteIndex >= 0 && this.pendingDeleteIndex < this.emitters.length) {
      this.pendingDeleteElapsed += dt;
      const progress = Math.min(1, this.pendingDeleteElapsed / HarmonicSandModel.DELETE_DURATION);
      this.emitters[this.pendingDeleteIndex].deleteProgress = progress;
      if (progress >= 1) {
        this.emitters.splice(this.pendingDeleteIndex, 1);
        this.pendingDeleteIndex = -1;
        this.pendingDeleteElapsed = 0;
      }
    }
    this.updateField();
  }

  handleGesture(event: GestureEvent): void {
    switch (event.kind) {
      case 'tap':
        // Don't create a new emitter if the tap landed on/near an existing one
        // (prevents accidental creation when a drag releases close to its start).
        if (!this.isNearAnyEmitter(event.x, event.y, 35)) {
          this.addEmitter(event.x, event.y);
        }
        break;
      case 'drag':
        this.moveNearestEmitter(event.x, event.y);
        break;
      case 'double_tap': {
        // Double-tap on/near an emitter starts the brief deletion animation.
        const idx = this.nearestEmitterIndex(event.x, event.y);
        if (idx >= 0) {
          const dist = Math.hypot(
            this.emitters[idx].position.x - event.x,
            this.emitters[idx].position.y - event.y,
          );
          if (dist <= 48 && this.pendingDeleteIndex < 0) {
            this.pendingDeleteIndex = idx;
            this.pendingDeleteElapsed = 0;
          }
        }
        break;
      }
      case 'fast_swipe':
        this.injectShock(event.x, event.y, event.dx ?? 0, event.dy ?? 0);
        break;
      default:
        break;
    }
  }

  detectStagnation(dt: number): StagnationReport {
    const fieldStats = this.field.stats();
    const stagnant = fieldStats.variance < 0.002;
    this.stagnantMs = stagnant ? this.stagnantMs + dt * 1000 : 0;
    return {
      stagnant: this.stagnantMs > 2500,
      reason: stagnant ? 'low field variance' : undefined,
      severity: stagnant ? Math.min(1, this.stagnantMs / 6000) : 0,
      observedForMs: this.stagnantMs,
    };
  }

  stabilize(): void {
    for (const emitter of this.emitters) {
      emitter.phase += this.rng.range(0.35, 1.2);
      emitter.position.x = Math.max(0, Math.min(this.options.width, emitter.position.x + this.rng.range(-40, 40)));
      emitter.position.y = Math.max(0, Math.min(this.options.height, emitter.position.y + this.rng.range(-40, 40)));
      emitter.amplitude = Math.min(1.7, emitter.amplitude + 0.2);
    }
    if (this.emitters.length < 6) {
      this.addEmitter(this.rng.range(0, this.options.width), this.rng.range(0, this.options.height));
    }
    this.stagnantMs = 0;
  }

  private updateField(): void {
    for (let y = 0; y < this.field.rows; y++) {
      for (let x = 0; x < this.field.columns; x++) {
        const px = (x / Math.max(1, this.field.columns - 1)) * this.options.width;
        const py = (y / Math.max(1, this.field.rows - 1)) * this.options.height;
        let value = 0;
        for (const emitter of this.emitters) {
          const dx = px - emitter.position.x;
          const dy = py - emitter.position.y;
          const radius = Math.max(1, Math.hypot(dx, dy));
          value += Math.sin(radius * 0.035 * emitter.frequency - this.time * emitter.frequency + emitter.phase) * emitter.amplitude;
        }
        this.field.set(x, y, value / Math.max(1, this.emitters.length));
      }
    }
  }

  private addEmitter(x: number, y: number): void {
    if (this.emitters.length >= 10) return;
    this.emitters.push({
      position: { x, y },
      frequency: this.options.baseFrequency + this.rng.range(-0.8, 0.8),
      phase: this.rng.range(0, Math.PI * 2),
      amplitude: 1.1,
      deleteProgress: 0,
    });
  }

  private moveNearestEmitter(x: number, y: number): void {
    const idx = this.nearestEmitterIndex(x, y);
    if (idx < 0) return;
    const nearest = this.emitters[idx];
    nearest.position.x += (x - nearest.position.x) * 0.25;
    nearest.position.y += (y - nearest.position.y) * 0.25;
  }

  private nearestEmitterIndex(x: number, y: number): number {
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.emitters.length; i++) {
      const d = Math.hypot(this.emitters[i].position.x - x, this.emitters[i].position.y - y);
      if (d < bestDist) { best = i; bestDist = d; }
    }
    return best;
  }

  private isNearAnyEmitter(x: number, y: number, radius: number): boolean {
    return this.emitters.some(e => Math.hypot(e.position.x - x, e.position.y - y) <= radius);
  }

  private injectShock(x: number, y: number, dx: number, _dy: number): void {
    // Without particles, disturb nearby emitter phases to create a visible
    // perturbation when the user fast-swipes across the plate.
    const speed = Math.hypot(dx, _dy);
    for (const emitter of this.emitters) {
      const distance = Math.hypot(emitter.position.x - x, emitter.position.y - y);
      if (distance > 200) continue;
      const falloff = 1 - distance / 200;
      emitter.phase += (speed > 0 ? 1 : 0.5) * 1.8 * falloff;
      emitter.amplitude = Math.min(1.8, emitter.amplitude + 0.3 * falloff);
    }
  }
}
