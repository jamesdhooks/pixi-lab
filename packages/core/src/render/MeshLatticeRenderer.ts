import { Buffer, BufferUsage, Container, Mesh, MeshGeometry, Shader, type Application } from 'pixi.js';
import type { ScalarField } from '../sim/fields/ScalarField.js';
import type { TriangularGrid } from '../sim/grids/TriangularGrid.js';
import type { RenderQuality, SimStyle } from '../types.js';

export interface MeshLatticeRenderOptions {
  alpha?: number;
  zIndex?: number;
  /** Optional scalar field to override cell.value for colour lookup. */
  field?: ScalarField;
}

/** Expand each triangle slightly from its centroid to eliminate sub-pixel seam gaps. */
const TRIANGLE_SCALE = 1.002;

/** Background colour for empty / inactive cells — matches canvas clear 0x050508. */
const BG_R = 0x05 / 255;
const BG_G = 0x05 / 255;
const BG_B = 0x08 / 255;

const VERT_GLSL = /* glsl */ `
  precision mediump float;
  attribute vec2 aPosition;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAG_GLSL = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

/**
 * Renders a {@link TriangularGrid} as a single GPU mesh.
 *
 * All triangle positions are allocated once per grid dimension; only the
 * per-vertex colour buffer is written and uploaded each frame.  This yields
 * a single draw call with one buffer upload — matching the approach used by
 * the standalone reference demo.
 */
export class MeshLatticeRenderer {
  readonly container = new Container();

  private mesh: Mesh<MeshGeometry, Shader> | null = null;
  private colorBuffer: Buffer | null = null;
  private colorsData: Float32Array | null = null;
  private lastCols = 0;
  private lastRows = 0;
  private renderCols = 0; // = grid.columns + 1 (one overflow column on the left)
  private quality: RenderQuality = 'basic';

  constructor(private readonly app: Application) {
    this.app.stage.addChild(this.container);
  }

  setQuality(quality: RenderQuality): void {
    if (quality !== this.quality) {
      this.quality = quality;
      this.lastCols = 0; // invalidate so buildMesh runs on next renderGrid
    }
  }

  /** No-op kept for API compatibility; the mesh is persistent across frames. */
  clear(): void { /* intentional no-op */ }

  renderGrid(
    grid: TriangularGrid,
    width: number,
    height: number,
    style: SimStyle,
    options: MeshLatticeRenderOptions = {},
  ): void {
    if (grid.columns !== this.lastCols || grid.rows !== this.lastRows) {
      this.buildMesh(grid, width, height);
    }

    this.container.alpha = options.alpha ?? 1;
    if (options.zIndex !== undefined) this.container.zIndex = options.zIndex;

    this.writeColors(grid, style, options.field);
    this.colorBuffer!.update();
  }

  get layer(): Container {
    return this.container;
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.mesh = null;
    this.colorBuffer = null;
    this.colorsData = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildMesh(grid: TriangularGrid, width: number, height: number): void {
    if (this.mesh) {
      this.container.removeChild(this.mesh);
      this.mesh.destroy({ children: true });
      this.mesh = null;
    }

    const cols = grid.columns;
    const rows = grid.rows;
    // One extra render column on the left (renderCol 0, bx=-half) ensures the left
    // canvas edge is fully covered — its off-canvas portion is clipped by WebGL.
    // The rightmost renderCol's right vertex reaches width+half (also clipped). ✓
    const renderCols = cols + 1;
    const n = renderCols * rows;

    // 3 vertices per triangle; 2 clip-space floats per vertex
    const positions  = new Float32Array(n * 3 * 2);
    const uvs        = new Float32Array(n * 3 * 2); // required but unused
    const indices    = new Uint32Array(n * 3);       // trivial sequential
    const colorsData = new Float32Array(n * 3 * 3); // 3 floats (r,g,b) per vertex

    // In the correct isometric tessellation adjacent triangles share edges.
    // base-x of renderCol rc is (rc-1)*(side/2): the first column starts at -half
    // (partially off-canvas left) and the last column ends at width+half (clipped right).
    const side  = 2 * width  / Math.max(1, cols); // base length of one triangle
    const half  = side * 0.5;                      // = width/cols
    const cellH = height / Math.max(1, rows);

    for (let c = 0; c < n; c++) {
      const renderCol = c % renderCols;
      const row = Math.floor(c / renderCols);
      const bx = (renderCol - 1) * half; // shifted: renderCol 0 at bx=-half
      const ty = row * cellH;            // top y of this row band
      const by = (row + 1) * cellH;      // bottom y of this row band

      // Screen-space vertices:
      //   (renderCol+row)%2===0 → apex up (∆)   (renderCol+row)%2===1 → apex down (∇)
      let sx0: number, sy0: number, sx1: number, sy1: number, sx2: number, sy2: number;
      if ((renderCol + row) % 2 === 0) {
        sx0 = bx;        sy0 = by;  // bottom-left
        sx1 = bx + half; sy1 = ty;  // top-centre (apex)
        sx2 = bx + side; sy2 = by;  // bottom-right
      } else {
        sx0 = bx;        sy0 = ty;  // top-left
        sx1 = bx + side; sy1 = ty;  // top-right
        sx2 = bx + half; sy2 = by;  // bottom-centre (apex)
      }

      // Scale from centroid to eliminate sub-pixel seam gaps
      const cx = (sx0 + sx1 + sx2) / 3;
      const cy = (sy0 + sy1 + sy2) / 3;
      const verts: [number, number][] = [
        [cx + (sx0 - cx) * TRIANGLE_SCALE, cy + (sy0 - cy) * TRIANGLE_SCALE],
        [cx + (sx1 - cx) * TRIANGLE_SCALE, cy + (sy1 - cy) * TRIANGLE_SCALE],
        [cx + (sx2 - cx) * TRIANGLE_SCALE, cy + (sy2 - cy) * TRIANGLE_SCALE],
      ];

      for (let k = 0; k < 3; k++) {
        const vi = c * 3 + k;
        // Convert screen → clip space: x ∈ [-1,1], y flipped
        positions[vi * 2 + 0] = (verts[k][0] / width)  *  2 - 1;
        positions[vi * 2 + 1] = 1 - (verts[k][1] / height) * 2;
        indices[vi] = vi;
        colorsData[vi * 3 + 0] = BG_R;
        colorsData[vi * 3 + 1] = BG_G;
        colorsData[vi * 3 + 2] = BG_B;
      }
    }

    const geometry = new MeshGeometry({ positions, uvs, indices, topology: 'triangle-list' });

    const colorBuf = new Buffer({ data: colorsData, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    geometry.addAttribute('aColor', { buffer: colorBuf, format: 'float32x3' });

    const shader = Shader.from({ gl: { vertex: VERT_GLSL, fragment: FRAG_GLSL } });

    const mesh = new Mesh<MeshGeometry, Shader>({ geometry, shader });
    this.mesh = mesh;
    this.container.addChild(mesh);

    this.colorBuffer = colorBuf;
    this.colorsData  = colorsData;
    this.renderCols  = renderCols;
    this.lastCols    = cols;
    this.lastRows    = rows;
  }

  private writeColors(grid: TriangularGrid, style: SimStyle, field?: ScalarField): void {
    if (!this.colorsData || !this.renderCols) return;

    const palette = style.palette.length > 0 ? style.palette : [0xffffff];
    const cols       = grid.columns;
    const renderCols = this.renderCols; // = cols + 1
    const n          = renderCols * grid.rows;

    for (let c = 0; c < n; c++) {
      const renderCol = c % renderCols;
      const row       = Math.floor(c / renderCols);
      // renderCol 0 is the overflow column — clamp to the leftmost data column.
      const dataCol   = Math.max(0, Math.min(cols - 1, renderCol - 1));
      const cell      = grid.cells[row * cols + dataCol];
      if (!cell) continue;

      const rawValue = field?.get(cell.column, cell.row) ?? cell.value;
      let r: number, g: number, b: number;

      if (!cell.active && rawValue <= 0.04) {
        r = BG_R; g = BG_G; b = BG_B;
      } else {
        const v = Math.min(1, Math.max(0, cell.active ? Math.max(rawValue, 0.35) : rawValue));
        // Smoothstep interpolation between adjacent palette entries (softer colour transitions)
        const scaled = v * palette.length;
        const i0     = Math.min(palette.length - 1, Math.floor(scaled));
        const i1     = Math.min(palette.length - 1, i0 + 1);
        const frac   = scaled - Math.floor(scaled);
        const t      = frac * frac * (3 - 2 * frac); // smoothstep
        const hex0 = palette[i0];
        const hex1 = palette[i1];
        r = ((hex0 >>> 16 & 0xff) + (((hex1 >>> 16 & 0xff) - (hex0 >>> 16 & 0xff)) * t)) / 255;
        g = ((hex0 >>>  8 & 0xff) + (((hex1 >>>  8 & 0xff) - (hex0 >>>  8 & 0xff)) * t)) / 255;
        b = ((hex0        & 0xff) + (((hex1        & 0xff) - (hex0        & 0xff)) * t)) / 255;
      }

      for (let k = 0; k < 3; k++) {
        const vi = c * 3 + k;
        this.colorsData[vi * 3 + 0] = r;
        this.colorsData[vi * 3 + 1] = g;
        this.colorsData[vi * 3 + 2] = b;
      }
    }
  }
}
