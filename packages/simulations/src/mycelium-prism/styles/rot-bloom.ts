import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const rotBloomStyle: SimStyle = {
  id: 'rot-bloom',
  name: 'Rot Bloom',
  description: 'Warm decay, amber nutrients, and bruised-magenta colony edges.',
  background: 0x090604,
  palette: [0x201109, 0x8f4b1f, 0xe6ad3b, 0xb03168, 0xf8ead2],
  passes: ['primitive', 'paletteMap', 'edgeGlow', 'bloom'],
  uniforms: { glowStrength: 0.58, contourSpacing: 0.24, pulseSpeed: 0.38 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.58 },
    { key: 'contourSpacing', label: 'Contour Spacing', min: 0.05, max: 0.5, step: 0.01, default: 0.24 },
  ],
};
