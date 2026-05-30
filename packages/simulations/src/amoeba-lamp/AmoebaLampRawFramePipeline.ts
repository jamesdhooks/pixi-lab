import { createAmoebaRawFieldState, injectAmoebaRawSplats, stepAmoebaRawFieldState, type AmoebaRawFieldState } from './AmoebaLampRawFieldState.js';
import { mapAmoebaParticlesToRawSplats, type AmoebaRawSourceParticle } from './AmoebaLampRawSplatMapper.js';
import { packAmoebaRawFieldsToRgba, type AmoebaRawTextureUpload } from './AmoebaLampRawTextureUpload.js';

export interface AmoebaRawFramePipelineOptions {
  readonly textureWidth: number;
  readonly textureHeight: number;
}

export interface AmoebaRawFramePipeline {
  state: AmoebaRawFieldState;
  uploadBuffer: Uint8Array;
}

export interface AmoebaRawFrameStepOptions {
  readonly particles: readonly AmoebaRawSourceParticle[];
  readonly width: number;
  readonly height: number;
  readonly textureWidth?: number;
  readonly textureHeight?: number;
  readonly densityRadius: number;
  readonly maxSplats?: number;
  readonly densityDecay: number;
  readonly heatDecay: number;
  readonly diffusion: number;
  readonly heatRise: number;
}

export function createAmoebaRawFramePipeline(options: AmoebaRawFramePipelineOptions): AmoebaRawFramePipeline {
  const state = createAmoebaRawFieldState({ width: options.textureWidth, height: options.textureHeight });
  return {
    state,
    uploadBuffer: new Uint8Array(state.width * state.height * 4),
  };
}

export function stepAmoebaRawFramePipeline(
  pipeline: AmoebaRawFramePipeline,
  options: AmoebaRawFrameStepOptions,
): AmoebaRawTextureUpload {
  const textureWidth = Math.max(1, Math.floor(options.textureWidth ?? pipeline.state.width));
  const textureHeight = Math.max(1, Math.floor(options.textureHeight ?? pipeline.state.height));
  ensurePipelineSize(pipeline, textureWidth, textureHeight);

  const splats = mapAmoebaParticlesToRawSplats(options.particles, {
    width: options.width,
    height: options.height,
    textureWidth: pipeline.state.width,
    textureHeight: pipeline.state.height,
    densityRadius: options.densityRadius,
    maxSplats: options.maxSplats,
  });

  injectAmoebaRawSplats(pipeline.state, splats);
  stepAmoebaRawFieldState(pipeline.state, {
    densityDecay: options.densityDecay,
    heatDecay: options.heatDecay,
    diffusion: options.diffusion,
    heatRise: options.heatRise,
  });

  const upload = packAmoebaRawFieldsToRgba(pipeline.state, pipeline.uploadBuffer);
  pipeline.uploadBuffer = upload.data;
  return upload;
}

function ensurePipelineSize(pipeline: AmoebaRawFramePipeline, textureWidth: number, textureHeight: number): void {
  if (pipeline.state.width === textureWidth && pipeline.state.height === textureHeight) return;
  pipeline.state = createAmoebaRawFieldState({ width: textureWidth, height: textureHeight });
  pipeline.uploadBuffer = new Uint8Array(textureWidth * textureHeight * 4);
}
