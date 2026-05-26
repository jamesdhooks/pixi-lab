import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const iceLightningStyle: SimStyle = {
  id: 'ice-lightning',
  name: 'Ice Lightning',
  description: 'Cold blue crystal facets laced with white electrical fractures.',
  background: 0x020712,
  palette: [0x020712, 0x0b1d3a, 0x2d7dff, 0x8defff, 0xffffff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'trailFeedback', 'contourBands'],
  uniforms: { glowStrength: 0.72, fractureGlow: 0.82, facetContrast: 0.62, stressThreshold: 0.34 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Facet Glow', min: 0, max: 1.4, step: 0.01, default: 0.72 },
    { key: 'fractureGlow', label: 'Fracture Glow', min: 0, max: 1.4, step: 0.01, default: 0.82 },
    { key: 'facetContrast', label: 'Facet Contrast', min: 0.1, max: 1.2, step: 0.01, default: 0.62 },
  ],
};
