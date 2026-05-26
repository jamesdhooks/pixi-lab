import type { SimStyle } from '@hooksjam/pixi-lab-core';

/**
 * Arctic Lichen — cool frost blues and powder whites spreading across void.
 * A cold counterpart to Earth Overgrowth; icy and crystalline.
 */
export const arcticLichenStyle: SimStyle = {
  id: 'arctic-lichen',
  name: 'Arctic Lichen',
  description: 'Frost blues and powder whites crystallising across a deep-void ground.',
  background: 0x02040a,
  palette: [
    0x02040a,  // void
    0x060d18,  // deep navy shadow
    0x0f1e30,  // midnight
    0x1e3a54,  // dark steel
    0x2e5c7a,  // ocean depth
    0x4a8aaa,  // steel blue
    0x74b8cc,  // powder blue
    0xa8d8e4,  // pale ice
    0xd4eef5,  // frost white
    0xf0f7ff,  // arctic white
  ],
  passes: ['primitive', 'paletteMap', 'contourBands', 'bloom'],
  uniforms: { glowStrength: 0.62, contourSpacing: 0.22, pulseSpeed: 0.28 },
  uniformSchema: [
    { key: 'glowStrength',   label: 'Glow Strength',    min: 0,    max: 1,   step: 0.01, default: 0.62 },
    { key: 'contourSpacing', label: 'Contour Spacing',  min: 0.05, max: 0.5, step: 0.01, default: 0.22 },
  ],
};
