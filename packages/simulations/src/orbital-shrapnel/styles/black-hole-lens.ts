import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const blackHoleLensStyle: SimStyle = {
  id: 'black-hole-lens',
  name: 'Black Hole Lens',
  description: 'Violet and acid-green fragments bending into a high-contrast gravity lens.',
  background: 0x020106,
  palette: [0x020106, 0x190b3f, 0x7b2cff, 0x35ff9d, 0xf8fff2],
  passes: ['trailFeedback', 'paletteMap', 'distortion', 'chromaticAberration', 'bloom', 'shockwave'],
  uniforms: { glowStrength: 0.84, trailPersistence: 0.972, shockwaveStrength: 0.52, chromatic: 0.18 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Lens Glow', min: 0, max: 1, step: 0.01, default: 0.84 },
    { key: 'chromatic', label: 'Chromatic Edge', min: 0, max: 0.35, step: 0.01, default: 0.18 },
  ],
};
