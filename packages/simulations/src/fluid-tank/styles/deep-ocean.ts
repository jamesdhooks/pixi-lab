import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const deepOceanStyle: SimStyle = {
  id: 'deep-ocean',
  name: 'Deep Ocean',
  description: 'Abyssal navy and bioluminescent cyan with a hint of warm amber at the surface.',
  background: 0x000814,
  palette: [0x0033a8, 0x00e8d8, 0xffd166],
  passes: ['gpuFluid', 'bloom', 'colorGrade', 'composite'],
  uniforms: {
    exposure: 1.12,
    paletteStrength: 0.78,
    edgeDarkening: 0.28,
  },
  uniformSchema: [
    { key: 'exposure', label: 'Exposure', min: 0.72, max: 1.55, step: 0.01, default: 1.12 },
    { key: 'paletteStrength', label: 'Palette Strength', min: 0, max: 1, step: 0.01, default: 0.78 },
    { key: 'edgeDarkening', label: 'Edge Darkening', min: 0, max: 1, step: 0.01, default: 0.28 },
  ],
};
