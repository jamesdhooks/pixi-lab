import type { SimParticle } from '../../sim/particles/SimParticleSystem.js';
import type { ScalarField } from '../../sim/fields/ScalarField.js';
import type { TrailField } from '../../sim/fields/TrailField.js';
import type { SimStyle } from '../../types.js';

export type SemanticRenderLayerKind = 'particlePoints' | 'trailFeedback' | 'fieldPalette';

export interface SemanticRenderFrameLayerBase {
  readonly id: string;
  readonly kind: SemanticRenderLayerKind;
  readonly zIndex: number;
}

export interface ParticlePointLayer extends SemanticRenderFrameLayerBase {
  readonly kind: 'particlePoints';
  readonly particles: readonly SimParticle[];
  readonly sizeScale?: number;
}

export interface TrailFeedbackLayer extends SemanticRenderFrameLayerBase {
  readonly kind: 'trailFeedback';
  readonly field: TrailField;
  readonly alpha?: number;
  readonly gamma?: number;
}

export interface FieldPaletteLayer extends SemanticRenderFrameLayerBase {
  readonly kind: 'fieldPalette';
  readonly field: ScalarField;
  readonly alpha?: number;
  readonly gamma?: number;
}

export type SemanticRenderLayer = ParticlePointLayer | TrailFeedbackLayer | FieldPaletteLayer;

export interface RenderFrame {
  readonly width: number;
  readonly height: number;
  readonly style: SimStyle;
  readonly layers: readonly SemanticRenderLayer[];
}

export interface RenderFrameOptions {
  width: number;
  height: number;
  style: SimStyle;
  layers?: readonly SemanticRenderLayer[];
}

export function createRenderFrame(options: RenderFrameOptions): RenderFrame {
  return {
    width: options.width,
    height: options.height,
    style: options.style,
    layers: [...(options.layers ?? [])].sort((a, b) => a.zIndex - b.zIndex),
  };
}

export function createParticlePointLayer(options: Omit<ParticlePointLayer, 'kind'>): ParticlePointLayer {
  return { ...options, kind: 'particlePoints' };
}

export function createTrailFeedbackLayer(options: Omit<TrailFeedbackLayer, 'kind'>): TrailFeedbackLayer {
  return { ...options, kind: 'trailFeedback' };
}

export function createFieldPaletteLayer(options: Omit<FieldPaletteLayer, 'kind'>): FieldPaletteLayer {
  return { ...options, kind: 'fieldPalette' };
}
