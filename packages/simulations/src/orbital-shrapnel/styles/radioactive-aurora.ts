import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const radioactiveAuroraStyle: SimStyle = {
  id: 'radioactive-aurora',
  name: 'Radioactive Aurora',
  description: 'Toxic green, cyan, and yellow particles with electric aurora trails.',
  background: 0x030807,
  palette: [0x03120a, 0x16ff6a, 0x9dff00, 0x2bf8ff, 0xffff75],
  passes: ['trailFeedback', 'paletteMap', 'edgeGlow', 'bloom', 'shockwave'],
  uniforms: { glowStrength: 0.88, trailPersistence: 0.968, shockwaveStrength: 0.44, chromatic: 0.12 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Aurora Glow', min: 0, max: 1, step: 0.01, default: 0.88 },
    { key: 'chromatic', label: 'Toxic Fringe', min: 0, max: 0.35, step: 0.01, default: 0.12 },
  ],
};
