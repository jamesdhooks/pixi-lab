import {
  RawWebGL2Scene,
  colorNumberToRgb,
  finiteNumberSetting,
  type GestureEvent,
  type RawSceneDebugStats,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';
import {
  createRawLiquidSurfaceRenderer,
  destroyRawLiquidSurfaceRenderer,
  liquidSurfaceOptionsFromSettings,
  renderLiquidSurfaceFromBufferParticles,
  type RawLiquidSurfaceRenderer,
} from './RawLiquidSurfaceRenderer.js';

export type ParticleMetaballPreset = 'lava-lamp' | 'water-tank';

interface PointerState {
  active: boolean;
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
}

interface ParticleMetaballState extends RawWebGL2RenderState {
  particleProgram: WebGLProgram | null;
  lavaRaymarchProgram: WebGLProgram | null;
  lavaDensityProgram: WebGLProgram | null;
  lavaCompositeProgram: WebGLProgram | null;
  waterDensityProgram: WebGLProgram | null;
  waterCompositeProgram: WebGLProgram | null;
  lavaLiquidSurface: RawLiquidSurfaceRenderer | null;
  obstacleProgram: WebGLProgram | null;
  obstacleLineProgram: WebGLProgram | null;
  particleBuffer: WebGLBuffer | null;
  obstacleBuffer: WebGLBuffer | null;
  obstacleLineBuffer: WebGLBuffer | null;
  quadBuffer: WebGLBuffer | null;
  lavaDensityTexture: WebGLTexture | null;
  lavaDensityFramebuffer: WebGLFramebuffer | null;
  lavaDensityWidth: number;
  lavaDensityHeight: number;
  lavaSurfaceSupported: boolean;
  lavaRaymarchBlobData: Float32Array;
  lavaRaymarchBlobState: Float32Array;
  lavaRaymarchBlobCount: number;
  lavaAddEmitAccumulator: number;
  lavaAddLastX: number;
  lavaAddLastY: number;
  waterDensityTexture: WebGLTexture | null;
  waterDensityFramebuffer: WebGLFramebuffer | null;
  waterDensityWidth: number;
  waterDensityHeight: number;
  waterSurfaceSupported: boolean;
  feedbackElement: HTMLDivElement | null;
  particleData: Float32Array;
  obstacleData: Float32Array;
  obstaclePointData: Float32Array;
  obstacleLineData: Float32Array;
  buildPreviewData: Float32Array;
  previousParticlePositions: Float32Array;
  fluidColumns: number;
  fluidRows: number;
  fluidCellWidth: number;
  fluidCellHeight: number;
  fluidVx: Float32Array;
  fluidVy: Float32Array;
  fluidPrevVx: Float32Array;
  fluidPrevVy: Float32Array;
  fluidWeight: Float32Array;
  fluidMarker: Uint8Array;
  fluidDivergence: Float32Array;
  fluidPressure: Float32Array;
  fluidPressureTemp: Float32Array;
  count: number;
  particleWriteCursor: number;
  obstacleCount: number;
  obstaclePointCount: number;
  obstacleLineCount: number;
  capacity: number;
  obstacleCapacity: number;
  gridHead: Int32Array;
  gridNext: Int32Array;
  pointer: PointerState;
  pendingGestures: GestureEvent[];
  modeId: string;
  preset: ParticleMetaballPreset;
  seed: number;
  needsSeed: boolean;
  cleanupPointer?: () => void;
}

const LAVA_RAYMARCH_BLOB_LIMIT = 24;
const LAVA_RAYMARCH_BLOB_STRIDE = 4;
const LAVA_RAYMARCH_STATE_STRIDE = 9;
const LAVA_ADD_EMIT_INTERVAL_SECONDS = 0.085;
const LAVA_ADD_EMIT_PACKET_SCALE = 0.28;

type RgbColor = readonly [number, number, number];

const MARKUP = `
  <canvas data-particle-metaball-canvas class="absolute inset-0 h-full w-full touch-none"></canvas>
  <div data-particle-metaball-feedback class="pointer-events-none absolute left-0 top-0 hidden rounded-full border border-white/35 bg-white/10"></div>
`;

// The legacy Water Tank solver is a compact 2D particle-fluid implementation
// inspired by David Li's WebGL fluid particles demo: https://github.com/dli/fluid
// It follows the same high-level idea - particle/grid velocity transfer,
// pressure projection, then particle velocity reconstruction - but is an
// original 2D implementation tailored to this raw WebGL scene.

const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec4 aData;
uniform vec2 uResolution;
uniform float uPointScale;
out float vTemperature;
out float vSeed;
out float vRadius;
void main() {
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vRadius = aData.z;
  vTemperature = aData.w;
  vSeed = aData.x * 0.017 + aData.y * 0.013 + aData.z;
  gl_PointSize = max(1.0, aData.z * uPointScale);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uHot;
uniform vec3 uWarm;
uniform vec3 uCold;
uniform float uOpacity;
uniform float uMetaball;
uniform float uStyle;
uniform float uTemperatureContrast;
in float vTemperature;
in float vSeed;
in float vRadius;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float temperature = clamp((vTemperature - 0.5) * uTemperatureContrast + 0.5, 0.0, 1.0);
  float heatColor = pow(temperature, 0.72);
  vec3 color = mix(uCold, uWarm, smoothstep(0.02, 0.5, heatColor));
  color = mix(color, uHot, smoothstep(0.4, 0.9, heatColor));
  color = min(color * 1.14, vec3(1.35));
  if (uStyle < -0.5) {
    outColor = vec4(color, uOpacity);
    return;
  }
  float core = exp(-d2 * mix(4.6, 0.72, uMetaball));
  float edge = 1.0 - smoothstep(mix(0.56, 0.86, uStyle), 1.0, d2);
  float ring = smoothstep(0.5, 0.94, d2) * (1.0 - smoothstep(0.88, 1.0, d2));
  float density = smoothstep(mix(0.16, 0.42, uMetaball), 1.0, core);
  float alpha = mix(edge * 0.72, density, uMetaball) * uOpacity;
  alpha = mix(alpha, max(alpha, ring * 0.58), smoothstep(0.55, 1.0, uStyle));
  float shade = 0.78 + 0.22 * sqrt(max(0.0, 1.0 - d2));
  float sparkle = fract(sin(vSeed * 93.17) * 43758.5453) * 0.06;
  color = mix(color, color * (0.76 + ring * 0.36), smoothstep(0.72, 1.0, uStyle));
  outColor = vec4(min(color * (shade + sparkle), vec3(1.4)), alpha);
}`;

const WATER_DENSITY_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec4 aData;
uniform vec2 uResolution;
uniform float uPointScale;
out float vFoam;
void main() {
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vFoam = aData.w;
  gl_PointSize = max(1.0, aData.z * uPointScale);
}`;

const WATER_DENSITY_FRAGMENT = `#version 300 es
precision highp float;
in float vFoam;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float density = exp(-d2 * 2.35);
  float lip = smoothstep(0.46, 0.92, d2) * (1.0 - smoothstep(0.9, 1.0, d2));
  outColor = vec4(density * 0.28, density * clamp(vFoam + lip * 0.4, 0.0, 1.0) * 0.2, density * 0.08, density * 0.22);
}`;

const QUAD_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const WATER_COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uDensity;
uniform vec2 uTexel;
uniform vec3 uFoamColor;
uniform vec3 uSurfaceColor;
uniform vec3 uDeepColor;
uniform float uOpacity;
uniform float uGlass;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 center = texture(uDensity, vUv);
  float density = center.r;
  float surface = smoothstep(0.12, 0.34, density);
  if (surface <= 0.002) discard;

  float left = texture(uDensity, vUv - vec2(uTexel.x, 0.0)).r;
  float right = texture(uDensity, vUv + vec2(uTexel.x, 0.0)).r;
  float down = texture(uDensity, vUv - vec2(0.0, uTexel.y)).r;
  float up = texture(uDensity, vUv + vec2(0.0, uTexel.y)).r;
  vec2 gradient = vec2(left - right, down - up);
  vec3 normal = normalize(vec3(gradient * 4.8, 1.0));
  vec3 light = normalize(vec3(-0.35, -0.62, 0.72));

  float lambert = clamp(dot(normal, light), 0.0, 1.0);
  float rim = smoothstep(0.11, 0.28, density) * (1.0 - smoothstep(0.36, 0.78, density));
  float depth = smoothstep(0.18, 0.95, density);
  float foam = clamp(center.g / max(center.r, 0.001), 0.0, 1.0);
  float sparkle = pow(max(0.0, dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0))), 48.0);

  vec3 color = mix(uSurfaceColor, uDeepColor, depth * 0.72);
  color = mix(color, uFoamColor, smoothstep(0.34, 0.86, foam) * 0.62 + rim * 0.36);
  color *= 0.76 + lambert * 0.32;
  color += uFoamColor * sparkle * mix(0.16, 0.38, uGlass);
  color += uSurfaceColor * rim * mix(0.08, 0.22, uGlass);

  float alpha = surface * mix(uOpacity, min(1.0, uOpacity + 0.22), uGlass);
  outColor = vec4(color, alpha);
}`;

// Lava lamp rendering uses the shared liquid-surface renderer fed by the live
// thermal particle field.
const LAVA_RAYMARCH_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCameraPosition;
uniform vec3 uHot;
uniform vec3 uWarm;
uniform vec3 uCold;
uniform vec3 uAccent;
uniform int uInteractiveBlobCount;
uniform vec4 uInteractiveBlobs[24];
in vec2 vUv;
out vec4 outColor;

const vec3 lightpos = vec3(-30.0, 2.0, 0.0);
#define MAX_STEPS 56
#define MAX_DIST 30.0
#define MIN_DIST 0.01

float smoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float effectiveRadius(float radius) {
  return radius * 1.14 + 0.045;
}

float blob(vec3 p, vec3 center, float radius) {
  return length(p - center) - effectiveRadius(radius);
}

float getDist(vec3 raypos) {
  float dist = 100.0;
  for (int i = 0; i < 24; i += 1) {
    if (i >= uInteractiveBlobCount) break;
    vec4 interactiveBlob = uInteractiveBlobs[i];
    if (interactiveBlob.w <= 0.018) continue;
    dist = smoothUnion(dist, blob(raypos, interactiveBlob.xyz, interactiveBlob.w), 0.48);
  }
  return dist;
}

float backgroundBlob(vec3 p, vec3 center, float radius) {
  return length(p - center) - radius;
}

float getBackgroundDist(vec3 raypos) {
  float time = uTime * 0.12;
  float topPlane = 2.35 - raypos.y;
  float bottomPlane = raypos.y + 2.35;
  float dist = smoothUnion(topPlane, bottomPlane, 0.85);
  dist = smoothUnion(dist, backgroundBlob(raypos, vec3(2.95, sin(time + 2.0) * 2.1, sin(time) * 1.55), 1.55), 0.82);
  dist = smoothUnion(dist, backgroundBlob(raypos, vec3(3.55, sin(time * 0.82 + 4.0) * 1.85, -3.05 - cos(time) * 0.75), 1.72), 0.88);
  dist = smoothUnion(dist, backgroundBlob(raypos, vec3(3.4, sin(time * 0.92 + 6.2) * 1.9, 3.0 + cos(time * 1.08) * 0.78), 1.68), 0.88);
  dist = smoothUnion(dist, backgroundBlob(raypos, vec3(4.45, sin(time * 0.58 + 8.3) * 1.65, -1.35 + cos(time * 0.7) * 1.18), 2.05), 1.02);
  dist = smoothUnion(dist, backgroundBlob(raypos, vec3(4.8, sin(time * 0.64 + 10.1) * 1.65, 1.7 - cos(time * 0.74) * 1.12), 1.98), 1.02);
  return dist;
}

float sphereHit(vec3 camera, vec3 dir, vec3 center, float radius) {
  vec3 oc = camera - center;
  float b = dot(oc, dir);
  float c = dot(oc, oc) - effectiveRadius(radius) * effectiveRadius(radius);
  float h = b * b - c;
  if (h < 0.0) return MAX_DIST;
  float t = -b - sqrt(h);
  return t > 0.02 ? t : MAX_DIST;
}

float raySphereFallback(vec3 camera, vec3 dir) {
  float hit = MAX_DIST;
  for (int i = 0; i < 24; i += 1) {
    if (i >= uInteractiveBlobCount) break;
    vec4 interactiveBlob = uInteractiveBlobs[i];
    if (interactiveBlob.w <= 0.018) continue;
    hit = min(hit, sphereHit(camera, dir, interactiveBlob.xyz, interactiveBlob.w));
  }
  return hit;
}

vec3 getNormal(vec3 p) {
  vec2 e = vec2(0.026, 0.0);
  return normalize(vec3(
    getDist(p + e.xyy) - getDist(p - e.xyy),
    getDist(p + e.yxy) - getDist(p - e.yxy),
    getDist(p + e.yyx) - getDist(p - e.yyx)
  ));
}

vec3 getBackgroundNormal(vec3 p) {
  vec2 e = vec2(0.04, 0.0);
  return normalize(vec3(
    getBackgroundDist(p + e.xyy) - getBackgroundDist(p - e.xyy),
    getBackgroundDist(p + e.yxy) - getBackgroundDist(p - e.yxy),
    getBackgroundDist(p + e.yyx) - getBackgroundDist(p - e.yyx)
  ));
}

float getLight(vec3 p) {
  vec3 lightdir = normalize(lightpos - p);
  vec3 normal = getNormal(p);
  return clamp(dot(normal, lightdir), 0.0, 1.0);
}

float getBackgroundLight(vec3 p) {
  vec3 lightdir = normalize(lightpos - p);
  vec3 normal = getBackgroundNormal(p);
  return clamp(dot(normal, lightdir), 0.0, 1.0);
}

float raymarch(vec3 camera, vec3 dir) {
  float dist = 0.35;
  for (int i = 0; i < MAX_STEPS; i += 1) {
    vec3 pos = camera + dir * dist;
    float stepdist = getDist(pos);
    if (stepdist < MIN_DIST) return dist;
    dist += max(stepdist * 0.62, 0.012);
    if (dist > MAX_DIST) break;
  }
  return MAX_DIST;
}

float raymarchBackground(vec3 camera, vec3 dir) {
  float dist = 1.55;
  for (int i = 0; i < 40; i += 1) {
    vec3 pos = camera + dir * dist;
    float stepdist = getBackgroundDist(pos);
    if (stepdist < 0.02) return dist;
    dist += max(stepdist * 0.72, 0.018);
    if (dist > MAX_DIST) break;
  }
  return MAX_DIST;
}

vec3 renderBackgroundLayer(vec3 camera, vec3 ray, vec3 baseColor) {
  float d = raymarchBackground(camera, ray);
  vec2 uv = (gl_FragCoord.xy - uResolution.xy * 0.5) / uResolution.y;
  float vignette = smoothstep(1.35, 0.1, length(uv));
  vec3 ambient = mix(baseColor * 0.86, uCold * 0.34 + uAccent * 0.18 + uWarm * 0.12, vignette);
  if (d >= MAX_DIST - 0.1) return ambient;
  vec3 p = camera + ray * d;
  float diff = getBackgroundLight(p);
  vec3 normal = getBackgroundNormal(p);
  float rim = pow(1.0 - clamp(dot(normal, -ray), 0.0, 1.0), 2.0);
  float depthFade = smoothstep(18.0, 4.2, d);
  float heat = clamp((p.x - 2.1) * 0.36, 0.0, 1.0);
  vec3 coolWax = mix(uCold, uWarm, 0.28);
  vec3 backWax = mix(coolWax, uWarm * 1.05, smoothstep(0.02, 0.58, heat));
  backWax = mix(backWax, uHot * 1.08, smoothstep(0.48, 1.0, heat));
  vec3 shaded = backWax * (0.34 + diff * 0.5 + rim * 0.26);
  shaded += uAccent * rim * 0.12;
  shaded += uHot * smoothstep(9.5, 3.0, d) * 0.06;
  return mix(ambient, min(shaded, vec3(1.35)), 0.72 * depthFade);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution.xy * 0.5) / uResolution.y;
  vec3 ray = normalize(vec3(1.0, uv.y, uv.x));
  float d = min(raymarch(uCameraPosition, ray), raySphereFallback(uCameraPosition, ray));
  vec3 backgroundColor = mix(uCold * 0.32, uAccent * 0.16 + uWarm * 0.05, 0.45);
  vec3 backgroundLayer = renderBackgroundLayer(uCameraPosition, ray, backgroundColor);
  if (d >= MAX_DIST - 0.1) {
    outColor = vec4(backgroundLayer, 1.0);
    return;
  }
  vec3 p = uCameraPosition + ray * d;
  float diff = getLight(p);
  vec3 normal = getNormal(p);
  float rim = pow(1.0 - clamp(dot(normal, -ray), 0.0, 1.0), 2.2);
  float glow = smoothstep(8.0, 1.8, d);
  float heat = clamp((p.x + 0.42) * 1.55, 0.0, 1.0);
  vec3 coolWax = mix(uCold, uWarm, 0.24);
  vec3 lavaColor = mix(coolWax, uWarm * 1.08, smoothstep(0.08, 0.68, heat));
  lavaColor = mix(lavaColor, uHot * 1.26, smoothstep(0.58, 1.0, heat));
  float hotZone = smoothstep(0.7, 1.0, heat);
  float highlight = hotZone * (0.28 + diff * 0.42) + pow(rim, 1.7) * 0.18;
  vec3 color = lavaColor * (0.54 + diff * 0.54 + rim * 0.24);
  color += uHot * glow * 0.2;
  color += uHot * highlight * 0.34;
  color += uAccent * (rim * 0.12 + highlight * 0.14);
  outColor = vec4(mix(backgroundLayer, min(color, vec3(1.7)), 0.86), 1.0);
}`;

// The legacy density compositor remains as a fallback/reference path for future particle-driven variants.
const LAVA_DENSITY_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec4 aData;
uniform vec2 uResolution;
uniform float uPointScale;
out float vTemperature;
out float vSeed;
void main() {
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vTemperature = aData.w;
  vSeed = aData.x * 0.019 + aData.y * 0.011 + aData.z;
  gl_PointSize = max(1.0, aData.z * uPointScale);
}`;

const LAVA_DENSITY_FRAGMENT = `#version 300 es
precision highp float;
in float vTemperature;
in float vSeed;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float density = exp(-d2 * 1.42);
  float core = 1.0 - smoothstep(0.0, 0.82, d2);
  float grain = fract(sin(vSeed * 71.31) * 43758.5453) * 0.035;
  outColor = vec4(density * 0.42, density * clamp(vTemperature + grain, 0.0, 1.0) * 0.42, core * 0.2, density * 0.24);
}`;

const LAVA_COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uDensity;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform vec3 uHot;
uniform vec3 uWarm;
uniform vec3 uCold;
uniform vec3 uAccent;
uniform float uOpacity;
uniform float uMetaball;
uniform float uStyle;
uniform float uTemperatureContrast;
in vec2 vUv;
out vec4 outColor;

void main() {
  vec4 center = texture(uDensity, vUv);
  float density = center.r;
  float threshold = mix(0.074, 0.12, uMetaball);
  float surface = smoothstep(threshold * 0.82, threshold * 1.08, density);

  float temperature = clamp((center.g / max(0.001, center.r) - 0.5) * uTemperatureContrast + 0.5, 0.0, 1.0);
  float heatColor = pow(temperature, 0.72);
  vec3 coolWax = mix(uCold, uAccent, 0.16);
  vec3 color = mix(coolWax, uWarm * 1.12, smoothstep(0.02, 0.52, heatColor));
  color = mix(color, uHot * 1.28, smoothstep(0.4, 0.9, heatColor));
  float alpha = surface * min(1.0, uOpacity + 0.32);
  if (alpha <= 0.002) {
    discard;
    return;
  }
  if (uStyle < 0.1) {
    float contour = surface * (1.0 - smoothstep(threshold * 1.0, threshold * 1.55, density));
    color = mix(color, color * 1.14 + uAccent * 0.08, contour * 0.45);
    outColor = vec4(min(color, vec3(1.45)), alpha);
    return;
  }

  float left = texture(uDensity, vUv - vec2(uTexel.x, 0.0)).r;
  float right = texture(uDensity, vUv + vec2(uTexel.x, 0.0)).r;
  float down = texture(uDensity, vUv - vec2(0.0, uTexel.y)).r;
  float up = texture(uDensity, vUv + vec2(0.0, uTexel.y)).r;
  vec2 gradient = vec2(left - right, down - up);
  vec3 normal = normalize(vec3(gradient * 5.6, 1.0));
  vec3 light = normalize(vec3(-0.58, -0.36, 0.74));

  float lambert = clamp(dot(normal, light), 0.0, 1.0);
  float rim = smoothstep(threshold * 0.74, threshold * 1.08, density) * (1.0 - smoothstep(threshold * 1.1, threshold * 2.4, density));
  float specular = pow(max(0.0, dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0))), 38.0);
  float verticalGlow = smoothstep(0.0, 0.22, vUv.y) + smoothstep(1.0, 0.78, vUv.y);

  color *= 0.92 + lambert * 0.28;
  color += uWarm * rim * 0.16;
  color += mix(uAccent, uHot, 0.5) * specular * 0.34;
  color += mix(uWarm, uHot, 0.42) * verticalGlow * 0.1 * surface;
  color = mix(color, color * (0.72 + rim * 0.52), smoothstep(0.62, 1.0, uStyle));

  outColor = vec4(min(color, vec3(1.5)), alpha);
}`;

const OBSTACLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aObstacle;
uniform vec2 uResolution;
out float vRadius;
void main() {
  vec2 clip = aObstacle.xy / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vRadius = aObstacle.z;
  gl_PointSize = max(2.0, aObstacle.z * 2.0);
}`;

const OBSTACLE_FRAGMENT = `#version 300 es
precision highp float;
in float vRadius;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  float edge = 1.0 - smoothstep(0.72, 1.0, d2);
  outColor = vec4(vec3(0.56, 0.58, 0.62) * (0.78 + 0.22 * edge), 0.88);
}`;

const OBSTACLE_LINE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aSegment;
layout(location = 1) in float aRadius;
uniform vec2 uResolution;
out vec2 vStart;
out vec2 vEnd;
out float vRadius;
void main() {
  vec2 midpoint = (aSegment.xy + aSegment.zw) * 0.5;
  vec2 clip = midpoint / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  vStart = vec2(aSegment.x, uResolution.y - aSegment.y);
  vEnd = vec2(aSegment.z, uResolution.y - aSegment.w);
  vRadius = aRadius;
  gl_PointSize = max(2.0, length(aSegment.zw - aSegment.xy) + aRadius * 2.4);
}`;

const OBSTACLE_LINE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vStart;
in vec2 vEnd;
in float vRadius;
out vec4 outColor;
void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 ab = vEnd - vStart;
  float t = clamp(dot(p - vStart, ab) / max(1.0, dot(ab, ab)), 0.0, 1.0);
  float d = length(p - (vStart + ab * t));
  float body = 1.0 - smoothstep(vRadius - 1.0, vRadius + 1.0, d);
  if (body <= 0.001) discard;
  float edge = smoothstep(vRadius, max(0.0, vRadius - 3.0), d);
  vec3 color = vec3(0.48, 0.50, 0.54) * (0.84 + edge * 0.16);
  outColor = vec4(color, body * 0.94);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create program');
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown program error';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

function random(seed: number): [number, number] {
  let next = seed | 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return [(next >>> 0) / 4294967296, next | 0];
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mixRgb(a: RgbColor, b: RgbColor, amount: number): RgbColor {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ];
}

function boostRgb(color: RgbColor, gain: number, lift: number, ceiling: number): RgbColor {
  return [
    Math.min(ceiling, color[0] * gain + lift),
    Math.min(ceiling, color[1] * gain + lift),
    Math.min(ceiling, color[2] * gain + lift),
  ];
}

function lavaWaxPalette(palette: number[]): { hot: RgbColor; warm: RgbColor; cold: RgbColor; accent: RgbColor } {
  const hotBase = colorNumberToRgb(palette[0], [1, 0.55, 0.1]) as RgbColor;
  const warmBase = colorNumberToRgb(palette[1], [1, 0.12, 0.05]) as RgbColor;
  const shadowBase = colorNumberToRgb(palette[2], [0.15, 0.22, 0.55]) as RgbColor;
  const accentBase = colorNumberToRgb(palette[3] ?? palette[0], [1, 0.72, 0.18]) as RgbColor;
  return {
    hot: boostRgb(mixRgb(hotBase, accentBase, 0.08), 1.16, 0.04, 1.35),
    warm: boostRgb(mixRgb(warmBase, accentBase, 0.12), 1.08, 0.035, 1.2),
    cold: boostRgb(mixRgb(mixRgb(shadowBase, warmBase, 0.68), accentBase, 0.16), 1.04, 0.055, 1.05),
    accent: boostRgb(accentBase, 1.1, 0.03, 1.25),
  };
}

function lavaTurbulenceField(x: number, y: number, width: number, height: number, time: number): [number, number] {
  const nx = x / Math.max(1, width);
  const ny = y / Math.max(1, height);
  const slow = time * 0.18;
  const medium = time * 0.31;
  const lateral = Math.sin(ny * Math.PI * 2.2 + slow)
    + Math.sin((nx * 1.4 + ny * 0.72) * Math.PI * 2 - medium) * 0.55;
  const vertical = Math.cos(nx * Math.PI * 2 + slow * 1.25) * 0.58
    + Math.sin((ny * 1.35 - nx * 0.6) * Math.PI * 2 + medium) * 0.34;
  return [lateral, vertical];
}

function modeForPreset(preset: ParticleMetaballPreset): string {
  return preset === 'water-tank' ? 'pour' : 'add';
}

function maxParticles(state: ParticleMetaballState, preset: ParticleMetaballPreset): number {
  const fallback = preset === 'water-tank' ? 7000 : 360;
  return Math.min(state.capacity, Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'maxParticles', fallback))));
}

function particleRadius(state: ParticleMetaballState, preset: ParticleMetaballPreset): number {
  return preset === 'water-tank'
    ? finiteNumberSetting(state.settings, 'particleRadius', 4.8)
    : finiteNumberSetting(state.settings, 'blobRadius', 22);
}

function clearScene(state: ParticleMetaballState, preset: ParticleMetaballPreset): void {
  state.count = 0;
  state.obstacleCount = 0;
  state.obstaclePointCount = 0;
  state.obstacleLineCount = 0;
  state.lavaRaymarchBlobCount = 0;
  state.lavaAddEmitAccumulator = 0;
  state.lavaAddLastX = 0;
  state.lavaAddLastY = 0;
  state.particleWriteCursor = 0;
  state.pendingGestures.length = 0;
  state.needsSeed = true;
  if (state.width <= 1 || state.height <= 1) return;
  if (preset === 'water-tank') {
    seedWater(state, state.width, state.height, state.canvas.clientWidth < 320);
  } else {
    seedLava(state, state.width, state.height, state.canvas.clientWidth < 320);
  }
}

function seedLava(state: ParticleMetaballState, width: number, height: number, lite: boolean): void {
  const requestedTarget = Math.floor(finiteNumberSetting(state.settings, 'initialBlobs', 150));
  const target = Math.min(maxParticles(state, 'lava-lamp'), lite ? clamp(requestedTarget, 56, 108) : requestedTarget);
  state.count = 0;
  state.lavaRaymarchBlobCount = 0;
  const baseRadius = particleRadius(state, 'lava-lamp');
  const radius = lite ? Math.max(baseRadius, Math.min(width, height) * 0.052) : baseRadius;
  const clusterCount = Math.max(lite ? 3 : 4, Math.min(lite ? 5 : 12, Math.round(Math.sqrt(target) * 0.9)));
  const clusterX = new Float32Array(clusterCount);
  const clusterY = new Float32Array(clusterCount);
  const clusterHeat = new Float32Array(clusterCount);
  const clusterDrift = new Float32Array(clusterCount);
  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    let r = 0;
    [r, state.seed] = random(state.seed + cluster * 97 + 17);
    const lane = r - 0.5;
    [r, state.seed] = random(state.seed + cluster * 101 + 31);
    const y = height * (0.58 + r * 0.34);
    clusterX[cluster] = clamp(width * 0.5 + lane * (width - radius * 6), radius * 2, width - radius * 2);
    clusterY[cluster] = y;
    [r, state.seed] = random(state.seed + cluster * 109 + 43);
    clusterHeat[cluster] = clamp(0.18 + ((y / Math.max(1, height) - 0.58) / 0.34) * 0.3 + r * 0.13, 0.14, 0.64);
    clusterDrift[cluster] = lane * 18;
  }
  for (let i = 0; i < target; i += 1) {
    let r = 0;
    const cluster = i % clusterCount;
    [r, state.seed] = random(state.seed + i * 17);
    const angle = r * Math.PI * 2;
    [r, state.seed] = random(state.seed + i * 31);
    const spread = Math.sqrt(r) * radius * 1.55;
    [r, state.seed] = random(state.seed + i * 79);
    const x = clusterX[cluster] + Math.cos(angle) * spread;
    const y = clusterY[cluster] + Math.sin(angle) * spread * 0.82;
    const jitter = (r - 0.5) * radius * 1.25;
    addParticle(
      state,
      x,
      y,
      radius * (0.82 + r * 0.42),
      clusterDrift[cluster] + Math.cos(angle) * jitter,
      -35 * clusterHeat[cluster] + Math.sin(angle) * jitter,
      clusterHeat[cluster],
    );
  }
  projectLavaParticlesToRaymarchBlobs(state, 1);
  state.needsSeed = false;
}

function screenToLavaRaymarchPoint(state: ParticleMetaballState, x: number, y: number, temperature: number): [number, number, number] {
  const height = Math.max(1, state.height);
  return [
    -0.24 + (temperature - 0.5) * 0.18,
    (state.height * 0.5 - y) / height * 6,
    (x - state.width * 0.5) / height * 6,
  ];
}

function lavaRaymarchRadiusFromPixels(state: ParticleMetaballState, radius: number): number {
  return clamp(radius / Math.max(1, state.height) * 14, 0.22, 0.72);
}

function updateLavaRaymarchBlobs(state: ParticleMetaballState): void {
  for (let i = 0; i < LAVA_RAYMARCH_BLOB_LIMIT; i += 1) {
    const sourceIndex = i * LAVA_RAYMARCH_STATE_STRIDE;
    const targetIndex = i * LAVA_RAYMARCH_BLOB_STRIDE;
    state.lavaRaymarchBlobData[targetIndex] = state.lavaRaymarchBlobState[sourceIndex];
    state.lavaRaymarchBlobData[targetIndex + 1] = state.lavaRaymarchBlobState[sourceIndex + 1];
    state.lavaRaymarchBlobData[targetIndex + 2] = state.lavaRaymarchBlobState[sourceIndex + 2];
    state.lavaRaymarchBlobData[targetIndex + 3] = state.lavaRaymarchBlobState[sourceIndex + 3];
  }
}

function projectLavaParticlesToRaymarchBlobs(state: ParticleMetaballState, dt: number): void {
  const count = state.count;
  if (count <= 0) {
    const smoothing = clamp(finiteNumberSetting(state.settings, 'ultraSmoothing', 0.84), 0, 0.95);
    const radiusFollow = dt >= 0.99 ? 1 : clamp(1 - Math.pow(clamp(smoothing + 0.08, 0, 0.98), dt * 60), 0.018, 1);
    for (let slot = 0; slot < LAVA_RAYMARCH_BLOB_LIMIT; slot += 1) {
      const index = slot * LAVA_RAYMARCH_STATE_STRIDE;
      state.lavaRaymarchBlobState[index + 3] += (0 - state.lavaRaymarchBlobState[index + 3]) * radiusFollow;
      state.lavaRaymarchBlobState[index + 7] = 0;
    }
    state.lavaRaymarchBlobCount = LAVA_RAYMARCH_BLOB_LIMIT;
    return;
  }

  const particleData = state.particleData;
  const blobState = state.lavaRaymarchBlobState;
  const clusterWeight = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT);
  const clusterX = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT);
  const clusterY = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT);
  const clusterZ = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT);
  const clusterTemperature = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT);
  const clusterSpread = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT);
  const seedY = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT);
  const seedZ = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT);
  const assignments = new Int16Array(count);
  const activeSlots = new Uint8Array(LAVA_RAYMARCH_BLOB_LIMIT);
  for (let i = 0; i < LAVA_RAYMARCH_BLOB_LIMIT; i += 1) {
    const index = i * LAVA_RAYMARCH_STATE_STRIDE;
    seedY[i] = blobState[index + 1];
    seedZ[i] = blobState[index + 2];
    activeSlots[i] = blobState[index + 3] > 0.03 ? 1 : 0;
  }

  const targetRadius = particleRadius(state, 'lava-lamp');
  const assignRadius = lavaRaymarchRadiusFromPixels(state, targetRadius * 2.1) * 1.18;
  for (let i = 0; i < count; i += 1) {
    const particleIndex = i * 6;
    const temperature = particleData[particleIndex + 5];
    const [worldX, worldY, worldZ] = screenToLavaRaymarchPoint(state, particleData[particleIndex], particleData[particleIndex + 1], temperature);
    let bestCluster = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let cluster = 0; cluster < LAVA_RAYMARCH_BLOB_LIMIT; cluster += 1) {
      if (activeSlots[cluster] === 0) continue;
      const distance = Math.hypot(worldY - seedY[cluster], worldZ - seedZ[cluster]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCluster = cluster;
      }
    }
    if (bestCluster < 0 || bestDistance > assignRadius) {
      for (let cluster = 0; cluster < LAVA_RAYMARCH_BLOB_LIMIT; cluster += 1) {
        if (activeSlots[cluster] !== 0) continue;
        bestCluster = cluster;
        seedY[bestCluster] = worldY;
        seedZ[bestCluster] = worldZ;
        activeSlots[bestCluster] = 1;
        break;
      }
    }
    if (bestCluster < 0) bestCluster = 0;
    assignments[i] = bestCluster;
    const weight = 0.62 + temperature * 0.92 + particleData[particleIndex + 4] / Math.max(1, targetRadius) * 0.36;
    clusterWeight[bestCluster] += weight;
    clusterX[bestCluster] += worldX * weight;
    clusterY[bestCluster] += worldY * weight;
    clusterZ[bestCluster] += worldZ * weight;
    clusterTemperature[bestCluster] += temperature * weight;
  }

  for (let cluster = 0; cluster < LAVA_RAYMARCH_BLOB_LIMIT; cluster += 1) {
    const weight = clusterWeight[cluster];
    if (weight <= 0.001) continue;
    clusterX[cluster] /= weight;
    clusterY[cluster] /= weight;
    clusterZ[cluster] /= weight;
    clusterTemperature[cluster] /= weight;
  }

  for (let i = 0; i < count; i += 1) {
    const cluster = assignments[i];
    const weight = clusterWeight[cluster];
    if (weight <= 0.001) continue;
    const particleIndex = i * 6;
    const temperature = particleData[particleIndex + 5];
    const [, worldY, worldZ] = screenToLavaRaymarchPoint(state, particleData[particleIndex], particleData[particleIndex + 1], temperature);
    clusterSpread[cluster] += Math.hypot(worldY - clusterY[cluster], worldZ - clusterZ[cluster]);
  }

  const smoothing = clamp(finiteNumberSetting(state.settings, 'ultraSmoothing', 0.84), 0, 0.95);
  const follow = dt >= 0.99 ? 1 : clamp(1 - Math.pow(smoothing, dt * 60), 0.025, 1);
  const radiusFollow = dt >= 0.99 ? 1 : clamp(1 - Math.pow(clamp(smoothing + 0.08, 0, 0.98), dt * 60), 0.018, 1);
  for (let cluster = 0; cluster < LAVA_RAYMARCH_BLOB_LIMIT; cluster += 1) {
    const weight = clusterWeight[cluster];
    const sourceIndex = cluster * LAVA_RAYMARCH_STATE_STRIDE;
    const currentRadius = Math.max(0, blobState[sourceIndex + 3]);
    const active = weight >= 1.25;
    const spread = active ? clusterSpread[cluster] / Math.max(1, count) : 0;
    const radius = active ? clamp(0.065 + Math.sqrt(weight) * 0.062 + spread * 0.28, 0.1, 0.58) : 0;
    const targetX = active ? clusterX[cluster] : blobState[sourceIndex + 4];
    const targetY = active ? clusterY[cluster] : blobState[sourceIndex + 5];
    const targetZ = active ? clusterZ[cluster] : blobState[sourceIndex + 6];
    const targetTemperature = active ? clusterTemperature[cluster] : blobState[sourceIndex + 8];
    if (active && currentRadius <= 0.03) {
      blobState[sourceIndex] = targetX;
      blobState[sourceIndex + 1] = targetY;
      blobState[sourceIndex + 2] = targetZ;
    }
    blobState[sourceIndex] += (targetX - blobState[sourceIndex]) * follow;
    blobState[sourceIndex + 1] += (targetY - blobState[sourceIndex + 1]) * follow;
    blobState[sourceIndex + 2] += (targetZ - blobState[sourceIndex + 2]) * follow;
    blobState[sourceIndex + 3] += (radius - currentRadius) * radiusFollow;
    blobState[sourceIndex + 4] = targetX;
    blobState[sourceIndex + 5] = targetY;
    blobState[sourceIndex + 6] = targetZ;
    blobState[sourceIndex + 7] = radius;
    blobState[sourceIndex + 8] = targetTemperature;
  }
  state.lavaRaymarchBlobCount = LAVA_RAYMARCH_BLOB_LIMIT;
}

function addLavaMetaballSeed(state: ParticleMetaballState, x: number, y: number, dx: number, dy: number, heat: number, intensity: number, packetScale = 1): void {
  const radius = particleRadius(state, 'lava-lamp');
  const baseSeedCount = state.capacity <= 160 ? 6 : 14;
  const seedCount = Math.max(1, Math.round(baseSeedCount * packetScale));
  const spreadRadius = finiteNumberSetting(state.settings, 'inputRadius', 90) * 0.36;
  for (let i = 0; i < seedCount; i += 1) {
    let r = 0;
    [r, state.seed] = random(state.seed + 4307 + i * 31);
    const angle = r * Math.PI * 2;
    [r, state.seed] = random(state.seed + 4339 + i * 37);
    const spread = Math.sqrt(r) * spreadRadius;
    [r, state.seed] = random(state.seed + 4373 + i * 41);
    const jitter = (r - 0.5) * radius * 3.2;
    addParticle(
      state,
      x + Math.cos(angle) * spread,
      y + Math.sin(angle) * spread,
      radius * (0.82 + r * 0.34),
      dx * 2 + Math.cos(angle) * jitter,
      dy * 2 - heat * 55 * intensity + Math.sin(angle) * jitter,
      heat > 0 ? 0.72 : 0.1,
    );
  }
}

function removeLavaWax(state: ParticleMetaballState, x: number, y: number, radius: number, intensity: number): void {
  const data = state.particleData;
  let writeIndex = 0;
  for (let i = 0; i < state.count; i += 1) {
    const sourceIndex = i * 6;
    const distance = Math.hypot(data[sourceIndex] - x, data[sourceIndex + 1] - y);
    let keep = true;
    if (distance < radius) {
      const falloff = 1 - distance / Math.max(1, radius);
      const removal = falloff * intensity;
      keep = removal < 0.48;
      if (keep) {
        data[sourceIndex + 2] *= 1 - removal * 0.42;
        data[sourceIndex + 3] *= 1 - removal * 0.42;
        data[sourceIndex + 4] *= 1 - removal * 0.28;
        data[sourceIndex + 5] = clamp(data[sourceIndex + 5] - removal * 0.16, 0, 1);
      }
    }
    if (!keep) continue;
    if (writeIndex !== i) {
      const targetIndex = writeIndex * 6;
      data[targetIndex] = data[sourceIndex];
      data[targetIndex + 1] = data[sourceIndex + 1];
      data[targetIndex + 2] = data[sourceIndex + 2];
      data[targetIndex + 3] = data[sourceIndex + 3];
      data[targetIndex + 4] = data[sourceIndex + 4];
      data[targetIndex + 5] = data[sourceIndex + 5];
    }
    writeIndex += 1;
  }
  state.count = writeIndex;
  state.particleWriteCursor = writeIndex % Math.max(1, maxParticles(state, 'lava-lamp'));
}

function seedWater(state: ParticleMetaballState, width: number, height: number, lite: boolean): void {
  const radius = particleRadius(state, 'water-tank');
  const columns = Math.max(8, Math.floor(width / (radius * 2.15)));
  const rows = Math.max(4, Math.floor(height * (lite ? 0.28 : 0.42) / (radius * 2.05)));
  const target = Math.min(maxParticles(state, 'water-tank'), columns * rows);
  state.count = 0;
  for (let i = 0; i < target; i += 1) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    let jitter = 0;
    [jitter, state.seed] = random(state.seed + i * 13);
    const x = width * 0.08 + col * radius * 2.15 + (jitter - 0.5) * radius * 0.7;
    [jitter, state.seed] = random(state.seed + 23);
    const y = height * 0.92 - row * radius * 2.05 + (jitter - 0.5) * radius * 0.4;
    addParticle(state, x, y, radius, 0, 0, 0.35 + row / Math.max(1, rows) * 0.35);
  }
  seedWaterObstacles(state, width, height, lite, finiteNumberSetting(state.settings, 'buildRadius', 18));
  state.needsSeed = false;
}

function seedWaterObstacles(state: ParticleMetaballState, width: number, height: number, lite: boolean, radius: number): void {
  const rampCount = Math.max(0, Math.floor(finiteNumberSetting(state.settings, 'obstacleRamps', lite ? 2 : 4)));
  const pegCount = Math.max(0, Math.floor(finiteNumberSetting(state.settings, 'obstaclePegs', lite ? 1 : 3)));
  const cappedRampCount = Math.min(lite ? 3 : 8, rampCount);
  const cappedPegCount = Math.min(lite ? 4 : 10, pegCount);
  for (let i = 0; i < cappedRampCount; i += 1) {
    let r = 0;
    [r, state.seed] = random(state.seed + 9109 + i * 37);
    const fromLeft = (i % 2 === 0) === (r > 0.35);
    const lane = (i + 1) / (cappedRampCount + 1);
    [r, state.seed] = random(state.seed + 9133 + i * 41);
    const y = height * (0.34 + lane * 0.46 + (r - 0.5) * 0.1);
    [r, state.seed] = random(state.seed + 9161 + i * 43);
    const run = width * (0.28 + r * 0.22);
    [r, state.seed] = random(state.seed + 9199 + i * 47);
    const rise = height * (0.045 + r * 0.09) * (fromLeft ? 1 : -1);
    const x0 = fromLeft ? width * (0.12 + r * 0.12) : width * (0.88 - r * 0.12);
    const x1 = clamp(x0 + (fromLeft ? run : -run), width * 0.18, width * 0.82);
    addObstacleLine(state, x0, y, x1, clamp(y + rise, height * 0.18, height * 0.84));
  }

  for (let i = 0; i < cappedPegCount; i += 1) {
    let r = 0;
    [r, state.seed] = random(state.seed + 9281 + i * 53);
    const x = width * (0.28 + r * 0.44);
    [r, state.seed] = random(state.seed + 9311 + i * 59);
    const y = height * (0.34 + r * 0.32);
    [r, state.seed] = random(state.seed + 9343 + i * 61);
    addObstacle(state, x, y, radius * (0.9 + r * 0.65));
  }
}

function enforceParticleLimit(state: ParticleMetaballState): void {
  const limit = maxParticles(state, state.preset);
  if (state.count > limit) state.count = limit;
}

function addParticle(state: ParticleMetaballState, x: number, y: number, radius: number, vx: number, vy: number, temperature: number): void {
  const limit = maxParticles(state, state.preset);
  if (state.count >= limit && state.preset !== 'lava-lamp') return;
  const particleIndex = state.count >= limit ? state.particleWriteCursor % Math.max(1, limit) : state.count;
  const index = particleIndex * 6;
  state.particleData[index] = x;
  state.particleData[index + 1] = y;
  state.particleData[index + 2] = vx;
  state.particleData[index + 3] = vy;
  state.particleData[index + 4] = radius;
  state.particleData[index + 5] = clamp(temperature, 0, 1);
  if (state.count < limit) {
    state.count += 1;
    state.particleWriteCursor = state.count % Math.max(1, limit);
  } else if (state.preset === 'lava-lamp') {
    state.particleWriteCursor = (state.particleWriteCursor + 1) % Math.max(1, limit);
  }
}

function addObstacle(state: ParticleMetaballState, x: number, y: number, radius: number, renderPoint = true): void {
  if (state.obstacleCount >= state.obstacleCapacity) return;
  const index = state.obstacleCount * 3;
  state.obstacleData[index] = x;
  state.obstacleData[index + 1] = y;
  state.obstacleData[index + 2] = radius;
  state.obstacleCount += 1;
  if (!renderPoint || state.obstaclePointCount >= state.obstacleCapacity) return;
  const pointIndex = state.obstaclePointCount * 3;
  state.obstaclePointData[pointIndex] = x;
  state.obstaclePointData[pointIndex + 1] = y;
  state.obstaclePointData[pointIndex + 2] = radius;
  state.obstaclePointCount += 1;
}

function addObstacleRenderLine(state: ParticleMetaballState, x0: number, y0: number, x1: number, y1: number, radius: number): void {
  const distance = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
  const segments = Math.max(1, Math.ceil(distance / 180));
  for (let i = 0; i < segments; i += 1) {
    if (state.obstacleLineCount >= state.obstacleCapacity) return;
    const a = i / segments;
    const b = (i + 1) / segments;
    const index = state.obstacleLineCount * 5;
    state.obstacleLineData[index] = x0 + (x1 - x0) * a;
    state.obstacleLineData[index + 1] = y0 + (y1 - y0) * a;
    state.obstacleLineData[index + 2] = x0 + (x1 - x0) * b;
    state.obstacleLineData[index + 3] = y0 + (y1 - y0) * b;
    state.obstacleLineData[index + 4] = radius;
    state.obstacleLineCount += 1;
  }
}

function addObstacleLine(state: ParticleMetaballState, x0: number, y0: number, x1: number, y1: number): void {
  const radius = finiteNumberSetting(state.settings, 'buildRadius', 16);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.max(1, Math.hypot(dx, dy));
  addObstacleRenderLine(state, x0, y0, x1, y1, radius);
  const steps = Math.max(1, Math.ceil(distance / Math.max(3, radius * 0.72)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    addObstacle(state, x0 + dx * t, y0 + dy * t, radius, false);
  }
}

function pointerXY(canvas: HTMLCanvasElement, event: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / Math.max(1, rect.width);
  const sy = canvas.height / Math.max(1, rect.height);
  return [(event.clientX - rect.left) * sx, (event.clientY - rect.top) * sy];
}

function installPointer(state: ParticleMetaballState, preset: ParticleMetaballPreset): () => void {
  const down = (event: PointerEvent) => {
    const [x, y] = pointerXY(state.canvas, event);
    state.pointer = { active: true, id: event.pointerId, startX: x, startY: y, x, y, previousX: x, previousY: y };
    state.lavaAddEmitAccumulator = LAVA_ADD_EMIT_INTERVAL_SECONDS * 0.55;
    state.lavaAddLastX = x;
    state.lavaAddLastY = y;
    state.canvas.setPointerCapture(event.pointerId);
    if (preset === 'water-tank' && state.modeId === 'build') return;
    applyPointerTool(state, preset, x, y, 0, 0, true);
  };
  const move = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    const [x, y] = pointerXY(state.canvas, event);
    const dx = x - state.pointer.x;
    const dy = y - state.pointer.y;
    state.pointer.previousX = state.pointer.x;
    state.pointer.previousY = state.pointer.y;
    state.pointer.x = x;
    state.pointer.y = y;
    if (preset === 'water-tank' && state.modeId === 'build') return;
    applyPointerTool(state, preset, x, y, dx, dy, false);
  };
  const up = (event: PointerEvent) => {
    if (!state.pointer.active || state.pointer.id !== event.pointerId) return;
    const [x, y] = pointerXY(state.canvas, event);
    if (preset === 'water-tank' && state.modeId === 'build') {
      const distance = Math.hypot(x - state.pointer.startX, y - state.pointer.startY);
      if (distance < 8) addObstacle(state, x, y, finiteNumberSetting(state.settings, 'buildRadius', 16));
      else addObstacleLine(state, state.pointer.startX, state.pointer.startY, x, y);
    }
    state.lavaAddEmitAccumulator = 0;
    state.pointer.active = false;
  };
  state.canvas.addEventListener('pointerdown', down);
  state.canvas.addEventListener('pointermove', move);
  state.canvas.addEventListener('pointerup', up);
  state.canvas.addEventListener('pointercancel', up);
  return () => {
    state.canvas.removeEventListener('pointerdown', down);
    state.canvas.removeEventListener('pointermove', move);
    state.canvas.removeEventListener('pointerup', up);
    state.canvas.removeEventListener('pointercancel', up);
  };
}

function applyPointerTool(state: ParticleMetaballState, preset: ParticleMetaballPreset, x: number, y: number, dx: number, dy: number, first: boolean, thermalIntent?: number): void {
  if (preset === 'lava-lamp') {
    const radius = finiteNumberSetting(state.settings, 'inputRadius', 90);
    const removing = typeof thermalIntent === 'number' ? thermalIntent < 0 : state.modeId === 'remove';
    const intensity = typeof thermalIntent === 'number' ? clamp(Math.abs(thermalIntent), 0.25, 1.5) : 1;
    if (removing) {
      removeLavaWax(state, x, y, radius, intensity);
      return;
    }
    const lift = finiteNumberSetting(state.settings, 'inputLift', 240);
    const thermalRate = finiteNumberSetting(state.settings, 'inputThermalRate', 0.09);
    for (let i = 0; i < state.count; i += 1) {
      const k = i * 6;
      const px = state.particleData[k];
      const py = state.particleData[k + 1];
      const d = Math.hypot(px - x, py - y);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      state.particleData[k + 5] = clamp(state.particleData[k + 5] + falloff * thermalRate * intensity, 0, 1);
      state.particleData[k + 2] += dx * falloff * 7;
      state.particleData[k + 3] += dy * falloff * 7 - falloff * lift * intensity;
    }
    if (first && typeof thermalIntent === 'number') {
      addLavaMetaballSeed(state, x, y, dx, dy, 1, intensity, LAVA_ADD_EMIT_PACKET_SCALE);
    }
    return;
  }

  if (state.modeId === 'interact') {
    const radius = finiteNumberSetting(state.settings, 'interactionRadius', 72);
    const strength = finiteNumberSetting(state.settings, 'interactionStrength', 18);
    for (let i = 0; i < state.count; i += 1) {
      const k = i * 6;
      const d = Math.hypot(state.particleData[k] - x, state.particleData[k + 1] - y);
      if (d > radius) continue;
      const falloff = 1 - d / radius;
      state.particleData[k + 2] += dx * strength * falloff;
      state.particleData[k + 3] += dy * strength * falloff;
    }
    return;
  }

  const rate = Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'pourRate', 80) / 30));
  const radius = particleRadius(state, preset);
  for (let i = 0; i < rate; i += 1) {
    let r = 0;
    [r, state.seed] = random(state.seed + i * 37);
    const angle = r * Math.PI * 2;
    [r, state.seed] = random(state.seed + 11);
    const spread = Math.sqrt(r) * finiteNumberSetting(state.settings, 'pourRadius', 24);
    addParticle(state, x + Math.cos(angle) * spread, y + Math.sin(angle) * spread, radius, dx * 5 + (r - 0.5) * 80, dy * 5, 0.46);
  }
}

function applyGestures(state: ParticleMetaballState, preset: ParticleMetaballPreset): void {
  for (const gesture of state.pendingGestures.splice(0)) {
    const dx = gesture.dx ?? 0;
    const dy = gesture.dy ?? 0;
    applyPointerTool(state, preset, gesture.x, gesture.y, dx, dy, gesture.kind === 'tap', gesture.strength);
  }
}

function streamLavaAddWax(state: ParticleMetaballState, dt: number): void {
  if (!state.pointer.active || state.modeId !== 'add') {
    state.lavaAddEmitAccumulator = 0;
    return;
  }
  applyPointerTool(state, 'lava-lamp', state.pointer.x, state.pointer.y, 0, 0, false, 0.45);
  state.lavaAddEmitAccumulator += dt;
  let emissions = 0;
  while (state.lavaAddEmitAccumulator >= LAVA_ADD_EMIT_INTERVAL_SECONDS && emissions < 4) {
    state.lavaAddEmitAccumulator -= LAVA_ADD_EMIT_INTERVAL_SECONDS;
    const dx = state.pointer.x - state.lavaAddLastX;
    const dy = state.pointer.y - state.lavaAddLastY;
    addLavaMetaballSeed(state, state.pointer.x, state.pointer.y, dx, dy, 1, 0.62, LAVA_ADD_EMIT_PACKET_SCALE);
    state.lavaAddLastX = state.pointer.x;
    state.lavaAddLastY = state.pointer.y;
    emissions += 1;
  }
}

function simulateLava(state: ParticleMetaballState, dt: number): void {
  const width = state.width;
  const height = state.height;
  const gravity = finiteNumberSetting(state.settings, 'gravity', 80);
  const buoyancy = finiteNumberSetting(state.settings, 'buoyancy', 520);
  const thermalDrive = finiteNumberSetting(state.settings, 'thermalDrive', 1);
  const tension = finiteNumberSetting(state.settings, 'surfaceTension', 0.42);
  const clump = finiteNumberSetting(state.settings, 'clumping', 0.55);
  const viscosity = finiteNumberSetting(state.settings, 'waxViscosity', 0.58);
  const targetRadius = particleRadius(state, 'lava-lamp');
  const drag = Math.pow(Math.max(0.88, 0.972 - viscosity * 0.018), dt * 60);
  const heatTransfer = clamp(finiteNumberSetting(state.settings, 'heatTransfer', 0.012) * dt * 8, 0, 0.018);
  const turbulence = clamp(finiteNumberSetting(state.settings, 'turbulence', 0.55), 0, 4);
  const verticalTurbulence = clamp(finiteNumberSetting(state.settings, 'verticalTurbulence', 1), 0, 4);
  const turbulenceStrength = (Math.pow(turbulence, 1.35) * 132) + turbulence * 42;
  const count = state.count;
  const data = state.particleData;
  for (let i = 0; i < count; i += 1) {
    const k = i * 6;
    const x = data[k];
    const y = data[k + 1];
    data[k + 4] += (targetRadius - data[k + 4]) * Math.min(1, dt * 0.75);
    let temp = data[k + 5];
    const normalizedY = clamp(y / Math.max(1, height), 0, 1);
    const heatRegion = clamp(finiteNumberSetting(state.settings, 'heatRegion', 0.42), 0.05, 0.95);
    const coolRegion = clamp(finiteNumberSetting(state.settings, 'coolRegion', 0.46), 0.05, 0.95);
    const bottomHeat = Math.pow(clamp((normalizedY - (1 - heatRegion)) / heatRegion, 0, 1), 0.9);
    const topCool = Math.pow(clamp((coolRegion - normalizedY) / coolRegion, 0, 1), 0.9);
    const edgeDistance = Math.min(x, width - x) / Math.max(1, width * 0.5);
    const wallCooling = smoothstep(0.32, 0, edgeDistance) * 0.28;
    const heatRate = finiteNumberSetting(state.settings, 'heatRate', 0.08);
    const coolRate = finiteNumberSetting(state.settings, 'coolRate', 0.055);
    const thermalGradient = Math.pow(0.35 + Math.max(heatRate, coolRate), 0.42);
    temp += (bottomHeat * heatRate - topCool * coolRate) * thermalGradient * dt;
    temp -= wallCooling * coolRate * thermalGradient * dt;
    data[k + 5] = clamp(temp, 0, 1);
    const thermalLift = data[k + 5];
    const thermalMotion = (gravity - buoyancy * thermalLift) * thermalDrive;
    data[k + 3] += thermalMotion * dt;
    if (turbulenceStrength > 0.001) {
      const [flowX, flowY] = lavaTurbulenceField(x, y, width, height, state.timeSeconds);
      const centerWeight = 0.42 + smoothstep(0.02, 0.38, edgeDistance) * 0.58;
      const thermalBias = (thermalLift - 0.5) * 2;
      const roll = 0.9 + Math.abs(thermalBias) * 0.58;
      data[k + 2] += flowX * turbulenceStrength * centerWeight * roll * dt;
      data[k + 3] += flowY * turbulenceStrength * verticalTurbulence * centerWeight * (0.32 + Math.abs(thermalBias) * 0.34) * dt;
      data[k + 2] += thermalBias * flowY * turbulenceStrength * 0.32 * centerWeight * dt;
    }
  }
  solveLavaPairsWithGrid(state, Math.max(24, targetRadius * 4.8), tension, clump, heatTransfer);
  for (let i = 0; i < count; i += 1) {
    const k = i * 6;
    const radius = data[k + 4];
    data[k + 2] *= drag;
    data[k + 3] *= drag;
    data[k] += data[k + 2] * dt;
    data[k + 1] += data[k + 3] * dt;
    const left = radius;
    const right = width - radius;
    if (data[k] < left || data[k] > right) {
      data[k] = clamp(data[k], left, right);
      data[k + 2] *= -0.35;
    }
    if (data[k + 1] < radius || data[k + 1] > height - radius) {
      data[k + 1] = clamp(data[k + 1], radius, height - radius);
      data[k + 3] *= -0.25;
    }
  }
  projectLavaParticlesToRaymarchBlobs(state, dt);
}

function solveLavaPairsWithGrid(state: ParticleMetaballState, influenceCellSize: number, tension: number, clump: number, heatTransfer: number): void {
  const columns = Math.max(1, Math.ceil(state.width / influenceCellSize));
  const rows = Math.max(1, Math.ceil(state.height / influenceCellSize));
  const cells = columns * rows;
  if (state.gridHead.length < cells) state.gridHead = new Int32Array(cells);
  state.gridHead.fill(-1, 0, cells);
  const invCell = 1 / influenceCellSize;
  const data = state.particleData;

  for (let i = 0; i < state.count; i += 1) {
    const k = i * 6;
    const cx = clamp((data[k] * invCell) | 0, 0, columns - 1);
    const cy = clamp((data[k + 1] * invCell) | 0, 0, rows - 1);
    const cell = cx + cy * columns;
    state.gridNext[i] = state.gridHead[cell];
    state.gridHead[cell] = i;
  }

  for (let cy = 0; cy < rows; cy += 1) {
    const row = cy * columns;
    const nextRow = row + columns;
    for (let cx = 0; cx < columns; cx += 1) {
      const cell = row + cx;
      if (state.gridHead[cell] === -1) continue;
      collideLavaSelfCell(state, cell, tension, clump, heatTransfer);
      if (cx + 1 < columns) collideLavaCellPair(state, cell, cell + 1, tension, clump, heatTransfer);
      if (cy + 1 < rows) {
        collideLavaCellPair(state, cell, nextRow + cx, tension, clump, heatTransfer);
        if (cx > 0) collideLavaCellPair(state, cell, nextRow + cx - 1, tension, clump, heatTransfer);
        if (cx + 1 < columns) collideLavaCellPair(state, cell, nextRow + cx + 1, tension, clump, heatTransfer);
      }
    }
  }
}

function collideLavaSelfCell(state: ParticleMetaballState, cell: number, tension: number, clump: number, heatTransfer: number): void {
  for (let i = state.gridHead[cell]; i !== -1; i = state.gridNext[i]) {
    for (let j = state.gridNext[i]; j !== -1; j = state.gridNext[j]) {
      solveLavaPair(state, i, j, tension, clump, heatTransfer);
    }
  }
}

function collideLavaCellPair(state: ParticleMetaballState, a: number, b: number, tension: number, clump: number, heatTransfer: number): void {
  const headA = state.gridHead[a];
  const headB = state.gridHead[b];
  if (headA === -1 || headB === -1) return;
  for (let i = headA; i !== -1; i = state.gridNext[i]) {
    for (let j = headB; j !== -1; j = state.gridNext[j]) {
      solveLavaPair(state, i, j, tension, clump, heatTransfer);
    }
  }
}

function solveLavaPair(state: ParticleMetaballState, a: number, b: number, tension: number, clump: number, heatTransfer: number): void {
  const data = state.particleData;
  const ai = a * 6;
  const bi = b * 6;
  const dx = data[bi] - data[ai];
  const dy = data[bi + 1] - data[ai + 1];
  const dist = Math.max(0.001, Math.hypot(dx, dy));
  const combinedRadius = data[ai + 4] + data[bi + 4];
  const rest = combinedRadius * 0.96;
  const softRest = combinedRadius * 1.18;
  const influence = combinedRadius * 2.05;
  if (dist > influence) return;
  if (heatTransfer > 0) {
    const contact = 1 - smoothstep(combinedRadius * 0.82, influence, dist);
    const exchange = clamp(heatTransfer * contact, 0, 0.055);
    const heatDelta = (data[bi + 5] - data[ai + 5]) * exchange;
    data[ai + 5] = clamp(data[ai + 5] + heatDelta, 0, 1);
    data[bi + 5] = clamp(data[bi + 5] - heatDelta, 0, 1);
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = rest - dist;
  if (overlap > 0) {
    const push = overlap * (0.22 + tension * 1.1);
    data[ai + 2] -= nx * push;
    data[ai + 3] -= ny * push;
    data[bi + 2] += nx * push;
    data[bi + 3] += ny * push;
    return;
  }
  if (dist < softRest) {
    const compression = 1 - dist / softRest;
    const push = compression * compression * (0.7 + tension * 1.8);
    data[ai + 2] -= nx * push;
    data[ai + 3] -= ny * push;
    data[bi + 2] += nx * push;
    data[bi + 3] += ny * push;
    return;
  }
  const pull = (1 - smoothstep(softRest, influence, dist)) * clump * 2.4;
  data[ai + 2] += nx * pull;
  data[ai + 3] += ny * pull;
  data[bi + 2] -= nx * pull;
  data[bi + 3] -= ny * pull;
}

function simulateWater(state: ParticleMetaballState, dt: number): void {
  const data = state.particleData;
  const width = state.width;
  const height = state.height;
  const gravity = finiteNumberSetting(state.settings, 'gravity', 1450);
  const viscosity = finiteNumberSetting(state.settings, 'viscosity', 0.18);
  const flipness = clamp(finiteNumberSetting(state.settings, 'flipness', 0.84), 0, 1);
  const radius = particleRadius(state, 'water-tank');
  const safeDt = Math.max(1 / 240, dt);
  const velocityDamping = Math.pow(clamp(0.996 - viscosity * 0.035, 0.88, 0.999), dt * 60);
  ensureFluidGrid(state);
  for (let i = 0; i < state.count; i += 1) {
    const k = i * 6;
    const pi = i * 2;
    state.previousParticlePositions[pi] = data[k];
    state.previousParticlePositions[pi + 1] = data[k + 1];
    data[k + 4] = radius;
    data[k + 2] *= velocityDamping;
    data[k + 3] *= velocityDamping;
  }

  transferWaterParticlesToGrid(state);
  applyWaterGridForces(state, gravity, dt);
  state.fluidPrevVx.set(state.fluidVx);
  state.fluidPrevVy.set(state.fluidVy);
  projectWaterGrid(state);

  const maxSpeed = finiteNumberSetting(state.settings, 'maxFluidSpeed', 1800);
  for (let i = 0; i < state.count; i += 1) {
    const k = i * 6;
    const oldVx = data[k + 2];
    const oldVy = data[k + 3];
    const pic = sampleWaterGrid(state, data[k], data[k + 1], state.fluidVx, state.fluidVy);
    const previous = sampleWaterGrid(state, data[k], data[k + 1], state.fluidPrevVx, state.fluidPrevVy);
    const flipVx = oldVx + pic.vx - previous.vx;
    const flipVy = oldVy + pic.vy - previous.vy;
    data[k + 2] = pic.weight > 0.001 ? pic.vx * (1 - flipness) + flipVx * flipness : oldVx;
    data[k + 3] = pic.weight > 0.001 ? pic.vy * (1 - flipness) + flipVy * flipness : oldVy + gravity * dt;
    const speedValue = Math.hypot(data[k + 2], data[k + 3]);
    if (speedValue > maxSpeed) {
      const scale = maxSpeed / speedValue;
      data[k + 2] *= scale;
      data[k + 3] *= scale;
    }
    data[k] += data[k + 2] * safeDt;
    data[k + 1] += data[k + 3] * safeDt;
    solveWaterParticleBoundsAndObstacles(state, i, radius, width, height);
    const speed = Math.min(1, Math.hypot(data[k + 2], data[k + 3]) / 900);
    const depth = clamp(data[k + 1] / Math.max(1, height), 0, 1);
    const foam = speed * 0.62 + (1 - depth) * 0.2;
    data[k + 5] += (clamp(foam, 0.04, 1) - data[k + 5]) * 0.08;
  }
}

function ensureFluidGrid(state: ParticleMetaballState): void {
  const maxResolution = Math.max(16, Math.floor(finiteNumberSetting(state.settings, 'fluidGridResolution', 128)));
  const aspect = state.width / Math.max(1, state.height);
  const columns = aspect >= 1 ? maxResolution : Math.max(16, Math.round(maxResolution * aspect));
  const rows = aspect >= 1 ? Math.max(16, Math.round(maxResolution / aspect)) : maxResolution;
  const cells = columns * rows;
  state.fluidCellWidth = state.width / Math.max(1, columns);
  state.fluidCellHeight = state.height / Math.max(1, rows);
  if (state.fluidColumns === columns && state.fluidRows === rows && state.fluidVx.length === cells) return;
  state.fluidColumns = columns;
  state.fluidRows = rows;
  state.fluidVx = new Float32Array(cells);
  state.fluidVy = new Float32Array(cells);
  state.fluidPrevVx = new Float32Array(cells);
  state.fluidPrevVy = new Float32Array(cells);
  state.fluidWeight = new Float32Array(cells);
  state.fluidMarker = new Uint8Array(cells);
  state.fluidDivergence = new Float32Array(cells);
  state.fluidPressure = new Float32Array(cells);
  state.fluidPressureTemp = new Float32Array(cells);
}

function fluidIndex(state: ParticleMetaballState, x: number, y: number): number {
  return x + y * state.fluidColumns;
}

function markWaterGridSolids(state: ParticleMetaballState): void {
  const columns = state.fluidColumns;
  const rows = state.fluidRows;
  const halfCell = Math.max(state.fluidCellWidth, state.fluidCellHeight) * 0.55;
  state.fluidMarker.fill(0);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const index = fluidIndex(state, x, y);
      if (x === 0 || y === 0 || x === columns - 1 || y === rows - 1) {
        state.fluidMarker[index] = 2;
        continue;
      }
      const cx = (x + 0.5) * state.fluidCellWidth;
      const cy = (y + 0.5) * state.fluidCellHeight;
      for (let o = 0; o < state.obstacleCount; o += 1) {
        const oi = o * 3;
        const minDist = state.obstacleData[oi + 2] + halfCell;
        if (Math.hypot(cx - state.obstacleData[oi], cy - state.obstacleData[oi + 1]) <= minDist) {
          state.fluidMarker[index] = 2;
          break;
        }
      }
    }
  }
}

function splatWaterGridVelocity(state: ParticleMetaballState, x: number, y: number, vx: number, vy: number, weightScale: number): void {
  const gx = x / Math.max(1, state.fluidCellWidth) - 0.5;
  const gy = y / Math.max(1, state.fluidCellHeight) - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  for (let oy = 0; oy <= 1; oy += 1) {
    const cy = y0 + oy;
    if (cy < 0 || cy >= state.fluidRows) continue;
    const wy = oy === 0 ? 1 - ty : ty;
    for (let ox = 0; ox <= 1; ox += 1) {
      const cx = x0 + ox;
      if (cx < 0 || cx >= state.fluidColumns) continue;
      const index = fluidIndex(state, cx, cy);
      if (state.fluidMarker[index] === 2) continue;
      const wx = ox === 0 ? 1 - tx : tx;
      const weight = wx * wy * weightScale;
      state.fluidVx[index] += vx * weight;
      state.fluidVy[index] += vy * weight;
      state.fluidWeight[index] += weight;
    }
  }
}

function transferWaterParticlesToGrid(state: ParticleMetaballState): void {
  state.fluidVx.fill(0);
  state.fluidVy.fill(0);
  state.fluidWeight.fill(0);
  state.fluidPressure.fill(0);
  state.fluidPressureTemp.fill(0);
  markWaterGridSolids(state);
  const data = state.particleData;
  for (let i = 0; i < state.count; i += 1) {
    const k = i * 6;
    splatWaterGridVelocity(state, data[k], data[k + 1], data[k + 2], data[k + 3], 1);
  }
  for (let index = 0; index < state.fluidWeight.length; index += 1) {
    const weight = state.fluidWeight[index];
    if (state.fluidMarker[index] === 2) {
      state.fluidVx[index] = 0;
      state.fluidVy[index] = 0;
      continue;
    }
    if (weight > 0.0001) {
      state.fluidVx[index] /= weight;
      state.fluidVy[index] /= weight;
      state.fluidMarker[index] = 1;
    } else {
      state.fluidVx[index] = 0;
      state.fluidVy[index] = 0;
    }
  }
}

function applyWaterGridForces(state: ParticleMetaballState, gravity: number, dt: number): void {
  for (let i = 0; i < state.fluidVy.length; i += 1) {
    if (state.fluidMarker[i] !== 2) state.fluidVy[i] += gravity * dt;
  }
}

function projectWaterGrid(state: ParticleMetaballState): void {
  const columns = state.fluidColumns;
  const rows = state.fluidRows;
  const pressureIterations = Math.max(1, Math.floor(finiteNumberSetting(state.settings, 'pressureIterations', 36)));
  const densityPush = finiteNumberSetting(state.settings, 'densityPressure', 0.28);
  state.fluidDivergence.fill(0);
  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < columns - 1; x += 1) {
      const index = fluidIndex(state, x, y);
      if (state.fluidMarker[index] !== 1) continue;
      const left = fluidIndex(state, x - 1, y);
      const right = fluidIndex(state, x + 1, y);
      const up = fluidIndex(state, x, y - 1);
      const down = fluidIndex(state, x, y + 1);
      const vxLeft = state.fluidMarker[left] === 2 ? 0 : state.fluidVx[left];
      const vxRight = state.fluidMarker[right] === 2 ? 0 : state.fluidVx[right];
      const vyUp = state.fluidMarker[up] === 2 ? 0 : state.fluidVy[up];
      const vyDown = state.fluidMarker[down] === 2 ? 0 : state.fluidVy[down];
      const divergence = (vxRight - vxLeft) / Math.max(1, state.fluidCellWidth * 2) + (vyDown - vyUp) / Math.max(1, state.fluidCellHeight * 2);
      const compression = Math.max(0, state.fluidWeight[index] - 1.05) * densityPush;
      state.fluidDivergence[index] = divergence - compression;
    }
  }

  for (let iteration = 0; iteration < pressureIterations; iteration += 1) {
    state.fluidPressureTemp.fill(0);
    for (let y = 1; y < rows - 1; y += 1) {
      for (let x = 1; x < columns - 1; x += 1) {
        const index = fluidIndex(state, x, y);
        if (state.fluidMarker[index] !== 1) continue;
        let sum = 0;
        let count = 0;
        const neighbors = [
          fluidIndex(state, x - 1, y),
          fluidIndex(state, x + 1, y),
          fluidIndex(state, x, y - 1),
          fluidIndex(state, x, y + 1),
        ];
        for (const neighbor of neighbors) {
          if (state.fluidMarker[neighbor] === 2) continue;
          sum += state.fluidPressure[neighbor];
          count += 1;
        }
        state.fluidPressureTemp[index] = count > 0 ? (sum - state.fluidDivergence[index]) / count : 0;
      }
    }
    const swap = state.fluidPressure;
    state.fluidPressure = state.fluidPressureTemp;
    state.fluidPressureTemp = swap;
  }

  const pressureStrength = finiteNumberSetting(state.settings, 'pressureStrength', 0.92);
  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < columns - 1; x += 1) {
      const index = fluidIndex(state, x, y);
      if (state.fluidMarker[index] === 2) {
        state.fluidVx[index] = 0;
        state.fluidVy[index] = 0;
        continue;
      }
      const left = fluidIndex(state, x - 1, y);
      const right = fluidIndex(state, x + 1, y);
      const up = fluidIndex(state, x, y - 1);
      const down = fluidIndex(state, x, y + 1);
      const pressureLeft = state.fluidMarker[left] === 2 ? state.fluidPressure[index] : state.fluidPressure[left];
      const pressureRight = state.fluidMarker[right] === 2 ? state.fluidPressure[index] : state.fluidPressure[right];
      const pressureUp = state.fluidMarker[up] === 2 ? state.fluidPressure[index] : state.fluidPressure[up];
      const pressureDown = state.fluidMarker[down] === 2 ? state.fluidPressure[index] : state.fluidPressure[down];
      state.fluidVx[index] -= (pressureRight - pressureLeft) / Math.max(1, state.fluidCellWidth * 2) * pressureStrength;
      state.fluidVy[index] -= (pressureDown - pressureUp) / Math.max(1, state.fluidCellHeight * 2) * pressureStrength;
    }
  }
}

function sampleWaterGrid(state: ParticleMetaballState, x: number, y: number, vxGrid: Float32Array, vyGrid: Float32Array): { vx: number; vy: number; weight: number } {
  const gx = x / Math.max(1, state.fluidCellWidth) - 0.5;
  const gy = y / Math.max(1, state.fluidCellHeight) - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  let vx = 0;
  let vy = 0;
  let total = 0;
  for (let oy = 0; oy <= 1; oy += 1) {
    const cy = y0 + oy;
    if (cy < 0 || cy >= state.fluidRows) continue;
    const wy = oy === 0 ? 1 - ty : ty;
    for (let ox = 0; ox <= 1; ox += 1) {
      const cx = x0 + ox;
      if (cx < 0 || cx >= state.fluidColumns) continue;
      const index = fluidIndex(state, cx, cy);
      if (state.fluidMarker[index] === 2) continue;
      const weight = (ox === 0 ? 1 - tx : tx) * wy;
      vx += vxGrid[index] * weight;
      vy += vyGrid[index] * weight;
      total += weight;
    }
  }
  return { vx, vy, weight: total };
}

function solveWaterParticleBoundsAndObstacles(state: ParticleMetaballState, particleIndex: number, radius: number, width: number, height: number): void {
  const data = state.particleData;
  const k = particleIndex * 6;
  for (let o = 0; o < state.obstacleCount; o += 1) {
    const oi = o * 3;
    const dx = data[k] - state.obstacleData[oi];
    const dy = data[k + 1] - state.obstacleData[oi + 1];
    const minDist = radius + state.obstacleData[oi + 2];
    const dist = Math.max(0.001, Math.hypot(dx, dy));
    if (dist >= minDist) continue;
    const nx = dx / dist;
    const ny = dy / dist;
    data[k] += nx * (minDist - dist);
    data[k + 1] += ny * (minDist - dist);
    const vn = data[k + 2] * nx + data[k + 3] * ny;
    if (vn < 0) {
      data[k + 2] -= nx * vn;
      data[k + 3] -= ny * vn;
    }
  }
  if (data[k] < radius) {
    data[k] = radius;
    data[k + 2] = Math.max(0, data[k + 2]) * 0.18;
  } else if (data[k] > width - radius) {
    data[k] = width - radius;
    data[k + 2] = Math.min(0, data[k + 2]) * 0.18;
  }
  if (data[k + 1] < radius) {
    data[k + 1] = radius;
    data[k + 3] = Math.max(0, data[k + 3]) * 0.18;
  } else if (data[k + 1] > height - radius) {
    data[k + 1] = height - radius;
    data[k + 3] = Math.min(0, data[k + 3]) * 0.12;
    data[k + 2] *= 0.88;
  }
}

function renderParticles(state: ParticleMetaballState, preset: ParticleMetaballPreset): void {
  updatePointerFeedback(state, preset);
  const gl = state.gl;
  const style = state.style;
  const palette = style?.palette ?? (preset === 'water-tank' ? [0x5ee7ff, 0x0077ff, 0xb8f7ff] : [0xfff4a3, 0xff7a1f, 0x5d1300]);
  const background = style?.background ?? (preset === 'water-tank' ? 0x04131f : 0x120403);
  const bg = colorNumberToRgb(background, [0, 0, 0]);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  if (preset === 'water-tank' && state.obstacleLineCount > 0 && state.obstacleLineProgram && state.obstacleLineBuffer) {
    gl.useProgram(state.obstacleLineProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.obstacleLineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.obstacleLineData.subarray(0, state.obstacleLineCount * 5), gl.DYNAMIC_DRAW);
    gl.uniform2f(gl.getUniformLocation(state.obstacleLineProgram, 'uResolution'), state.width, state.height);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 16);
    gl.drawArrays(gl.POINTS, 0, state.obstacleLineCount);
  }

  if (preset === 'water-tank' && state.obstaclePointCount > 0 && state.obstacleProgram && state.obstacleBuffer) {
    gl.useProgram(state.obstacleProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.obstacleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.obstaclePointData.subarray(0, state.obstaclePointCount * 3), gl.DYNAMIC_DRAW);
    const res = gl.getUniformLocation(state.obstacleProgram, 'uResolution');
    gl.uniform2f(res, state.width, state.height);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.drawArrays(gl.POINTS, 0, state.obstaclePointCount);
  }
  if (
    preset === 'water-tank'
    && state.modeId === 'build'
    && state.pointer.active
    && state.obstacleLineProgram
    && state.obstacleLineBuffer
  ) {
    state.buildPreviewData[0] = state.pointer.startX;
    state.buildPreviewData[1] = state.pointer.startY;
    state.buildPreviewData[2] = state.pointer.x;
    state.buildPreviewData[3] = state.pointer.y;
    state.buildPreviewData[4] = finiteNumberSetting(state.settings, 'buildRadius', 16);
    gl.useProgram(state.obstacleLineProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.obstacleLineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, state.buildPreviewData.subarray(0, 5), gl.DYNAMIC_DRAW);
    gl.uniform2f(gl.getUniformLocation(state.obstacleLineProgram, 'uResolution'), state.width, state.height);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 16);
    gl.drawArrays(gl.POINTS, 0, 1);
  }

  const renderStyle = preset === 'lava-lamp' ? lavaRenderStyle(state) : typeof state.settings.renderStyle === 'string' ? state.settings.renderStyle : '';
  if (preset === 'lava-lamp' && (renderStyle === 'enhanced' || renderStyle === 'ultra') && renderLavaSharedLiquidSurface(state, palette, renderStyle)) return;
  if (!state.particleProgram || !state.particleBuffer || state.count <= 0) return;
  if (preset === 'water-tank' && renderStyle !== 'particles' && renderWaterSurface(state, palette, renderStyle)) return;
  if (renderStyle === 'surface' || renderStyle === 'glass') {
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  } else {
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.useProgram(state.particleProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, state.particleData.subarray(0, state.count * 6), gl.DYNAMIC_DRAW);
  gl.uniform2f(gl.getUniformLocation(state.particleProgram, 'uResolution'), state.width, state.height);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uPointScale'), pointScaleForRenderStyle(preset, renderStyle));
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uOpacity'), finiteNumberSetting(state.settings, 'opacity', preset === 'water-tank' ? 0.34 : 0.46));
  const styleWeight = renderStyle === 'basic'
    ? -1
    : renderStyle === 'cellular' || renderStyle === 'particles'
    ? 1
    : renderStyle === 'surface'
      ? 0.45
      : 0;
  const styleMetaballOffset = renderStyle === 'basic' ? -1 : renderStyle === 'particles' ? -0.42 : renderStyle === 'surface' ? -0.16 : renderStyle === 'glow' ? 0.08 : 0;
  const metaballBlend = clamp(finiteNumberSetting(state.settings, 'metaballBlend', preset === 'water-tank' ? 0.72 : 0.92) + styleMetaballOffset, 0, 1);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uMetaball'), metaballBlend);
  gl.uniform1f(gl.getUniformLocation(state.particleProgram, 'uStyle'), styleWeight);
  gl.uniform1f(
    gl.getUniformLocation(state.particleProgram, 'uTemperatureContrast'),
    preset === 'lava-lamp' ? finiteNumberSetting(state.settings, 'thermalContrast', 1.25) : 1,
  );
  const { hot, warm, cold } = preset === 'lava-lamp'
    ? lavaWaxPalette(palette)
    : {
      hot: colorNumberToRgb(palette[0], [1, 0.55, 0.1]) as RgbColor,
      warm: colorNumberToRgb(palette[1], [1, 0.12, 0.05]) as RgbColor,
      cold: colorNumberToRgb(palette[2], [0.15, 0.22, 0.55]) as RgbColor,
    };
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uHot'), hot[0], hot[1], hot[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uWarm'), warm[0], warm[1], warm[2]);
  gl.uniform3f(gl.getUniformLocation(state.particleProgram, 'uCold'), cold[0], cold[1], cold[2]);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
  gl.drawArrays(gl.POINTS, 0, state.count);
}

function renderLavaSurface(state: ParticleMetaballState, palette: number[], renderStyle: string): boolean {
  const gl = state.gl;
  if (!state.lavaRaymarchProgram || !ensureQuadBuffer(state)) return false;
  void renderStyle;
  updateLavaRaymarchBlobs(state);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.useProgram(state.lavaRaymarchProgram);
  gl.uniform2f(gl.getUniformLocation(state.lavaRaymarchProgram, 'uResolution'), state.width, state.height);
  gl.uniform1f(gl.getUniformLocation(state.lavaRaymarchProgram, 'uTime'), state.timeSeconds);
  gl.uniform3f(gl.getUniformLocation(state.lavaRaymarchProgram, 'uCameraPosition'), -6, 0, 0);
  const { hot, warm, cold, accent } = lavaWaxPalette(palette);
  gl.uniform3f(gl.getUniformLocation(state.lavaRaymarchProgram, 'uHot'), hot[0], hot[1], hot[2]);
  gl.uniform3f(gl.getUniformLocation(state.lavaRaymarchProgram, 'uWarm'), warm[0], warm[1], warm[2]);
  gl.uniform3f(gl.getUniformLocation(state.lavaRaymarchProgram, 'uCold'), cold[0], cold[1], cold[2]);
  gl.uniform3f(gl.getUniformLocation(state.lavaRaymarchProgram, 'uAccent'), accent[0], accent[1], accent[2]);
  gl.uniform1i(gl.getUniformLocation(state.lavaRaymarchProgram, 'uInteractiveBlobCount'), state.lavaRaymarchBlobCount);
  if (state.lavaRaymarchBlobCount > 0) {
    gl.uniform4fv(
      gl.getUniformLocation(state.lavaRaymarchProgram, 'uInteractiveBlobs[0]'),
      state.lavaRaymarchBlobData.subarray(0, state.lavaRaymarchBlobCount * LAVA_RAYMARCH_BLOB_STRIDE),
    );
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
}

void renderLavaMetaballSurface;

function encodeRgb(color: RgbColor): number {
  return (
    (Math.round(clamp(color[0], 0, 1) * 255) << 16)
    | (Math.round(clamp(color[1], 0, 1) * 255) << 8)
    | Math.round(clamp(color[2], 0, 1) * 255)
  );
}

function renderLavaSharedLiquidSurface(state: ParticleMetaballState, palette: number[], renderStyle: string): boolean {
  if (!state.lavaLiquidSurface || !state.particleBuffer || state.count <= 0) return false;
  const gl = state.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, state.particleData.subarray(0, state.count * 6), gl.DYNAMIC_DRAW);
  const metaballBlend = finiteNumberSetting(state.settings, 'metaballBlend', 0.86);
  const blobRadius = finiteNumberSetting(state.settings, 'blobRadius', 22);
  const options = liquidSurfaceOptionsFromSettings(
    {
      ...state.settings,
      liquidParticleRadius: finiteNumberSetting(state.settings, 'liquidParticleRadius', 1),
      liquidSplatDensity: finiteNumberSetting(state.settings, 'liquidSplatDensity', 1.55),
      liquidSurfaceThreshold: finiteNumberSetting(state.settings, 'liquidSurfaceThreshold', 0.11),
      liquidEdgeTightness: finiteNumberSetting(state.settings, 'liquidEdgeTightness', 0.76),
      liquidRefraction: finiteNumberSetting(state.settings, 'liquidRefraction', 0.32),
      liquidGloss: finiteNumberSetting(state.settings, 'liquidGloss', 0.72),
      liquidThermalStrength: finiteNumberSetting(state.settings, 'liquidThermalStrength', 0.82),
      opacity: finiteNumberSetting(state.settings, 'opacity', 0.46),
    },
    renderStyle === 'ultra' ? 'ultra' : 'enhanced',
  );
  options.pointScale *= clamp(finiteNumberSetting(state.settings, 'liquidExpansion', 1), 0.25, 2.5)
    * clamp(0.76 + metaballBlend * 0.34 + blobRadius * 0.004, 0.82, 1.52);
  options.densityScale *= clamp(0.92 + metaballBlend * 0.28, 0.92, 1.34);
  options.threshold *= clamp(1.02 + (1 - metaballBlend) * 0.18, 0.96, 1.28);
  options.tightness = clamp(
    options.tightness + finiteNumberSetting(state.settings, 'surfaceTension', 0.62) * 0.08,
    0.15,
    1,
  );
  options.foamStrength = 0;
  options.rimStrength = renderStyle === 'ultra' ? finiteNumberSetting(state.settings, 'liquidRimLighting', 1.15) : 0;
  const { hot, warm, cold } = lavaWaxPalette(palette);
  return renderLiquidSurfaceFromBufferParticles({
    state,
    renderer: state.lavaLiquidSurface,
    particleBuffer: state.particleBuffer,
    particleCount: state.count,
    strideBytes: 24,
    positionOffsetBytes: 0,
    velocityOffsetBytes: 8,
    renderDataOffsetBytes: 16,
    palette: {
      palette: [encodeRgb(warm), encodeRgb(warm), encodeRgb(cold), encodeRgb(hot)],
      background: state.style?.background,
    },
    options,
    resolution: Math.max(128, Math.min(2048, Math.round(
      state.width
      * clamp(finiteNumberSetting(state.settings, 'enhancedQuality', 1.15), 0.5, 2)
      * finiteNumberSetting(state.settings, 'liquidFieldScale', 0.82),
    ))),
  });
}

void LAVA_RAYMARCH_FRAGMENT;
void renderLavaSurface;

function renderLavaMetaballSurface(state: ParticleMetaballState, palette: number[], renderStyle: string): boolean {
  if (!ensureLavaSurfaceTargets(state)) return false;
  const gl = state.gl;
  if (!state.lavaDensityProgram || !state.lavaCompositeProgram || !state.particleBuffer || !state.quadBuffer || !state.lavaDensityFramebuffer || !state.lavaDensityTexture) return false;

  gl.bindFramebuffer(gl.FRAMEBUFFER, state.lavaDensityFramebuffer);
  gl.viewport(0, 0, state.lavaDensityWidth, state.lavaDensityHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(state.lavaDensityProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, state.particleData.subarray(0, state.count * 6), gl.DYNAMIC_DRAW);
  gl.uniform2f(gl.getUniformLocation(state.lavaDensityProgram, 'uResolution'), state.width, state.height);
  gl.uniform1f(gl.getUniformLocation(state.lavaDensityProgram, 'uPointScale'), pointScaleForRenderStyle('lava-lamp', renderStyle));
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
  gl.drawArrays(gl.POINTS, 0, state.count);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(state.lavaCompositeProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.lavaDensityTexture);
  gl.uniform1i(gl.getUniformLocation(state.lavaCompositeProgram, 'uDensity'), 0);
  gl.uniform2f(gl.getUniformLocation(state.lavaCompositeProgram, 'uTexel'), 1 / Math.max(1, state.lavaDensityWidth), 1 / Math.max(1, state.lavaDensityHeight));
  gl.uniform2f(gl.getUniformLocation(state.lavaCompositeProgram, 'uResolution'), state.width, state.height);
  const { hot, warm, cold, accent } = lavaWaxPalette(palette);
  gl.uniform3f(gl.getUniformLocation(state.lavaCompositeProgram, 'uHot'), hot[0], hot[1], hot[2]);
  gl.uniform3f(gl.getUniformLocation(state.lavaCompositeProgram, 'uWarm'), warm[0], warm[1], warm[2]);
  gl.uniform3f(gl.getUniformLocation(state.lavaCompositeProgram, 'uCold'), cold[0], cold[1], cold[2]);
  gl.uniform3f(gl.getUniformLocation(state.lavaCompositeProgram, 'uAccent'), accent[0], accent[1], accent[2]);
  gl.uniform1f(gl.getUniformLocation(state.lavaCompositeProgram, 'uOpacity'), finiteNumberSetting(state.settings, 'opacity', 0.62));
  gl.uniform1f(gl.getUniformLocation(state.lavaCompositeProgram, 'uMetaball'), finiteNumberSetting(state.settings, 'metaballBlend', 0.86));
  gl.uniform1f(gl.getUniformLocation(state.lavaCompositeProgram, 'uStyle'), renderStyle === 'ultra' ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(state.lavaCompositeProgram, 'uTemperatureContrast'), finiteNumberSetting(state.settings, 'thermalContrast', 1.25));
  gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
}

function renderWaterSurface(state: ParticleMetaballState, palette: number[], renderStyle: string): boolean {
  if (!ensureWaterSurfaceTargets(state)) return false;
  const gl = state.gl;
  if (!state.waterDensityProgram || !state.waterCompositeProgram || !state.particleBuffer || !state.quadBuffer || !state.waterDensityFramebuffer || !state.waterDensityTexture) return false;

  gl.bindFramebuffer(gl.FRAMEBUFFER, state.waterDensityFramebuffer);
  gl.viewport(0, 0, state.waterDensityWidth, state.waterDensityHeight);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(state.waterDensityProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.particleBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, state.particleData.subarray(0, state.count * 6), gl.DYNAMIC_DRAW);
  gl.uniform2f(gl.getUniformLocation(state.waterDensityProgram, 'uResolution'), state.width, state.height);
  gl.uniform1f(gl.getUniformLocation(state.waterDensityProgram, 'uPointScale'), pointScaleForRenderStyle('water-tank', renderStyle));
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
  gl.drawArrays(gl.POINTS, 0, state.count);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(state.waterCompositeProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.waterDensityTexture);
  gl.uniform1i(gl.getUniformLocation(state.waterCompositeProgram, 'uDensity'), 0);
  gl.uniform2f(gl.getUniformLocation(state.waterCompositeProgram, 'uTexel'), 1 / Math.max(1, state.waterDensityWidth), 1 / Math.max(1, state.waterDensityHeight));
  const foam = colorNumberToRgb(palette[3] ?? palette[0], [0.92, 1, 1]);
  const surface = colorNumberToRgb(palette[0], [0.54, 0.95, 1]);
  const deep = colorNumberToRgb(palette[2] ?? palette[1], [0.02, 0.2, 0.36]);
  gl.uniform3f(gl.getUniformLocation(state.waterCompositeProgram, 'uFoamColor'), foam[0], foam[1], foam[2]);
  gl.uniform3f(gl.getUniformLocation(state.waterCompositeProgram, 'uSurfaceColor'), surface[0], surface[1], surface[2]);
  gl.uniform3f(gl.getUniformLocation(state.waterCompositeProgram, 'uDeepColor'), deep[0], deep[1], deep[2]);
  gl.uniform1f(gl.getUniformLocation(state.waterCompositeProgram, 'uOpacity'), finiteNumberSetting(state.settings, 'opacity', 0.74));
  gl.uniform1f(gl.getUniformLocation(state.waterCompositeProgram, 'uGlass'), renderStyle === 'glass' ? 1 : 0.35);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
}

function ensureQuadBuffer(state: ParticleMetaballState): boolean {
  const gl = state.gl;
  if (state.quadBuffer) return true;
  state.quadBuffer = gl.createBuffer();
  if (!state.quadBuffer) return false;
  gl.bindBuffer(gl.ARRAY_BUFFER, state.quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return true;
}

function ensureLavaSurfaceTargets(state: ParticleMetaballState): boolean {
  if (!state.lavaSurfaceSupported) return false;
  const gl = state.gl;
  const width = Math.max(1, state.width);
  const height = Math.max(1, state.height);
  if (!ensureQuadBuffer(state)) return false;
  if (state.lavaDensityTexture && state.lavaDensityFramebuffer && state.lavaDensityWidth === width && state.lavaDensityHeight === height) return true;

  deleteLavaSurfaceTargets(state);
  state.lavaDensityWidth = width;
  state.lavaDensityHeight = height;
  state.lavaDensityTexture = gl.createTexture();
  state.lavaDensityFramebuffer = gl.createFramebuffer();
  if (!state.lavaDensityTexture || !state.lavaDensityFramebuffer) {
    state.lavaSurfaceSupported = false;
    return false;
  }
  gl.bindTexture(gl.TEXTURE_2D, state.lavaDensityTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.lavaDensityFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.lavaDensityTexture, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!complete) {
    deleteLavaSurfaceTargets(state);
    state.lavaSurfaceSupported = false;
    return false;
  }
  return true;
}

function ensureWaterSurfaceTargets(state: ParticleMetaballState): boolean {
  if (!state.waterSurfaceSupported) return false;
  const gl = state.gl;
  const width = Math.max(1, state.width);
  const height = Math.max(1, state.height);
  if (!ensureQuadBuffer(state)) return false;
  if (state.waterDensityTexture && state.waterDensityFramebuffer && state.waterDensityWidth === width && state.waterDensityHeight === height) return true;

  deleteWaterSurfaceTargets(state);
  state.waterDensityWidth = width;
  state.waterDensityHeight = height;
  state.waterDensityTexture = gl.createTexture();
  state.waterDensityFramebuffer = gl.createFramebuffer();
  if (!state.waterDensityTexture || !state.waterDensityFramebuffer) {
    state.waterSurfaceSupported = false;
    return false;
  }
  gl.bindTexture(gl.TEXTURE_2D, state.waterDensityTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, state.waterDensityFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, state.waterDensityTexture, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!complete) {
    deleteWaterSurfaceTargets(state);
    state.waterSurfaceSupported = false;
    return false;
  }
  return true;
}

function deleteLavaSurfaceTargets(state: ParticleMetaballState): void {
  const gl = state.gl;
  if (state.lavaDensityFramebuffer) gl.deleteFramebuffer(state.lavaDensityFramebuffer);
  if (state.lavaDensityTexture) gl.deleteTexture(state.lavaDensityTexture);
  state.lavaDensityFramebuffer = null;
  state.lavaDensityTexture = null;
  state.lavaDensityWidth = 0;
  state.lavaDensityHeight = 0;
}

function deleteWaterSurfaceTargets(state: ParticleMetaballState): void {
  const gl = state.gl;
  if (state.waterDensityFramebuffer) gl.deleteFramebuffer(state.waterDensityFramebuffer);
  if (state.waterDensityTexture) gl.deleteTexture(state.waterDensityTexture);
  state.waterDensityFramebuffer = null;
  state.waterDensityTexture = null;
  state.waterDensityWidth = 0;
  state.waterDensityHeight = 0;
}

function updatePointerFeedback(state: ParticleMetaballState, preset: ParticleMetaballPreset): void {
  const feedback = state.feedbackElement;
  if (!feedback) return;
  if (!state.pointer.active || (preset === 'water-tank' && state.modeId === 'build')) {
    feedback.classList.add('hidden');
    return;
  }
  const radius = preset === 'lava-lamp'
    ? finiteNumberSetting(state.settings, 'inputRadius', 90)
    : state.modeId === 'interact'
      ? finiteNumberSetting(state.settings, 'interactionRadius', 72)
      : finiteNumberSetting(state.settings, 'pourRadius', 24);
  const rect = state.canvas.getBoundingClientRect();
  const sx = rect.width / Math.max(1, state.width);
  const sy = rect.height / Math.max(1, state.height);
  const cssX = state.pointer.x * sx;
  const cssY = state.pointer.y * sy;
  const cssR = radius * Math.max(sx, sy);
  feedback.classList.remove('hidden');
  feedback.style.width = `${cssR * 2}px`;
  feedback.style.height = `${cssR * 2}px`;
  feedback.style.transform = `translate(${cssX - cssR}px, ${cssY - cssR}px)`;
  if (preset === 'lava-lamp') {
    const removing = state.modeId === 'remove';
    feedback.style.borderColor = removing ? 'rgba(125, 211, 252, 0.46)' : 'rgba(251, 146, 60, 0.46)';
    feedback.style.backgroundColor = removing ? 'rgba(14, 165, 233, 0.14)' : 'rgba(249, 115, 22, 0.14)';
  } else if (state.modeId === 'interact') {
    feedback.style.borderColor = 'rgba(255, 255, 255, 0.34)';
    feedback.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
  } else {
    feedback.style.borderColor = 'rgba(103, 232, 249, 0.42)';
    feedback.style.backgroundColor = 'rgba(34, 211, 238, 0.12)';
  }
}

function pointScaleForRenderStyle(preset: ParticleMetaballPreset, renderStyle: string): number {
  if (preset === 'water-tank') {
    if (renderStyle === 'particles') return 1.35;
    if (renderStyle === 'surface') return 2.7;
    return 3.05;
  }
  if (renderStyle === 'basic') return 2.0;
  if (renderStyle === 'enhanced') return 4.8;
  if (renderStyle === 'cellular') return 4.25;
  if (renderStyle === 'smooth') return 5.1;
  return 5.65;
}

function lavaRenderStyle(state: ParticleMetaballState): string {
  const renderStyle = typeof state.settings.renderStyle === 'string' ? state.settings.renderStyle : '';
  if (renderStyle === 'basic' || renderStyle === 'enhanced' || renderStyle === 'ultra') return renderStyle;
  if (renderStyle === 'smooth') return 'basic';
  if (renderStyle === 'glow') return 'enhanced';
  return 'ultra';
}

export class RawParticleMetaballScene extends RawWebGL2Scene {
  private readonly pendingGestures: GestureEvent[] = [];

  constructor(preset: ParticleMetaballPreset, private readonly preview = false) {
    super({
      name: preset === 'water-tank' ? 'Water Tank' : 'Lava Lamp',
      markup: MARKUP,
      canvasSelector: '[data-particle-metaball-canvas]',
      maxDevicePixelRatio: preview ? 1 : 2,
      onInit: (state) => {
        const s = state as ParticleMetaballState;
        s.particleProgram = link(s.gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
        s.lavaRaymarchProgram = null;
        s.lavaDensityProgram = preset === 'lava-lamp' ? link(s.gl, LAVA_DENSITY_VERTEX, LAVA_DENSITY_FRAGMENT) : null;
        s.lavaCompositeProgram = preset === 'lava-lamp' ? link(s.gl, QUAD_VERTEX, LAVA_COMPOSITE_FRAGMENT) : null;
        s.waterDensityProgram = preset === 'water-tank' ? link(s.gl, WATER_DENSITY_VERTEX, WATER_DENSITY_FRAGMENT) : null;
        s.waterCompositeProgram = preset === 'water-tank' ? link(s.gl, QUAD_VERTEX, WATER_COMPOSITE_FRAGMENT) : null;
        s.lavaLiquidSurface = preset === 'lava-lamp' ? createRawLiquidSurfaceRenderer(s.gl) : null;
        s.obstacleProgram = link(s.gl, OBSTACLE_VERTEX, OBSTACLE_FRAGMENT);
        s.obstacleLineProgram = preset === 'water-tank' ? link(s.gl, OBSTACLE_LINE_VERTEX, OBSTACLE_LINE_FRAGMENT) : null;
        s.particleBuffer = s.gl.createBuffer();
        s.obstacleBuffer = s.gl.createBuffer();
        s.obstacleLineBuffer = s.gl.createBuffer();
        s.quadBuffer = null;
        s.lavaDensityTexture = null;
        s.lavaDensityFramebuffer = null;
        s.lavaDensityWidth = 0;
        s.lavaDensityHeight = 0;
        s.lavaSurfaceSupported = true;
        s.lavaRaymarchBlobData = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT * LAVA_RAYMARCH_BLOB_STRIDE);
        s.lavaRaymarchBlobState = new Float32Array(LAVA_RAYMARCH_BLOB_LIMIT * LAVA_RAYMARCH_STATE_STRIDE);
        s.lavaRaymarchBlobCount = 0;
        s.lavaAddEmitAccumulator = 0;
        s.lavaAddLastX = 0;
        s.lavaAddLastY = 0;
        s.waterDensityTexture = null;
        s.waterDensityFramebuffer = null;
        s.waterDensityWidth = 0;
        s.waterDensityHeight = 0;
        s.waterSurfaceSupported = true;
        s.feedbackElement = s.canvas.parentElement?.querySelector<HTMLDivElement>('[data-particle-metaball-feedback]') ?? null;
        s.capacity = preset === 'water-tank' ? (preview ? 1400 : 12_000) : (preview ? 160 : 900);
        s.obstacleCapacity = preview ? 96 : 512;
        s.particleData = new Float32Array(s.capacity * 6);
        s.obstacleData = new Float32Array(s.obstacleCapacity * 3);
        s.obstaclePointData = new Float32Array(s.obstacleCapacity * 3);
        s.obstacleLineData = new Float32Array(s.obstacleCapacity * 5);
        s.buildPreviewData = new Float32Array(5);
        s.previousParticlePositions = new Float32Array(s.capacity * 2);
        s.fluidColumns = 0;
        s.fluidRows = 0;
        s.fluidCellWidth = 1;
        s.fluidCellHeight = 1;
        s.fluidVx = new Float32Array(0);
        s.fluidVy = new Float32Array(0);
        s.fluidPrevVx = new Float32Array(0);
        s.fluidPrevVy = new Float32Array(0);
        s.fluidWeight = new Float32Array(0);
        s.fluidMarker = new Uint8Array(0);
        s.fluidDivergence = new Float32Array(0);
        s.fluidPressure = new Float32Array(0);
        s.fluidPressureTemp = new Float32Array(0);
        s.gridHead = new Int32Array(1);
        s.gridNext = new Int32Array(s.capacity);
        s.count = 0;
        s.particleWriteCursor = 0;
        s.obstacleCount = 0;
        s.obstaclePointCount = 0;
        s.obstacleLineCount = 0;
        s.modeId = modeForPreset(preset);
        s.preset = preset;
        s.pendingGestures = this.pendingGestures;
        s.seed = preset === 'water-tank' ? 0x8ab4f8 : 0xff6d1b;
        s.needsSeed = true;
        s.pointer = { active: false, id: -1, startX: 0, startY: 0, x: 0, y: 0, previousX: 0, previousY: 0 };
        s.canvas.dataset.pixiLabContextLabel = preset;
        s.cleanupPointer = installPointer(s, preset);
        clearScene(s, preset);
      },
      onReset: (state) => clearScene(state as ParticleMetaballState, preset),
      onModeChange: (state, mode) => {
        (state as ParticleMetaballState).modeId = mode === 'demo' ? modeForPreset(preset) : mode;
      },
      render: (state) => {
        const s = state as ParticleMetaballState;
        if (s.needsSeed) clearScene(s, preset);
        enforceParticleLimit(s);
        applyGestures(s, preset);
        const dt = Math.min(1 / 24, Math.max(0, s.deltaSeconds));
        if (preset === 'lava-lamp') streamLavaAddWax(s, dt);
        const substeps = Math.max(1, Math.floor(finiteNumberSetting(s.settings, 'substeps', preset === 'water-tank' ? 2 : 1)));
        for (let i = 0; i < substeps; i += 1) {
          if (preset === 'water-tank') simulateWater(s, dt / substeps);
          else simulateLava(s, dt / substeps);
        }
        renderParticles(s, preset);
      },
      getDebugStats: (state): RawSceneDebugStats => {
        const s = state as ParticleMetaballState;
        return {
          renderer: 'raw-webgl2-particle-metaball',
          simulation: preset,
          sharedScene: 'RawParticleMetaballScene',
          simulationPath: preset === 'water-tank' ? 'cpu-2d-pic-flip-pressure-grid' : 'cpu-particle-metaball-field-to-raymarch-proxies',
          rendering: preset === 'water-tank'
            ? 'gpu-density-surface-water'
            : lavaRenderStyle(s) === 'enhanced' || lavaRenderStyle(s) === 'ultra'
                ? 'shared-liquid-surface-lava'
                : 'gpu-point-metaball-lava',
          acceleration: preset === 'water-tank'
            ? 'gpu-point-sprite-metaball-rendering'
            : 'gpu-point-sprite-metaball-rendering',
          gpuRenderPipeline: preset === 'water-tank'
            ? 'offscreen-density-threshold-normal-shade'
            : lavaRenderStyle(s) === 'enhanced' || lavaRenderStyle(s) === 'ultra'
                ? 'shared-liquid-surface-density-refraction'
                : 'point-sprite-metaball',
          blendMode: preset === 'water-tank' ? 'surface-alpha-composite' : lavaRenderStyle(s) === 'enhanced' || lavaRenderStyle(s) === 'ultra' ? 'surface-alpha-composite' : 'metaball-alpha-composite',
          gpuSimulated: false,
          gpuRendered: true,
          cpuTopology: true,
          cpuUpload: true,
          cpuUploadFloats: s.count * 6 + s.lavaRaymarchBlobCount * LAVA_RAYMARCH_BLOB_STRIDE + s.obstacleCount * 3 + s.obstaclePointCount * 3 + s.obstacleLineCount * 5,
          waitingForSize: s.needsSeed && (s.width <= 1 || s.height <= 1),
          particles: s.count,
          raymarchBlobs: preset === 'lava-lamp' ? s.lavaRaymarchBlobCount : null,
          maxParticles: maxParticles(s, preset),
          particleRadius: Math.round(particleRadius(s, preset) * 100) / 100,
          fluidGrid: preset === 'water-tank' ? `${s.fluidColumns}x${s.fluidRows}` : null,
          pressureIterations: preset === 'water-tank' ? Math.floor(finiteNumberSetting(s.settings, 'pressureIterations', 36)) : null,
          flipness: preset === 'water-tank' ? Math.round(finiteNumberSetting(s.settings, 'flipness', 0.84) * 100) / 100 : null,
          renderStyle: typeof s.settings.renderStyle === 'string' ? s.settings.renderStyle : null,
          obstacles: s.obstacleCount,
          obstaclePoints: s.obstaclePointCount,
          obstacleLines: s.obstacleLineCount,
          gridCells: s.gridHead.length,
          mode: s.modeId,
          preview: this.preview,
        };
      },
      onDestroy: (state) => {
        const s = state as ParticleMetaballState;
        s.cleanupPointer?.();
        deleteLavaSurfaceTargets(s);
        deleteWaterSurfaceTargets(s);
        destroyRawLiquidSurfaceRenderer(s, s.lavaLiquidSurface);
        if (s.particleBuffer) s.gl.deleteBuffer(s.particleBuffer);
        if (s.obstacleBuffer) s.gl.deleteBuffer(s.obstacleBuffer);
        if (s.obstacleLineBuffer) s.gl.deleteBuffer(s.obstacleLineBuffer);
        if (s.quadBuffer) s.gl.deleteBuffer(s.quadBuffer);
        if (s.particleProgram) s.gl.deleteProgram(s.particleProgram);
        if (s.lavaRaymarchProgram) s.gl.deleteProgram(s.lavaRaymarchProgram);
        if (s.lavaDensityProgram) s.gl.deleteProgram(s.lavaDensityProgram);
        if (s.lavaCompositeProgram) s.gl.deleteProgram(s.lavaCompositeProgram);
        if (s.waterDensityProgram) s.gl.deleteProgram(s.waterDensityProgram);
        if (s.waterCompositeProgram) s.gl.deleteProgram(s.waterCompositeProgram);
        if (s.obstacleProgram) s.gl.deleteProgram(s.obstacleProgram);
        if (s.obstacleLineProgram) s.gl.deleteProgram(s.obstacleLineProgram);
      },
    });
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.pendingGestures.push(...gestures);
  }
}
