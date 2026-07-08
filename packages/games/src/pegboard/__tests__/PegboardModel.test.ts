import { describe, expect, it } from 'vitest';
import { createPegboardModel, type PegboardState } from '../PegboardModel';

function binScore(state: PegboardState, binId: string): number {
  const bin = state.bins.find((candidate) => candidate.id === binId);
  if (!bin) {
    throw new Error(`Missing bin ${binId}`);
  }
  return bin.score;
}

describe('PegboardModel', () => {
  it('creates a deterministic peg and bin layout from the seed', () => {
    const first = createPegboardModel({ seed: 42, width: 800, height: 600 }).getState();
    const second = createPegboardModel({ seed: 42, width: 800, height: 600 }).getState();

    expect(first.phase).toBe('start');
    expect(first.pegs).toEqual(second.pegs);
    expect(first.bins).toEqual(second.bins);
    expect(first.pegs).toHaveLength(48);
    expect(first.bins.map((bin) => bin.multiplier)).toEqual([1, 2, 4, 8, 4, 2, 1]);
  });

  it('moves from start to play when the first ball is dropped and tracks active balls', () => {
    const model = createPegboardModel({ seed: 7, width: 800, height: 600 });

    const ball = model.dropBall(0.2);
    const state = model.getState();

    expect(state.phase).toBe('play');
    expect(ball.x).toBeGreaterThanOrEqual(64);
    expect(ball.x).toBeLessThanOrEqual(736);
    expect(state.activeBalls).toHaveLength(1);
    expect(state.dropsRemaining).toBe(state.settings.maxDrops - 1);
  });

  it('scores resolved balls into bins with combo bonuses and produces visual events', () => {
    const model = createPegboardModel({ seed: 9, width: 800, height: 600 });
    const ball = model.dropBall(0.5);

    const scored = model.resolveBall(ball.id, 'bin-3');
    const state = model.getState();

    expect(scored).toMatchObject({ points: 80, totalScore: 80, combo: 1 });
    expect(state.score).toBe(80);
    expect(state.combo).toBe(1);
    expect(binScore(state, 'bin-3')).toBe(80);
    expect(state.activeBalls).toHaveLength(0);
    expect(model.drainEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'score', points: 80, binId: 'bin-3' }),
        expect.objectContaining({ kind: 'burst', x: expect.any(Number), y: expect.any(Number) }),
      ]),
    );
  });

  it('enters result when no drops and no active balls remain, then restarts cleanly', () => {
    const model = createPegboardModel({ seed: 3, width: 800, height: 600, maxDrops: 1 });
    const ball = model.dropBall(0.5);
    model.resolveBall(ball.id, 'bin-4');

    const result = model.getState();
    expect(result.phase).toBe('result');
    expect(result.result).toMatchObject({ outcome: 'complete', finalScore: result.score });

    model.restart();
    const restarted = model.getState();
    expect(restarted.phase).toBe('start');
    expect(restarted.score).toBe(0);
    expect(restarted.combo).toBe(0);
    expect(restarted.activeBalls).toHaveLength(0);
    expect(restarted.dropsRemaining).toBe(restarted.settings.maxDrops);
  });
});
