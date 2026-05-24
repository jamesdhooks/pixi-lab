/**
 * packages/core/src/physics/Pool.ts
 *
 * Generic object pool. Pre-allocates items; acquire/release with O(1) cost.
 */

export class Pool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();
  private factory: () => T;
  private reset: (item: T) => void;

  constructor(opts: { factory: () => T; reset: (item: T) => void; initial?: number }) {
    this.factory = opts.factory;
    this.reset = opts.reset;

    const initial = opts.initial ?? 0;
    for (let i = 0; i < initial; i++) {
      this.available.push(this.factory());
    }
  }

  acquire(): T {
    let item = this.available.pop();
    if (!item) {
      item = this.factory();
    }
    this.reset(item);
    this.inUse.add(item);
    return item;
  }

  release(item: T) {
    if (!this.inUse.has(item)) return;
    this.inUse.delete(item);
    this.available.push(item);
  }

  get activeCount() {
    return this.inUse.size;
  }

  get idleCount() {
    return this.available.length;
  }

  get totalCount() {
    return this.inUse.size + this.available.length;
  }

  releaseAll() {
    for (const item of this.inUse) {
      this.available.push(item);
    }
    this.inUse.clear();
  }
}
