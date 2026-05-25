import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const neonMoldStyle: SimStyle = {
  id: 'neon-mold',
  name: 'Neon Mold',
  description: 'Electric greens and hot violet vein pulses over a midnight substrate.',
  background: 0x05070b,
  palette: [0x102015, 0x27f58a, 0xa7ff46, 0xff4df3, 0xffffff],
  passes: ['primitive', 'paletteMap', 'contourBands', 'bloom'],
  uniforms: { glowStrength: 0.72, contourSpacing: 0.18, pulseSpeed: 0.55 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.72 },
    { key: 'pulseSpeed', label: 'Pulse Speed', min: 0, max: 2, step: 0.05, default: 0.55 },
  ],
};
