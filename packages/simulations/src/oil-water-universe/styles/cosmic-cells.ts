import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const cosmicCellsStyle: SimStyle = {
  id: 'cosmic-cells',
  name: 'Cosmic Cells',
  description: 'Nebula-purple fluids phase into bright cellular continents in a dark basin.',
  background: 0x04020d,
  palette: [0x04020d, 0x151342, 0x4e2f8e, 0xf050a8, 0x7cf7ff, 0xffffff],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { threshold: 0.43, glowStrength: 0.96, bloomStrength: 0.42, contourStrength: 0.5 },
  uniformSchema: [
    { key: 'threshold', label: 'Membrane Threshold', min: 0.2, max: 0.8, step: 0.01, default: 0.43 },
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.96 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.42 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.5 },
  ],
};
