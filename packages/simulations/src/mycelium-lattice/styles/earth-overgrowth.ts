import type { SimStyle } from '@hooksjam/pixi-lab-core';

/**
 * Earth Overgrowth — muted organic tones lifted directly from the triangular
 * mycelium HTML reference demo.  Background is near-black; 10-entry palette
 * spreads moss → sage → dry lichen → clay → ochre → mauve → dusk blue →
 * pale eucalyptus across the active cell range.
 */
export const earthOvergrowthStyle: SimStyle = {
  id: 'earth-overgrowth',
  name: 'Earth Overgrowth',
  description: 'Muted mosses, warm clays, and dusk blues crawling across dark substrate.',
  background: 0x050508,
  palette: [
    0x050508,  // void / background
    0x0d130b,  // near-empty substrate
    0x1e2d1c,  // dark moss shadow
    0x3a5238,  // moss
    0x7b9169,  // sage
    0xadaa7c,  // dry lichen
    0xb27c59,  // soft clay
    0xc7a363,  // muted ochre
    0x9e7a85,  // dusty mauve
    0x637994,  // dusk blue / pale eucalyptus blend
  ],
  passes: ['primitive', 'paletteMap', 'bloom'],
  uniforms: { glowStrength: 0.45, pulseSpeed: 0.35 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.45 },
    { key: 'pulseSpeed',   label: 'Pulse Speed',   min: 0, max: 2, step: 0.05, default: 0.35 },
  ],
};
