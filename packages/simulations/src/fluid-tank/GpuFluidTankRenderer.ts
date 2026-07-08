import {
  SeededRng,
  createRawGpuDoubleTarget,
  createRawGpuTarget,
  linkRawWebGL2Program,
  type RawGpuDoubleTarget,
  type RawGpuTarget,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

export interface GpuFluidTankOptions {
  cellSize: number;
  fingerForce: number;
  fingerRadius: number;
  viscosity: number;
  curl: number;
  eddyAssist: number;
  dyePersistence: number;
  velocityPersistence: number;
  injectAmount: number;
  injectTurbulence: number;
  pressureIterations: number;
  exposure: number;
  palette: readonly number[];
  paletteStrength: number;
  edgeDarkening: number;
  shadingStrength: number;
  bloomStrength: number;
  bloomThreshold: number;
  sunraysStrength: number;
  visualPipeline: 'standard' | 'reference';
  ambient: boolean;
  injectColorMode: 'style' | 'cyan' | 'magenta' | 'amber' | 'green' | 'blue' | 'red' | 'white' | 'rainbow';
  seed: number;
  displayMode?: 'dye' | 'velocity' | 'curl' | 'divergence' | 'pressure';
  initMode?: 'cloud' | 'voronoi' | 'random' | 'image' | 'blank';
  initImageUrl?: string;
}

export interface FluidSplat {
  x: number;
  y: number;
  dx: number;
  dy: number;
  radiusScale?: number;
}

export interface GpuFluidTankStats {
  supported: boolean;
  simulation: string;
  rendering: string;
  gpuSimulated: boolean;
  gpuRendered: boolean;
  cpuTopology: boolean;
  cpuUpload: boolean;
  simWidth: number;
  simHeight: number;
  dyeWidth: number;
  dyeHeight: number;
  gpuTargetTextures: number;
  gpuTargetTexels: number;
  gpuPassesPerFrame: number;
  postProcessPasses: number;
  paletteUniformFloats: number;
  splats: number;
}

interface FluidProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

type FluidTarget = RawGpuTarget;
type FluidDoubleTarget = RawGpuDoubleTarget;

const BASE_SIM_RESOLUTION = 220;
const BASE_DYE_RESOLUTION = 950;
const MAX_VELOCITY_CELLS = 8.5;
const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);

// Post-processing stages adapt the bloom/sunray display structure from
// Pavel Dobryakov's MIT-licensed WebGL Fluid Simulation for pixi-lab's
// raw WebGL2 renderer. See docs/attribution.md.

const BASE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const CLEAR_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float value;
void main() {
  outColor = vec4(value, value, value, 1.0);
}`;

const INIT_DYE_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 resolution;
uniform float seed;
uniform float cellSize;
uniform int initMode;
uniform bool hasInitImage;
uniform sampler2D uInitImage;
uniform vec3 palette[6];
uniform int paletteCount;
uniform float paletteStrength;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash(i + vec2(0.0, 0.0));
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;

  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.17, 31.71);
    amplitude *= 0.52;
  }

  return value;
}

vec2 voronoiPoint(vec2 cell) {
  float ox = hash(cell + seed * vec2(1.71, 2.43));
  float oy = hash(cell + seed * vec2(4.31, 0.79) + 12.7);
  return 0.18 + 0.64 * vec2(ox, oy);
}

vec3 voronoiCell(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float d1 = 100.0;
  float d2 = 100.0;
  vec2 winner = cell;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 feature = neighbor + voronoiPoint(cell + neighbor) - f;
      float d = dot(feature, feature);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        winner = cell + neighbor;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }

  float edgeDistance = sqrt(d2) - sqrt(d1);
  float cellId = hash(winner + seed * vec2(1.71, 2.43));
  float accent = hash(winner + seed * vec2(4.31, 0.79) + 12.7);
  float centerShade = 0.86 + 0.20 * smoothstep(0.0, 0.58, sqrt(d1)) + accent * 0.10;
  return vec3(cellId, edgeDistance, centerShade);
}

vec3 paletteColor(float t) {
  if (paletteCount <= 1) return palette[0];
  float scaled = clamp(t, 0.0, 0.999) * float(paletteCount - 1);
  int index = int(floor(scaled));
  float local = fract(scaled);
  vec3 a = palette[0];
  vec3 b = palette[0];
  for (int i = 0; i < 6; i++) {
    if (i == index) a = palette[i];
    if (i == min(index + 1, paletteCount - 1)) b = palette[i];
  }
  return mix(a, b, smoothstep(0.0, 1.0, local));
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  if (initMode == 4) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  if (initMode == 3 && hasInitImage) {
    vec3 imageColor = texture(uInitImage, vUv).rgb;
    float luma = dot(imageColor, vec3(0.2126, 0.7152, 0.0722));
    outColor = vec4(mix(imageColor, imageColor * (1.0 + luma * 0.6), 0.55), 1.0);
    return;
  }

  float aspect = resolution.x / resolution.y;
  float scale = 1.0 / max(cellSize, 0.35);
  vec2 p = vUv * vec2(aspect, 1.0);
  vec2 s1 = vec2(seed * 1.37, seed * 2.11);
  vec2 s2 = vec2(seed * 3.19, seed * 0.73);

  float large = fbm(p * 2.1 * scale + s1);
  float medium = fbm(p * 5.6 * scale + s2);
  float fine = fbm(p * 12.0 * scale - s1 * 0.42);
  float ribbons = 0.5 + 0.5 * sin((p.x * 1.4 * scale - p.y * 0.8 * scale + large * 2.8 + seed * 0.07) * 6.2831853);

  float paletteT = fract(large * 0.76 + medium * 0.31 + ribbons * 0.22 + seed * 0.113);
  if (initMode == 1) {
    vec3 cell = voronoiCell(p * 8.0 * scale + s1);
    paletteT = cell.x;
    large = cell.x;
    medium = 0.62 + 0.28 * hash(vec2(cell.x, seed));
    fine = clamp(cell.z, 0.42, 1.12);
    // Voronoi is only an initialization style. Avoid explicit cell-edge/border
    // marks here, because crisp borders read as a static overlay after the
    // velocity field starts advecting the dye.
    ribbons = 0.48 + 0.18 * hash(vec2(cell.x, seed + 19.0));
  } else if (initMode == 2) {
    large = hash(floor(vUv * resolution / max(1.0, cellSize * 10.0)) + seed);
    medium = hash(floor(vUv * resolution / max(1.0, cellSize * 4.0)) + seed * 2.0);
    fine = hash(vUv * resolution + seed * 3.0);
    ribbons = step(0.48, hash(floor(vUv * resolution / max(1.0, cellSize * 18.0)) - seed));
    paletteT = large;
  }

  float hue = fract(large * 0.76 + medium * 0.31 + ribbons * 0.22 + seed * 0.113);
  float saturation = 0.72 + 0.26 * medium;
  float value = 0.96 + 0.40 * fine + 0.16 * ribbons;

  vec3 procedural = hsv2rgb(vec3(hue, saturation, value));
  vec3 styled = paletteColor(paletteT) * value;
  vec3 color = mix(procedural, styled, clamp(paletteStrength, 0.0, 1.0));
  color *= 1.04 + 0.20 * ribbons;
  if (initMode == 1) color *= mix(0.82, 1.08, fine);

  outColor = vec4(color, 1.0);
}
      `;

const SPLAT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main() {
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  float splat = exp(-dot(p, p) / radius);
  vec3 base = texture(uTarget, vUv).rgb;
  outColor = vec4(base + color * splat, 1.0);
}`;

const ADVECTION_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  vec2 coord = vUv - dt * velocity * texelSize;
  coord = clamp(coord, vec2(0.001), vec2(0.999));
  outColor = texture(uSource, coord) * dissipation;
}`;

const BOUNDARY_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
uniform float wallDamping;
void main() {
  vec2 velocity = texture(uVelocity, vUv).xy;
  float left = vUv.x;
  float right = 1.0 - vUv.x;
  float bottom = vUv.y;
  float top = 1.0 - vUv.y;
  float edge = min(min(left, right), min(bottom, top));
  float wall = smoothstep(0.0, max(texelSize.x, texelSize.y) * 7.0, edge);
  if (left < texelSize.x || right < texelSize.x) velocity.x = 0.0;
  if (bottom < texelSize.y || top < texelSize.y) velocity.y = 0.0;
  velocity *= mix(wallDamping, 1.0, wall);
  outColor = vec4(velocity, 0.0, 1.0);
}`;

const DIVERGENCE_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
vec2 velocityAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec2(0.0);
  return texture(uVelocity, uv).xy;
}
void main() {
  float L = velocityAt(vUv - vec2(texelSize.x, 0.0)).x;
  float R = velocityAt(vUv + vec2(texelSize.x, 0.0)).x;
  float B = velocityAt(vUv - vec2(0.0, texelSize.y)).y;
  float T = velocityAt(vUv + vec2(0.0, texelSize.y)).y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CURL_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
vec2 velocityAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec2(0.0);
  return texture(uVelocity, uv).xy;
}
void main() {
  float L = velocityAt(vUv - vec2(texelSize.x, 0.0)).y;
  float R = velocityAt(vUv + vec2(texelSize.x, 0.0)).y;
  float B = velocityAt(vUv - vec2(0.0, texelSize.y)).x;
  float T = velocityAt(vUv + vec2(0.0, texelSize.y)).x;
  outColor = vec4(R - L - T + B, 0.0, 0.0, 1.0);
}`;

const VORTICITY_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 texelSize;
uniform float curlStrength;
uniform float dt;
void main() {
  float L = abs(texture(uCurl, vUv - vec2(texelSize.x, 0.0)).x);
  float R = abs(texture(uCurl, vUv + vec2(texelSize.x, 0.0)).x);
  float B = abs(texture(uCurl, vUv - vec2(0.0, texelSize.y)).x);
  float T = abs(texture(uCurl, vUv + vec2(0.0, texelSize.y)).x);
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(R - L, T - B);
  force /= length(force) + 0.0001;
  force *= curlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy + force * dt;
  outColor = vec4(clamp(velocity, vec2(-260.0), vec2(260.0)), 0.0, 1.0);
}`;

const PRESSURE_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 texelSize;
float pressureAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uPressure, uv).x;
}
void main() {
  float L = pressureAt(vUv - vec2(texelSize.x, 0.0));
  float R = pressureAt(vUv + vec2(texelSize.x, 0.0));
  float B = pressureAt(vUv - vec2(0.0, texelSize.y));
  float T = pressureAt(vUv + vec2(0.0, texelSize.y));
  float divergence = texture(uDivergence, vUv).x;
  outColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_SUBTRACT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 texelSize;
float pressureAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture(uPressure, uv).x;
}
void main() {
  float L = pressureAt(vUv - vec2(texelSize.x, 0.0));
  float R = pressureAt(vUv + vec2(texelSize.x, 0.0));
  float B = pressureAt(vUv - vec2(0.0, texelSize.y));
  float T = pressureAt(vUv + vec2(0.0, texelSize.y));
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= 0.5 * vec2(R - L, T - B);
  outColor = vec4(velocity, 0.0, 1.0);
}`;

const DISPLAY_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uTexture;
uniform vec2 texelSize;
uniform vec2 resolution;
uniform float exposure;
uniform float time;
uniform vec3 palette[6];
uniform int paletteCount;
uniform float paletteStrength;
uniform float edgeDarkening;
uniform float shadingStrength;
uniform int visualPipeline;
uniform int initMode;
uniform float seed;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 paletteColor(float t) {
  if (paletteCount <= 1) return palette[0];
  float scaled = clamp(t, 0.0, 0.999) * float(paletteCount - 1);
  int index = int(floor(scaled));
  float local = fract(scaled);
  vec3 a = palette[0];
  vec3 b = palette[0];
  for (int i = 0; i < 6; i++) {
    if (i == index) a = palette[i];
    if (i == min(index + 1, paletteCount - 1)) b = palette[i];
  }
  return mix(a, b, smoothstep(0.0, 1.0, local));
}

void main() {
  vec3 c = texture(uTexture, vUv).rgb;

  float sourceEnergy = max(max(c.r, c.g), c.b);
  if (initMode == 4 && sourceEnergy < 0.012) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float blankReveal = initMode == 4 ? smoothstep(0.012, 0.075, sourceEnergy) : 1.0;
  float dyeMask = initMode == 4 ? blankReveal : smoothstep(0.006, 0.13, sourceEnergy);

  vec3 sampleL = texture(uTexture, vUv - vec2(texelSize.x, 0.0)).rgb;
  vec3 sampleR = texture(uTexture, vUv + vec2(texelSize.x, 0.0)).rgb;
  vec3 sampleB = texture(uTexture, vUv - vec2(0.0, texelSize.y)).rgb;
  vec3 sampleT = texture(uTexture, vUv + vec2(0.0, texelSize.y)).rgb;
  float gradientX = length(sampleR) - length(sampleL);
  float gradientY = length(sampleT) - length(sampleB);
  vec3 normal = normalize(vec3(gradientX * 1.8, gradientY * 1.8, 0.08));
  float diffuse = 0.52 + 0.48 * dot(normal, normalize(vec3(-0.35, -0.52, 0.78)));
  c *= mix(1.0, clamp(diffuse, 0.62, 1.38), clamp(shadingStrength, 0.0, 1.0));

  vec3 glow = vec3(0.0);
  glow += texture(uTexture, vUv + vec2( 2.0,  0.0) * texelSize).rgb;
  glow += texture(uTexture, vUv + vec2(-2.0,  0.0) * texelSize).rgb;
  glow += texture(uTexture, vUv + vec2( 0.0,  2.0) * texelSize).rgb;
  glow += texture(uTexture, vUv + vec2( 0.0, -2.0) * texelSize).rgb;
  glow *= 0.075;

  c += glow * (visualPipeline == 1 ? 0.55 : 0.0);
  c *= 1.0 + dyeMask * 0.22;
  c = 1.0 - exp(-c * exposure * (1.16 + sourceEnergy * 0.22));
  c = pow(max(c, 0.0), vec3(0.82));

  c *= blankReveal;

  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float wallShadow = smoothstep(0.0, 0.035, edge);
  c *= mix(1.0, 0.78 + 0.22 * wallShadow, clamp(edgeDarkening, 0.0, 1.0));

  float vignette = smoothstep(0.92, 0.20, distance(vUv, vec2(0.5)));
  c *= 0.82 + 0.18 * vignette;

  float grain = hash(vUv * resolution + time) - 0.5;
  c += grain * (visualPipeline == 1 ? 0.005 * dyeMask : 0.0);

  outColor = vec4(max(c, 0.0), 1.0);
}
      `;

const BLOOM_PREFILTER_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform float threshold;
void main() {
  vec3 c = texture(uTexture, vUv).rgb;
  float brightness = max(max(c.r, c.g), c.b);
  float knee = max(0.0001, threshold * 0.65);
  float soft = brightness - threshold + knee;
  soft = clamp(soft, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 0.0001);
  float contribution = max(soft, brightness - threshold) / max(brightness, 0.0001);
  outColor = vec4(c * contribution, 1.0);
}`;

const BLUR_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform vec2 texelSize;
uniform vec2 direction;
void main() {
  vec2 off = texelSize * direction;
  vec3 c = texture(uTexture, vUv).rgb * 0.2270270270;
  c += texture(uTexture, vUv + off * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTexture, vUv - off * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTexture, vUv + off * 3.2307692308).rgb * 0.0702702703;
  c += texture(uTexture, vUv - off * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(c, 1.0);
}`;

const SUNRAYS_MASK_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
void main() {
  vec4 c = texture(uTexture, vUv);
  float brightness = max(c.r, max(c.g, c.b));
  c.a = 1.0 - min(max(brightness * 20.0, 0.0), 0.8);
  outColor = c;
}`;

const SUNRAYS_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform float weight;
const int ITERATIONS = 16;
void main() {
  float density = 0.3;
  float decay = 0.95;
  float exposure = 0.7;
  vec2 coord = vUv;
  vec2 dir = vUv - vec2(0.5);
  dir *= 1.0 / float(ITERATIONS) * density;
  float illuminationDecay = 1.0;
  float color = texture(uTexture, vUv).a;
  for (int i = 0; i < ITERATIONS; i++) {
    coord -= dir;
    float sampleValue = texture(uTexture, coord).a;
    color += sampleValue * illuminationDecay * weight;
    illuminationDecay *= decay;
  }
  outColor = vec4(color * exposure, 0.0, 0.0, 1.0);
}`;

const COMPOSITE_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uBase;
uniform sampler2D uBloom;
uniform sampler2D uSunrays;
uniform float bloomStrength;
uniform float sunraysStrength;
uniform vec2 resolution;
uniform float time;
uniform int visualPipeline;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
void main() {
  vec3 c = texture(uBase, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  float rays = texture(uSunrays, vUv).r;
  float baseEnergy = max(max(c.r, c.g), c.b);
  float intensityMask = smoothstep(0.015, 0.72, baseEnergy);
  float drivenBloom = visualPipeline == 1
    ? bloomStrength * (0.46 + intensityMask * 1.04)
    : bloomStrength;
  if (visualPipeline == 1) {
    c *= rays;
    bloom *= rays;
  }
  c += bloom * drivenBloom;
  if (visualPipeline == 1) {
    c = c / (1.0 + c * 0.16);
    c = pow(max(c, 0.0), vec3(0.96));
    c += (hash(vUv * resolution + time * 19.0) - 0.5) * 0.004 * intensityMask;
  }
  outColor = vec4(max(c, 0.0), 1.0);
}`;

// The raw canvas must sit BELOW the shared PixiJS canvas (z-index 2).
// PixiJS is initialised with backgroundAlpha:0 for fluid-tank, so its canvas
// is transparent where nothing is drawn — the fluid shows through from below.
// Walls and ripples drawn by PixiJS Graphics objects then appear on top.
export const RAW_FLUID_CANVAS_Z_INDEX = '1';

export interface GpuFluidTankRendererMount {
  canvas?: HTMLCanvasElement;
}

export class GpuFluidTankRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ownsCanvas: boolean;
  private readonly gl: WebGL2RenderingContext | null;
  private rng: SeededRng;
  private readonly textureFilter: number;
  private readonly programs = new Map<string, FluidProgram>();
  private readonly format: { internalFormat: number; format: number; type: number } | null = null;
  private quadVao: WebGLVertexArrayObject | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private velocity: FluidDoubleTarget | null = null;
  private dye: FluidDoubleTarget | null = null;
  private pressure: FluidDoubleTarget | null = null;
  private divergence: FluidTarget | null = null;
  private curlTarget: FluidTarget | null = null;
  private displayTarget: FluidTarget | null = null;
  private bloomTarget: FluidTarget | null = null;
  private bloomScratchTarget: FluidTarget | null = null;
  private sunraysMaskTarget: FluidTarget | null = null;
  private sunraysTarget: FluidTarget | null = null;
  private options: GpuFluidTankOptions;
  private quality: RenderQuality;
  private supported = false;
  private width = 0;
  private height = 0;
  private elapsed = 0;
  private lastAmbient = 0;
  private splatCount = 0;
  private shaderSeed = 0;
  private initImageTexture: WebGLTexture | null = null;
  private initImageUrl = '';
  private initImageLoadId = 0;
  private initImageLoading = false;
  private initImageReady = false;
  private readonly paletteUniformData = new Float32Array(18);

  constructor(parent: HTMLElement, options: GpuFluidTankOptions, quality: RenderQuality = 'basic', mount: GpuFluidTankRendererMount = {}) {
    this.options = { ...options };
    this.quality = quality;
    this.rng = new SeededRng(options.seed);
    this.ownsCanvas = !mount.canvas;
    this.canvas = mount.canvas ?? document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.inset = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.background = '#020206';
    this.canvas.style.zIndex = RAW_FLUID_CANVAS_Z_INDEX;
    this.canvas.dataset.pixiLabFluidRenderer = 'raw-webgl';
    if (this.ownsCanvas) parent.appendChild(this.canvas);

    this.gl = this.canvas.getContext('webgl2', {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });

    if (!this.gl) {
      this.textureFilter = 0;
      return;
    }

    const colorBufferFloat = this.gl.getExtension('EXT_color_buffer_float');
    const linearFloat =
      this.gl.getExtension('OES_texture_float_linear') ||
      this.gl.getExtension('OES_texture_half_float_linear');

    if (colorBufferFloat) {
      this.textureFilter = linearFloat ? this.gl.LINEAR : this.gl.NEAREST;
      this.format = {
        internalFormat: this.gl.RGBA16F,
        format: this.gl.RGBA,
        type: this.gl.HALF_FLOAT,
      };
    } else {
      // New raw-scene architecture can run inside browsers/headless contexts that
      // do not expose renderable float color buffers. Do not leave the canvas
      // black or accidentally expose an intermediate debug buffer; fall back to a
      // normalized color target so the dye/display path still renders.
      this.textureFilter = this.gl.LINEAR;
      this.format = {
        internalFormat: this.gl.RGBA8,
        format: this.gl.RGBA,
        type: this.gl.UNSIGNED_BYTE,
      };
    }

    try {
      this.initializeGl();
      this.supported = true;
    } catch (error) {
      console.warn('[FluidTank] WebGL renderer initialization failed', error);
      this.supported = false;
    }
  }

  setQuality(quality: RenderQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.resize(this.width, this.height, true);
  }

  setOptions(options: Partial<GpuFluidTankOptions>): void {
    const previousCellSize = this.options.cellSize;
    const previousSeed = this.options.seed;
    const previousInitMode = this.options.initMode;
    const previousInitImageUrl = this.options.initImageUrl;
    const previousPalette = this.options.palette;
    const previousPaletteStrength = this.options.paletteStrength;
    this.options = { ...this.options, ...options };
    if (options.seed !== undefined && options.seed !== previousSeed) {
      this.rng = new SeededRng(options.seed);
    }
    if (options.cellSize !== undefined && options.cellSize !== previousCellSize) {
      this.resize(this.width, this.height, true);
      this.randomizeDye(this.options.seed);
      return;
    }
    const initChanged =
      options.initMode !== undefined && options.initMode !== previousInitMode ||
      options.initImageUrl !== undefined && options.initImageUrl !== previousInitImageUrl;
    if (options.initImageUrl !== undefined && options.initImageUrl !== previousInitImageUrl) {
      this.initImageReady = false;
    }
    const paletteChanged =
      options.palette !== undefined && options.palette !== previousPalette ||
      options.paletteStrength !== undefined && options.paletteStrength !== previousPaletteStrength;
    if (initChanged || paletteChanged || (options.seed !== undefined && options.seed !== previousSeed)) {
      this.randomizeDye(this.options.seed, false);
    }
  }

  resize(width: number, height: number, force = false): void {
    if (!this.supported || !this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(2, Math.floor(width * dpr));
    const nextHeight = Math.max(2, Math.floor(height * dpr));
    if (!force && nextWidth === this.width && nextHeight === this.height) return;
    this.width = nextWidth;
    this.height = nextHeight;
    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.initFramebuffers();
    this.randomizeDye(this.options.seed);
  }

  randomizeDye(seed = this.options.seed + 1, seedMotion = true): void {
    if (!this.supported || !this.dye) return;
    this.options.seed = seed;
    this.rng = new SeededRng(seed);
    this.shaderSeed = seed;
    this.settleVelocity();
    this.initDyeField();
    if (seedMotion && this.options.initMode !== 'blank') this.seedRestingMotion();
    this.splatCount = 0;
  }

  settleVelocity(): void {
    if (!this.supported || !this.velocity || !this.pressure || !this.divergence || !this.curlTarget) return;
    this.clearDoubleTarget(this.velocity);
    this.clearDoubleTarget(this.pressure);
    this.clearTarget(this.divergence, 0);
    this.clearTarget(this.curlTarget, 0);
  }

  inject(x: number, y: number, dx: number, dy: number, intensity = 1): void {
    if (!this.supported || !this.velocity || !this.dye) return;
    const clampedX = clamp01(x);
    const clampedY = clamp01(1 - y);
    const turbulence = clamp(this.options.injectTurbulence, 0, 2);
    const radius = this.options.fingerRadius * (0.82 + intensity * 0.28);
    const motionSpeed = Math.hypot(dx, dy);
    const motionBoost = clamp(motionSpeed / 3, 0, 1.4);
    const spread = this.options.fingerForce * (0.72 + motionBoost * 0.34);
    const vx = dx * spread;
    const vy = -dy * spread;
    const speed = Math.hypot(vx, vy);
    const segments = Math.round(clamp(Math.ceil(speed / 2.1 + turbulence * 2.5), 2, 7));
    const invLen = speed > 0.0001 ? 1 / speed : 0;
    const ux = vx * invLen;
    const uy = vy * invLen;
    const pxAxis = speed > 0.0001 ? -uy : Math.cos(this.elapsed * 2.1);
    const pyAxis = speed > 0.0001 ? ux : Math.sin(this.elapsed * 2.1);
    const spacing = radius * (0.72 + turbulence * 0.45);
    for (let i = 0; i < segments; i++) {
      const t = segments <= 1 ? 0 : i / (segments - 1);
      const side = i % 2 === 0 ? 1 : -1;
      const wobble = Math.sin(this.elapsed * 11.0 + t * 13.0) * radius * turbulence * 0.42;
      const px = clamp01(clampedX + ux * (t - 0.5) * spacing + pxAxis * wobble);
      const py = clamp01(clampedY + uy * (t - 0.5) * spacing + pyAxis * wobble);
      const swirl = this.options.fingerForce * turbulence * (0.14 + motionBoost * 0.08) * side;
      this.applySplatTarget(this.velocity, px, py, vx + pxAxis * swirl, vy + pyAxis * swirl, 0, radius * (0.88 + t * 0.16));
    }
    if (this.options.eddyAssist > 0) {
      this.applySplatTarget(
        this.velocity,
        clampedX,
        clampedY,
        -vy * this.options.eddyAssist,
        vx * this.options.eddyAssist,
        0,
        radius * 1.22,
      );
    }
    const dyeColor = this.nextInjectColor(clampedX, clampedY, intensity);
    const colorRadiusBoost = this.options.injectColorMode === 'style' ? 1 : 1.18;
    for (let i = 0; i < segments; i++) {
      const t = segments <= 1 ? 0 : i / (segments - 1);
      const wobble = Math.sin(this.elapsed * 11.0 + t * 13.0) * radius * turbulence * 0.22;
      const px = clamp01(clampedX + ux * (t - 0.5) * spacing + pxAxis * wobble);
      const py = clamp01(clampedY + uy * (t - 0.5) * spacing + pyAxis * wobble);
      this.applySplatTarget(
        this.dye,
        px,
        py,
        dyeColor[0],
        dyeColor[1],
        dyeColor[2],
        radius * colorRadiusBoost * (0.72 + t * 0.18 + turbulence * 0.12),
      );
    }
    this.splatCount += 1;
  }

  splat(splat: FluidSplat): void {
    if (!this.supported || !this.velocity || !this.dye) return;
    const x = clamp01(splat.x);
    const y = clamp01(1 - splat.y);
    const radius = this.options.fingerRadius * (splat.radiusScale ?? 1);
    const vx = splat.dx * this.options.fingerForce;
    const vy = -splat.dy * this.options.fingerForce;
    this.applySplat(x, y, vx, vy, radius);
    if (this.options.eddyAssist > 0) {
      this.applySplat(
        x,
        y,
        splat.dy * this.options.fingerForce * this.options.eddyAssist,
        splat.dx * this.options.fingerForce * this.options.eddyAssist,
        radius * 1.35,
      );
    }
    this.splatCount += 1;
  }

  stir(splat: FluidSplat): void {
    if (!this.supported || !this.velocity) return;
    const x = clamp01(splat.x);
    const y = clamp01(1 - splat.y);
    const radius = this.options.fingerRadius * (splat.radiusScale ?? 1);
    const vx = splat.dx * this.options.fingerForce;
    const vy = -splat.dy * this.options.fingerForce;
    this.applySplat(x, y, vx, vy, radius);
    if (this.options.eddyAssist > 0) {
      this.applySplat(
        x,
        y,
        splat.dy * this.options.fingerForce * this.options.eddyAssist,
        splat.dx * this.options.fingerForce * this.options.eddyAssist,
        radius * 1.35,
      );
    }
    this.splatCount += 1;
  }

  smallSwirl(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = randomBetween(this.rng, this.options.fingerRadius * 0.35, this.options.fingerRadius * 0.9);
      this.stir({
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        dx: -Math.sin(angle) * 0.55,
        dy: Math.cos(angle) * 0.55,
        radiusScale: 0.85,
      });
    }
  }

  update(dt: number): void {
    if (!this.supported) return;
    const safeDt = Math.min(dt, 0.032);
    this.elapsed += safeDt;
    this.ambientStir();
    this.step(safeDt);
  }

  render(): void {
    if (!this.supported || !this.gl || !this.dye) return;
    const source = this.getDisplayTarget();
    if (!source) return;
    if (this.options.displayMode !== undefined && this.options.displayMode !== 'dye') {
      this.renderDisplayPass(source, null);
      return;
    }
    const needsPostProcessing =
      this.options.visualPipeline === 'reference' ||
      this.options.bloomStrength > 0.0001 ||
      this.options.sunraysStrength > 0.0001;
    if (!needsPostProcessing) {
      this.renderDisplayPass(source, null);
      return;
    }
    if (!this.displayTarget || !this.bloomTarget || !this.bloomScratchTarget || !this.sunraysMaskTarget || !this.sunraysTarget) {
      this.renderDisplayPass(source, null);
      return;
    }

    this.renderDisplayPass(source, this.displayTarget);
    this.applyBloom(this.displayTarget);
    this.applySunrays(source);

    const program = this.requireProgram('composite');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uBase, this.displayTarget.attach(0));
    this.gl.uniform1i(program.uniforms.uBloom, this.bloomTarget.attach(1));
    this.gl.uniform1i(program.uniforms.uSunrays, this.sunraysTarget.attach(2));
    this.gl.uniform1f(program.uniforms.bloomStrength, this.options.bloomStrength);
    this.gl.uniform1f(program.uniforms.sunraysStrength, this.options.sunraysStrength);
    this.gl.uniform2f(program.uniforms.resolution, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    this.gl.uniform1f(program.uniforms.time, this.elapsed);
    this.gl.uniform1i(program.uniforms.visualPipeline, this.options.visualPipeline === 'reference' ? 1 : 0);
    this.blit(null);
  }

  private renderDisplayPass(source: FluidTarget, target: FluidTarget | null): void {
    if (!this.gl) return;
    const program = this.requireProgram('display');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uTexture, source.attach(0));
    this.gl.uniform2f(program.uniforms.texelSize, 1 / source.width, 1 / source.height);
    this.gl.uniform2f(program.uniforms.resolution, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    this.gl.uniform1f(program.uniforms.exposure, this.options.exposure);
    this.gl.uniform1f(program.uniforms.time, this.elapsed);
    this.gl.uniform1f(program.uniforms.edgeDarkening, this.options.edgeDarkening);
    this.gl.uniform1f(program.uniforms.shadingStrength, this.options.shadingStrength);
    this.gl.uniform1i(program.uniforms.visualPipeline, this.options.visualPipeline === 'reference' ? 1 : 0);
    this.gl.uniform1i(program.uniforms.initMode, initModeIndex(this.options.initMode));
    this.gl.uniform1f(program.uniforms.seed, this.shaderSeed);
    this.applyPaletteUniforms(program);
    this.blit(target);
  }

  private applyBloom(source: FluidTarget): void {
    if (!this.gl || !this.bloomTarget || !this.bloomScratchTarget) return;
    const strength = Math.max(0, this.options.bloomStrength);
    const prefilter = this.requireProgram('bloomPrefilter');
    this.bind(prefilter);
    this.gl.uniform1i(prefilter.uniforms.uTexture, source.attach(0));
    this.gl.uniform1f(prefilter.uniforms.threshold, this.options.bloomThreshold);
    this.blit(this.bloomTarget);
    if (strength <= 0.0001) return;

    const blur = this.requireProgram('blur');
    const iterations = this.options.visualPipeline === 'reference'
      ? (this.quality === 'raw' ? 5 : 4)
      : (this.quality === 'raw' ? 4 : 3);
    for (let i = 0; i < iterations; i++) {
      this.bind(blur);
      this.gl.uniform1i(blur.uniforms.uTexture, this.bloomTarget.attach(0));
      this.gl.uniform2f(blur.uniforms.texelSize, 1 / this.bloomTarget.width, 1 / this.bloomTarget.height);
      this.gl.uniform2f(blur.uniforms.direction, 1, 0);
      this.blit(this.bloomScratchTarget);

      this.bind(blur);
      this.gl.uniform1i(blur.uniforms.uTexture, this.bloomScratchTarget.attach(0));
      this.gl.uniform2f(blur.uniforms.texelSize, 1 / this.bloomScratchTarget.width, 1 / this.bloomScratchTarget.height);
      this.gl.uniform2f(blur.uniforms.direction, 0, 1);
      this.blit(this.bloomTarget);
    }
  }

  private applySunrays(source: FluidTarget): void {
    if (!this.gl || !this.dye || !this.sunraysMaskTarget || !this.sunraysTarget) return;
    if (this.options.sunraysStrength <= 0.0001) {
      this.clearTarget(this.sunraysTarget, 0);
      return;
    }
    const maskTarget = this.dye.write;

    let program = this.requireProgram('sunraysMask');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uTexture, source.attach(0));
    this.blit(maskTarget);

    program = this.requireProgram('sunrays');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uTexture, maskTarget.attach(0));
    this.gl.uniform1f(program.uniforms.weight, Math.max(0, this.options.sunraysStrength));
    this.blit(this.sunraysTarget);

    program = this.requireProgram('blur');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uTexture, this.sunraysTarget.attach(0));
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.sunraysTarget.width, 1 / this.sunraysTarget.height);
    this.gl.uniform2f(program.uniforms.direction, 1, 0);
    this.blit(this.sunraysMaskTarget);

    this.gl.uniform1i(program.uniforms.uTexture, this.sunraysMaskTarget.attach(0));
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.sunraysMaskTarget.width, 1 / this.sunraysMaskTarget.height);
    this.gl.uniform2f(program.uniforms.direction, 0, 1);
    this.blit(this.sunraysTarget);
  }

  private getDisplayTarget(): FluidTarget | null {
    switch (this.options.displayMode ?? 'dye') {
      case 'velocity':
        return this.velocity?.read ?? null;
      case 'curl':
        return this.curlTarget ?? null;
      case 'divergence':
        return this.divergence ?? null;
      case 'pressure':
        return this.pressure?.read ?? null;
      case 'dye':
      default:
        return this.dye?.read ?? null;
    }
  }

  stats(): GpuFluidTankStats {
    const simTexels = (this.velocity?.width ?? 0) * (this.velocity?.height ?? 0);
    const dyeTexels = (this.dye?.width ?? 0) * (this.dye?.height ?? 0);
    const postProcessTextures = this.supported ? 5 : 0;
    const postProcessTexels =
      (this.displayTarget?.width ?? 0) * (this.displayTarget?.height ?? 0) +
      (this.bloomTarget?.width ?? 0) * (this.bloomTarget?.height ?? 0) +
      (this.bloomScratchTarget?.width ?? 0) * (this.bloomScratchTarget?.height ?? 0) +
      (this.sunraysMaskTarget?.width ?? 0) * (this.sunraysMaskTarget?.height ?? 0) +
      (this.sunraysTarget?.width ?? 0) * (this.sunraysTarget?.height ?? 0);
    const gpuTargetTextures = this.supported ? 8 + postProcessTextures : 0;
    const postProcessPasses = this.supported && (this.options.visualPipeline === 'reference' || this.options.bloomStrength > 0.0001 || this.options.sunraysStrength > 0.0001)
      ? (this.options.visualPipeline === 'reference' ? 14 : 12)
      : 1;
    return {
      supported: this.supported,
      simulation: 'gpu-fluid-solver',
      rendering: this.options.visualPipeline === 'reference' ? 'gpu-display-reference-bloom-sunrays' : 'gpu-display-basic',
      gpuSimulated: true,
      gpuRendered: true,
      cpuTopology: false,
      cpuUpload: false,
      simWidth: this.velocity?.width ?? 0,
      simHeight: this.velocity?.height ?? 0,
      dyeWidth: this.dye?.width ?? 0,
      dyeHeight: this.dye?.height ?? 0,
      gpuTargetTextures,
      gpuTargetTexels: simTexels * 6 + dyeTexels * 2 + postProcessTexels,
      gpuPassesPerFrame: this.supported ? this.options.pressureIterations + (this.options.curl > 0 ? 7 : 6) + postProcessPasses : 0,
      postProcessPasses,
      paletteUniformFloats: this.paletteUniformData.length,
      splats: this.splatCount,
    };
  }

  imageLoadState(): { loading: boolean; ready: boolean } {
    return {
      loading: this.options.initMode === 'image' && this.initImageLoading,
      ready: this.options.initMode === 'image' && this.initImageReady,
    };
  }

  destroy(): void {
    this.disposeFramebuffers();
    if (this.gl) {
      for (const entry of this.programs.values()) {
        this.gl.deleteProgram(entry.program);
      }
      if (this.quadBuffer) this.gl.deleteBuffer(this.quadBuffer);
      if (this.quadVao) this.gl.deleteVertexArray(this.quadVao);
    }
    if (this.ownsCanvas) this.canvas.remove();
  }

  private initializeGl(): void {
    if (!this.gl) return;
    this.gl.disable(this.gl.BLEND);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.programs.set('clear', this.createProgram(CLEAR_SHADER));
    this.programs.set('initDye', this.createProgram(INIT_DYE_SHADER));
    this.programs.set('splat', this.createProgram(SPLAT_SHADER));
    this.programs.set('advection', this.createProgram(ADVECTION_SHADER));
    this.programs.set('boundary', this.createProgram(BOUNDARY_SHADER));
    this.programs.set('divergence', this.createProgram(DIVERGENCE_SHADER));
    this.programs.set('curl', this.createProgram(CURL_SHADER));
    this.programs.set('vorticity', this.createProgram(VORTICITY_SHADER));
    this.programs.set('pressure', this.createProgram(PRESSURE_SHADER));
    this.programs.set('gradientSubtract', this.createProgram(GRADIENT_SUBTRACT_SHADER));
    this.programs.set('display', this.createProgram(DISPLAY_SHADER));
    this.programs.set('bloomPrefilter', this.createProgram(BLOOM_PREFILTER_SHADER));
    this.programs.set('blur', this.createProgram(BLUR_SHADER));
    this.programs.set('sunraysMask', this.createProgram(SUNRAYS_MASK_SHADER));
    this.programs.set('sunrays', this.createProgram(SUNRAYS_SHADER));
    this.programs.set('composite', this.createProgram(COMPOSITE_SHADER));
    this.quadVao = this.gl.createVertexArray();
    this.quadBuffer = this.gl.createBuffer();
    if (!this.quadVao || !this.quadBuffer) throw new Error('Failed to create fluid quad');
    this.gl.bindVertexArray(this.quadVao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(0);
    this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.bindVertexArray(null);
  }

  private initFramebuffers(): void {
    if (!this.gl) return;
    this.disposeFramebuffers();
    const simResolution = this.getResolution(Math.round(clamp(BASE_SIM_RESOLUTION / this.options.cellSize, 90, 260)));
    const dyeResolution = this.getResolution(Math.round(clamp(BASE_DYE_RESOLUTION / this.options.cellSize, 300, 1200)));
    this.velocity = this.createDoubleTarget(simResolution.width, simResolution.height, this.textureFilter);
    this.dye = this.createDoubleTarget(dyeResolution.width, dyeResolution.height, this.textureFilter);
    this.pressure = this.createDoubleTarget(simResolution.width, simResolution.height, this.gl.NEAREST);
    this.divergence = this.createTarget(simResolution.width, simResolution.height, this.gl.NEAREST);
    this.curlTarget = this.createTarget(simResolution.width, simResolution.height, this.gl.NEAREST);
    this.displayTarget = this.createTarget(dyeResolution.width, dyeResolution.height, this.textureFilter);
    const bloomResolution = this.getResolution(Math.round(clamp(dyeResolution.height * 0.32, 128, 384)));
    const sunraysResolution = this.getResolution(Math.round(clamp(dyeResolution.height * 0.18, 96, 220)));
    this.bloomTarget = this.createTarget(bloomResolution.width, bloomResolution.height, this.textureFilter);
    this.bloomScratchTarget = this.createTarget(bloomResolution.width, bloomResolution.height, this.textureFilter);
    this.sunraysMaskTarget = this.createTarget(sunraysResolution.width, sunraysResolution.height, this.textureFilter);
    this.sunraysTarget = this.createTarget(sunraysResolution.width, sunraysResolution.height, this.textureFilter);
    this.clearDoubleTarget(this.velocity);
    this.clearDoubleTarget(this.pressure);
    this.clearTarget(this.divergence, 0);
    this.clearTarget(this.curlTarget, 0);
    this.clearTarget(this.displayTarget, 0);
    this.clearTarget(this.bloomTarget, 0);
    this.clearTarget(this.bloomScratchTarget, 0);
    this.clearTarget(this.sunraysMaskTarget, 0);
    this.clearTarget(this.sunraysTarget, 0);
  }

  private initDyeField(): void {
    if (!this.gl || !this.dye) return;
    const program = this.requireProgram('initDye');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.resolution, this.dye.width, this.dye.height);
    this.gl.uniform1f(program.uniforms.seed, this.shaderSeed);
    this.gl.uniform1f(program.uniforms.cellSize, this.options.cellSize);
    this.gl.uniform1i(program.uniforms.initMode, initModeIndex(this.options.initMode));
    this.applyPaletteUniforms(program);
    const hasImage = this.options.initMode === 'image' && Boolean(this.initImageTexture);
    this.gl.uniform1i(program.uniforms.hasInitImage, hasImage ? 1 : 0);
    if (hasImage && this.initImageTexture) {
      this.gl.activeTexture(this.gl.TEXTURE0 + 3);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.initImageTexture);
      this.gl.uniform1i(program.uniforms.uInitImage, 3);
    }
    if (this.options.initMode === 'image') this.ensureInitImageTexture();
    this.blit(this.dye.read);
    this.blit(this.dye.write);
  }

  private step(dt: number): void {
    if (!this.gl || !this.velocity || !this.dye || !this.pressure || !this.divergence || !this.curlTarget) return;
    this.gl.disable(this.gl.BLEND);

    let program = this.requireProgram('curl');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.blit(this.curlTarget);

    if (this.options.curl > 0) {
      program = this.requireProgram('vorticity');
      this.bind(program);
      this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
      this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
      this.gl.uniform1i(program.uniforms.uCurl, this.curlTarget.attach(1));
      this.gl.uniform1f(program.uniforms.curlStrength, this.options.curl);
      this.gl.uniform1f(program.uniforms.dt, dt);
      this.blit(this.velocity.write);
      this.velocity.swap();
      this.enforceVelocityBoundary();
    }

    program = this.requireProgram('divergence');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.blit(this.divergence);

    this.clearDoubleTarget(this.pressure);
    program = this.requireProgram('pressure');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.pressure.width, 1 / this.pressure.height);
    this.gl.uniform1i(program.uniforms.uDivergence, this.divergence.attach(1));
    for (let i = 0; i < this.options.pressureIterations; i++) {
      this.gl.uniform1i(program.uniforms.uPressure, this.pressure.read.attach(0));
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    program = this.requireProgram('gradientSubtract');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uPressure, this.pressure.read.attach(0));
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(1));
    this.blit(this.velocity.write);
    this.velocity.swap();
    this.enforceVelocityBoundary();

    program = this.requireProgram('advection');
    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.gl.uniform1i(program.uniforms.uSource, this.velocity.read.attach(1));
    this.gl.uniform1f(program.uniforms.dt, dt);
    this.gl.uniform1f(program.uniforms.dissipation, clamp(this.options.velocityPersistence, 0.9, 1));
    this.blit(this.velocity.write);
    this.velocity.swap();
    this.enforceVelocityBoundary();

    this.bind(program);
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.gl.uniform1i(program.uniforms.uSource, this.dye.read.attach(1));
    this.gl.uniform1f(program.uniforms.dt, dt);
    this.gl.uniform1f(program.uniforms.dissipation, this.options.dyePersistence);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  private applySplat(x: number, y: number, vx: number, vy: number, radius: number): void {
    if (!this.gl || !this.velocity) return;
    this.applySplatTarget(this.velocity, x, y, vx, vy, 0, radius);
  }

  private applySplatTarget(
    target: FluidDoubleTarget,
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    radius: number,
  ): void {
    if (!this.gl) return;
    const program = this.requireProgram('splat');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uTarget, target.read.attach(0));
    this.gl.uniform1f(program.uniforms.aspectRatio, target.width / target.height);
    this.gl.uniform3f(program.uniforms.color, r, g, b);
    this.gl.uniform2f(program.uniforms.point, x, y);
    this.gl.uniform1f(program.uniforms.radius, radius * radius);
    this.blit(target.write);
    target.swap();
  }

  private applyPaletteUniforms(program: FluidProgram): void {
    if (!this.gl) return;
    const palette = this.options.palette.length > 0 ? this.options.palette : [0x66fff1];
    const count = Math.max(1, Math.min(6, palette.length));
    const colors = this.paletteUniformData;
    for (let i = 0; i < 6; i++) {
      const color = unpackHexColor(palette[Math.min(i, count - 1)] ?? palette[0] ?? 0x66fff1);
      colors[i * 3] = color[0];
      colors[i * 3 + 1] = color[1];
      colors[i * 3 + 2] = color[2];
    }
    // WebGL reports `palette[0]` as active uniform `palette`; upload the whole
    // array from that base location so init/display shaders do not fall back to
    // zeroed black palette values.
    this.gl.uniform3fv(program.uniforms.palette, colors);
    this.gl.uniform1i(program.uniforms.paletteCount, count);
    this.gl.uniform1f(program.uniforms.paletteStrength, clamp(this.options.paletteStrength, 0, 1));
  }

  private nextInjectColor(x: number, y: number, intensity: number): [number, number, number] {
    const mode = this.options.injectColorMode;
    let base: [number, number, number];
    if (mode === 'cyan') {
      base = [0.04, 0.92, 0.86];
    } else if (mode === 'magenta') {
      base = [0.94, 0.05, 0.82];
    } else if (mode === 'amber') {
      base = [0.96, 0.58, 0.04];
    } else if (mode === 'green') {
      base = [0.05, 0.92, 0.2];
    } else if (mode === 'blue') {
      base = [0.08, 0.24, 0.94];
    } else if (mode === 'red') {
      base = [0.96, 0.08, 0.03];
    } else if (mode === 'white') {
      base = [0.88, 0.88, 0.82];
    } else if (mode === 'rainbow') {
      const hue = (this.elapsed * 0.12 + x * 0.5 + y * 0.35) % 1;
      const rainbow = unpackHexColor(hsvToRgb(hue, 0.94, 1));
      base = [rainbow[0], rainbow[1], rainbow[2]];
    } else {
      const palette = this.options.palette;
      const t = (x * 0.7 + y * 0.31 + this.elapsed * 0.02) % 1;
      const colorHex = blendPalette(palette, t);
      base = unpackHexColor(colorHex);
    }

    const fixedColorBoost = mode === 'style' ? 0.0 : 0.18;
    const amount = (this.options.visualPipeline === 'reference'
      ? 0.48 + fixedColorBoost + this.options.paletteStrength * 0.1 + intensity * 0.28
      : 0.34 + fixedColorBoost + this.options.paletteStrength * 0.08 + intensity * 0.18)
      * clamp(this.options.injectAmount, 0, 3);
    return [base[0] * amount, base[1] * amount, base[2] * amount];
  }

  private enforceVelocityBoundary(): void {
    if (!this.gl || !this.velocity) return;
    const program = this.requireProgram('boundary');
    this.bind(program);
    this.gl.uniform1i(program.uniforms.uVelocity, this.velocity.read.attach(0));
    this.gl.uniform2f(program.uniforms.texelSize, 1 / this.velocity.width, 1 / this.velocity.height);
    this.gl.uniform1f(program.uniforms.wallDamping, 0.08);
    this.blit(this.velocity.write);
    this.velocity.swap();
  }

  private seedRestingMotion(): void {
    for (let i = 0; i < 7; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      this.splat({
        x: this.rng.next(),
        y: this.rng.next(),
        dx: Math.cos(angle) * randomBetween(this.rng, 0.35, 0.75),
        dy: Math.sin(angle) * randomBetween(this.rng, 0.35, 0.75),
        radiusScale: randomBetween(this.rng, 1.4, 2.4),
      });
    }
    this.splatCount = 0;
  }

  private ambientStir(): void {
    if (!this.options.ambient || this.elapsed - this.lastAmbient < 0.28) return;
    this.lastAmbient = this.elapsed;
    for (let i = 0; i < 2; i++) {
      const phase = i * Math.PI;
      const t = this.elapsed;
      this.splat({
        x: 0.5 + Math.sin(t * 0.31 + phase) * 0.28,
        y: 0.5 + Math.cos(t * 0.27 + phase * 1.3) * 0.24,
        dx: Math.cos(t * 0.71 + phase) * 0.5,
        dy: Math.sin(t * 0.63 + phase) * 0.5,
        radiusScale: 2,
      });
    }
  }

  private ensureInitImageTexture(): void {
    if (!this.gl) return;
    const url = (this.options.initImageUrl ?? '').trim();
    if (!url || url === this.initImageUrl) return;
    this.initImageUrl = url;
    this.initImageLoading = true;
    this.initImageReady = false;
    const loadId = ++this.initImageLoadId;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      if (!this.gl || loadId !== this.initImageLoadId) return;
      const gl = this.gl;
      const texture = this.initImageTexture ?? gl.createTexture();
      if (!texture) return;
      this.initImageTexture = texture;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.initImageLoading = false;
      this.initImageReady = true;
      this.initDyeField();
    };
    image.onerror = () => {
      if (loadId === this.initImageLoadId) {
        this.initImageLoading = false;
        this.initImageReady = false;
        console.warn('[FluidTank] Failed to load init image URL', url);
      }
    };
    image.src = url;
  }

  private clearDoubleTarget(target: FluidDoubleTarget): void {
    this.clearTarget(target.read, 0);
    this.clearTarget(target.write, 0);
  }

  private clearTarget(target: FluidTarget, value: number): void {
    if (!this.gl) return;
    const program = this.requireProgram('clear');
    this.bind(program);
    this.gl.uniform1f(program.uniforms.value, value);
    this.blit(target);
  }

  private blit(target: FluidTarget | null): void {
    if (!this.gl || !this.quadVao) return;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target ? target.framebuffer : null);
    this.gl.viewport(0, 0, target ? target.width : this.gl.drawingBufferWidth, target ? target.height : this.gl.drawingBufferHeight);
    this.gl.bindVertexArray(this.quadVao);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
    this.gl.bindVertexArray(null);
  }

  private createTarget(width: number, height: number, filter: number): FluidTarget {
    if (!this.gl || !this.format) throw new Error('Fluid renderer unavailable');
    return createRawGpuTarget(this.gl, {
      width,
      height,
      internalFormat: this.format.internalFormat,
      format: this.format.format,
      type: this.format.type,
      filter: filter === this.gl.LINEAR ? 'linear' : 'nearest',
    });
  }

  private createDoubleTarget(width: number, height: number, filter: number): FluidDoubleTarget {
    if (!this.gl || !this.format) throw new Error('Fluid renderer unavailable');
    return createRawGpuDoubleTarget(this.gl, {
      width,
      height,
      internalFormat: this.format.internalFormat,
      format: this.format.format,
      type: this.format.type,
      filter: filter === this.gl.LINEAR ? 'linear' : 'nearest',
    });
  }

  private disposeFramebuffers(): void {
    if (this.gl && this.initImageTexture) this.gl.deleteTexture(this.initImageTexture);
    this.initImageTexture = null;
    this.velocity?.dispose();
    this.dye?.dispose();
    this.pressure?.dispose();
    this.divergence?.dispose();
    this.curlTarget?.dispose();
    this.displayTarget?.dispose();
    this.bloomTarget?.dispose();
    this.bloomScratchTarget?.dispose();
    this.sunraysMaskTarget?.dispose();
    this.sunraysTarget?.dispose();
    this.velocity = null;
    this.dye = null;
    this.pressure = null;
    this.divergence = null;
    this.curlTarget = null;
    this.displayTarget = null;
    this.bloomTarget = null;
    this.bloomScratchTarget = null;
    this.sunraysMaskTarget = null;
    this.sunraysTarget = null;
  }

  private createProgram(fragmentSource: string): FluidProgram {
    if (!this.gl) throw new Error('Fluid renderer unavailable');
    const program = linkRawWebGL2Program(this.gl, { vertex: BASE_VERTEX_SHADER, fragment: fragmentSource });
    return { program, uniforms: this.getUniforms(program) };
  }


  private getUniforms(program: WebGLProgram): Record<string, WebGLUniformLocation | null> {
    if (!this.gl) return {};
    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const count = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const uniform: WebGLActiveInfo | null = this.gl.getActiveUniform(program, i);
      if (!uniform) continue;
      const name = uniform.name.replace(/\[0\]$/, '');
      uniforms[name] = this.gl.getUniformLocation(program, name);
    }
    return uniforms;
  }

  private bind(program: FluidProgram): void {
    this.gl?.useProgram(program.program);
  }

  private requireProgram(name: string): FluidProgram {
    const program = this.programs.get(name);
    if (!program) throw new Error(`Missing fluid program: ${name}`);
    return program;
  }


  private getResolution(baseResolution: number): { width: number; height: number } {
    const aspect = this.height > 0 ? Math.max(this.width / this.height, this.height / this.width) : 1;
    const min = Math.round(baseResolution);
    const max = Math.round(baseResolution * aspect);
    return this.width > this.height ? { width: max, height: min } : { width: min, height: max };
  }
}

export function velocityFromScreenDelta(
  dx: number,
  dy: number,
  width: number,
  height: number,
  simWidth: number,
  simHeight: number,
): { dx: number; dy: number } {
  let vx = (dx / Math.max(1, width)) * simWidth;
  let vy = (dy / Math.max(1, height)) * simHeight;
  const magnitude = Math.hypot(vx, vy);
  if (magnitude > MAX_VELOCITY_CELLS) {
    const scale = MAX_VELOCITY_CELLS / magnitude;
    vx *= scale;
    vy *= scale;
  }
  return { dx: vx, dy: vy };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0.001, 0.999);
}

function randomBetween(rng: SeededRng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}

function unpackHexColor(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 255) / 255,
    ((hex >> 8) & 255) / 255,
    (hex & 255) / 255,
  ];
}

function blendPalette(palette: readonly number[], t: number): number {
  if (palette.length === 0) return 0x9dfff4;
  if (palette.length === 1) return palette[0] ?? 0x9dfff4;
  const span = palette.length;
  const scaled = ((t % 1) + 1) % 1 * span;
  const index = Math.floor(scaled) % span;
  const next = (index + 1) % span;
  const local = scaled - Math.floor(scaled);
  const eased = local * local * (3 - 2 * local);
  return blendHex(palette[index] ?? 0xffffff, palette[next] ?? 0xffffff, eased);
}

function blendHex(a: number, b: number, t: number): number {
  const r = Math.round((((a >> 16) & 255) * (1 - t)) + (((b >> 16) & 255) * t));
  const g = Math.round((((a >> 8) & 255) * (1 - t)) + (((b >> 8) & 255) * t));
  const bl = Math.round(((a & 255) * (1 - t)) + ((b & 255) * t));
  return (r << 16) | (g << 8) | bl;
}

function hsvToRgb(h: number, s: number, v: number): number {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = v;
  let g = t;
  let b = p;
  switch (i % 6) {
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return ((r * 255) << 16) | ((g * 255) << 8) | (b * 255);
}

function initModeIndex(mode: GpuFluidTankOptions['initMode']): number {
  if (mode === 'voronoi') return 1;
  if (mode === 'random') return 2;
  if (mode === 'image') return 3;
  if (mode === 'blank') return 4;
  return 0;
}
