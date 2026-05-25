import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const oilSlickStyle: SimStyle = {
  id: 'oil-slick',
  name: 'Oil Slick',
  description: 'Rainbow thin-film membranes with inky black negative space.',
  background: 0x020202,
  palette: [0x050505, 0x2e1a78, 0x0088ff, 0x27ff9a, 0xffd447, 0xff4c8b],
  passes: ['densityMetaball', 'paletteMap', 'contourBands', 'edgeGlow', 'distortion'],
  uniforms: { glowStrength: 0.56, threshold: 0.48, normalStrength: 0.72, distortion: 0.32, contourSpacing: 0.12 },
  uniformSchema: [
    { key: 'distortion', label: 'Thin-film Warp', min: 0, max: 0.6, step: 0.01, default: 0.32 },
    { key: 'contourSpacing', label: 'Interference Bands', min: 0.05, max: 0.3, step: 0.01, default: 0.12 },
  ],
};
