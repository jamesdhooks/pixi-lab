import type { GestureEvent } from '@hooksjam/pixi-lab-core';
import { sampleStraightBuildFixture, type BuildFixtureSamples, type BuildPoint } from './build-fixtures.js';

export type { BuildFixtureSamples, BuildPoint } from './build-fixtures.js';

export const BUILD_MODE_ID = 'build';
export const BUILD_MODE_LABEL = 'Build';
export const BUILD_MODE_ICON = '#';
export const BUILD_MODE_DESCRIPTION = 'Click for fixed pegs or drag a straight fixed obstacle line.';
export const BUILD_OBSTACLE_MESH_COLOR = [0.5, 0.52, 0.56] as const;
export const BUILD_OBSTACLE_POINT_COLOR = [0.54, 0.56, 0.6] as const;
export const BUILD_OBSTACLE_PREVIEW_COLOR = [0.62, 0.68, 0.74] as const;
export const BUILD_OBSTACLE_MESH_COLOR_GLSL = glslVec3(BUILD_OBSTACLE_MESH_COLOR);
export const BUILD_OBSTACLE_POINT_COLOR_GLSL = glslVec3(BUILD_OBSTACLE_POINT_COLOR);
export const BUILD_OBSTACLE_PREVIEW_COLOR_GLSL = glslVec3(BUILD_OBSTACLE_PREVIEW_COLOR);

export function buildModeDefinition(description = BUILD_MODE_DESCRIPTION): { id: typeof BUILD_MODE_ID; label: typeof BUILD_MODE_LABEL; icon: typeof BUILD_MODE_ICON; description: string } {
  return {
    id: BUILD_MODE_ID,
    label: BUILD_MODE_LABEL,
    icon: BUILD_MODE_ICON,
    description,
  };
}

export interface BuildPathControllerOptions {
  minPointDistance?: number;
  spacingScale?: number;
  clickDistanceScale?: number;
}

export function sampleBuildFixture(points: BuildPoint[], radius: number, options: Omit<BuildPathControllerOptions, 'minPointDistance'> = {}): BuildFixtureSamples | null {
  return sampleStraightBuildFixture(points, radius, options.spacingScale ?? 1.45, options.clickDistanceScale ?? 1.5);
}

export function pushBuildCapsuleTriangles(data: number[], start: BuildPoint, end: BuildPoint, radius: number, segments = 18): void {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;
  const ax0 = start.x + nx * radius;
  const ay0 = start.y + ny * radius;
  const ax1 = start.x - nx * radius;
  const ay1 = start.y - ny * radius;
  const bx0 = end.x + nx * radius;
  const by0 = end.y + ny * radius;
  const bx1 = end.x - nx * radius;
  const by1 = end.y - ny * radius;
  pushTriangle(data, ax0, ay0, bx0, by0, bx1, by1);
  pushTriangle(data, ax0, ay0, bx1, by1, ax1, ay1);
  pushBuildDiskTriangles(data, start, radius, segments);
  pushBuildDiskTriangles(data, end, radius, segments);
}

export function pushBuildDiskTriangles(data: number[], center: BuildPoint, radius: number, segments = 18): void {
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    pushTriangle(data, center.x, center.y, center.x + Math.cos(a0) * radius, center.y + Math.sin(a0) * radius, center.x + Math.cos(a1) * radius, center.y + Math.sin(a1) * radius);
  }
}

export function pushBuildFixtureTriangles(data: number[], fixture: BuildFixtureSamples, radius: number, segments = 18): void {
  if (fixture.kind === 'line') {
    pushBuildCapsuleTriangles(data, fixture.start, fixture.end, radius, segments);
    return;
  }
  pushBuildDiskTriangles(data, fixture.start, radius, segments);
}

export class BuildPathController {
  private readonly paths = new Map<number, BuildPoint[]>();
  private readonly minPointDistance: number;
  private readonly spacingScale: number;
  private readonly clickDistanceScale: number;

  constructor(options: BuildPathControllerOptions = {}) {
    this.minPointDistance = options.minPointDistance ?? 5;
    this.spacingScale = options.spacingScale ?? 1.45;
    this.clickDistanceScale = options.clickDistanceScale ?? 1.5;
  }

  begin(pointerId: number, point: BuildPoint): void {
    this.paths.set(pointerId, [{ x: point.x, y: point.y }]);
  }

  move(pointerId: number, point: BuildPoint): void {
    const path = this.paths.get(pointerId);
    if (!path) {
      this.begin(pointerId, point);
      return;
    }
    const last = path[path.length - 1];
    if (!last || distance(last, point) >= this.minPointDistance) {
      path.push({ x: point.x, y: point.y });
    }
  }

  end(pointerId: number, point: BuildPoint, radius: number): BuildFixtureSamples | null {
    const path = this.paths.get(pointerId);
    if (!path) {
      return sampleBuildFixture([{ x: point.x, y: point.y }], radius, { spacingScale: this.spacingScale, clickDistanceScale: this.clickDistanceScale });
    }
    this.move(pointerId, point);
    this.paths.delete(pointerId);
    return sampleBuildFixture(path, radius, { spacingScale: this.spacingScale, clickDistanceScale: this.clickDistanceScale });
  }

  cancel(pointerId: number): void {
    this.paths.delete(pointerId);
  }

  reset(): void {
    this.paths.clear();
  }

  activeFixtures(radius: number): BuildFixtureSamples[] {
    const fixtures: BuildFixtureSamples[] = [];
    for (const path of this.paths.values()) {
      const fixture = sampleBuildFixture(path, radius, { spacingScale: this.spacingScale, clickDistanceScale: this.clickDistanceScale });
      if (fixture) fixtures.push(fixture);
    }
    return fixtures;
  }

  applyGesture(gesture: GestureEvent, width: number, height: number, radius: number): BuildFixtureSamples | null {
    if (gesture.kind === 'hold' || gesture.kind === 'double_tap' || gesture.kind === 'pinch' || gesture.kind === 'spread' || gesture.kind === 'fast_swipe') {
      return null;
    }

    const pointerId = gesture.id ?? -1;
    const point = clampBuildPoint(gesture, width, height);

    if (gesture.kind === 'tap') {
      this.cancel(pointerId);
      return sampleBuildFixture([point], radius, { spacingScale: this.spacingScale, clickDistanceScale: this.clickDistanceScale });
    }

    if (gesture.kind === 'drag') {
      if (!this.paths.has(pointerId)) {
        this.begin(pointerId, {
          x: clamp(point.x - (gesture.dx ?? 0), 0, width),
          y: clamp(point.y - (gesture.dy ?? 0), 0, height),
        });
      }
      this.move(pointerId, point);
      return null;
    }

    if (gesture.kind === 'release') {
      return this.end(pointerId, point, radius);
    }

    return null;
  }
}

function clampBuildPoint(point: BuildPoint, width: number, height: number): BuildPoint {
  return {
    x: clamp(point.x, 0, width),
    y: clamp(point.y, 0, height),
  };
}

function distance(a: BuildPoint, b: BuildPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pushTriangle(data: number[], ax: number, ay: number, bx: number, by: number, cx: number, cy: number): void {
  data.push(ax, ay, bx, by, cx, cy);
}

function glslVec3(color: readonly [number, number, number]): string {
  return `vec3(${color[0].toFixed(2)}, ${color[1].toFixed(2)}, ${color[2].toFixed(2)})`;
}
