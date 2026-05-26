import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const timeGlassStyle: SimStyle = {
  id: 'time-glass',
  name: 'Time Glass',
  description: 'Amber hourglass grains with warm echoes and slow cinematic bloom.',
  background: 0x100704,
  palette: [0x100704, 0x51200c, 0xd47922, 0xffd37a, 0xfffbdd],
  passes: ['trailFeedback', 'paletteMap', 'edgeGlow', 'bloom', 'chromaticAberration'],
  uniforms: { glowStrength: 0.7, trailPersistence: 0.978, chromatic: 0.07, bloomStrength: 0.62 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Hourglass Glow', min: 0, max: 1, step: 0.01, default: 0.7 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.01, default: 0.62 },
  ],
};
