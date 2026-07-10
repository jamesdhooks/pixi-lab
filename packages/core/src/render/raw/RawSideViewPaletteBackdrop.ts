import type { DomStylePayload } from '../../sim/DomScriptScene.js';
import { linkRawWebGL2Program } from './RawWebGL2ResourceContext.js';

export type SideViewBackdropStyle = 'basic' | 'enhanced' | 'ultra';

export interface SideViewPaletteBackdrop {
  base: [number, number, number];
  primary: [number, number, number];
  secondary: [number, number, number];
  accent: [number, number, number];
}

export interface RawSideViewPaletteBackdropOptions {
  width: number;
  height: number;
  style: DomStylePayload | null | undefined;
  renderStyle: SideViewBackdropStyle;
  fallbackBackground: [number, number, number];
  target?: WebGLFramebuffer | null;
}

const BACKDROP_VERTEX = `#version 300 es
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;

const BACKDROP_FRAGMENT = `#version 300 es
precision highp float;

uniform vec3 uBase;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;
uniform float uTier;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uViewport;
  float vertical = smoothstep(0.0, 1.0, uv.y);
  float horizon = exp(-pow((uv.y - 0.44) * 4.3, 2.0));
  float vignette = 1.0 - smoothstep(0.28, 0.9, length((uv - 0.5) * vec2(1.22, 1.0))) * 0.42;
  float shimmer = sin((uv.x * 4.6 + uv.y * 2.1) * 3.14159) * 0.5 + 0.5;
  vec3 field = mix(uBase * 0.72 + uPrimary * 0.08, uBase * 0.88 + uSecondary * 0.09, vertical);
  field += uAccent * horizon * mix(0.035, 0.1, uTier);
  field += uPrimary * shimmer * horizon * mix(0.012, 0.04, uTier);
  outColor = vec4(field * vignette, 1.0);
}`;

const BACKDROP_FRAGMENT_SOURCE = BACKDROP_FRAGMENT.replace(
  'uniform float uTier;',
  'uniform float uTier;\nuniform vec2 uViewport;',
);

const renderers = new WeakMap<WebGL2RenderingContext, RawSideViewPaletteBackdropRenderer>();

export function resolveSideViewPaletteBackdrop(
  style: DomStylePayload | null | undefined,
  renderStyle: SideViewBackdropStyle,
  fallbackBackground: [number, number, number],
): SideViewPaletteBackdrop {
  const base = colorToRgb(style?.background, fallbackBackground);
  const palette = style?.palette ?? [];
  const primary = colorToRgb(palette[0], base);
  const secondary = colorToRgb(palette[1] ?? palette[2], primary);
  const accent = colorToRgb(palette[3] ?? palette[2] ?? palette[1], secondary);
  if (renderStyle === 'basic') return { base, primary, secondary, accent };

  const strength = renderStyle === 'ultra' ? 0.18 : 0.12;
  return {
    base: mixRgb(base, mixRgb(primary, secondary, 0.45), strength),
    primary,
    secondary,
    accent,
  };
}

export function renderSideViewPaletteBackdrop(
  gl: WebGL2RenderingContext,
  options: RawSideViewPaletteBackdropOptions,
): void {
  let renderer = renderers.get(gl);
  if (!renderer) {
    renderer = new RawSideViewPaletteBackdropRenderer(gl);
    renderers.set(gl, renderer);
  }
  renderer.render(options);
}

class RawSideViewPaletteBackdropRenderer {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = linkRawWebGL2Program(gl, { vertex: BACKDROP_VERTEX, fragment: BACKDROP_FRAGMENT_SOURCE });
    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(this.program);
      throw new Error('Unable to allocate side-view palette backdrop renderer');
    }
    this.vao = vao;
  }

  render(options: RawSideViewPaletteBackdropOptions): void {
    const { gl } = this;
    const backdrop = resolveSideViewPaletteBackdrop(options.style, options.renderStyle, options.fallbackBackground);
    gl.bindFramebuffer(gl.FRAMEBUFFER, options.target ?? null);
    gl.viewport(0, 0, options.width, options.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(gl.getUniformLocation(this.program, 'uViewport'), options.width, options.height);
    gl.uniform3fv(gl.getUniformLocation(this.program, 'uBase'), backdrop.base);
    gl.uniform3fv(gl.getUniformLocation(this.program, 'uPrimary'), backdrop.primary);
    gl.uniform3fv(gl.getUniformLocation(this.program, 'uSecondary'), backdrop.secondary);
    gl.uniform3fv(gl.getUniformLocation(this.program, 'uAccent'), backdrop.accent);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uTier'), options.renderStyle === 'ultra' ? 1 : options.renderStyle === 'enhanced' ? 0.55 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
}

function colorToRgb(color: number | undefined, fallback: [number, number, number]): [number, number, number] {
  if (typeof color !== 'number') return fallback;
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}

function mixRgb(from: [number, number, number], to: [number, number, number], amount: number): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}
