import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const emberPulseStyle: SimStyle = {
  id: 'ember-pulse',
  name: 'Ember Pulse',
  description: 'Smouldering ember lines — near-black to searing amber.',
  background: 0x080200,
  palette: [0x1a0600, 0x7a1c00, 0xe85000, 0xffb830],
  passes: ['primitive', 'fieldVisualize', 'paletteMap', 'contourBands', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.44,
    contourIntensity: 0.40,
    trailFade: 0.78,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.44 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.40 },
  ],
};
