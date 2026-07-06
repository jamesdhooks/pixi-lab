import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const neonSmokeStyle: SimStyle = {
  id: 'neon-smoke',
  name: 'Neon Smoke',
  description: 'Electric cyan, violet, lime, and hot pink with aggressive color transitions.',
  background: 0x02020a,
  palette: [0x9bffef, 0x00f5d4, 0x00bbf9, 0xfee440, 0xf15bb5, 0x9b5de5, 0xffffff],
  passes: ['trailFeedback', 'edgeGlow', 'bloom', 'chromaticAberration'],
  uniforms: { glowBias: 1.32, colorShift: 0.52, skyLift: 0.03 },
};
