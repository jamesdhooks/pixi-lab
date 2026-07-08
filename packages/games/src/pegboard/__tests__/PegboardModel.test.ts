import { describe, expect, it } from 'vitest';
import { createPegboardModel, type PegboardState } from '../PegboardModel';

function binScore(state: PegboardState, binId: string): number {
  const bin = state.bins.find((candidate) => candidate.id === binId);
  if (!bin) {
    throw new Error(`Missing bin ${binId}`);
  }
  return bin.score;
}

function boardSpan(state: PegboardState) {
  return { left: state.board.left, right: state.board.right, width: state.board.width };
}

describe('PegboardModel', () => {
  it('creates a deterministic peg and bin layout from the seed', () => {
    const first = createPegboardModel({ seed: 42, width: 800, height: 600 }).getState();
    const second = createPegboardModel({ seed: 42, width: 800, height: 600 }).getState();

    expect(first.phase).toBe('start');
    expect(first.pegs).toEqual(second.pegs);
    expect(first.bins).toEqual(second.bins);
    expect(first.pegs).toHaveLength(100);
    expect(first.bins.map((bin) => bin.value)).toEqual([10, 25, 50, 100, 50, 25, 10]);
    expect(first.bins.map((bin) => bin.label)).toEqual(['10', '25', '50', '100', '50', '25', '10']);
  });

  it('leaves a top catchment lane before the lowered peg field', () => {
    const state = createPegboardModel({ seed: 42, width: 1000, height: 700 }).getState();
    const minPegY = Math.min(...state.pegs.map((peg) => peg.y - peg.radius));

    expect(state.board.top).toBeLessThan(state.height * 0.1);
    expect(minPegY - state.board.top).toBeGreaterThan(state.height * 0.12);
  });

  it('aligns pegs and bins to one centered board span', () => {
    const state = createPegboardModel({ seed: 42, width: 1000, height: 700 }).getState();
    const span = boardSpan(state);
    const firstBin = state.bins[0];
    const lastBin = state.bins[state.bins.length - 1];
    const pegXs = state.pegs.map((peg) => peg.x);

    expect(firstBin.x).toBeCloseTo(span.left, 6);
    expect(lastBin.x + lastBin.width).toBeCloseTo(span.right, 6);
    expect(Math.min(...pegXs)).toBeLessThan(span.left + span.width * 0.04);
    expect(Math.max(...pegXs)).toBeGreaterThan(span.right - span.width * 0.04);
    expect(state.bucketHeight / state.height).toBeGreaterThan(0.16);
    expect(state.board.bottom + state.bucketHeight).toBeLessThanOrEqual(state.height - 28);
  });

  it('applies physics settings live without rebuilding the board', () => {
    const model = createPegboardModel({ seed: 42, width: 800, height: 600, gravity: 420, bounce: 0.6 });
    const before = model.getState();

    model.updateSettings({ gravity: 1080, bounce: 1.1 });
    const after = model.getState();

    expect(after.settings.gravity).toBe(1080);
    expect(after.settings.bounce).toBe(1.1);
    expect(after.pegs).toEqual(before.pegs);
    expect(after.bins).toEqual(before.bins);
  });

  it('updates drops per round immediately before play starts', () => {
    const model = createPegboardModel({ seed: 42, width: 800, height: 600, maxDrops: 8 });

    model.updateSettings({ maxDrops: 16 });

    const state = model.getState();
    expect(state.settings.maxDrops).toBe(16);
    expect(state.dropsRemaining).toBe(16);
  });

  it('scales board footprint and peg density with the viewport', () => {
    const compact = createPegboardModel({ seed: 42, width: 640, height: 480 }).getState();
    const wide = createPegboardModel({ seed: 42, width: 1440, height: 900 }).getState();

    expect(compact.board.width / compact.width).toBeGreaterThan(0.8);
    expect(wide.board.width / wide.width).toBeGreaterThan(0.8);
    expect(wide.pegs.length).toBeGreaterThan(compact.pegs.length);
    expect(wide.pegs.length).toBeGreaterThanOrEqual(140);
  });

  it('staggers every peg row so no vertical lanes remain clear', () => {
    const state = createPegboardModel({ seed: 42, width: 1000, height: 700 }).getState();
    const rows = new Map<number, number[]>();
    for (const peg of state.pegs) {
      const rowKey = Math.round(peg.y);
      rows.set(rowKey, [...(rows.get(rowKey) ?? []), peg.x]);
    }
    const sortedRows = [...rows.values()].map((row) => row.sort((a, b) => a - b));

    expect(sortedRows.length).toBeGreaterThanOrEqual(8);
    for (let row = 1; row < sortedRows.length; row += 1) {
      const previous = sortedRows[row - 1];
      const current = sortedRows[row];
      const minNearestColumnDelta = Math.min(
        ...current.map((x) => Math.min(...previous.map((previousX) => Math.abs(previousX - x)))),
      );
      expect(minNearestColumnDelta).toBeGreaterThan(20);
    }
  });

  it('drops balls directly under the requested input x without seeded jitter', () => {
    const model = createPegboardModel({ seed: 7, width: 800, height: 600 });

    const ball = model.dropBall(0.2);
    const state = model.getState();

    expect(state.phase).toBe('play');
    expect(ball.x).toBeCloseTo(160, 6);
    expect(state.activeBalls).toHaveLength(1);
    expect(state.dropsRemaining).toBe(state.settings.maxDrops - 1);
  });

  it('lets balls fall into open bucket boxes before scoring', () => {
    const model = createPegboardModel({ seed: 17, width: 800, height: 600, maxDrops: 1, gravity: 900, bounce: 0.2 });
    model.dropBall(0.5);

    let lastActive = model.getState().activeBalls[0];
    for (let i = 0; i < 1200 && model.getState().activeBalls.length > 0; i += 1) {
      lastActive = model.getState().activeBalls[0];
      model.step(1 / 240);
    }

    const scored = model.getState();
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.activeBalls).toHaveLength(0);
    expect(lastActive.y - lastActive.radius).toBeGreaterThanOrEqual(scored.board.bottom);
    expect(lastActive.y + lastActive.radius).toBeLessThanOrEqual(scored.board.bottom + scored.bucketHeight);
  });

  it('scores resolved balls into fixed-value bins with combo bonuses and produces visual events', () => {
    const model = createPegboardModel({ seed: 9, width: 800, height: 600 });
    const ball = model.dropBall(0.5);

    const scored = model.resolveBall(ball.id, 'bin-3');
    const state = model.getState();

    expect(scored).toMatchObject({ points: 100, totalScore: 100, combo: 1 });
    expect(state.score).toBe(100);
    expect(state.combo).toBe(1);
    expect(binScore(state, 'bin-3')).toBe(100);
    expect(state.activeBalls).toHaveLength(0);
    expect(model.drainEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'score', points: 100, binId: 'bin-3' }),
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
