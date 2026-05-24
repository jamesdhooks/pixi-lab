/**
 * packages/core/src/physics/World.ts
 *
 * Thin wrapper around planck.World with:
 * - fixed-step with configurable gravity
 * - sleeping enabled
 * - collision listener routing
 */
import * as planck from 'planck';
import type { BodyUserData } from '../types';

export type CollisionCallback = (
  dataA: BodyUserData,
  dataB: BodyUserData,
  isSensor: boolean,
) => void;

export class PhysicsWorld {
  readonly world: planck.World;
  private beginContactCbs = new Set<CollisionCallback>();
  private endContactCbs = new Set<CollisionCallback>();

  constructor(gravity: { x: number; y: number } = { x: 0, y: 20 }) {
    this.world = new planck.World({
      gravity: planck.Vec2(gravity.x, gravity.y),
      allowSleep: true,
    });

    this.world.on('begin-contact', this.onBeginContact);
    this.world.on('end-contact', this.onEndContact);
  }

  step(dt: number) {
    this.world.step(dt, 8, 3);
  }

  setGravity(x: number, y: number) {
    this.world.setGravity(planck.Vec2(x, y));
  }

  onBeginCollision(cb: CollisionCallback): () => void {
    this.beginContactCbs.add(cb);
    return () => this.beginContactCbs.delete(cb);
  }

  onEndCollision(cb: CollisionCallback): () => void {
    this.endContactCbs.add(cb);
    return () => this.endContactCbs.delete(cb);
  }

  private getBodyData(body: planck.Body): BodyUserData | null {
    const data = body.getUserData();
    if (data && typeof data === 'object') return data as BodyUserData;
    return null;
  }

  private onBeginContact = (contact: planck.Contact) => {
    if (this.beginContactCbs.size === 0) return;
    const fixA = contact.getFixtureA();
    const fixB = contact.getFixtureB();
    const dataA = this.getBodyData(fixA.getBody());
    const dataB = this.getBodyData(fixB.getBody());
    if (!dataA || !dataB) return;
    const isSensor = fixA.isSensor() || fixB.isSensor();
    for (const cb of this.beginContactCbs) {
      cb(dataA, dataB, isSensor);
    }
  };

  private onEndContact = (contact: planck.Contact) => {
    if (this.endContactCbs.size === 0) return;
    const fixA = contact.getFixtureA();
    const fixB = contact.getFixtureB();
    const dataA = this.getBodyData(fixA.getBody());
    const dataB = this.getBodyData(fixB.getBody());
    if (!dataA || !dataB) return;
    const isSensor = fixA.isSensor() || fixB.isSensor();
    for (const cb of this.endContactCbs) {
      cb(dataA, dataB, isSensor);
    }
  };

  destroy() {
    this.beginContactCbs.clear();
    this.endContactCbs.clear();
  }
}
