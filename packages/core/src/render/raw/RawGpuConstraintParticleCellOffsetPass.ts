import { RawGpuFloatPrefixSumPass, type RawGpuFloatPrefixSumStats } from './RawGpuFloatPrefixSumPass.js';
import type { RawFramebuffer, RawTexturePrecision, RawWebGL2ResourceContext } from './RawWebGL2ResourceContext.js';

export interface RawGpuConstraintParticleCellOffsetOptions {
  occupancy: RawFramebuffer;
  gridColumns: number;
  gridRows: number;
}

export interface RawGpuConstraintParticleCellOffsetStats {
  gridColumns: number;
  gridRows: number;
  cellCount: number;
  prefixPasses: number;
  fragmentTexels: number;
  gpuOwnedCellOffsets: boolean;
  producesInclusiveCellEnds: true;
  producesExclusiveCellStarts: false;
  suitableForScatterOffsets: boolean;
  requiredNextStep: 'particle-cell-scatter';
}

export class RawGpuConstraintParticleCellOffsetPass {
  private readonly prefix: RawGpuFloatPrefixSumPass;
  private lastStats: RawGpuConstraintParticleCellOffsetStats = {
    gridColumns: 0,
    gridRows: 0,
    cellCount: 0,
    prefixPasses: 0,
    fragmentTexels: 0,
    gpuOwnedCellOffsets: false,
    producesInclusiveCellEnds: true,
    producesExclusiveCellStarts: false,
    suitableForScatterOffsets: false,
    requiredNextStep: 'particle-cell-scatter',
  };

  constructor(resources: RawWebGL2ResourceContext, precision: RawTexturePrecision = 'float') {
    this.prefix = new RawGpuFloatPrefixSumPass(resources, precision);
  }

  get output(): RawFramebuffer | undefined {
    return this.prefix.output;
  }

  compute(options: RawGpuConstraintParticleCellOffsetOptions): RawGpuConstraintParticleCellOffsetStats {
    const gridColumns = Math.max(1, Math.floor(options.gridColumns));
    const gridRows = Math.max(1, Math.floor(options.gridRows));
    const cellCount = gridColumns * gridRows;
    const prefixStats = this.prefix.compute({
      source: options.occupancy,
      width: gridColumns,
      height: gridRows,
      elementCount: cellCount,
    });
    this.lastStats = mapPrefixStats(prefixStats, gridColumns, gridRows, cellCount);
    return this.lastStats;
  }

  stats(): RawGpuConstraintParticleCellOffsetStats {
    return this.lastStats;
  }

  destroy(): void {
    this.prefix.destroy();
  }
}

function mapPrefixStats(
  prefixStats: RawGpuFloatPrefixSumStats,
  gridColumns: number,
  gridRows: number,
  cellCount: number,
): RawGpuConstraintParticleCellOffsetStats {
  return {
    gridColumns,
    gridRows,
    cellCount,
    prefixPasses: prefixStats.passCount,
    fragmentTexels: prefixStats.fragmentTexels,
    gpuOwnedCellOffsets: prefixStats.gpuOwnedPrefix,
    producesInclusiveCellEnds: true,
    producesExclusiveCellStarts: false,
    suitableForScatterOffsets: prefixStats.suitableForCellOffsets,
    requiredNextStep: 'particle-cell-scatter',
  };
}
