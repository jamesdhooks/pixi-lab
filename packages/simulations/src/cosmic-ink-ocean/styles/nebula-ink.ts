import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const nebulaInkStyle: SimStyle = {
  id: 'nebula-ink',
  name: 'Nebula Ink',
  description: 'Violet and cyan dye plumes over a dark interstellar bath.',
  background: 0x02030b,
  palette: [0x02030b, 0x10153a, 0x6d3cff, 0x29e6ff, 0xf8fbff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'trailFeedback', 'distortion'],
  uniforms: { glowStrength: 0.78, bloomStrength: 0.42, distortionStrength: 0.28 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.78 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.42 },
    { key: 'distortionStrength', label: 'Distortion', min: 0, max: 1, step: 0.02, default: 0.28 },
  ],
};
