import {
  colorNumberToRgb,
  finiteNumberSetting,
  type RawFramebuffer,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';

const LIQUID_QUAD_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const TEXTURE_PARTICLE_DENSITY_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPositions;
uniform sampler2D uVelocities;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
uniform float uPointScale;
uniform float uActiveLimit;
out float vFoam;
out float vSpeed;
out float vActive;
flat out float vPaletteT;
void main() {
  int id = gl_VertexID;
  int width = int(uTextureSize.x);
  ivec2 pixel = ivec2(id - (id / width) * width, id / width);
  vec4 position = texelFetch(uPositions, pixel, 0);
  vec4 velocity = texelFetch(uVelocities, pixel, 0);
  float radius = max(position.z, velocity.z);
  vActive = step(float(id), uActiveLimit - 0.5) * step(0.0001, radius);
  vSpeed = length(velocity.xy);
  vFoam = clamp(velocity.w, 0.0, 1.0);
  vPaletteT = fract(position.w + sin(float(id) * 12.9898 + 78.233) * 43758.5453);
  vec2 clip = position.xy / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(1.0, radius * uPointScale) * vActive;
}`;

const BUFFER_PARTICLE_DENSITY_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aVelocity;
layout(location = 2) in vec2 aRenderData;
uniform vec2 uResolution;
uniform float uPointScale;
out float vFoam;
out float vSpeed;
out float vActive;
flat out float vPaletteT;
void main() {
  float radius = max(0.25, aRenderData.x);
  vActive = 1.0;
  vSpeed = length(aVelocity);
  vFoam = clamp(aRenderData.y, 0.0, 1.0);
  vPaletteT = fract(sin(float(gl_VertexID) * 12.9898 + 78.233) * 43758.5453);
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(1.0, radius * uPointScale) * vActive;
}`;

const LIQUID_DENSITY_FRAGMENT = `#version 300 es
precision highp float;
in float vFoam;
in float vSpeed;
in float vActive;
uniform float uDensityScale;
out vec4 outField;
void main() {
  if (vActive < 0.5) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 >= 1.0) discard;
  float om = 1.0 - r2;
  float compact = om * om * (0.72 + 0.28 * om);
  float core = smoothstep(0.86, 0.06, r2);
  float density = (compact * 0.42 + core * 0.055) * uDensityScale;
  float thickness = density * (0.72 + 0.22 * om + 0.06 * clamp(vSpeed * 0.0018, 0.0, 1.0));
  float surfaceFoam = smoothstep(0.18, 0.95, vFoam);
  outField = vec4(density, thickness, density * surfaceFoam, density);
}`;

const TEXTURE_FOAM_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uPositions;
uniform sampler2D uVelocities;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
uniform float uPointScale;
uniform float uActiveLimit;
out float vFoam;
out float vSpeed;
out float vActive;
void main() {
  int id = gl_VertexID;
  int width = int(uTextureSize.x);
  ivec2 pixel = ivec2(id - (id / width) * width, id / width);
  vec4 position = texelFetch(uPositions, pixel, 0);
  vec4 velocity = texelFetch(uVelocities, pixel, 0);
  float radius = max(position.z, velocity.z);
  vActive = step(float(id), uActiveLimit - 0.5) * step(0.0001, radius);
  vFoam = clamp(velocity.w, 0.0, 1.0);
  vSpeed = length(velocity.xy);
  vec2 clip = position.xy / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(2.0, radius * uPointScale) * vActive;
}`;

const BUFFER_FOAM_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aVelocity;
layout(location = 2) in vec2 aRenderData;
uniform vec2 uResolution;
uniform float uPointScale;
out float vFoam;
out float vSpeed;
out float vActive;
void main() {
  float radius = max(0.25, aRenderData.x);
  vActive = 1.0;
  vFoam = clamp(aRenderData.y, 0.0, 1.0);
  vSpeed = length(aVelocity);
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = max(2.0, radius * uPointScale);
}`;

const FOAM_FRAGMENT = `#version 300 es
precision highp float;
in float vFoam;
in float vSpeed;
in float vActive;
uniform sampler2D uField;
uniform vec2 uResolution;
uniform vec2 uTexel;
uniform vec3 uFoamColor;
uniform float uThreshold;
uniform float uFoamStrength;
uniform float uTime;
out vec4 outColor;

float densityAt(vec2 uv) {
  return texture(uField, clamp(uv, vec2(0.001), vec2(0.999))).r;
}

float supportAt(vec2 uv) {
  float center = densityAt(uv) * 0.32;
  center += densityAt(uv + vec2(uTexel.x * 2.0, 0.0)) * 0.14;
  center += densityAt(uv - vec2(uTexel.x * 2.0, 0.0)) * 0.14;
  center += densityAt(uv + vec2(0.0, uTexel.y * 2.0)) * 0.14;
  center += densityAt(uv - vec2(0.0, uTexel.y * 2.0)) * 0.14;
  center += densityAt(uv + vec2(uTexel.x * 4.0, 0.0)) * 0.055;
  center += densityAt(uv - vec2(uTexel.x * 4.0, 0.0)) * 0.055;
  center += densityAt(uv + vec2(0.0, uTexel.y * 4.0)) * 0.055;
  center += densityAt(uv - vec2(0.0, uTexel.y * 4.0)) * 0.055;
  return center;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  if (vActive < 0.5 || uFoamStrength <= 0.001) discard;
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float particleShape = 1.0 - dot(p, p);
  if (particleShape <= 0.0) discard;

  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  float support = supportAt(uv);
  float density = densityAt(uv);
  float above = supportAt(uv + vec2(0.0, uTexel.y * 5.0));
  float aboveFar = supportAt(uv + vec2(0.0, uTexel.y * 14.0));
  float aboveVeryFar = supportAt(uv + vec2(0.0, uTexel.y * 28.0));
  float below = supportAt(uv - vec2(0.0, uTexel.y * 5.0));
  float farBelow = supportAt(uv - vec2(0.0, uTexel.y * 10.0));
  float veryFarBelow = supportAt(uv - vec2(0.0, uTexel.y * 22.0));
  float left = supportAt(uv - vec2(uTexel.x * 5.0, 0.0));
  float right = supportAt(uv + vec2(uTexel.x * 5.0, 0.0));
  float liquidSpan = smoothstep(uThreshold * 0.75, uThreshold * 3.2, min(left, right) + support * 0.65);
  float bodyBelow = smoothstep(uThreshold * 1.4, uThreshold * 5.8, below + farBelow * 0.74 + veryFarBelow * 0.42);
  float airAbove = 1.0 - smoothstep(uThreshold * 0.32, uThreshold * 1.65, above + aboveFar * 0.82 + aboveVeryFar * 0.62);
  float topFacing = smoothstep(uThreshold * 0.5, uThreshold * 3.6, below + farBelow * 0.48 - above - aboveFar * 0.72);
  float bodyReject = 1.0 - smoothstep(uThreshold * 7.5, uThreshold * 14.0, support);
  float edgeBand = smoothstep(uThreshold * 0.28, uThreshold * 1.12, density) * (1.0 - smoothstep(uThreshold * 1.7, uThreshold * 3.8, density));
  float surfaceMask = liquidSpan * bodyBelow * airAbove * topFacing * bodyReject * edgeBand;
  if (surfaceMask <= 0.02) discard;

  vec2 sparkleCell = floor(uv * vec2(260.0, 180.0) + p * 1.7);
  float seed = hash12(sparkleCell);
  float twinkle = 0.55 + 0.45 * sin(uTime * 6.0 + seed * 37.0);
  float sparkleGate = mix(0.18, 1.0, smoothstep(0.58, 0.985, seed) * smoothstep(0.05, 0.82, twinkle));
  float dotShape = smoothstep(0.08, 0.96, particleShape);
  float motionFoam = smoothstep(80.0, 920.0, vSpeed);
  float foamIntensity = clamp(0.24 + vFoam * 0.72 + motionFoam * 0.54, 0.0, 1.35);
  float alpha = dotShape * sparkleGate * surfaceMask * foamIntensity * clamp(uFoamStrength * 0.34, 0.0, 3.2);
  if (alpha <= 0.004) discard;
  vec3 color = max(uFoamColor, vec3(0.88)) * (1.0 + alpha * 1.9);
  outColor = vec4(color, alpha);
}`;

const LIQUID_COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform vec3 uBackground;
uniform vec3 uDeepColor;
uniform vec3 uSurfaceColor;
uniform vec3 uFoamColor;
uniform float uThreshold;
uniform float uTightness;
uniform float uEdgeSoftness;
  uniform float uOpacity;
  uniform float uUltra;
  uniform float uFoamStrength;
  uniform float uRefraction;
  uniform float uGloss;
  uniform float uRimStrength;
  uniform float uThermalStrength;
  uniform float uBloomStrength;
  uniform float uHeatShimmer;
  uniform float uDepthDiffusion;
  uniform float uTime;
out vec4 outColor;

const float PI = 3.141592653589793;

vec4 fieldAt(vec2 uv) {
  return texture(uField, clamp(uv, vec2(0.001), vec2(0.999)));
}

float densityAt(vec2 uv) {
  return fieldAt(uv).r;
}

float supportDensityAt(vec2 uv) {
  float center = densityAt(uv) * 0.28;
  float cardinal = 0.0;
  float diagonal = 0.0;
  float wide = 0.0;
  cardinal += densityAt(uv + vec2(uTexel.x * 2.0, 0.0));
  cardinal += densityAt(uv - vec2(uTexel.x * 2.0, 0.0));
  cardinal += densityAt(uv + vec2(0.0, uTexel.y * 2.0));
  cardinal += densityAt(uv - vec2(0.0, uTexel.y * 2.0));
  diagonal += densityAt(uv + vec2(uTexel.x * 2.4, uTexel.y * 2.4));
  diagonal += densityAt(uv + vec2(-uTexel.x * 2.4, uTexel.y * 2.4));
  diagonal += densityAt(uv + vec2(uTexel.x * 2.4, -uTexel.y * 2.4));
  diagonal += densityAt(uv - vec2(uTexel.x * 2.4, uTexel.y * 2.4));
  wide += densityAt(uv + vec2(uTexel.x * 5.0, 0.0));
  wide += densityAt(uv - vec2(uTexel.x * 5.0, 0.0));
  wide += densityAt(uv + vec2(0.0, uTexel.y * 5.0));
  wide += densityAt(uv - vec2(0.0, uTexel.y * 5.0));
  return center + cardinal * 0.16 + diagonal * 0.1 + wide * 0.055;
}

float foamAt(vec2 uv) {
  vec4 packed = fieldAt(uv);
  return clamp(packed.b / max(0.001, packed.r), 0.0, 1.0);
}

float D_GGX(float NoH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float denom = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / max(PI * denom * denom, 1e-5);
}

float filteredFoam(vec2 uv) {
  float sum = foamAt(uv) * 0.44;
  float weight = 0.44;
  for (int y = -3; y <= 3; y += 1) {
    for (int x = -3; x <= 3; x += 1) {
      if (x == 0 && y == 0) continue;
      vec2 offsetCells = vec2(float(x), float(y));
      float w = exp(-dot(offsetCells, offsetCells) * 0.2);
      sum += foamAt(uv + offsetCells * uTexel) * w;
      weight += w;
    }
  }
  return clamp(sum / max(0.001, weight), 0.0, 1.0);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float foamFlecks(vec2 uv, float scale, float t) {
  vec2 grid = uv * scale;
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float rnd = hash12(cell);
  vec2 offset = vec2(hash12(cell + 13.7), hash12(cell + 71.2)) - 0.5;
  float d = length(local - offset * 0.62);
  float dotShape = smoothstep(0.18 + rnd * 0.09, 0.012, d);
  float life = smoothstep(0.18, 0.62, hash12(cell + floor(t * 0.45)));
  return dotShape * mix(0.45, 1.0, rnd) * life;
}

vec3 paletteBackdrop(vec2 uv, vec3 base, vec3 deep, vec3 surface, vec3 foam) {
  vec2 p = uv * 2.0 - 1.0;
  float horizon = smoothstep(-0.85, 0.92, p.y);
  float diagonal = smoothstep(-1.1, 1.2, p.x * 0.42 + p.y * 0.78);
  float waveA = sin((uv.x * 7.0 + uv.y * 2.8) + uTime * 0.055) * 0.5 + 0.5;
  float waveB = sin((uv.x * -3.6 + uv.y * 8.2) - uTime * 0.04) * 0.5 + 0.5;
  float cells = hash12(floor(uv * vec2(18.0, 12.0)));
  float softCells = smoothstep(0.08, 0.92, cells) * 0.5 + 0.5 * waveA;
  vec3 upper = mix(base * 0.68 + deep * 0.22, deep * 0.62 + surface * 0.18, horizon);
  vec3 lower = mix(base * 0.52 + surface * 0.16, deep * 0.34 + foam * 0.1, diagonal);
  vec3 patterned = mix(upper, lower, 0.38 + 0.24 * waveB);
  patterned += surface * (waveA - 0.5) * 0.035;
  patterned += foam * (softCells - 0.5) * 0.025;
  return max(patterned, vec3(0.0));
}

void main() {
  vec4 packed = fieldAt(vUv);
  float density = packed.r;
  vec2 p = vUv * 2.0 - 1.0;
  float vignette = 0.72 + 0.28 * smoothstep(1.18, 0.18, length(p * vec2(0.86, 1.08)));
  vec3 background = mix(uBackground, paletteBackdrop(vUv, uBackground, uDeepColor, uSurfaceColor, uFoamColor), 0.72) * vignette;

  if (density < uThreshold * 0.42) {
    outColor = vec4(background, 1.0);
    return;
  }

  float dl = densityAt(vUv - vec2(uTexel.x, 0.0));
  float dr = densityAt(vUv + vec2(uTexel.x, 0.0));
  float dd = densityAt(vUv - vec2(0.0, uTexel.y));
  float du = densityAt(vUv + vec2(0.0, uTexel.y));
  vec2 gradient = 0.5 * vec2(dr - dl, du - dd);
  float gradLen = max(length(gradient), 0.0018);
  float signedPx = (density - uThreshold) / gradLen;
  float aa = mix(1.08, 0.26, clamp(uTightness, 0.0, 1.0));
  float edgeSoftness = clamp(uEdgeSoftness, 0.0, 2.0);
  aa *= 1.0 + edgeSoftness * edgeSoftness * mix(2.1, 4.8, uUltra) * (1.0 - clamp(uTightness, 0.0, 1.0) * 0.18);
  float alpha = smoothstep(-aa, aa, signedPx);
  if (alpha < 0.002) {
    outColor = vec4(background, 1.0);
    return;
  }

  float lap = dl + dr + dd + du - 4.0 * density;
  float thickness = max(packed.g, density * 0.68);
  float body = smoothstep(uThreshold * 0.92, uThreshold * 2.35, density);
  float rim = alpha * (1.0 - smoothstep(uThreshold, uThreshold + mix(0.12, 0.042, uTightness), density));
  float edge = alpha * (1.0 - alpha) * 4.0;
  float curvature = clamp(abs(lap) * 32.0, 0.0, 1.0);
  vec3 N = normalize(vec3(-gradient * mix(155.0, 325.0, clamp(thickness * 1.25, 0.0, 1.0)), 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L1 = normalize(vec3(-0.34, -0.52, 0.78));
  vec3 L2 = normalize(vec3(0.72, 0.18, 0.66));
  vec3 H1 = normalize(L1 + V);
  vec3 H2 = normalize(L2 + V);
  float NoV = max(dot(N, V), 0.001);
  float NoL1 = max(dot(N, L1), 0.0);
  float NoL2 = max(dot(N, L2), 0.0);
  float gloss = clamp(uGloss, 0.0, 1.0);
  float rough = mix(0.34, 0.08, gloss);
  float spec1 = D_GGX(max(dot(N, H1), 0.0), rough) * NoL1;
  float spec2 = D_GGX(max(dot(N, H2), 0.0), rough * 1.55) * NoL2;
  float fresnel = pow(clamp(1.0 - NoV, 0.0, 1.0), 5.0);
  float opticalDepth = clamp(thickness * 1.45 + body * 0.08, 0.0, 3.2);
  vec3 absorption = exp(-(vec3(1.0) - clamp(uDeepColor, vec3(0.02), vec3(0.98))) * opticalDepth);
  float caustic = pow(max(0.0, sin((vUv.x + N.x * 0.04) * 42.0 + uTime * 1.2) * sin((vUv.y + N.y * 0.04) * 33.0 - uTime * 0.9)), 4.0);
  float thermal = clamp(packed.b / max(0.001, density), 0.0, 1.0);
  vec3 coolThermal = mix(uDeepColor, uSurfaceColor, smoothstep(0.05, 0.55, thermal));
  vec3 hotThermal = mix(coolThermal, uFoamColor, smoothstep(0.48, 0.98, thermal));
  vec3 bodyColor = mix(mix(uSurfaceColor, uDeepColor, 0.36), hotThermal, clamp(uThermalStrength, 0.0, 1.0));
  float ultraRefraction = mix(1.0, 1.95, uUltra);
  float shimmerStrength = clamp(uHeatShimmer, 0.0, 2.0) * uUltra;
  vec2 shimmer = vec2(
    sin(vUv.y * 31.0 + thermal * 5.4 + uTime * 1.35) + sin((vUv.x + vUv.y) * 19.0 - uTime * 1.05),
    cos(vUv.x * 27.0 + thermal * 4.2 - uTime * 1.18) + sin((vUv.x - vUv.y) * 23.0 + uTime * 0.92)
  ) * shimmerStrength * mix(0.0008, 0.0055, clamp(thickness, 0.0, 1.0)) * (0.35 + thermal * 0.65);
  vec2 refractUv = clamp(vUv + shimmer + N.xy * uRefraction * ultraRefraction * mix(0.012, 0.042, clamp(thickness, 0.0, 1.0)) + gradient * uRefraction * uUltra * 0.018, vec2(0.001), vec2(0.999));
  vec3 refractedBackdrop = paletteBackdrop(refractUv, uBackground, uDeepColor, uSurfaceColor, uFoamColor);
  vec3 refracted = mix(bodyColor, bodyColor * absorption + mix(background, refractedBackdrop, 0.72 + uUltra * 0.22) * mix(0.22, 0.52, uUltra), mix(0.32, 0.58, uUltra));
  refracted += uSurfaceColor * caustic * curvature * body * uRefraction * mix(0.08, 0.19, uUltra);
  vec3 reflected = mix(uSurfaceColor, uFoamColor, 0.16 + NoL1 * 0.22);
  vec3 water = mix(refracted, reflected, fresnel * 0.12 + edge * 0.012);
  water += uSurfaceColor * NoL1 * 0.045;
  water += spec1 * vec3(1.0, 0.96, 0.86) * 0.16 * gloss;
  water += spec2 * vec3(0.48, 0.86, 1.0) * 0.075 * gloss;
  water += fresnel * uFoamColor * 0.08 * gloss;
  float rimStrength = clamp(uRimStrength, 0.0, 3.0);
  vec3 scatterColor = mix(uSurfaceColor, uFoamColor, 0.68);
  scatterColor = mix(scatterColor, vec3(1.0), 0.16);
  float viewScatter = pow(clamp(1.0 - NoV, 0.0, 1.0), 1.55);
  float forwardScatter = pow(max(0.0, dot(N, normalize(vec3(0.28, -0.42, 0.86)))), 2.4);
  float thinTransmission = exp(-opticalDepth * 0.72);
  float thickTransmission = smoothstep(0.06, 0.82, thickness) * (1.0 - smoothstep(1.65, 3.1, opticalDepth));
  float subsurfaceEdge = alpha * viewScatter * (0.55 + edge * 0.42 + rim * 0.28);
  float subsurfaceBody = body * thickTransmission * (0.14 + caustic * 0.12);
  float subsurface = (subsurfaceEdge * thinTransmission + subsurfaceBody * forwardScatter) * rimStrength * uUltra;
  water += scatterColor * subsurface * 0.95;
  float depthDiffusion = clamp(uDepthDiffusion, 0.0, 1.0) * uUltra;
  float diffusionMask = body * smoothstep(0.1, 1.15, thickness) * (1.0 - edge * 0.65);
  vec3 diffusedBody = mix(water, mix(uDeepColor, bodyColor, 0.54), 0.38 + thermal * 0.18);
  water = mix(water, diffusedBody, diffusionMask * depthDiffusion * 0.58);
  float bloomStrength = clamp(uBloomStrength, 0.0, 3.0) * uUltra;
  vec3 bloomColor = mix(scatterColor, uFoamColor, 0.28);
  float bloomMask = clamp(spec1 * 0.08 + spec2 * 0.06 + subsurface * 0.42 + caustic * body * 0.18 + edge * fresnel * 0.28, 0.0, 1.5);
  water += bloomColor * bloomMask * bloomStrength * (0.42 + gloss * 0.36);

  float topSlope = smoothstep(uThreshold * 0.02, uThreshold * 1.05, density - du);
  float openSky = 1.0 - smoothstep(uThreshold * 0.24, uThreshold * 2.2, du);
  float liquidUnder = smoothstep(uThreshold * 0.18, uThreshold * 1.65, dd);
  float thickSurfaceBand = max(edge * 0.9, rim * 2.35);
  thickSurfaceBand += alpha * (1.0 - smoothstep(uThreshold * 1.4, uThreshold * 4.2, density)) * 0.48;
  float topEdgeBand = clamp(thickSurfaceBand * topSlope * openSky * liquidUnder, 0.0, 1.0);
  vec2 sparkleCell = floor((vUv + gradient * 0.018) * vec2(340.0, 210.0));
  float sparkleSeed = hash12(sparkleCell);
  float sparkleTwinkle = 0.55 + 0.45 * sin(uTime * 7.2 + sparkleSeed * 41.0);
  float sparkle = smoothstep(0.22, 0.9, sparkleSeed) * smoothstep(0.0, 0.7, sparkleTwinkle);
  float fineSparkle = smoothstep(0.68, 0.985, hash12(floor((vUv - gradient * 0.026) * vec2(620.0, 360.0)) + floor(uTime * 1.7)));
  float foamLine = topEdgeBand * clamp(uFoamStrength, 0.0, 8.0) * uUltra;
  vec3 surfaceFoamColor = max(uFoamColor, vec3(0.94));
  water += surfaceFoamColor * foamLine * (1.15 + sparkle * 4.6 + fineSparkle * 3.2) * gloss;
  water = mix(water, surfaceFoamColor, clamp(foamLine * (0.08 + sparkle * 0.2 + fineSparkle * 0.14) * gloss, 0.0, 0.68));

  float outAlpha = alpha * uOpacity * mix(0.82 + 0.18 * smoothstep(0.02, 0.72, thickness), 0.58 + 0.28 * smoothstep(0.04, 0.9, thickness), uUltra);
  outColor = vec4(mix(background, water, outAlpha), 1.0);
}`;

export interface RawLiquidSurfaceRenderer {
  textureDensityProgram: WebGLProgram;
  bufferDensityProgram: WebGLProgram;
  textureFoamProgram: WebGLProgram;
  bufferFoamProgram: WebGLProgram;
  compositeProgram: WebGLProgram;
  quadBuffer: WebGLBuffer;
  target: RawFramebuffer | null;
  width: number;
  height: number;
}

export interface LiquidSurfacePalette {
  palette: number[];
  background?: number;
}

export interface LiquidSurfaceStyleOptions {
  renderStyle: string;
  pointScale: number;
  densityScale: number;
  threshold: number;
  tightness: number;
  opacity: number;
  edgeSoftness: number;
  foamStrength: number;
  refraction: number;
  gloss: number;
  rimStrength: number;
  thermalStrength: number;
  bloomStrength: number;
  heatShimmer: number;
  depthDiffusion: number;
}

interface LiquidSurfaceBaseParams {
  state: RawWebGL2RenderState;
  renderer: RawLiquidSurfaceRenderer;
  palette: LiquidSurfacePalette;
  options: LiquidSurfaceStyleOptions;
  resolution: number;
}

interface TextureParticleParams extends LiquidSurfaceBaseParams {
  positionsTexture: WebGLTexture;
  velocitiesTexture: WebGLTexture;
  textureWidth: number;
  textureHeight: number;
  activeCount: number;
}

interface BufferParticleParams extends LiquidSurfaceBaseParams {
  particleBuffer: WebGLBuffer;
  particleCount: number;
  strideBytes: number;
  positionOffsetBytes: number;
  velocityOffsetBytes: number;
  renderDataOffsetBytes: number;
}

export function createRawLiquidSurfaceRenderer(gl: WebGL2RenderingContext): RawLiquidSurfaceRenderer {
  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) throw new Error('Unable to create liquid surface quad buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return {
    textureDensityProgram: link(gl, TEXTURE_PARTICLE_DENSITY_VERTEX, LIQUID_DENSITY_FRAGMENT),
    bufferDensityProgram: link(gl, BUFFER_PARTICLE_DENSITY_VERTEX, LIQUID_DENSITY_FRAGMENT),
    textureFoamProgram: link(gl, TEXTURE_FOAM_VERTEX, FOAM_FRAGMENT),
    bufferFoamProgram: link(gl, BUFFER_FOAM_VERTEX, FOAM_FRAGMENT),
    compositeProgram: link(gl, LIQUID_QUAD_VERTEX, LIQUID_COMPOSITE_FRAGMENT),
    quadBuffer,
    target: null,
    width: 0,
    height: 0,
  };
}

export function destroyRawLiquidSurfaceRenderer(state: RawWebGL2RenderState, renderer: RawLiquidSurfaceRenderer | null): void {
  if (!renderer) return;
  if (renderer.target) state.resources.destroyFramebuffer(renderer.target);
  state.gl.deleteProgram(renderer.textureDensityProgram);
  state.gl.deleteProgram(renderer.bufferDensityProgram);
  state.gl.deleteProgram(renderer.textureFoamProgram);
  state.gl.deleteProgram(renderer.bufferFoamProgram);
  state.gl.deleteProgram(renderer.compositeProgram);
  state.gl.deleteBuffer(renderer.quadBuffer);
}

export function renderLiquidSurfaceFromTextureParticles(params: TextureParticleParams): boolean {
  const { state, activeCount } = params;
  if (activeCount <= 0 || !ensureSurfaceTarget(params)) return false;
  const gl = state.gl;
  renderTextureDensity(params);
  renderComposite(params);
  renderTextureFoamOverlay(params);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return true;
}

export function renderLiquidSurfaceFromBufferParticles(params: BufferParticleParams): boolean {
  const { state, particleCount } = params;
  if (particleCount <= 0 || !ensureSurfaceTarget(params)) return false;
  const gl = state.gl;
  renderBufferDensity(params);
  renderComposite(params);
  renderBufferFoamOverlay(params);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return true;
}

export function liquidSurfaceOptionsFromSettings(settings: Record<string, unknown>, renderStyle: string): LiquidSurfaceStyleOptions {
  const enhanced = renderStyle === 'enhanced';
  const ultra = renderStyle === 'ultra' || renderStyle === 'raw';
  const edge = finiteNumberSetting(settings, 'enhancedEdge', enhanced ? 0.74 : 0.82);
  const blend = finiteNumberSetting(settings, 'metaballBlend', 0.76);
  const surfaceRadius = finiteNumberSetting(settings, 'liquidParticleRadius', enhanced ? 1.18 : 1.26);
  return {
    renderStyle,
    pointScale: (enhanced ? 2.35 + blend * 0.48 : 2.58 + blend * 0.68) * surfaceRadius,
    densityScale: finiteNumberSetting(settings, 'liquidSplatDensity', enhanced ? 1.24 : 1.34),
    threshold: finiteNumberSetting(settings, 'liquidSurfaceThreshold', enhanced ? 0.18 : 0.2),
    tightness: finiteNumberSetting(settings, 'liquidEdgeTightness', clamp(edge, 0, 1)),
    opacity: finiteNumberSetting(settings, 'opacity', 0.78),
    edgeSoftness: finiteNumberSetting(settings, 'liquidEdgeSoftness', ultra ? 0.56 : 0.18),
    foamStrength: finiteNumberSetting(settings, 'liquidFoamStrength', ultra ? 1.15 : 0.32),
    refraction: finiteNumberSetting(settings, 'liquidRefraction', 0.58),
    gloss: finiteNumberSetting(settings, 'liquidGloss', 0.78),
    rimStrength: finiteNumberSetting(settings, 'liquidRimLighting', ultra ? 1 : 0),
    thermalStrength: finiteNumberSetting(settings, 'liquidThermalStrength', 0),
    bloomStrength: finiteNumberSetting(settings, 'liquidBloomStrength', ultra ? 0.42 : 0),
    heatShimmer: finiteNumberSetting(settings, 'liquidHeatShimmer', ultra ? 0.28 : 0),
    depthDiffusion: finiteNumberSetting(settings, 'liquidDepthDiffusion', ultra ? 0.22 : 0),
  };
}

function renderTextureDensity(params: TextureParticleParams): void {
  const { state, renderer, positionsTexture, velocitiesTexture, textureWidth, textureHeight, activeCount, options } = params;
  const gl = state.gl;
  const target = renderer.target;
  if (!target) return;
  unbindTextureUnits(gl);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.viewport(0, 0, renderer.width, renderer.height);
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(renderer.textureDensityProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, positionsTexture);
  gl.uniform1i(gl.getUniformLocation(renderer.textureDensityProgram, 'uPositions'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, velocitiesTexture);
  gl.uniform1i(gl.getUniformLocation(renderer.textureDensityProgram, 'uVelocities'), 1);
  gl.uniform2f(gl.getUniformLocation(renderer.textureDensityProgram, 'uResolution'), state.width, state.height);
  gl.uniform2f(gl.getUniformLocation(renderer.textureDensityProgram, 'uTextureSize'), textureWidth, textureHeight);
  gl.uniform1f(gl.getUniformLocation(renderer.textureDensityProgram, 'uPointScale'), options.pointScale * densityPixelScale(state, renderer));
  gl.uniform1f(gl.getUniformLocation(renderer.textureDensityProgram, 'uActiveLimit'), activeCount);
  gl.uniform1f(gl.getUniformLocation(renderer.textureDensityProgram, 'uDensityScale'), options.densityScale);
  gl.drawArrays(gl.POINTS, 0, activeCount);
  gl.disable(gl.BLEND);
}

function renderBufferDensity(params: BufferParticleParams): void {
  const { state, renderer, particleBuffer, particleCount, strideBytes, positionOffsetBytes, velocityOffsetBytes, renderDataOffsetBytes, options } = params;
  const gl = state.gl;
  const target = renderer.target;
  if (!target) return;
  unbindTextureUnits(gl);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
  gl.viewport(0, 0, renderer.width, renderer.height);
  gl.disable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(renderer.bufferDensityProgram);
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
  gl.uniform2f(gl.getUniformLocation(renderer.bufferDensityProgram, 'uResolution'), state.width, state.height);
  gl.uniform1f(gl.getUniformLocation(renderer.bufferDensityProgram, 'uPointScale'), options.pointScale * densityPixelScale(state, renderer));
  gl.uniform1f(gl.getUniformLocation(renderer.bufferDensityProgram, 'uDensityScale'), options.densityScale);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, strideBytes, positionOffsetBytes);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, strideBytes, velocityOffsetBytes);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, strideBytes, renderDataOffsetBytes);
  gl.drawArrays(gl.POINTS, 0, particleCount);
  gl.disable(gl.BLEND);
}

function renderComposite(params: LiquidSurfaceBaseParams): void {
  const { state, renderer, palette, options } = params;
  const gl = state.gl;
  const target = renderer.target;
  if (!target) return;
  const colors = palette.palette;
  const background = colorNumberToRgb(palette.background, [0.0, 0.02, 0.05]);
  const surface = colorNumberToRgb(colors[1] ?? colors[0], [0.28, 0.86, 1]);
  const deep = colorNumberToRgb(colors[2] ?? colors[1] ?? colors[0], [0.02, 0.2, 0.36]);
  const foam = colorNumberToRgb(colors[3] ?? colors[0], [0.92, 1, 1]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.useProgram(renderer.compositeProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, target.texture.texture);
  gl.uniform1i(gl.getUniformLocation(renderer.compositeProgram, 'uField'), 0);
  gl.uniform2f(gl.getUniformLocation(renderer.compositeProgram, 'uTexel'), 1 / Math.max(1, renderer.width), 1 / Math.max(1, renderer.height));
  gl.uniform2f(gl.getUniformLocation(renderer.compositeProgram, 'uResolution'), state.width, state.height);
  gl.uniform3f(gl.getUniformLocation(renderer.compositeProgram, 'uBackground'), background[0], background[1], background[2]);
  gl.uniform3f(gl.getUniformLocation(renderer.compositeProgram, 'uDeepColor'), deep[0], deep[1], deep[2]);
  gl.uniform3f(gl.getUniformLocation(renderer.compositeProgram, 'uSurfaceColor'), surface[0], surface[1], surface[2]);
  gl.uniform3f(gl.getUniformLocation(renderer.compositeProgram, 'uFoamColor'), foam[0], foam[1], foam[2]);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uThreshold'), options.threshold);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uTightness'), options.tightness);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uEdgeSoftness'), options.edgeSoftness);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uOpacity'), options.opacity);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uUltra'), options.renderStyle === 'ultra' || options.renderStyle === 'raw' ? 1 : 0);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uFoamStrength'), options.foamStrength);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uRefraction'), options.refraction);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uGloss'), options.gloss);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uRimStrength'), options.rimStrength);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uThermalStrength'), options.thermalStrength);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uBloomStrength'), options.bloomStrength);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uHeatShimmer'), options.heatShimmer);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uDepthDiffusion'), options.depthDiffusion);
  gl.uniform1f(gl.getUniformLocation(renderer.compositeProgram, 'uTime'), state.timeSeconds);
  gl.bindBuffer(gl.ARRAY_BUFFER, renderer.quadBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function renderTextureFoamOverlay(params: TextureParticleParams): void {
  const { state, renderer, positionsTexture, velocitiesTexture, textureWidth, textureHeight, activeCount, palette, options } = params;
  if ((options.renderStyle !== 'ultra' && options.renderStyle !== 'raw') || options.foamStrength <= 0 || activeCount <= 0 || !renderer.target) return;
  const gl = state.gl;
  const foam = colorNumberToRgb(palette.palette[3] ?? palette.palette[2] ?? palette.palette[0], [0.92, 1, 1]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.useProgram(renderer.textureFoamProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderer.target.texture.texture);
  gl.uniform1i(gl.getUniformLocation(renderer.textureFoamProgram, 'uField'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, positionsTexture);
  gl.uniform1i(gl.getUniformLocation(renderer.textureFoamProgram, 'uPositions'), 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, velocitiesTexture);
  gl.uniform1i(gl.getUniformLocation(renderer.textureFoamProgram, 'uVelocities'), 2);
  gl.uniform2f(gl.getUniformLocation(renderer.textureFoamProgram, 'uResolution'), state.width, state.height);
  gl.uniform2f(gl.getUniformLocation(renderer.textureFoamProgram, 'uTexel'), 1 / Math.max(1, renderer.width), 1 / Math.max(1, renderer.height));
  gl.uniform2f(gl.getUniformLocation(renderer.textureFoamProgram, 'uTextureSize'), textureWidth, textureHeight);
  gl.uniform3f(gl.getUniformLocation(renderer.textureFoamProgram, 'uFoamColor'), foam[0], foam[1], foam[2]);
  gl.uniform1f(gl.getUniformLocation(renderer.textureFoamProgram, 'uThreshold'), options.threshold);
  gl.uniform1f(gl.getUniformLocation(renderer.textureFoamProgram, 'uFoamStrength'), options.foamStrength);
  gl.uniform1f(gl.getUniformLocation(renderer.textureFoamProgram, 'uTime'), state.timeSeconds);
  gl.uniform1f(gl.getUniformLocation(renderer.textureFoamProgram, 'uPointScale'), options.pointScale * 0.48);
  gl.uniform1f(gl.getUniformLocation(renderer.textureFoamProgram, 'uActiveLimit'), activeCount);
  gl.drawArrays(gl.POINTS, 0, activeCount);
  gl.disable(gl.BLEND);
}

function renderBufferFoamOverlay(params: BufferParticleParams): void {
  const { state, renderer, particleBuffer, particleCount, strideBytes, positionOffsetBytes, renderDataOffsetBytes, palette, options } = params;
  if ((options.renderStyle !== 'ultra' && options.renderStyle !== 'raw') || options.foamStrength <= 0 || particleCount <= 0 || !renderer.target) return;
  const gl = state.gl;
  const foam = colorNumberToRgb(palette.palette[3] ?? palette.palette[2] ?? palette.palette[0], [0.92, 1, 1]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.useProgram(renderer.bufferFoamProgram);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderer.target.texture.texture);
  gl.uniform1i(gl.getUniformLocation(renderer.bufferFoamProgram, 'uField'), 0);
  gl.uniform2f(gl.getUniformLocation(renderer.bufferFoamProgram, 'uResolution'), state.width, state.height);
  gl.uniform2f(gl.getUniformLocation(renderer.bufferFoamProgram, 'uTexel'), 1 / Math.max(1, renderer.width), 1 / Math.max(1, renderer.height));
  gl.uniform3f(gl.getUniformLocation(renderer.bufferFoamProgram, 'uFoamColor'), foam[0], foam[1], foam[2]);
  gl.uniform1f(gl.getUniformLocation(renderer.bufferFoamProgram, 'uThreshold'), options.threshold);
  gl.uniform1f(gl.getUniformLocation(renderer.bufferFoamProgram, 'uFoamStrength'), options.foamStrength);
  gl.uniform1f(gl.getUniformLocation(renderer.bufferFoamProgram, 'uTime'), state.timeSeconds);
  gl.uniform1f(gl.getUniformLocation(renderer.bufferFoamProgram, 'uPointScale'), options.pointScale * 0.48);
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, strideBytes, positionOffsetBytes);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, strideBytes, positionOffsetBytes + 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, strideBytes, renderDataOffsetBytes);
  gl.drawArrays(gl.POINTS, 0, particleCount);
  gl.disable(gl.BLEND);
}

function ensureSurfaceTarget(params: LiquidSurfaceBaseParams): boolean {
  const { state, renderer, resolution } = params;
  const target = Math.max(64, Math.min(2048, Math.floor(resolution)));
  const aspect = state.width / Math.max(1, state.height);
  const width = Math.max(1, Math.round(aspect >= 1 ? target : target * aspect));
  const height = Math.max(1, Math.round(aspect >= 1 ? target / aspect : target));
  if (renderer.target && renderer.width === width && renderer.height === height) return true;
  if (renderer.target) state.resources.destroyFramebuffer(renderer.target);
  renderer.target = state.resources.createFramebuffer(state.resources.createRenderTexture({ width, height, precision: 'half-float', filter: 'linear' }));
  renderer.width = width;
  renderer.height = height;
  return true;
}

function densityPixelScale(state: RawWebGL2RenderState, renderer: RawLiquidSurfaceRenderer): number {
  return Math.min(renderer.width / Math.max(1, state.width), renderer.height / Math.max(1, state.height));
}

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

function unbindTextureUnits(gl: WebGL2RenderingContext): void {
  for (let unit = 0; unit < 4; unit += 1) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
