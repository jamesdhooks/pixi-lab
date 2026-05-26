import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const rubyFaultStyle: SimStyle = {
  id: 'ruby-fault',
  name: 'Ruby Fault',
  description: 'Crimson crystal stress with molten gold fracture lines.',
  background: 0x120207,
  palette: [0x120207, 0x4a0714, 0xa7192f, 0xff8a2a, 0xffef9c],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'trailFeedback'],
  uniforms: { glowStrength: 0.72, fractureGlow: 0.95, facetContrast: 0.76, stressThreshold: 0.44 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Ruby Glow', min: 0, max: 1.5, step: 0.01, default: 0.72 },
    { key: 'facetContrast', label: 'Facet Contrast', min: 0, max: 1.5, step: 0.01, default: 0.76 },
  ],
};
