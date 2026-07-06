import {
  RawGpuParticleState,
  RawPingPongRenderTarget,
  RawWebGL2Scene,
  createRawGpuSimulationMetrics,
  linkRawWebGL2Program,
  rawGpuMetricsToDebugStats,
  type GestureEvent,
  type RawGpuSimulationMetrics,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';

const EARTH_TEXTURE_URL = new URL('./assets/earth-natural-1024.jpg', import.meta.url).href;
const MOON_TEXTURE_URL = new URL('./assets/moon-natural-512.jpg', import.meta.url).href;
const EARTH_PLACEHOLDER_PIXEL = new Uint8Array([38, 76, 112, 255]);
const MOON_PLACEHOLDER_PIXEL = new Uint8Array([138, 138, 132, 255]);

const MARKUP = `
  <div class="relative h-full w-full overflow-hidden bg-[#03040a]">
    <canvas class="h-full w-full touch-none" data-orbital-native-raw-canvas></canvas>
  </div>
`;

const QUAD_VERTEX_SHADER = `#version 300 es
  precision highp float;
  const vec2 POSITIONS[3] = vec2[3](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  out vec2 vUv;

  void main() {
    vec2 position = POSITIONS[gl_VertexID];
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const SIM_FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  in vec2 vUv;
  uniform sampler2D uPosition;
  uniform sampler2D uVelocity;
  uniform float uDt;
  uniform float uTime;
  uniform float uAspect;
  uniform float uGravity;
  uniform float uTangent;
  uniform float uDamping;
  uniform float uMaxSpeed;
  uniform float uBoundaryPull;
  uniform float uPlanetRadius;
  uniform float uPlanetBounce;
  uniform int uBodyCount;
  uniform float uBodyStrength;
  uniform float uBodyRadius;
  uniform float uBodySpeed;
  uniform int uAsteroidBodyCount;
  uniform vec4 uAsteroidBodies[8];
  uniform float uPointerActive;
  uniform vec2 uPointer;
  uniform vec2 uPointerVelocity;
  uniform float uSpawnActive;
  uniform vec2 uSpawnCenter;
  uniform vec2 uSpawnVelocity;
  uniform float uSpawnRadius;
  uniform float uSpawnVelocityScale;
  uniform float uSpawnJitter;
  uniform float uSpawnAsteroid;
  uniform float uInfluenceMode;
  uniform float uInfluenceCapture;
  uniform float uInfluenceRadius;
  uniform float uInfluenceStrength;
  uniform float uSwishForce;
  uniform float uWellForce;
  uniform float uWellRadius;
  uniform float uWellMode;
  uniform float uPointerVortex;
  uniform float uShockCount;
  uniform vec4 uShockwaves[8];

  layout(location = 0) out vec4 outPosition;
  layout(location = 1) out vec4 outVelocity;

  float diskLength(vec2 p) {
    return length(vec2(p.x / max(0.001, uAspect), p.y));
  }

  vec2 toDisk(vec2 p) {
    return vec2(p.x / max(0.001, uAspect), p.y);
  }

  vec2 fromDisk(vec2 p) {
    return vec2(p.x * uAspect, p.y);
  }

  vec2 diskNormalize(vec2 p) {
    vec2 disk = toDisk(p);
    float len = max(0.0001, length(disk));
    return fromDisk(disk / len);
  }

  float hash(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
  }

  float hash1(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
  }

  void main() {
    vec4 p4 = texture(uPosition, vUv);
    vec4 v4 = texture(uVelocity, vUv);
    vec2 position = p4.xy;
    vec2 velocity = v4.xy;
    float seed = p4.z;
    float type = p4.w;
    float hue = v4.z;
    float captured = v4.w;

    if (uSpawnActive > 0.0) {
      float pick = hash(seed + uTime * 0.173);
      if (pick < uSpawnActive) {
        float a = hash(seed + 17.0) * 6.2831853;
        float r = sqrt(hash(seed + 41.0)) * mix(uSpawnRadius, 0.018, uSpawnAsteroid);
        vec2 burst = vec2(cos(a) * uAspect, sin(a)) * r;
        position = uSpawnCenter + burst;
        float spawnRadius = max(0.035, diskLength(position));
        float planetDistance = length(position);
        if (planetDistance < uPlanetRadius + 0.045) {
          position = normalize(position + vec2(0.0001, 0.0)) * (uPlanetRadius + 0.045);
          spawnRadius = max(0.035, diskLength(position));
        }
        if (uSpawnAsteroid > 0.5 && spawnRadius > 0.98) {
          vec2 spawnDisk = toDisk(position);
          float safeRadius = clamp(length(spawnDisk), uPlanetRadius + 0.045, 0.98);
          position = fromDisk(normalize(spawnDisk + vec2(0.0001, 0.0)) * safeRadius);
          spawnRadius = safeRadius;
        }
        if (uSpawnAsteroid > 0.5 && length(position) < uPlanetRadius + 0.025) {
          position = normalize(position + vec2(0.0001, 0.0)) * (uPlanetRadius + 0.025);
          spawnRadius = max(0.035, diskLength(position));
        }
        vec2 radial = diskNormalize(position);
        vec2 orbital = vec2(-radial.y * uAspect, radial.x / max(0.001, uAspect));
        if (length(uSpawnVelocity) > 0.001 && dot(uSpawnVelocity, orbital) < 0.0) {
          orbital *= -1.0;
        }
        float orbitalSpeed = sqrt((uGravity / (spawnRadius * spawnRadius + 0.075)) * spawnRadius);
        float spread = 0.05 + hash(seed + 79.0) * 0.16;
        if (uSpawnAsteroid > 0.5) {
          velocity = uSpawnVelocity + normalize(burst + vec2(0.0001)) * spread * 0.12;
          type = 1.0;
        } else {
          vec2 inheritedVelocity = uSpawnVelocity;
          float inheritedSpeed = length(inheritedVelocity);
          float inheritedLimit = max(0.0, uSpawnVelocityScale);
          if (inheritedSpeed > inheritedLimit && inheritedSpeed > 0.0001) {
            inheritedVelocity *= inheritedLimit / inheritedSpeed;
          }
          velocity = orbital * orbitalSpeed
            + inheritedVelocity * 0.04
            + normalize(burst + vec2(0.0001)) * spread * max(0.002, min(0.045, uSpawnVelocityScale * 0.055))
            + vec2(cos(seed * 371.17 + uTime * 0.13), sin(seed * 619.73 + uTime * 0.17)) * uSpawnJitter;
          float spawnSpeed = length(velocity);
          float stableLimit = orbitalSpeed * (1.0 + max(0.0, uSpawnVelocityScale) * 0.22);
          float spawnLimit = max(orbitalSpeed * 1.02, min(max(uMaxSpeed, orbitalSpeed * 1.12), stableLimit));
          if (spawnSpeed > spawnLimit && spawnSpeed > 0.0001) {
            velocity *= spawnLimit / spawnSpeed;
          }
          type = mix(0.15, 0.9, hash(seed + 211.0));
        }
        hue = seed + hash(seed + 113.0) * 0.2;
        captured = 0.0;
      }
    }

    if (type < -0.5) {
      outPosition = vec4(position, seed, type);
      outVelocity = vec4(vec2(0.0), hue, 0.0);
      return;
    }

    float radius = max(0.025, diskLength(position));
    vec2 inward = -diskNormalize(position);
    vec2 tangent = vec2(inward.y * uAspect, -inward.x / max(0.001, uAspect));
    vec2 acceleration = inward * (uGravity / (radius * radius + 0.075));
    acceleration += tangent * uTangent * 0.06 / (radius + 0.16);

    for (int i = 0; i < 8; i++) {
      if (i >= uBodyCount) break;
      float bodySeed = float(i) + 1.0;
      float xScale = 1.0 + hash(bodySeed * 31.7) * 0.28;
      float yScale = 1.0 + hash(bodySeed * 47.3) * 0.36;
      float maxScale = max(xScale, yScale);
      float minOrbit = uPlanetRadius + 0.13;
      float maxOrbit = max(minOrbit + 0.05, uBodyRadius);
      float lane = min(mix(minOrbit, maxOrbit, hash(bodySeed * 19.17)), 1.0 / maxScale);
      float direction = hash(bodySeed * 59.9) > 0.5 ? 1.0 : -1.0;
      float phase = uTime * uBodySpeed * direction * (0.55 + hash(bodySeed * 71.1) * 0.85)
        + float(i) * 2.39996323
        + hash(bodySeed * 83.2) * 6.2831853;
      vec2 body = fromDisk(vec2(cos(phase) * lane * xScale, sin(phase) * lane * yScale));
      vec2 delta = body - position;
      float bodyDistance = max(0.035, diskLength(delta));
      acceleration += diskNormalize(delta) * (uBodyStrength / (bodyDistance * bodyDistance + 0.06));
    }

    for (int i = 0; i < 8; i++) {
      if (i >= uAsteroidBodyCount) break;
      vec4 asteroid = uAsteroidBodies[i];
      vec2 delta = asteroid.xy - position;
      float asteroidDistance = max(asteroid.w, diskLength(delta));
      acceleration += diskNormalize(delta) * (asteroid.z / (asteroidDistance * asteroidDistance + 0.012));
    }

    if (uPointerActive <= 0.0) {
      captured = 0.0;
    }

    if (uPointerActive > 0.0 && uInfluenceMode > 0.5) {
      vec2 delta = uPointer - position;
      float pointerDistance = diskLength(delta);
      float falloff = smoothstep(uInfluenceRadius, 0.0, pointerDistance);
      acceleration -= uPointerVelocity * uInfluenceStrength * falloff;
    }

    if (uPointerActive > 0.0 && uWellMode > 0.5) {
      vec2 delta = uPointer - position;
      float pointerDistance = max(0.02, diskLength(delta));
      float falloff = smoothstep(uWellRadius, 0.0, pointerDistance);
      acceleration += diskNormalize(delta) * uWellForce * falloff * uPointerActive;
    }

    for (int i = 0; i < 8; i++) {
      if (float(i) >= uShockCount) break;
      vec4 shock = uShockwaves[i];
      vec2 delta = position - shock.xy;
      float shockDistance = diskLength(delta);
      float pulse = exp(-pow((shockDistance - shock.z) / 0.045, 2.0)) * shock.w;
      acceleration += diskNormalize(delta) * pulse;
    }

    if (radius > 1.04) {
      acceleration += inward * (radius - 1.04) * uBoundaryPull;
    }

    velocity += acceleration * uDt;
    velocity *= pow(uDamping, uDt * 60.0);

    float speed = length(velocity);
    float localStableSpeed = sqrt((uGravity / (radius * radius + 0.075)) * radius);
    float orbitalSpeedLimit = max(uMaxSpeed, localStableSpeed * (1.28 + max(0.0, type) * 0.22) + 0.05);
    if (speed > orbitalSpeedLimit && speed > 0.0001) {
      velocity *= orbitalSpeedLimit / speed;
      speed = orbitalSpeedLimit;
    }

    position += velocity * uDt;
    if (length(position) < uPlanetRadius) {
      float planetDistance = max(0.0001, length(position));
      position = position / planetDistance * max(0.0, uPlanetRadius - 0.004);
      velocity = vec2(0.0);
      type = -1.0;
      captured = 0.0;
    }
    hue = mix(hue, hue + speed * 0.006, 0.18);

    outPosition = vec4(position, seed, type);
    outVelocity = vec4(velocity, hue, captured);
  }
`;

const FADE_FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  in vec2 vUv;
  uniform sampler2D uTrail;
  uniform vec2 uTexel;
  uniform float uPersistence;
  uniform float uBlur;
  uniform float uTime;
  out vec4 outColor;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float hash1(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
  }

  void main() {
    vec4 center = texture(uTrail, vUv);
    vec4 n = texture(uTrail, vUv + vec2(0.0, uTexel.y));
    vec4 s = texture(uTrail, vUv - vec2(0.0, uTexel.y));
    vec4 e = texture(uTrail, vUv + vec2(uTexel.x, 0.0));
    vec4 w = texture(uTrail, vUv - vec2(uTexel.x, 0.0));
    vec4 blurred = (center * 4.0 + n + s + e + w) * 0.125;
    vec4 color = mix(center, blurred, uBlur) * uPersistence;
    color.rgb *= 0.996 + hash(vUv + uTime * 0.003) * 0.002;
    outColor = color;
  }
`;

const PARTICLE_VERTEX_SHADER = `#version 300 es
  precision highp float;
  precision highp sampler2D;

  uniform sampler2D uPosition;
  uniform sampler2D uVelocity;
  uniform int uTextureSize;
  uniform float uAspect;
  uniform float uPointSize;
  uniform float uSpeedSize;
  uniform int uMotionBlurPass;
  uniform int uMotionBlurCount;
  uniform float uStreakLength;
  uniform float uParticleAlpha;
  uniform float uParticleBrightness;
  uniform float uTime;
  uniform int uStyle;
  out vec3 vColor;
  out float vAlpha;
  out float vSeed;
  out float vSpeed;
  out float vType;

  vec3 palette(float h, int style) {
    h = fract(h);
    vec3 a;
    vec3 b;
    vec3 c;
    vec3 d;
    if (style == 1) {
      a = vec3(1.00, 0.33, 0.05);
      b = vec3(1.00, 0.76, 0.16);
      c = vec3(1.00, 0.12, 0.02);
      d = vec3(0.35, 0.06, 0.01);
    } else if (style == 2) {
      a = vec3(0.46, 0.36, 1.00);
      b = vec3(0.08, 0.92, 1.00);
      c = vec3(1.00, 0.18, 0.82);
      d = vec3(0.05, 0.08, 0.16);
    } else if (style == 3) {
      a = vec3(1.25, 1.18, 1.03);
      b = vec3(0.92, 0.86, 0.76);
      c = vec3(0.72, 0.66, 0.58);
      d = vec3(0.18, 0.14, 0.10);
    } else if (style == 4) {
      a = vec3(0.08, 1.00, 0.36);
      b = vec3(0.55, 1.00, 0.00);
      c = vec3(0.02, 0.95, 1.00);
      d = vec3(0.85, 1.00, 0.18);
    } else if (style == 5) {
      a = vec3(1.00, 0.08, 0.18);
      b = vec3(1.00, 0.38, 0.16);
      c = vec3(0.78, 0.02, 0.16);
      d = vec3(0.22, 0.02, 0.05);
    } else if (style == 6) {
      a = vec3(0.26, 0.52, 0.82);
      b = vec3(0.34, 0.70, 0.48);
      c = vec3(0.78, 0.84, 0.88);
      d = vec3(0.10, 0.16, 0.24);
    } else {
      a = vec3(0.60, 0.92, 1.00);
      b = vec3(0.34, 0.58, 1.00);
      c = vec3(0.95, 0.98, 1.00);
      d = vec3(0.18, 0.32, 0.65);
    }
    return a * (0.45 + 0.55 * cos(6.28318 * (h + 0.00)))
         + b * (0.45 + 0.55 * cos(6.28318 * (h + 0.22)))
         + c * (0.38 + 0.62 * cos(6.28318 * (h + 0.47)))
         + d * 0.25;
  }

  void main() {
    int index = gl_VertexID;
    int x = index - (index / uTextureSize) * uTextureSize;
    int y = index / uTextureSize;
    ivec2 coord = ivec2(x, y);
    vec4 p4 = texelFetch(uPosition, coord, 0);
    vec4 v4 = texelFetch(uVelocity, coord, 0);
    vec2 position = p4.xy;
    vec2 velocity = v4.xy;
    if (uMotionBlurCount > 1) {
      float shutter = float(uMotionBlurPass) / max(float(uMotionBlurCount - 1), 1.0);
      position -= velocity * shutter * uStreakLength * 0.055;
    }
    float seed = p4.z;
    float type = p4.w;
    float hue = v4.z;
    float speed = length(velocity);
    if (type < -0.5) {
      gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
      gl_PointSize = 0.0;
      vColor = vec3(0.0);
      vAlpha = 0.0;
      vSeed = seed;
      vSpeed = 0.0;
      vType = type;
      return;
    }
    gl_Position = vec4(position.x / max(0.001, uAspect), position.y, 0.0, 1.0);
    float typeScale = mix(0.72, 1.75, type);
    float speedScale = 1.0 + smoothstep(0.08, 1.2, speed) * uSpeedSize;
    gl_PointSize = uPointSize * typeScale * speedScale;
    vColor = clamp(palette(hue + speed * 0.08 + seed * 0.03, uStyle), vec3(0.0), vec3(2.2)) * uParticleBrightness;
    float sampleNorm = 1.0 / sqrt(max(float(uMotionBlurCount), 1.0));
    vAlpha = (0.045 + type * 0.045 + smoothstep(0.05, 1.2, speed) * 0.06) * uParticleAlpha * sampleNorm;
    vSeed = seed;
    vSpeed = speed;
    vType = type;
  }
`;

const PARTICLE_FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  in vec3 vColor;
  in float vAlpha;
  in float vSeed;
  in float vSpeed;
  in float vType;
  out vec4 outColor;

  uniform float uTime;
  uniform int uShape;
  uniform int uInkLive;

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float hardTriangleMask(vec2 p) {
    const float k = 1.7320508;
    p.y -= 0.12;
    float m = max(abs(p.x) * k + p.y, -2.0 * p.y);
    return step(m, 0.58);
  }

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float angle = vSeed * 6.2831853 + uTime * (0.25 + vType * 0.32);
    p = rot(angle) * p;
    float radius = length(p);
    float alpha = 0.0;
    if (uShape == 1) {
      alpha = smoothstep(1.0, 0.08, radius);
      alpha *= exp(-radius * radius * 1.2);
    } else if (uShape == 2) {
      float cross = exp(-abs(p.x) * 9.0) + exp(-abs(p.y) * 9.0);
      float core = smoothstep(1.0, 0.0, radius);
      alpha = cross * core * 0.58;
    } else if (uShape == 3) {
      alpha = hardTriangleMask(p);
    } else {
      float a = atan(p.y, p.x);
      float triBoundary = 0.54 + 0.22 * cos(a * 3.0);
      float shard = smoothstep(triBoundary, triBoundary - 0.095, radius);
      float core = smoothstep(0.86, 0.1, radius);
      alpha = shard * core;
    }
    alpha *= vAlpha;
    vec3 inkColor = vec3(0.0);
    vec3 color = (uInkLive == 1 ? inkColor : vColor) * alpha * (1.0 + smoothstep(0.1, 1.4, vSpeed) * 1.7);
    outColor = vec4(color, alpha);
  }
`;

const DISPLAY_FRAGMENT_SHADER = `#version 300 es
  precision highp float;
  precision highp sampler2D;

  in vec2 vUv;
  uniform sampler2D uTrail;
  uniform sampler2D uEarthTexture;
  uniform sampler2D uMoonTexture;
  uniform vec2 uResolution;
  uniform vec2 uTexel;
  uniform float uAspect;
  uniform float uTime;
  uniform float uGlow;
  uniform float uExposure;
  uniform float uChroma;
  uniform float uStars;
  uniform float uStarFieldOpacity;
  uniform int uBloomSamples;
  uniform float uBloomRadius;
  uniform int uStyle;
  uniform int uBodyCount;
  uniform float uBodyStrength;
  uniform float uBodyRadius;
  uniform float uBodySpeed;
  uniform float uPlanetRadius;
  uniform float uInfluenceVisual;
  uniform vec2 uInfluencePointer;
  uniform float uInfluenceRadius;
  uniform float uWellVisual;
  uniform vec2 uWellPointer;
  uniform float uWellRadius;
  uniform float uAsteroidAimVisual;
  uniform vec2 uAsteroidAimStart;
  uniform vec2 uAsteroidAimEnd;
  uniform int uAsteroidBodyCount;
  uniform vec4 uAsteroidBodies[8];
  uniform float uShockCount;
  uniform vec4 uShockwaves[8];
  out vec4 outColor;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float hash1(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.52;
    mat2 m = mat2(1.62, 1.21, -1.21, 1.62);
    for (int i = 0; i < 5; i++) {
      v += noise(p) * a;
      p = m * p + vec2(13.7, 4.2);
      a *= 0.52;
    }
    return v;
  }

  float starPointLayer(vec2 uv, float scale, float threshold, float radiusScale) {
    vec2 largeWarp = vec2(
      fbm(uv * 2.9 + vec2(11.7, 4.2)),
      fbm(uv * 3.4 + vec2(37.1, 19.8))
    ) - 0.5;
    vec2 fineWarp = vec2(
      fbm(uv * 13.0 + vec2(5.4, 71.2)),
      fbm(uv * 17.0 + vec2(43.8, 2.6))
    ) - 0.5;
    vec2 warpedUv = uv + largeWarp * 0.18 + fineWarp * 0.035;
    vec2 p = warpedUv * uResolution * scale;
    vec2 cell = floor(p);
    float seed = hash(cell);
    vec2 starOffset = vec2(hash(cell + 11.7), hash(cell + 41.3)) - 0.5;
    vec2 local = fract(p) - 0.5 - starOffset * 0.96;
    float clusterA = smoothstep(0.28, 0.88, fbm(warpedUv * 5.6 + vec2(2.1, 9.7)));
    float clusterB = smoothstep(0.42, 0.94, fbm(warpedUv * 11.5 + largeWarp * 3.2 + vec2(22.4, 6.1)));
    float voids = smoothstep(0.34, 0.78, fbm(warpedUv * 2.2 + vec2(31.4, 6.6)));
    float filament = smoothstep(0.74, 0.18, abs(warpedUv.y - 0.5 + sin(warpedUv.x * 7.7 + largeWarp.x * 5.0) * 0.12));
    float cellChaos = mix(0.36, 1.35, fbm(cell * 0.11 + vec2(7.8, 13.1)));
    float density = clamp(clusterA * 0.78 + clusterB * 0.55 + filament * 0.52, 0.0, 1.55);
    density = density * mix(0.035, 1.0, voids) * cellChaos;
    float gateThreshold = clamp(threshold + 0.09 - density * 0.24, 0.52, 0.995);
    float gate = smoothstep(gateThreshold, 1.0, seed);
    float radius = radiusScale * mix(0.035, 0.21, pow(hash(cell + 17.31), 3.4));
    float core = exp(-dot(local, local) / max(0.0009, radius * radius));
    return core * gate;
  }

  vec3 proceduralStarField(vec2 uv) {
    float fine = starPointLayer(uv + vec2(19.13, 4.71), 0.72, 0.965, 1.0);
    float medium = starPointLayer(uv + vec2(5.37, 31.91), 0.42, 0.975, 1.35);
    float bright = starPointLayer(uv + vec2(47.1, 2.9), 0.24, 0.989, 1.75);
    float stars = fine * 0.95 + medium * 1.35 + bright * 2.4;
    float colorSeed = fbm(uv * 15.0 + 4.0);
    vec3 cool = vec3(0.82, 0.88, 1.0);
    vec3 warm = vec3(1.0, 0.92, 0.78);
    vec3 tint = mix(cool, warm, smoothstep(0.22, 0.92, colorSeed));
    if (uStyle == 3) {
      vec3 ink = mix(vec3(2.8, 2.35, 1.75), vec3(7.5, 6.8, 5.6), smoothstep(0.18, 0.9, colorSeed));
      return -ink * pow(min(stars, 3.0), 0.72);
    }
    return tint * min(stars, 3.0);
  }

  vec3 styleColor(float t) {
    if (uStyle == 1) {
      return mix(vec3(1.0, 0.26, 0.04), vec3(1.0, 0.78, 0.18), t);
    }
    if (uStyle == 2) {
      return mix(vec3(0.16, 0.10, 0.50), vec3(0.05, 0.92, 1.0), t);
    }
    if (uStyle == 3) {
      return mix(vec3(0.08, 0.065, 0.045), vec3(0.58, 0.50, 0.40), t);
    }
    if (uStyle == 4) {
      return mix(vec3(0.0, 0.42, 0.16), vec3(0.72, 1.0, 0.08), t);
    }
    if (uStyle == 5) {
      return mix(vec3(0.42, 0.02, 0.08), vec3(1.0, 0.42, 0.22), t);
    }
    if (uStyle == 6) {
      return mix(vec3(0.08, 0.18, 0.30), vec3(0.72, 0.88, 1.0), t);
    }
    return mix(vec3(0.35, 0.68, 1.0), vec3(0.94, 0.99, 1.0), t);
  }

  float diskRadius(vec2 p) {
    return length(vec2(p.x / max(0.001, uAspect), p.y));
  }

  void main() {
    vec2 uv = vUv;
    vec2 screen = uv * 2.0 - 1.0;
    vec2 world = vec2(screen.x * uAspect, screen.y);
    float r = length(world);
    vec2 chromaDir = normalize(uv - 0.5 + vec2(0.0001));
    vec3 trail;
    trail.r = texture(uTrail, uv + chromaDir * uChroma).r;
    trail.g = texture(uTrail, uv).g;
    trail.b = texture(uTrail, uv - chromaDir * uChroma).b;
    vec3 bloom = vec3(0.0);
    int samples = min(uBloomSamples, 48);
    for (int i = 0; i < 48; i++) {
      if (i >= samples) break;
      float fi = float(i);
      float a = fi * 2.39996323;
      float radius = sqrt(fi + 1.0) * uBloomRadius;
      vec2 offset = vec2(cos(a), sin(a)) * uTexel * radius;
      bloom += texture(uTrail, uv + offset).rgb;
    }
    if (samples > 0) bloom *= (0.80 * uGlow) / float(samples);
    vec3 bg = uStyle == 3 ? vec3(3.3, 3.15, 2.88) : vec3(0.008, 0.012, 0.030);
    bg += styleColor(0.1) * exp(-r * 2.8) * (uStyle == 3 ? 0.015 : 0.05);
    float starHash = hash(floor(uv * uResolution * 0.42));
    float stars = smoothstep(1.0 - 0.0035 * uStars, 1.0, starHash);
    bg += stars * (uStyle == 3 ? vec3(0.18, 0.14, 0.10) : vec3(0.35, 0.58, 0.9)) * (uStyle == 3 ? 0.045 : 0.25 + hash(uv * 77.0) * 0.75);
    vec3 ambientStars = proceduralStarField(uv);
    if (uStyle == 3) {
      float inkStars = min(1.0, length(ambientStars) * 0.55);
      bg = mix(bg, vec3(0.055, 0.042, 0.028), inkStars * uStarFieldOpacity);
    } else {
      vec3 starTint = mix(styleColor(0.95), vec3(1.0), 0.42);
      bg += ambientStars * starTint * uStarFieldOpacity * 2.6;
    }
    float disk = exp(-abs(world.y + sin(world.x * 2.0 + uTime * 0.08) * 0.018) * 17.0)
               * smoothstep(1.35, 0.18, abs(world.x));
    bg += styleColor(0.65) * disk * (uStyle == 3 ? 0.012 : 0.03);
    vec3 color = uStyle == 3
      ? bg - trail * (2.2 + uGlow * 0.95) - bloom * 0.65
      : bg + trail * (1.15 + uGlow * 0.55) + bloom;
    vec3 light = normalize(vec3(-0.48, 0.38, 0.78));
    for (int i = 0; i < 8; i++) {
      if (i >= uBodyCount) break;
      float bodySeed = float(i) + 1.0;
      float xScale = 1.0 + hash1(bodySeed * 31.7) * 0.28;
      float yScale = 1.0 + hash1(bodySeed * 47.3) * 0.36;
      float maxScale = max(xScale, yScale);
      float minOrbit = uPlanetRadius + 0.13;
      float maxOrbit = max(minOrbit + 0.05, uBodyRadius);
      float lane = min(mix(minOrbit, maxOrbit, hash1(bodySeed * 19.17)), 1.0 / maxScale);
      float direction = hash1(bodySeed * 59.9) > 0.5 ? 1.0 : -1.0;
      float phase = uTime * uBodySpeed * direction * (0.55 + hash1(bodySeed * 71.1) * 0.85)
      + float(i) * 2.39996323
        + hash1(bodySeed * 83.2) * 6.2831853;
      vec2 body = vec2(cos(phase) * lane * xScale * uAspect, sin(phase) * lane * yScale);
      vec2 delta = world - body;
      float d = length(delta);
      if (uStyle == 6) {
        float moonRadius = 0.018 + hash1(bodySeed * 103.3) * 0.016;
        vec2 moonLocal = delta / moonRadius;
        float moonDistance = length(moonLocal);
        float moonMask = smoothstep(1.0, 0.92, moonDistance);
        if (moonMask > 0.0) {
          float moonZ = sqrt(max(0.0, 1.0 - dot(moonLocal, moonLocal)));
          vec3 moonN = normalize(vec3(moonLocal, moonZ));
          float moonTilt = mix(-0.85, 0.85, hash1(bodySeed * 137.7));
          float moonSpin = hash1(bodySeed * 151.9) * 6.2831853 + uTime * mix(-0.026, 0.026, hash1(bodySeed * 173.5));
          vec3 tiltedMoon = normalize(vec3(
            moonN.x,
            moonN.y * cos(moonTilt) - moonN.z * sin(moonTilt),
            moonN.y * sin(moonTilt) + moonN.z * cos(moonTilt)
          ));
          vec3 moonSphere = vec3(
            tiltedMoon.x * cos(moonSpin) + tiltedMoon.z * sin(moonSpin),
            tiltedMoon.y,
            -tiltedMoon.x * sin(moonSpin) + tiltedMoon.z * cos(moonSpin)
          );
          vec2 moonUv = vec2(fract(atan(moonSphere.z, moonSphere.x) / 6.2831853 + 0.5), acos(clamp(moonSphere.y, -1.0, 1.0)) / 3.14159265);
          vec3 moonTexture = texture(uMoonTexture, moonUv).rgb;
          float moonDiff = max(dot(moonN, light), 0.0);
          float moonShade = mix(0.08, 0.92, smoothstep(-0.08, 0.62, moonDiff));
          float moonRim = pow(1.0 - moonZ, 2.0);
          vec3 moonColor = moonTexture * moonShade + vec3(0.22, 0.30, 0.42) * moonRim * 0.035;
          color = mix(color, moonColor, moonMask);
        }
      } else {
        float halo = exp(-pow(d / 0.045, 2.0)) * uBodyStrength;
        float core = smoothstep(0.014, 0.003, d);
        color += styleColor(0.85) * halo * 0.18;
        color = mix(color, styleColor(1.0), core * 0.62);
      }
    }
    if (uStyle == 6 && uPlanetRadius > 0.0001) {
      float outerAtmosphere = exp(-pow(max(0.0, r - uPlanetRadius) / 0.032, 2.0))
        * smoothstep(uPlanetRadius - 0.004, uPlanetRadius + 0.028, r)
        * smoothstep(uPlanetRadius + 0.092, uPlanetRadius + 0.018, r);
      color += vec3(0.18, 0.42, 0.95) * outerAtmosphere * 0.24;
    }
    if (uPlanetRadius > 0.0001 && r < uPlanetRadius) {
      vec2 nxy = world / uPlanetRadius;
      float nz = sqrt(max(0.0, 1.0 - dot(nxy, nxy)));
      vec3 n = normalize(vec3(nxy, nz));
      float diff = max(dot(n, light), 0.0);
      float rim = pow(1.0 - nz, 2.2);
      vec3 planet;
      if (uStyle == 6) {
        float tilt = 0.19;
        float spin = uTime * 0.055;
        vec3 tilted = normalize(vec3(n.x, n.y * cos(tilt) - n.z * sin(tilt), n.y * sin(tilt) + n.z * cos(tilt)));
        vec3 sphere = vec3(
          tilted.x * cos(spin) + tilted.z * sin(spin),
          tilted.y,
          -tilted.x * sin(spin) + tilted.z * cos(spin)
        );
        vec2 earthUv = vec2(fract(atan(sphere.z, sphere.x) / 6.2831853 + 0.5), acos(clamp(sphere.y, -1.0, 1.0)) / 3.14159265);
        vec3 earth = texture(uEarthTexture, earthUv).rgb;
        float night = smoothstep(-0.06, 0.54, diff);
        float shade = mix(0.055, 0.96, night);
        float terminator = smoothstep(0.0, 0.32, diff);
        planet = earth * shade * (0.78 + terminator * 0.30);
        planet += vec3(0.32, 0.56, 0.92) * rim * 0.16;
      } else {
        planet = uStyle == 1
          ? mix(vec3(0.16, 0.045, 0.012), vec3(1.0, 0.36, 0.06), diff)
          : uStyle == 2
            ? mix(vec3(0.004, 0.004, 0.010), vec3(0.14, 0.08, 0.28), diff)
            : uStyle == 3
              ? mix(vec3(0.84, 0.78, 0.66), vec3(0.20, 0.16, 0.12), diff)
              : uStyle == 4
                ? mix(vec3(0.0, 0.11, 0.055), vec3(0.35, 1.0, 0.18), diff)
                : uStyle == 5
                  ? mix(vec3(0.12, 0.004, 0.01), vec3(0.78, 0.05, 0.12), diff)
                  : mix(vec3(0.035, 0.07, 0.13), vec3(0.58, 0.88, 1.0), diff);
        planet += styleColor(1.0) * rim * 0.25;
      }
      color = mix(color, planet, smoothstep(uPlanetRadius, uPlanetRadius - 0.006, r));
    }
    if (uInfluenceVisual > 0.0) {
      vec2 pointerDelta = world - uInfluencePointer;
      float d = length(pointerDelta);
      float feather = max(0.006, uInfluenceRadius * 0.055);
      float disk = 1.0 - smoothstep(uInfluenceRadius - feather, uInfluenceRadius, d);
      color = mix(color, vec3(0.78, 0.88, 1.0), disk * uInfluenceVisual * 0.22);
    }
    if (uWellVisual > 0.0) {
      vec2 wellDelta = world - uWellPointer;
      float d = length(wellDelta);
      float angle = atan(wellDelta.y, wellDelta.x);
      float ringWidth = max(0.0035, uWellRadius * 0.018);
      float ring = exp(-pow((d - uWellRadius) / ringWidth, 2.0));
      float dots = smoothstep(0.42, 0.9, sin(angle * 42.0 + uTime * 0.08) * 0.5 + 0.5);
      float ticks = smoothstep(0.82, 1.0, sin(angle * 12.0) * 0.5 + 0.5);
      float center = exp(-pow(d / max(0.006, uWellRadius * 0.045), 2.0));
      vec3 wellColor = uStyle == 3 ? vec3(0.14, 0.11, 0.08) : vec3(1.0, 0.72, 0.32);
      color += wellColor * ring * (dots * 0.18 + ticks * 0.08) * uWellVisual;
      color += wellColor * center * 0.08 * uWellVisual;
    }
    if (uAsteroidAimVisual > 0.0) {
      vec2 aim = uAsteroidAimEnd - uAsteroidAimStart;
      float aimLen2 = max(0.0001, dot(aim, aim));
      float h = clamp(dot(world - uAsteroidAimStart, aim) / aimLen2, 0.0, 1.0);
      vec2 closest = uAsteroidAimStart + aim * h;
      float lineDistance = length(world - closest);
      float startDistance = length(world - uAsteroidAimStart);
      float endDistance = length(world - uAsteroidAimEnd);
      float line = exp(-pow(lineDistance / 0.012, 2.0));
      float startRing = exp(-pow((startDistance - 0.028) / 0.009, 2.0));
      float endRing = exp(-pow((endDistance - 0.044) / 0.011, 2.0));
      color += styleColor(1.0) * uAsteroidAimVisual * (line * 0.55 + startRing * 0.35 + endRing * 0.7);
    }
    for (int i = 0; i < 8; i++) {
      if (i >= uAsteroidBodyCount) break;
      vec4 asteroid = uAsteroidBodies[i];
      float d = length(world - asteroid.xy);
      float body = 1.0 - smoothstep(asteroid.w - 0.0035, asteroid.w, d);
      float shade = 1.0 - smoothstep(asteroid.w * 0.18, asteroid.w, d);
      vec3 asteroidColor = mix(vec3(0.72, 0.36, 0.18), vec3(1.0, 0.74, 0.36), shade * 0.55);
      color = mix(color, asteroidColor, body);
    }
    for (int i = 0; i < 8; i++) {
      if (float(i) >= uShockCount) break;
      vec4 s = uShockwaves[i];
      float d = length(world - s.xy);
      float wave = exp(-pow((d - s.z) / 0.018, 2.0)) * s.w;
      color += styleColor(0.9) * wave * 0.45;
    }
    color = 1.0 - exp(-color * uExposure);
    color = pow(max(color, vec3(0.0)), vec3(0.92));
    outColor = vec4(color, 1.0);
  }
`;

interface Shockwave {
  x: number;
  y: number;
  strength: number;
  radius: number;
  speed: number;
  life: number;
}

interface PointerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  spawn: number;
  capture: number;
  asteroid: number;
}

interface AddEmitterState {
  id: number;
  active: boolean;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
}

interface InteractionFieldState {
  id: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lastTime: number;
}

type OrbitalInputMode = 'add' | 'interact' | 'well' | 'asteroid' | 'demo';

function orbitalInputModeFromString(mode: string): OrbitalInputMode | null {
  if (mode === 'influence') return 'interact';
  if (mode === 'add' || mode === 'interact' || mode === 'well' || mode === 'asteroid' || mode === 'demo') return mode;
  return null;
}

interface AsteroidAimState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  ttl: number;
  active: boolean;
}

interface AsteroidBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  strength: number;
}

interface PendingAsteroidRelease {
  id: number;
  x: number;
  y: number;
}

interface NativeOrbitalRuntime {
  simProgram: WebGLProgram;
  fadeProgram: WebGLProgram;
  particleProgram: WebGLProgram;
  displayProgram: WebGLProgram;
  earthTexture: WebGLTexture;
  moonTexture: WebGLTexture;
  quadVao: WebGLVertexArrayObject;
  particleVao: WebGLVertexArrayObject;
  particleState: RawGpuParticleState;
  trail: RawPingPongRenderTarget;
  simSize: number;
  particleCount: number;
  trailWidth: number;
  trailHeight: number;
  width: number;
  height: number;
  inputWidth: number;
  inputHeight: number;
  settingsKey: string;
  styleId: string;
  mode: OrbitalInputMode;
  pointer: PointerState;
  addEmitter: AddEmitterState | null;
  interactionField: InteractionFieldState | null;
  lastAddPoint: { x: number; y: number } | null;
  asteroidAim: AsteroidAimState | null;
  asteroidDrag: { id: number; startX: number; startY: number } | null;
  wellPointerId: number | null;
  pendingAsteroidReleases: PendingAsteroidRelease[];
  asteroids: AsteroidBody[];
  shocks: Shockwave[];
  asteroidUniformData: Float32Array;
  shockUniformData: Float32Array;
  uniformLocations: Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>;
  cleanup: Array<() => void>;
  gpuMetrics: RawGpuSimulationMetrics;
  frame: number;
  timeSeconds: number;
}

interface NativeOrbitalSettings {
  particleCount: number;
  simSize: number;
  trailWidth: number;
  gravity: number;
  tangent: number;
  damping: number;
  maxSpeed: number;
  boundaryPull: number;
  planetRadius: number;
  planetBounce: number;
  trailPersistence: number;
  trailBlur: number;
  pointSize: number;
  speedSize: number;
  trailAlpha: number;
  liveAlpha: number;
  particleBrightness: number;
  debrisOpacity: number;
  glow: number;
  exposure: number;
  chroma: number;
  stars: number;
  starFieldOpacity: number;
  bloomSamples: number;
  bloomRadius: number;
  bodyCount: number;
  bodyStrength: number;
  bodyRadius: number;
  bodySpeed: number;
  swish: number;
  well: number;
  wellRadius: number;
  pointerVortex: number;
  shockStrength: number;
  addDebrisVolume: number;
  addRadius: number;
  addDebrisVelocity: number;
  addJitter: number;
  interactionRadius: number;
  interactionStrength: number;
  motionBlurSamples: number;
  streakLength: number;
}

function numeric(settings: Record<string, unknown>, key: string, fallback: number): number {
  const value = settings[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function boolSetting(settings: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = settings[key];
  return typeof value === 'boolean' ? value : fallback;
}

function styleIndex(styleId: string): number {
  if (styleId === 'solar-debris') return 1;
  if (styleId === 'black-hole-lens') return 2;
  if (styleId === 'ink-paper') return 3;
  if (styleId === 'radioactive-aurora') return 4;
  if (styleId === 'blood-moon') return 5;
  if (styleId === 'realistic') return 6;
  return 0;
}

function chooseSimSize(settings: Record<string, unknown>): number {
  const explicit = numeric(settings, 'rawParticleTextureSize', 0);
  if (explicit > 0) return Math.max(32, Math.min(4096, Math.round(explicit)));
  const particleCount = numeric(settings, 'particleCount', 720);
  if (particleCount <= 180) return 64;
  if (particleCount <= 360) return 96;
  if (particleCount <= 760) return 128;
  return 192;
}

function readNativeSettings(settings: Record<string, unknown>, width: number, height: number): NativeOrbitalSettings {
  const simSize = chooseSimSize(settings);
  const trailWidth = Math.max(2, Math.min(2048, Math.floor(width * 0.82)));
  const gravity = numeric(settings, 'gravity', 1850) / 2250;
  const planetRadius = Math.max(0.035, numeric(settings, 'planetRadius', 46) / 317);
  const requestedBodyRadius = numeric(settings, 'secondaryBodyRadius', 0.72);
  const bodyRadius = Math.max(planetRadius + 0.085, requestedBodyRadius);
  const bodySpeedMultiplier = numeric(settings, 'secondaryBodySpeed', 0.25);
  const stableBodySpeed = Math.sqrt(gravity / Math.max(0.001, (bodyRadius * bodyRadius + 0.075) * bodyRadius));
  return {
    particleCount: simSize * simSize,
    simSize,
    trailWidth,
    gravity,
    tangent: 0.0,
    damping: 1.0,
    maxSpeed: numeric(settings, 'rawMaxSpeed', 2.3),
    boundaryPull: 0.16,
    planetRadius,
    planetBounce: 0.62,
    trailPersistence: Math.max(0, numeric(settings, 'trailFade', 0.972)),
    trailBlur: 0.18,
    pointSize: Math.max(0.6, numeric(settings, 'debrisSize', 0.72) * 4.2),
    speedSize: 1.25,
    trailAlpha: numeric(settings, 'trailFade', 0.972) <= 0.001 ? 0 : 1,
    liveAlpha: 8,
    particleBrightness: 1.0,
    debrisOpacity: numeric(settings, 'debrisOpacity', 1),
    glow: numeric(settings, 'bloomStrength', 1.25) * 0.58,
    exposure: 1.15,
    chroma: 0.003,
    stars: 0.55,
    starFieldOpacity: boolSetting(settings, 'starField', true) ? numeric(settings, 'starFieldOpacity', 0.18) : 0,
    bloomSamples: 8,
    bloomRadius: 5.0,
    bodyCount: Math.max(0, Math.min(8, Math.round(numeric(settings, 'secondaryBodyCount', 3)))),
    bodyStrength: numeric(settings, 'secondaryBodyStrength', 0.35) * 0.18,
    bodyRadius,
    bodySpeed: stableBodySpeed * bodySpeedMultiplier,
    swish: 0.72,
    well: numeric(settings, 'wellStrength', 5.5),
    wellRadius: numeric(settings, 'wellRadius', 72) / Math.max(1, Math.min(width, height)) * 2,
    pointerVortex: 0.14,
    shockStrength: 1.0,
    addDebrisVolume: numeric(settings, 'addDebrisVolume', 0.035),
    addRadius: Math.max(0.004, (numeric(settings, 'addRadius', 32) / Math.max(1, Math.min(width, height))) * 2),
    addDebrisVelocity: numeric(settings, 'addDebrisVelocity', 0.35),
    addJitter: numeric(settings, 'addJitter', 0.12),
    interactionRadius: numeric(settings, 'interactionRadius', numeric(settings, 'influenceRadius', 56)),
    interactionStrength: numeric(settings, 'interactionStrength', numeric(settings, 'influenceStrength', 3.2)),
    motionBlurSamples: 1,
    streakLength: Math.max(0, numeric(settings, 'streakStrength', 0.75) * 1.2),
  };
}

function settingsKey(settings: Record<string, unknown>, width: number, height: number): string {
  const s = readNativeSettings(settings, width, height);
  return [
    s.simSize,
    s.trailWidth,
    Math.round(s.planetRadius * 10000),
    Math.round(width),
    Math.round(height),
  ].join(':');
}

function createEarthTexture(gl: WebGL2RenderingContext): { texture: WebGLTexture; dispose: () => void } {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Unable to allocate orbital Earth texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, EARTH_PLACEHOLDER_PIXEL);
  gl.bindTexture(gl.TEXTURE_2D, null);

  let disposed = false;
  const image = new Image();
  image.addEventListener('load', () => {
    if (disposed) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  });
  image.src = EARTH_TEXTURE_URL;

  return {
    texture,
    dispose: () => {
      disposed = true;
      image.src = '';
    },
  };
}

function createMoonTexture(gl: WebGL2RenderingContext): { texture: WebGLTexture; dispose: () => void } {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Unable to allocate orbital Moon texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, MOON_PLACEHOLDER_PIXEL);
  gl.bindTexture(gl.TEXTURE_2D, null);

  let disposed = false;
  const image = new Image();
  image.addEventListener('load', () => {
    if (disposed) return;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  });
  image.src = MOON_TEXTURE_URL;

  return {
    texture,
    dispose: () => {
      disposed = true;
      image.src = '';
    },
  };
}

function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function createInitialState(simSize: number, aspect: number, settings: NativeOrbitalSettings): { positions: Float32Array; velocities: Float32Array } {
  const count = simSize * simSize;
  const positions = new Float32Array(count * 4);
  const velocities = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    const a = i * 2.39996323 + seeded(i + 17) * 0.08;
    const band = seeded(i + 91);
    const r = 0.18 + Math.sqrt(band) * 0.78;
    const wobble = 0.92 + seeded(i + 211) * 0.16;
    const x = Math.cos(a) * r * aspect * wobble;
    const y = Math.sin(a) * r;
    const radialAcceleration = settings.gravity / (r * r + 0.075);
    const speed = Math.sqrt(radialAcceleration * r);
    const tangentX = -Math.sin(a) * speed * aspect;
    const tangentY = Math.cos(a) * speed;
    const k = i * 4;
    positions[k] = x;
    positions[k + 1] = y;
    positions[k + 2] = seeded(i + 307);
    positions[k + 3] = smoothstepLike(seeded(i + 419));
    velocities[k] = tangentX;
    velocities[k + 1] = tangentY;
    velocities[k + 2] = (a / 6.2831853) + seeded(i + 587) * 0.18;
    velocities[k + 3] = 0;
  }
  return { positions, velocities };
}

function smoothstepLike(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function destroyRuntime(gl: WebGL2RenderingContext, runtime: NativeOrbitalRuntime | null): void {
  if (!runtime) return;
  for (const cleanup of runtime.cleanup) cleanup();
  runtime.particleState.destroy();
  runtime.trail.destroy();
  gl.deleteProgram(runtime.simProgram);
  gl.deleteProgram(runtime.fadeProgram);
  gl.deleteProgram(runtime.particleProgram);
  gl.deleteProgram(runtime.displayProgram);
  gl.deleteTexture(runtime.earthTexture);
  gl.deleteTexture(runtime.moonTexture);
  gl.deleteVertexArray(runtime.quadVao);
  gl.deleteVertexArray(runtime.particleVao);
}

function createRuntime(state: RawWebGL2RenderState, mode: OrbitalInputMode, styleId: string): NativeOrbitalRuntime {
  const { gl, width, height, settings } = state;
  const aspect = width / Math.max(1, height);
  const nativeSettings = readNativeSettings(settings, width, height);
  const maxStateTextureSize = Math.max(32, Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number));
  nativeSettings.simSize = Math.min(nativeSettings.simSize, maxStateTextureSize);
  nativeSettings.particleCount = nativeSettings.simSize * nativeSettings.simSize;
  const trailHeight = Math.max(96, Math.round(nativeSettings.trailWidth * height / Math.max(1, width)));
  const initial = createInitialState(nativeSettings.simSize, aspect, nativeSettings);
  const particleState = new RawGpuParticleState(state.resources, {
    capacity: nativeSettings.particleCount,
    width: nativeSettings.simSize,
    height: nativeSettings.simSize,
    precision: 'float',
  });
  particleState.uploadSeed({ ...initial, uploadWriteTargets: false });
  const trail = new RawPingPongRenderTarget(state.resources, {
    width: nativeSettings.trailWidth,
    height: trailHeight,
    precision: 'half-float',
    filter: 'linear',
  });
  const quadVao = gl.createVertexArray();
  const particleVao = gl.createVertexArray();
  if (!quadVao || !particleVao) throw new Error('Unable to allocate orbital raw VAOs');
  const earthTexture = createEarthTexture(gl);
  const moonTexture = createMoonTexture(gl);
  const runtime: NativeOrbitalRuntime = {
    simProgram: linkRawWebGL2Program(gl, { vertex: QUAD_VERTEX_SHADER, fragment: SIM_FRAGMENT_SHADER }),
    fadeProgram: linkRawWebGL2Program(gl, { vertex: QUAD_VERTEX_SHADER, fragment: FADE_FRAGMENT_SHADER }),
    particleProgram: linkRawWebGL2Program(gl, { vertex: PARTICLE_VERTEX_SHADER, fragment: PARTICLE_FRAGMENT_SHADER }),
    displayProgram: linkRawWebGL2Program(gl, { vertex: QUAD_VERTEX_SHADER, fragment: DISPLAY_FRAGMENT_SHADER }),
    earthTexture: earthTexture.texture,
    moonTexture: moonTexture.texture,
    quadVao,
    particleVao,
    particleState,
    trail,
    simSize: nativeSettings.simSize,
    particleCount: nativeSettings.particleCount,
    trailWidth: nativeSettings.trailWidth,
    trailHeight,
    width,
    height,
    inputWidth: state.canvas.clientWidth || width,
    inputHeight: state.canvas.clientHeight || height,
    settingsKey: settingsKey(settings, width, height),
    styleId,
    mode,
    pointer: { x: 0, y: 0, vx: 0, vy: 0, ttl: 0, spawn: 0, capture: 0, asteroid: 0 },
    addEmitter: null,
    interactionField: null,
    lastAddPoint: null,
    asteroidAim: null,
    asteroidDrag: null,
    wellPointerId: null,
    pendingAsteroidReleases: [],
    asteroids: [],
    shocks: [],
    asteroidUniformData: new Float32Array(8 * 4),
    shockUniformData: new Float32Array(8 * 4),
    uniformLocations: new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>(),
    cleanup: [earthTexture.dispose, moonTexture.dispose],
    gpuMetrics: createRawGpuSimulationMetrics({
      engine: 'space-debris-gpu-particles',
      stateWidth: nativeSettings.simSize,
      stateHeight: nativeSettings.simSize,
      stateTextures: 4,
      precision: 'float',
      passesPerFrame: 4,
      capabilities: state.resources.capabilities,
    }),
    frame: 0,
    timeSeconds: 0,
  };
  const startAddFromPointer = (event: PointerEvent): void => {
    if (runtime.mode !== 'add') return;
    const [x, y] = worldFromPointerEvent(runtime, state.canvas, event);
    startAddEmitter(runtime, x, y, event.pointerId);
    try {
      state.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Some browser/device combinations do not allow capture after delegated input; normal move/up listeners still work.
    }
  };
  const moveAddFromPointer = (event: PointerEvent): void => {
    if (runtime.mode !== 'add' || !runtime.addEmitter?.active || runtime.addEmitter.id !== event.pointerId) return;
    const [x, y] = worldFromPointerEvent(runtime, state.canvas, event);
    moveAddEmitter(runtime, x, y, event.pointerId);
  };
  const stopAddFromPointer = (event: PointerEvent): void => {
    stopAddEmitter(runtime, event.pointerId);
  };
  state.canvas.addEventListener('pointerdown', startAddFromPointer);
  state.canvas.addEventListener('pointermove', moveAddFromPointer);
  state.canvas.addEventListener('pointerup', stopAddFromPointer);
  state.canvas.addEventListener('pointercancel', stopAddFromPointer);
  window.addEventListener('pointermove', moveAddFromPointer);
  window.addEventListener('pointerup', stopAddFromPointer);
  window.addEventListener('pointercancel', stopAddFromPointer);
  runtime.cleanup.push(() => {
    state.canvas.removeEventListener('pointerdown', startAddFromPointer);
    state.canvas.removeEventListener('pointermove', moveAddFromPointer);
    state.canvas.removeEventListener('pointerup', stopAddFromPointer);
    state.canvas.removeEventListener('pointercancel', stopAddFromPointer);
    window.removeEventListener('pointermove', moveAddFromPointer);
    window.removeEventListener('pointerup', stopAddFromPointer);
    window.removeEventListener('pointercancel', stopAddFromPointer);
  });
  const startInteractFromPointer = (event: PointerEvent): void => {
    if (runtime.mode !== 'interact') return;
    const [x, y] = worldFromPointerEvent(runtime, state.canvas, event);
    startInteractionField(runtime, x, y, event.pointerId, event.timeStamp);
    try {
      state.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional; global move/up listeners below keep the interaction usable.
    }
  };
  const moveInteractFromPointer = (event: PointerEvent): void => {
    if (runtime.mode !== 'interact' || !runtime.interactionField?.active || runtime.interactionField.id !== event.pointerId) return;
    const [x, y] = worldFromPointerEvent(runtime, state.canvas, event);
    moveInteractionField(runtime, x, y, event.pointerId, event.timeStamp);
  };
  const stopInteractFromPointer = (event: PointerEvent): void => {
    stopInteractionField(runtime, event.pointerId);
  };
  state.canvas.addEventListener('pointerdown', startInteractFromPointer);
  state.canvas.addEventListener('pointermove', moveInteractFromPointer);
  state.canvas.addEventListener('pointerup', stopInteractFromPointer);
  state.canvas.addEventListener('pointercancel', stopInteractFromPointer);
  window.addEventListener('pointermove', moveInteractFromPointer);
  window.addEventListener('pointerup', stopInteractFromPointer);
  window.addEventListener('pointercancel', stopInteractFromPointer);
  runtime.cleanup.push(() => {
    state.canvas.removeEventListener('pointerdown', startInteractFromPointer);
    state.canvas.removeEventListener('pointermove', moveInteractFromPointer);
    state.canvas.removeEventListener('pointerup', stopInteractFromPointer);
    state.canvas.removeEventListener('pointercancel', stopInteractFromPointer);
    window.removeEventListener('pointermove', moveInteractFromPointer);
    window.removeEventListener('pointerup', stopInteractFromPointer);
    window.removeEventListener('pointercancel', stopInteractFromPointer);
  });
  const startWellFromPointer = (event: PointerEvent): void => {
    if (runtime.mode !== 'well') return;
    const [x, y] = worldFromPointerEvent(runtime, state.canvas, event);
    runtime.wellPointerId = event.pointerId;
    runtime.pointer = { x, y, vx: 0, vy: 0, ttl: 0.24, spawn: 0, capture: 0, asteroid: 0 };
    try {
      state.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional; global move/up listeners below keep the well usable.
    }
    event.preventDefault();
  };
  const moveWellFromPointer = (event: PointerEvent): void => {
    if (runtime.mode !== 'well' || runtime.wellPointerId !== event.pointerId) return;
    const [x, y] = worldFromPointerEvent(runtime, state.canvas, event);
    runtime.pointer = { x, y, vx: 0, vy: 0, ttl: 0.24, spawn: 0, capture: 0, asteroid: 0 };
    event.preventDefault();
  };
  const stopWellFromPointer = (event: PointerEvent): void => {
    if (runtime.wellPointerId !== event.pointerId) return;
    runtime.wellPointerId = null;
    runtime.pointer.ttl = 0;
    event.preventDefault();
  };
  state.canvas.addEventListener('pointerdown', startWellFromPointer);
  state.canvas.addEventListener('pointermove', moveWellFromPointer);
  state.canvas.addEventListener('pointerup', stopWellFromPointer);
  state.canvas.addEventListener('pointercancel', stopWellFromPointer);
  window.addEventListener('pointermove', moveWellFromPointer);
  window.addEventListener('pointerup', stopWellFromPointer);
  window.addEventListener('pointercancel', stopWellFromPointer);
  runtime.cleanup.push(() => {
    state.canvas.removeEventListener('pointerdown', startWellFromPointer);
    state.canvas.removeEventListener('pointermove', moveWellFromPointer);
    state.canvas.removeEventListener('pointerup', stopWellFromPointer);
    state.canvas.removeEventListener('pointercancel', stopWellFromPointer);
    window.removeEventListener('pointermove', moveWellFromPointer);
    window.removeEventListener('pointerup', stopWellFromPointer);
    window.removeEventListener('pointercancel', stopWellFromPointer);
  });
  const startAsteroidFromPointer = (event: PointerEvent): void => {
    if (runtime.mode !== 'asteroid') return;
    const [x, y] = worldFromPointerEvent(runtime, state.canvas, event);
    runtime.asteroidDrag = { id: event.pointerId, startX: x, startY: y };
    runtime.asteroidAim = { startX: x, startY: y, endX: x, endY: y, ttl: 0.5, active: true };
    try {
      state.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional; global move/up listeners below keep the slingshot usable.
    }
    event.preventDefault();
  };
  const moveAsteroidFromPointer = (event: PointerEvent): void => {
    if (runtime.mode !== 'asteroid' || !runtime.asteroidDrag || runtime.asteroidDrag.id !== event.pointerId) return;
    const [x, y] = worldFromPointerEvent(runtime, state.canvas, event);
    runtime.asteroidAim = {
      startX: runtime.asteroidDrag.startX,
      startY: runtime.asteroidDrag.startY,
      endX: x,
      endY: y,
      ttl: 0.5,
      active: true,
    };
    event.preventDefault();
  };
  const queueAsteroidRelease = (event: PointerEvent): void => {
    if (runtime.mode !== 'asteroid') return;
    const [x, y] = worldFromPointerEvent(runtime, state.canvas, event);
    runtime.pendingAsteroidReleases.push({
      id: event.pointerId,
      x,
      y,
    });
    event.preventDefault();
  };
  state.canvas.addEventListener('pointerdown', startAsteroidFromPointer);
  state.canvas.addEventListener('pointermove', moveAsteroidFromPointer);
  state.canvas.addEventListener('pointerup', queueAsteroidRelease);
  state.canvas.addEventListener('pointercancel', queueAsteroidRelease);
  window.addEventListener('pointermove', moveAsteroidFromPointer);
  window.addEventListener('pointerup', queueAsteroidRelease);
  window.addEventListener('pointercancel', queueAsteroidRelease);
  runtime.cleanup.push(() => {
    state.canvas.removeEventListener('pointerdown', startAsteroidFromPointer);
    state.canvas.removeEventListener('pointermove', moveAsteroidFromPointer);
    state.canvas.removeEventListener('pointerup', queueAsteroidRelease);
    state.canvas.removeEventListener('pointercancel', queueAsteroidRelease);
    window.removeEventListener('pointermove', moveAsteroidFromPointer);
    window.removeEventListener('pointerup', queueAsteroidRelease);
    window.removeEventListener('pointercancel', queueAsteroidRelease);
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, runtime.trail.read.framebuffer);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, runtime.trail.write.framebuffer);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return runtime;
}

function worldFromPixels(x: number, y: number, width: number, height: number): [number, number] {
  const aspect = width / Math.max(1, height);
  return [
    (x / Math.max(1, width) * 2 - 1) * aspect,
    1 - y / Math.max(1, height) * 2,
  ];
}

function worldFromPointerEvent(runtime: NativeOrbitalRuntime, canvas: HTMLCanvasElement, event: PointerEvent): [number, number] {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * runtime.inputWidth;
  const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * runtime.inputHeight;
  return worldFromPixels(x, y, runtime.inputWidth, runtime.inputHeight);
}

function startAddEmitter(runtime: NativeOrbitalRuntime, x: number, y: number, id: number): void {
  runtime.addEmitter = {
    id,
    active: true,
    x,
    y,
    targetX: x,
    targetY: y,
    vx: 0,
    vy: 0,
  };
  runtime.pointer = { x, y, vx: 0, vy: 0, ttl: 0.2, spawn: 0, capture: 0, asteroid: 0 };
}

function moveAddEmitter(runtime: NativeOrbitalRuntime, x: number, y: number, id: number): void {
  if (!runtime.addEmitter || runtime.addEmitter.id !== id) {
    startAddEmitter(runtime, x, y, id);
    return;
  }
  runtime.addEmitter.targetX = x;
  runtime.addEmitter.targetY = y;
}

function stopAddEmitter(runtime: NativeOrbitalRuntime, id: number): void {
  if (runtime.addEmitter && runtime.addEmitter.id === id) runtime.addEmitter.active = false;
}

function startInteractionField(runtime: NativeOrbitalRuntime, x: number, y: number, id: number, time: number): void {
  runtime.interactionField = {
    id,
    active: true,
    x,
    y,
    vx: 0,
    vy: 0,
    lastTime: time,
  };
  runtime.pointer = { x, y, vx: 0, vy: 0, ttl: 0.2, spawn: 0, capture: 0, asteroid: 0 };
}

function moveInteractionField(runtime: NativeOrbitalRuntime, x: number, y: number, id: number, time: number): void {
  if (!runtime.interactionField || runtime.interactionField.id !== id) {
    startInteractionField(runtime, x, y, id, time);
    return;
  }
  const field = runtime.interactionField;
  const dt = Math.max(1 / 240, (time - field.lastTime) / 1000);
  field.vx = (x - field.x) / dt;
  field.vy = (y - field.y) / dt;
  field.x = x;
  field.y = y;
  field.lastTime = time;
}

function stopInteractionField(runtime: NativeOrbitalRuntime, id: number): void {
  if (runtime.interactionField && runtime.interactionField.id === id) runtime.interactionField.active = false;
}

function updateInteractionField(runtime: NativeOrbitalRuntime, dt: number): void {
  const field = runtime.interactionField;
  if (!field?.active || runtime.mode !== 'interact') {
    if (runtime.mode !== 'interact') runtime.interactionField = null;
    return;
  }
  field.vx *= Math.exp(-dt * 5.5);
  field.vy *= Math.exp(-dt * 5.5);
  runtime.pointer = {
    x: field.x,
    y: field.y,
    vx: field.vx,
    vy: field.vy,
    ttl: 0.2,
    spawn: 0,
    capture: 0,
    asteroid: 0,
  };
}

function updateAddEmitter(runtime: NativeOrbitalRuntime, settings: NativeOrbitalSettings, dt: number): void {
  const emitter = runtime.addEmitter;
  if (!emitter?.active || runtime.mode !== 'add') {
    if (runtime.mode !== 'add') runtime.addEmitter = null;
    return;
  }
  const previousX = emitter.x;
  const previousY = emitter.y;
  const follow = 1 - Math.exp(-dt * 16);
  emitter.x += (emitter.targetX - emitter.x) * follow;
  emitter.y += (emitter.targetY - emitter.y) * follow;
  emitter.vx = (emitter.x - previousX) / Math.max(dt, 1 / 240);
  emitter.vy = (emitter.y - previousY) / Math.max(dt, 1 / 240);
  runtime.pointer = {
    x: emitter.x,
    y: emitter.y,
    vx: emitter.vx,
    vy: emitter.vy,
    ttl: 0.18,
    spawn: settings.addDebrisVolume,
    capture: 0,
    asteroid: 0,
  };
}

function interactionRadiusWorld(runtime: NativeOrbitalRuntime, settings: NativeOrbitalSettings): number {
  return settings.interactionRadius / Math.max(1, Math.min(runtime.inputWidth, runtime.inputHeight)) * 2;
}

function refreshGravityWell(runtime: NativeOrbitalRuntime): void {
  if (runtime.mode === 'well' && runtime.wellPointerId !== null) runtime.pointer.ttl = 0.24;
}

function stableOrbitalVelocityAt(
  x: number,
  y: number,
  settings: NativeOrbitalSettings,
): [number, number, number] {
  const radius = Math.max(settings.planetRadius + 0.055, Math.hypot(x, y));
  const unitX = x / Math.max(0.0001, radius);
  const unitY = y / Math.max(0.0001, radius);
  const speed = Math.sqrt((settings.gravity / (radius * radius + 0.075)) * radius);
  return [-unitY * speed, unitX * speed, speed];
}

function asteroidLaunchVelocityWorld(
  x: number,
  y: number,
  dx: number,
  dy: number,
  settings: NativeOrbitalSettings,
): [number, number] {
  const [, , orbitSpeed] = stableOrbitalVelocityAt(x, y, settings);
  const dragDistance = Math.min(1.25, Math.hypot(dx, dy));
  if (dragDistance <= 0.0001) return [0, 0];
  const dragUnitX = dx / dragDistance;
  const dragUnitY = dy / dragDistance;
  const limit = Math.max(0.05, settings.maxSpeed * 0.96);
  const launchSpeed = Math.min(limit, orbitSpeed * (0.3 + dragDistance * 3.2));
  return [dragUnitX * launchSpeed, dragUnitY * launchSpeed];
}

function addAsteroidBody(
  runtime: NativeOrbitalRuntime,
  x: number,
  y: number,
  vx: number,
  vy: number,
  settings: NativeOrbitalSettings,
): void {
  const distance = Math.max(0.0001, Math.hypot(x, y));
  const safeDistance = Math.max(distance, settings.planetRadius + 0.065);
  const safeX = x / distance * safeDistance;
  const safeY = y / distance * safeDistance;
  runtime.asteroids.unshift({
    x: safeX,
    y: safeY,
    vx,
    vy,
    radius: 0.042,
    strength: Math.max(0.08, settings.bodyStrength * 2.4),
  });
  runtime.asteroids = runtime.asteroids.slice(0, 8);
}

function launchAsteroidFromDrag(
  runtime: NativeOrbitalRuntime,
  x: number,
  y: number,
  settings: NativeOrbitalSettings,
): void {
  if (!runtime.asteroidDrag) return;
  const startX = runtime.asteroidDrag.startX;
  const startY = runtime.asteroidDrag.startY;
  const launchDx = x - startX;
  const launchDy = y - startY;
  const [vx, vy] = asteroidLaunchVelocityWorld(x, y, launchDx, launchDy, settings);
  addAsteroidBody(runtime, x, y, vx, vy, settings);
  runtime.pointer = {
    x,
    y,
    vx,
    vy,
    ttl: 0.09,
    spawn: 0.00012,
    capture: 0,
    asteroid: 1,
  };
  runtime.asteroidAim = { startX, startY, endX: x, endY: y, ttl: 0.42, active: false };
  runtime.asteroidDrag = null;
}

function flushPendingAsteroidReleases(runtime: NativeOrbitalRuntime, settings: NativeOrbitalSettings): void {
  if (runtime.mode !== 'asteroid' || runtime.pendingAsteroidReleases.length === 0) {
    runtime.pendingAsteroidReleases = [];
    return;
  }
  const releases = runtime.pendingAsteroidReleases.splice(0);
  for (const release of releases) {
    if (!runtime.asteroidDrag) return;
    if (runtime.asteroidDrag.id !== release.id && releases.length > 1) continue;
    launchAsteroidFromDrag(runtime, release.x, release.y, settings);
    return;
  }
}

function updateAsteroidBodies(runtime: NativeOrbitalRuntime, settings: NativeOrbitalSettings, dt: number): void {
  let writeIndex = 0;
  for (const asteroid of runtime.asteroids) {
    const radius = Math.max(0.0001, Math.hypot(asteroid.x, asteroid.y));
    if (radius <= settings.planetRadius + asteroid.radius * 0.35) continue;
    const inwardX = -asteroid.x / radius;
    const inwardY = -asteroid.y / radius;
    const acceleration = settings.gravity / (radius * radius + 0.075);
    asteroid.vx += inwardX * acceleration * dt;
    asteroid.vy += inwardY * acceleration * dt;
    const speed = Math.hypot(asteroid.vx, asteroid.vy);
    const stableSpeed = Math.sqrt((settings.gravity / (radius * radius + 0.075)) * radius);
    const limit = Math.max(0.08, settings.maxSpeed, stableSpeed * 1.35);
    if (speed > limit) {
      asteroid.vx *= limit / speed;
      asteroid.vy *= limit / speed;
    }
    asteroid.x += asteroid.vx * dt;
    asteroid.y += asteroid.vy * dt;
    if (Math.hypot(asteroid.x, asteroid.y) > 1.45) continue;
    runtime.asteroids[writeIndex] = asteroid;
    writeIndex += 1;
  }
  runtime.asteroids.length = writeIndex;
}

function addShock(runtime: NativeOrbitalRuntime, x: number, y: number, strength: number, speed = 0.75): void {
  runtime.shocks.unshift({ x, y, strength, radius: 0, speed, life: 1 });
  if (runtime.shocks.length > 8) runtime.shocks.length = 8;
}

function uniform(gl: WebGL2RenderingContext, runtime: NativeOrbitalRuntime, program: WebGLProgram, name: string): WebGLUniformLocation | null {
  let programUniforms = runtime.uniformLocations.get(program);
  if (!programUniforms) {
    programUniforms = new Map<string, WebGLUniformLocation | null>();
    runtime.uniformLocations.set(program, programUniforms);
  }
  if (!programUniforms.has(name)) {
    programUniforms.set(name, gl.getUniformLocation(program, name));
  }
  return programUniforms.get(name) ?? null;
}

function applyGestures(runtime: NativeOrbitalRuntime, gestures: GestureEvent[]): void {
  for (const gesture of gestures) {
    if (gesture.kind !== 'tap' && gesture.kind !== 'drag' && gesture.kind !== 'hold' && gesture.kind !== 'release' && gesture.kind !== 'fast_swipe') continue;
    const [x, y] = worldFromPixels(gesture.x, gesture.y, runtime.inputWidth, runtime.inputHeight);
    const dx = gesture.dx ?? 0;
    const dy = gesture.dy ?? 0;
    if (runtime.mode === 'add') {
      if (gesture.kind === 'drag' || gesture.kind === 'hold') moveAddEmitter(runtime, x, y, gesture.id ?? 0);
      continue;
    }
    runtime.lastAddPoint = null;
    if (runtime.mode === 'asteroid') {
      continue;
    }
    if (runtime.mode === 'interact') {
      if (gesture.kind === 'drag') moveInteractionField(runtime, x, y, gesture.id ?? 0, gesture.timestamp);
      if (gesture.kind === 'hold') startInteractionField(runtime, x, y, gesture.id ?? 0, gesture.timestamp);
      continue;
    }
    if (gesture.kind === 'tap') {
      addShock(runtime, x, y, 0.95, 0.75);
      continue;
    }
    if (gesture.kind === 'fast_swipe') {
      runtime.pointer = { x, y, vx: dx * 0.16, vy: -dy * 0.16, ttl: 0.28, spawn: 0, capture: 0, asteroid: 0 };
      addShock(runtime, x, y, 1.45, 0.9);
      continue;
    }
    runtime.pointer = {
      x,
      y,
      vx: dx * 0.12,
      vy: -dy * 0.12,
      ttl: 0.32,
      spawn: 0,
      capture: 0,
      asteroid: 0,
    };
    addShock(runtime, x, y, gesture.kind === 'hold' ? 0.72 : 0.38, 0.75);
  }
}

function setShockUniforms(gl: WebGL2RenderingContext, program: WebGLProgram, runtime: NativeOrbitalRuntime): void {
  const shocks = runtime.shocks;
  const data = runtime.shockUniformData;
  data.fill(0);
  const count = Math.min(8, shocks.length);
  for (let i = 0; i < count; i += 1) {
    const shock = shocks[i];
    const k = i * 4;
    data[k] = shock.x;
    data[k + 1] = shock.y;
    data[k + 2] = shock.radius;
    data[k + 3] = shock.strength * shock.life;
  }
  gl.uniform1f(uniform(gl, runtime, program, 'uShockCount'), count);
  gl.uniform4fv(uniform(gl, runtime, program, 'uShockwaves'), data);
}

function setAsteroidUniforms(gl: WebGL2RenderingContext, program: WebGLProgram, runtime: NativeOrbitalRuntime): void {
  const asteroids = runtime.asteroids;
  const data = runtime.asteroidUniformData;
  data.fill(0);
  const count = Math.min(8, asteroids.length);
  for (let i = 0; i < count; i += 1) {
    const asteroid = asteroids[i];
    const k = i * 4;
    data[k] = asteroid.x;
    data[k + 1] = asteroid.y;
    data[k + 2] = asteroid.strength;
    data[k + 3] = asteroid.radius;
  }
  gl.uniform1i(uniform(gl, runtime, program, 'uAsteroidBodyCount'), count);
  gl.uniform4fv(uniform(gl, runtime, program, 'uAsteroidBodies'), data);
}

function simulate(state: RawWebGL2RenderState, runtime: NativeOrbitalRuntime, settings: NativeOrbitalSettings, dt: number): void {
  const gl = state.gl;
  const program = runtime.simProgram;
  const aspect = state.width / Math.max(1, state.height);
  gl.useProgram(program);
  runtime.particleState.bindWriteFramebuffer();
  gl.viewport(0, 0, runtime.simSize, runtime.simSize);
  gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, runtime.particleState.positions.read.texture.texture);
  gl.uniform1i(uniform(gl, runtime, program, 'uPosition'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, runtime.particleState.velocities.read.texture.texture);
  gl.uniform1i(uniform(gl, runtime, program, 'uVelocity'), 1);
  gl.uniform1f(uniform(gl, runtime, program, 'uDt'), dt);
  gl.uniform1f(uniform(gl, runtime, program, 'uTime'), runtime.timeSeconds);
  gl.uniform1f(uniform(gl, runtime, program, 'uAspect'), aspect);
  gl.uniform1f(uniform(gl, runtime, program, 'uGravity'), settings.gravity);
  gl.uniform1f(uniform(gl, runtime, program, 'uTangent'), settings.tangent);
  gl.uniform1f(uniform(gl, runtime, program, 'uDamping'), settings.damping);
  gl.uniform1f(uniform(gl, runtime, program, 'uMaxSpeed'), settings.maxSpeed);
  gl.uniform1f(uniform(gl, runtime, program, 'uBoundaryPull'), settings.boundaryPull);
  gl.uniform1f(uniform(gl, runtime, program, 'uPlanetRadius'), settings.planetRadius);
  gl.uniform1f(uniform(gl, runtime, program, 'uPlanetBounce'), settings.planetBounce);
  gl.uniform1i(uniform(gl, runtime, program, 'uBodyCount'), settings.bodyCount);
  gl.uniform1f(uniform(gl, runtime, program, 'uBodyStrength'), settings.bodyStrength);
  gl.uniform1f(uniform(gl, runtime, program, 'uBodyRadius'), settings.bodyRadius);
  gl.uniform1f(uniform(gl, runtime, program, 'uBodySpeed'), settings.bodySpeed);
  setAsteroidUniforms(gl, program, runtime);
  gl.uniform1f(uniform(gl, runtime, program, 'uPointerActive'), runtime.pointer.ttl > 0 ? 1 : 0);
  gl.uniform2f(uniform(gl, runtime, program, 'uPointer'), runtime.pointer.x, runtime.pointer.y);
  gl.uniform2f(uniform(gl, runtime, program, 'uPointerVelocity'), runtime.pointer.vx, runtime.pointer.vy);
  gl.uniform1f(
    uniform(gl, runtime, program, 'uSpawnActive'),
    (runtime.mode === 'add' || runtime.mode === 'asteroid') && runtime.pointer.ttl > 0 ? runtime.pointer.spawn : 0,
  );
  gl.uniform2f(uniform(gl, runtime, program, 'uSpawnCenter'), runtime.pointer.x, runtime.pointer.y);
  gl.uniform2f(uniform(gl, runtime, program, 'uSpawnVelocity'), runtime.pointer.vx, runtime.pointer.vy);
  gl.uniform1f(uniform(gl, runtime, program, 'uSpawnRadius'), settings.addRadius);
  gl.uniform1f(uniform(gl, runtime, program, 'uSpawnVelocityScale'), settings.addDebrisVelocity);
  gl.uniform1f(uniform(gl, runtime, program, 'uSpawnJitter'), settings.addJitter);
  gl.uniform1f(uniform(gl, runtime, program, 'uSpawnAsteroid'), runtime.pointer.asteroid);
  gl.uniform1f(uniform(gl, runtime, program, 'uInfluenceMode'), runtime.mode === 'interact' ? 1 : 0);
  gl.uniform1f(uniform(gl, runtime, program, 'uInfluenceCapture'), runtime.pointer.capture);
  gl.uniform1f(uniform(gl, runtime, program, 'uInfluenceRadius'), interactionRadiusWorld(runtime, settings));
  gl.uniform1f(uniform(gl, runtime, program, 'uInfluenceStrength'), settings.interactionStrength);
  gl.uniform1f(uniform(gl, runtime, program, 'uSwishForce'), settings.swish);
  gl.uniform1f(uniform(gl, runtime, program, 'uWellForce'), settings.well);
  gl.uniform1f(uniform(gl, runtime, program, 'uWellRadius'), settings.wellRadius);
  gl.uniform1f(uniform(gl, runtime, program, 'uWellMode'), runtime.mode === 'well' ? 1 : 0);
  gl.uniform1f(uniform(gl, runtime, program, 'uPointerVortex'), settings.pointerVortex);
  setShockUniforms(gl, program, runtime);
  gl.bindVertexArray(runtime.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  runtime.particleState.unbindWriteFramebuffer();
  runtime.particleState.swap();
}

function fadeTrail(state: RawWebGL2RenderState, runtime: NativeOrbitalRuntime, settings: NativeOrbitalSettings): void {
  const gl = state.gl;
  const program = runtime.fadeProgram;
  gl.useProgram(program);
  gl.bindFramebuffer(gl.FRAMEBUFFER, runtime.trail.write.framebuffer);
  gl.viewport(0, 0, runtime.trail.width, runtime.trail.height);
  gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, runtime.trail.read.texture.texture);
  gl.uniform1i(uniform(gl, runtime, program, 'uTrail'), 0);
  gl.uniform2f(uniform(gl, runtime, program, 'uTexel'), 1 / runtime.trail.width, 1 / runtime.trail.height);
  gl.uniform1f(uniform(gl, runtime, program, 'uPersistence'), settings.trailPersistence);
  gl.uniform1f(uniform(gl, runtime, program, 'uBlur'), settings.trailBlur);
  gl.uniform1f(uniform(gl, runtime, program, 'uTime'), runtime.timeSeconds);
  gl.bindVertexArray(runtime.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  runtime.trail.swap();
}

function drawParticles(
  state: RawWebGL2RenderState,
  runtime: NativeOrbitalRuntime,
  settings: NativeOrbitalSettings,
  target: WebGLFramebuffer | null,
  width: number,
  height: number,
  alpha: number,
  additive: boolean,
): void {
  const gl = state.gl;
  const program = runtime.particleProgram;
  gl.useProgram(program);
  gl.bindFramebuffer(gl.FRAMEBUFFER, target);
  gl.viewport(0, 0, width, height);
  gl.enable(gl.BLEND);
  if (additive) gl.blendFunc(gl.ONE, gl.ONE);
  else gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, runtime.particleState.positions.read.texture.texture);
  gl.uniform1i(uniform(gl, runtime, program, 'uPosition'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, runtime.particleState.velocities.read.texture.texture);
  gl.uniform1i(uniform(gl, runtime, program, 'uVelocity'), 1);
  gl.uniform1i(uniform(gl, runtime, program, 'uTextureSize'), runtime.simSize);
  gl.uniform1f(uniform(gl, runtime, program, 'uAspect'), state.width / Math.max(1, state.height));
  gl.uniform1f(uniform(gl, runtime, program, 'uPointSize'), settings.pointSize * (height / Math.max(1, state.height)));
  gl.uniform1f(uniform(gl, runtime, program, 'uSpeedSize'), settings.speedSize);
  gl.uniform1f(uniform(gl, runtime, program, 'uStreakLength'), settings.streakLength);
  gl.uniform1i(uniform(gl, runtime, program, 'uMotionBlurCount'), settings.motionBlurSamples);
  gl.uniform1i(uniform(gl, runtime, program, 'uStyle'), styleIndex(runtime.styleId));
  const liveOpacity = target === null ? settings.debrisOpacity : 1;
  gl.uniform1f(uniform(gl, runtime, program, 'uParticleAlpha'), alpha * liveOpacity);
  gl.uniform1f(uniform(gl, runtime, program, 'uParticleBrightness'), settings.particleBrightness);
  gl.uniform1f(uniform(gl, runtime, program, 'uTime'), runtime.timeSeconds);
  gl.uniform1i(uniform(gl, runtime, program, 'uShape'), 0);
  gl.uniform1i(uniform(gl, runtime, program, 'uInkLive'), target === null && styleIndex(runtime.styleId) === 3 ? 1 : 0);
  gl.bindVertexArray(runtime.particleVao);
  const passes = Math.max(1, settings.motionBlurSamples);
  for (let pass = 0; pass < passes; pass += 1) {
    gl.uniform1i(uniform(gl, runtime, program, 'uMotionBlurPass'), pass);
    gl.drawArrays(gl.POINTS, 0, runtime.particleCount);
  }
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function display(state: RawWebGL2RenderState, runtime: NativeOrbitalRuntime, settings: NativeOrbitalSettings): void {
  const gl = state.gl;
  const program = runtime.displayProgram;
  gl.useProgram(program);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, state.width, state.height);
  gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, runtime.trail.read.texture.texture);
  gl.uniform1i(uniform(gl, runtime, program, 'uTrail'), 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, runtime.earthTexture);
  gl.uniform1i(uniform(gl, runtime, program, 'uEarthTexture'), 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, runtime.moonTexture);
  gl.uniform1i(uniform(gl, runtime, program, 'uMoonTexture'), 2);
  gl.uniform2f(uniform(gl, runtime, program, 'uResolution'), state.width, state.height);
  gl.uniform2f(uniform(gl, runtime, program, 'uTexel'), 1 / runtime.trail.width, 1 / runtime.trail.height);
  gl.uniform1f(uniform(gl, runtime, program, 'uAspect'), state.width / Math.max(1, state.height));
  gl.uniform1f(uniform(gl, runtime, program, 'uTime'), runtime.timeSeconds);
  gl.uniform1f(uniform(gl, runtime, program, 'uGlow'), settings.glow);
  gl.uniform1f(uniform(gl, runtime, program, 'uExposure'), settings.exposure);
  gl.uniform1f(uniform(gl, runtime, program, 'uChroma'), settings.chroma);
  gl.uniform1f(uniform(gl, runtime, program, 'uStars'), settings.stars);
  gl.uniform1f(uniform(gl, runtime, program, 'uStarFieldOpacity'), settings.starFieldOpacity);
  gl.uniform1i(uniform(gl, runtime, program, 'uBloomSamples'), settings.bloomSamples);
  gl.uniform1f(uniform(gl, runtime, program, 'uBloomRadius'), settings.bloomRadius);
  gl.uniform1i(uniform(gl, runtime, program, 'uStyle'), styleIndex(runtime.styleId));
  gl.uniform1i(uniform(gl, runtime, program, 'uBodyCount'), settings.bodyCount);
  gl.uniform1f(uniform(gl, runtime, program, 'uBodyStrength'), settings.bodyStrength);
  gl.uniform1f(uniform(gl, runtime, program, 'uBodyRadius'), settings.bodyRadius);
  gl.uniform1f(uniform(gl, runtime, program, 'uBodySpeed'), settings.bodySpeed);
  gl.uniform1f(uniform(gl, runtime, program, 'uPlanetRadius'), settings.planetRadius);
  setAsteroidUniforms(gl, program, runtime);
  gl.uniform1f(uniform(gl, runtime, program, 'uInfluenceVisual'), runtime.mode === 'interact' && runtime.pointer.ttl > 0 ? 1 : 0);
  gl.uniform2f(uniform(gl, runtime, program, 'uInfluencePointer'), runtime.pointer.x, runtime.pointer.y);
  gl.uniform1f(uniform(gl, runtime, program, 'uInfluenceRadius'), interactionRadiusWorld(runtime, settings));
  gl.uniform1f(uniform(gl, runtime, program, 'uWellVisual'), runtime.mode === 'well' && runtime.pointer.ttl > 0 ? 1 : 0);
  gl.uniform2f(uniform(gl, runtime, program, 'uWellPointer'), runtime.pointer.x, runtime.pointer.y);
  gl.uniform1f(uniform(gl, runtime, program, 'uWellRadius'), settings.wellRadius);
  gl.uniform1f(uniform(gl, runtime, program, 'uAsteroidAimVisual'), runtime.mode === 'asteroid' && runtime.asteroidAim ? Math.min(1, runtime.asteroidAim.ttl * 7) : 0);
  gl.uniform2f(uniform(gl, runtime, program, 'uAsteroidAimStart'), runtime.asteroidAim?.startX ?? 0, runtime.asteroidAim?.startY ?? 0);
  gl.uniform2f(uniform(gl, runtime, program, 'uAsteroidAimEnd'), runtime.asteroidAim?.endX ?? 0, runtime.asteroidAim?.endY ?? 0);
  setShockUniforms(gl, program, runtime);
  gl.bindVertexArray(runtime.quadVao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

export class RawOrbitalShrapnelReferenceScene extends RawWebGL2Scene {
  private runtime: NativeOrbitalRuntime | null = null;
  private pendingGestures: GestureEvent[] = [];
  private mode: OrbitalInputMode = 'add';
  private styleId = 'ice-ring';
  private resetRequested = false;

  constructor() {
    super({
      name: 'Space Debris Native Raw',
      markup: MARKUP,
      canvasSelector: '[data-orbital-native-raw-canvas]',
      maxDevicePixelRatio: 2,
      renderScale: () => 1,
      onInit: (state) => {
        this.runtime = createRuntime(state, this.mode, this.styleId);
      },
      onReset: () => {
        this.resetRequested = true;
      },
      onStyleChange: (state) => {
        this.styleId = state.style?.id ?? this.styleId;
        if (this.runtime) this.runtime.styleId = this.styleId;
      },
      onModeChange: (_state, mode) => {
        const nextMode = orbitalInputModeFromString(mode);
        if (nextMode) {
          this.mode = nextMode;
          if (this.runtime) this.runtime.mode = nextMode;
        }
      },
      render: (state) => this.renderNative(state),
      onDestroy: (state) => {
        destroyRuntime(state.gl, this.runtime);
        this.runtime = null;
      },
    });
  }

  pushGestures(gestures: GestureEvent[]): void {
    this.pendingGestures.push(...gestures);
  }

  override setMode(mode: string): void {
    super.setMode(mode);
    const nextMode = orbitalInputModeFromString(mode);
    if (nextMode) {
      this.mode = nextMode;
      if (this.runtime) this.runtime.mode = nextMode;
    }
  }

  override setStyle(styleId: string): void {
    super.setStyle(styleId);
    this.styleId = styleId;
    if (this.runtime) this.runtime.styleId = styleId;
  }

  override reset(): void {
    this.resetRequested = true;
    super.reset();
  }

  override getDebugStats(): Record<string, string | number | boolean | null> | null {
    if (!this.runtime) {
      return {
        renderer: 'native-raw-webgl2-orbital',
        simulation: 'gpu-texture-ping-pong',
        rendering: 'gpu-particle-field-and-trails',
        gpuSimulated: true,
        gpuRendered: true,
        cpuTopology: false,
        cpuUpload: false,
        particles: 0,
        state: 'initializing',
      };
    }
    return {
      ...rawGpuMetricsToDebugStats(this.runtime.gpuMetrics),
      renderer: 'native-raw-webgl2-orbital',
      rendering: 'gpu-particle-field-and-trails',
      particles: this.runtime.particleCount,
      state: `${this.runtime.simSize}x${this.runtime.simSize} RGBA32F ping-pong`,
      trailRt: `${this.runtime.trail.width}x${this.runtime.trail.height}`,
      style: this.runtime.styleId,
      mode: this.runtime.mode,
      shockwaves: this.runtime.shocks.length,
      asteroids: this.runtime.asteroids.length,
      seedUploadFloats: this.runtime.particleState.seedUploadFloats(),
    };
  }

  private renderNative(state: RawWebGL2RenderState): void {
    const key = settingsKey(state.settings, state.width, state.height);
    if (!this.runtime || this.resetRequested || this.runtime.settingsKey !== key) {
      destroyRuntime(state.gl, this.runtime);
      this.runtime = createRuntime(state, this.mode, state.style?.id ?? this.styleId);
      this.resetRequested = false;
    }
    const runtime = this.runtime;
    const settings = readNativeSettings(state.settings, state.width, state.height);
    runtime.width = state.width;
    runtime.height = state.height;
    runtime.inputWidth = state.canvas.clientWidth || state.width;
    runtime.inputHeight = state.canvas.clientHeight || state.height;
    runtime.mode = this.mode;
    runtime.styleId = state.style?.id ?? this.styleId;
    applyGestures(runtime, this.pendingGestures);
    this.pendingGestures = [];
    flushPendingAsteroidReleases(runtime, settings);

    const dt = Math.min(0.04, Math.max(0, state.deltaSeconds || 0));
    runtime.timeSeconds += dt;
    updateAddEmitter(runtime, settings, dt);
    updateInteractionField(runtime, dt);
    refreshGravityWell(runtime);
    runtime.pointer.ttl = Math.max(0, runtime.pointer.ttl - dt);
    runtime.pointer.spawn = Math.max(0, runtime.pointer.spawn - dt * 0.18);
    runtime.pointer.capture = Math.max(0, runtime.pointer.capture - dt * 12);
    runtime.pointer.vx *= Math.exp(-dt * 8);
    runtime.pointer.vy *= Math.exp(-dt * 8);
    if (runtime.pointer.ttl <= 0) runtime.pointer.asteroid = 0;
    if (runtime.asteroidAim) {
      if (!runtime.asteroidAim.active) runtime.asteroidAim.ttl -= dt;
      if (runtime.asteroidAim.ttl <= 0) runtime.asteroidAim = null;
    }
    updateAsteroidBodies(runtime, settings, dt);
    let shockWriteIndex = 0;
    for (const shock of runtime.shocks) {
      shock.radius += shock.speed * dt;
      shock.life -= dt * 0.72;
      shock.strength *= Math.exp(-dt * 0.42);
      if (shock.life > 0 && shock.radius <= 2.5) {
        runtime.shocks[shockWriteIndex] = shock;
        shockWriteIndex += 1;
      }
    }
    runtime.shocks.length = shockWriteIndex;

    const substeps = 1;
    for (let i = 0; i < substeps; i += 1) simulate(state, runtime, settings, dt * 0.82 / substeps);
    fadeTrail(state, runtime, settings);
    drawParticles(state, runtime, settings, runtime.trail.read.framebuffer, runtime.trail.width, runtime.trail.height, settings.trailAlpha, true);
    display(state, runtime, settings);
    drawParticles(state, runtime, settings, null, state.width, state.height, settings.liveAlpha, false);
    runtime.frame += 1;
  }
}
