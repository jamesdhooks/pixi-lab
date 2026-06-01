import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const forestMossStyle: SimStyle = {
  id: 'forest-moss',
  name: 'Forest Moss',
  description: 'Earthy moss green and warm ochre with cool shadow slate.',
  background: 0x020601,
  palette: [0x2d7a00, 0x8fbf00, 0xc8a84b],
  passes: ['gpuFluid', 'bloom', 'colorGrade', 'composite'],
  uniforms: {
    exposure: 1.08,
    paletteStrength: 0.72,
    edgeDarkening: 0.20,
  },
  uniformSchema: [
    { key: 'exposure', label: 'Exposure', min: 0.72, max: 1.55, step: 0.01, default: 1.08 },
    { key: 'paletteStrength', label: 'Palette Strength', min: 0, max: 1, step: 0.01, default: 0.72 },
    { key: 'edgeDarkening', label: 'Edge Darkening', min: 0, max: 1, step: 0.01, default: 0.20 },
  ],
};
