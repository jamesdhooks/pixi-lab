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
        name="Water Tank"
        short="Build, splash, and pour water particles."
        attributions={[
          {
            label: 'gl-water2d',
            href: 'https://github.com/Erkaman/gl-water2d',
            author: 'Eric Arnebäck',
            license: 'MIT',
          },
          {
            label: 'Splash',
            href: 'https://github.com/matsuoka-601/Splash',
            author: 'matsuoka-601',
          },
        ]}
        onDismiss={() => undefined}
      />,
    );

    expect(markup).toContain('Inspired by / adapted from');
    expect(markup).toContain('original creative choices');
    expect(markup).toContain('href="https://github.com/Erkaman/gl-water2d"');
    expect(markup).toContain('gl-water2d by Eric Arnebäck (MIT)');
    expect(markup).toContain('href="https://github.com/matsuoka-601/Splash"');
    expect(markup).toContain('Splash by matsuoka-601');
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
