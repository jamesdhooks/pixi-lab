import { describe, expect, it } from 'vitest';
import { Input } from '../Input.js';

describe('Input AI intents', () => {
  it('uses stable ids for multi-frame AI drags and clears them on drag_end', () => {
    const input = new Input();

    input.injectIntent({ kind: 'drag_start', id: -42, x: 10, y: 20 });
    input.flush();

    expect(input.snapshot.justDown.has(-42)).toBe(true);
    expect(input.snapshot.pointers.get(-42)).toEqual(
      expect.objectContaining({ id: -42, x: 10, y: 20, source: 'ai' }),
    );

    input.injectIntent({ kind: 'drag_move', id: -42, x: 30, y: 40 });

    expect(input.snapshot.pointers.get(-42)).toEqual(
      expect.objectContaining({ id: -42, x: 30, y: 40, source: 'ai' }),
    );

    input.injectIntent({ kind: 'drag_end', id: -42, x: 30, y: 40 });
    input.flush();

    expect(input.snapshot.justUp.has(-42)).toBe(true);
    expect(input.snapshot.pointers.has(-42)).toBe(false);
  });
});
