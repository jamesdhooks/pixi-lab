import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const lavaLampStyle: SimStyle = {
  id: 'lava-lamp',
  name: 'Lava Lamp',
  description: 'Molten orange and cherry red blobs glowing against deep charcoal.',
  background: 0x0d0300,
  palette: [0xff1a00, 0xff7c00, 0xffee00],
  passes: ['gpuFluid', 'edgeGlow', 'bloom', 'colorGrade', 'composite'],
  uniforms: {
    exposure: 1.28,
    paletteStrength: 0.85,
    edgeDarkening: 0.14,
  },
  uniformSchema: [
    { key: 'exposure', label: 'Exposure', min: 0.72, max: 1.55, step: 0.01, default: 1.28 },
    { key: 'paletteStrength', label: 'Palette Strength', min: 0, max: 1, step: 0.01, default: 0.85 },
    { key: 'edgeDarkening', label: 'Edge Darkening', min: 0, max: 1, step: 0.01, default: 0.14 },
  ],
};
