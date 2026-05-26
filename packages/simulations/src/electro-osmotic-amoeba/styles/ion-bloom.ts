import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const ionBloomStyle: SimStyle = {
  id: 'ion-bloom',
  name: 'Ion Bloom',
  description: 'Hot magenta membranes and cyan counter-ions in a dark electrolyte bath.',
  background: 0x030411,
  palette: [0x04091f, 0x1249ff, 0x38f8ff, 0xff5bd6, 0xffffff],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 0.88, threshold: 0.38, normalStrength: 0.5, distortion: 0.22 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Ion Glow', min: 0, max: 1, step: 0.01, default: 0.88 },
    { key: 'threshold', label: 'Membrane Threshold', min: 0.2, max: 0.8, step: 0.01, default: 0.38 },
  ],
};
