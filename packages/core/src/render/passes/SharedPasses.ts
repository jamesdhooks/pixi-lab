import type { RenderPassId } from '../../types.js';
import { NoopRenderPass } from './RenderPass.js';

class SharedNoopPass extends NoopRenderPass {
  constructor(readonly id: RenderPassId) {
    super();
  }
}

export function createSharedPass(id: RenderPassId): NoopRenderPass {
  return new SharedNoopPass(id);
}

export const SHARED_RENDER_PASS_IDS: readonly RenderPassId[] = [
  'primitive',
  'paletteMap',
  'densityMetaball',
  'edgeGlow',
  'trailFeedback',
  'fieldVisualize',
  'bloom',
  'distortion',
  'chromaticAberration',
  'normalLighting',
  'contourBands',
  'shockwave',
  'colorGrade',
  'composite',
];
