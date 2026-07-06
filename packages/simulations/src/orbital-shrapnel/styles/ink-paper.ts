import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const inkPaperStyle: SimStyle = {
  id: 'ink-paper',
  name: 'Ink on Paper',
  description: 'Black inky orbital trails bleeding across a warm white paper field.',
  background: 0xf4efe2,
  palette: [0xf7f2e8, 0x302820, 0x0a0806, 0x000000, 0x6b5b4c],
  passes: ['trailFeedback', 'paletteMap', 'shockwave'],
  uniforms: { glowStrength: 0.18, trailPersistence: 0.965, shockwaveStrength: 0.18, chromatic: 0.0 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Ink Bloom', min: 0, max: 1, step: 0.01, default: 0.18 },
    { key: 'trailPersistence', label: 'Ink Persistence', min: 0.86, max: 0.995, step: 0.005, default: 0.965 },
  ],
};
