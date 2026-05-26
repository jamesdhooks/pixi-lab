import { Container, Graphics, type Application } from 'pixi.js';
import type { ScalarField } from '../sim/fields/ScalarField.js';
import type { TriangularGrid } from '../sim/grids/TriangularGrid.js';
import type { RenderQuality, SimStyle } from '../types.js';

export interface MeshLatticeRenderOptions {
  alpha?: number;
  zIndex?: number;
  field?: ScalarField;
}

export class MeshLatticeRenderer {
  readonly container = new Container();
  private readonly graphics = new Graphics();
  private quality: RenderQuality = 'basic';

  constructor(app: Application) {
    this.container.addChild(this.graphics);
    app.stage.addChild(this.container);
  }

  setQuality(quality: RenderQuality): void {
    this.quality = quality;
  }

  clear(): void {
    this.graphics.clear();
  }

  renderGrid(
    grid: TriangularGrid,
    width: number,
    height: number,
    style: SimStyle,
    options: MeshLatticeRenderOptions = {},
  ): void {
    this.graphics.clear();
    this.container.alpha = options.alpha ?? 1;
    this.container.zIndex = options.zIndex ?? this.container.zIndex;

    const palette = style.palette.length > 0 ? style.palette : [0xffffff];
    const cellWidth = width / Math.max(1, grid.columns);
    const cellHeight = height / Math.max(1, grid.rows);
    const strokeAlpha = this.quality === 'basic' ? 0.08 : 0.16;

    for (const cell of grid.cells) {
      const fieldValue = options.field?.get(cell.column, cell.row) ?? cell.value;
      if (!cell.active && fieldValue <= 0.04) continue;

      const value = Math.max(0, Math.min(1, cell.active ? Math.max(fieldValue, 0.35) : fieldValue));
      const color = palette[Math.min(palette.length - 1, Math.floor(value * palette.length))];
      const x = cell.column * cellWidth;
      const y = cell.row * cellHeight;
      const flip = (cell.column + cell.row) % 2 === 0;
      const points = flip
        ? [x, y + cellHeight, x + cellWidth * 0.5, y, x + cellWidth, y + cellHeight]
        : [x, y, x + cellWidth, y, x + cellWidth * 0.5, y + cellHeight];

      this.graphics.poly(points);
      this.graphics.fill({ color, alpha: 0.16 + value * 0.64 });
      if (this.quality !== 'basic' && cell.active) {
        this.graphics.poly(points);
        this.graphics.stroke({ color: 0xffffff, alpha: strokeAlpha + value * 0.14, width: 1 });
      }
    }
  }

  get layer(): Graphics {
    return this.graphics;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
