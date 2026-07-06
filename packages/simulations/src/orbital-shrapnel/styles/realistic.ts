import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const realisticStyle: SimStyle = {
  id: 'realistic',
  name: 'Realistic',
  description: 'Natural Earth texture with restrained orbital debris, realistic shading, and a slowly rotating planet.',
  background: 0x02050c,
  palette: [0x02050c, 0x0f2340, 0x2d6fa3, 0xc9d8e4, 0xffffff],
  passes: ['trailFeedback', 'paletteMap', 'bloom', 'shockwave'],
  uniforms: { glowStrength: 0.42, trailPersistence: 0.965, shockwaveStrength: 0.28, chromatic: 0.025 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Orbital Glow', min: 0, max: 1, step: 0.01, default: 0.42 },
    { key: 'trailPersistence', label: 'Trail Persistence', min: 0.86, max: 0.995, step: 0.005, default: 0.965 },
  ],
};
