import { describe, expect, it } from 'vitest';
import { GAME_REGISTRY, getGame } from '../../index';
import { pegboardDefinition } from '../pegboard.definition';

describe('pegboardDefinition', () => {
  it('registers Pegboard as a real score-driven game with shell-owned controls', () => {
    expect(pegboardDefinition).toMatchObject({
      id: 'pegboard',
      kind: 'game',
      name: 'Pegboard Pachinko',
      capabilities: {
        score: true,
        reset: true,
        tutorial: true,
        aiAutoplay: true,
        settings: true,
      },
    });
    expect(pegboardDefinition.capabilities.qualityModes).toEqual(['basic', 'enhanced']);
    expect(pegboardDefinition.capabilities.engineConfigurations?.map((config) => config.id)).toEqual(['basic', 'enhanced']);
    expect(pegboardDefinition.tutorialPages?.map((page) => page.title)).toEqual(['Start', 'Play', 'Result', 'Restart']);
    expect(pegboardDefinition.settingsFields?.every((field) => Boolean(field.section))).toBe(true);
    expect(pegboardDefinition.aiFactory).toBeDefined();
  });

  it('is discoverable from the games registry and lookup helper', () => {
    expect(GAME_REGISTRY.some((entry) => entry.id === 'pegboard')).toBe(true);
    expect(getGame('pegboard')).toBe(pegboardDefinition);
  });
});
