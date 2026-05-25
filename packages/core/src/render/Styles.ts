/**
 * packages/core/src/render/Styles.ts
 *
 * Style registry: palettes and shader preset configs.
 * Each game can register custom palettes or use the built-ins.
 */
import type { GamePalette, StyleConfig, ShaderPreset } from '../types.js';

export const PALETTES: Record<string, GamePalette> = {
  rainbow: {
    name: 'rainbow',
    background: 0x1a1a2e,
    ballColors: [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff922b, 0xda77ff],
    accentColor: 0xffd93d,
    textColor: '#ffffff',
  },
  pastel: {
    name: 'pastel',
    background: 0xfce4ec,
    ballColors: [0xf8bbd0, 0xe1bee7, 0xbbdefb, 0xb2dfdb, 0xfff9c4, 0xffe0b2],
    accentColor: 0xf48fb1,
    textColor: '#5d4037',
  },
  neon: {
    name: 'neon',
    background: 0x0d0d0d,
    ballColors: [0x00ff88, 0xff0055, 0x00cfff, 0xffee00, 0xff44aa, 0x44ffaa],
    accentColor: 0x00ff88,
    textColor: '#00ff88',
  },
  ocean: {
    name: 'ocean',
    background: 0x0a1628,
    ballColors: [0x0077b6, 0x00b4d8, 0x90e0ef, 0x48cae4, 0x023e8a, 0x0096c7],
    accentColor: 0x90e0ef,
    textColor: '#90e0ef',
  },
  candy: {
    name: 'candy',
    background: 0xff85c8,
    ballColors: [0xff6fe8, 0xffc3f3, 0xc77dff, 0x7b2fff, 0xff9de2, 0xd0abff],
    accentColor: 0xc77dff,
    textColor: '#ffffff',
  },
};

export const DEFAULT_STYLE: StyleConfig = {
  palette: PALETTES.rainbow,
  shader: 'none',
  particleOpacity: 0.85,
};

export class StyleRegistry {
  private custom = new Map<string, GamePalette>();

  registerPalette(palette: GamePalette) {
    this.custom.set(palette.name, palette);
  }

  getPalette(name: string): GamePalette {
    return this.custom.get(name) ?? PALETTES[name] ?? PALETTES.rainbow;
  }

  buildStyle(paletteName: string, shader: ShaderPreset = 'none'): StyleConfig {
    return {
      palette: this.getPalette(paletteName),
      shader,
      particleOpacity: 0.85,
    };
  }

  /** Picks a random ball color from the palette */
  randomBallColor(palette: GamePalette): number {
    return palette.ballColors[Math.floor(Math.random() * palette.ballColors.length)];
  }
}

export const styleRegistry = new StyleRegistry();
