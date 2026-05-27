import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const stellarNurseryStyle: SimStyle = {
  id: 'stellar-nursery',
  name: 'Stellar Nursery',
  description: 'Magenta hydrogen clouds, cyan young stars, and warm fusion cores.',
  background: 0x02030b,
  palette: [0x02030b, 0x091338, 0x23307d, 0x22d8ff, 0xff63d8, 0xfff1aa],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 1.1, bloomStrength: 0.55, contourStrength: 0.16, distortionStrength: 0.22 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Gravity Glow', min: 0, max: 1.8, step: 0.02, default: 1.1 },
    { key: 'bloomStrength', label: 'Fusion Bloom', min: 0, max: 1, step: 0.02, default: 0.55 },
    { key: 'distortionStrength', label: 'Nebula Warp', min: 0, max: 1, step: 0.02, default: 0.22 },
  ],
};
