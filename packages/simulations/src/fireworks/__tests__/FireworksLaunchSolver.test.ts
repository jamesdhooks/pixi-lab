import { describe, expect, it } from 'vitest';
import { solveFireworkLaunchForTarget } from '../RawFireworksScene.js';

function positionAtFuse(solution: ReturnType<typeof solveFireworkLaunchForTarget>, gravity: number): { x: number; y: number } {
  return {
    x: solution.launchX + solution.vx * solution.fuse,
    y: solution.launchY + solution.vy * solution.fuse + 0.5 * gravity * solution.fuse * solution.fuse,
  };
}

describe('solveFireworkLaunchForTarget', () => {
  it('solves shell velocity so the burst lands exactly on the target', () => {
    const gravity = 360;
    const targets = [
      { x: 120, y: 96, offsetRandom: -0.8, fuseRandom: 0.1 },
      { x: 512, y: 260, offsetRandom: 0, fuseRandom: 0.5 },
      { x: 920, y: 620, offsetRandom: 0.9, fuseRandom: 0.95 },
    ];

    for (const target of targets) {
      const solution = solveFireworkLaunchForTarget({
        width: 1024,
        height: 768,
        targetX: target.x,
        targetY: target.y,
        launchPower: 940,
        launchSpread: 0.36,
        shellFuse: 1.28,
        gravity,
        offsetRandom: target.offsetRandom,
        fuseRandom: target.fuseRandom,
      });
      const resolved = positionAtFuse(solution, gravity);

      expect(solution.launchY).toBeGreaterThan(solution.targetY);
      expect(resolved.x).toBeCloseTo(solution.targetX, 6);
      expect(resolved.y).toBeCloseTo(solution.targetY, 6);
    }
  });

  it('uses higher launch power to shorten the solved fuse while preserving the target', () => {
    const common = {
      width: 1280,
      height: 720,
      targetX: 680,
      targetY: 210,
      launchSpread: 0.24,
      shellFuse: 1.4,
      gravity: 380,
      offsetRandom: 0.35,
      fuseRandom: 0.42,
    };
    const lowerPower = solveFireworkLaunchForTarget({ ...common, launchPower: 620 });
    const higherPower = solveFireworkLaunchForTarget({ ...common, launchPower: 1360 });
    const higherResolved = positionAtFuse(higherPower, common.gravity);

    expect(higherPower.fuse).toBeLessThan(lowerPower.fuse);
    expect(higherResolved.x).toBeCloseTo(common.targetX, 6);
    expect(higherResolved.y).toBeCloseTo(common.targetY, 6);
  });
});
