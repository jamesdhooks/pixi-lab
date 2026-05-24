/**
 * packages/core/src/physics/Bodies.ts
 *
 * Factory functions for common physics bodies.
 * Returns planck bodies pre-configured with:
 * - correct BodyUserData
 * - collision categories/masks
 * - restitution / friction defaults
 */
import * as planck from 'planck';
import { nanoid } from '../utils/nanoid';
import { Categories, Masks } from './Categories';
import type { BodyUserData, BodyHandle, PixiDisplayObject } from '../types';
import type { PhysicsWorld } from './World';

// planck uses a scale factor: 1 planck unit = SCALE px
export const PHYSICS_SCALE = 0.01; // 1 game-pixel = 0.01 planck units
export const PX_TO_M = PHYSICS_SCALE;
export const M_TO_PX = 1 / PHYSICS_SCALE;

function makeHandle(body: planck.Body, userData: BodyUserData): BodyHandle {
  body.setUserData(userData);
  return {
    id: userData.id,
    body,
    userData,
    pooled: false,
    sync(sprite: PixiDisplayObject) {
      const pos = body.getPosition();
      sprite.x = pos.x * M_TO_PX;
      sprite.y = pos.y * M_TO_PX;
      sprite.rotation = body.getAngle();
    },
  };
}

export interface CircleBodyOptions {
  x: number; // pixels
  y: number;
  radius: number; // pixels
  dynamic?: boolean;
  restitution?: number;
  friction?: number;
  density?: number;
  isSensor?: boolean;
  userData?: Partial<BodyUserData>;
}

export function createCircleBody(world: PhysicsWorld, opts: CircleBodyOptions): BodyHandle {
  const body = world.world.createBody({
    type: opts.dynamic === false ? 'static' : 'dynamic',
    position: planck.Vec2(opts.x * PX_TO_M, opts.y * PX_TO_M),
    allowSleep: true,
    awake: true,
  });

  body.createFixture({
    shape: planck.Circle(opts.radius * PX_TO_M),
    density: opts.density ?? 1,
    friction: opts.friction ?? 0.1,
    restitution: opts.restitution ?? 0.5,
    isSensor: opts.isSensor ?? false,
    filterCategoryBits: opts.isSensor ? Categories.SENSOR : Categories.BALL,
    filterMaskBits: opts.isSensor ? Masks.SENSOR : Masks.BALL,
  });

  const userData: BodyUserData = {
    id: nanoid(),
    kind: opts.isSensor ? 'sensor' : 'ball',
    isSensor: opts.isSensor,
    ...opts.userData,
  };

  return makeHandle(body, userData);
}

export interface BoxBodyOptions {
  x: number; // pixels — center
  y: number;
  width: number; // pixels
  height: number;
  dynamic?: boolean;
  angle?: number;
  restitution?: number;
  friction?: number;
  density?: number;
  isSensor?: boolean;
  userData?: Partial<BodyUserData>;
}

export function createBoxBody(world: PhysicsWorld, opts: BoxBodyOptions): BodyHandle {
  const body = world.world.createBody({
    type: opts.dynamic === false ? 'static' : 'dynamic',
    position: planck.Vec2(opts.x * PX_TO_M, opts.y * PX_TO_M),
    angle: opts.angle ?? 0,
    allowSleep: true,
  });

  body.createFixture({
    shape: planck.Box((opts.width / 2) * PX_TO_M, (opts.height / 2) * PX_TO_M),
    density: opts.density ?? 1,
    friction: opts.friction ?? 0.3,
    restitution: opts.restitution ?? 0.2,
    isSensor: opts.isSensor ?? false,
    filterCategoryBits: opts.isSensor ? Categories.SENSOR : Categories.WALL,
    filterMaskBits: opts.isSensor ? Masks.SENSOR : Masks.WALL,
  });

  const userData: BodyUserData = {
    id: nanoid(),
    kind: opts.isSensor ? 'sensor' : 'wall',
    isSensor: opts.isSensor,
    ...opts.userData,
  };

  return makeHandle(body, userData);
}

export interface EdgeWallOptions {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  restitution?: number;
  friction?: number;
  userData?: Partial<BodyUserData>;
}

export function createEdgeWall(world: PhysicsWorld, opts: EdgeWallOptions): BodyHandle {
  const body = world.world.createBody({
    type: 'static',
    position: planck.Vec2(0, 0),
  });

  body.createFixture({
    shape: planck.Edge(
      planck.Vec2(opts.x1 * PX_TO_M, opts.y1 * PX_TO_M),
      planck.Vec2(opts.x2 * PX_TO_M, opts.y2 * PX_TO_M),
    ),
    friction: opts.friction ?? 0.1,
    restitution: opts.restitution ?? 0.7,
    filterCategoryBits: Categories.WALL,
    filterMaskBits: Masks.WALL,
  });

  const userData: BodyUserData = {
    id: nanoid(),
    kind: 'wall',
    ...opts.userData,
  };

  return makeHandle(body, userData);
}

/** Create 4 static edge walls that form a rectangle boundary */
export function createBoundaryWalls(
  world: PhysicsWorld,
  width: number,
  height: number,
  opts?: { restitution?: number; friction?: number },
): BodyHandle[] {
  return [
    // Top
    createEdgeWall(world, { x1: 0, y1: 0, x2: width, y2: 0, ...opts }),
    // Bottom
    createEdgeWall(world, { x1: 0, y1: height, x2: width, y2: height, ...opts }),
    // Left
    createEdgeWall(world, { x1: 0, y1: 0, x2: 0, y2: height, ...opts }),
    // Right
    createEdgeWall(world, { x1: width, y1: 0, x2: width, y2: height, ...opts }),
  ];
}

export function destroyBody(world: PhysicsWorld, handle: BodyHandle) {
  if (handle.pooled) return;
  world.world.destroyBody(handle.body as planck.Body);
  handle.pooled = true;
}
