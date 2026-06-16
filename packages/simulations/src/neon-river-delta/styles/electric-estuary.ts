import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const electricEstuaryStyle: SimStyle = {
  id: 'electric-estuary',
  name: 'Electric Estuary',
  description: 'Cyan river braids cut through violet terrain with hot sediment veins.',
  background: 0x050716,
  palette: [0x050716, 0x16113a, 0x223d7a, 0x00d6ff, 0xff2fd6, 0xfff6a6],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.88, bloomStrength: 0.38, contourStrength: 0.52, distortionStrength: 0.26 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.5, step: 0.02, default: 0.88 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.38 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.52 },
    { key: 'distortionStrength', label: 'Distortion', min: 0, max: 1, step: 0.02, default: 0.26 },
  ],
};
