import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const rainbowInterferenceStyle: SimStyle = {
  id: 'rainbow-interference',
  name: 'Rainbow Interference',
  description: 'Full-spectrum Chladni bands with crisp candy-color nodes.',
  background: 0x05030b,
  palette: [0xff1744, 0xffd600, 0x00e676, 0x2979ff],
  passes: ['primitive', 'fieldVisualize', 'paletteMap', 'edgeGlow', 'contourBands', 'chromaticAberration', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.56,
    contourIntensity: 0.74,
    trailFade: 0.82,
    chromaticAmount: 0.22,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.56 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.74 },
    { key: 'chromaticAmount', label: 'Chromatic Amount', min: 0, max: 1, step: 0.01, default: 0.22 },
  ],
};
