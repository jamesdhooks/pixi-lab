import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const mineralBowlStyle: SimStyle = {
  id: 'mineral-bowl',
  name: 'Mineral Bowl',
  description: 'Malachite, lapis, and hot garnet grains settle into polished stone bands.',
  background: 0x030706,
  palette: [0x030706, 0x073b34, 0x17b890, 0x2f6bff, 0xb64bff, 0xff784f],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'contourBands'],
  uniforms: { threshold: 0.42, glowStrength: 0.62, bloomStrength: 0.22, contourStrength: 0.82 },
  uniformSchema: [
    { key: 'threshold', label: 'Mineral Cutoff', min: 0.18, max: 0.72, step: 0.01, default: 0.42 },
    { key: 'glowStrength', label: 'Edge Glow', min: 0, max: 1.4, step: 0.02, default: 0.62 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.22 },
    { key: 'contourStrength', label: 'Sediment Bands', min: 0, max: 1, step: 0.02, default: 0.82 },
  ],
};
