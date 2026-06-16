import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const boundedCyanStyle: SimStyle = {
  id: 'bounded-cyan',
  name: 'Bounded Cyan',
  description: 'Bright teal dye, glassy tank edges, and the default fluid exposure.',
  background: 0x020206,
  palette: [0x75ffe6, 0x9dfff4, 0xbcecff],
  passes: ['gpuFluid', 'bloom', 'colorGrade', 'composite'],
  uniforms: {
    exposure: 1.06,
    paletteStrength: 0.76,
    edgeDarkening: 0.18,
  },
  uniformSchema: [
    { key: 'exposure', label: 'Exposure', min: 0.72, max: 1.55, step: 0.01, default: 1.06 },
    { key: 'paletteStrength', label: 'Palette Strength', min: 0, max: 1, step: 0.01, default: 0.76 },
    { key: 'edgeDarkening', label: 'Edge Darkening', min: 0, max: 1, step: 0.01, default: 0.18 },
  ],
};
