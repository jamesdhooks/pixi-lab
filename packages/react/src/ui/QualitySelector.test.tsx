import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { QualitySelector } from './QualitySelector.js';

function isReactElement(value: ReactNode): value is ReactElement<{ children?: ReactNode }> {
  return typeof value === 'object' && value !== null && 'props' in value;
}

function collectButtons(node: ReactNode): ReactElement<{ title?: string; children?: ReactNode }>[] {
  if (Array.isArray(node)) {
    return node.flatMap((child) => collectButtons(child));
  }

  if (!isReactElement(node)) {
    return [];
  }

  if (node.type === 'button') {
    return [node as ReactElement<{ title?: string; children?: ReactNode }>];
  }

  return collectButtons(node.props.children);
}

describe('QualitySelector', () => {
  it('renders shared Pixi-safe default profiles when capabilities omit quality modes', () => {
    const element = QualitySelector({
      value: 'basic',
      onChange: () => undefined,
    });

    const buttons = collectButtons(element);

    expect(buttons.map((button) => button.props.children)).toEqual(['Basic', 'Enhanced']);
    expect(buttons.map((button) => button.props.title)).toEqual([
      'Basic: pixi / standard',
      'Enhanced: pixi / high',
    ]);
  });
});
