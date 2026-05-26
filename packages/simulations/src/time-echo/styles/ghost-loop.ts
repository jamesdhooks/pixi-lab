import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const ghostLoopStyle: SimStyle = {
  id: 'ghost-loop',
  name: 'Ghost Loop',
  description: 'Pale spectral echoes drifting through blue-black temporal fog.',
  background: 0x020712,
  palette: [0x020712, 0x0a2442, 0x3fc7ff, 0xbbfff7, 0xffffff],
  passes: ['trailFeedback', 'paletteMap', 'chromaticAberration', 'bloom', 'shockwave'],
  uniforms: { glowStrength: 0.78, trailPersistence: 0.966, chromatic: 0.12, shockwaveStrength: 0.34 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Ghost Glow', min: 0, max: 1, step: 0.01, default: 0.78 },
    { key: 'chromatic', label: 'Time Split', min: 0, max: 0.35, step: 0.01, default: 0.12 },
  ],
};
