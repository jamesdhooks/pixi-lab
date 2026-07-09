/**
 * packages/core/src/Input.ts
 *
 * Unified pointer/touch input handler.
 * Human and AI both produce the same PointerEvent records.
 * AI intents are injected via injectIntent().
 */
import type { InputSnapshot, PointerEvent as GamePointerEvent, Intent } from './types.js';

export class Input {
  private canvas: HTMLElement | null = null;
  private _snapshot: InputSnapshot = {
    pointers: new Map(),
    justDown: new Set(),
    justUp: new Set(),
  };

  private pendingDown = new Set<number>();
  private pendingUp = new Set<number>();
  private pendingRemoval = new Set<number>();
  private removalAfterFlush = new Set<number>();

  // Coordinate transform: logical scale factor canvas → game world
  private scaleX = 1;
  private scaleY = 1;

  mount(el: HTMLElement) {
    this.canvas = el;
    el.addEventListener('pointerdown', this.onDown, { passive: false });
    el.addEventListener('pointermove', this.onMove, { passive: false });
    el.addEventListener('pointerup', this.onUp, { passive: false });
    el.addEventListener('pointercancel', this.onCancel, { passive: false });
    // Prevent context menu on long press
    el.addEventListener('contextmenu', this.onContextMenu);
  }

  unmount() {
    if (!this.canvas) return;
    const el = this.canvas;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onCancel);
    el.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas = null;
    this._snapshot.pointers.clear();
    this._snapshot.justDown.clear();
    this._snapshot.justUp.clear();
  }

  /** Call at the start of each game tick to rotate justDown/justUp sets */
  flush() {
    for (const id of this.removalAfterFlush) {
      this._snapshot.pointers.delete(id);
    }
    this.removalAfterFlush.clear();
    this._snapshot.justDown = new Set(this.pendingDown);
    this._snapshot.justUp = new Set(this.pendingUp);
    this.removalAfterFlush = new Set(this.pendingRemoval);
    this.pendingDown.clear();
    this.pendingUp.clear();
    this.pendingRemoval.clear();
  }

  get snapshot(): Readonly<InputSnapshot> {
    return this._snapshot;
  }

  /** Update scale when canvas is resized */
  setScale(x: number, y: number) {
    this.scaleX = x;
    this.scaleY = y;
  }

  /** AI can inject simulated intents which become PointerEvents in the queue */
  injectIntent(intent: Intent) {
    const id = intent.id ?? this.createAiPointerId();
    const now = performance.now();
    if (intent.kind === 'tap') {
      const ev: GamePointerEvent = {
        id,
        x: intent.x,
        y: intent.y,
        type: 'down',
        source: 'ai',
        timestamp: now,
      };
      this._snapshot.pointers.set(id, ev);
      this.pendingDown.add(id);
      // Auto-release on next flush
      setTimeout(() => {
        this._snapshot.pointers.delete(id);
        this.pendingUp.add(id);
      }, 80);
    } else if (intent.kind === 'drag_start') {
      const ev: GamePointerEvent = {
        id,
        x: intent.x,
        y: intent.y,
        type: 'down',
        source: 'ai',
        timestamp: now,
      };
      this._snapshot.pointers.set(id, ev);
      this.pendingDown.add(id);
    } else if (intent.kind === 'drag_move') {
      const existing = this._snapshot.pointers.get(id);
      if (existing) {
        existing.x = intent.x;
        existing.y = intent.y;
        existing.type = 'move';
      }
    } else if (intent.kind === 'drag_end' || intent.kind === 'release') {
      this._snapshot.pointers.delete(id);
      this.pendingUp.add(id);
    }
  }

  private createAiPointerId(): number {
    let id = -1 - Math.floor(Math.random() * 1_000_000_000);
    while (this._snapshot.pointers.has(id)) {
      id = -1 - Math.floor(Math.random() * 1_000_000_000);
    }
    return id;
  }

  private clientToGame(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: (clientX - rect.left) * this.scaleX,
      y: (clientY - rect.top) * this.scaleY,
    };
  }

  private onDown = (e: globalThis.PointerEvent) => {
    e.preventDefault();
    const { x, y } = this.clientToGame(e.clientX, e.clientY);
    const ev: GamePointerEvent = {
      id: e.pointerId,
      x,
      y,
      type: 'down',
      source: 'human',
      timestamp: e.timeStamp,
    };
    this._snapshot.pointers.set(e.pointerId, ev);
    this.pendingDown.add(e.pointerId);
  };

  private onMove = (e: globalThis.PointerEvent) => {
    const existing = this._snapshot.pointers.get(e.pointerId);
    if (!existing) return;
    const { x, y } = this.clientToGame(e.clientX, e.clientY);
    existing.x = x;
    existing.y = y;
    existing.type = 'move';
  };

  private onUp = (e: globalThis.PointerEvent) => {
    const existing = this._snapshot.pointers.get(e.pointerId);
    if (existing) {
      const { x, y } = this.clientToGame(e.clientX, e.clientY);
      existing.x = x;
      existing.y = y;
      existing.type = 'up';
    }
    this.pendingUp.add(e.pointerId);
    this.pendingRemoval.add(e.pointerId);
  };

  private onCancel = (e: globalThis.PointerEvent) => {
    const existing = this._snapshot.pointers.get(e.pointerId);
    if (existing) {
      existing.type = 'up';
    }
    this.pendingUp.add(e.pointerId);
    this.pendingRemoval.add(e.pointerId);
  };

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };
}
