import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOverModal } from './GameOverModal.js';

describe('GameOverModal', () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = null;
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container.remove();
  });

  it('uses round-complete copy instead of game-over loss language and larger primary actions', () => {
    root = createRoot(container);

    act(() => {
      root?.render(
        <GameOverModal
          score={1234}
          suggestions={['Neo']}
          topScores={[]}
          onSubmit={vi.fn()}
          onRestart={vi.fn()}
          onQuit={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Round Complete');
    expect(container.textContent).not.toContain('Game Over');
    expect(container.querySelector('[data-result-panel]')?.className).toContain('max-w-2xl');
    expect(container.querySelector('[data-play-again-button]')?.className).toContain('text-lg');
    expect(container.querySelector('[data-quit-button]')?.className).toContain('text-lg');
    const backdrop = container.querySelector('[data-result-backdrop]');
    expect(backdrop).not.toBeNull();
    expect(backdrop?.className).not.toContain('bg-slate-950');
    expect(container.querySelector('[data-play-again-button]')?.className).not.toContain('text-slate-950');
    expect(container.querySelector('[data-play-again-button]')?.className).toContain('text-white');
  });

  it('opens an on-screen keyboard when the name input receives focus', () => {
    root = createRoot(container);

    act(() => {
      root?.render(
        <GameOverModal
          score={1234}
          suggestions={['Neo']}
          topScores={[]}
          onSubmit={vi.fn()}
          onRestart={vi.fn()}
          onQuit={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[data-onscreen-keyboard]')).toBeNull();
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    act(() => {
      input?.focus();
    });

    expect(container.querySelector('[data-onscreen-keyboard]')).not.toBeNull();
  });
});
