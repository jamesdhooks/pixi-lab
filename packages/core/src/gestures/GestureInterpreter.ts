import type { GestureEvent, InputSnapshot, PointerEvent } from '../types.js';

interface PointerState {
  start: PointerEvent;
  latest: PointerEvent;
  lastMove: PointerEvent;
  holdEmitted: boolean;
}

export interface GestureInterpreterOptions {
  holdMs?: number;
  doubleTapMs?: number;
  swipeVelocity?: number;
  tapMoveTolerance?: number;
}

export class GestureInterpreter {
  private readonly states = new Map<number, PointerState>();
  private lastTap: { x: number; y: number; timestamp: number } | null = null;

  constructor(private readonly options: GestureInterpreterOptions = {}) {}

  update(snapshot: InputSnapshot, now = performance.now()): GestureEvent[] {
    const events: GestureEvent[] = [];
    const holdMs = this.options.holdMs ?? 450;

    for (const id of snapshot.justDown) {
      const pointer = snapshot.pointers.get(id);
      if (pointer) {
        this.states.set(id, { start: pointer, latest: pointer, lastMove: pointer, holdEmitted: false });
      }
    }

    for (const [, pointer] of snapshot.pointers) {
      const state = this.states.get(pointer.id);
      if (!state) continue;
      const dx = pointer.x - state.start.x;
      const dy = pointer.y - state.start.y;
      const durationMs = now - state.start.timestamp;
      if (pointer.type === 'move') {
        events.push({ kind: 'drag', id: pointer.id, x: pointer.x, y: pointer.y, dx, dy, durationMs, timestamp: now });
        state.lastMove = state.latest;
        state.latest = pointer;
      }
      if (!state.holdEmitted && durationMs >= holdMs) {
        state.holdEmitted = true;
        events.push({ kind: 'hold', id: pointer.id, x: pointer.x, y: pointer.y, durationMs, strength: Math.min(1, durationMs / 1500), timestamp: now });
      }
    }

    for (const id of snapshot.justUp) {
      const state = this.states.get(id);
      if (!state) continue;
      const dx = state.latest.x - state.start.x;
      const dy = state.latest.y - state.start.y;
      const durationMs = Math.max(1, now - state.start.timestamp);
      const distance = Math.hypot(dx, dy);
      const velocity = distance / durationMs;
      const tapMoveTolerance = this.options.tapMoveTolerance ?? 12;
      const swipeVelocity = this.options.swipeVelocity ?? 0.9;

      if (distance <= tapMoveTolerance) {
        events.push({ kind: 'tap', id, x: state.latest.x, y: state.latest.y, durationMs, timestamp: now });
        const doubleTapMs = this.options.doubleTapMs ?? 280;
        if (this.lastTap && now - this.lastTap.timestamp <= doubleTapMs) {
          events.push({ kind: 'double_tap', id, x: state.latest.x, y: state.latest.y, durationMs, timestamp: now });
        }
        this.lastTap = { x: state.latest.x, y: state.latest.y, timestamp: now };
      } else if (velocity >= swipeVelocity) {
        events.push({ kind: 'fast_swipe', id, x: state.latest.x, y: state.latest.y, dx, dy, velocity, durationMs, timestamp: now });
      }

      this.states.delete(id);
    }

    const active = [...snapshot.pointers.values()];
    if (active.length >= 2) {
      const [a, b] = active;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const first = this.states.get(a.id);
      const second = this.states.get(b.id);
      if (first && second) {
        const startDistance = Math.hypot(first.start.x - second.start.x, first.start.y - second.start.y);
        const delta = distance - startDistance;
        if (Math.abs(delta) > 20) {
          events.push({ kind: delta > 0 ? 'spread' : 'pinch', x: a.x, y: a.y, x2: b.x, y2: b.y, strength: Math.min(1, Math.abs(delta) / 180), timestamp: now });
        }
      }
    }

    return events;
  }

  reset(): void {
    this.states.clear();
    this.lastTap = null;
  }
}
