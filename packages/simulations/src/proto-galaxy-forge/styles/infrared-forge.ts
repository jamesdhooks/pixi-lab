import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const infraredForgeStyle: SimStyle = {
  id: 'infrared-forge',
  name: 'Infrared Forge',
  description: 'Amber dust lanes and ember-hot star birth regions against a black telescope plate.',
  background: 0x050201,
  palette: [0x050201, 0x1a0a05, 0x4f1e0a, 0xc95b1e, 0xffb347, 0xffffd4],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 1.0, bloomStrength: 0.62, contourStrength: 0.28, distortionStrength: 0.12 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Dust Glow', min: 0, max: 1.8, step: 0.02, default: 1.0 },
    { key: 'bloomStrength', label: 'Protostar Bloom', min: 0, max: 1, step: 0.02, default: 0.62 },
    { key: 'contourStrength', label: 'Dust Lanes', min: 0, max: 1, step: 0.02, default: 0.28 },
  ],
};
