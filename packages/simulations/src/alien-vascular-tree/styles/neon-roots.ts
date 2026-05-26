import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const neonRootsStyle: SimStyle = {
  id: 'neon-roots',
  name: 'Neon Roots',
  description: 'Ultraviolet soil threaded with cyan vascular pulses and magenta growth tips.',
  background: 0x040711,
  palette: [0x040711, 0x101943, 0x123f76, 0x00f0ff, 0xff33d1, 0xf5ffb8],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.95, bloomStrength: 0.44, contourStrength: 0.34, distortionStrength: 0.2 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.5, step: 0.02, default: 0.95 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.44 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.34 },
    { key: 'distortionStrength', label: 'Pulse Warp', min: 0, max: 1, step: 0.02, default: 0.2 },
  ],
};
