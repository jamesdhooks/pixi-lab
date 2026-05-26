import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const fungalRoadsStyle: SimStyle = {
  id: 'fungal-roads',
  name: 'Fungal Roads',
  description: 'Earthy magenta and lime trail highways with soft biological bloom.',
  background: 0x07050a,
  palette: [0x07050a, 0x25101e, 0x7b284f, 0x94ff4f, 0xffd98a],
  passes: ['paletteMap', 'trailFeedback', 'edgeGlow', 'bloom'],
  uniforms: { glowStrength: 0.48, trailPersistence: 0.976, antBloom: 0.52, signalContrast: 0.65 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Organic Glow', min: 0, max: 1, step: 0.01, default: 0.48 },
    { key: 'signalContrast', label: 'Road Contrast', min: 0.2, max: 1, step: 0.01, default: 0.65 },
  ],
};
