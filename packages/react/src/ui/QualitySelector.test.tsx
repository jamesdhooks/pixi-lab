import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { EngineConfigurationSelector } from './EngineConfigurationSelector.js';
import { QualitySelector } from './QualitySelector.js';

function isReactElement(value: ReactNode): value is ReactElement<{ children?: ReactNode; value?: string; title?: string; 'aria-label'?: string }> {
  return typeof value === 'object' && value !== null && 'props' in value;
}

function collectByType(
  node: ReactNode,
  type: string,
): ReactElement<{ children?: ReactNode; value?: string; title?: string; 'aria-label'?: string }>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectByType(child, type));
  }

  if (!isReactElement(node)) {
    return [];
  }

  if (node.type === type) {
    return [node];
  }

  return collectByType(node.props.children, type);
}

describe('EngineConfigurationSelector', () => {
  it('renders shared Pixi-safe default profiles as engine configuration options', () => {
    const element = EngineConfigurationSelector({
      value: 'basic',
      onChange: () => undefined,
    });

    const selects = collectByType(element, 'select');
    const options = collectByType(element, 'option');

    expect(selects).toHaveLength(1);
    expect(selects[0].props['aria-label']).toBe('Style');
    expect(selects[0].props.title).toBe('Style');
    expect(options.map((option) => option.props.value)).toEqual(['basic', 'enhanced']);
    expect(options.map((option) => option.props.children)).toEqual([
      'PixiJS / Standard · Basic',
      'PixiJS / High · Enhanced',
    ]);
  });

  it('bridges legacy quality-token options through the compatibility selector', () => {
    const element = QualitySelector({
      value: 'raw',
      options: ['basic', 'enhanced', 'raw'],
      onChange: () => undefined,
    });

    const options = collectByType(element, 'option');

    expect(options.map((option) => option.props.children)).toEqual([
      'PixiJS / Standard · Basic',
      'PixiJS / High · Enhanced',
      'WebGL2 / High · Raw',
    ]);
  });

  it('uses capability-provided engine labels for fallback messaging', () => {
    const element = EngineConfigurationSelector({
      value: 'raw',
      renderedValue: 'enhanced',
      configurations: [
        { id: 'raw-path', backend: 'webgl2', profile: 'high', label: 'Orbital raw field renderer', legacyQuality: 'raw' },
        { id: 'safe-path', backend: 'pixi', profile: 'high', label: 'Orbital safe fallback', legacyQuality: 'enhanced' },
      ],
      onChange: () => undefined,
    });

    const selects = collectByType(element, 'select');
    const options = collectByType(element, 'option');

    expect(options.map((option) => option.props.children)).toEqual([
      'Orbital raw field renderer',
      'Orbital safe fallback',
    ]);
    expect(selects[0].props.title).toBe('Performance fallback to Orbital safe fallback');
  });

  it('keeps the legacy QualitySelector export as a compatibility wrapper', () => {
    const element = QualitySelector({
      value: 'basic',
      onChange: () => undefined,
    });

    const selects = collectByType(element, 'select');
    expect(selects[0].props['aria-label']).toBe('Style');
  });
});
