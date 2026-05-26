import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const auroraQuartzStyle: SimStyle = {
  id: 'aurora-quartz',
  name: 'Aurora Quartz',
  description: 'Green, violet, and cyan quartz facets shifting like an aurora storm.',
  background: 0x040812,
  palette: [0x040812, 0x23316f, 0x7a3cff, 0x38ffb0, 0xd8fff3],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion', 'contourBands'],
  uniforms: { glowStrength: 0.68, fractureGlow: 0.74, facetContrast: 0.86, stressThreshold: 0.34 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Aurora Glow', min: 0, max: 1.5, step: 0.01, default: 0.68 },
    { key: 'stressThreshold', label: 'Stress Threshold', min: 0.1, max: 0.9, step: 0.01, default: 0.34 },
  ],
};
