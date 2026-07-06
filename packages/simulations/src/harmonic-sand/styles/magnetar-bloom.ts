import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const magnetarBloomStyle: SimStyle = {
  id: 'magnetar-bloom',
  name: 'Magnetar Bloom',
  description: 'Deep green plasma with hot magenta harmonic edges.',
  background: 0x020806,
  palette: [0x02140d, 0x00d084, 0xff2bd6, 0xfff3a3],
  passes: ['primitive', 'fieldVisualize', 'paletteMap', 'edgeGlow', 'contourBands', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.64,
    contourIntensity: 0.7,
    trailFade: 0.84,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.64 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.7 },
  ],
};
