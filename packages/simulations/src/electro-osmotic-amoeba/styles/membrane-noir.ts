import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const membraneNoirStyle: SimStyle = {
  id: 'membrane-noir',
  name: 'Membrane Noir',
  description: 'Low-key amber membranes with blue ion scars and smoky contrast.',
  background: 0x070503,
  palette: [0x0c0705, 0x38200f, 0xff9f32, 0x56c7ff, 0xfff2cf],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'distortion', 'bloom'],
  uniforms: { glowStrength: 0.68, threshold: 0.48, normalStrength: 0.4, distortion: 0.28 },
};
