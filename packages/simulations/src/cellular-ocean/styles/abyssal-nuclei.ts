import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const abyssalNucleiStyle: SimStyle = {
  id: 'abyssal-nuclei',
  name: 'Abyssal Nuclei',
  description: 'Deep indigo cells with ghostly green nuclei and soft phosphor edges.',
  background: 0x02030d,
  palette: [0x02030d, 0x101a4a, 0x35f08a, 0x7fffd4, 0xe8fff9],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'distortion'],
  uniforms: { glowStrength: 0.84, threshold: 0.3, contourSpacing: 0.12, distortion: 0.18 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Nuclei Glow', min: 0, max: 1, step: 0.01, default: 0.84 },
    { key: 'contourSpacing', label: 'Membrane Bands', min: 0.05, max: 0.35, step: 0.01, default: 0.12 },
  ],
};
