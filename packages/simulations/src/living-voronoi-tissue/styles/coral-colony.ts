import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const coralColonyStyle: SimStyle = {
  id: 'coral-colony',
  name: 'Coral Colony',
  description: 'Soft coral territories divide through amber membranes and teal nutrient halos.',
  background: 0x100609,
  palette: [0x100609, 0x321219, 0x8f3148, 0xff7f6e, 0x42ffd2, 0xffe2a3],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 0.9, bloomStrength: 0.38, contourStrength: 0.24, distortionStrength: 0.32 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Membrane Glow', min: 0, max: 1.6, step: 0.02, default: 0.9 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.38 },
    { key: 'contourStrength', label: 'Colony Bands', min: 0, max: 1, step: 0.02, default: 0.24 },
    { key: 'distortionStrength', label: 'Gel Drift', min: 0, max: 1, step: 0.02, default: 0.32 },
  ],
};
