import type { Vec2 } from '../../types';

export class VectorField {
  readonly values: Float32Array;

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    this.values = new Float32Array(columns * rows * 2);
  }

  get(x: number, y: number): Vec2 {
    const ix = Math.max(0, Math.min(this.columns - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(this.rows - 1, Math.floor(y)));
    const index = (iy * this.columns + ix) * 2;
    return { x: this.values[index], y: this.values[index + 1] };
  }

  set(x: number, y: number, value: Vec2): void {
    if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) return;
    const index = (y * this.columns + x) * 2;
    this.values[index] = value.x;
    this.values[index + 1] = value.y;
  }

  fill(value: Vec2): void {
    for (let i = 0; i < this.values.length; i += 2) {
      this.values[i] = value.x;
      this.values[i + 1] = value.y;
    }
  }
}
