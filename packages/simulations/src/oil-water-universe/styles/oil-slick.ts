import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const oilSlickStyle: SimStyle = {
  id: 'oil-slick',
  name: 'Oil Slick',
  description: 'Black water and spectral petroleum membranes with sharp rainbow rims.',
  background: 0x020409,
  palette: [0x020409, 0x06152a, 0x204b7a, 0x9c3cff, 0xffd86b, 0xf6fff2],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { threshold: 0.46, glowStrength: 0.82, bloomStrength: 0.34, contourStrength: 0.68 },
  uniformSchema: [
    { key: 'threshold', label: 'Membrane Threshold', min: 0.2, max: 0.8, step: 0.01, default: 0.46 },
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.82 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.34 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.68 },
  ],
};
