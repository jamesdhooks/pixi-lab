import type { DirectorEvent } from '../types';
import { SeededRng } from '../utils/SeededRng';

export class DirectorMode {
  private elapsedMs = 0;
  private nextMs = 0;
  private readonly rng: SeededRng;

  constructor(
    private readonly events: readonly DirectorEvent[] = [],
    seed = 1,
  ) {
    this.rng = new SeededRng(seed);
    this.scheduleNext();
  }

  update(dt: number, idle: boolean): DirectorEvent | null {
    if (!idle || this.events.length === 0) return null;
    this.elapsedMs += dt * 1000;
    if (this.elapsedMs < this.nextMs) return null;
    const event = this.rng.pick(this.events);
    this.scheduleNext();
    return event;
  }

  reset(): void {
    this.elapsedMs = 0;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.events.length === 0) {
      this.nextMs = Number.POSITIVE_INFINITY;
      return;
    }
    const event = this.rng.pick(this.events);
    this.nextMs = this.elapsedMs + this.rng.range(event.minIntervalMs, event.maxIntervalMs);
  }
}
