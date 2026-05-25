import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const deepVoidStyle: SimStyle = {
  id: 'deep-void',
  name: 'Deep Void',
  description: 'Electric violet pulses through infinite darkness.',
  background: 0x04010d,
  palette: [0x120030, 0x5500cc, 0xb44dff, 0xf0d0ff],
  passes: ['primitive', 'fieldVisualize', 'paletteMap', 'contourBands', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.50,
    contourIntensity: 0.45,
    trailFade: 0.88,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.50 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.45 },
  ],
};
