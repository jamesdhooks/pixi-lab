import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const coralVeinsStyle: SimStyle = {
  id: 'coral-veins',
  name: 'Coral Veins',
  description: 'Warm reef tissue, peach capillaries, and bioluminescent teal nutrient flow.',
  background: 0x10080c,
  palette: [0x10080c, 0x3a1522, 0x802f45, 0xff7a69, 0x48ffd2, 0xffe6b0],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 0.82, bloomStrength: 0.34, contourStrength: 0.22, distortionStrength: 0.34 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.5, step: 0.02, default: 0.82 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.34 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.22 },
    { key: 'distortionStrength', label: 'Pulse Warp', min: 0, max: 1, step: 0.02, default: 0.34 },
  ],
};
