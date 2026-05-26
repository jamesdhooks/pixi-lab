import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const voltageLagoonStyle: SimStyle = {
  id: 'voltage-lagoon',
  name: 'Voltage Lagoon',
  description: 'Acid greens and ultraviolet blues for a living charged lagoon.',
  background: 0x020806,
  palette: [0x03150e, 0x0a674f, 0x29ff9a, 0x6a5cff, 0xe9fff6],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'normalLighting', 'contourBands'],
  uniforms: { glowStrength: 0.74, threshold: 0.44, normalStrength: 0.72, contourScale: 0.32 },
};
