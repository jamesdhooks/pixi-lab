import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const bioPlasmaStyle: SimStyle = {
  id: 'bio-plasma',
  name: 'Bio Plasma',
  description: 'Electric magenta and cyan membranes floating in a dark organic bath.',
  background: 0x03050c,
  palette: [0x07111f, 0x125cff, 0x19f4ff, 0xff46d8, 0xffffff],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 0.82, threshold: 0.42, normalStrength: 0.55, distortion: 0.18 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Membrane Glow', min: 0, max: 1, step: 0.01, default: 0.82 },
    { key: 'threshold', label: 'Metaball Threshold', min: 0.2, max: 0.8, step: 0.01, default: 0.42 },
  ],
};
