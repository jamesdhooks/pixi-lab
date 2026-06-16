import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const ultravioletWebStyle: SimStyle = {
  id: 'ultraviolet-web',
  name: 'Ultraviolet Web',
  description: 'High-contrast blacklight strands with lime and violet resonance bands.',
  background: 0x05000b,
  palette: [0x090014, 0x43118f, 0x9d4edd, 0x9ef01a, 0xf8ffe5],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion', 'contourBands'],
  uniforms: { glowStrength: 0.92, threshold: 0.36, distortion: 0.3, contourSpacing: 0.16 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Blacklight Glow', min: 0, max: 1, step: 0.01, default: 0.92 },
    { key: 'distortion', label: 'UV Warp', min: 0, max: 0.5, step: 0.01, default: 0.3 },
  ],
};
