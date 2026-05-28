import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const emberChuteStyle: SimStyle = {
  id: 'ember-chute',
  name: 'Ember Chute',
  description: 'Charcoal-black granular slopes with molten orange and violet sparks.',
  background: 0x050202,
  palette: [0x050202, 0x1c0904, 0x6b1d0c, 0xff6b1a, 0xffc857, 0xb29cff],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'bloom'],
  uniforms: { threshold: 0.34, glowStrength: 1.08, bloomStrength: 0.5, contourStrength: 0.34 },
  uniformSchema: [
    { key: 'threshold', label: 'Ember Threshold', min: 0.18, max: 0.72, step: 0.01, default: 0.34 },
    { key: 'glowStrength', label: 'Heat Glow', min: 0, max: 1.4, step: 0.02, default: 1.08 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.5 },
    { key: 'contourStrength', label: 'Ash Bands', min: 0, max: 1, step: 0.02, default: 0.34 },
  ],
};
