import type { GestureEvent } from '@hooksjam/pixi-lab-core';
import { describe, expect, it } from 'vitest';
import { fireworksInputCommandsForMode } from '../RawFireworksScene.js';

const WIDTH = 1024;
const HEIGHT = 768;

function gesture(overrides: Partial<GestureEvent> & Pick<GestureEvent, 'kind'>): GestureEvent {
  const event: GestureEvent = {
    kind: overrides.kind,
    x: overrides.x ?? 512,
    y: overrides.y ?? 220,
    timestamp: overrides.timestamp ?? 1000,
  };
  if (overrides.id !== undefined) event.id = overrides.id;
  if (overrides.dx !== undefined) event.dx = overrides.dx;
  if (overrides.dy !== undefined) event.dy = overrides.dy;
  if (overrides.velocity !== undefined) event.velocity = overrides.velocity;
  if (overrides.durationMs !== undefined) event.durationMs = overrides.durationMs;
  return event;
}

describe('fireworks input modes', () => {
  it('keeps single mode to one shell per tap-like input', () => {
    const commands = fireworksInputCommandsForMode('single', [
      gesture({ kind: 'tap', id: 7 }),
      gesture({ kind: 'double_tap', id: 7 }),
      gesture({ kind: 'drag', id: 7, dx: 80, dy: -20 }),
      gesture({ kind: 'hold', id: 7 }),
    ], WIDTH, HEIGHT);

    expect(commands).toEqual([{ action: 'launch', x: 512, y: 220 }]);
  });

  it('keeps legacy launch and fan ids compatible with single mode', () => {
    const launchCommands = fireworksInputCommandsForMode('launch', [
      gesture({ kind: 'tap', id: 9, x: 400, y: 180 }),
      gesture({ kind: 'double_tap', id: 9, x: 400, y: 180 }),
      gesture({ kind: 'drag', id: 9, x: 460, y: 220, dx: 60, dy: 40 }),
      gesture({ kind: 'fast_swipe', id: 9, x: 520, y: 240, dx: 220, dy: -100 }),
    ], WIDTH, HEIGHT);
    const fanCommands = fireworksInputCommandsForMode('fan', [
      gesture({ kind: 'tap', id: 10, x: 410, y: 190 }),
      gesture({ kind: 'drag', id: 10, x: 460, y: 220, dx: 60, dy: 40 }),
    ], WIDTH, HEIGHT);

    expect(launchCommands).toEqual([
      { action: 'launch', x: 400, y: 180 },
      { action: 'launch', x: 575, y: 222 },
    ]);
    expect(fanCommands).toEqual([{ action: 'launch', x: 410, y: 190 }]);
  });

  it('allows streaming only in stream mode', () => {
    const commands = fireworksInputCommandsForMode('stream', [
      gesture({ kind: 'tap', id: 1, x: 300, y: 160 }),
      gesture({ kind: 'drag', id: 1, x: 420, y: 210, dx: 120, dy: -30 }),
      gesture({ kind: 'drag', id: 1, x: 500, y: 260, dx: 200, dy: -40 }),
    ], WIDTH, HEIGHT);

    expect(commands).toHaveLength(3);
    expect(commands[0]).toEqual({ action: 'launch', x: 300, y: 160 });
    expect(commands[1]?.action).toBe('launch');
    expect(commands[2]?.action).toBe('launch');
  });

  it('keeps legacy finale id compatible with stream mode', () => {
    const commands = fireworksInputCommandsForMode('finale', [
      gesture({ kind: 'drag', id: 4, x: 360, y: 210, dx: 80, dy: -40 }),
    ], WIDTH, HEIGHT);

    expect(commands).toHaveLength(1);
    expect(commands[0]?.action).toBe('launch');
  });
});
