import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const chladniGoldStyle: SimStyle = {
  id: 'chladni-gold',
  name: 'Chladni Gold',
  description: 'Black background with gold nodal structures.',
  background: 0x050403,
  palette: [0x3a2504, 0x8c5b12, 0xd6a63f, 0xffe2a2],
  passes: ['primitive', 'fieldVisualize', 'paletteMap', 'contourBands', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.28,
    contourIntensity: 0.32,
    trailFade: 0.82,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.28 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.32 },
  ],
};
