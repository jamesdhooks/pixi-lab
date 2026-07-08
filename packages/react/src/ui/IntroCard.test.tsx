import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntroCard } from './IntroCard.js';

describe('IntroCard', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
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

  it('dismisses itself after the shared intro-card timeout', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      root.render(
        <IntroCard
          icon="~"
          name="Water Tank"
          short="Build, splash, and pour water particles."
          onDismiss={onDismiss}
        />,
      );
    });

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    host.remove();
    vi.useRealTimers();
  });

});
