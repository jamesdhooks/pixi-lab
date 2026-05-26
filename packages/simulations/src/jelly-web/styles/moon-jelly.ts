import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const moonJellyStyle: SimStyle = {
  id: 'moon-jelly',
  name: 'Moon Jelly',
  description: 'Cool blue-violet gelatin strands glowing over an abyssal field.',
  background: 0x020612,
  palette: [0x030616, 0x12367a, 0x3be8ff, 0xbca7ff, 0xffffff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 0.86, threshold: 0.32, distortion: 0.2, contourSpacing: 0.18 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Gel Glow', min: 0, max: 1, step: 0.01, default: 0.86 },
    { key: 'threshold', label: 'Strand Threshold', min: 0.1, max: 0.8, step: 0.01, default: 0.32 },
  ],
};
