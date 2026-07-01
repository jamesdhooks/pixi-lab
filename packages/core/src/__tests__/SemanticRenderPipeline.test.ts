import { describe, expect, it } from 'vitest';
import * as core from '../index.js';

describe('semantic render pipeline public contract', () => {
  it('exports reusable render-frame and Pixi/WebGL2 pipeline abstractions from core', () => {
    expect(core, 'RenderFrame export').toHaveProperty('createRenderFrame');
    expect(core, 'semantic layer export').toHaveProperty('createParticlePointLayer');
    expect(core, 'semantic layer export').toHaveProperty('createTrailFeedbackLayer');
    expect(core, 'Pixi pipeline export').toHaveProperty('PixiSemanticRenderPipeline');
    expect(core, 'WebGL2 pipeline export').toHaveProperty('WebGL2SemanticRenderPipeline');
  });
});
