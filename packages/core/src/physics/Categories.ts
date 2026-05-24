/**
 * packages/core/src/physics/Categories.ts
 *
 * Collision category bitmasks for planck.js.
 * Using categories reduces physics broadphase checks significantly.
 */

export const Categories = {
  NONE: 0x0000,
  BALL: 0x0001,
  WALL: 0x0002,
  SENSOR: 0x0004,
  BUMPER: 0x0008,
  PLAYER: 0x0010,
  HAZARD: 0x0020,
  CUSTOM: 0x0040,
} as const;

export type CategoryKey = keyof typeof Categories;

/** Pre-built masks for common collision groups */
export const Masks = {
  /** Balls collide with walls, bumpers, other balls */
  BALL: Categories.WALL | Categories.BUMPER | Categories.BALL | Categories.PLAYER,
  /** Walls collide with balls and player */
  WALL: Categories.BALL | Categories.PLAYER,
  /** Sensors detect balls but don't physically stop them */
  SENSOR: Categories.BALL,
  /** Bumpers collide with balls */
  BUMPER: Categories.BALL,
  /** Player collides with everything */
  PLAYER: Categories.BALL | Categories.WALL | Categories.BUMPER | Categories.HAZARD,
} as const;
