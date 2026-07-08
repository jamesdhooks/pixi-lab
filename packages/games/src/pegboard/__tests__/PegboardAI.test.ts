import { describe, expect, it } from 'vitest';
import { PegboardAI } from '../PegboardAI';

const ctx = { width: 240, height: 240, dt: 0, state: {} };

describe('PegboardAI', () => {
  it('periodically asks demo previews to reset before the board becomes chaotic', () => {
    const ai = new PegboardAI();
    const intents = ai.think({ ...ctx, dt: 8.1 });

    expect(intents.some((intent) => intent.meta?.resetScene === true)).toBe(true);
  });
});
