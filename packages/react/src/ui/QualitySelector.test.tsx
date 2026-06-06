import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { EngineConfigurationSelector, QualitySelector } from './QualitySelector.js';

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
    expect(selects[0].props['aria-label']).toBe('Engine configuration');
    expect(selects[0].props.title).toBe('Engine configuration');
    expect(options.map((option) => option.props.value)).toEqual(['basic', 'enhanced']);
    expect(options.map((option) => option.props.children)).toEqual([
      'PixiJS / Standard · Basic',
      'PixiJS / High · Enhanced',
    ]);
  });

  it('includes raw mode as a selectable WebGL2 engine configuration when supported', () => {
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
});


  it('keeps the legacy QualitySelector export as a compatibility alias', () => {
    expect(QualitySelector).toBe(EngineConfigurationSelector);
  });
