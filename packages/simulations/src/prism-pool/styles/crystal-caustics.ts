import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const crystalCausticsStyle: SimStyle = {
  id: 'crystal-caustics',
  name: 'Crystal Caustics',
  description: 'Clear turquoise water with bright prism caustics and glassy fake-normal highlights.',
  background: 0x03101c,
  palette: [0x02111f, 0x073254, 0x0a84a8, 0x42f5e9, 0xdbfff7, 0xffffff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion', 'normalLighting'],
  uniforms: { glowStrength: 0.78, bloomStrength: 0.32, contourStrength: 0.42, distortionStrength: 0.74 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.78 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.32 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.42 },
    { key: 'distortionStrength', label: 'Distortion', min: 0, max: 1.4, step: 0.02, default: 0.74 },
  ],
};
