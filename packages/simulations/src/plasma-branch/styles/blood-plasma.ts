import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const bloodPlasmaStyle: SimStyle = {
  id: 'blood-plasma',
  name: 'Blood Plasma',
  description: 'Hot red-gold ion branches with smoky crimson scars.',
  background: 0x100104,
  palette: [0x100104, 0x3a0610, 0xa51c22, 0xff8a21, 0xfff0a8],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 0.82, chargeThreshold: 0.32, scarPersistence: 0.955, branchBloom: 0.7 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Blood Glow', min: 0, max: 1, step: 0.01, default: 0.82 },
    { key: 'branchBloom', label: 'Branch Bloom', min: 0, max: 1, step: 0.01, default: 0.7 },
  ],
};
