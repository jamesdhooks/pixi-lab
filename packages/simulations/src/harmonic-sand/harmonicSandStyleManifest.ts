import type { SimStyleManifest } from '@hooksjam/pixi-lab-core';
import { biolumOceanStyle } from './styles/biolum-ocean.js';
import { chladniGoldStyle } from './styles/chladni-gold.js';
import { deepVoidStyle } from './styles/deep-void.js';
import { emberPulseStyle } from './styles/ember-pulse.js';
import { ghostFrequencyStyle } from './styles/ghost-frequency.js';
import { laserPlateStyle } from './styles/laser-plate.js';
import { magnetarBloomStyle } from './styles/magnetar-bloom.js';
import { neonCoralStyle } from './styles/neon-coral.js';
import { prismMilkStyle } from './styles/prism-milk.js';
import { rainbowInterferenceStyle } from './styles/rainbow-interference.js';

export const harmonicSandStyleManifest: SimStyleManifest = {
  defaultStyleId: 'chladni-gold',
  capabilities: {
    renderLayers: ['particles', 'field', 'glow', 'debug'],
    passes: ['primitive', 'paletteMap', 'contourBands', 'fieldVisualize', 'trailFeedback', 'bloom'],
    qualities: ['basic', 'enhanced', 'raw'],
  },
  styles: [
    chladniGoldStyle,
    laserPlateStyle,
    ghostFrequencyStyle,
    neonCoralStyle,
    deepVoidStyle,
    biolumOceanStyle,
    emberPulseStyle,
    rainbowInterferenceStyle,
    prismMilkStyle,
    magnetarBloomStyle,
    {
    id: '__random__',
    name: 'Random',
    description: 'Picks a random style each time.',
    background: 0x000000,
    palette: [0x334455, 0x6677aa, 0xaabbdd, 0xffffff],
    passes: [],
    uniforms: {},
    uniformSchema: [],
  }],
};
