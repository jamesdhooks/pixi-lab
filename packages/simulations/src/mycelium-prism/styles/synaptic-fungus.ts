import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const synapticFungusStyle: SimStyle = {
  id: 'synaptic-fungus',
  name: 'Synaptic Fungus',
  description: 'Cool cyan colonies with neural gold pulses and deep indigo voids.',
  background: 0x040818,
  palette: [0x07112a, 0x1b7cff, 0x31ffd2, 0xffd166, 0xfffbdb],
  passes: ['primitive', 'paletteMap', 'trailFeedback', 'bloom', 'chromaticAberration'],
  uniforms: { glowStrength: 0.82, contourSpacing: 0.15, pulseSpeed: 0.75 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.82 },
    { key: 'pulseSpeed', label: 'Pulse Speed', min: 0, max: 2, step: 0.05, default: 0.75 },
  ],
};
