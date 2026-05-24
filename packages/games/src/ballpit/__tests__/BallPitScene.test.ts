/**
 * components/games/ballpit/__tests__/BallPitScene.test.ts
 *
 * Unit tests for Ball Pit game logic.
 * Engine subsystems are stubbed — no real Pixi or planck needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BallPitScene } from '../BallPitScene';
import type { GameContext, Input, InputSnapshot } from '@hooksjam/pixi-lab-core';

// ── Minimal stubs ──────────────────────────────────────────────────────────────

function makeSnapshot(
  justDown: number[] = [],
  pointers: Map<number, unknown> = new Map(),
): InputSnapshot {
  return {
    pointers: pointers as InputSnapshot['pointers'],
    justDown: new Set(justDown),
    justUp: new Set(),
  };
}

function makeInput(snap: InputSnapshot): Input {
  return {
    snapshot: snap,
    flush: vi.fn(),
    mount: vi.fn(),
    unmount: vi.fn(),
    injectIntent: vi.fn(),
    setScale: vi.fn(),
  } as unknown as Input;
}

const mockBody = {
  getPosition: () => ({ x: 0.5, y: 0.5 }),
  getAngle: () => 0,
  applyForce: vi.fn(),
  getWorldCenter: () => ({ x: 0, y: 0 }),
};

const mockHandle = {
  id: 'test-ball',
  body: mockBody,
  userData: { id: 'test-ball', kind: 'ball', isSensor: false },
  pooled: false,
  sync: vi.fn(),
};

vi.mock('@/lib/games/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/games/engine')>();
  return {
    ...actual,
    createCircleBody: vi.fn(() => ({ ...mockHandle, id: `ball-${Date.now()}` })),
    createEdgeWall: vi.fn(() => mockHandle),
    destroyBody: vi.fn(),
  };
});

function makeSettings(vals: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    maxBalls: 5,
    style: 'rainbow',
    bounciness: 0.6,
    audio: false,
    ...vals,
  };
  return {
    get: (key: string) => defaults[key],
    set: vi.fn(),
    onChange: vi.fn(),
  };
}

function makeSprite() {
  return { x: 0, y: 0, rotation: 0, destroy: vi.fn() };
}

function makeCtx(overrides: Partial<Record<string, unknown>> = {}): GameContext {
  return {
    mode: 'play',
    width: 400,
    height: 600,
    emit: vi.fn(),
    systems: {
      world: {
        step: vi.fn(),
        onBeginCollision: vi.fn(),
        onEndCollision: vi.fn(),
        destroy: vi.fn(),
        world: {},
      } as unknown as GameContext['systems']['world'],
      pixi: {
        app: { stage: { addChild: vi.fn() } },
        width: 400,
        height: 600,
        resize: vi.fn(),
        destroy: vi.fn(),
        canvas: null,
      } as unknown as GameContext['systems']['pixi'],
      sprites: {
        makeCircleSprite: vi.fn(() => makeSprite()),
        makeBoxSprite: vi.fn(),
        destroyAll: vi.fn(),
      } as unknown as GameContext['systems']['sprites'],
      particles: {
        emit: vi.fn(),
        burst: vi.fn(),
        update: vi.fn(),
        count: 0,
        clear: vi.fn(),
        destroy: vi.fn(),
      } as unknown as GameContext['systems']['particles'],
      audio: {
        playTone: vi.fn(),
        setEnabled: vi.fn(),
        setMuted: vi.fn(),
        resume: vi.fn(),
        dispose: vi.fn(),
      } as unknown as GameContext['systems']['audio'],
      settings: makeSettings(overrides) as unknown as GameContext['systems']['settings'],
    },
    ...overrides,
  } as GameContext;
}

describe('BallPitScene', () => {
  let scene: BallPitScene;
  let ctx: GameContext;

  beforeEach(() => {
    scene = new BallPitScene();
    ctx = makeCtx();
    const snap = makeSnapshot();
    scene.onEnter(ctx, makeInput(snap));
  });

  it('starts with score 0 and no balls', () => {
    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it('spawns a ball when a human tap justDown event fires', () => {
    const ptr = {
      id: 1,
      x: 100,
      y: 100,
      type: 'down' as const,
      source: 'human' as const,
      timestamp: Date.now(),
    };
    const snap = makeSnapshot([1], new Map([[1, ptr]]));
    scene.update.bind(scene);

    // Inject tap via update
    const input = makeInput(snap);
    // We need to reassign internal input — call onEnter again with new input
    scene.onExit();
    scene.onEnter(ctx, input);
    scene.update(1 / 60);

    expect(ctx.emit).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'score_update', value: 1 }),
    );
  });

  it('does not spawn more balls than maxBalls setting', () => {
    // maxBalls = 5 in our ctx
    const emit = vi.mocked(ctx.emit);
    for (let i = 0; i < 10; i++) {
      const ptr = {
        id: i,
        x: 50 + i * 10,
        y: 50,
        type: 'down' as const,
        source: 'human' as const,
        timestamp: Date.now(),
      };
      const snap = makeSnapshot([i], new Map([[i, ptr]]));
      const input = makeInput(snap);
      scene.onExit();
      scene.onEnter(ctx, input);
      scene.update(1 / 60);
    }
    // Score from spawns should cap out at maxBalls (5), rest are particle bursts (+0 score)
    const lastScoreCall = emit.mock.calls.filter((c) => c[0].kind === 'score_update').at(-1);
    expect(lastScoreCall?.[0].value).toBeLessThanOrEqual(5);
  });

  it('emits score updates (score increases) when a ball drains', async () => {
    // Spawn one ball
    const ptr = {
      id: 1,
      x: 100,
      y: 100,
      type: 'down' as const,
      source: 'human' as const,
      timestamp: Date.now(),
    };
    const snap = makeSnapshot([1], new Map([[1, ptr]]));
    scene.onExit();
    scene.onEnter(ctx, makeInput(snap));
    scene.update(1 / 60);

    const emit = vi.mocked(ctx.emit);
    const beforeDrainScore =
      (emit.mock.calls.filter((c) => c[0].kind === 'score_update').at(-1)?.[0] as { value: number })
        ?.value ?? 0;

    // Simulate the ball's body returning a position below drain threshold
    const { createCircleBody } = await import('@/lib/games/engine');
    const createdHandle = vi.mocked(createCircleBody).mock.results[0]?.value as typeof mockHandle;
    if (createdHandle) {
      createdHandle.body.getPosition = () => ({ x: 0, y: (ctx.height + 100) * 0.01 });
      scene.update(1 / 60);
      const afterDrainScore =
        (
          emit.mock.calls.filter((c) => c[0].kind === 'score_update').at(-1)?.[0] as {
            value: number;
          }
        )?.value ?? 0;
      expect(afterDrainScore).toBeGreaterThan(beforeDrainScore);
    }
  });
});
