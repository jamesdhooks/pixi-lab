import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const goldWillowStyle: SimStyle = {
  id: 'gold-willow',
  name: 'Gold Willow',
  description: 'Warm champagne trails with ember-red crackle tips.',
  background: 0x090604,
  palette: [0xfff7c2, 0xffd166, 0xff9f1c, 0xe85d04, 0xfff3b0, 0xffb703],
  passes: ['trailFeedback', 'edgeGlow', 'bloom'],
  uniforms: { glowBias: 1.18, colorShift: 0.12, skyLift: 0.04 },
};
