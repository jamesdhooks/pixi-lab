import type { RawGpuSimulationMetrics } from './RawGpuMetrics.js';

export type RawSceneDebugStats = Record<string, string | number | boolean | null>;

export function rawGpuMetricsToDebugStats(metrics: RawGpuSimulationMetrics): RawSceneDebugStats {
  return {
    renderer: metrics.engine,
    simulation: 'gpu-texture-ping-pong',
    rendering: 'gpu-render-target-pipeline',
    gpuSimulated: true,
    gpuRendered: true,
    cpuTopology: false,
    cpuUpload: false,
    stateRt: `${metrics.stateWidth}x${metrics.stateHeight}`,
    stateTextures: metrics.stateTextures,
    stateTexels: metrics.stateTexels,
    precision: metrics.precision,
    gpuPasses: metrics.passesPerFrame,
    cpuUploadBytes: metrics.cpuUploadBytesPerFrame,
  };
}

export function rawUploadDebugStats(input: {
  renderer: string;
  textureUpload?: string;
  gridWidth?: number;
  gridHeight?: number;
  cpuUploadBytes?: number;
  gpuPasses?: number;
}): RawSceneDebugStats {
  const gridWidth = input.gridWidth ?? 0;
  const gridHeight = input.gridHeight ?? 0;
  return {
    renderer: input.renderer,
    simulation: 'cpu-simulated-upload',
    rendering: 'gpu-texture-display',
    gpuSimulated: false,
    gpuRendered: true,
    cpuTopology: true,
    cpuUpload: true,
    grid: `${gridWidth}x${gridHeight}`,
    fieldTexels: gridWidth * gridHeight,
    cpuUploadBytes: input.cpuUploadBytes ?? 0,
    gpuPasses: input.gpuPasses ?? 1,
    textureUpload: input.textureUpload ?? null,
  };
}
