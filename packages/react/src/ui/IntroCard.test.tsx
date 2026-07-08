import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { IntroCard } from './IntroCard.js';

describe('IntroCard', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = null;
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container.remove();
    consoleErrorSpy.mockRestore();
  });

  it('renders attribution links with author and license details', () => {
    const markup = renderToStaticMarkup(
      <IntroCard
        icon="*"
        name="Lava Lamp"
        short="Thermal metaball wax blobs rise, cool, fall, and clump."
        attributions={[
          {
            label: 'WebGL Lava Lamp',
            href: 'https://github.com/brybrant/lava-lamp',
            author: 'Matt Bryant',
            license: 'GPL-3.0',
          },
          {
            label: 'Raymarch lava lamp shader',
            href: 'https://www.shadertoy.com/view/fsKXDm',
            author: '@Arrangemonk',
          },
        ]}
        onDismiss={() => undefined}
      />,
    );

    expect(markup).toContain('Attribution');
    expect(markup).toContain('href="https://github.com/brybrant/lava-lamp"');
    expect(markup).toContain('WebGL Lava Lamp by Matt Bryant (GPL-3.0)');
    expect(markup).toContain('href="https://www.shadertoy.com/view/fsKXDm"');
    expect(markup).toContain('Raymarch lava lamp shader by @Arrangemonk');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it('dismisses on the first global user interaction, not only card clicks', () => {
    const onDismiss = vi.fn();
    root = createRoot(container);

    act(() => {
      root?.render(<IntroCard icon="*" name="Pegboard" short="Drop balls." autoDismiss={false} onDismiss={onDismiss} />);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerdown'));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
