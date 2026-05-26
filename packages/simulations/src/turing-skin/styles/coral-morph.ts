import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const coralMorphStyle: SimStyle = {
  id: 'coral-morph',
  name: 'Coral Morph',
  description: 'Pink and violet cells bloom into reef-like reaction islands.',
  background: 0x08020a,
  palette: [0x08020a, 0x2d0c37, 0x8f2c72, 0xff6f91, 0xffd6aa],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
  uniforms: { glowStrength: 0.7, bloomStrength: 0.44, contourStrength: 0.38, distortionStrength: 0.22 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.7 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.44 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.38 },
  ],
};
