import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const goldenTideStyle: SimStyle = {
  id: 'golden-tide',
  name: 'Golden Tide',
  description: 'Amber turbulence and pearl foam flowing through black ink.',
  background: 0x080604,
  palette: [0x080604, 0x2f1607, 0xb45a18, 0xffc65a, 0xffffd8],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
  uniforms: { glowStrength: 0.66, bloomStrength: 0.34, contourStrength: 0.3 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.66 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.34 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.3 },
  ],
};
