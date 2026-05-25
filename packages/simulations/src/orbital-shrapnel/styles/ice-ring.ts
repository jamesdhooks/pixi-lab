import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const iceRingStyle: SimStyle = {
  id: 'ice-ring',
  name: 'Ice Ring',
  description: 'Cold blue debris and pale dust trails over a deep orbital void.',
  background: 0x010713,
  palette: [0x020817, 0x15345f, 0x39baff, 0xb9f4ff, 0xffffff],
  passes: ['trailFeedback', 'paletteMap', 'bloom', 'shockwave'],
  uniforms: { glowStrength: 0.58, trailPersistence: 0.955, shockwaveStrength: 0.36, chromatic: 0.08 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Ice Glow', min: 0, max: 1, step: 0.01, default: 0.58 },
    { key: 'trailPersistence', label: 'Trail Persistence', min: 0.86, max: 0.995, step: 0.005, default: 0.955 },
  ],
};
