import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const neonCircuitStyle: SimStyle = {
  id: 'neon-circuit',
  name: 'Neon Circuit',
  description: 'Green and magenta circuit-like plasma scars over dark silicon.',
  background: 0x030608,
  palette: [0x030608, 0x062018, 0x17ff8a, 0xff38d3, 0xf5fff9],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.66, chargeThreshold: 0.42, scarPersistence: 0.972, branchBloom: 0.48 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Circuit Glow', min: 0, max: 1, step: 0.01, default: 0.66 },
    { key: 'scarPersistence', label: 'Scar Persistence', min: 0.9, max: 0.995, step: 0.005, default: 0.972 },
  ],
};
