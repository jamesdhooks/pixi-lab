import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const microscopeBloomStyle: SimStyle = {
  id: 'microscope-bloom',
  name: 'Microscope Bloom',
  description: 'High-contrast microscope stain with lime nuclei, indigo membranes, and bright mitotic scars.',
  background: 0x05070a,
  palette: [0x05070a, 0x14192d, 0x342b74, 0x64ff6a, 0x4dc4ff, 0xfffb7a],
  passes: ['paletteMap', 'edgeGlow', 'contourBands', 'distortion'],
  uniforms: { glowStrength: 0.78, bloomStrength: 0.28, contourStrength: 0.54, distortionStrength: 0.12 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Stain Glow', min: 0, max: 1.6, step: 0.02, default: 0.78 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.28 },
    { key: 'contourStrength', label: 'Voronoi Lines', min: 0, max: 1, step: 0.02, default: 0.54 },
    { key: 'distortionStrength', label: 'Optic Warp', min: 0, max: 1, step: 0.02, default: 0.12 },
  ],
};
