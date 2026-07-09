export interface BuildPoint {
  x: number;
  y: number;
}

export interface BuildFixtureSamples {
  kind: 'point' | 'line';
  start: BuildPoint;
  end: BuildPoint;
  samples: BuildPoint[];
}

export function distanceBetweenBuildPoints(a: BuildPoint, b: BuildPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function sampleStraightBuildFixture(points: BuildPoint[], radius: number, spacingScale = 1.55, clickDistanceScale = 1.5): BuildFixtureSamples | null {
  if (points.length === 0) return null;
  const start = points[0];
  const end = points[points.length - 1];
  const distance = distanceBetweenBuildPoints(start, end);
  if (points.length < 3 || distance < radius * clickDistanceScale) {
    return { kind: 'point', start, end: start, samples: [{ x: start.x, y: start.y }] };
  }
  return {
    kind: 'line',
    start,
    end,
    samples: sampleOpenPathByDistance([start, end], radius * spacingScale),
  };
}

export function sampleOpenPathByDistance(points: BuildPoint[], spacing: number): BuildPoint[] {
  if (points.length < 2) return points.map((point) => ({ x: point.x, y: point.y }));
  const samples: BuildPoint[] = [{ x: points[0].x, y: points[0].y }];
  let distanceSinceSample = 0;
  let cursor = { x: points[0].x, y: points[0].y };
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const target = points[pointIndex];
    let dx = target.x - cursor.x;
    let dy = target.y - cursor.y;
    let segmentLength = Math.hypot(dx, dy);
    while (distanceSinceSample + segmentLength >= spacing && segmentLength > 0.0001) {
      const remaining = spacing - distanceSinceSample;
      const t = remaining / segmentLength;
      cursor = { x: cursor.x + dx * t, y: cursor.y + dy * t };
      samples.push({ x: cursor.x, y: cursor.y });
      distanceSinceSample = 0;
      dx = target.x - cursor.x;
      dy = target.y - cursor.y;
      segmentLength = Math.hypot(dx, dy);
    }
    distanceSinceSample += segmentLength;
    cursor = { x: target.x, y: target.y };
  }
  const last = samples[samples.length - 1];
  const final = points[points.length - 1];
  const finalDx = final.x - last.x;
  const finalDy = final.y - last.y;
  if (finalDx * finalDx + finalDy * finalDy > spacing * spacing * 0.2025) samples.push({ x: final.x, y: final.y });
  return samples;
}
