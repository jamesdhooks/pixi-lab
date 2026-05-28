import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const acidDawnStyle: SimStyle = {
  id: 'acid-dawn',
  name: 'Acid Dawn',
  description: 'Chartreuse deltas and orange sediment clouds over a dark pre-sunrise basin.',
  background: 0x070b09,
  palette: [0x070b09, 0x17351d, 0x4aa33b, 0xd5ff37, 0xff8f2b, 0xfff0c7],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.72, bloomStrength: 0.28, contourStrength: 0.62, distortionStrength: 0.18 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.5, step: 0.02, default: 0.72 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.28 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.62 },
    { key: 'distortionStrength', label: 'Distortion', min: 0, max: 1, step: 0.02, default: 0.18 },
  ],
};
