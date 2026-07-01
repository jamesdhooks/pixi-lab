import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const ghostFrequencyStyle: SimStyle = {
  id: 'ghost-frequency',
  name: 'Ghost Frequency',
  description: 'Trailing old wave patterns with a spectral edge.',
  background: 0x03060a,
  palette: [0x6ee7b7, 0x93c5fd, 0xc4b5fd, 0xf8fafc],
  passes: ['primitive', 'trailFeedback', 'fieldVisualize', 'paletteMap', 'contourBands', 'chromaticAberration', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.36,
    contourIntensity: 0.42,
    trailFade: 0.93,
    chromaticAmount: 0.18,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.36 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.42 },
    { key: 'chromaticAmount', label: 'Chromatic Amount', min: 0, max: 1, step: 0.01, default: 0.18 },
  ],
};
