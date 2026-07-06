import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const thermalBloomStyle: SimStyle = {
  id: 'thermal-bloom',
  name: 'Thermal Bloom',
  description: 'Hotter bloom with denser pressure-solve contrast.',
  background: 0x070201,
  palette: [0x3311ff, 0xff3355, 0xfff08a],
  passes: ['gpuFluid', 'edgeGlow', 'bloom', 'colorGrade', 'composite'],
  uniforms: {
    exposure: 1.34,
    paletteStrength: 0.8,
    edgeDarkening: 0.2,
  },
  uniformSchema: [
    { key: 'exposure', label: 'Exposure', min: 0.72, max: 1.55, step: 0.01, default: 1.34 },
    { key: 'paletteStrength', label: 'Palette Strength', min: 0, max: 1, step: 0.01, default: 0.8 },
    { key: 'edgeDarkening', label: 'Edge Darkening', min: 0, max: 1, step: 0.01, default: 0.2 },
  ],
};
