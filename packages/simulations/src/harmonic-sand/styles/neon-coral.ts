import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const neonCoralStyle: SimStyle = {
  id: 'neon-coral',
  name: 'Neon Coral',
  description: 'Warm coral and amber interference lines.',
  background: 0x0a0302,
  palette: [0x3d0c02, 0xb03010, 0xff5f2e, 0xffd580],
  passes: ['primitive', 'fieldVisualize', 'paletteMap', 'contourBands', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.42,
    contourIntensity: 0.38,
    trailFade: 0.80,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.42 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.38 },
  ],
};
