import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const lightningGardenStyle: SimStyle = {
  id: 'lightning-garden',
  name: 'Lightning Garden',
  description: 'White-blue branching arcs crawling through a charged violet terrarium.',
  background: 0x020411,
  palette: [0x020411, 0x14113f, 0x2458ff, 0x75e8ff, 0xffffff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'trailFeedback'],
  uniforms: { glowStrength: 0.74, chargeThreshold: 0.36, scarPersistence: 0.965, branchBloom: 0.62 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Arc Glow', min: 0, max: 1, step: 0.01, default: 0.74 },
    { key: 'chargeThreshold', label: 'Charge Threshold', min: 0.1, max: 0.9, step: 0.01, default: 0.36 },
  ],
};
