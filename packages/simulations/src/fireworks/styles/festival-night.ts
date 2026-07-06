import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const festivalNightStyle: SimStyle = {
  id: 'festival-night',
  name: 'Festival Night',
  description: 'Balanced jewel-tone fireworks against a blue-black sky.',
  background: 0x050816,
  palette: [0xffffff, 0xffd166, 0xff4d6d, 0x4dffcf, 0x8fb3ff, 0xc77dff, 0xff8fab],
  passes: ['trailFeedback', 'edgeGlow', 'bloom', 'colorGrade'],
  uniforms: { glowBias: 1.0, colorShift: 0.26, skyLift: 0.06 },
};
