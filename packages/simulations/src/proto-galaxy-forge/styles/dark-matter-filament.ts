import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const darkMatterFilamentStyle: SimStyle = {
  id: 'dark-matter-filament',
  name: 'Dark Matter Filament',
  description: 'Deep violet gravity wells with blue-white dust tracing invisible mass.',
  background: 0x010207,
  palette: [0x010207, 0x080b24, 0x151a4f, 0x4d5dff, 0x9f6bff, 0xe6f7ff],
  passes: ['paletteMap', 'edgeGlow', 'contourBands', 'distortion'],
  uniforms: { glowStrength: 0.9, bloomStrength: 0.34, contourStrength: 0.44, distortionStrength: 0.32 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Filament Glow', min: 0, max: 1.8, step: 0.02, default: 0.9 },
    { key: 'contourStrength', label: 'Mass Contours', min: 0, max: 1, step: 0.02, default: 0.44 },
    { key: 'distortionStrength', label: 'Lensing Warp', min: 0, max: 1, step: 0.02, default: 0.32 },
  ],
};
