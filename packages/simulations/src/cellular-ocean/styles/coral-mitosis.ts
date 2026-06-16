import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const coralMitosisStyle: SimStyle = {
  id: 'coral-mitosis',
  name: 'Coral Mitosis',
  description: 'Warm coral and violet membranes pulsing like reef plankton under UV light.',
  background: 0x120719,
  palette: [0x120719, 0x3b174d, 0xff5d8f, 0xffc857, 0xffffff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 0.9, threshold: 0.34, contourSpacing: 0.2, distortion: 0.24 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Coral Glow', min: 0, max: 1, step: 0.01, default: 0.9 },
    { key: 'distortion', label: 'Reef Shimmer', min: 0, max: 0.5, step: 0.01, default: 0.24 },
  ],
};
