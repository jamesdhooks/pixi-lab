import {
  RawGpuFieldPass,
  RawGpuParticleState,
  RawPingPongRenderTarget,
  RawWebGL2Scene,
  createRawGpuSimulationMetrics,
  finiteNumberSetting,
  linkRawWebGL2Program,
  rawGpuMetricsToDebugStats,
  resolveSideViewPaletteBackdrop,
  type GestureEvent,
  type RawWebGL2RenderState,
} from '@hooksjam/pixi-lab-core';
import { SPARK_SIZE_VARIABILITY_GLSL, SPARK_SIZE_VARIABILITY_KEY } from '../shared/spark-rendering.js';
import { FIREWORKS_DEFAULTS } from './fireworks.config.js';

type FireworksMode = 'single' | 'stream';

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
}

interface ShellActor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  fuse: number;
  generation: number;
  seed: number;
  paletteSeed: number;
  wakeAccumulator: number;
  targetX?: number;
  targetY?: number;
}

interface FireworksSettings {
  launchPower: number;
  launchSpread: number;
  shellFuse: number;
  gravity: number;
  airDrag: number;
  burstParticles: number;
  burstChaos: number;
  explosionPower: number;
  secondaryChance: number;
  secondaryDepth: number;
  secondaryScale: number;
  crackleIntensity: number;
  particleSize: number;
  sparkSizeVariability: number;
  trailFade: number;
  bloomStrength: number;
  autoFinaleRate: number;
  rawParticleTextureSize: number;
}

export interface FireworksLaunchSolution {
  launchX: number;
  launchY: number;
  vx: number;
  vy: number;
  fuse: number;
  targetX: number;
  targetY: number;
}

interface FireworksLaunchInput {
  width: number;
  height: number;
  targetX: number;
  targetY: number;
  launchPower: number;
  launchSpread: number;
  shellFuse: number;
  gravity: number;
  offsetRandom: number;
  fuseRandom: number;
}

export interface FireworksInputCommand {
  action: 'launch';
  x: number;
  y: number;
}

interface FireworksRuntime {
  particleState: RawGpuParticleState;
  stepPass: RawGpuFieldPass;
  fadePass: RawGpuFieldPass;
  compositePass: RawGpuFieldPass;
  pointRenderer: FireworksPointRenderer;
  trail: RawPingPongRenderTarget | null;
  settings: FireworksSettings;
  actors: ShellActor[];
  queuedSpawns: SpawnCommand[];
  mode: FireworksMode;
  cleanup: () => void;
  spawnCursor: number;
  rngState: number;
  trailEnergy: number;
  finaleAccumulator: number;
  lastGpuPasses: number;
  launches: number;
  explosions: number;
  secondaryActors: number;
}

const MARKUP = '<canvas class="h-full w-full touch-none bg-black" data-fireworks-canvas></canvas>';
const MAX_SPAWNS_PER_FRAME = 8;
const EXPLOSION_KIND_COUNT = 32;
const SHELL_KIND = 0;
const SHELL_WAKE_KIND = 33;

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
uniform float uBurstChaos;

layout(location=0) out vec4 outPosition;
layout(location=1) out vec4 outVelocity;

const float PI = 3.141592653589793;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float signedHash(float n) {
  return hash(n) * 2.0 - 1.0;
}

float chaosForKind(float kind, float seed) {
  return clamp(uBurstChaos * mix(0.72, 1.34, hash(seed + kind * 23.71)), 0.0, 1.4);
}

vec2 directionFromAngle(float angle) {
  return vec2(cos(angle), sin(angle));
}

vec2 burstDirection(float slot, float count, float kind, float seed) {
  float t = (slot + hash(seed + slot * 9.17)) / max(1.0, count);
  float chaos = chaosForKind(kind, seed);
  float tWarp = signedHash(seed * 0.73 + floor(t * mix(5.0, 19.0, chaos)) * 11.13) * chaos * 0.045;
  t = fract(t + tWarp);
  float angle = t * PI * 2.0;
  angle += signedHash(seed + slot * 2.13) * mix(0.04, 0.42, chaos);
  angle += sin(t * PI * mix(3.0, 11.0, hash(seed + kind)) + seed) * chaos * 0.16;
  if (kind == 3.0) angle += sin(t * PI * 8.0 + seed) * mix(0.34, 0.68, chaos);
  if (kind == 6.0) angle = floor(t * 6.0) / 6.0 * PI * 2.0 + signedHash(seed + slot) * mix(0.16, 0.64, chaos);
  if (kind == 9.0) angle = t * PI * mix(8.4, 11.6, hash(seed)) + seed + signedHash(seed + slot) * chaos * 0.44;
  if (kind == 12.0) angle = (floor(t * 2.0) * PI) + signedHash(seed + slot) * mix(0.38, 0.86, chaos);
  if (kind == 15.0) angle = PI * 1.5 + signedHash(seed + slot) * mix(0.46, 0.98, chaos);
  if (kind == 17.0) angle = floor(t * mix(18.0, 29.0, hash(seed))) / mix(18.0, 29.0, hash(seed)) * PI * 2.0 + signedHash(seed + slot) * mix(0.08, 0.31, chaos);
  if (kind == 18.0) angle = PI * 1.5 + signedHash(seed + slot) * mix(0.84, 1.42, chaos);
  if (kind == 19.0) angle = t * PI * 2.0 + floor(hash(seed + slot) * mix(3.0, 7.0, chaos)) * mix(0.1, 0.32, chaos);
  if (kind == 20.0) angle = t < 0.5 ? t * PI * mix(3.4, 4.8, chaos) : (t - 0.5) * PI * mix(3.6, 5.1, chaos) + PI / mix(6.0, 10.0, hash(seed));
  if (kind == 21.0) angle = PI * 0.5 + signedHash(seed + slot) * mix(0.92, 1.5, chaos);
  if (kind == 22.0) angle = hash(seed + slot * 13.0) * PI * 2.0;
  if (kind == 23.0) angle = t * PI * mix(11.0, 17.0, hash(seed)) + seed * 0.17 + signedHash(seed + slot) * chaos * 0.36;
  if (kind == 24.0) angle = floor(t * 8.0) / 8.0 * PI * 2.0 + signedHash(seed + slot) * mix(0.12, 0.48, chaos);
  if (kind == 25.0) angle = PI * 1.5 + signedHash(seed + slot) * mix(1.18, 1.72, chaos);
  if (kind == 26.0) angle = hash(seed + slot * 23.0) * PI * 2.0;
  if (kind == 27.0) angle = PI * 1.5 + (t - 0.5) * mix(1.9, 2.7, chaos) + signedHash(seed + slot) * mix(0.12, 0.5, chaos);
  if (kind == 29.0) angle = t < 0.5 ? PI * 1.25 + signedHash(seed + slot) * mix(0.38, 0.82, chaos) : PI * 1.75 + signedHash(seed + slot) * mix(0.38, 0.82, chaos);
  if (kind == 30.0) angle = PI * 0.5 + sin(t * PI * mix(4.4, 8.4, hash(seed)) + seed) * mix(0.72, 1.18, chaos);
  if (kind == 32.0) angle = floor(t * 4.0) / 4.0 * PI * 2.0 + signedHash(seed + slot) * mix(0.12, 0.72, chaos);
  return directionFromAngle(angle);
}

float burstSpeed(float slot, float count, float kind, float seed, float power) {
  float t = (slot + 0.5) / max(1.0, count);
  float rnd = hash(seed + slot * 5.31);
  float chaos = chaosForKind(kind, seed);
  float speed = power * mix(0.34, 1.12, rnd);
  speed *= mix(1.0, mix(0.68, 1.42, hash(seed + slot * 3.7)), chaos);
  speed *= mix(0.86, 1.18, sin(t * PI * mix(2.0, 7.0, hash(seed + kind * 4.0)) + seed) * 0.5 + 0.5);
  if (kind == 2.0) speed *= mix(0.34, 0.88, t);
  if (kind == 4.0) speed *= mix(0.76, 1.32, smoothstep(0.0, 1.0, sin(t * PI)));
  if (kind == 5.0) speed *= t < 0.5 ? 0.52 : 1.2;
  if (kind == 7.0) speed *= mix(0.18, 0.74, rnd);
  if (kind == 10.0) speed *= mix(0.95, 1.55, rnd);
  if (kind == 13.0) speed *= 0.26 + floor(t * 4.0) * 0.2;
  if (kind == 16.0) speed *= mix(0.55, 1.45, step(mix(0.42, 0.62, hash(seed)), fract(t * mix(9.0, 15.0, hash(seed + 9.0)))));
  if (kind == 17.0) speed *= mix(0.92, 1.18, rnd);
  if (kind == 18.0) speed *= mix(0.38, 1.45, pow(t, 0.7));
  if (kind == 19.0) speed *= mix(0.58, 1.05, step(0.5, fract(t * 2.0)));
  if (kind == 20.0) speed *= t < 0.5 ? 0.58 : 1.18;
  if (kind == 21.0) speed *= mix(0.28, 0.72, rnd);
  if (kind == 22.0) speed *= mix(0.14, 1.35, rnd);
  if (kind == 23.0) speed *= mix(0.35, 1.25, t);
  if (kind == 24.0) speed *= mix(0.7, 1.4, step(mix(0.38, 0.64, hash(seed + slot)), fract(t * mix(6.0, 10.0, hash(seed + 2.0)))));
  if (kind == 25.0) speed *= mix(0.45, 1.25, 1.0 - t);
  if (kind == 26.0) speed *= mix(0.18, 0.92, rnd);
  if (kind == 27.0) speed *= mix(0.85, 1.38, rnd);
  if (kind == 28.0) speed *= mix(0.42, 1.42, smoothstep(0.0, 1.0, sin(t * PI)));
  if (kind == 29.0) speed *= mix(0.48, 1.06, rnd);
  if (kind == 30.0) speed *= mix(0.14, 0.58, rnd);
  if (kind == 31.0) speed *= mix(1.05, 1.7, rnd);
  if (kind == 32.0) speed *= mix(0.5, 1.45, step(mix(0.34, 0.68, hash(seed)), fract(t * mix(3.0, 6.0, hash(seed + 6.0)))));
  return speed;
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
    age += uDt;
    velocity.y += uGravity * uDt;
    float damping = kind == 0.0 ? 0.0 : uDamping;
    velocity.xy *= exp(-damping * uDt);
    if (kind == 3.0 || kind == 7.0 || kind == 15.0 || kind == 21.0 || kind == 30.0) velocity.y += uGravity * 0.55 * uDt;
    if (kind == 18.0 || kind == 25.0 || kind == 27.0) velocity.y -= uGravity * 0.2 * uDt;
    if (kind == 8.0 || kind == 11.0 || kind == 22.0 || kind == 26.0) {
      float wiggle = sin(uTime * 21.0 + seed * 7.0 + age * 18.0);
      velocity.xy += vec2(wiggle, -abs(wiggle) * 0.38) * 26.0 * uDt;
    }
    position.xy += velocity.xy * uDt;
    if (age >= life || position.x < uWorldBounds.x - 180.0 || position.x > uWorldBounds.z + 180.0 || position.y > uWorldBounds.w + 220.0) {
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
      kind = uSpawnKind;
      seed = uSpawnPaletteSeed * 100000.0 + spawnSeed;
      age = 0.0;
      if (kind == 0.0) {
        life = max(0.15, uSpawnPower);
        position.xy = uSpawnPosition;
        velocity.xy = uSpawnVelocity;
      } else if (kind == 33.0) {
        float jitter = hash(spawnSeed + 41.0);
        vec2 side = directionFromAngle(hash(spawnSeed + 17.0) * PI * 2.0);
        life = mix(0.24, 0.58, jitter);
        position.xy = uSpawnPosition + side * mix(0.4, 2.4, hash(spawnSeed + 5.0));
        velocity.xy = uSpawnVelocity + side * mix(7.0, 24.0, hash(spawnSeed + 9.0));
      } else {
        vec2 dir = burstDirection(slot, uSpawnCount, kind, spawnSeed);
        float speed = burstSpeed(slot, uSpawnCount, kind, spawnSeed, uSpawnPower);
        float jitter = hash(spawnSeed + 41.0);
        float chaos = chaosForKind(kind, spawnSeed);
        float ring = floor(hash(spawnSeed + 8.0) * mix(3.0, 7.0, chaos));
        float clumpCount = mix(3.0, 9.0, hash(uSpawnSeed + kind * 5.17));
        float clumpId = floor(hash(spawnSeed + 71.0) * clumpCount);
        float clumpAngle = hash(uSpawnSeed + clumpId * 17.31 + kind * 2.7) * PI * 2.0;
        vec2 clumpDir = directionFromAngle(clumpAngle);
        float skew = signedHash(uSpawnSeed + kind * 13.9) * chaos * 0.24;
        dir = normalize(vec2(dir.x + dir.y * skew, dir.y - dir.x * skew));
        position.xy = uSpawnPosition + dir * ring * mix(1.2, 3.6, hash(spawnSeed + 12.0)) + clumpDir * chaos * mix(0.0, 5.0, hash(spawnSeed + 4.0));
        velocity.xy = uSpawnVelocity + dir * speed + clumpDir * uSpawnPower * chaos * mix(0.015, 0.16, hash(spawnSeed + 91.0));
        if (kind == 14.0) velocity.x += signedHash(spawnSeed) * uSpawnPower * 0.82;
        if (kind == 15.0) velocity.y += uSpawnPower * mix(0.35, 0.75, jitter);
        if (kind == 21.0 || kind == 30.0) velocity.y += uSpawnPower * mix(0.18, 0.46, jitter);
        if (kind == 25.0 || kind == 27.0) velocity.y -= uSpawnPower * mix(0.14, 0.32, jitter);
        life = mix(0.68, 2.65, jitter);
        if (hash(spawnSeed + 123.0) < chaos * 0.13) {
          life *= mix(0.08, 0.34, hash(spawnSeed + 44.0));
          velocity.xy *= mix(0.12, 0.42, hash(spawnSeed + 52.0));
        }
        if (kind == 3.0 || kind == 7.0 || kind == 15.0 || kind == 18.0 || kind == 21.0 || kind == 30.0) life *= 1.55;
        if (kind == 8.0 || kind == 10.0 || kind == 16.0 || kind == 22.0 || kind == 26.0 || kind == 32.0) life *= 0.72;
        if (kind == 24.0 || kind == 31.0) life *= 0.58;
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
  vec3 lifted = max(trail.rgb, uBackground * trail.a * 0.015);
  outColor = vec4(lifted, trail.a * uFade);
}`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uTrail;
uniform vec3 uBackground;
uniform float uBloom;
uniform float uSkyLift;
out vec4 outColor;
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(textureSize(uTrail, 0));
  vec4 trail = texture(uTrail, uv);
  vec3 vignette = uBackground * (0.55 + 0.45 * smoothstep(0.95, 0.0, length(uv - 0.5)));
  vec3 color = vignette + vec3(uSkyLift) + trail.rgb * uBloom;
  outColor = vec4(color, 1.0);
}`;

const POINT_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform ivec2 uStateSize;
uniform vec4 uWorldBounds;
uniform vec2 uCanvasSize;
uniform float uParticleSize;
uniform float uSizeVariability;
uniform float uTime;

${SPARK_SIZE_VARIABILITY_GLSL}

out float vAlpha;
out float vKind;
out float vLifeT;
out float vSeed;
out float vSpeed;

void main() {
  int index = gl_VertexID;
  ivec2 texel = ivec2(index % uStateSize.x, index / uStateSize.x);
  vec4 position = texelFetch(uPosition, texel, 0);
  vec4 velocity = texelFetch(uVelocity, texel, 0);
  float life = position.w;
  float age = position.z;
  float kind = velocity.z;
  float lifeT = life > 0.0 ? clamp(age / life, 0.0, 1.0) : 1.0;
  float fade = life > 0.0 ? pow(1.0 - lifeT, kind == 0.0 ? 0.35 : 1.45) : 0.0;
  float speed = length(velocity.xy);
  vec2 worldSize = max(uWorldBounds.zw - uWorldBounds.xy, vec2(1.0));
  vec2 normalized = (position.xy - uWorldBounds.xy) / worldSize;
  float pxScale = min(uCanvasSize.x / worldSize.x, uCanvasSize.y / worldSize.y);
  float kindSize = kind == 0.0 ? 3.2 : mix(1.0, 2.7, fract(kind * 0.37));
  if (kind == 33.0) kindSize = 1.45;
  if (kind == 8.0 || kind == 10.0 || kind == 16.0 || kind == 22.0 || kind == 26.0 || kind == 31.0 || kind == 32.0) kindSize *= 1.55;
  if (kind == 3.0 || kind == 7.0 || kind == 15.0 || kind == 21.0 || kind == 30.0) kindSize *= 0.82;
  float seededSize = sparkSizeVariation(velocity.w + kind * 29.0, uSizeVariability);
  kindSize *= kind == 0.0 ? mix(1.0, seededSize, 0.34) : seededSize;
  vAlpha = fade;
  vKind = kind;
  vLifeT = lifeT;
  vSeed = velocity.w;
  vSpeed = speed;
  gl_Position = fade > 0.0 ? vec4(normalized.x * 2.0 - 1.0, 1.0 - normalized.y * 2.0, 0.0, 1.0) : vec4(2.0, 2.0, 0.0, 1.0);
  gl_PointSize = max(1.0, uParticleSize * kindSize * pxScale * (kind == 0.0 ? 2.2 : 1.0));
}`;

const POINT_FRAGMENT = `#version 300 es
precision highp float;

uniform vec3 uPalette[8];
uniform int uPaletteCount;
uniform float uCrackle;
uniform float uGlowBias;
uniform float uColorShift;
uniform float uTime;

in float vAlpha;
in float vKind;
in float vLifeT;
in float vSeed;
in float vSpeed;
out vec4 outColor;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float particleSeedFromPacked(float seed) {
  return mod(seed, 100000.0);
}

float paletteSeedFromPacked(float seed) {
  return floor(seed / 100000.0);
}

int paletteIndex(float schemeSeed, float offset) {
  int count = min(uPaletteCount, 8);
  return int(floor(hash(schemeSeed + offset) * float(count))) % count;
}

vec3 paletteColor(float seed, float offset) {
  if (uPaletteCount <= 0) return vec3(1.0);
  float particleSeed = particleSeedFromPacked(seed);
  float schemeSeed = paletteSeedFromPacked(seed);
  vec3 primary = uPalette[paletteIndex(schemeSeed, 1.0)];
  vec3 accent = uPalette[paletteIndex(schemeSeed, 7.0)];
  vec3 tertiary = uPalette[paletteIndex(schemeSeed, 13.0)];
  float blend = smoothstep(0.12, 0.88, hash(particleSeed + offset));
  vec3 color = mix(primary, accent, blend);
  float tertiaryMix = step(0.78, hash(particleSeed + offset + 31.0)) * 0.68;
  return mix(color, tertiary, tertiaryMix);
}

void main() {
  if (vAlpha <= 0.0) discard;
  vec2 centered = gl_PointCoord * 2.0 - 1.0;
  float radius2 = dot(centered, centered);
  if (radius2 > 1.0) discard;
  float core = smoothstep(1.0, 0.02, radius2);
  float halo = smoothstep(1.0, 0.34, radius2) * 0.38;
  vec3 startColor = paletteColor(vSeed, vKind * 3.1);
  vec3 endColor = paletteColor(vSeed, vKind * 11.7 + uColorShift * 19.0);
  vec3 color = mix(startColor, endColor, smoothstep(0.18, 0.92, vLifeT));
  if (vKind == 0.0) color = vec3(0.09, 0.066, 0.035) + paletteColor(vSeed, 23.0) * 0.16;
  if (vKind == 33.0) color = mix(vec3(0.9, 0.56, 0.24), paletteColor(vSeed, 29.0), 0.34);
  float particleSeed = particleSeedFromPacked(vSeed);
  float sparkle = step(0.72, hash(particleSeed + floor(uTime * (18.0 + vKind)) + vKind * 29.0));
  float crackle = (vKind == 8.0 || vKind == 10.0 || vKind == 16.0 || vKind == 22.0 || vKind == 26.0 || vKind == 32.0) ? sparkle * uCrackle : 0.0;
  color += vec3(crackle);
  float alpha = vAlpha * (core + halo) * (uGlowBias + crackle * 0.65);
  if (vKind == 33.0) alpha *= 0.52;
  outColor = vec4(color * alpha, alpha);
}`;

class FireworksPointRenderer {
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly palette = new Float32Array(8 * 3);

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = linkRawWebGL2Program(gl, { vertex: POINT_VERTEX, fragment: POINT_FRAGMENT });
    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(this.program);
      throw new Error('Unable to allocate fireworks point renderer');
    }
    this.vao = vao;
  }

  render(options: {
    particleState: RawGpuParticleState;
    target: WebGLFramebuffer | null;
    width: number;
    height: number;
    worldBounds: [number, number, number, number];
    particleSize: number;
    sparkSizeVariability: number;
    crackle: number;
    glowBias: number;
    colorShift: number;
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
    gl.uniform1f(this.uniform('uParticleSize'), options.particleSize);
    gl.uniform1f(this.uniform('uSizeVariability'), options.sparkSizeVariability);
    gl.uniform1f(this.uniform('uCrackle'), options.crackle);
    gl.uniform1f(this.uniform('uGlowBias'), options.glowBias);
    gl.uniform1f(this.uniform('uColorShift'), options.colorShift);
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

export class RawFireworksScene extends RawWebGL2Scene {
  private runtime: FireworksRuntime | null = null;
  private pendingGestures: GestureEvent[] = [];
  private mode: FireworksMode = 'single';

  constructor() {
    super({
      name: 'Fireworks Native Raw',
      markup: MARKUP,
      canvasSelector: '[data-fireworks-canvas]',
      maxDevicePixelRatio: 2,
      renderScale: (settings) => {
        const edge = Number(settings.rawParticleTextureSize ?? FIREWORKS_DEFAULTS.rawParticleTextureSize);
        return edge >= 768 ? 0.74 : edge >= 512 ? 0.86 : 1;
      },
      onInit: (state) => {
        this.runtime = createRuntime(state, this.mode);
      },
      onReset: (state) => {
        if (this.runtime) destroyRuntime(this.runtime);
        this.runtime = createRuntime(state, this.mode);
      },
      onSettingsChange: (state) => {
        if (!this.runtime) return;
        applySettings(this.runtime, state);
      },
      onStyleChange: (_state) => undefined,
      onModeChange: (_state, mode) => {
        this.mode = fireworksModeFromString(mode);
        if (this.runtime) this.runtime.mode = this.mode;
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
    this.mode = fireworksModeFromString(mode);
    if (this.runtime) this.runtime.mode = this.mode;
  }

  override clearEmitters(): void {
    if (!this.runtime) return;
    this.runtime.actors = [];
    this.runtime.queuedSpawns = [];
  }
}

function createRuntime(state: RawWebGL2RenderState, mode: FireworksMode): FireworksRuntime {
  const gl = state.gl;
  const particleState = createParticleState(state);
  particleState.clear();
  const stepPass = new RawGpuFieldPass(gl, { vertex: FULLSCREEN_VERTEX, fragment: STEP_FRAGMENT });
  const fadePass = new RawGpuFieldPass(gl, { vertex: FULLSCREEN_VERTEX, fragment: FADE_FRAGMENT });
  const compositePass = new RawGpuFieldPass(gl, { vertex: FULLSCREEN_VERTEX, fragment: COMPOSITE_FRAGMENT });
  const pointRenderer = new FireworksPointRenderer(gl);
  const runtime: FireworksRuntime = {
    particleState,
    stepPass,
    fadePass,
    compositePass,
    pointRenderer,
    trail: null,
    settings: settingsFromState(state),
    actors: [],
    queuedSpawns: [],
    mode,
    cleanup: () => undefined,
    spawnCursor: 0,
    rngState: 0x71c5f9,
    trailEnergy: 1,
    finaleAccumulator: 0,
    lastGpuPasses: 0,
    launches: 0,
    explosions: 0,
    secondaryActors: 0,
  };
  runtime.cleanup = attachPointerInput(state, runtime);
  queueLaunch(runtime, state, state.width * 0.5, state.height * 0.28, 0);
  return runtime;
}

function destroyRuntime(runtime: FireworksRuntime): void {
  runtime.cleanup();
  runtime.trail?.destroy();
  runtime.pointRenderer.destroy();
  runtime.stepPass.destroy();
  runtime.fadePass.destroy();
  runtime.compositePass.destroy();
  runtime.particleState.destroy();
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

function settingsFromState(state: RawWebGL2RenderState): FireworksSettings {
  const rawEdge = Number(state.settings.rawParticleTextureSize ?? FIREWORKS_DEFAULTS.rawParticleTextureSize);
  return {
    launchPower: finiteNumberSetting(state.settings, 'launchPower', FIREWORKS_DEFAULTS.launchPower as number),
    launchSpread: finiteNumberSetting(state.settings, 'launchSpread', FIREWORKS_DEFAULTS.launchSpread as number),
    shellFuse: finiteNumberSetting(state.settings, 'shellFuse', FIREWORKS_DEFAULTS.shellFuse as number),
    gravity: finiteNumberSetting(state.settings, 'gravity', FIREWORKS_DEFAULTS.gravity as number),
    airDrag: finiteNumberSetting(state.settings, 'airDrag', FIREWORKS_DEFAULTS.airDrag as number),
    burstParticles: finiteNumberSetting(state.settings, 'burstParticles', FIREWORKS_DEFAULTS.burstParticles as number),
    burstChaos: finiteNumberSetting(state.settings, 'burstChaos', FIREWORKS_DEFAULTS.burstChaos as number),
    explosionPower: finiteNumberSetting(state.settings, 'explosionPower', FIREWORKS_DEFAULTS.explosionPower as number),
    secondaryChance: finiteNumberSetting(state.settings, 'secondaryChance', FIREWORKS_DEFAULTS.secondaryChance as number),
    secondaryDepth: finiteNumberSetting(state.settings, 'secondaryDepth', FIREWORKS_DEFAULTS.secondaryDepth as number),
    secondaryScale: finiteNumberSetting(state.settings, 'secondaryScale', FIREWORKS_DEFAULTS.secondaryScale as number),
    crackleIntensity: finiteNumberSetting(state.settings, 'crackleIntensity', FIREWORKS_DEFAULTS.crackleIntensity as number),
    particleSize: finiteNumberSetting(state.settings, 'particleSize', FIREWORKS_DEFAULTS.particleSize as number),
    sparkSizeVariability: finiteNumberSetting(state.settings, SPARK_SIZE_VARIABILITY_KEY, FIREWORKS_DEFAULTS.sparkSizeVariability as number),
    trailFade: finiteNumberSetting(state.settings, 'trailFade', FIREWORKS_DEFAULTS.trailFade as number),
    bloomStrength: finiteNumberSetting(state.settings, 'bloomStrength', FIREWORKS_DEFAULTS.bloomStrength as number),
    autoFinaleRate: finiteNumberSetting(state.settings, 'autoFinaleRate', FIREWORKS_DEFAULTS.autoFinaleRate as number),
    rawParticleTextureSize: clamp(Math.floor(Number.isFinite(rawEdge) ? rawEdge : 384), 128, 1024),
  };
}

function applySettings(runtime: FireworksRuntime, state: RawWebGL2RenderState): void {
  const next = settingsFromState(state);
  if (next.rawParticleTextureSize !== runtime.settings.rawParticleTextureSize) {
    runtime.particleState.destroy();
    runtime.particleState = createParticleState(state);
    runtime.particleState.clear();
    runtime.spawnCursor = 0;
  }
  runtime.settings = next;
}

function attachPointerInput(state: RawWebGL2RenderState, runtime: FireworksRuntime): () => void {
  const launch = (event: PointerEvent) => {
    const point = eventPoint(state, event);
    queueLaunch(runtime, state, point.x, point.y, 0);
  };
  const stream = (event: PointerEvent) => {
    if (runtime.mode !== 'stream' || event.buttons !== 1) return;
    const point = eventPoint(state, event);
    queueLaunch(runtime, state, point.x, point.y, 0);
  };
  state.canvas.addEventListener('pointerdown', launch);
  state.canvas.addEventListener('pointermove', stream);
  return () => {
    state.canvas.removeEventListener('pointerdown', launch);
    state.canvas.removeEventListener('pointermove', stream);
  };
}

function renderRuntime(runtime: FireworksRuntime, state: RawWebGL2RenderState, gestures: GestureEvent[]): void {
  applyGestures(runtime, state, gestures);
  const dt = Math.min(1 / 20, Math.max(0, state.deltaSeconds));
  runtime.trailEnergy = Math.max(0, runtime.trailEnergy - dt * 0.1);
  updateActors(runtime, dt);
  if (runtime.mode === 'stream') {
    runtime.finaleAccumulator += dt * runtime.settings.autoFinaleRate;
    while (runtime.finaleAccumulator >= 1) {
      runtime.finaleAccumulator -= 1;
      queueLaunch(runtime, state, state.width * (0.16 + nextRandom(runtime) * 0.68), state.height * (0.12 + nextRandom(runtime) * 0.36), 0);
    }
  }
  ensureTrail(runtime, state);
  runGpuSteps(runtime, state, dt);
  drawTrailAndComposite(runtime, state);
}

function runGpuSteps(runtime: FireworksRuntime, state: RawWebGL2RenderState, dt: number): void {
  let passes = 0;
  const first = runtime.queuedSpawns.shift();
  runStepPass(runtime, state, dt, first);
  passes += 1;
  for (let index = 0; index < MAX_SPAWNS_PER_FRAME - 1 && runtime.queuedSpawns.length > 0; index += 1) {
    runStepPass(runtime, state, 0, runtime.queuedSpawns.shift());
    passes += 1;
  }
  runtime.lastGpuPasses = passes + 3;
}

function runStepPass(runtime: FireworksRuntime, state: RawWebGL2RenderState, dt: number, spawn: SpawnCommand | undefined): void {
  const gl = state.gl;
  const stateSize = runtime.particleState;
  let spawnStart = 0;
  let spawnCount = 0;
  if (spawn) {
    spawnCount = Math.max(1, Math.min(stateSize.capacity, Math.floor(spawn.count)));
    if (runtime.spawnCursor + spawnCount >= stateSize.capacity) runtime.spawnCursor = 0;
    spawnStart = runtime.spawnCursor;
    runtime.spawnCursor += spawnCount;
  }
  runtime.particleState.bindWriteFramebuffer();
  runtime.stepPass.render({
    width: stateSize.width,
    height: stateSize.height,
    preserveFramebuffer: true,
    bind: (_gl, _program, uniform) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, stateSize.positions.read.texture.texture);
      gl.uniform1i(uniform('uPosition'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, stateSize.velocities.read.texture.texture);
      gl.uniform1i(uniform('uVelocity'), 1);
      gl.uniform2i(uniform('uStateSize'), stateSize.width, stateSize.height);
      gl.uniform4f(uniform('uWorldBounds'), 0, 0, state.width, state.height);
      gl.uniform1f(uniform('uDt'), dt);
      gl.uniform1f(uniform('uGravity'), runtime.settings.gravity);
      gl.uniform1f(uniform('uDamping'), runtime.settings.airDrag);
      gl.uniform1f(uniform('uTime'), state.timeSeconds);
      gl.uniform1f(uniform('uSpawnActive'), spawn ? 1 : 0);
      gl.uniform1f(uniform('uSpawnStart'), spawnStart);
      gl.uniform1f(uniform('uSpawnCount'), spawnCount);
      gl.uniform2f(uniform('uSpawnPosition'), spawn?.x ?? 0, spawn?.y ?? 0);
      gl.uniform2f(uniform('uSpawnVelocity'), spawn?.vx ?? 0, spawn?.vy ?? 0);
      gl.uniform1f(uniform('uSpawnKind'), spawn?.kind ?? 0);
      gl.uniform1f(uniform('uSpawnSeed'), spawn?.seed ?? 0);
      gl.uniform1f(uniform('uSpawnPaletteSeed'), spawn?.paletteSeed ?? 0);
      gl.uniform1f(uniform('uSpawnPower'), spawn?.kind === SHELL_KIND ? Math.max(0.12, spawn.power) : spawn?.power ?? 0);
      gl.uniform1f(uniform('uBurstChaos'), runtime.settings.burstChaos);
    },
  });
  runtime.particleState.unbindWriteFramebuffer();
  runtime.particleState.swap();
}

function drawTrailAndComposite(runtime: FireworksRuntime, state: RawWebGL2RenderState): void {
  if (!runtime.trail) return;
  const gl = state.gl;
  const background = resolveSideViewPaletteBackdrop(state.style, 'ultra', [0.02, 0.03, 0.085]).base;
  const uniforms = state.style?.uniforms ?? {};
  const glowBias = numberUniform(uniforms, 'glowBias', 1);
  const colorShift = numberUniform(uniforms, 'colorShift', 0.2);
  const skyLift = numberUniform(uniforms, 'skyLift', 0.04);
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
  runtime.pointRenderer.render({
    particleState: runtime.particleState,
    target: runtime.trail.write.framebuffer,
    width: state.width,
    height: state.height,
    worldBounds: [0, 0, state.width, state.height],
    particleSize: runtime.settings.particleSize,
    sparkSizeVariability: runtime.settings.sparkSizeVariability,
    crackle: runtime.settings.crackleIntensity,
    glowBias,
    colorShift,
    time: state.timeSeconds,
    palette: state.style?.palette ?? [0xffffff, 0xffd166, 0xff4d6d, 0x4dffcf, 0x8fb3ff],
  });
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
    },
  });
  runtime.pointRenderer.render({
    particleState: runtime.particleState,
    target: null,
    width: state.width,
    height: state.height,
    worldBounds: [0, 0, state.width, state.height],
    particleSize: runtime.settings.particleSize * 0.62,
    sparkSizeVariability: runtime.settings.sparkSizeVariability,
    crackle: runtime.settings.crackleIntensity,
    glowBias,
    colorShift,
    time: state.timeSeconds,
    palette: state.style?.palette ?? [0xffffff, 0xffd166, 0xff4d6d, 0x4dffcf, 0x8fb3ff],
  });
}

function ensureTrail(runtime: FireworksRuntime, state: RawWebGL2RenderState): void {
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

function updateActors(runtime: FireworksRuntime, dt: number): void {
  const survivors: ShellActor[] = [];
  for (const actor of runtime.actors) {
    actor.age += dt;
    if (actor.age >= actor.fuse) {
      const popState = shellPosition(runtime, actor, actor.fuse);
      const x = actor.targetX ?? popState.x;
      const y = actor.targetY ?? popState.y;
      queueExplosion(runtime, x, y, actor, popState.vx, popState.vy);
    } else {
      const position = shellPosition(runtime, actor, actor.age);
      queueShellWake(runtime, actor, position.x, position.y, dt);
      survivors.push(actor);
    }
  }
  runtime.actors = survivors.slice(-96);
}

function shellPosition(runtime: FireworksRuntime, actor: ShellActor, age: number): { x: number; y: number; vx: number; vy: number } {
  return {
    x: actor.x + actor.vx * age,
    y: actor.y + actor.vy * age + runtime.settings.gravity * age * age * 0.5,
    vx: actor.vx,
    vy: actor.vy + runtime.settings.gravity * age,
  };
}

function queueShellWake(runtime: FireworksRuntime, actor: ShellActor, x: number, y: number, dt: number): void {
  const speed = Math.hypot(actor.vx, actor.vy);
  const generationRate = actor.generation === 0 ? 26 : 16;
  const speedRate = clamp(speed / 900, 0.65, 1.7);
  actor.wakeAccumulator += dt * generationRate * speedRate;
  const emissions = Math.min(2, Math.floor(actor.wakeAccumulator));
  if (emissions <= 0) return;
  actor.wakeAccumulator -= emissions;

  const currentVy = actor.vy + runtime.settings.gravity * actor.age;
  const speedLength = Math.max(1, Math.hypot(actor.vx, currentVy));
  const backX = -actor.vx / speedLength;
  const backY = -currentVy / speedLength;
  for (let index = 0; index < emissions; index += 1) {
    const seed = actor.seed + actor.age * 997 + index * 37;
    const offset = 3 + nextRandom(runtime) * 9;
    runtime.queuedSpawns.push({
      x: x + backX * offset + signedRandom(runtime) * 2.6,
      y: y + backY * offset + signedRandom(runtime) * 2.6,
      vx: backX * (18 + nextRandom(runtime) * 34) + signedRandom(runtime) * 12,
      vy: backY * (18 + nextRandom(runtime) * 34) + signedRandom(runtime) * 12,
      count: actor.generation === 0 ? 4 : 2,
      kind: SHELL_WAKE_KIND,
      seed,
      paletteSeed: actor.paletteSeed,
      power: 18,
    });
  }
  runtime.trailEnergy = 1;
}

function queueExplosion(runtime: FireworksRuntime, x: number, y: number, actor: ShellActor, parentVx: number, parentVy: number): void {
  const kind = 1 + Math.floor(nextRandom(runtime) * EXPLOSION_KIND_COUNT);
  const generationScale = generationScaleFor(runtime, actor.generation);
  const burstSizeScale = burstSizeScaleFor(runtime, kind);
  const physicalScale = generationScale * burstSizeScale;
  const burstPower = runtime.settings.explosionPower * physicalScale;
  const particleInherit = particleVelocityInheritance(actor.generation);
  const childInherit = childVelocityInheritance(actor.generation);
  runtime.queuedSpawns.push({
    x,
    y,
    vx: parentVx * particleInherit,
    vy: parentVy * particleInherit,
    count: particleCountForBurst(runtime, actor.generation, physicalScale),
    kind,
    seed: actor.seed + actor.generation * 211.13,
    paletteSeed: actor.paletteSeed,
    power: burstPower,
  });
  runtime.explosions += 1;
  runtime.trailEnergy = 1;

  const depth = Math.floor(runtime.settings.secondaryDepth);
  if (actor.generation >= depth) return;
  const secondaryRolls = kind % 4 === 0 ? 4 : kind % 3 === 0 ? 3 : 2;
  const childGeneration = actor.generation + 1;
  const childPaletteSeed = paletteSeedForChild(actor.paletteSeed, childGeneration);
  for (let index = 0; index < secondaryRolls; index += 1) {
    if (nextRandom(runtime) > runtime.settings.secondaryChance) continue;
    const angle = -Math.PI * (0.18 + nextRandom(runtime) * 0.72);
    const speed = burstPower * (0.28 + nextRandom(runtime) * 0.38);
    const vx = Math.cos(angle) * speed + parentVx * childInherit;
    const vy = Math.sin(angle) * speed + parentVy * childInherit;
    queueActor(runtime, x, y, vx, vy, childGeneration, 0.42 + nextRandom(runtime) * 0.72, undefined, undefined, childPaletteSeed);
    runtime.secondaryActors += 1;
  }
}

function particleVelocityInheritance(generation: number): number {
  return generation === 0 ? 0.26 : 0.38;
}

function childVelocityInheritance(generation: number): number {
  return generation === 0 ? 0.24 : 0.34;
}

function particleCountForBurst(runtime: FireworksRuntime, generation: number, physicalScale: number): number {
  const minimum = generation === 0 ? 42 : 14;
  const randomJitter = 0.82 + nextRandom(runtime) * 0.36;
  return Math.max(minimum, Math.round(runtime.settings.burstParticles * clamp(physicalScale, 0.12, 2.75) * randomJitter));
}

function burstSizeScaleFor(runtime: FireworksRuntime, kind: number): number {
  const patternScale = burstPatternScale(kind);
  const roll = nextRandom(runtime);
  const macroScale = roll < 0.14
    ? 0.44 + nextRandom(runtime) * 0.28
    : roll > 0.84
      ? 1.22 + nextRandom(runtime) * 0.58
      : 0.76 + nextRandom(runtime) * 0.48;
  const detailScale = 0.9 + nextRandom(runtime) * 0.22;
  return clamp(patternScale * macroScale * detailScale, 0.32, 1.95);
}

function burstPatternScale(kind: number): number {
  if (kind === 7 || kind === 21 || kind === 26 || kind === 30) return 0.72;
  if (kind === 8 || kind === 10 || kind === 16 || kind === 22 || kind === 32) return 0.88;
  if (kind === 3 || kind === 5 || kind === 11 || kind === 18 || kind === 25 || kind === 27 || kind === 31) return 1.22;
  if (kind === 4 || kind === 13 || kind === 17 || kind === 24 || kind === 28) return 1.08;
  return 1;
}

function generationScaleFor(runtime: FireworksRuntime, generation: number): number {
  if (generation <= 0) return 1;
  return Math.pow(clamp(runtime.settings.secondaryScale, 0.05, 1), generation);
}

function paletteSeedForChild(parentPaletteSeed: number, generation: number): number {
  return parentPaletteSeed + generation * 137.29 + Math.floor(parentPaletteSeed * 0.013) * 17;
}

function queueLaunch(runtime: FireworksRuntime, state: Pick<RawWebGL2RenderState, 'width' | 'height'>, targetX: number, targetY: number, generation: number): void {
  const solution = solveFireworkLaunchForTarget({
    width: state.width,
    height: state.height,
    targetX,
    targetY,
    launchPower: runtime.settings.launchPower,
    launchSpread: runtime.settings.launchSpread,
    shellFuse: runtime.settings.shellFuse,
    gravity: runtime.settings.gravity,
    offsetRandom: signedRandom(runtime),
    fuseRandom: nextRandom(runtime),
  });
  queueActor(runtime, solution.launchX, solution.launchY, solution.vx, solution.vy, generation, solution.fuse, solution.targetX, solution.targetY);
}

export function solveFireworkLaunchForTarget(input: FireworksLaunchInput): FireworksLaunchSolution {
  const targetX = clamp(input.targetX, 0, input.width);
  const targetY = clamp(input.targetY, 0, input.height);
  const spread = clamp(input.launchSpread, 0, 1);
  const launcherSpread = Math.min(input.width * 0.28, Math.max(24, input.launchPower * (0.08 + spread * 0.24)));
  const launchX = clamp(targetX + input.offsetRandom * launcherSpread, 0, input.width);
  const launchY = input.height + 12;
  const heightBias = 1 - clamp(targetY / Math.max(1, input.height), 0, 0.85) * 0.25;
  const powerFuseScale = clamp(940 / Math.max(1, input.launchPower), 0.62, 1.42);
  const fuseVariance = 0.9 + clamp(input.fuseRandom, 0, 1) * 0.2;
  const fuse = Math.max(0.24, input.shellFuse * heightBias * powerFuseScale * fuseVariance);
  const vx = (targetX - launchX) / fuse;
  const vy = (targetY - launchY - 0.5 * input.gravity * fuse * fuse) / fuse;

  return { launchX, launchY, vx, vy, fuse, targetX, targetY };
}

function queueActor(
  runtime: FireworksRuntime,
  x: number,
  y: number,
  vx: number,
  vy: number,
  generation: number,
  fuse: number,
  targetX?: number,
  targetY?: number,
  paletteSeed?: number,
): void {
  const seed = nextRandom(runtime) * 10000 + runtime.launches * 17;
  const resolvedPaletteSeed = paletteSeed ?? nextRandom(runtime) * 50000 + runtime.launches * 31;
  const actor: ShellActor = { x, y, vx, vy, age: 0, fuse, generation, seed, paletteSeed: resolvedPaletteSeed, wakeAccumulator: 0 };
  if (targetX !== undefined && targetY !== undefined) {
    actor.targetX = targetX;
    actor.targetY = targetY;
  }
  runtime.actors.push(actor);
  runtime.queuedSpawns.push({ x, y, vx, vy, count: 1, kind: SHELL_KIND, seed, paletteSeed: resolvedPaletteSeed, power: fuse });
  runtime.launches += 1;
  runtime.trailEnergy = 1;
  if (runtime.actors.length > 128) runtime.actors = runtime.actors.slice(-128);
}

function applyGestures(runtime: FireworksRuntime, state: RawWebGL2RenderState, gestures: GestureEvent[]): void {
  const syntheticGestures = gestures.filter((gesture) => gesture.id === undefined || gesture.id < 0);
  for (const command of fireworksInputCommandsForMode(runtime.mode, syntheticGestures, state.width, state.height)) {
    queueLaunch(runtime, state, command.x, command.y, 0);
  }
}

export function fireworksInputCommandsForMode(mode: string | null, gestures: readonly GestureEvent[], width: number, height: number): FireworksInputCommand[] {
  const activeMode = fireworksModeFromString(mode);
  const commands: FireworksInputCommand[] = [];
  const doubleTapPointerIds = new Set<number>();
  for (const gesture of gestures) {
    if (gesture.kind === 'double_tap' && gesture.id !== undefined) doubleTapPointerIds.add(gesture.id);
  }

  for (const gesture of gestures) {
    if (gesture.kind === 'hold') continue;
    if (gesture.kind === 'tap' && gesture.id !== undefined && doubleTapPointerIds.has(gesture.id)) continue;

    if (gesture.kind === 'tap' || gesture.kind === 'double_tap') {
      commands.push({ action: 'launch', x: gesture.x, y: gesture.y });
    } else if (gesture.kind === 'drag') {
      if (activeMode !== 'stream') continue;
      const dx = gesture.dx ?? 0;
      const dy = gesture.dy ?? 0;
      commands.push({
        action: 'launch',
        x: clamp(gesture.x + dx * 0.25, 0, width),
        y: clamp(gesture.y + dy * 0.18, height * 0.08, height * 0.72),
      });
    } else if (gesture.kind === 'fast_swipe') {
      const dx = gesture.dx ?? 0;
      const dy = gesture.dy ?? 0;
      commands.push({
        action: 'launch',
        x: clamp(gesture.x + dx * 0.25, 0, width),
        y: clamp(gesture.y + dy * 0.18, height * 0.08, height * 0.72),
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

function shouldRenderRuntime(runtime: FireworksRuntime): boolean {
  return runtime.actors.length > 0 || runtime.queuedSpawns.length > 0 || runtime.trailEnergy > 0.015 || runtime.mode === 'stream';
}

function getRuntimeDebugStats(runtime: FireworksRuntime, state: RawWebGL2RenderState): Record<string, string | number | boolean | null> {
  const stats = rawGpuMetricsToDebugStats(createRawGpuSimulationMetrics({
    engine: 'fireworks-gpu-particles',
    stateWidth: runtime.particleState.width,
    stateHeight: runtime.particleState.height,
    stateTextures: 3,
    precision: runtime.particleState.precision,
    passesPerFrame: runtime.lastGpuPasses,
    cpuUploadBytesPerFrame: 0,
    capabilities: state.resources.capabilities,
  }));
  return {
    ...stats,
    rendering: 'gpu-ping-pong-points-plus-trail-feedback',
    cpuTopology: 'launch-actors-only',
    cpuUpload: false,
    mode: runtime.mode,
    activeShellActors: runtime.actors.length,
    queuedSpawnCommands: runtime.queuedSpawns.length,
    launches: runtime.launches,
    explosions: runtime.explosions,
    secondaryActors: runtime.secondaryActors,
    explosionKinds: EXPLOSION_KIND_COUNT,
  };
}

function fireworksModeFromString(mode: string | null): FireworksMode {
  if (mode === 'stream' || mode === 'finale') return 'stream';
  return 'single';
}

function nextRandom(runtime: FireworksRuntime): number {
  runtime.rngState = (runtime.rngState + 0x6d2b79f5) | 0;
  let t = runtime.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function signedRandom(runtime: FireworksRuntime): number {
  return nextRandom(runtime) * 2 - 1;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
