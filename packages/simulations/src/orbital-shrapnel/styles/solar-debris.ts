import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const solarDebrisStyle: SimStyle = {
  id: 'solar-debris',
  name: 'Solar Debris',
  description: 'Amber-hot asteroid shards shedding ember trails around a radiant core.',
  background: 0x120604,
  palette: [0x160704, 0x5e1706, 0xff6b18, 0xffd166, 0xffffdf],
  passes: ['trailFeedback', 'paletteMap', 'edgeGlow', 'bloom'],
  uniforms: { glowStrength: 0.74, trailPersistence: 0.935, shockwaveStrength: 0.28, chromatic: 0.05 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Solar Glow', min: 0, max: 1, step: 0.01, default: 0.74 },
    { key: 'trailPersistence', label: 'Dust Persistence', min: 0.86, max: 0.995, step: 0.005, default: 0.935 },
  ],
};
