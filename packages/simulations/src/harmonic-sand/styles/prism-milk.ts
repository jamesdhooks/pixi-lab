import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const prismMilkStyle: SimStyle = {
  id: 'prism-milk',
  name: 'Prism Milk',
  description: 'A pale opalescent plate with soft mineral pastels.',
  background: 0xf6f1e7,
  palette: [0xf8f0df, 0x9fd8cb, 0xf4a7c5, 0x3c5678],
  passes: ['primitive', 'fieldVisualize', 'paletteMap', 'contourBands', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.22,
    contourIntensity: 0.5,
    trailFade: 0.88,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.22 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.5 },
  ],
};
