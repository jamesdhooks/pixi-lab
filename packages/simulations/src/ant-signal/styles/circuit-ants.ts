import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const circuitAntsStyle: SimStyle = {
  id: 'circuit-ants',
  name: 'Circuit Ants',
  description: 'Green and cyan routing signals resembling living PCB traces.',
  background: 0x010807,
  palette: [0x010807, 0x052d22, 0x0cff8a, 0x4df3ff, 0xf2fff8],
  passes: ['paletteMap', 'trailFeedback', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.58, trailPersistence: 0.988, antBloom: 0.38, signalContrast: 0.84 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Trace Glow', min: 0, max: 1, step: 0.01, default: 0.58 },
    { key: 'trailPersistence', label: 'Trace Persistence', min: 0.94, max: 0.995, step: 0.001, default: 0.988 },
  ],
};
