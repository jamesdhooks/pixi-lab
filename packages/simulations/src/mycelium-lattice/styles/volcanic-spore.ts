import type { SimStyle } from '@hooksjam/pixi-lab-core';

/**
 * Volcanic Spore — dark charcoal substrate lit by deep-ember and bright-orange
 * filaments.  Aggressive and hot; contrasts Earth Overgrowth's organic calm.
 */
export const volcanicSporeStyle: SimStyle = {
  id: 'volcanic-spore',
  name: 'Volcanic Spore',
  description: 'Ember-orange spores crawling through a charcoal field toward molten gold.',
  background: 0x020101,
  palette: [
    0x020101,  // void
    0x0f0806,  // near-black soot
    0x2a1510,  // deep charcoal
    0x4a2018,  // dark ember
    0x7a3520,  // lava rock
    0xb84e28,  // hot ember
    0xe07830,  // orange glow
    0xf5a050,  // bright orange
    0xffd080,  // pale gold
    0xfff6c0,  // near-white hot
  ],
  passes: ['primitive', 'paletteMap', 'edgeGlow', 'bloom'],
  uniforms: { glowStrength: 0.78, pulseSpeed: 0.60 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.78 },
    { key: 'pulseSpeed',   label: 'Pulse Speed',   min: 0, max: 2, step: 0.05, default: 0.60 },
  ],
};
