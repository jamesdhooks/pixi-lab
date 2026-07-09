import type { GestureEvent } from '@hooksjam/pixi-lab-core';
import { describe, expect, it } from 'vitest';
import { sparksInputCommandsForMode } from '../RawSparksScene.js';

const WIDTH = 1024;
const HEIGHT = 768;

function gesture(overrides: Partial<GestureEvent> & Pick<GestureEvent, 'kind'>): GestureEvent {
  const event: GestureEvent = {
    kind: overrides.kind,
    x: overrides.x ?? 512,
    y: overrides.y ?? 420,
    timestamp: overrides.timestamp ?? 1000,
  };
  if (overrides.id !== undefined) event.id = overrides.id;
  if (overrides.dx !== undefined) event.dx = overrides.dx;
  if (overrides.dy !== undefined) event.dy = overrides.dy;
  if (overrides.strength !== undefined) event.strength = overrides.strength;
  if (overrides.velocity !== undefined) event.velocity = overrides.velocity;
  return event;
}

describe('sparks input modes', () => {
  it('turns tap-like welding input into one hot burst', () => {
    const commands = sparksInputCommandsForMode('welding', [
      gesture({ kind: 'tap', id: 4 }),
      gesture({ kind: 'double_tap', id: 4 }),
      gesture({ kind: 'hold', id: 4 }),
    ], WIDTH, HEIGHT);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ action: 'emit', x: 512, y: 420, burst: true, pattern: 'welding' });
    expect(commands[0]?.strength).toBeGreaterThan(1);
  });

  it('keeps drag input continuous and bounded', () => {
    const commands = sparksInputCommandsForMode('welding', [
      gesture({ kind: 'drag', id: -1, x: 1000, y: 760, dx: 180, dy: 120, strength: 0.8 }),
    ], WIDTH, HEIGHT);

    expect(commands).toEqual([{
      action: 'emit',
      x: 1024,
      y: 768,
      dx: 180,
      dy: 120,
      strength: 0.8,
      burst: false,
      pattern: 'welding',
    }]);
  });

  it('uses the pinwheel emitter pattern without changing pointer velocity', () => {
    const commands = sparksInputCommandsForMode('pinwheel', [
      gesture({ kind: 'drag', id: -1, x: 400, y: 360, dx: 90, dy: -30, strength: 0.7 }),
    ], WIDTH, HEIGHT);

    expect(commands).toEqual([{
      action: 'emit',
      x: 416.2,
      y: 357,
      dx: 90,
      dy: -30,
      strength: 0.7,
      burst: false,
      pattern: 'pinwheel',
    }]);
  });

  it('uses a downward shower pattern with no inherited input velocity', () => {
    const commands = sparksInputCommandsForMode('shower', [
      gesture({ kind: 'fast_swipe', id: -2, x: 500, y: 480, dx: 260, dy: -120 }),
    ], WIDTH, HEIGHT);

    expect(commands).toEqual([{
      action: 'emit',
      x: 500,
      y: 480,
      dx: 0,
      dy: 0,
      strength: 1.6,
      burst: true,
      pattern: 'shower',
    }]);
  });

  it('maps fast swipes to high-energy welding sprays', () => {
    const commands = sparksInputCommandsForMode('welding', [
      gesture({ kind: 'fast_swipe', id: -2, x: 500, y: 480, dx: 260, dy: -120 }),
    ], WIDTH, HEIGHT);

    expect(commands).toHaveLength(1);
    expect(commands[0]?.burst).toBe(true);
    expect(commands[0]?.pattern).toBe('welding');
    expect(commands[0]?.strength).toBeGreaterThan(1);
  });

  it('treats unknown modes as welding input', () => {
    const commands = sparksInputCommandsForMode('removed-mode', [
      gesture({ kind: 'drag', id: -2, x: 500, y: 480, dx: 260, dy: -120 }),
    ], WIDTH, HEIGHT);

    expect(commands).toHaveLength(1);
    expect(commands[0]?.burst).toBe(false);
    expect(commands[0]?.pattern).toBe('welding');
  });

  it('keeps build mode reserved for rail placement instead of emission', () => {
    const commands = sparksInputCommandsForMode('build', [
      gesture({ kind: 'tap', id: 8 }),
      gesture({ kind: 'drag', id: 8, dx: 80, dy: 20 }),
      gesture({ kind: 'fast_swipe', id: 8, dx: 220, dy: -30 }),
    ], WIDTH, HEIGHT);

    expect(commands).toEqual([]);
  });
});
