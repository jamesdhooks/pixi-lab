export class ScalarField {
  readonly values: Float32Array;

  constructor(
    readonly columns: number,
    readonly rows: number,
    initialValue = 0,
  ) {
    this.values = new Float32Array(columns * rows);
    if (initialValue !== 0) this.values.fill(initialValue);
  }

  get(x: number, y: number): number {
    const ix = Math.max(0, Math.min(this.columns - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(this.rows - 1, Math.floor(y)));
    return this.values[iy * this.columns + ix];
  }

  set(x: number, y: number, value: number): void {
    if (x < 0 || y < 0 || x >= this.columns || y >= this.rows) return;
    this.values[y * this.columns + x] = value;
  }

  sampleNormalized(x: number, y: number): number {
    return this.get(x * (this.columns - 1), y * (this.rows - 1));
  }

  /**
   * Bilinear interpolation between the four nearest grid cells.
   * Much smoother than sampleNormalized when the texture is displayed at a
   * higher resolution than the underlying grid.
   */
  sampleBilinearNormalized(nx: number, ny: number): number {
    const fx = nx * (this.columns - 1);
    const fy = ny * (this.rows - 1);
    const x0 = Math.max(0, Math.min(this.columns - 1, Math.floor(fx)));
    const x1 = Math.min(this.columns - 1, x0 + 1);
    const y0 = Math.max(0, Math.min(this.rows - 1, Math.floor(fy)));
    const y1 = Math.min(this.rows - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const v00 = this.values[y0 * this.columns + x0];
    const v10 = this.values[y0 * this.columns + x1];
    const v01 = this.values[y1 * this.columns + x0];
    const v11 = this.values[y1 * this.columns + x1];
    return v00 + (v10 - v00) * tx + (v01 - v00) * ty + (v11 - v10 - v01 + v00) * tx * ty;
  }

  gradientNormalized(x: number, y: number): { x: number; y: number } {
    const gx = x * (this.columns - 1);
    const gy = y * (this.rows - 1);
    return {
      x: this.get(gx + 1, gy) - this.get(gx - 1, gy),
      y: this.get(gx, gy + 1) - this.get(gx, gy - 1),
    };
  }

  fill(value: number): void {
    this.values.fill(value);
  }

  stats(): { mean: number; variance: number; min: number; max: number } {
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const value of this.values) {
      sum += value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    const mean = sum / this.values.length;
    let varianceSum = 0;
    for (const value of this.values) {
      const delta = value - mean;
      varianceSum += delta * delta;
    }
    return { mean, variance: varianceSum / this.values.length, min, max };
  }
}
