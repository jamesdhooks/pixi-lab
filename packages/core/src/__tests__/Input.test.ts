import { describe, expect, it } from 'vitest';
import { Input } from '../Input.js';

function createTarget(): HTMLElement {
  const target = document.createElement('div');
  Object.defineProperty(target, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }),
  });
  return target;
}

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

  it('keeps quick human tap coordinates available for one flushed frame', () => {
    const input = new Input();
    const target = createTarget();
    input.mount(target);

    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 17, clientX: 80, clientY: 40 }));
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 17, clientX: 82, clientY: 42 }));
    input.flush();

    expect(input.snapshot.justDown.has(17)).toBe(true);
    expect(input.snapshot.justUp.has(17)).toBe(true);
    expect(input.snapshot.pointers.get(17)).toEqual(
      expect.objectContaining({ id: 17, x: 82, y: 42, type: 'up', source: 'human' }),
    );

    input.flush();

    expect(input.snapshot.justDown.has(17)).toBe(false);
    expect(input.snapshot.justUp.has(17)).toBe(false);
    expect(input.snapshot.pointers.has(17)).toBe(false);
    input.unmount();
  });
});
