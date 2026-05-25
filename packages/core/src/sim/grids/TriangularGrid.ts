export interface TriangularGridCell {
  index: number;
  column: number;
  row: number;
  value: number;
  active: boolean;
}

export class TriangularGrid {
  readonly cells: TriangularGridCell[];

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    this.cells = Array.from({ length: columns * rows }, (_, index) => ({
      index,
      column: index % columns,
      row: Math.floor(index / columns),
      value: 0,
      active: false,
    }));
  }

  get(column: number, row: number): TriangularGridCell | undefined {
    if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) return undefined;
    return this.cells[row * this.columns + column];
  }

  activeCells(): TriangularGridCell[] {
    return this.cells.filter((cell) => cell.active);
  }
}
