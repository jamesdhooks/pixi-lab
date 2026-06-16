import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const goldArborStyle: SimStyle = {
  id: 'gold-arbor',
  name: 'Gold Arbor',
  description: 'Dark myrrh background with amber arteries, emerald sap, and white-hot growth pulses.',
  background: 0x070604,
  palette: [0x070604, 0x241707, 0x6c3f0f, 0xffb02e, 0x5cff9a, 0xfff2c4],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 1.06, bloomStrength: 0.4, contourStrength: 0.46, distortionStrength: 0.16 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.5, step: 0.02, default: 1.06 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.4 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.46 },
    { key: 'distortionStrength', label: 'Pulse Warp', min: 0, max: 1, step: 0.02, default: 0.16 },
  ],
};
