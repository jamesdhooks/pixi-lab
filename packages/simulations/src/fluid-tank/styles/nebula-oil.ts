import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const nebulaOilStyle: SimStyle = {
  id: 'nebula-oil',
  name: 'Nebula Oil',
  description: 'Higher exposure for cosmic ink ribbons and oily glow.',
  background: 0x05020a,
  palette: [0x5c4dff, 0xff4fd8, 0xffb86b],
  passes: ['gpuFluid', 'bloom', 'chromaticAberration', 'colorGrade', 'composite'],
  uniforms: {
    exposure: 1.22,
    paletteStrength: 0.84,
    edgeDarkening: 0.16,
  },
  uniformSchema: [
    { key: 'exposure', label: 'Exposure', min: 0.72, max: 1.55, step: 0.01, default: 1.22 },
    { key: 'paletteStrength', label: 'Palette Strength', min: 0, max: 1, step: 0.01, default: 0.84 },
    { key: 'edgeDarkening', label: 'Edge Darkening', min: 0, max: 1, step: 0.01, default: 0.16 },
  ],
};
