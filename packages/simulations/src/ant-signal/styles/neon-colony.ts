import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const neonColonyStyle: SimStyle = {
  id: 'neon-colony',
  name: 'Neon Colony',
  description: 'Hot amber pheromone roads over deep violet nest signals.',
  background: 0x05030c,
  palette: [0x05030c, 0x17123c, 0x5d2cff, 0xff3fb4, 0xfff28a],
  passes: ['paletteMap', 'trailFeedback', 'bloom', 'edgeGlow'],
  uniforms: { glowStrength: 0.62, trailPersistence: 0.982, antBloom: 0.46, signalContrast: 0.72 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Trail Glow', min: 0, max: 1, step: 0.01, default: 0.62 },
    { key: 'signalContrast', label: 'Signal Contrast', min: 0.2, max: 1, step: 0.01, default: 0.72 },
  ],
};
