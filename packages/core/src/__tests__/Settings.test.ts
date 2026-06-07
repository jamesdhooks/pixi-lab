import { describe, expect, it, beforeEach } from 'vitest';
import { Settings } from '../Settings.js';
import type { SettingsField } from '../types.js';

const fields: SettingsField[] = [
  { key: 'scale', label: 'Scale', type: 'number', min: 1, max: 3, default: 2 },
  { key: 'enabled', label: 'Enabled', type: 'boolean', default: true },
  {
    key: 'mode',
    label: 'Mode',
    type: 'select',
    default: 'a',
    options: [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ],
  },
  { key: 'label', label: 'Label', type: 'string', default: 'default' },
];

describe('Settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sanitizes stale persisted settings against the current field schema', () => {
    localStorage.setItem(
      'fao:game:settings:test-game',
      JSON.stringify({
        scale: 100,
        enabled: 'yes',
        mode: 'removed-option',
        label: 42,
        legacySetting: 'stale',
      }),
    );

    const settings = new Settings('test-game', fields);

    expect(settings.get('scale')).toBe(3);
    expect(settings.get('enabled')).toBe(true);
    expect(settings.get('mode')).toBe('a');
    expect(settings.get('label')).toBe('default');
    expect(settings.getAll()).not.toHaveProperty('legacySetting');
  });

  it('sanitizes values before persisting and notifying listeners', () => {
    const settings = new Settings('test-game', fields);
    const changes: unknown[] = [];
    settings.onChange((key, value) => changes.push([key, value]));

    settings.set('scale', Number.NaN);
    settings.set('mode', 'removed-option');

    expect(settings.get('scale')).toBe(2);
    expect(settings.get('mode')).toBe('a');
    expect(changes).toEqual([
      ['scale', 2],
      ['mode', 'a'],
    ]);
    expect(JSON.parse(localStorage.getItem('fao:game:settings:test-game') ?? '{}')).toMatchObject({
      scale: 2,
      mode: 'a',
    });
  });
});
