import { describe, expect, it } from 'vitest';
import { PerformanceGovernor } from '../performance/PerformanceGovernor.js';

function runSustainedSlowFrames(governor: PerformanceGovernor): Array<string | null> {
  const results: Array<string | null> = [];
  for (let i = 0; i < 90; i++) {
    results.push(governor.update(1 / 20));
  }
  return results;
}

describe('PerformanceGovernor quality fallback', () => {
  it('falls back from enhanced to basic under sustained low fps', () => {
    const changes: string[] = [];
    const governor = new PerformanceGovernor({
      targetFps: 50,
      onQualityChange: (quality) => changes.push(quality),
    });

    governor.setQuality('enhanced');
    const results = runSustainedSlowFrames(governor);

    expect(results.at(-1)).toBe('basic');
    expect(governor.getQuality()).toBe('basic');
    expect(changes).toEqual(['enhanced', 'basic']);
  });

  it('keeps raw quality sticky under sustained low fps', () => {
    const changes: string[] = [];
    const governor = new PerformanceGovernor({
      targetFps: 50,
      onQualityChange: (quality) => changes.push(quality),
    });

    governor.setQuality('raw');
    const results = runSustainedSlowFrames(governor);

    expect(results.every((result) => result === null)).toBe(true);
    expect(governor.getQuality()).toBe('raw');
    expect(changes).toEqual(['raw']);
  });
});
