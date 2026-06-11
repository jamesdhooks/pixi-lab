import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DomScriptScene } from '../sim/DomScriptScene.js';
import { RawWebGL2Scene, colorNumberToRgb, finiteNumberSetting } from '../render/raw/RawWebGL2Scene.js';

const rawSceneSource = readFileSync(join(process.cwd(), 'packages/core/src/render/raw/RawWebGL2Scene.ts'), 'utf8');

const passthroughVertex = `#version 300 es
precision highp float;
void main() {
  gl_Position = vec4(0.0);
}`;

const passthroughFragment = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0);
}`;

describe('RawWebGL2Scene', () => {
  it('is a reusable DOM scene adapter rather than a simulation-specific scene', () => {
    const scene = new RawWebGL2Scene({
      name: 'ReusableRawScene',
      markup: '<canvas data-raw></canvas>',
      canvasSelector: 'canvas[data-raw]',
      sources: { vertex: passthroughVertex, fragment: passthroughFragment },
      render: () => undefined,
    });

    expect(scene).toBeInstanceOf(DomScriptScene);
    expect(scene.name).toBe('ReusableRawScene');
  });

  it('cleans allocated raw WebGL2 resources if scene initialization throws', () => {
    expect(rawSceneSource).toContain('try {\n    options.onInit?.(state);');
    expect(rawSceneSource).toContain('resources.destroy();\n    if (vao) gl.deleteVertexArray(vao);\n    if (program) gl.deleteProgram(program);\n    throw error;');
  });

  it('converts numeric style colors into normalized RGB uniforms', () => {
    expect(colorNumberToRgb(0xff8040, [0, 0, 0])).toEqual([1, 128 / 255, 64 / 255]);
    expect(colorNumberToRgb(undefined, [0.1, 0.2, 0.3])).toEqual([0.1, 0.2, 0.3]);
  });

  it('reads finite numeric settings and ignores invalid values', () => {
    const settings = {
      density: 1.25,
      badNumber: Number.NaN,
      stringValue: '2',
    };

    expect(finiteNumberSetting(settings, 'density', 0.5)).toBe(1.25);
    expect(finiteNumberSetting(settings, 'badNumber', 0.5)).toBe(0.5);
    expect(finiteNumberSetting(settings, 'stringValue', 0.5)).toBe(0.5);
    expect(finiteNumberSetting(settings, 'missing', 0.5)).toBe(0.5);
  });
});
