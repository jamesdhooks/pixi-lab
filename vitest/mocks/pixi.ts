/**
 * Minimal pixi.js stub for vitest jsdom test environments.
 *
 * pixi.js is a peerDependency of several workspace packages and is not
 * symlinked into the simulations/ambients node_modules when running tests from
 * the workspace root.  This stub lets the module graph resolve so tests that
 * exercise pure-TypeScript logic (no rendering) can import files that happen
 * to pull in pixi.js classes.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

class NoopClass {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(..._args: any[]) {}
  destroy() {}
  addChild(child: any) { return child; }
  removeChild() {}
}

export class Application extends NoopClass {
  canvas = document.createElement('canvas');
  stage = new Container();
  renderer = {};
  render() {}
  async init(_opts?: any) {}
}

export class Container extends NoopClass {
  children: any[] = [];
  zIndex = 0;
  sortableChildren = false;
  addChild(child: any) { this.children.push(child); return child; }
  removeChild(child: any) {
    this.children = this.children.filter((c) => c !== child);
    return child;
  }
  destroy() {}
}

export class Graphics extends Container {
  clear() { return this; }
  beginFill(_color?: any, _alpha?: any) { return this; }
  endFill() { return this; }
  drawRect(_x: number, _y: number, _w: number, _h: number) { return this; }
  drawCircle(_x: number, _y: number, _r: number) { return this; }
  lineStyle(_width?: any, _color?: any) { return this; }
  lineTo(_x: number, _y: number) { return this; }
  moveTo(_x: number, _y: number) { return this; }
}

export class Texture extends NoopClass {
  static from(_src: any) { return new Texture(); }
  static WHITE = new (class extends NoopClass {})();
  static EMPTY = new (class extends NoopClass {})();
}

export class RenderTexture extends Texture {
  static create(_opts?: any) { return new RenderTexture(); }
  static from(_src: any) { return new RenderTexture(); }
}

export class Sprite extends Container {
  texture = new Texture();
  anchor = { set(_x: number, _y?: number) {} };
  width = 0;
  height = 0;
  x = 0;
  y = 0;
  alpha = 1;
  static from(_src: any) { return new Sprite(); }
}

export class BlurFilter extends NoopClass {
  strength = 0;
  quality = 4;
}

export class DisplacementFilter extends NoopClass {
  scale = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
}

export class Filter extends NoopClass {}
export class ColorMatrixFilter extends NoopClass {}
export class AlphaFilter extends NoopClass {}
export class TilingSprite extends Sprite {}
export class ParticleContainer extends Container {}
export class AnimatedSprite extends Sprite {}
export class BitmapText extends Container {}
export class Text extends Container {}

export const extensions = {
  add() {},
  remove() {},
};

export const Assets = {
  load: async (_src: any) => new Texture(),
  add() {},
};
