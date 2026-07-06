export interface AdvancedUniformGridCell {
  readonly x: number;
  readonly y: number;
  readonly index: number;
}

/**
 * Small allocation-free linked-list grid for broadphase collision passes.
 *
 * It is intentionally shape-agnostic: callers insert an item index at a
 * representative point, then use `head` and `next` to perform their own
 * narrowphase for circles, capsules, boxes, pegs, or soft-body nodes.
 */
export class AdvancedUniformGrid {
  readonly next: Int32Array;
  head = new Int32Array(1);
  columns = 1;
  rows = 1;
  cellSize = 16;

  constructor(readonly capacity: number) {
    this.next = new Int32Array(capacity);
  }

  configure(width: number, height: number, cellSize: number): void {
    this.cellSize = Math.max(2, cellSize);
    this.columns = Math.max(1, Math.ceil(Math.max(1, width) / this.cellSize));
    this.rows = Math.max(1, Math.ceil(Math.max(1, height) / this.cellSize));
    const cells = this.columns * this.rows;
    if (this.head.length < cells) {
      this.head = new Int32Array(cells);
    }
    this.head.fill(-1, 0, cells);
  }

  insert(index: number, x: number, y: number): void {
    let cx = (x / this.cellSize) | 0;
    let cy = (y / this.cellSize) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.columns) cx = this.columns - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;

    const cell = cx + cy * this.columns;
    this.next[index] = this.head[cell];
    this.head[cell] = index;
  }

  forNeighborCells(
    cellX: number,
    cellY: number,
    radius: number,
    callback: (cell: AdvancedUniformGridCell) => void,
  ): void {
    for (let y = Math.max(0, cellY - radius); y <= Math.min(this.rows - 1, cellY + radius); y += 1) {
      for (let x = Math.max(0, cellX - radius); x <= Math.min(this.columns - 1, cellX + radius); x += 1) {
        callback({ x, y, index: x + y * this.columns });
      }
    }
  }
}
