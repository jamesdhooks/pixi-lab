import {
  RawGpuFieldPass,
  RawPingPongRenderTarget,
  RawWebGL2Scene,
  colorNumberToRgb,
  createRawGpuSimulationMetrics,
  finiteNumberSetting,
  rawGpuMetricsToDebugStats,
  type RawGpuSimulationMetrics,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';
import { MYCELIUM_DEFAULTS } from './mycelium.config.js';

interface GpuMyceliumState extends RawWebGL2RenderState {
  target?: RawPingPongRenderTarget;
  seedPass?: RawGpuFieldPass;
  stepPass?: RawGpuFieldPass;
  splatPass?: RawGpuFieldPass;
  displayPass?: RawGpuFieldPass;
  triangleProgram?: WebGLProgram;
  triangleVao?: WebGLVertexArrayObject;
  trianglePositionBuffer?: WebGLBuffer;
  triangleCellBuffer?: WebGLBuffer;
  triangleFacetBuffer?: WebGLBuffer;
  triangleVertexCount?: number;
  triangleMeshWidth?: number;
  triangleMeshHeight?: number;
  splats?: MyceliumSplat[];
  gpuMetrics?: RawGpuSimulationMetrics;
  paletteData?: Float32Array;
  cleanupPointer?: () => void;
  pointerId?: number;
  pointerDown?: boolean;
  previousPointer?: { x: number; y: number };
}

interface MyceliumSplat {
  x: number;
  y: number;
  radius: number;
  mode: number;
  strain: number;
}

const VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aClip;
out vec2 vUv;
void main() {
  vUv = aClip * 0.5 + 0.5;
  gl_Position = vec4(aClip, 0.0, 1.0);
}`;

const TRIANGLE_MESH_SCALE = 1.002;
const TRIANGLE_MESH_MAX_CELLS = 900000;

const SEED_FRAGMENT = `#version 300 es
precision highp float;
uniform float uSeed;
uniform int uColonies;
uniform float uSeedRadius;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) {
  return fract(sin(dot(p + uSeed, vec2(127.1, 311.7))) * 43758.5453123);
}
void seedCenter(vec2 center, float strainValue, inout float activeValue, inout float strain, inout float energy) {
  float d = distance(vUv, center);
  if (d < uSeedRadius) {
    activeValue = 1.0;
    strain = strainValue;
    energy = 1.0;
  }
}
void main() {
  float activeValue = 0.0;
  float strain = 0.0;
  float energy = 0.0;
  if (uColonies > 0) {
    float phase = uSeed * 0.013;
    seedCenter(vec2(0.5), 0.0, activeValue, strain, energy);
    if (uColonies > 1) seedCenter(vec2(0.5) + vec2(cos(phase + 2.399963), sin(phase + 2.399963)) * 0.16, 0.333, activeValue, strain, energy);
    if (uColonies > 2) seedCenter(vec2(0.5) + vec2(cos(phase + 4.799926), sin(phase + 4.799926)) * 0.22, 0.666, activeValue, strain, energy);
    if (uColonies > 3) seedCenter(vec2(0.5) + vec2(cos(phase + 7.199889), sin(phase + 7.199889)) * 0.28, 1.0, activeValue, strain, energy);
    if (uColonies > 4) seedCenter(vec2(0.5) + vec2(cos(phase + 9.599852), sin(phase + 9.599852)) * 0.34, 0.15, activeValue, strain, energy);
    if (uColonies > 5) seedCenter(vec2(0.5) + vec2(cos(phase + 11.999815), sin(phase + 11.999815)) * 0.38, 0.48, activeValue, strain, energy);
    if (uColonies > 6) seedCenter(vec2(0.5) + vec2(cos(phase + 14.399778), sin(phase + 14.399778)) * 0.31, 0.82, activeValue, strain, energy);
    if (uColonies > 7) seedCenter(vec2(0.5) + vec2(cos(phase + 16.799741), sin(phase + 16.799741)) * 0.24, 0.25, activeValue, strain, energy);
  }
  outColor = vec4(activeValue, strain, energy, hash(vUv * 2048.0));
}`;

const STEP_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec2 uGrid;
uniform float uGrowthRate;
uniform float uDecayRate;
uniform float uBranchChance;
uniform float uOverwriteChance;
uniform float uClumping;
uniform float uColorMutation;
uniform float uColorDriftFrequency;
uniform float uBranchColorSplit;
uniform float uSubstrateColorBias;
uniform float uColorScale;
uniform float uTime;
uniform int uVariant;
in vec2 vUv;
out vec4 outColor;
float hash(vec2 p) {
  return fract(sin(dot(p + uTime, vec2(127.1, 311.7))) * 43758.5453123);
}
const float TAU = 6.28318530718;
const float FRONT_ENERGY = 0.105;
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fertility(vec2 cell, vec2 grid, float strain) {
  vec2 p = cell / max(grid, vec2(1.0));
  float broad = valueNoise(p * 7.0 + strain * 13.7);
  float mid = valueNoise(p * 19.0 + strain * 29.3);
  float vein = 1.0 - abs(valueNoise(p * 13.0 + 41.0) - 0.5) * 2.0;
  return clamp(broad * 0.56 + mid * 0.28 + vein * 0.38, 0.0, 1.0);
}
float circularDistance(float a, float b) {
  float d = abs(a - b);
  return min(d, 1.0 - d);
}
float nextColorPosition(float parentColor, vec2 cell, float forwardness, float localFertility) {
  vec2 p = cell / max(uGrid, vec2(1.0));
  float branchiness = 1.0 - forwardness;
  float driftChance = clamp(uColorDriftFrequency * (0.32 + uColorMutation * 0.68) * (0.55 + branchiness * 0.75), 0.0, 1.0);
  float branchChance = clamp(uBranchColorSplit * branchiness * 0.42, 0.0, 1.0);
  float driftEvent = step(hash(cell + parentColor * 53.0), driftChance);
  float branchEvent = step(hash(cell + parentColor * 89.0 + 11.0), branchChance);
  float lineageNoise = valueNoise(p * 3.5 + parentColor * 19.0) - 0.5;
  float branchNoise = valueNoise(p * 2.25 + parentColor * 31.0 + 7.0) - 0.5;
  float mutation = lineageNoise * uColorMutation * 0.11 * uColorScale * driftEvent;
  float branchSplit = branchNoise * uBranchColorSplit * 0.34 * uColorScale * branchEvent;
  float substrate = (localFertility - 0.5) * uSubstrateColorBias * 0.12 * max(driftEvent, branchEvent);
  return fract(parentColor + mutation + branchSplit + substrate);
}
vec4 readCell(vec2 offset) {
  return texture(uState, vUv + offset * uTexel);
}
void consider(vec4 n, vec2 offset, float weight, inout float totalEnergy, inout float bestEnergy, inout float bestStrain, inout float bestHeading, inout float bestAlignment, inout float livingNeighbors) {
  if (n.r > 0.5 && n.b > FRONT_ENERGY) {
    float weightedEnergy = n.b * weight;
    vec2 parentHeading = vec2(cos(n.a * TAU), sin(n.a * TAU));
    vec2 growthDirection = normalize(-offset);
    float alignment = dot(parentHeading, growthDirection);
    totalEnergy += weightedEnergy;
    livingNeighbors += 1.0;
    if (weightedEnergy > bestEnergy) {
      bestEnergy = weightedEnergy;
      bestStrain = n.g;
      bestHeading = n.a;
      bestAlignment = alignment;
    }
  }
}
void main() {
  vec4 current = texture(uState, vUv);
  vec2 cell = floor(vUv * uGrid);
  float activeValue = current.r;
  float strain = current.g;
  float energy = current.b;
  float area = 1.0;
  float totalEnergy = 0.0;
  float bestEnergy = 0.0;
  float bestStrain = 0.0;
  float bestHeading = current.a;
  float bestAlignment = -1.0;
  float livingNeighbors = 0.0;
  if (uVariant == 1) {
    consider(readCell(vec2(-1.0, 0.0)), vec2(-1.0, 0.0), 1.0, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(1.0, 0.0)), vec2(1.0, 0.0), 1.0, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(0.0, -1.0)), vec2(0.0, -1.0), 1.0, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(0.0, 1.0)), vec2(0.0, 1.0), 1.0, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    area = 1.0;
  } else if (uVariant == 2) {
    consider(readCell(vec2(-1.0, 0.0)), vec2(-1.0, 0.0), 0.92, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(1.0, 0.0)), vec2(1.0, 0.0), 0.92, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(0.0, -1.0)), vec2(0.0, -1.0), 0.84, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(0.0, 1.0)), vec2(0.0, 1.0), 0.84, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(-1.0, -1.0)), vec2(-1.0, -1.0), 0.52, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(1.0, -1.0)), vec2(1.0, -1.0), 0.52, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(-1.0, 1.0)), vec2(-1.0, 1.0), 0.52, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(1.0, 1.0)), vec2(1.0, 1.0), 0.52, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    if (hash(cell + 17.0) > 0.68) consider(readCell(vec2(2.0, 0.0)), vec2(2.0, 0.0), 0.32, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    if (hash(cell - 11.0) > 0.68) consider(readCell(vec2(0.0, -2.0)), vec2(0.0, -2.0), 0.32, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    area = 0.68 + hash(cell) * 0.82;
  } else {
    float pointsUp = 1.0 - mod(cell.x + cell.y + 1.0, 2.0);
    vec2 thirdOffset = mix(vec2(0.0, 1.0), vec2(0.0, -1.0), pointsUp);
    consider(readCell(vec2(-1.0, 0.0)), vec2(-1.0, 0.0), 1.0, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(vec2(1.0, 0.0)), vec2(1.0, 0.0), 1.0, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    consider(readCell(thirdOffset), thirdOffset, 1.0, totalEnergy, bestEnergy, bestStrain, bestHeading, bestAlignment, livingNeighbors);
    area = 0.58;
  }
  if (activeValue > 0.5) {
    float frontDrain = smoothstep(0.62, 1.15, energy) * (0.002 + uOverwriteChance * 0.004);
    energy = max(0.075, energy - uDecayRate * 0.003 - frontDrain);
    if (bestEnergy > FRONT_ENERGY && uOverwriteChance > 0.0) {
      float overwritePressure = clamp(0.12 + bestEnergy * 0.48 + livingNeighbors * 0.08, 0.0, 1.0);
      float forwardness = smoothstep(0.0, 0.48, bestAlignment);
      float localFertility = fertility(cell, uGrid, bestStrain);
      float nextStrain = nextColorPosition(bestStrain, cell + 131.0, forwardness, localFertility);
      float colorDelta = circularDistance(strain, nextStrain);
      float recolorGate = smoothstep(0.035, 0.16, colorDelta);
      float overwriteChance = uOverwriteChance * overwritePressure * mix(0.58, 1.0, forwardness) * recolorGate;
      if (recolorGate > 0.0 && hash(cell + vec2(uTime * 7.7, uTime * 13.1)) < overwriteChance) {
        strain = nextStrain;
        energy = clamp(FRONT_ENERGY + bestEnergy * (0.16 + hash(cell + 151.0) * 0.08), FRONT_ENERGY + 0.012, 0.42);
        current.a = fract(bestHeading + (hash(cell + 173.0) - 0.5) * mix(0.02, 0.18, uOverwriteChance));
      }
    }
  } else if (bestEnergy > FRONT_ENERGY) {
    float neighborPressure = totalEnergy / max(1.0, livingNeighbors);
    float forwardness = smoothstep(0.16, 0.52, bestAlignment);
    float branchGate = mix(uBranchChance, 1.0, forwardness);
    float crowdGate = mix(1.0, uBranchChance, smoothstep(1.0, 3.0, livingNeighbors));
    float localFertility = fertility(cell, uGrid, bestStrain);
    float clumpPower = uClumping * uClumping;
    float habitatCutoff = mix(0.0, 0.78, clumpPower);
    float habitat = smoothstep(habitatCutoff, min(0.98, habitatCutoff + mix(0.62, 0.12, clumpPower)), localFertility);
    float clumpBand = pow(max(habitat, 0.0), mix(1.0, 3.2, clumpPower));
    float clumpGate = mix(1.0, 0.0008 + clumpBand * 7.5, clumpPower);
    float branchPocket = mix(1.0, 0.18 + clumpBand * 3.4, clumpPower);
    float chance = clamp((0.014 + uGrowthRate * neighborPressure * 0.074) * area * branchGate * crowdGate * clumpGate * branchPocket, 0.0, 0.82);
    if (hash(cell + vec2(uTime * 23.1, uTime * 11.7)) < chance) {
      activeValue = 1.0;
      strain = nextColorPosition(bestStrain, cell, forwardness, localFertility);
      energy = clamp(bestEnergy * (0.84 + hash(cell + 5.0) * 0.2) * sqrt(area), 0.26, 1.35);
      float turn = (hash(cell + 47.0) - 0.5) * mix(0.025, 0.22, uBranchChance);
      float branchTurn = (hash(cell + 83.0) < uBranchChance * (1.0 - forwardness)) ? (hash(cell + 101.0) - 0.5) * 0.36 : 0.0;
      energy *= mix(0.72, 1.0, forwardness + uBranchChance * 0.35);
      current.a = fract(bestHeading + turn + branchTurn);
    }
  }
  outColor = vec4(activeValue, strain, energy, current.a);
}`;

const SPLAT_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uPoint;
uniform float uRadius;
uniform float uMode;
uniform float uStrain;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 state = texture(uState, vUv);
  float d = distance(vUv, uPoint);
  float falloff = max(0.0, 1.0 - (d * d) / max(0.00001, uRadius * uRadius));
  if (falloff > 0.0) {
    if (uMode < 0.5) {
      state.r = 1.0;
      state.g = uStrain;
      state.b = max(state.b, 0.68 + falloff * 0.42);
    } else if (uMode < 1.5) {
      if (state.r > 0.5) state.b = min(1.7, state.b + falloff * 0.72);
    } else {
      state.b = max(0.0, state.b - falloff * 1.2);
      if (falloff > 0.74) state.r = 0.0;
    }
  }
  outColor = state;
}`;

const DISPLAY_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uGrid;
uniform vec3 uPalette[8];
uniform vec3 uBackground;
uniform int uVariant;
uniform int uVisualStyle;
in vec2 vUv;
out vec4 outColor;
vec3 paletteColor(float position) {
  float scaled = fract(position) * 8.0;
  float segment = floor(scaled);
  float mixAmount = smoothstep(0.0, 1.0, fract(scaled));
  vec3 a = uPalette[0];
  vec3 b = uPalette[1];
  if (segment < 1.0) {
    a = uPalette[0]; b = uPalette[1];
  } else if (segment < 2.0) {
    a = uPalette[1]; b = uPalette[2];
  } else if (segment < 3.0) {
    a = uPalette[2]; b = uPalette[3];
  } else if (segment < 4.0) {
    a = uPalette[3]; b = uPalette[4];
  } else if (segment < 5.0) {
    a = uPalette[4]; b = uPalette[5];
  } else if (segment < 6.0) {
    a = uPalette[5]; b = uPalette[6];
  } else if (segment < 7.0) {
    a = uPalette[6]; b = uPalette[7];
  } else {
    a = uPalette[7]; b = uPalette[0];
  }
  return mix(a, b, mixAmount);
}
vec4 readGrid(ivec2 cell) {
  if (cell.x < 0 || cell.y < 0 || cell.x >= int(uGrid.x) || cell.y >= int(uGrid.y)) return vec4(0.0);
  return texelFetch(uState, cell, 0);
}
void gatherNeighbors(ivec2 cell, out float living, out float edge, out float glow, out vec3 glowColor) {
  living = 0.0;
  edge = 1.0;
  glow = 0.0;
  glowColor = vec3(0.0);
  float colorWeight = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      if (x == 0 && y == 0) continue;
      vec4 neighbor = readGrid(cell + ivec2(x, y));
      float live = step(0.5, neighbor.r);
      living += live;
      glow += live * max(0.0, neighbor.b);
      glowColor += paletteColor(neighbor.g) * live * max(0.08, neighbor.b);
      colorWeight += live * max(0.08, neighbor.b);
    }
  }
  edge = 1.0 - smoothstep(2.0, 5.0, living);
  if (colorWeight > 0.0) glowColor /= colorWeight;
}
vec4 organicBloomField(vec2 uv) {
  vec2 gridPos = uv * uGrid;
  ivec2 baseCell = ivec2(floor(gridPos));
  float density = 0.0;
  float glow = 0.0;
  float colorWeight = 0.0;
  vec3 color = vec3(0.0);
  for (int y = -3; y <= 3; y++) {
    for (int x = -3; x <= 3; x++) {
      ivec2 cell = baseCell + ivec2(x, y);
      vec4 state = readGrid(cell);
      float live = step(0.5, state.r);
      vec2 center = vec2(float(cell.x), float(cell.y)) + vec2(0.5);
      float distanceToCell = length(gridPos - center);
      float kernel = exp(-distanceToCell * distanceToCell * 0.58);
      float energy = clamp(state.b, 0.0, 1.35);
      float contribution = live * kernel * (0.62 + energy * 0.42);
      density += contribution;
      glow += contribution * smoothstep(0.22, 1.12, energy);
      color += paletteColor(state.g) * contribution;
      colorWeight += contribution;
    }
  }
  if (colorWeight <= 0.0001) return vec4(uBackground, 1.0);
  color /= colorWeight;
  float fiberNoise = sin(gridPos.x * 0.41 + gridPos.y * 0.23 + density * 3.7) * 0.5 + 0.5;
  float microNoise = sin(gridPos.x * 1.73 - gridPos.y * 1.19 + color.r * 8.0) * 0.5 + 0.5;
  float contour = smoothstep(0.52, 0.92, density + (fiberNoise - 0.5) * 0.08);
  float core = smoothstep(1.08, 1.92, density);
  float halo = smoothstep(0.06, 0.62, density) * (1.0 - contour);
  vec3 livingColor = mix(color * 0.58, color * 1.18 + vec3(0.08, 0.06, 0.04), core);
  livingColor = mix(livingColor, paletteColor(fract(colorWeight * 0.09 + glow * 0.15)), glow * 0.18);
  livingColor *= 0.82 + fiberNoise * 0.16 + microNoise * 0.06;
  vec3 haloColor = mix(uBackground, color * (0.42 + glow * 0.2), halo * 0.72);
  vec3 finalColor = mix(haloColor, livingColor, contour);
  float rim = smoothstep(0.46, 0.72, density) * (1.0 - smoothstep(0.86, 1.2, density));
  finalColor = mix(finalColor, color * 1.32 + vec3(0.06), rim * 0.22);
  return vec4(finalColor, 1.0);
}
void main() {
  if (uVisualStyle >= 2) {
    outColor = organicBloomField(vUv);
    return;
  }
  vec2 sampleCell = floor(vUv * uGrid);
  float mask = 1.0;
  ivec2 cell = ivec2(clamp(sampleCell, vec2(0.0), uGrid - vec2(1.0)));
  vec4 state = texelFetch(uState, cell, 0);
  float living;
  float edge;
  float glow;
  vec3 glowColor;
  gatherNeighbors(cell, living, edge, glow, glowColor);
  if (state.r < 0.5 || mask < 0.01) {
    vec3 bg = uBackground;
    if (uVisualStyle >= 2 && glow > 0.0) {
      float halo = smoothstep(0.04, 1.5, glow) * 0.46;
      bg = mix(bg, glowColor, halo);
    }
    outColor = vec4(bg, 1.0);
    return;
  }
  vec3 colony = paletteColor(state.g);
  float energy = clamp(state.b, 0.0, 1.35);
  vec2 local = fract(vUv * uGrid);
  float inner = smoothstep(0.02, 0.42, min(min(local.x, 1.0 - local.x), min(local.y, 1.0 - local.y)));
  float shade = 0.72 + clamp(energy, 0.0, 1.0) * 0.34;
  if (uVisualStyle >= 1) {
    float frontier = smoothstep(0.34, 1.05, energy);
    float organic = sin((sampleCell.x * 12.9898 + sampleCell.y * 78.233 + state.g * 37.719)) * 0.5 + 0.5;
    shade = 0.66 + inner * 0.14 + energy * 0.26 + organic * 0.06;
    colony = mix(colony * (0.62 + inner * 0.38), colony + vec3(0.16, 0.14, 0.08), frontier * 0.34);
    colony = mix(colony, colony * 0.54, edge * 0.48);
  }
  if (uVisualStyle >= 2) {
    float bloom = smoothstep(0.18, 1.0, energy + glow * 0.24) * 0.32;
    colony += paletteColor(fract(state.g + 0.08)) * bloom;
  }
  outColor = vec4(mix(uBackground, colony * shade, mask), 1.0);
}`;

const TRIANGLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aClip;
layout(location = 1) in vec2 aCell;
layout(location = 2) in float aFacet;
out vec2 vCell;
out float vFacet;
void main() {
  gl_Position = vec4(aClip, 0.0, 1.0);
  vCell = aCell;
  vFacet = aFacet;
}`;

const TRIANGLE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uGrid;
uniform vec3 uPalette[8];
uniform vec3 uBackground;
uniform int uVisualStyle;
in vec2 vCell;
in float vFacet;
out vec4 outColor;
vec3 paletteColor(float position) {
  float scaled = fract(position) * 8.0;
  float segment = floor(scaled);
  float mixAmount = smoothstep(0.0, 1.0, fract(scaled));
  vec3 a = uPalette[0];
  vec3 b = uPalette[1];
  if (segment < 1.0) {
    a = uPalette[0]; b = uPalette[1];
  } else if (segment < 2.0) {
    a = uPalette[1]; b = uPalette[2];
  } else if (segment < 3.0) {
    a = uPalette[2]; b = uPalette[3];
  } else if (segment < 4.0) {
    a = uPalette[3]; b = uPalette[4];
  } else if (segment < 5.0) {
    a = uPalette[4]; b = uPalette[5];
  } else if (segment < 6.0) {
    a = uPalette[5]; b = uPalette[6];
  } else if (segment < 7.0) {
    a = uPalette[6]; b = uPalette[7];
  } else {
    a = uPalette[7]; b = uPalette[0];
  }
  return mix(a, b, mixAmount);
}
vec4 readGrid(ivec2 cell) {
  if (cell.x < 0 || cell.y < 0 || cell.x >= int(uGrid.x) || cell.y >= int(uGrid.y)) return vec4(0.0);
  return texelFetch(uState, cell, 0);
}
void gatherNeighbors(ivec2 cell, out float living, out float edge, out float glow, out vec3 glowColor) {
  living = 0.0;
  edge = 1.0;
  glow = 0.0;
  glowColor = vec3(0.0);
}
void main() {
  ivec2 cell = ivec2(clamp(floor(vCell), vec2(0.0), uGrid - vec2(1.0)));
  vec4 state = texelFetch(uState, cell, 0);
  float living;
  float edge;
  float glow;
  vec3 glowColor;
  gatherNeighbors(cell, living, edge, glow, glowColor);
  if (state.r < 0.5) {
    vec3 bg = uBackground;
    if (uVisualStyle >= 2 && glow > 0.0) {
      float halo = smoothstep(0.04, 1.5, glow) * 0.42;
      bg = mix(bg, glowColor, halo);
    }
    outColor = vec4(bg, 1.0);
    return;
  }
  vec3 colony = paletteColor(state.g);
  float energy = clamp(state.b, 0.0, 1.35);
  float shade = (0.76 + clamp(energy, 0.0, 1.0) * 0.28) * vFacet;
  if (uVisualStyle >= 1) {
    float frontier = smoothstep(0.34, 1.05, energy);
    float organic = sin((vCell.x * 12.9898 + vCell.y * 78.233 + state.g * 37.719)) * 0.5 + 0.5;
    shade = (0.68 + energy * 0.28 + organic * 0.07) * vFacet;
    colony = mix(colony, colony + vec3(0.16, 0.14, 0.08), frontier * 0.36);
    colony = mix(colony, colony * 0.56, edge * 0.5);
  }
  if (uVisualStyle >= 2) {
    float bloom = smoothstep(0.18, 1.0, energy + glow * 0.24) * 0.34;
    colony += paletteColor(fract(state.g + 0.08)) * bloom;
  }
  outColor = vec4(colony * shade, 1.0);
}`;

export class GpuMyceliumScene extends RawWebGL2Scene {
  constructor(private readonly preview = false) {
    super({
      name: 'GpuMycelium',
      markup: '<canvas class="h-full w-full touch-none bg-slate-950"></canvas>',
      canvasSelector: 'canvas',
      maxDevicePixelRatio: preview ? 1.25 : 2,
      renderScale: () => preview ? 0.75 : 1,
      onInit: (rawState) => init(rawState as GpuMyceliumState, this.preview),
      onReset: (rawState) => reset(rawState as GpuMyceliumState, this.preview),
      onSettingsChange: (rawState, change) => {
        const state = rawState as GpuMyceliumState;
        if (change?.key === 'resolution' || change?.key === 'topology') reset(state, this.preview);
      },
      onModeChange: (rawState, mode) => {
        if (mode === 'demo') reset(rawState as GpuMyceliumState, this.preview);
      },
      render: (rawState) => render(rawState as GpuMyceliumState, this.preview),
      getDebugStats: (rawState) => gpuDebugStats(rawState as GpuMyceliumState),
      onDestroy: (rawState) => destroy(rawState as GpuMyceliumState),
    });
  }
}

function init(state: GpuMyceliumState, preview: boolean): void {
  const gl = state.gl;
  state.seedPass = new RawGpuFieldPass(gl, { vertex: VERTEX, fragment: SEED_FRAGMENT });
  state.stepPass = new RawGpuFieldPass(gl, { vertex: VERTEX, fragment: STEP_FRAGMENT });
  state.splatPass = new RawGpuFieldPass(gl, { vertex: VERTEX, fragment: SPLAT_FRAGMENT });
  state.displayPass = new RawGpuFieldPass(gl, { vertex: VERTEX, fragment: DISPLAY_FRAGMENT });
  state.triangleProgram = createProgram(gl, TRIANGLE_VERTEX, TRIANGLE_FRAGMENT);
  state.triangleVao = gl.createVertexArray() ?? undefined;
  state.splats = [];
  attachPointer(state);
  reset(state, preview);
}

function reset(state: GpuMyceliumState, preview: boolean): void {
  const resolution = Math.floor(clamp(finiteNumberSetting(state.settings, 'resolution', Number(MYCELIUM_DEFAULTS.resolution)), 48, preview ? 384 : 4096));
  const aspect = state.height / Math.max(1, state.width);
  const triangleRows = Math.ceil(resolution * aspect / Math.sqrt(3));
  const rows = Math.max(24, Math.round(resolution * Math.max(0.35, variant(state) === 0 ? triangleRows / resolution : aspect)));
  state.target?.destroy();
  state.target = new RawPingPongRenderTarget(state.resources, { width: resolution, height: rows, precision: 'half-float' });
  rebuildTriangleMesh(state);
  state.gpuMetrics = createRawGpuSimulationMetrics({
    engine: 'gpu-mycelium',
    stateWidth: resolution,
    stateHeight: rows,
    stateTextures: 2,
    precision: 'half-float',
    passesPerFrame: preview ? 3 : 9,
    capabilities: state.resources.capabilities,
  });
  renderSeed(state);
  state.gl.bindFramebuffer(state.gl.FRAMEBUFFER, null);
}

function render(state: GpuMyceliumState, preview: boolean): void {
  if (!state.target || !state.stepPass || !state.splatPass || !state.displayPass) return;
  const gl = state.gl;
  if (state.pointerDown && state.previousPointer) pushPaintSplat(state, state.previousPointer, true);
  const steps = Math.max(1, Math.min(preview ? 2 : 8, Math.ceil(state.deltaSeconds * 72)));
  for (let i = 0; i < steps; i += 1) renderStep(state);
  for (const splat of state.splats ?? []) renderSplat(state, splat);
  if (state.splats) state.splats.length = 0;
  gl.disable(gl.BLEND);
  if (variant(state) === 0 && visualStyle(state) < 2) {
    if (renderTriangleMesh(state)) return;
  }
  renderDisplayField(state, variant(state));
}

function renderDisplayField(state: GpuMyceliumState, displayVariant: number): void {
  if (!state.target || !state.displayPass) return;
  const gl = state.gl;
  state.canvas.dataset.myceliumRender = `${state.frame}:${displayVariant}:${visualStyle(state)}`;
  state.displayPass.render({
    target: null,
    width: state.width,
    height: state.height,
    bind: (_passGl, _program, uniform) => {
      bindTexture(gl, state.target?.read.texture.texture ?? null, 0);
      uniform1i(gl, uniform, 'uState', 0);
      gl.uniform2f(uniform('uGrid'), state.target?.width ?? 1, state.target?.height ?? 1);
      gl.uniform3fv(uniform('uPalette'), palette(state));
      gl.uniform3fv(uniform('uBackground'), background(state));
      uniform1i(gl, uniform, 'uVariant', displayVariant);
      uniform1i(gl, uniform, 'uVisualStyle', visualStyle(state));
    },
  });
}

function renderTriangleMesh(state: GpuMyceliumState): boolean {
  if (!state.target || !state.triangleProgram || !state.triangleVao || !state.triangleVertexCount) return false;
  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.SCISSOR_TEST);
  const bg = background(state);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(state.triangleProgram);
  gl.bindVertexArray(state.triangleVao ?? null);
  bindTexture(gl, state.target.read.texture.texture, 0);
  gl.uniform1i(gl.getUniformLocation(state.triangleProgram, 'uState'), 0);
  gl.uniform2f(gl.getUniformLocation(state.triangleProgram, 'uGrid'), state.target.width, state.target.height);
  gl.uniform3fv(gl.getUniformLocation(state.triangleProgram, 'uPalette'), palette(state));
  gl.uniform3fv(gl.getUniformLocation(state.triangleProgram, 'uBackground'), background(state));
  gl.uniform1i(gl.getUniformLocation(state.triangleProgram, 'uVisualStyle'), visualStyle(state));
  gl.drawArrays(gl.TRIANGLES, 0, state.triangleVertexCount);
  const error = gl.getError();
  gl.bindVertexArray(null);
  gl.useProgram(null);
  return error === gl.NO_ERROR;
}

function rebuildTriangleMesh(state: GpuMyceliumState): void {
  const target = state.target;
  if (!target || !state.triangleProgram || !state.triangleVao) return;
  destroyTriangleMeshBuffers(state);
  const cols = target.width;
  const rows = target.height;
  const renderCols = cols + 1;
  const cellCount = renderCols * rows;
  if (variant(state) !== 0 || cellCount > TRIANGLE_MESH_MAX_CELLS) {
    state.triangleVertexCount = 0;
    return;
  }

  const vertexCount = cellCount * 3;
  const positions = new Float32Array(vertexCount * 2);
  const cells = new Float32Array(vertexCount * 2);
  const facets = new Float32Array(vertexCount);
  const half = 2 / Math.max(1, cols);
  const side = half * 2;
  const cellHeight = 2 / Math.max(1, rows);

  for (let i = 0; i < cellCount; i += 1) {
    const renderColumn = i % renderCols;
    const row = Math.floor(i / renderCols);
    const dataRow = rows - 1 - row;
    const bx = -1 + (renderColumn - 1) * half;
    const top = 1 - row * cellHeight;
    const bottom = 1 - (row + 1) * cellHeight;
    const apexUp = (renderColumn + dataRow) % 2 === 0;
    const p0: [number, number] = apexUp ? [bx, bottom] : [bx, top];
    const p1: [number, number] = apexUp ? [bx + half, top] : [bx + side, top];
    const p2: [number, number] = apexUp ? [bx + side, bottom] : [bx + half, bottom];
    const cx = (p0[0] + p1[0] + p2[0]) / 3;
    const cy = (p0[1] + p1[1] + p2[1]) / 3;
    const dataCol = clamp(renderColumn - 1, 0, cols - 1);
    const points = [p0, p1, p2] as const;
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = i * 3 + corner;
      const px = cx + (points[corner][0] - cx) * TRIANGLE_MESH_SCALE;
      const py = cy + (points[corner][1] - cy) * TRIANGLE_MESH_SCALE;
      positions[vertex * 2] = px;
      positions[vertex * 2 + 1] = py;
      cells[vertex * 2] = dataCol;
      cells[vertex * 2 + 1] = dataRow;
      facets[vertex] = 1;
    }
  }

  const gl = state.gl;
  state.trianglePositionBuffer = gl.createBuffer() ?? undefined;
  state.triangleCellBuffer = gl.createBuffer() ?? undefined;
  state.triangleFacetBuffer = gl.createBuffer() ?? undefined;
  if (!state.trianglePositionBuffer || !state.triangleCellBuffer || !state.triangleFacetBuffer) {
    destroyTriangleMeshBuffers(state);
    return;
  }
  gl.bindVertexArray(state.triangleVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.trianglePositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.triangleCellBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cells, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.triangleFacetBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, facets, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  state.triangleVertexCount = vertexCount;
  state.triangleMeshWidth = cols;
  state.triangleMeshHeight = rows;
}

function renderSeed(state: GpuMyceliumState): void {
  if (!state.target || !state.seedPass) return;
  const gl = state.gl;
  const configuredColonies = Math.round(finiteNumberSetting(state.settings, 'demoSeedColonies', 0));
  const demoFallback = state.mode === 'demo' ? 5 : 0;
  const colonies = configuredColonies > 0 ? configuredColonies : demoFallback;
  const configuredRadius = finiteNumberSetting(state.settings, 'demoSeedRadius', 0.012);
  const minCellRadius = Math.max(
    8 / Math.max(1, state.target.width),
    8 / Math.max(1, state.target.height),
  );
  const seedRadius = colonies > 0 ? Math.max(configuredRadius, minCellRadius) : configuredRadius;
  state.canvas.dataset.myceliumSeed = `${colonies}:${seedRadius.toFixed(4)}:${state.mode ?? 'none'}:${state.settings.topology ?? 'none'}:${state.settings.renderStyle ?? 'none'}`;
  state.seedPass.render({
    target: state.target.read,
    width: state.target.width,
    height: state.target.height,
    bind: (_passGl, _program, uniform) => {
      uniform1f(gl, uniform, 'uSeed', Math.random() * 1000);
      uniform1i(gl, uniform, 'uColonies', colonies);
      uniform1f(gl, uniform, 'uSeedRadius', seedRadius);
    },
  });
}

function renderStep(state: GpuMyceliumState): void {
  if (!state.target || !state.stepPass) return;
  const gl = state.gl;
  state.stepPass.render({
    target: state.target.write,
    width: state.target.width,
    height: state.target.height,
    bind: (_passGl, _program, uniform) => {
      bindTexture(gl, state.target?.read.texture.texture ?? null, 0);
      uniform1i(gl, uniform, 'uState', 0);
      gl.uniform2f(uniform('uTexel'), 1 / (state.target?.width ?? 1), 1 / (state.target?.height ?? 1));
      gl.uniform2f(uniform('uGrid'), state.target?.width ?? 1, state.target?.height ?? 1);
      uniform1f(gl, uniform, 'uGrowthRate', effectiveGrowthRate(state));
      uniform1f(gl, uniform, 'uDecayRate', finiteNumberSetting(state.settings, 'pruneRate', Number(MYCELIUM_DEFAULTS.pruneRate)));
      uniform1f(gl, uniform, 'uBranchChance', finiteNumberSetting(state.settings, 'branchChance', Number(MYCELIUM_DEFAULTS.branchChance)));
      uniform1f(gl, uniform, 'uOverwriteChance', finiteNumberSetting(state.settings, 'overwriteChance', Number(MYCELIUM_DEFAULTS.overwriteChance)));
      uniform1f(gl, uniform, 'uClumping', finiteNumberSetting(state.settings, 'growthClumping', Number(MYCELIUM_DEFAULTS.growthClumping)));
      uniform1f(gl, uniform, 'uColorMutation', finiteNumberSetting(state.settings, 'colorMutation', Number(MYCELIUM_DEFAULTS.colorMutation)));
      uniform1f(gl, uniform, 'uColorDriftFrequency', finiteNumberSetting(state.settings, 'colorDriftFrequency', Number(MYCELIUM_DEFAULTS.colorDriftFrequency)));
      uniform1f(gl, uniform, 'uBranchColorSplit', finiteNumberSetting(state.settings, 'branchColorSplit', Number(MYCELIUM_DEFAULTS.branchColorSplit)));
      uniform1f(gl, uniform, 'uSubstrateColorBias', finiteNumberSetting(state.settings, 'substrateColorBias', Number(MYCELIUM_DEFAULTS.substrateColorBias)));
      uniform1f(gl, uniform, 'uColorScale', effectiveColorScale(state));
      uniform1f(gl, uniform, 'uTime', state.timeSeconds);
      uniform1i(gl, uniform, 'uVariant', variant(state));
    },
  });
  state.target.swap();
}

function renderSplat(state: GpuMyceliumState, splat: MyceliumSplat): void {
  if (!state.target || !state.splatPass) return;
  const gl = state.gl;
  state.splatPass.render({
    target: state.target.write,
    width: state.target.width,
    height: state.target.height,
    bind: (_passGl, _program, uniform) => {
      bindTexture(gl, state.target?.read.texture.texture ?? null, 0);
      uniform1i(gl, uniform, 'uState', 0);
      gl.uniform2f(uniform('uPoint'), splat.x, splat.y);
      uniform1f(gl, uniform, 'uRadius', splat.radius);
      uniform1f(gl, uniform, 'uMode', splat.mode);
      uniform1f(gl, uniform, 'uStrain', splat.strain);
    },
  });
  state.target.swap();
}

function attachPointer(state: GpuMyceliumState): void {
  const canvas = state.canvas;
  const local = (event: PointerEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((rect.bottom - event.clientY) / Math.max(1, rect.height), 0, 1),
    };
  };
  const down = (event: PointerEvent) => {
    const point = local(event);
    state.pointerDown = true;
    state.pointerId = event.pointerId;
    state.previousPointer = point;
    pushPaintSplat(state, point, false);
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!state.pointerDown || event.pointerId !== state.pointerId) return;
    const point = local(event);
    pushPaintSplat(state, point, true);
    state.previousPointer = point;
    event.preventDefault();
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId === state.pointerId) {
      state.pointerDown = false;
      state.pointerId = undefined;
      state.previousPointer = undefined;
    }
    canvas.releasePointerCapture?.(event.pointerId);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  state.cleanupPointer = () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  };
}

function pushPaintSplat(state: GpuMyceliumState, point: { x: number; y: number }, drag: boolean): void {
  const brushRadius = finiteNumberSetting(state.settings, 'brushRadius', Number(MYCELIUM_DEFAULTS.brushRadius));
  state.splats?.push({
    x: point.x,
    y: point.y,
    radius: brushRadius * (drag ? 1.35 : 1),
    mode: 0,
    strain: Math.random(),
  });
}

function destroy(state: GpuMyceliumState): void {
  state.cleanupPointer?.();
  state.target?.destroy();
  state.seedPass?.destroy();
  state.stepPass?.destroy();
  state.splatPass?.destroy();
  state.displayPass?.destroy();
  destroyTriangleMeshBuffers(state);
  if (state.triangleProgram) state.gl.deleteProgram(state.triangleProgram);
  if (state.triangleVao) state.gl.deleteVertexArray(state.triangleVao);
}

function destroyTriangleMeshBuffers(state: GpuMyceliumState): void {
  const gl = state.gl;
  if (state.trianglePositionBuffer) gl.deleteBuffer(state.trianglePositionBuffer);
  if (state.triangleCellBuffer) gl.deleteBuffer(state.triangleCellBuffer);
  if (state.triangleFacetBuffer) gl.deleteBuffer(state.triangleFacetBuffer);
  state.trianglePositionBuffer = undefined;
  state.triangleCellBuffer = undefined;
  state.triangleFacetBuffer = undefined;
  state.triangleVertexCount = 0;
  state.triangleMeshWidth = undefined;
  state.triangleMeshHeight = undefined;
}

function gpuDebugStats(state: GpuMyceliumState): Record<string, string | number | boolean | null> | null {
  const metrics = state.gpuMetrics;
  if (!metrics) return null;
  return rawGpuMetricsToDebugStats(metrics);
}

function variant(state: GpuMyceliumState): number {
  return state.settings.topology === 'square' ? 1 : 0;
}

function visualStyle(state: GpuMyceliumState): number {
  if (state.settings.renderStyle === 'bloom') return 2;
  if (state.settings.renderStyle === 'basic') return 0;
  return 1;
}

function bindTexture(gl: WebGL2RenderingContext, texture: WebGLTexture | null, unit: number): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

function uniform1i(gl: WebGL2RenderingContext, uniform: (name: string) => WebGLUniformLocation | null, name: string, value: number): void {
  gl.uniform1i(uniform(name), value);
}

function uniform1f(gl: WebGL2RenderingContext, uniform: (name: string) => WebGLUniformLocation | null, name: string, value: number): void {
  gl.uniform1f(uniform(name), value);
}

function effectiveGrowthRate(state: GpuMyceliumState): number {
  const base = finiteNumberSetting(state.settings, 'growthRate', Number(MYCELIUM_DEFAULTS.growthRate));
  const resolution = state.target?.width ?? Number(MYCELIUM_DEFAULTS.resolution);
  const reference = Number(MYCELIUM_DEFAULTS.resolution);
  return base * Math.sqrt(Math.max(1, resolution) / Math.max(1, reference));
}

function effectiveColorScale(state: GpuMyceliumState): number {
  const resolution = state.target?.width ?? Number(MYCELIUM_DEFAULTS.resolution);
  const reference = Number(MYCELIUM_DEFAULTS.resolution);
  return clamp(Math.sqrt(Math.max(1, reference) / Math.max(1, resolution)), 0.22, 1.15);
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create Mycelium triangle program.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown Mycelium triangle program link failure.';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create Mycelium triangle shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown Mycelium triangle shader compile failure.';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function palette(state: GpuMyceliumState): Float32Array {
  const values = state.style?.palette ?? [0xa78bfa, 0x22d3ee, 0xf0abfc, 0xffffff, 0x84cc16, 0xf59e0b, 0x67e8f9, 0xfef3c7];
  const out = state.paletteData ?? (state.paletteData = new Float32Array(24));
  for (let i = 0; i < 8; i += 1) {
    const rgb = colorNumberToRgb(values[i % values.length], [1, 1, 1]);
    out[i * 3] = rgb[0];
    out[i * 3 + 1] = rgb[1];
    out[i * 3 + 2] = rgb[2];
  }
  return out;
}

function background(state: GpuMyceliumState): [number, number, number] {
  return colorNumberToRgb(state.style?.background, [0.02, 0.025, 0.055]);
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
