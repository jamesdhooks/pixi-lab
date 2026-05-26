import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const leopardGoldStyle: SimStyle = {
  id: 'leopard-gold',
  name: 'Leopard Gold',
  description: 'Ochre rosettes and black reaction islands like living animal skin.',
  background: 0x070502,
  palette: [0x070502, 0x221106, 0x8a4d12, 0xf0b84a, 0xfff2b0],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.5, bloomStrength: 0.22, contourStrength: 0.62 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.5 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.22 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.62 },
  ],
};
