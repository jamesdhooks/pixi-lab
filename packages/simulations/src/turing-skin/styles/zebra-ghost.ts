import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const zebraGhostStyle: SimStyle = {
  id: 'zebra-ghost',
  name: 'Zebra Ghost',
  description: 'Cold cyan stripes tearing through a charcoal morphogen field.',
  background: 0x020509,
  palette: [0x020509, 0x07131c, 0x16475d, 0x64e7ff, 0xf5fbff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 0.82, bloomStrength: 0.36, distortionStrength: 0.18 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.82 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.36 },
    { key: 'distortionStrength', label: 'Distortion', min: 0, max: 1, step: 0.02, default: 0.18 },
  ],
};
