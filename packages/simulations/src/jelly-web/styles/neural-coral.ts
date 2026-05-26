import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const neuralCoralStyle: SimStyle = {
  id: 'neural-coral',
  name: 'Neural Coral',
  description: 'Warm coral nodes and electric yellow filaments like a living reef synapse.',
  background: 0x12040c,
  palette: [0x18040f, 0x7e234f, 0xff6f91, 0xffd166, 0xfffff0],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.78, threshold: 0.28, contourSpacing: 0.12, distortion: 0.12 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Coral Glow', min: 0, max: 1, step: 0.01, default: 0.78 },
    { key: 'contourSpacing', label: 'Synapse Bands', min: 0.05, max: 0.35, step: 0.01, default: 0.12 },
  ],
};
