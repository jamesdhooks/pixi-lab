import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const bloodMoonStyle: SimStyle = {
  id: 'blood-moon',
  name: 'Blood Moon',
  description: 'Deep crimson debris, hot rose trails, and burnt-orange orbital glow.',
  background: 0x090102,
  palette: [0x090102, 0x3d0712, 0xc40f35, 0xff6a3d, 0xffd1a1],
  passes: ['trailFeedback', 'paletteMap', 'edgeGlow', 'bloom', 'shockwave'],
  uniforms: { glowStrength: 0.78, trailPersistence: 0.958, shockwaveStrength: 0.38, chromatic: 0.08 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Crimson Glow', min: 0, max: 1, step: 0.01, default: 0.78 },
    { key: 'trailPersistence', label: 'Blood Trail', min: 0.86, max: 0.995, step: 0.005, default: 0.958 },
  ],
};
