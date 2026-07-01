export class Container {
  children: unknown[] = [];
  alpha = 1;
  visible = true;
  x = 0;
  y = 0;
  scale = { x: 1, y: 1, set: (value: number) => { this.scale.x = value; this.scale.y = value; } };
  position = { x: 0, y: 0, set: (x: number, y = x) => { this.position.x = x; this.position.y = y; } };
  addChild<T>(child: T): T {
    this.children.push(child);
    return child;
  }
  removeChildren(): unknown[] {
    const removed = this.children;
    this.children = [];
    return removed;
  }
  destroy(): void {
    this.children = [];
  }
}

export class Graphics extends Container {
  clear(): this { return this; }
  circle(): this { return this; }
  rect(): this { return this; }
  moveTo(): this { return this; }
  lineTo(): this { return this; }
  stroke(): this { return this; }
  fill(): this { return this; }
}

export class Text extends Container {
  constructor(public text = '', public style: unknown = undefined) { super(); }
}

export class Sprite extends Container {
  anchor = { x: 0, y: 0, set: (value: number) => { this.anchor.x = value; this.anchor.y = value; } };
  tint = 0xffffff;
  width = 0;
  height = 0;
  constructor(public texture: unknown = Texture.WHITE) { super(); }
}

export class Particle extends Sprite {}
export class ParticleContainer extends Container {}

export class Texture {
  static WHITE = new Texture();
  destroy(): void {}
}

export class RenderTexture extends Texture {
  static create(): RenderTexture { return new RenderTexture(); }
}

export class CanvasSource {
  constructor(public options: unknown = {}) {}
}

export class Application {
  stage = new Container();
  canvas = document.createElement('canvas');
  renderer = { width: 800, height: 600, render: () => undefined };
  ticker = { add: () => undefined, remove: () => undefined };
  async init(): Promise<void> {}
  destroy(): void {}
}

export class Buffer {
  constructor(public options: unknown = {}) {}
  update(): void {}
  destroy(): void {}
}

export const BufferUsage = {
  VERTEX: 1,
  INDEX: 2,
  UNIFORM: 4,
  COPY_DST: 8,
} as const;

export class Mesh extends Container {
  constructor(public options: unknown = {}) { super(); }
}

export class MeshGeometry {
  constructor(public options: unknown = {}) {}
  destroy(): void {}
}

export class Shader {
  static from(options: unknown): Shader { return new Shader(options); }
  constructor(public options: unknown = {}) {}
  destroy(): void {}
}
