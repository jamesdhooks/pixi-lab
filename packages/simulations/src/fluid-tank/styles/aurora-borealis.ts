import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const auroraBorealisStyle: SimStyle = {
  id: 'aurora-borealis',
  name: 'Aurora Borealis',
  description: 'Cold arctic greens, teals and violet ribbons dancing like the northern lights.',
  background: 0x010810,
  palette: [0x00ffa3, 0x00cfff, 0x9d4dff],
  passes: ['gpuFluid', 'bloom', 'colorGrade', 'composite'],
  uniforms: {
    exposure: 1.18,
    paletteStrength: 0.9,
    edgeDarkening: 0.22,
  },
  uniformSchema: [
    { key: 'exposure', label: 'Exposure', min: 0.72, max: 1.55, step: 0.01, default: 1.18 },
    { key: 'paletteStrength', label: 'Palette Strength', min: 0, max: 1, step: 0.01, default: 0.9 },
    { key: 'edgeDarkening', label: 'Edge Darkening', min: 0, max: 1, step: 0.01, default: 0.22 },
  ],
};
