import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const toxicLagoonStyle: SimStyle = {
  id: 'toxic-lagoon',
  name: 'Toxic Lagoon',
  description: 'Acid greens and sulfur yellows for a bubbling organism soup.',
  background: 0x061006,
  palette: [0x08220f, 0x1c6b25, 0x80ff1f, 0xdfff59, 0xffffff],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.74, threshold: 0.38, normalStrength: 0.48, distortion: 0.14, bubbleRate: 0.4 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Acid Glow', min: 0, max: 1, step: 0.01, default: 0.74 },
    { key: 'bubbleRate', label: 'Bubble Rate', min: 0, max: 1, step: 0.01, default: 0.4 },
  ],
};
