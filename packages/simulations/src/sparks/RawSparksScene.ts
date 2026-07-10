import {
  RawGpuFieldPass,
  RawGpuParticleState,
  RawPingPongRenderTarget,
  RawWebGL2Scene,
  createRawGpuSimulationMetrics,
  finiteNumberSetting,
  linkRawWebGL2Program,
  rawGpuMetricsToDebugStats,
  type GestureEvent,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';
import {
  BUILD_MODE_ID,
  BUILD_OBSTACLE_MESH_COLOR,
  BUILD_OBSTACLE_MESH_COLOR_GLSL,
  BUILD_OBSTACLE_PREVIEW_COLOR,
  BUILD_OBSTACLE_PREVIEW_COLOR_GLSL,
  BuildPathController,
  pushBuildCapsuleTriangles,
  pushBuildFixtureTriangles,
  type BuildFixtureSamples,
} from '../shared/build-mode.js';
import { SPARK_SIZE_VARIABILITY_GLSL, SPARK_SIZE_VARIABILITY_KEY, sparkParticleProfileSettingKey, type SparkProfileSettingKey } from '../shared/spark-rendering.js';
import { SPARKS_DEFAULTS } from './sparks.config.js';

type SparksMode = 'welding' | 'pinwheel' | 'shower' | 'build';
export type SparksEmitterPattern = 'welding' | 'pinwheel' | 'shower';
type SparksRenderStyle = 'basic' | 'enhanced' | 'ultra';

const MAX_BUILD_SURFACES = 12;
const MAX_BUILD_SURFACE_UNIFORMS = MAX_BUILD_SURFACES + 1;
const MAX_CORE_FLASHES = 192;

interface BuildSurface {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface SpawnCommand {
  x: number;
  y: number;
  vx: number;
  vy: number;
  count: number;
  kind: number;
  seed: number;
  paletteSeed: number;
  power: number;
  lifeScale: number;
  pattern: number;
}

interface CoreFlash {
  x: number;
  y: number;
  age: number;
  life: number;
  baseSize: number;
  intensity: number;
  seed: number;
}

interface TorchContact {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  strength: number;
  age: number;
  accumulator: number;
  coreAccumulator: number;
  pattern: SparksEmitterPattern;
}

interface SparkParticleRuntimeProfile {
  rate: number;
  size: number;
  length: number;
  lengthVariability: number;
  sizeVariability: number;
  lifespan: number;
  lifespanVariability: number;
  speedScale: number;
  intensity: number;
  afterglow: number;
}

interface SparksSettings {
  emissionRate: number;
  sparkPower: number;
  sparkDirectionChaos: number;
  torchRadius: number;
  buildRadius: number;
  contactHeat: number;
  coreSpark: SparkParticleRuntimeProfile;
  bounceRestitution: number;
  bounceLifeDecay: number;
  bounceBurstChance: number;
  bounceBurstCount: number;
  bounceBurstCountSpeedScale: number;
  bounceBurstImpactSpeedScale: number;
  bounceBurstSpread: number;
  primarySpark: SparkParticleRuntimeProfile;
  bounceSpark: SparkParticleRuntimeProfile;
  sparkTurbulence: number;
  gravity: number;
  airDrag: number;
  surfaceFriction: number;
  renderStyle: SparksRenderStyle;
  trailFade: number;
  trailContinuity: number;
  bloomStrength: number;
  heatRadius: number;
  rawParticleTextureSize: number;
  simDepth: number;
}

interface SparksRuntime {
  gl: WebGL2RenderingContext;
  particleState: RawGpuParticleState;
  stepPass: RawGpuFieldPass;
  basicPass: RawGpuFieldPass;
  fadePass: RawGpuFieldPass;
  compositePass: RawGpuFieldPass;
  pointRenderer: SparksPointRenderer;
  trailSegmentRenderer: SparksTrailSegmentRenderer;
  coreFlashRenderer: SparksCoreFlashRenderer;
  trail: RawPingPongRenderTarget | null;
  settings: SparksSettings;
  contacts: Map<number, TorchContact>;
  queuedSpawns: SpawnCommand[];
  coreFlashes: CoreFlash[];
  mode: SparksMode;
  cleanup: () => void;
  spawnCursor: number;
  rngState: number;
  trailEnergy: number;
  coreFlashAccumulator: number;
  lastGpuPasses: number;
  emittedSparks: number;
  contactBursts: number;
  buildSurfaces: BuildSurface[];
  buildController: BuildPathController;
  buildSurfaceCursor: number;
  buildSurfaceUniforms: Float32Array;
  buildObstacleProgram: WebGLProgram;
  buildObstacleBuffer: WebGLBuffer | null;
  worldWidth: number;
  worldHeight: number;
}

export interface SparksInputCommand {
  action: 'emit';
  x: number;
  y: number;
  dx: number;
  dy: number;
  strength: number;
  burst: boolean;
  pattern: SparksEmitterPattern;
}

const MARKUP = '<canvas class="h-full w-full touch-none bg-black" data-sparks-canvas></canvas>';
const FULLSCREEN_VERTEX = `#version 300 es
layout(location=0) in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const STEP_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform ivec2 uStateSize;
uniform vec4 uWorldBounds;
uniform float uDt;
uniform float uGravity;
uniform float uDamping;
uniform float uRestitution;
uniform float uBounceLifeDecay;
uniform float uBounceBurstChance;
uniform float uBounceBurstCount;
uniform float uBounceBurstCountSpeedScale;
uniform float uBounceBurstImpactSpeedScale;
uniform float uBounceBurstSpread;
uniform float uSparkPower;
uniform float uBounceSparkSpeedScale;
uniform float uBounceSparkLifespan;
uniform float uBounceSparkLifespanVariability;
uniform float uSurfaceFriction;
uniform float uTime;
uniform float uSpawnActive;
uniform float uSpawnStart;
uniform float uSpawnCount;
uniform vec2 uSpawnPosition;
uniform vec2 uSpawnVelocity;
uniform float uSpawnKind;
uniform float uSpawnSeed;
uniform float uSpawnPaletteSeed;
uniform float uSpawnPower;
uniform float uSpawnPattern;
uniform float uDirectionChaos;
uniform float uLifeScale;
uniform float uLifeVariability;
uniform float uTurbulence;
uniform float uSimDepth;
uniform float uBuildRadius;
uniform int uBuildSurfaceCount;
uniform vec4 uBuildSurfaces[13];

layout(location=0) out vec4 outPosition;
layout(location=1) out vec4 outVelocity;

const float PI = 3.141592653589793;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float signedHash(float n) {
  return hash(n) * 2.0 - 1.0;
}

vec2 direction(float angle) {
  return vec2(cos(angle), sin(angle));
}

vec2 rotateVector(vec2 value, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return vec2(value.x * c - value.y * s, value.x * s + value.y * c);
}

float encodeBounceMarker(vec2 reflectedDirection) {
  float angle = atan(reflectedDirection.y, reflectedDirection.x);
  float angleT = clamp((angle + PI) / (PI * 2.0), 0.0, 1.0);
  return 0.205 + angleT * 0.29;
}

vec2 decodeBounceMarker(float marker) {
  float angleT = clamp((marker - 0.205) / 0.29, 0.0, 1.0);
  return direction(angleT * PI * 2.0 - PI);
}

vec2 reflectWithFriction(vec2 velocity, vec2 normal, float friction) {
  vec2 bounced = reflect(velocity, normal);
  vec2 tangent = vec2(-normal.y, normal.x);
  float tangentSpeed = dot(bounced, tangent) * max(0.0, 1.0 - friction);
  float normalSpeed = max(0.0, dot(bounced, normal));
  return tangent * tangentSpeed + normal * normalSpeed;
}

vec2 withMinimumSpeed(vec2 velocity, vec2 fallbackDirection, float speed) {
  float currentSpeed = length(velocity);
  if (currentSpeed >= speed || speed <= 0.0) return velocity;
  if (currentSpeed <= 0.0001) return normalize(fallbackDirection) * speed;
  return velocity * (speed / currentSpeed);
}

float lifeVariationForSpread(float seed, float variability) {
  float spread = clamp(variability, 0.0, 1.0);
  float centered = signedHash(seed + 613.0) * 0.62;
  float rareLong = step(0.84, hash(seed + 719.0)) * hash(seed + 821.0) * 0.92;
  float rareShort = step(0.88, hash(seed + 929.0)) * hash(seed + 1031.0) * 0.38;
  return max(0.18, 1.0 + (centered + rareLong - rareShort) * spread);
}

float lifeVariation(float seed) {
  return lifeVariationForSpread(seed, uLifeVariability);
}

vec2 turbulenceField(vec2 position, float age, float seed) {
  vec2 p = position * 0.012;
  float phase = uTime * 1.7 + age * 2.3 + seed * 0.0007;
  vec2 field = vec2(
    sin(p.y * 1.31 + phase) + cos((p.x + p.y) * 0.73 - phase * 0.82),
    cos(p.x * 1.17 - phase * 0.91) - sin((p.x - p.y) * 0.61 + phase * 1.13)
  );
  float fieldLength = length(field);
  return fieldLength > 0.0001 ? field / fieldLength : vec2(1.0, 0.0);
}

vec2 bendVelocity(vec2 velocity, vec2 flow, float strength) {
  float speed = length(velocity);
  if (speed <= 0.0001 || strength <= 0.0) return velocity;
  vec2 target = normalize(velocity + flow * speed * mix(0.12, 0.86, strength)) * speed;
  return mix(velocity, target, clamp(strength * uDt * 5.5, 0.0, 0.24));
}

float cross2(vec2 a, vec2 b) {
  return a.x * b.y - a.y * b.x;
}

vec2 closestSegmentParameters(vec2 p1, vec2 q1, vec2 p2, vec2 q2) {
  vec2 d1 = q1 - p1;
  vec2 d2 = q2 - p2;
  vec2 r = p1 - p2;
  float a = dot(d1, d1);
  float e = dot(d2, d2);
  float f = dot(d2, r);
  float s = 0.0;
  float t = 0.0;

  if (a <= 0.0001 && e <= 0.0001) return vec2(0.0);
  if (a <= 0.0001) {
    t = clamp(f / max(0.0001, e), 0.0, 1.0);
    return vec2(0.0, t);
  }

  float c = dot(d1, r);
  if (e <= 0.0001) {
    s = clamp(-c / a, 0.0, 1.0);
    return vec2(s, 0.0);
  }

  float b = dot(d1, d2);
  float denom = a * e - b * b;
  if (abs(denom) > 0.0001) {
    s = clamp((b * f - c * e) / denom, 0.0, 1.0);
  }

  t = (b * s + f) / e;
  if (t < 0.0) {
    t = 0.0;
    s = clamp(-c / a, 0.0, 1.0);
  } else if (t > 1.0) {
    t = 1.0;
    s = clamp((b - c) / a, 0.0, 1.0);
  }

  return vec2(s, t);
}

void main() {
  ivec2 texel = ivec2(gl_FragCoord.xy);
  int index = texel.y * uStateSize.x + texel.x;
  vec4 position = texelFetch(uPosition, texel, 0);
  vec4 velocity = texelFetch(uVelocity, texel, 0);

  float age = position.z;
  float life = position.w;
  float kind = velocity.z;
  float seed = velocity.w;

    if (life > 0.0) {
    float bounceMarker = kind >= 0.5 ? fract(kind) : 0.0;
    float nextBounceMarker = 0.0;
    kind = kind < 0.5 ? kind : floor(kind + 0.01);
    float sourceGeneration = kind;
    vec2 previousPosition = position.xy;
    age += uDt;
    velocity.y += uGravity * uDt;
    velocity.xy *= exp(-uDamping * uDt);
    if (kind >= 0.5 && uTurbulence > 0.0) {
      vec2 flow = turbulenceField(position.xy, age, seed);
      float generationBoost = kind >= 2.0 ? 1.32 : 1.0;
      velocity.xy = bendVelocity(velocity.xy, flow, clamp(uTurbulence * generationBoost, 0.0, 1.0));
    }
    position.xy += velocity.xy * uDt;

    float burstRoll = hash(seed + floor(age * 31.0) * 43.17 + kind * 127.3);
    bool bounced = false;
    vec2 normal = vec2(0.0, -1.0);
    float floorY = uWorldBounds.w - 2.0;

    if (position.x < uWorldBounds.x + 2.0) {
      position.x = uWorldBounds.x + 2.0;
      normal = vec2(1.0, 0.0);
      bounced = true;
    } else if (position.x > uWorldBounds.z - 2.0) {
      position.x = uWorldBounds.z - 2.0;
      normal = vec2(-1.0, 0.0);
      bounced = true;
    } else if (position.y > floorY) {
      position.y = floorY;
      normal = vec2(0.0, -1.0);
      bounced = true;
    }

    for (int surfaceIndex = 0; surfaceIndex < 12; surfaceIndex += 1) {
    if (surfaceIndex >= uBuildSurfaceCount || bounced) continue;
      vec4 surface = uBuildSurfaces[surfaceIndex];
      vec2 start = surface.xy;
      vec2 end = surface.zw;
      vec2 segment = end - start;
      vec2 movement = position.xy - previousPosition;
      float collisionRadius = max(6.0, uBuildRadius + mix(2.0, 7.0, clamp(uSimDepth, 0.0, 1.0)));
      vec2 closest = closestSegmentParameters(previousPosition, position.xy, start, end);
      vec2 sweptPosition = previousPosition + movement * closest.x;
      vec2 surfacePoint = start + segment * closest.y;
      vec2 deltaToSurface = sweptPosition - surfacePoint;
      float distanceToSurface = length(deltaToSurface);
      if (distanceToSurface <= collisionRadius) {
        vec2 segmentNormal = length(segment) > 0.001 ? normalize(vec2(-segment.y, segment.x)) : vec2(0.0, -1.0);
        vec2 collisionNormal = distanceToSurface > 0.001 ? deltaToSurface / distanceToSurface : segmentNormal;
        if (dot(previousPosition - surfacePoint, collisionNormal) < 0.0) collisionNormal *= -1.0;
        if (dot(velocity.xy, collisionNormal) > 0.0) collisionNormal *= -1.0;
        normal = collisionNormal;
        position.xy = surfacePoint + normal * (collisionRadius + 0.75);
        bounced = true;
      }
    }

    if (bounced) {
      float incomingSpeed = length(velocity.xy);
      float restitution = clamp(uRestitution, 0.0, 1.45);
      float restitutionT = smoothstep(0.08, 1.35, restitution);
      velocity.xy = reflectWithFriction(velocity.xy, normal, uSurfaceFriction) * restitution;
      float reboundFloor = incomingSpeed * mix(0.18, 0.98, restitutionT);
      velocity.xy = withMinimumSpeed(velocity.xy, normal, reboundFloor);
      vec2 reflectedDirection = length(velocity.xy) > 0.001 ? normalize(velocity.xy) : normal;
      if (sourceGeneration >= 0.5) {
        float remainingLife = max(0.0, life - age);
        life = min(life, age + remainingLife * max(0.0, 1.0 - clamp(uBounceLifeDecay, 0.0, 1.0)));
      }
      if (sourceGeneration >= 0.5 && sourceGeneration < 1.5 && uBounceBurstCount > 0.0 && burstRoll < uBounceBurstChance) {
        nextBounceMarker = encodeBounceMarker(reflectedDirection);
      }
    }

    if (kind >= 0.5) {
      kind = floor(kind + 0.01) + nextBounceMarker;
    }

    if (age >= life || position.y > uWorldBounds.w + 160.0 || length(velocity.xy) < 3.0 && age > life * 0.82) {
      life = 0.0;
      age = 0.0;
      velocity.xy = vec2(0.0);
    }
  }

  if (uSpawnActive > 0.5) {
    float fIndex = float(index);
    float slot = fIndex - uSpawnStart;
    if (slot >= 0.0 && slot < uSpawnCount) {
      float spawnSeed = uSpawnSeed + slot * 19.37;
      float t = (slot + hash(spawnSeed)) / max(1.0, uSpawnCount);
      float directionChaos = clamp(uDirectionChaos, 0.0, 1.0);
      float angle = -PI * mix(0.04, 0.92, hash(spawnSeed + 3.0));
      angle += signedHash(spawnSeed + 8.0) * mix(0.05, 1.08, directionChaos) * mix(0.36, 1.0, hash(uSpawnSeed + 4.0));
      angle += signedHash(spawnSeed + 15.0) * PI * directionChaos * 0.38;
      vec2 dir = direction(angle);
      vec2 side = direction(hash(spawnSeed + 12.0) * PI * 2.0);
      if (uSpawnPattern > 1.5) {
        float showerSpread = signedHash(spawnSeed + 18.0) * mix(0.01, 0.24, directionChaos);
        dir = normalize(vec2(showerSpread, 1.0));
        side = vec2(signedHash(spawnSeed + 12.0), hash(spawnSeed + 14.0) * 0.18);
      } else if (uSpawnPattern > 0.5) {
        float wheelAngle = t * PI * 8.0 + uTime * 7.5 + hash(uSpawnSeed + 13.0) * PI * 2.0;
        float wheelSign = signedHash(uSpawnSeed + 29.0) < 0.0 ? -1.0 : 1.0;
        vec2 radial = direction(wheelAngle);
        vec2 tangent = vec2(-radial.y, radial.x) * wheelSign;
        dir = normalize(radial * mix(0.22, 0.52, hash(spawnSeed + 16.0)) + tangent * mix(0.86, 1.42, hash(spawnSeed + 19.0)));
        side = radial;
      }
      kind = uSpawnKind;
      seed = uSpawnPaletteSeed * 100000.0 + spawnSeed;
      age = 0.0;
      if (kind < 0.5) {
        life = mix(0.14, 0.32, hash(spawnSeed + 22.0)) * uLifeScale * lifeVariation(spawnSeed + 37.0);
        position.xy = uSpawnPosition + side * mix(0.0, max(8.0, uSpawnPower * 1.35), hash(spawnSeed + 5.0));
        velocity.xy = uSpawnVelocity * 0.018 + side * mix(0.35, 9.0, hash(spawnSeed + 9.0));
      } else {
        float fan = smoothstep(0.0, 1.0, t);
        float speed = uSpawnPower * mix(0.24, 0.92, hash(spawnSeed + 21.0));
        speed *= mix(0.62, 1.32, sin(fan * PI));
        float spawnJitter = uSpawnPattern > 1.5 ? mix(0.0, 7.0, hash(spawnSeed + 31.0)) : mix(0.0, 12.0, hash(spawnSeed + 31.0));
        position.xy = uSpawnPosition + side * spawnJitter;
        vec2 inheritedVelocity = uSpawnPattern > 1.5 ? vec2(0.0) : uSpawnVelocity * mix(0.08, 0.22, hash(spawnSeed + 41.0));
        velocity.xy = inheritedVelocity + dir * speed;
        if (uSpawnPattern <= 1.5) {
          velocity.xy += direction(hash(spawnSeed + 49.0) * PI * 2.0) * uSpawnPower * directionChaos * mix(0.02, 0.34, hash(spawnSeed + 52.0));
          velocity.x += signedHash(spawnSeed + 52.0) * uSpawnPower * mix(0.06, 0.3, directionChaos);
          velocity.y += signedHash(spawnSeed + 61.0) * uSpawnPower * mix(0.02, 0.12, directionChaos);
        }
        life = mix(0.85, 2.15, hash(spawnSeed + 71.0)) * uLifeScale * lifeVariation(spawnSeed + 73.0);
        if (kind >= 2.0) {
          life *= 0.86;
          velocity.xy *= mix(1.18, 1.82, hash(spawnSeed + 81.0));
        }
      }
    }
  }

  if (uBounceBurstChance > 0.0 && uBounceBurstCount > 0.0) {
    bool bounceSpawned = false;
    int capacity = uStateSize.x * uStateSize.y;
    int burstStride = 4099;
    float baseMaxAttempts = clamp(uBounceBurstCount, 0.0, 48.0);
    for (int attempt = 0; attempt < 48; attempt += 1) {
      if (bounceSpawned || (uBounceBurstCountSpeedScale <= 0.0 && float(attempt) >= baseMaxAttempts)) continue;
      int parentIndex = int(mod(float(index) - float(burstStride * (attempt + 1)), float(capacity)));
      ivec2 parentTexel = ivec2(parentIndex % uStateSize.x, parentIndex / uStateSize.x);
      vec4 parentPosition = texelFetch(uPosition, parentTexel, 0);
      vec4 parentVelocity = texelFetch(uVelocity, parentTexel, 0);
      float parentGeneration = floor(parentVelocity.z + 0.01);
      float marker = fract(parentVelocity.z);
      if (parentPosition.w > 0.0 && parentGeneration >= 1.0 && parentGeneration < 1.5 && marker > 0.2 && marker < 0.5) {
        float parentSpeed = length(parentVelocity.xy);
        float impactT = smoothstep(0.0, max(1.0, uSparkPower * 1.35), parentSpeed);
        float effectiveMaxAttempts = clamp(baseMaxAttempts * (1.0 + impactT * max(0.0, uBounceBurstCountSpeedScale)), 0.0, 48.0);
        if (float(attempt) >= effectiveMaxAttempts) continue;
        float childOrdinal = float(attempt);
        float probeSeed = parentVelocity.w + float(parentIndex) * 17.31 + childOrdinal * 283.13 + uTime * 23.7;
        vec2 parentDir = decodeBounceMarker(marker);
        float spread = clamp(uBounceBurstSpread, 0.0, 3.0);
        float fanHalfAngle = mix(PI * 0.04, PI * 0.5, smoothstep(0.0, 1.0, spread));
        float fanAngle = signedHash(probeSeed + 29.0) * fanHalfAngle;
        vec2 burstDir = normalize(rotateVector(parentDir, fanAngle));
        float speedScale = max(0.0, uBounceSparkSpeedScale) * (1.0 + impactT * max(0.0, uBounceBurstImpactSpeedScale));
        float inheritedSpeed = parentSpeed * speedScale * mix(0.34, 1.18, hash(probeSeed + 37.0));
        float burstSpeed = max(0.0, uSparkPower) * speedScale * mix(0.18, 1.08, hash(probeSeed + 41.0));
        velocity.xy = burstDir * (inheritedSpeed + burstSpeed) + parentVelocity.xy * mix(0.02, 0.18, hash(probeSeed + 43.0));
        position.xy = parentPosition.xy + burstDir * mix(5.0, 24.0, hash(probeSeed + 47.0));
        age = 0.0;
        life = mix(0.85, 2.15, hash(probeSeed + 53.0)) * max(0.0, uBounceSparkLifespan) * lifeVariationForSpread(probeSeed + 59.0, uBounceSparkLifespanVariability);
        kind = parentGeneration + 1.0;
        seed = probeSeed + parentVelocity.w * 0.017 + parentGeneration * 71.0;
        bounceSpawned = true;
      }
    }
  }

  outPosition = vec4(position.xy, age, life);
  outVelocity = vec4(velocity.xy, kind, seed);
}`;

const FADE_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uTrail;
uniform float uFade;
uniform vec3 uBackground;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uTrail, 0));
  vec4 trail = texture(uTrail, uv) * uFade;
  outColor = vec4(max(trail.rgb, uBackground * trail.a * 0.012), trail.a * uFade);
}`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uTrail;
uniform vec3 uBackground;
uniform float uBloom;
uniform float uSkyLift;
uniform float uHeatTint;
uniform float uTime;
uniform int uBuildSurfaceCount;
uniform vec4 uBuildSurfaces[13];
uniform float uBuildPreviewCount;
out vec4 outColor;

vec3 backgroundBase(vec2 uv) {
  float vignette = 0.68 + 0.32 * smoothstep(0.92, 0.08, length(uv - 0.5));
  float verticalLift = smoothstep(1.0, 0.12, uv.y) * 0.018;
  float heatPulse = sin(uTime * 1.35 + uv.x * 8.0) * 0.5 + 0.5;
  vec3 heat = vec3(0.08, 0.025, 0.006) * uHeatTint * heatPulse * smoothstep(1.0, 0.54, uv.y);
  return uBackground * vignette + vec3(uSkyLift + verticalLift) + heat;
}

float buildSurfaceMask(vec2 pixel) {
  float mask = 0.0;
  for (int index = 0; index < 13; index += 1) {
    if (index >= uBuildSurfaceCount) continue;
    vec4 surface = uBuildSurfaces[index];
    vec2 start = surface.xy;
    vec2 end = surface.zw;
    vec2 segment = end - start;
    float t = clamp(dot(pixel - start, segment) / max(1.0, dot(segment, segment)), 0.0, 1.0);
    float distanceToSurface = length(pixel - (start + segment * t));
    mask = max(mask, smoothstep(13.0, 0.0, distanceToSurface));
  }
  return mask;
}

float buildPreviewMask(vec2 pixel) {
  float mask = 0.0;
  for (int index = 12; index < 13; index += 1) {
    if (float(index - 12) >= uBuildPreviewCount) continue;
    vec4 surface = uBuildSurfaces[index];
    vec2 start = surface.xy;
    vec2 end = surface.zw;
    vec2 segment = end - start;
    float t = clamp(dot(pixel - start, segment) / max(1.0, dot(segment, segment)), 0.0, 1.0);
    float distanceToSurface = length(pixel - (start + segment * t));
    mask = max(mask, smoothstep(15.0, 0.0, distanceToSurface));
  }
  return mask;
}

void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uTrail, 0));
  vec4 trail = texture(uTrail, uv);
  vec2 topLeftPixel = vec2(gl_FragCoord.x, float(textureSize(uTrail, 0).y) - gl_FragCoord.y);
  float rail = buildSurfaceMask(topLeftPixel);
  float previewRail = buildPreviewMask(topLeftPixel);
  vec3 base = backgroundBase(uv);
  base += ${BUILD_OBSTACLE_MESH_COLOR_GLSL} * rail;
  base += ${BUILD_OBSTACLE_PREVIEW_COLOR_GLSL} * previewRail;
  vec3 color = base + trail.rgb * uBloom;
  outColor = vec4(color, 1.0);
}`;

const BASIC_FRAGMENT = `#version 300 es
precision highp float;
uniform vec3 uBackground;
uniform vec2 uCanvasSize;
uniform float uRenderTier;
uniform float uTime;
uniform int uBuildSurfaceCount;
uniform vec4 uBuildSurfaces[13];
uniform float uBuildPreviewCount;
out vec4 outColor;

vec3 directBackground(vec2 uv, float tier) {
  if (tier <= 0.001) return uBackground;
  float vignette = 0.72 + 0.28 * smoothstep(0.92, 0.08, length(uv - 0.5));
  float verticalLift = smoothstep(1.0, 0.12, uv.y) * 0.015;
  float heatPulse = sin(uTime * 1.15 + uv.x * 7.0) * 0.5 + 0.5;
  vec3 heat = vec3(0.04, 0.014, 0.004) * heatPulse * smoothstep(1.0, 0.58, uv.y);
  return uBackground * vignette + vec3(0.014 + verticalLift) + heat;
}

float buildSurfaceMask(vec2 pixel) {
  float mask = 0.0;
  for (int index = 0; index < 13; index += 1) {
    if (index >= uBuildSurfaceCount) continue;
    vec4 surface = uBuildSurfaces[index];
    vec2 start = surface.xy;
    vec2 end = surface.zw;
    vec2 segment = end - start;
    float t = clamp(dot(pixel - start, segment) / max(1.0, dot(segment, segment)), 0.0, 1.0);
    float distanceToSurface = length(pixel - (start + segment * t));
    mask = max(mask, smoothstep(13.0, 0.0, distanceToSurface));
  }
  return mask;
}

float buildPreviewMask(vec2 pixel) {
  float mask = 0.0;
  for (int index = 12; index < 13; index += 1) {
    if (float(index - 12) >= uBuildPreviewCount) continue;
    vec4 surface = uBuildSurfaces[index];
    vec2 start = surface.xy;
    vec2 end = surface.zw;
    vec2 segment = end - start;
    float t = clamp(dot(pixel - start, segment) / max(1.0, dot(segment, segment)), 0.0, 1.0);
    float distanceToSurface = length(pixel - (start + segment * t));
    mask = max(mask, smoothstep(15.0, 0.0, distanceToSurface));
  }
  return mask;
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(uCanvasSize, vec2(1.0));
  vec2 topLeftPixel = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
  float rail = buildSurfaceMask(topLeftPixel);
  float previewRail = buildPreviewMask(topLeftPixel);
  float tier = clamp(uRenderTier, 0.0, 1.0);
  vec3 base = directBackground(uv, tier);
  outColor = vec4(base + ${BUILD_OBSTACLE_MESH_COLOR_GLSL} * rail + ${BUILD_OBSTACLE_PREVIEW_COLOR_GLSL} * previewRail, 1.0);
}`;

const BUILD_OBSTACLE_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
uniform vec2 uResolution;
void main() {
  vec2 clip = aPosition / max(uResolution, vec2(1.0)) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const BUILD_OBSTACLE_FRAGMENT = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  outColor = uColor;
}`;

const POINT_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform ivec2 uStateSize;
uniform vec4 uWorldBounds;
uniform vec2 uCanvasSize;
uniform float uPrimarySparkSize;
uniform float uPrimarySparkLength;
uniform float uPrimarySparkLengthVariability;
uniform float uPrimarySparkSizeVariability;
uniform float uBounceSparkSize;
uniform float uBounceSparkLength;
uniform float uBounceSparkLengthVariability;
uniform float uBounceSparkSizeVariability;
uniform float uRenderTier;
uniform float uSimDepth;
uniform float uCoreFlashSize;
uniform float uCoreFlashVariability;
uniform float uCoreAfterglow;

${SPARK_SIZE_VARIABILITY_GLSL}

out float vAlpha;
out float vKind;
out float vLifeT;
out float vSeed;
out float vSpeed;
out float vTrailStretch;
out vec2 vDir;

void main() {
  int index = gl_VertexID;
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  vec4 position = texelFetch(uPosition, texel, 0);
  vec4 velocity = texelFetch(uVelocity, texel, 0);
  float life = position.w;
  float age = position.z;
  float generation = velocity.z < 0.5 ? velocity.z : floor(velocity.z + 0.01);
  float lifeT = life > 0.0 ? clamp(age / life, 0.0, 1.0) : 1.0;
  float fade = 0.0;
  if (life > 0.0) {
    if (generation < 0.5) {
      float flashSeed = fract(sin(velocity.w + 113.0) * 43758.5453123);
      float ignition = smoothstep(0.0, mix(0.018, 0.075, flashSeed), lifeT);
      float flashDecay = pow(max(0.0, 1.0 - lifeT), mix(5.8, 2.35, clamp(uCoreAfterglow, 0.0, 1.0)));
      fade = ignition * flashDecay;
    } else {
      fade = pow(1.0 - lifeT, 1.22);
    }
  }
  vec2 worldSize = max(uWorldBounds.zw - uWorldBounds.xy, vec2(1.0));
  vec2 normalized = (position.xy - uWorldBounds.xy) / worldSize;
  float pxScale = min(uCanvasSize.x / worldSize.x, uCanvasSize.y / worldSize.y);
  float coreBurstSeed = fract(sin(velocity.w + 33.0) * 43758.5453123);
  float sparkBurstSeed = fract(sin(velocity.w + 71.0) * 43758.5453123);
  float coreVariance = mix(1.0, mix(0.48, 1.86, fract(sin(velocity.w + 133.0) * 43758.5453123)), clamp(uCoreFlashVariability, 0.0, 1.0));
  float coreBurst = mix(7.0, 22.0, coreBurstSeed) * max(0.01, uCoreFlashSize) * coreVariance;
  coreBurst *= mix(1.12, 0.14, smoothstep(0.04, 0.88, lifeT));
  float primarySpark = mix(10.0, 30.0, sparkBurstSeed) * mix(1.0, 0.84, smoothstep(0.1, 0.9, lifeT));
  float bounceSpark = mix(7.0, 18.0, sparkBurstSeed) * mix(1.0, 0.78, smoothstep(0.1, 0.88, lifeT));
  float depthScale = mix(1.0, mix(0.72, 1.24, sparkBurstSeed), uSimDepth);
  primarySpark *= depthScale;
  bounceSpark *= depthScale;
  bool bounceProfile = generation >= 2.0;
  float profileSize = bounceProfile ? uBounceSparkSize : uPrimarySparkSize;
  float profileLength = bounceProfile ? uBounceSparkLength : uPrimarySparkLength;
  float profileLengthVariability = bounceProfile ? uBounceSparkLengthVariability : uPrimarySparkLengthVariability;
  float profileVariability = bounceProfile ? uBounceSparkSizeVariability : uPrimarySparkSizeVariability;
  float sparkSize = bounceProfile ? bounceSpark : primarySpark;
  float generationSize = generation < 0.5 ? coreBurst : sparkSize;
  float seededSize = sparkSizeVariation(velocity.w + generation * 41.0, profileVariability);
  generationSize *= generation < 0.5 ? mix(1.0, seededSize, 0.38) : seededSize;
  float lengthSeed = sparkSizeVariation(velocity.w + generation * 59.0 + 701.0, profileLengthVariability);
  float lengthControl = clamp(profileLength * lengthSeed, 0.0, 12.0);
  float speedStretch = generation < 0.5 ? 1.0 : 1.0 + clamp(length(velocity.xy) / 980.0, 0.0, 1.0) * mix(0.82, 2.35, uRenderTier) * mix(0.62, 1.18, profileVariability) * lengthControl;
  float pointScale = generation < 0.5
    ? mix(0.72, 2.45, smoothstep(0.02, 2.4, clamp(uCoreFlashSize, 0.02, 2.4)))
    : profileSize;
  vAlpha = fade;
  vKind = generation;
  vLifeT = lifeT;
  vSeed = velocity.w;
  vSpeed = length(velocity.xy);
  vTrailStretch = speedStretch;
  vDir = vSpeed > 0.001 ? normalize(velocity.xy) : vec2(1.0, 0.0);
  gl_Position = fade > 0.0 ? vec4(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0, 0.0, 1.0) : vec4(2.0, 2.0, 0.0, 1.0);
  float pointLimit = generation < 0.5 ? 180.0 : (generation < 1.5 ? 118.0 : 58.0);
  gl_PointSize = min(pointLimit, max(1.0, pointScale * generationSize * speedStretch * pxScale * mix(1.0, 1.85, uRenderTier)));
}`;

const POINT_FRAGMENT = `#version 300 es
precision highp float;

uniform vec3 uPalette[8];
uniform int uPaletteCount;
uniform float uCoreIntensity;
uniform float uCoreFlashSize;
uniform float uGlowBias;
uniform float uCoreAlpha;
uniform float uTime;

in float vAlpha;
in float vKind;
in float vLifeT;
in float vSeed;
in float vSpeed;
in float vTrailStretch;
in vec2 vDir;
out vec4 outColor;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float particleSeed(float packed) {
  return mod(packed, 100000.0);
}

float paletteSeed(float packed) {
  return floor(packed / 100000.0);
}

vec3 paletteColor(float seed, float offset) {
  int count = min(uPaletteCount, 8);
  if (count <= 0) return vec3(1.0);
  int primary = int(floor(hash(paletteSeed(seed) + offset) * float(count))) % count;
  int accent = int(floor(hash(paletteSeed(seed) + offset + 19.0) * float(count))) % count;
  return mix(uPalette[primary], uPalette[accent], smoothstep(0.08, 0.92, hash(particleSeed(seed) + offset)));
}

vec3 paletteSparkColor(float seed, float offset) {
  int count = min(uPaletteCount, 8);
  if (count <= 1) return paletteColor(seed, offset);
  int selectable = count - 1;
  int primary = 1 + (int(floor(hash(paletteSeed(seed) + offset) * float(selectable))) % selectable);
  int accent = 1 + (int(floor(hash(paletteSeed(seed) + offset + 29.0) * float(selectable))) % selectable);
  return mix(uPalette[primary], uPalette[accent], smoothstep(0.06, 0.9, hash(particleSeed(seed) + offset)));
}

void main() {
  if (vAlpha <= 0.0) discard;
  vec2 centered = gl_PointCoord * 2.0 - 1.0;
  float radius2 = dot(centered, centered);
  if (radius2 > 1.0) discard;
  float core = smoothstep(1.0, 0.015, radius2);
  float halo = smoothstep(1.0, 0.34, radius2) * 0.46;
  if (vKind >= 0.5) {
    vec2 axis = normalize(vDir);
    vec2 tangent = vec2(-axis.y, axis.x);
    float along = dot(centered, axis);
    float across = dot(centered, tangent);
    float speedT = clamp(vSpeed / 760.0, 0.0, 1.0);
    float halfWidth = mix(0.22, 0.11, speedT) / sqrt(max(1.0, vTrailStretch));
    float hotHead = smoothstep(-0.18, 0.82, along);
    float tail = smoothstep(1.0, 0.52, abs(along)) * mix(0.72, 1.0, hotHead);
    float lineCore = tail * smoothstep(halfWidth, 0.018, abs(across));
    float lineHalo = smoothstep(1.0, 0.48, abs(along)) * smoothstep(halfWidth * 3.4, halfWidth * 0.82, abs(across)) * mix(0.28, 0.46, speedT);
    if (lineCore + lineHalo <= 0.001) discard;
    core = lineCore;
    halo = lineHalo;
  }
  vec3 hot = vec3(1.0, 0.985, 0.9) * uCoreIntensity;
  vec3 cooling = vKind < 0.5
    ? paletteColor(vSeed, vKind * 17.0 + floor(uTime * 0.7))
    : paletteSparkColor(vSeed, vKind * 23.0 + floor(uTime * 0.45));
  vec3 sparkHeat = mix(vec3(1.0, 0.86, 0.5) * min(uCoreIntensity, 2.4), cooling, 0.62);
  vec3 color = vKind < 0.5
    ? mix(hot * 2.35, cooling, 0.025)
    : mix(sparkHeat, cooling, smoothstep(0.0, 0.24, vLifeT));
  if (vKind >= 2.0) color = mix(color, paletteSparkColor(vSeed, 83.0 + floor(uTime * 0.3)), 0.38);
  float sparkle = step(0.82, hash(particleSeed(vSeed) + floor(uTime * (24.0 + vKind * 5.0))));
  color += vec3(sparkle) * (1.0 - vLifeT) * (vKind < 0.5 ? 0.45 : 0.16);
  float alpha = vAlpha * (core + halo) * uGlowBias;
  if (vKind < 0.5) {
    float coreSizeT = clamp(uCoreFlashSize / 2.4, 0.0, 1.0);
    float coreIntensityT = clamp(uCoreIntensity / 8.0, 0.0, 1.0);
    alpha *= uCoreAlpha * mix(1.35, 2.95, coreIntensityT) * mix(0.85, 1.55, coreSizeT);
  }
  outColor = vec4(color * alpha, alpha);
}`;

class SparksPointRenderer {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly palette = new Float32Array(8 * 3);

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = linkRawWebGL2Program(gl, { vertex: POINT_VERTEX, fragment: POINT_FRAGMENT });
    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(this.program);
      throw new Error('Unable to allocate sparks point renderer');
    }
    this.vao = vao;
  }

  render(options: {
    particleState: RawGpuParticleState;
    target: WebGLFramebuffer | null;
    width: number;
    height: number;
    worldBounds: [number, number, number, number];
    primarySpark: SparkParticleRuntimeProfile;
    bounceSpark: SparkParticleRuntimeProfile;
    renderTier: number;
    coreFlashSize: number;
    coreFlashVariability: number;
    coreIntensity: number;
    coreAfterglow: number;
    glowBias: number;
    coreAlpha: number;
    simDepth: number;
    time: number;
    palette: readonly number[];
  }): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, options.target);
    gl.viewport(0, 0, options.width, options.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, options.particleState.positions.read.texture.texture);
    gl.uniform1i(this.uniform('uPosition'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, options.particleState.velocities.read.texture.texture);
    gl.uniform1i(this.uniform('uVelocity'), 1);
    gl.uniform2i(this.uniform('uStateSize'), options.particleState.width, options.particleState.height);
    gl.uniform4f(this.uniform('uWorldBounds'), options.worldBounds[0], options.worldBounds[1], options.worldBounds[2], options.worldBounds[3]);
    gl.uniform2f(this.uniform('uCanvasSize'), options.width, options.height);
    gl.uniform1f(this.uniform('uPrimarySparkSize'), options.primarySpark.size);
    gl.uniform1f(this.uniform('uPrimarySparkLength'), options.primarySpark.length);
    gl.uniform1f(this.uniform('uPrimarySparkLengthVariability'), options.primarySpark.lengthVariability);
    gl.uniform1f(this.uniform('uPrimarySparkSizeVariability'), options.primarySpark.sizeVariability);
    gl.uniform1f(this.uniform('uBounceSparkSize'), options.bounceSpark.size);
    gl.uniform1f(this.uniform('uBounceSparkLength'), options.bounceSpark.length);
    gl.uniform1f(this.uniform('uBounceSparkLengthVariability'), options.bounceSpark.lengthVariability);
    gl.uniform1f(this.uniform('uBounceSparkSizeVariability'), options.bounceSpark.sizeVariability);
    gl.uniform1f(this.uniform('uRenderTier'), options.renderTier);
    gl.uniform1f(this.uniform('uSimDepth'), options.simDepth);
    gl.uniform1f(this.uniform('uCoreFlashSize'), options.coreFlashSize);
    gl.uniform1f(this.uniform('uCoreFlashVariability'), options.coreFlashVariability);
    gl.uniform1f(this.uniform('uCoreAfterglow'), options.coreAfterglow);
    gl.uniform1f(this.uniform('uCoreIntensity'), options.coreIntensity);
    gl.uniform1f(this.uniform('uGlowBias'), options.glowBias);
    gl.uniform1f(this.uniform('uCoreAlpha'), options.coreAlpha);
    gl.uniform1f(this.uniform('uTime'), options.time);
    const paletteCount = writePalette(this.palette, options.palette);
    gl.uniform3fv(this.uniform('uPalette[0]'), this.palette);
    gl.uniform1i(this.uniform('uPaletteCount'), paletteCount);
    gl.drawArrays(gl.POINTS, 0, options.particleState.capacity);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  destroy(): void {
    this.uniforms.clear();
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }

  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniforms.get(name) ?? null;
  }
}

const TRAIL_SEGMENT_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform ivec2 uStateSize;
uniform vec2 uCanvasSize;
uniform float uPrimarySparkSize;
uniform float uPrimarySparkLength;
uniform float uPrimarySparkLengthVariability;
uniform float uPrimarySparkSizeVariability;
uniform float uBounceSparkSize;
uniform float uBounceSparkLength;
uniform float uBounceSparkLengthVariability;
uniform float uBounceSparkSizeVariability;
uniform float uTrailContinuity;
uniform float uRenderTier;
uniform float uSimDepth;
uniform float uTime;

${SPARK_SIZE_VARIABILITY_GLSL}

out vec2 vLocal;
out float vAlpha;
out float vLifeT;
out float vKind;
out float vSeed;
out float vSpeedT;

float hashTrail(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  int vertex = gl_VertexID;
  int particleIndex = vertex / 6;
  int corner = vertex - particleIndex * 6;
  ivec2 texel = ivec2(particleIndex % uStateSize.x, particleIndex / uStateSize.x);
  vec4 position = texelFetch(uPosition, texel, 0);
  vec4 velocity = texelFetch(uVelocity, texel, 0);
  float life = position.w;
  float age = position.z;
  float kind = velocity.z;
  float generation = kind < 0.5 ? kind : floor(kind + 0.01);
  float lifeT = life > 0.0 ? clamp(age / life, 0.0, 1.0) : 1.0;
  float speed = length(velocity.xy);
  float continuity = max(0.0, uTrailContinuity);
  if (life <= 0.0 || kind < 0.5 || speed < 4.0 || continuity <= 0.001) {
    vAlpha = 0.0;
    vLocal = vec2(0.0);
    vLifeT = lifeT;
    vKind = generation;
    vSeed = velocity.w;
    vSpeedT = 0.0;
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    return;
  }

  bool head = corner == 1 || corner == 4 || corner == 5;
  bool left = corner == 0 || corner == 1 || corner == 4;
  float along = head ? 1.0 : 0.0;
  float side = left ? -1.0 : 1.0;
  vec2 axis = velocity.xy / max(speed, 0.0001);
  vec2 normal = vec2(-axis.y, axis.x);
  float speedT = clamp(speed / 1400.0, 0.0, 1.0);
  float continuityT = clamp(continuity, 0.0, 2.0);
  bool bounceProfile = generation >= 2.0;
  float profileSize = bounceProfile ? uBounceSparkSize : uPrimarySparkSize;
  float profileLength = bounceProfile ? uBounceSparkLength : uPrimarySparkLength;
  float profileLengthVariability = bounceProfile ? uBounceSparkLengthVariability : uPrimarySparkLengthVariability;
  float profileVariability = bounceProfile ? uBounceSparkSizeVariability : uPrimarySparkSizeVariability;
  float lengthSeed = sparkSizeVariation(velocity.w + generation * 59.0 + 701.0, profileLengthVariability);
  float lengthControl = clamp(profileLength * lengthSeed, 0.0, 12.0);
  float seedSize = sparkSizeVariation(velocity.w + generation * 41.0, profileVariability);
  float trailSeconds = mix(0.0, 0.048, min(1.0, continuityT)) * mix(1.0, 1.72, max(0.0, continuityT - 1.0)) * lengthControl;
  float maxTrail = mix(0.0, 168.0, continuityT * 0.5) * mix(0.86, 1.32, uRenderTier) * max(0.0, lengthControl);
  float trailLength = clamp(speed * trailSeconds, 0.0, maxTrail);
  if (trailLength <= 0.001) {
    vAlpha = 0.0;
    vLocal = vec2(0.0);
    vLifeT = lifeT;
    vKind = generation;
    vSeed = velocity.w;
    vSpeedT = speedT;
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    return;
  }
  float depthSeed = hashTrail(velocity.w + 71.0);
  float depthScale = mix(1.0, mix(0.76, 1.22, depthSeed), uSimDepth);
  float width = max(0.55, profileSize * mix(0.34, 0.74, uRenderTier) * seedSize * depthScale);
  vec2 tail = position.xy - axis * trailLength;
  vec2 headPosition = position.xy + axis * min(width * 0.75, trailLength * 0.12);
  vec2 world = mix(tail, headPosition, along) + normal * side * width;
  vec2 normalized = world / max(uCanvasSize, vec2(1.0));
  float lifeFade = pow(max(0.0, 1.0 - lifeT), 1.15);
  float youngGate = smoothstep(0.0, 0.035, lifeT);
  vAlpha = youngGate * lifeFade * mix(0.22, 0.74, speedT) * mix(0.72, 1.24, min(1.0, continuityT));
  vLocal = vec2(along, side);
  vLifeT = lifeT;
  vKind = generation;
  vSeed = velocity.w;
  vSpeedT = speedT;
  gl_Position = vec4(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0, 0.0, 1.0);
}`;

const TRAIL_SEGMENT_FRAGMENT = `#version 300 es
precision highp float;

uniform vec3 uPalette[8];
uniform int uPaletteCount;
uniform float uGlowBias;
uniform float uCoreIntensity;
uniform float uTime;

in vec2 vLocal;
in float vAlpha;
in float vLifeT;
in float vKind;
in float vSeed;
in float vSpeedT;
out vec4 outColor;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float particleSeed(float packed) {
  return mod(packed, 100000.0);
}

float paletteSeed(float packed) {
  return floor(packed / 100000.0);
}

vec3 paletteSparkColor(float seed, float offset) {
  int count = min(uPaletteCount, 8);
  if (count <= 0) return vec3(1.0, 0.82, 0.38);
  int selectable = max(1, count - 1);
  int primary = count <= 1 ? 0 : 1 + (int(floor(hash(paletteSeed(seed) + offset) * float(selectable))) % selectable);
  int accent = count <= 1 ? 0 : 1 + (int(floor(hash(paletteSeed(seed) + offset + 29.0) * float(selectable))) % selectable);
  return mix(uPalette[primary], uPalette[accent], smoothstep(0.06, 0.9, hash(particleSeed(seed) + offset)));
}

void main() {
  if (vAlpha <= 0.0) discard;
  float across = abs(vLocal.y);
  float widthMask = smoothstep(1.0, 0.18, across);
  float tailGate = smoothstep(0.0, 0.1, vLocal.x);
  float hotHead = smoothstep(0.28, 1.0, vLocal.x);
  float alpha = vAlpha * widthMask * tailGate * mix(0.42, 1.0, hotHead) * uGlowBias;
  if (alpha <= 0.001) discard;
  vec3 palette = paletteSparkColor(vSeed, vKind * 23.0 + floor(uTime * 0.45));
  vec3 hot = vec3(1.0, 0.9, 0.55) * min(uCoreIntensity, 2.6);
  vec3 color = mix(palette, hot, mix(0.24, 0.72, hotHead) * (1.0 - smoothstep(0.45, 1.0, vLifeT)));
  if (vKind >= 2.0) color = mix(color, paletteSparkColor(vSeed, 83.0 + floor(uTime * 0.3)), 0.32);
  color += vec3(1.0, 0.9, 0.42) * widthMask * hotHead * vSpeedT * 0.36;
  outColor = vec4(color * alpha, alpha);
}`;

class SparksTrailSegmentRenderer {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly palette = new Float32Array(8 * 3);

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = linkRawWebGL2Program(gl, { vertex: TRAIL_SEGMENT_VERTEX, fragment: TRAIL_SEGMENT_FRAGMENT });
    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(this.program);
      throw new Error('Unable to allocate sparks trail segment renderer');
    }
    this.vao = vao;
  }

  render(options: {
    particleState: RawGpuParticleState;
    target: WebGLFramebuffer | null;
    width: number;
    height: number;
    primarySpark: SparkParticleRuntimeProfile;
    bounceSpark: SparkParticleRuntimeProfile;
    trailContinuity: number;
    renderTier: number;
    simDepth: number;
    coreIntensity: number;
    glowBias: number;
    time: number;
    palette: readonly number[];
  }): void {
    if (options.trailContinuity <= 0) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, options.target);
    gl.viewport(0, 0, options.width, options.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, options.particleState.positions.read.texture.texture);
    gl.uniform1i(this.uniform('uPosition'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, options.particleState.velocities.read.texture.texture);
    gl.uniform1i(this.uniform('uVelocity'), 1);
    gl.uniform2i(this.uniform('uStateSize'), options.particleState.width, options.particleState.height);
    gl.uniform2f(this.uniform('uCanvasSize'), options.width, options.height);
    gl.uniform1f(this.uniform('uPrimarySparkSize'), options.primarySpark.size);
    gl.uniform1f(this.uniform('uPrimarySparkLength'), options.primarySpark.length);
    gl.uniform1f(this.uniform('uPrimarySparkLengthVariability'), options.primarySpark.lengthVariability);
    gl.uniform1f(this.uniform('uPrimarySparkSizeVariability'), options.primarySpark.sizeVariability);
    gl.uniform1f(this.uniform('uBounceSparkSize'), options.bounceSpark.size);
    gl.uniform1f(this.uniform('uBounceSparkLength'), options.bounceSpark.length);
    gl.uniform1f(this.uniform('uBounceSparkLengthVariability'), options.bounceSpark.lengthVariability);
    gl.uniform1f(this.uniform('uBounceSparkSizeVariability'), options.bounceSpark.sizeVariability);
    gl.uniform1f(this.uniform('uTrailContinuity'), options.trailContinuity);
    gl.uniform1f(this.uniform('uRenderTier'), options.renderTier);
    gl.uniform1f(this.uniform('uSimDepth'), options.simDepth);
    gl.uniform1f(this.uniform('uGlowBias'), options.glowBias);
    gl.uniform1f(this.uniform('uCoreIntensity'), options.coreIntensity);
    gl.uniform1f(this.uniform('uTime'), options.time);
    const paletteCount = writePalette(this.palette, options.palette);
    gl.uniform3fv(this.uniform('uPalette[0]'), this.palette);
    gl.uniform1i(this.uniform('uPaletteCount'), paletteCount);
    gl.drawArrays(gl.TRIANGLES, 0, options.particleState.capacity * 6);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  destroy(): void {
    this.uniforms.clear();
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }

  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniforms.get(name) ?? null;
  }
}

const CORE_FLASH_VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aAgeLife;
layout(location = 2) in vec2 aSizeIntensity;
layout(location = 3) in float aSeed;

uniform vec2 uCanvasSize;
uniform float uCoreFlashSize;
uniform float uCoreIntensity;
uniform float uCoreAfterglow;
uniform float uRenderTier;
uniform float uGlowBias;
uniform float uTime;

out float vAlpha;
out float vIntensity;
out float vSeed;

void main() {
  vec2 normalized = aPosition / max(uCanvasSize, vec2(1.0));
  float lifeT = clamp(aAgeLife.x / max(0.0001, aAgeLife.y), 0.0, 1.0);
  float ignition = smoothstep(0.0, mix(0.018, 0.052, fract(sin(aSeed + 4.0) * 43758.5453123)), lifeT);
  float decay = pow(max(0.0, 1.0 - lifeT), mix(6.8, 2.15, clamp(uCoreAfterglow, 0.0, 1.0)));
  float pulse = 1.0 + sin((uTime + aSeed) * mix(42.0, 92.0, fract(sin(aSeed + 11.0) * 43758.5453123))) * 0.08 * (1.0 - lifeT);
  float sizeControl = mix(0.42, 2.55, smoothstep(0.02, 2.4, clamp(uCoreFlashSize, 0.02, 2.4)));
  float intensityControl = mix(0.22, 2.75, smoothstep(0.15, 8.0, clamp(uCoreIntensity, 0.15, 8.0)));
  vAlpha = ignition * decay * aSizeIntensity.y * intensityControl * uGlowBias;
  vIntensity = intensityControl;
  vSeed = aSeed;
  gl_Position = vec4(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0, 0.0, 1.0);
  gl_PointSize = min(360.0, max(2.0, aSizeIntensity.x * sizeControl * mix(0.92, 1.35, uRenderTier) * pulse));
}`;

const CORE_FLASH_FRAGMENT = `#version 300 es
precision highp float;

in float vAlpha;
in float vIntensity;
in float vSeed;
out vec4 outColor;

void main() {
  vec2 centered = gl_PointCoord * 2.0 - 1.0;
  float radius2 = dot(centered, centered);
  if (radius2 > 1.0) discard;
  float whiteCore = smoothstep(0.22, 0.0, radius2);
  float hotHalo = smoothstep(1.0, 0.08, radius2) * 0.55;
  float outerGlow = smoothstep(1.0, 0.46, radius2) * 0.18;
  float flicker = 0.92 + fract(sin(vSeed * 13.71) * 43758.5453123) * 0.16;
  float alpha = vAlpha * (whiteCore * 1.8 + hotHalo + outerGlow) * flicker;
  vec3 white = vec3(1.0, 0.985, 0.91) * (1.6 + vIntensity * 1.2);
  vec3 amber = vec3(1.0, 0.48, 0.12) * 0.55;
  vec3 color = mix(amber, white, smoothstep(0.92, 0.0, radius2));
  outColor = vec4(color * alpha, alpha);
}`;

class SparksCoreFlashRenderer {
  private static readonly strideFloats = 7;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly buffer: WebGLBuffer;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private upload = new Float32Array(0);

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = linkRawWebGL2Program(gl, { vertex: CORE_FLASH_VERTEX, fragment: CORE_FLASH_FRAGMENT });
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) {
      if (vao) gl.deleteVertexArray(vao);
      if (buffer) gl.deleteBuffer(buffer);
      gl.deleteProgram(this.program);
      throw new Error('Unable to allocate sparks core flash renderer');
    }
    this.vao = vao;
    this.buffer = buffer;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const stride = SparksCoreFlashRenderer.strideFloats * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 2 * 4);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 4 * 4);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 6 * 4);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  render(options: {
    flashes: readonly CoreFlash[];
    target: WebGLFramebuffer | null;
    width: number;
    height: number;
    renderTier: number;
    coreFlashSize: number;
    coreIntensity: number;
    coreAfterglow: number;
    glowBias: number;
    time: number;
  }): void {
    if (options.flashes.length <= 0) return;
    const required = options.flashes.length * SparksCoreFlashRenderer.strideFloats;
    if (this.upload.length < required) this.upload = new Float32Array(required * 2);
    let offset = 0;
    for (const flash of options.flashes) {
      this.upload[offset] = flash.x;
      this.upload[offset + 1] = flash.y;
      this.upload[offset + 2] = flash.age;
      this.upload[offset + 3] = flash.life;
      this.upload[offset + 4] = flash.baseSize;
      this.upload[offset + 5] = flash.intensity;
      this.upload[offset + 6] = flash.seed;
      offset += SparksCoreFlashRenderer.strideFloats;
    }

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, options.target);
    gl.viewport(0, 0, options.width, options.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.upload.subarray(0, required), gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.uniform2f(this.uniform('uCanvasSize'), options.width, options.height);
    gl.uniform1f(this.uniform('uCoreFlashSize'), options.coreFlashSize);
    gl.uniform1f(this.uniform('uCoreIntensity'), options.coreIntensity);
    gl.uniform1f(this.uniform('uCoreAfterglow'), options.coreAfterglow);
    gl.uniform1f(this.uniform('uRenderTier'), options.renderTier);
    gl.uniform1f(this.uniform('uGlowBias'), options.glowBias);
    gl.uniform1f(this.uniform('uTime'), options.time);
    gl.drawArrays(gl.POINTS, 0, options.flashes.length);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  destroy(): void {
    this.uniforms.clear();
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }

  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniforms.get(name) ?? null;
  }
}

export class RawSparksScene extends RawWebGL2Scene {
  private runtime: SparksRuntime | null = null;
  private pendingGestures: GestureEvent[] = [];
  private mode: SparksMode = 'welding';

  constructor() {
    super({
      name: 'Sparks Native Raw',
      markup: MARKUP,
      canvasSelector: '[data-sparks-canvas]',
      maxDevicePixelRatio: 2,
      renderScale: (settings) => {
        const edge = Number(settings.rawParticleTextureSize ?? SPARKS_DEFAULTS.rawParticleTextureSize);
        return edge >= 768 ? 0.72 : edge >= 512 ? 0.84 : 1;
      },
      onInit: (state) => {
        this.runtime = createRuntime(state, this.mode);
      },
      onReset: (state) => {
        this.pendingGestures = [];
        if (this.runtime) destroyRuntime(this.runtime);
        this.runtime = createRuntime(state, this.mode, false);
        clearVisibleFramebuffer(state);
      },
      onSettingsChange: (state) => {
        if (this.runtime) applySettings(this.runtime, state);
      },
      onModeChange: (_state, mode) => {
        this.mode = sparksModeFromString(mode);
        if (this.runtime) {
          this.runtime.mode = this.mode;
          this.runtime.contacts.clear();
          this.runtime.buildController.reset();
          if (this.mode === 'build') {
            this.runtime.queuedSpawns = [];
            this.runtime.trailEnergy = 1;
          }
        }
      },
      shouldRender: () => this.pendingGestures.length > 0 || (this.runtime ? shouldRenderRuntime(this.runtime) : true),
      render: (state) => {
        if (this.runtime) renderRuntime(this.runtime, state, this.pendingGestures.splice(0));
      },
      getDebugStats: (state) => this.runtime ? getRuntimeDebugStats(this.runtime, state) : null,
      onDestroy: () => {
        if (this.runtime) destroyRuntime(this.runtime);
        this.runtime = null;
      },
    });
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.pendingGestures.push(...gestures);
  }

  override setMode(mode: string): void {
    super.setMode(mode);
    this.mode = sparksModeFromString(mode);
    if (this.runtime) {
      this.runtime.mode = this.mode;
      this.runtime.contacts.clear();
      this.runtime.buildController.reset();
      this.runtime.coreFlashAccumulator = 0;
      if (this.mode === 'build') {
        this.runtime.queuedSpawns = [];
        this.runtime.trailEnergy = 1;
      }
    }
  }

  override clearEmitters(): void {
    if (!this.runtime) return;
    this.pendingGestures = [];
    clearRuntimeEmitters(this.runtime);
  }
}

function createRuntime(state: RawWebGL2RenderState, mode: SparksMode, seedInitialBurst = true): SparksRuntime {
  const gl = state.gl;
  const particleState = createParticleState(state);
  particleState.clear();
  const runtime: SparksRuntime = {
    gl,
    particleState,
    stepPass: new RawGpuFieldPass(gl, { vertex: FULLSCREEN_VERTEX, fragment: STEP_FRAGMENT }),
    basicPass: new RawGpuFieldPass(gl, { vertex: FULLSCREEN_VERTEX, fragment: BASIC_FRAGMENT }),
    fadePass: new RawGpuFieldPass(gl, { vertex: FULLSCREEN_VERTEX, fragment: FADE_FRAGMENT }),
    compositePass: new RawGpuFieldPass(gl, { vertex: FULLSCREEN_VERTEX, fragment: COMPOSITE_FRAGMENT }),
    pointRenderer: new SparksPointRenderer(gl),
    trailSegmentRenderer: new SparksTrailSegmentRenderer(gl),
    coreFlashRenderer: new SparksCoreFlashRenderer(gl),
    trail: null,
    settings: settingsFromState(state),
    contacts: new Map<number, TorchContact>(),
    queuedSpawns: [],
    coreFlashes: [],
    mode,
    cleanup: () => undefined,
    spawnCursor: 0,
    rngState: 0x760431,
    trailEnergy: seedInitialBurst ? 1 : 0,
    coreFlashAccumulator: 0,
    lastGpuPasses: 0,
    emittedSparks: 0,
    contactBursts: 0,
    buildSurfaces: randomInitialBuildSurfaces(state.width, state.height),
    buildController: new BuildPathController({ minPointDistance: 5, spacingScale: 1.45, clickDistanceScale: 1.5 }),
    buildSurfaceCursor: 0,
    buildSurfaceUniforms: new Float32Array(MAX_BUILD_SURFACE_UNIFORMS * 4),
    buildObstacleProgram: linkRawWebGL2Program(gl, { vertex: BUILD_OBSTACLE_VERTEX, fragment: BUILD_OBSTACLE_FRAGMENT }),
    buildObstacleBuffer: gl.createBuffer(),
    worldWidth: state.width,
    worldHeight: state.height,
  };
  runtime.cleanup = attachPointerInput(state, runtime);
  if (seedInitialBurst) {
    queueCoreFlashBurst(runtime, state.width * 0.5, state.height * 0.58, 0, -1, 1.25, Math.max(1, Math.round(runtime.settings.coreSpark.rate * 0.5)), 1.35);
    queueContactBurst(runtime, state.width * 0.5, state.height * 0.58, 0, -1, 0.8, true, 'welding');
  }
  return runtime;
}

function destroyRuntime(runtime: SparksRuntime): void {
  runtime.cleanup();
  runtime.trail?.destroy();
  runtime.pointRenderer.destroy();
  runtime.trailSegmentRenderer.destroy();
  runtime.coreFlashRenderer.destroy();
  runtime.stepPass.destroy();
  runtime.basicPass.destroy();
  runtime.fadePass.destroy();
  runtime.compositePass.destroy();
  runtime.particleState.destroy();
  runtime.gl.deleteProgram(runtime.buildObstacleProgram);
  if (runtime.buildObstacleBuffer) runtime.gl.deleteBuffer(runtime.buildObstacleBuffer);
}

function clearRuntimeEmitters(runtime: SparksRuntime): void {
  runtime.contacts.clear();
  runtime.queuedSpawns = [];
  runtime.coreFlashes = [];
  runtime.coreFlashAccumulator = 0;
  runtime.trailEnergy = 0;
  runtime.particleState.clear();
  clearTrail(runtime);
}

function clearVisibleFramebuffer(state: RawWebGL2RenderState): void {
  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function reconcileRuntimeWorldSize(runtime: SparksRuntime, state: RawWebGL2RenderState): void {
  if (runtime.worldWidth === state.width && runtime.worldHeight === state.height) return;
  const scaleX = state.width / Math.max(1, runtime.worldWidth);
  const scaleY = state.height / Math.max(1, runtime.worldHeight);

  for (const surface of runtime.buildSurfaces) {
    surface.x1 *= scaleX;
    surface.x2 *= scaleX;
    surface.y1 *= scaleY;
    surface.y2 *= scaleY;
  }

  for (const contact of runtime.contacts.values()) {
    contact.x *= scaleX;
    contact.y *= scaleY;
    contact.dx *= scaleX;
    contact.dy *= scaleY;
  }

  for (const flash of runtime.coreFlashes) {
    flash.x *= scaleX;
    flash.y *= scaleY;
    flash.baseSize *= Math.sqrt(Math.max(0.0001, scaleX * scaleY));
  }

  runtime.buildController.reset();
  runtime.particleState.clear();
  runtime.spawnCursor = 0;
  runtime.queuedSpawns = [];
  runtime.trailEnergy = 0;
  clearTrail(runtime);
  runtime.worldWidth = state.width;
  runtime.worldHeight = state.height;
}

function createParticleState(state: RawWebGL2RenderState): RawGpuParticleState {
  const edge = settingsFromState(state).rawParticleTextureSize;
  return new RawGpuParticleState(state.resources, {
    capacity: edge * edge,
    width: edge,
    height: edge,
    precision: 'float',
  });
}

type SparkProfileLegacyKeys = Partial<Record<SparkProfileSettingKey, string>>;

function readSparkProfile(state: RawWebGL2RenderState, prefix: string, legacyKeys: SparkProfileLegacyKeys = {}): SparkParticleRuntimeProfile {
  return {
    rate: readProfileSetting(state, prefix, 'rate', legacyKeys.rate),
    size: readProfileSetting(state, prefix, 'size', legacyKeys.size),
    length: readProfileSetting(state, prefix, 'length', legacyKeys.length),
    lengthVariability: readProfileSetting(state, prefix, 'lengthVariability', legacyKeys.lengthVariability),
    sizeVariability: readProfileSetting(state, prefix, 'sizeVariability', legacyKeys.sizeVariability),
    lifespan: readProfileSetting(state, prefix, 'lifespan', legacyKeys.lifespan),
    lifespanVariability: readProfileSetting(state, prefix, 'lifespanVariability', legacyKeys.lifespanVariability),
    speedScale: readProfileSetting(state, prefix, 'speedScale', legacyKeys.speedScale),
    intensity: readProfileSetting(state, prefix, 'intensity', legacyKeys.intensity),
    afterglow: readProfileSetting(state, prefix, 'afterglow', legacyKeys.afterglow),
  };
}

function readProfileSetting(
  state: RawWebGL2RenderState,
  prefix: string,
  key: SparkProfileSettingKey,
  legacyKey?: string,
): number {
  const profileKey = sparkParticleProfileSettingKey(prefix, key);
  const raw = state.settings[profileKey] ?? (legacyKey ? state.settings[legacyKey] : undefined) ?? SPARKS_DEFAULTS[profileKey];
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number(SPARKS_DEFAULTS[profileKey] ?? 0);
}

function settingsFromState(state: RawWebGL2RenderState): SparksSettings {
  const rawEdge = Number(state.settings.rawParticleTextureSize ?? SPARKS_DEFAULTS.rawParticleTextureSize);
  return {
    emissionRate: finiteNumberSetting(state.settings, 'emissionRate', SPARKS_DEFAULTS.emissionRate as number),
    sparkPower: finiteNumberSetting(state.settings, 'sparkPower', SPARKS_DEFAULTS.sparkPower as number),
    sparkDirectionChaos: finiteNumberSetting(state.settings, 'sparkDirectionChaos', SPARKS_DEFAULTS.sparkDirectionChaos as number),
    torchRadius: finiteNumberSetting(state.settings, 'torchRadius', SPARKS_DEFAULTS.torchRadius as number),
    buildRadius: finiteNumberSetting(state.settings, 'buildRadius', SPARKS_DEFAULTS.buildRadius as number),
    contactHeat: finiteNumberSetting(state.settings, 'contactHeat', SPARKS_DEFAULTS.contactHeat as number),
    coreSpark: readSparkProfile(state, 'coreSpark', {
      rate: 'coreFlashRate',
      size: 'coreFlashSize',
      sizeVariability: 'coreFlashVariability',
      intensity: 'coreIntensity',
      afterglow: 'coreAfterglow',
    }),
    bounceRestitution: finiteNumberSetting(state.settings, 'bounceRestitution', SPARKS_DEFAULTS.bounceRestitution as number),
    bounceLifeDecay: finiteNumberSetting(state.settings, 'bounceLifeDecay', SPARKS_DEFAULTS.bounceLifeDecay as number),
    bounceBurstChance: finiteNumberSetting(state.settings, 'bounceBurstChance', SPARKS_DEFAULTS.bounceBurstChance as number),
    bounceBurstCount: finiteNumberSetting(state.settings, 'bounceBurstCount', SPARKS_DEFAULTS.bounceBurstCount as number),
    bounceBurstCountSpeedScale: finiteNumberSetting(state.settings, 'bounceBurstCountSpeedScale', SPARKS_DEFAULTS.bounceBurstCountSpeedScale as number),
    bounceBurstImpactSpeedScale: finiteNumberSetting(state.settings, 'bounceBurstImpactSpeedScale', SPARKS_DEFAULTS.bounceBurstImpactSpeedScale as number),
    bounceBurstSpread: finiteNumberSetting(state.settings, 'bounceBurstSpread', SPARKS_DEFAULTS.bounceBurstSpread as number),
    primarySpark: readSparkProfile(state, 'primarySpark', {
      size: 'particleSize',
      length: 'sparkLength',
      sizeVariability: SPARK_SIZE_VARIABILITY_KEY,
      lifespan: 'sparkLifespan',
      lifespanVariability: 'sparkLifespanVariability',
    }),
    bounceSpark: readSparkProfile(state, 'bounceSpark', {
      lifespan: 'bounceBurstLifeScale',
      speedScale: 'bounceBurstSpeedScale',
    }),
    sparkTurbulence: finiteNumberSetting(state.settings, 'sparkTurbulence', SPARKS_DEFAULTS.sparkTurbulence as number),
    gravity: finiteNumberSetting(state.settings, 'gravity', SPARKS_DEFAULTS.gravity as number),
    airDrag: finiteNumberSetting(state.settings, 'airDrag', SPARKS_DEFAULTS.airDrag as number),
    surfaceFriction: finiteNumberSetting(state.settings, 'surfaceFriction', SPARKS_DEFAULTS.surfaceFriction as number),
    renderStyle: renderStyleFromString(String(state.settings.renderStyle ?? SPARKS_DEFAULTS.renderStyle)),
    trailFade: finiteNumberSetting(state.settings, 'trailFade', SPARKS_DEFAULTS.trailFade as number),
    trailContinuity: finiteNumberSetting(state.settings, 'trailContinuity', SPARKS_DEFAULTS.trailContinuity as number),
    bloomStrength: finiteNumberSetting(state.settings, 'bloomStrength', SPARKS_DEFAULTS.bloomStrength as number),
    heatRadius: finiteNumberSetting(state.settings, 'heatRadius', SPARKS_DEFAULTS.heatRadius as number),
    rawParticleTextureSize: clamp(Math.floor(Number.isFinite(rawEdge) ? rawEdge : 256), 128, 768),
    simDepth: simDepthFromString(String(state.settings.simDepth ?? SPARKS_DEFAULTS.simDepth)),
  };
}

function applySettings(runtime: SparksRuntime, state: RawWebGL2RenderState): void {
  const next = settingsFromState(state);
  if (next.rawParticleTextureSize !== runtime.settings.rawParticleTextureSize) {
    runtime.particleState.destroy();
    runtime.particleState = createParticleState(state);
    runtime.particleState.clear();
    runtime.spawnCursor = 0;
  }
  runtime.settings = next;
}

function randomInitialBuildSurfaces(width: number, height: number): BuildSurface[] {
  const count = 4 + Math.floor(Math.random() * 3);
  const surfaces: BuildSurface[] = [];
  for (let index = 0; index < count; index += 1) {
    const centerX = randomRange(width * 0.18, width * 0.82);
    const centerY = randomRange(height * 0.46, height * 0.82);
    const length = randomRange(width * 0.18, width * 0.42);
    const angle = randomRange(-0.52, 0.52);
    const dx = Math.cos(angle) * length * 0.5;
    const dy = Math.sin(angle) * length * 0.5;
    surfaces.push({
      x1: clamp(centerX - dx, width * 0.06, width * 0.94),
      y1: clamp(centerY - dy, height * 0.3, height * 0.88),
      x2: clamp(centerX + dx, width * 0.06, width * 0.94),
      y2: clamp(centerY + dy, height * 0.3, height * 0.88),
    });
  }
  return surfaces;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function addBuildSurface(runtime: SparksRuntime, x1: number, y1: number, x2: number, y2: number): void {
  if (Math.hypot(x2 - x1, y2 - y1) < 8) return;
  const surface = { x1, y1, x2, y2 };
  if (runtime.buildSurfaces.length < MAX_BUILD_SURFACES) {
    runtime.buildSurfaces.push(surface);
  } else {
    runtime.buildSurfaces[runtime.buildSurfaceCursor] = surface;
    runtime.buildSurfaceCursor = (runtime.buildSurfaceCursor + 1) % MAX_BUILD_SURFACES;
  }
  runtime.trailEnergy = 1;
}

function buildSurfaceFromFixture(fixture: BuildFixtureSamples, radius: number): BuildSurface {
  if (fixture.kind === 'line') {
    return { x1: fixture.start.x, y1: fixture.start.y, x2: fixture.end.x, y2: fixture.end.y };
  }
  return { x1: fixture.start.x - radius * 4, y1: fixture.start.y, x2: fixture.start.x + radius * 4, y2: fixture.start.y };
}

function addBuildFixture(runtime: SparksRuntime, fixture: BuildFixtureSamples, radius: number): void {
  const surface = buildSurfaceFromFixture(fixture, radius);
  addBuildSurface(runtime, surface.x1, surface.y1, surface.x2, surface.y2);
}

function writeBuildSurfaceUniforms(runtime: SparksRuntime, includePreview = false): Float32Array {
  runtime.buildSurfaceUniforms.fill(0);
  const count = Math.min(MAX_BUILD_SURFACES, runtime.buildSurfaces.length);
  for (let index = 0; index < count; index += 1) {
    const surface = runtime.buildSurfaces[index];
    if (!surface) continue;
    const offset = index * 4;
    runtime.buildSurfaceUniforms[offset] = surface.x1;
    runtime.buildSurfaceUniforms[offset + 1] = surface.y1;
    runtime.buildSurfaceUniforms[offset + 2] = surface.x2;
    runtime.buildSurfaceUniforms[offset + 3] = surface.y2;
  }
  if (includePreview) {
    const [fixture] = runtime.buildController.activeFixtures(sparksBuildRadius(runtime));
    if (fixture) {
      const surface = buildSurfaceFromFixture(fixture, sparksBuildRadius(runtime));
      const offset = MAX_BUILD_SURFACES * 4;
      runtime.buildSurfaceUniforms[offset] = surface.x1;
      runtime.buildSurfaceUniforms[offset + 1] = surface.y1;
      runtime.buildSurfaceUniforms[offset + 2] = surface.x2;
      runtime.buildSurfaceUniforms[offset + 3] = surface.y2;
    }
  }
  return runtime.buildSurfaceUniforms;
}

function attachPointerInput(state: RawWebGL2RenderState, runtime: SparksRuntime): () => void {
  const down = (event: PointerEvent) => {
    state.canvas.setPointerCapture?.(event.pointerId);
    const point = eventPoint(state, event);
    if (runtime.mode === BUILD_MODE_ID) {
      runtime.buildController.begin(event.pointerId, point);
      return;
    }
    runtime.contacts.set(event.pointerId, {
      id: event.pointerId,
      x: point.x,
      y: point.y,
      dx: 0,
      dy: 0,
      strength: 1,
      age: 0,
      accumulator: 0,
      coreAccumulator: 0,
      pattern: patternForMode(runtime.mode),
    });
    queueCoreFlashBurst(runtime, point.x, point.y, 0, -1, 1.35, Math.max(1, Math.round(runtime.settings.coreSpark.rate * 0.55)), 1.45);
    queueContactBurst(runtime, point.x, point.y, 0, -1, 0.9, true, patternForMode(runtime.mode));
  };
  const move = (event: PointerEvent) => {
    if (runtime.mode === BUILD_MODE_ID) {
      if (event.buttons !== 1) return;
      const point = eventPoint(state, event);
      runtime.buildController.move(event.pointerId, point);
      return;
    }
    if (!runtime.contacts.has(event.pointerId) && event.buttons !== 1) return;
    const point = eventPoint(state, event);
    const previous = runtime.contacts.get(event.pointerId);
    runtime.contacts.set(event.pointerId, {
      id: event.pointerId,
      x: point.x,
      y: point.y,
      dx: previous ? point.x - previous.x : 0,
      dy: previous ? point.y - previous.y : 0,
      strength: event.buttons === 1 ? 1 : 0.65,
      age: previous?.age ?? 0,
      accumulator: previous?.accumulator ?? 0,
      coreAccumulator: previous?.coreAccumulator ?? 0,
      pattern: previous?.pattern ?? patternForMode(runtime.mode),
    });
  };
  const up = (event: PointerEvent) => {
    if (runtime.mode === BUILD_MODE_ID) {
      const point = eventPoint(state, event);
      const fixture = runtime.buildController.end(event.pointerId, point, sparksBuildRadius(runtime));
      if (fixture) addBuildFixture(runtime, fixture, sparksBuildRadius(runtime));
    } else {
      runtime.buildController.cancel(event.pointerId);
    }
    runtime.contacts.delete(event.pointerId);
    state.canvas.releasePointerCapture?.(event.pointerId);
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

function renderRuntime(runtime: SparksRuntime, state: RawWebGL2RenderState, gestures: GestureEvent[]): void {
  const dt = Math.min(1 / 20, Math.max(0, state.deltaSeconds));
  reconcileRuntimeWorldSize(runtime, state);
  applyGestures(runtime, state, gestures, dt);
  runtime.trailEnergy = Math.max(0, runtime.trailEnergy - dt * 0.18);
  updateContacts(runtime, dt);
  updateCoreFlashes(runtime, dt);
  if (runtime.settings.renderStyle === 'ultra') ensureTrail(runtime, state);
  runGpuSteps(runtime, state, dt);
  drawScene(runtime, state);
}

function updateCoreFlashes(runtime: SparksRuntime, dt: number): void {
  if (runtime.coreFlashes.length <= 0) return;
  let writeIndex = 0;
  for (let index = 0; index < runtime.coreFlashes.length; index += 1) {
    const flash = runtime.coreFlashes[index];
    flash.age += dt;
    if (flash.age < flash.life) {
      runtime.coreFlashes[writeIndex] = flash;
      writeIndex += 1;
    }
  }
  runtime.coreFlashes.length = writeIndex;
}

function updateContacts(runtime: SparksRuntime, dt: number): void {
  for (const contact of runtime.contacts.values()) {
    contact.age += dt;
    contact.coreAccumulator = advanceCoreFlashAccumulator(runtime, contact.x, contact.y, contact.dx, contact.dy, contact.strength, contact.coreAccumulator, dt);
    contact.accumulator += Math.max(0, runtime.settings.emissionRate) * Math.max(0.25, contact.strength) * dt;
    const bursts = Math.min(18, Math.floor(contact.accumulator / 220));
    if (bursts <= 0) continue;
    contact.accumulator -= bursts * 220;
    for (let index = 0; index < bursts; index += 1) {
      queueContactBurst(runtime, contact.x, contact.y, contact.dx, contact.dy, contact.strength, false, contact.pattern);
    }
    queueCoreFlashBurst(runtime, contact.x, contact.y, contact.dx, contact.dy, contact.strength, Math.min(12, Math.round(bursts * runtime.settings.coreSpark.rate * 0.32)), 1.28);
  }
}

function advanceCoreFlashAccumulator(runtime: SparksRuntime, x: number, y: number, dx: number, dy: number, strength: number, accumulator: number, dt: number): number {
  const rate = Math.max(0, runtime.settings.coreSpark.rate);
  if (rate <= 0) return 0;
  const variability = clamp(runtime.settings.coreSpark.sizeVariability, 0, 1);
  let nextAccumulator = accumulator + rate * Math.max(0.35, strength) * dt;
  let flashes = 0;
  while (nextAccumulator >= 1 && flashes < 4) {
    const cost = mix(0.68, mix(0.44, 1.72, nextRandom(runtime)), variability);
    if (nextAccumulator < cost) break;
    nextAccumulator -= cost;
    flashes += 1;
  }
  if (flashes > 0) queueCoreFlashBurst(runtime, x, y, dx, dy, strength, flashes, 0.82);
  return Math.min(4, nextAccumulator);
}

function queueCoreFlashBurst(runtime: SparksRuntime, x: number, y: number, dx: number, dy: number, strength: number, flashes: number, syncBoost: number): void {
  const count = Math.max(0, Math.floor(flashes));
  const variability = clamp(runtime.settings.coreSpark.sizeVariability, 0, 1);
  const jitterRadius = runtime.settings.torchRadius * mix(0.04, 0.32, variability);
  for (let index = 0; index < count; index += 1) {
    const angle = nextRandom(runtime) * Math.PI * 2;
    const radius = jitterRadius * Math.pow(nextRandom(runtime), 1.85);
    const variedStrength = strength * syncBoost * mix(1, mix(0.55, 1.8, nextRandom(runtime)), variability);
    queueCoreGlow(runtime, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, dx, dy, variedStrength);
  }
}

function queueCoreGlow(runtime: SparksRuntime, x: number, y: number, dx: number, dy: number, strength: number): void {
  const variability = clamp(runtime.settings.coreSpark.sizeVariability, 0, 1);
  const flashVariation = mix(1, mix(0.42, 2.18, nextRandom(runtime)), variability);
  const flashSize = Math.max(0.05, runtime.settings.coreSpark.size);
  const contactHeat = Math.max(0, runtime.settings.contactHeat);
  const heatStrength = contactHeat * clamp(strength, 0, 2.8);
  const coreLife = clamp((0.085 + runtime.settings.coreSpark.afterglow * 0.22 + heatStrength * 0.014) * Math.max(0, runtime.settings.coreSpark.lifespan), 0.04, 1.2);
  const coreSize = mix(18, 78, clamp(runtime.settings.heatRadius / 130, 0, 1)) * Math.sqrt(flashSize) * Math.sqrt(flashVariation);
  const coreIntensity = clamp(heatStrength * 0.32, 0, 2.6) * Math.max(0, runtime.settings.coreSpark.intensity / 3.65) * mix(1, mix(0.72, 1.45, nextRandom(runtime)), variability);
  runtime.coreFlashes.push({
    x,
    y,
    age: 0.006,
    life: coreLife,
    baseSize: coreSize,
    intensity: coreIntensity,
    seed: nextRandom(runtime) * 1000 + runtime.coreFlashes.length * 0.37,
  });
  if (runtime.coreFlashes.length > MAX_CORE_FLASHES) runtime.coreFlashes.splice(0, runtime.coreFlashes.length - MAX_CORE_FLASHES);
  const coreParticleCount = Math.max(0, Math.round((contactHeat * 1.52 + runtime.settings.heatRadius * 0.052 * heatStrength) * flashSize * flashVariation));
  if (coreParticleCount > 0) {
    runtime.queuedSpawns.push({
      x,
      y,
      vx: dx * 0.08,
      vy: dy * 0.08,
      count: coreParticleCount,
      kind: 0,
      seed: nextRandom(runtime) * 10000,
      paletteSeed: nextRandom(runtime) * 50000,
      power: Math.max(0, runtime.settings.heatRadius * flashSize) * clamp(strength * 0.036, 0, 0.18) * Math.sqrt(flashVariation),
      lifeScale: clamp(0.28 + runtime.settings.coreSpark.afterglow * 0.3 + heatStrength * 0.022, 0.22, 0.78) * Math.max(0, runtime.settings.coreSpark.lifespan),
      pattern: 0,
    });
  }
  runtime.trailEnergy = 1;
}

function queueContactBurst(runtime: SparksRuntime, x: number, y: number, dx: number, dy: number, strength: number, burst: boolean, pattern: SparksEmitterPattern): void {
  const heat = Math.max(0, runtime.settings.contactHeat) * clamp(strength, 0.3, 2.2);
  const count = Math.max(0, Math.round((burst ? 34 : 10) * heat));
  if (count <= 0) return;
  const isShower = pattern === 'shower';
  const primaryPower = runtime.settings.sparkPower * runtime.settings.primarySpark.speedScale;
  const inheritedVx = isShower ? 0 : dx * (burst ? 0.62 : 0.32);
  const inheritedVy = isShower ? 0 : dy * (burst ? 0.62 : 0.32);
  runtime.queuedSpawns.push({
    x,
    y,
    vx: inheritedVx,
    vy: isShower ? 0 : inheritedVy - primaryPower * 0.05,
    count,
    kind: 1,
    seed: nextRandom(runtime) * 10000 + runtime.emittedSparks * 0.017,
    paletteSeed: nextRandom(runtime) * 50000,
    power: primaryPower * (pattern === 'pinwheel' ? 1.08 : burst ? 1.18 : 0.98),
    lifeScale: clamp(0.42 + heat * 0.1, 0.24, 0.92),
    pattern: patternToSpawnNumber(pattern),
  });
  runtime.emittedSparks += count;
  runtime.contactBursts += 1;
  runtime.trailEnergy = 1;
}

function runGpuSteps(runtime: SparksRuntime, state: RawWebGL2RenderState, dt: number): void {
  let passes = 0;
  const ratePassBoost = Math.floor(clamp(runtime.settings.emissionRate / 1800, 0, 14));
  const stylePassBudget = runtime.settings.renderStyle === 'ultra' ? 18 : runtime.settings.renderStyle === 'enhanced' ? 12 : 10;
  const maxSpawns = stylePassBudget + ratePassBoost;
  const first = runtime.queuedSpawns.shift();
  runStepPass(runtime, state, dt, first);
  passes += 1;
  for (let index = 0; index < maxSpawns - 1 && runtime.queuedSpawns.length > 0; index += 1) {
    runStepPass(runtime, state, 0, runtime.queuedSpawns.shift());
    passes += 1;
  }
  runtime.lastGpuPasses = passes + (runtime.settings.renderStyle === 'basic' ? 1 : runtime.settings.renderStyle === 'ultra' ? 6 : 3);
}

function runStepPass(runtime: SparksRuntime, state: RawWebGL2RenderState, dt: number, spawn: SpawnCommand | undefined): void {
  const gl = state.gl;
  const particleState = runtime.particleState;
  let spawnStart = 0;
  let spawnCount = 0;
  if (spawn) {
    spawnCount = Math.max(1, Math.min(particleState.capacity, Math.floor(spawn.count)));
    if (runtime.spawnCursor + spawnCount >= particleState.capacity) runtime.spawnCursor = 0;
    spawnStart = runtime.spawnCursor;
    runtime.spawnCursor += spawnCount;
  }
  particleState.bindWriteFramebuffer();
  runtime.stepPass.render({
    width: particleState.width,
    height: particleState.height,
    preserveFramebuffer: true,
    bind: (_gl, _program, uniform) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, particleState.positions.read.texture.texture);
      gl.uniform1i(uniform('uPosition'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, particleState.velocities.read.texture.texture);
      gl.uniform1i(uniform('uVelocity'), 1);
      gl.uniform2i(uniform('uStateSize'), particleState.width, particleState.height);
      gl.uniform4f(uniform('uWorldBounds'), 0, 0, state.width, state.height);
      gl.uniform1f(uniform('uDt'), dt);
      gl.uniform1f(uniform('uGravity'), runtime.settings.gravity);
      gl.uniform1f(uniform('uDamping'), runtime.settings.airDrag);
      gl.uniform1f(uniform('uRestitution'), runtime.settings.bounceRestitution);
      gl.uniform1f(uniform('uBounceLifeDecay'), runtime.settings.bounceLifeDecay);
      gl.uniform1f(uniform('uBounceBurstChance'), runtime.settings.bounceBurstChance);
      gl.uniform1f(uniform('uBounceBurstCount'), runtime.settings.bounceBurstCount);
      gl.uniform1f(uniform('uBounceBurstCountSpeedScale'), runtime.settings.bounceBurstCountSpeedScale);
      gl.uniform1f(uniform('uBounceBurstImpactSpeedScale'), runtime.settings.bounceBurstImpactSpeedScale);
      gl.uniform1f(uniform('uBounceSparkSpeedScale'), runtime.settings.bounceSpark.speedScale);
      gl.uniform1f(uniform('uBounceSparkLifespan'), runtime.settings.bounceSpark.lifespan);
      gl.uniform1f(uniform('uBounceSparkLifespanVariability'), runtime.settings.bounceSpark.lifespanVariability);
      gl.uniform1f(uniform('uBounceBurstSpread'), runtime.settings.bounceBurstSpread);
      gl.uniform1f(uniform('uSparkPower'), runtime.settings.sparkPower * runtime.settings.primarySpark.speedScale);
      gl.uniform1f(uniform('uSurfaceFriction'), runtime.settings.surfaceFriction);
      gl.uniform1f(uniform('uTime'), state.timeSeconds);
      gl.uniform1f(uniform('uSpawnActive'), spawn ? 1 : 0);
      gl.uniform1f(uniform('uSpawnStart'), spawnStart);
      gl.uniform1f(uniform('uSpawnCount'), spawnCount);
      gl.uniform2f(uniform('uSpawnPosition'), spawn?.x ?? 0, spawn?.y ?? 0);
      gl.uniform2f(uniform('uSpawnVelocity'), spawn?.vx ?? 0, spawn?.vy ?? 0);
      gl.uniform1f(uniform('uSpawnKind'), spawn?.kind ?? 0);
      gl.uniform1f(uniform('uSpawnSeed'), spawn?.seed ?? 0);
      gl.uniform1f(uniform('uSpawnPaletteSeed'), spawn?.paletteSeed ?? 0);
      gl.uniform1f(uniform('uSpawnPower'), spawn?.power ?? 0);
      gl.uniform1f(uniform('uSpawnPattern'), spawn?.pattern ?? 0);
      gl.uniform1f(uniform('uDirectionChaos'), runtime.settings.sparkDirectionChaos);
      gl.uniform1f(uniform('uLifeScale'), (spawn?.lifeScale ?? 1) * (spawn?.kind === 0 ? runtime.settings.coreSpark.lifespan : runtime.settings.primarySpark.lifespan));
      gl.uniform1f(uniform('uLifeVariability'), spawn?.kind === 0 ? runtime.settings.coreSpark.lifespanVariability : runtime.settings.primarySpark.lifespanVariability);
      gl.uniform1f(uniform('uTurbulence'), runtime.settings.sparkTurbulence);
      gl.uniform1f(uniform('uSimDepth'), runtime.settings.simDepth);
      gl.uniform1f(uniform('uBuildRadius'), sparksBuildRadius(runtime));
      gl.uniform1i(uniform('uBuildSurfaceCount'), Math.min(MAX_BUILD_SURFACES, runtime.buildSurfaces.length));
      gl.uniform4fv(uniform('uBuildSurfaces[0]'), writeBuildSurfaceUniforms(runtime));
    },
  });
  particleState.unbindWriteFramebuffer();
  particleState.swap();
}

function drawScene(runtime: SparksRuntime, state: RawWebGL2RenderState): void {
  const background = colorNumberToTriplet(state.style?.background ?? 0x030507);
  if (runtime.settings.renderStyle === 'basic') {
    runtime.basicPass.render({
      target: null,
      width: state.width,
      height: state.height,
      bind: (gl, program, uniform) => {
        gl.useProgram(program);
        gl.uniform3f(uniform('uBackground'), background[0], background[1], background[2]);
        gl.uniform2f(uniform('uCanvasSize'), state.width, state.height);
        gl.uniform1f(uniform('uRenderTier'), 0);
        gl.uniform1f(uniform('uTime'), state.timeSeconds);
        gl.uniform1i(uniform('uBuildSurfaceCount'), 0);
        gl.uniform1f(uniform('uBuildPreviewCount'), 0);
      },
    });
    renderBuildObstacles(runtime, state);
    drawPoints(runtime, state, null, 0);
    drawCoreFlashes(runtime, state, null, 0, 1);
    return;
  }

  if (runtime.settings.renderStyle === 'enhanced') {
    runtime.basicPass.render({
      target: null,
      width: state.width,
      height: state.height,
      bind: (gl, program, uniform) => {
        gl.useProgram(program);
        gl.uniform3f(uniform('uBackground'), background[0], background[1], background[2]);
        gl.uniform2f(uniform('uCanvasSize'), state.width, state.height);
        gl.uniform1f(uniform('uRenderTier'), 1);
        gl.uniform1f(uniform('uTime'), state.timeSeconds);
        gl.uniform1i(uniform('uBuildSurfaceCount'), 0);
        gl.uniform1f(uniform('uBuildPreviewCount'), 0);
      },
    });
    renderBuildObstacles(runtime, state);
    drawTrailSegments(runtime, state, null, 0.5, 0.9);
    drawPoints(runtime, state, null, 0.46, 0.82, 1.08, 0.82);
    drawCoreFlashes(runtime, state, null, 0.54, 1.06);
    return;
  }

  if (!runtime.trail) return;
  const gl = state.gl;
  const uniforms = state.style?.uniforms ?? {};
  const glowBias = numberUniform(uniforms, 'glowBias', 1);
  const heatTint = numberUniform(uniforms, 'heatTint', 0.2);
  const skyLift = numberUniform(uniforms, 'skyLift', 0.02);
  runtime.fadePass.render({
    target: runtime.trail.write,
    width: state.width,
    height: state.height,
    bind: (_gl, _program, uniform) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, runtime.trail?.read.texture.texture ?? null);
      gl.uniform1i(uniform('uTrail'), 0);
      gl.uniform1f(uniform('uFade'), runtime.settings.trailFade);
      gl.uniform3f(uniform('uBackground'), background[0], background[1], background[2]);
    },
  });
  drawTrailSegments(runtime, state, runtime.trail.write.framebuffer, runtime.settings.renderStyle === 'ultra' ? 0.88 : 0.66, glowBias * 1.45);
  drawPoints(runtime, state, runtime.trail.write.framebuffer, runtime.settings.renderStyle === 'ultra' ? 0.46 : 0.32, glowBias * 0.34, 1.05, 0.22);
  drawCoreFlashes(runtime, state, runtime.trail.write.framebuffer, runtime.settings.renderStyle === 'ultra' ? 0.9 : 0.62, glowBias * 1.2);
  if (runtime.settings.renderStyle === 'ultra') {
    drawTrailSegments(runtime, state, runtime.trail.write.framebuffer, 0.36, glowBias * 0.52);
    drawPoints(runtime, state, runtime.trail.write.framebuffer, 0.2, glowBias * 0.16, 1.4, 0.12);
    drawCoreFlashes(runtime, state, runtime.trail.write.framebuffer, 0.34, glowBias * 0.48);
  }
  runtime.trail.swap();
  runtime.compositePass.render({
    target: null,
    width: state.width,
    height: state.height,
    bind: (_gl, _program, uniform) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, runtime.trail?.read.texture.texture ?? null);
      gl.uniform1i(uniform('uTrail'), 0);
      gl.uniform3f(uniform('uBackground'), background[0], background[1], background[2]);
      gl.uniform1f(uniform('uBloom'), runtime.settings.bloomStrength);
      gl.uniform1f(uniform('uSkyLift'), skyLift);
      gl.uniform1f(uniform('uHeatTint'), heatTint);
      gl.uniform1f(uniform('uTime'), state.timeSeconds);
      gl.uniform1i(uniform('uBuildSurfaceCount'), 0);
      gl.uniform1f(uniform('uBuildPreviewCount'), 0);
    },
  });
  renderBuildObstacles(runtime, state);
  drawPoints(runtime, state, null, 0.72, glowBias * 1.08, 1.45, 1);
  drawCoreFlashes(runtime, state, null, 0.84, glowBias * 1.35);
}

function drawTrailSegments(
  runtime: SparksRuntime,
  state: RawWebGL2RenderState,
  target: WebGLFramebuffer | null,
  renderTier: number,
  glowBias: number,
): void {
  runtime.trailSegmentRenderer.render({
    particleState: runtime.particleState,
    target,
    width: state.width,
    height: state.height,
    primarySpark: runtime.settings.primarySpark,
    bounceSpark: runtime.settings.bounceSpark,
    trailContinuity: runtime.settings.trailContinuity,
    renderTier,
    simDepth: runtime.settings.simDepth,
    coreIntensity: runtime.settings.coreSpark.intensity,
    glowBias,
    time: state.timeSeconds,
    palette: state.style?.palette ?? [0xffffff, 0xdbeafe, 0x93c5fd, 0xffd166, 0xf97316],
  });
}

function drawCoreFlashes(
  runtime: SparksRuntime,
  state: RawWebGL2RenderState,
  target: WebGLFramebuffer | null,
  renderTier: number,
  glowBias: number,
): void {
  runtime.coreFlashRenderer.render({
    flashes: runtime.coreFlashes,
    target,
    width: state.width,
    height: state.height,
    renderTier,
    coreFlashSize: runtime.settings.coreSpark.size,
    coreIntensity: runtime.settings.coreSpark.intensity,
    coreAfterglow: runtime.settings.coreSpark.afterglow,
    glowBias,
    time: state.timeSeconds,
  });
}

function renderBuildObstacles(runtime: SparksRuntime, state: RawWebGL2RenderState): void {
  if (!runtime.buildObstacleBuffer) return;
  const radius = sparksBuildRadius(runtime);
  const activeFixtures = runtime.buildController.activeFixtures(radius);
  if (runtime.buildSurfaces.length <= 0 && activeFixtures.length <= 0) return;

  const committed: number[] = [];
  for (const surface of runtime.buildSurfaces) {
    pushBuildCapsuleTriangles(committed, { x: surface.x1, y: surface.y1 }, { x: surface.x2, y: surface.y2 }, radius);
  }

  const preview: number[] = [];
  for (const fixture of activeFixtures) {
    pushBuildFixtureTriangles(preview, fixture, radius);
  }

  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(runtime.buildObstacleProgram);
  gl.uniform2f(gl.getUniformLocation(runtime.buildObstacleProgram, 'uResolution'), state.width, state.height);
  gl.bindBuffer(gl.ARRAY_BUFFER, runtime.buildObstacleBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

  if (committed.length > 0) {
    gl.uniform4f(gl.getUniformLocation(runtime.buildObstacleProgram, 'uColor'), BUILD_OBSTACLE_MESH_COLOR[0], BUILD_OBSTACLE_MESH_COLOR[1], BUILD_OBSTACLE_MESH_COLOR[2], 1);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(committed), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, committed.length / 2);
  }

  if (preview.length > 0) {
    gl.uniform4f(gl.getUniformLocation(runtime.buildObstacleProgram, 'uColor'), BUILD_OBSTACLE_PREVIEW_COLOR[0], BUILD_OBSTACLE_PREVIEW_COLOR[1], BUILD_OBSTACLE_PREVIEW_COLOR[2], 0.92);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(preview), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, preview.length / 2);
  }

  gl.disable(gl.BLEND);
}

function drawPoints(
  runtime: SparksRuntime,
  state: RawWebGL2RenderState,
  target: WebGLFramebuffer | null,
  renderTier: number,
  glowBias = 1,
  primarySizeScale = 1,
  coreAlpha = 1,
): void {
  const primarySpark = {
    ...runtime.settings.primarySpark,
    size: runtime.settings.primarySpark.size * primarySizeScale,
  };
  runtime.pointRenderer.render({
    particleState: runtime.particleState,
    target,
    width: state.width,
    height: state.height,
    worldBounds: [0, 0, state.width, state.height],
    primarySpark,
    bounceSpark: runtime.settings.bounceSpark,
    renderTier,
    coreFlashSize: runtime.settings.coreSpark.size,
    coreFlashVariability: runtime.settings.coreSpark.sizeVariability,
    coreIntensity: runtime.settings.coreSpark.intensity,
    coreAfterglow: runtime.settings.coreSpark.afterglow,
    glowBias,
    coreAlpha,
    simDepth: runtime.settings.simDepth,
    time: state.timeSeconds,
    palette: state.style?.palette ?? [0xffffff, 0xdbeafe, 0x93c5fd, 0xffd166, 0xf97316],
  });
}

function ensureTrail(runtime: SparksRuntime, state: RawWebGL2RenderState): void {
  if (runtime.trail && runtime.trail.width === state.width && runtime.trail.height === state.height) return;
  runtime.trail?.destroy();
  runtime.trail = new RawPingPongRenderTarget(state.resources, {
    width: state.width,
    height: state.height,
    precision: 'half-float',
    filter: 'linear',
  });
  const gl = state.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, runtime.trail.read.framebuffer);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, runtime.trail.write.framebuffer);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function clearTrail(runtime: SparksRuntime): void {
  if (!runtime.trail) return;
  const gl = runtime.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, runtime.trail.read.framebuffer);
  gl.viewport(0, 0, runtime.trail.width, runtime.trail.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, runtime.trail.write.framebuffer);
  gl.viewport(0, 0, runtime.trail.width, runtime.trail.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function applyGestures(runtime: SparksRuntime, state: RawWebGL2RenderState, gestures: GestureEvent[], dt: number): void {
  if (runtime.mode === 'build') {
    const syntheticGestures = gestures.filter((gesture) => gesture.id === undefined || gesture.id < 0);
    applyBuildGestures(runtime, syntheticGestures, state.width, state.height);
    return;
  }
  const syntheticGestures = gestures.filter((gesture) => gesture.id === undefined || gesture.id < 0);
  for (const command of sparksInputCommandsForMode(runtime.mode, syntheticGestures, state.width, state.height)) {
    queueContactBurst(runtime, command.x, command.y, command.dx, command.dy, command.strength, command.burst, command.pattern);
    if (command.burst) {
      queueCoreFlashBurst(runtime, command.x, command.y, command.dx, command.dy, command.strength, Math.max(1, Math.round(runtime.settings.coreSpark.rate * 0.5)), 1.35);
    } else {
      runtime.coreFlashAccumulator = advanceCoreFlashAccumulator(runtime, command.x, command.y, command.dx, command.dy, command.strength, runtime.coreFlashAccumulator, dt);
    }
  }
}

function applyBuildGestures(runtime: SparksRuntime, gestures: readonly GestureEvent[], width: number, height: number): void {
  const radius = sparksBuildRadius(runtime);
  for (const gesture of gestures) {
    const fixture = runtime.buildController.applyGesture(gesture, width, height, radius);
    if (fixture) addBuildFixture(runtime, fixture, radius);
  }
}

function sparksBuildRadius(runtime: SparksRuntime): number {
  return clamp(runtime.settings.buildRadius, 10, 44);
}

export function sparksInputCommandsForMode(mode: string | null, gestures: readonly GestureEvent[], width: number, height: number): SparksInputCommand[] {
  const activeMode = sparksModeFromString(mode);
  const pattern = patternForMode(activeMode);
  const commands: SparksInputCommand[] = [];
  const doubleTapPointerIds = new Set<number>();
  for (const gesture of gestures) {
    if (gesture.kind === 'double_tap' && gesture.id !== undefined) doubleTapPointerIds.add(gesture.id);
  }
  for (const gesture of gestures) {
    if (gesture.kind === 'hold' || gesture.kind === 'release') continue;
    if (activeMode === 'build') continue;
    if (gesture.kind === 'tap' && gesture.id !== undefined && doubleTapPointerIds.has(gesture.id)) continue;
    const dx = gesture.dx ?? 0;
    const dy = gesture.dy ?? 0;
    const commandDx = pattern === 'shower' ? 0 : dx;
    const commandDy = pattern === 'shower' ? 0 : dy;
    if (gesture.kind === 'tap' || gesture.kind === 'double_tap') {
      commands.push({
        action: 'emit',
        x: clamp(gesture.x, 0, width),
        y: clamp(gesture.y, 0, height),
        dx: commandDx,
        dy: pattern === 'shower' ? 0 : commandDy - 40,
        strength: gesture.kind === 'double_tap' ? 1.45 : 1,
        burst: true,
        pattern,
      });
    } else if (gesture.kind === 'drag') {
      commands.push({
        action: 'emit',
        x: clamp(gesture.x + commandDx * 0.18, 0, width),
        y: clamp(gesture.y + commandDy * 0.1, 0, height),
        dx: commandDx,
        dy: commandDy,
        strength: gesture.strength ?? 1,
        burst: false,
        pattern,
      });
    } else if (gesture.kind === 'fast_swipe') {
      commands.push({
        action: 'emit',
        x: clamp(gesture.x + commandDx * 0.2, 0, width),
        y: clamp(gesture.y + commandDy * 0.14, 0, height),
        dx: commandDx,
        dy: commandDy,
        strength: 1.6,
        burst: true,
        pattern,
      });
    }
  }
  return commands;
}

function eventPoint(state: RawWebGL2RenderState, event: PointerEvent): { x: number; y: number } {
  const rect = state.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * state.width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * state.height,
  };
}

function shouldRenderRuntime(runtime: SparksRuntime): boolean {
  return runtime.contacts.size > 0 || runtime.queuedSpawns.length > 0 || runtime.coreFlashes.length > 0 || runtime.trailEnergy > 0.015 || runtime.mode === 'build';
}

function getRuntimeDebugStats(runtime: SparksRuntime, state: RawWebGL2RenderState): Record<string, string | number | boolean | null> {
  const stats = rawGpuMetricsToDebugStats(createRawGpuSimulationMetrics({
    engine: 'sparks-gpu-particles',
    stateWidth: runtime.particleState.width,
    stateHeight: runtime.particleState.height,
    stateTextures: 2,
    precision: runtime.particleState.precision,
    passesPerFrame: runtime.lastGpuPasses,
    cpuUploadBytesPerFrame: 0,
    capabilities: state.resources.capabilities,
  }));
  return {
    ...stats,
    rendering: runtime.settings.renderStyle === 'basic'
      ? 'gpu-point-sparks-basic'
      : runtime.settings.renderStyle === 'enhanced'
        ? 'gpu-swept-sparks-enhanced-direct'
        : 'gpu-point-sparks-ultra-trail-bloom',
      cpuTopology: 'torch-contact-scheduler-only',
    cpuUpload: runtime.buildSurfaces.length > 0,
    mode: runtime.mode,
    renderStyle: runtime.settings.renderStyle,
    simDepth: runtime.settings.simDepth,
    buildSurfaces: runtime.buildSurfaces.length,
    activeTorchContacts: runtime.contacts.size,
    queuedSpawnCommands: runtime.queuedSpawns.length,
    coreFlashes: runtime.coreFlashes.length,
    emittedSparks: runtime.emittedSparks,
    contactBursts: runtime.contactBursts,
  };
}

function sparksModeFromString(mode: string | null): SparksMode {
  if (mode === 'pinwheel' || mode === 'shower') return mode;
  if (mode === 'build') return mode;
  return 'welding';
}

function patternForMode(mode: SparksMode): SparksEmitterPattern {
  if (mode === 'pinwheel' || mode === 'shower') return mode;
  return 'welding';
}

function patternToSpawnNumber(pattern: SparksEmitterPattern): number {
  if (pattern === 'pinwheel') return 1;
  if (pattern === 'shower') return 2;
  return 0;
}

function renderStyleFromString(value: string): SparksRenderStyle {
  if (value === 'basic' || value === 'ultra') return value;
  return 'enhanced';
}

function simDepthFromString(value: string): number {
  if (value === 'deep') return 1;
  if (value === 'flat') return 0;
  return 0.55;
}

function nextRandom(runtime: SparksRuntime): number {
  runtime.rngState = (runtime.rngState + 0x6d2b79f5) | 0;
  let t = runtime.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function numberUniform(uniforms: Record<string, unknown>, key: string, fallback: number): number {
  const value = uniforms[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function writePalette(target: Float32Array, palette: readonly number[]): number {
  const count = Math.min(8, Math.max(1, palette.length));
  for (let index = 0; index < count; index += 1) {
    const color = palette[index] ?? 0xffffff;
    const offset = index * 3;
    target[offset] = ((color >> 16) & 255) / 255;
    target[offset + 1] = ((color >> 8) & 255) / 255;
    target[offset + 2] = (color & 255) / 255;
  }
  return count;
}

function colorNumberToTriplet(color: number): [number, number, number] {
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
