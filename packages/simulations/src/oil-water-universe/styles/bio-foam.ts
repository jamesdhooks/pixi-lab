import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const bioFoamStyle: SimStyle = {
  id: 'bio-foam',
  name: 'Bio Foam',
  description: 'Milky emulsions split into green microbial islands and pearled foam.',
  background: 0x07100b,
  palette: [0x07100b, 0x14351e, 0x3b8c56, 0xa8e07a, 0xf4f1d0],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'contourBands'],
  uniforms: { threshold: 0.5, glowStrength: 0.52, bloomStrength: 0.18, contourStrength: 0.74 },
  uniformSchema: [
    { key: 'threshold', label: 'Membrane Threshold', min: 0.2, max: 0.8, step: 0.01, default: 0.5 },
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.52 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.18 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.74 },
  ],
};
