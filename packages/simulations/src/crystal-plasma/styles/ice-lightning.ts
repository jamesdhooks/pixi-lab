import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const iceLightningStyle: SimStyle = {
  id: 'ice-lightning',
  name: 'Ice Lightning',
  description: 'Cold blue facets with white electrical fractures through the crystal lattice.',
  background: 0x020613,
  palette: [0x020613, 0x123a6f, 0x2aa7ff, 0xb6f4ff, 0xffffff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.78, fractureGlow: 0.82, facetContrast: 0.66, stressThreshold: 0.38 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Facet Glow', min: 0, max: 1.5, step: 0.01, default: 0.78 },
    { key: 'fractureGlow', label: 'Fracture Glow', min: 0, max: 1.5, step: 0.01, default: 0.82 },
  ],
};
