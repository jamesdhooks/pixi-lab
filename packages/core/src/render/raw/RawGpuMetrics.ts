import type { RawTexturePrecision, RawWebGL2Capabilities } from './RawWebGL2ResourceContext.js';

export interface RawGpuSimulationMetrics {
  engine: string;
  stateWidth: number;
  stateHeight: number;
  stateTexels: number;
  stateTextures: number;
  precision: RawTexturePrecision;
  passesPerFrame: number;
  cpuUploadBytesPerFrame: number;
  capabilities: RawWebGL2Capabilities;
}

export function createRawGpuSimulationMetrics(input: {
  engine: string;
  stateWidth: number;
  stateHeight: number;
  stateTextures: number;
  precision: RawTexturePrecision;
  passesPerFrame: number;
  cpuUploadBytesPerFrame?: number;
  capabilities: RawWebGL2Capabilities;
}): RawGpuSimulationMetrics {
  return {
    engine: input.engine,
    stateWidth: input.stateWidth,
    stateHeight: input.stateHeight,
    stateTexels: input.stateWidth * input.stateHeight,
    stateTextures: input.stateTextures,
    precision: input.precision,
    passesPerFrame: input.passesPerFrame,
    cpuUploadBytesPerFrame: input.cpuUploadBytesPerFrame ?? 0,
    capabilities: input.capabilities,
  };
}
