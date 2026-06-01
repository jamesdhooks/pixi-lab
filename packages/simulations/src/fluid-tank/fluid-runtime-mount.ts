// @ts-nocheck — this file is auto-generated from fluid-runtime-script.ts (converted JS);
// full TypeScript annotation of 1800 lines of GPU simulation code is deferred.
import type { DomMountContext } from '@hooksjam/pixi-lab-core';

export function mountFluidRuntime(root: HTMLDivElement, ctx: DomMountContext): () => void {
  let pixiApp: import('pixi.js').Application | null = null;
  const unsubs: Array<() => void> = [];

  (async () => {
      const fluidCanvas = root.querySelector('#runtime-canvas');
      const pixiLayer = root.querySelector('#pixi-layer');
      const fallback = root.querySelector('#fallback');
      const fpsEl = root.querySelector('#fps');
      const gridEl = root.querySelector('#grid');
      const modeEl = root.querySelector('#mode');
      const stirsEl = root.querySelector('#stirs');
      const controls = root.querySelector('#controls');

      const ui = {
        cellSize: root.querySelector('#cellSize'),
        fingerForce: root.querySelector('#fingerForce'),
        fingerRadius: root.querySelector('#fingerRadius'),
        viscosity: root.querySelector('#viscosity'),
        curl: root.querySelector('#curl'),
        eddy: root.querySelector('#eddy'),
        dyePersistence: root.querySelector('#dyePersistence'),
        pressure: root.querySelector('#pressure'),
        cellSizeValue: root.querySelector('#cellSizeValue'),
        forceValue: root.querySelector('#forceValue'),
        radiusValue: root.querySelector('#radiusValue'),
        viscosityValue: root.querySelector('#viscosityValue'),
        curlValue: root.querySelector('#curlValue'),
        eddyValue: root.querySelector('#eddyValue'),
        dyeValue: root.querySelector('#dyeValue'),
        pressureValue: root.querySelector('#pressureValue'),
        randomizeBtn: root.querySelector('#randomizeBtn'),
        settleBtn: root.querySelector('#settleBtn'),
        ambientBtn: root.querySelector('#ambientBtn'),
        resetBtn: root.querySelector('#resetBtn')
      };

      const DEFAULTS = {
        cellSize: "1.20",
        fingerForce: "8",
        fingerRadius: "0.026",
        viscosity: "0.22",
        curl: "6",
        eddy: "0.00",
        dyePersistence: "0.9996",
        pressure: "24"
      };

      const CONFIG = {
        CELL_SIZE: 1.2,
        SIM_RESOLUTION: 183,
        DYE_RESOLUTION: 792,
        VELOCITY_DISSIPATION: 0.986,
        DENSITY_DISSIPATION: 0.9996,
        PRESSURE_ITERATIONS: 24,
        CURL: 6.0,
        STIR_RADIUS: 0.026,
        FINGER_FORCE: 8.0,
        EDDY_ASSIST: 0.0,
        INJECT_COLOR_MODE: "style",
        EXPOSURE: 1.06,
        AMBIENT: false,
        INIT_MODE: "cloud",      // cloud | voronoi | random | image
        INIT_IMAGE_URL: ""       // only used when INIT_MODE === 'image'
      };

      const runtimeStyle = {
        palette: [0x75ffe6, 0x9dfff4, 0xbcecff],
        exposure: 1.06,
        paletteStrength: 0.76
      };
      let interactionMode = "stir";

      function applyRuntimeSettingsPayload(payload, changedKey = null) {
        if (!payload || typeof payload !== "object") return false;
        let needsRebuild = false;

        const cellSize = Number(payload.cellSize);
        const currentCellSize = CONFIG.CELL_SIZE;
        if (Number.isFinite(cellSize) && (changedKey === null || changedKey === "cellSize")) {
          ui.cellSize.value = String(cellSize);
          needsRebuild = changedKey === "cellSize" && Math.abs(currentCellSize - cellSize) > 0.0001;
        }

        const fingerForce = Number(payload.fingerForce);
        if (Number.isFinite(fingerForce)) ui.fingerForce.value = String(fingerForce);

        const fingerRadius = Number(payload.fingerRadius);
        if (Number.isFinite(fingerRadius)) ui.fingerRadius.value = String(fingerRadius);

        const viscosity = Number(payload.viscosity);
        if (Number.isFinite(viscosity)) ui.viscosity.value = String(viscosity);

        const curl = Number(payload.curl);
        if (Number.isFinite(curl)) ui.curl.value = String(curl);

        const eddyAssist = Number(payload.eddyAssist);
        if (Number.isFinite(eddyAssist)) ui.eddy.value = String(eddyAssist);

        const dyePersistence = Number(payload.dyePersistence);
        if (Number.isFinite(dyePersistence)) ui.dyePersistence.value = String(dyePersistence);

        const pressureIterations = Number(payload.pressureIterations);
        if (Number.isFinite(pressureIterations)) ui.pressure.value = String(Math.round(pressureIterations));

        const injectPalette = String(payload.injectPalette ?? "style");
        if (
          injectPalette === "style" ||
          injectPalette === "cyan" ||
          injectPalette === "magenta" ||
          injectPalette === "amber" ||
          injectPalette === "rainbow"
        ) {
          CONFIG.INJECT_COLOR_MODE = injectPalette;
        }

        if (typeof payload.ambient === "boolean") {
          CONFIG.AMBIENT = payload.ambient;
        }

        const initMode = String(payload.initMode ?? "");
        if (["cloud", "voronoi", "random", "image"].includes(initMode)) {
          CONFIG.INIT_MODE = initMode;
        }

        const initImageUrl = typeof payload.initImageUrl === "string" ? payload.initImageUrl.trim() : "";
        if (initImageUrl) {
          CONFIG.INIT_IMAGE_URL = initImageUrl;
          // If a URL was just set, promote mode to image automatically
          CONFIG.INIT_MODE = "image";
        }

        return needsRebuild;
      }



      function unpackColor(hex) {
        const value = Number(hex) || 0xffffff;
        return [
          ((value >> 16) & 255) / 255,
          ((value >> 8) & 255) / 255,
          (value & 255) / 255
        ];
      }

      function rgbToHue(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        if (d < 0.0001) return 0.0; // achromatic — default to red hue
        let h;
        if (max === r) h = ((g - b) / d + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        return h / 6.0;
      }

      function hsvToRgb(h, s, v) {
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (i % 6) {
          case 0: return [v, t, p];
          case 1: return [q, v, p];
          case 2: return [p, v, t];
          case 3: return [p, q, v];
          case 4: return [t, p, v];
          default: return [v, p, q];
        }
      }

      function applyRuntimeStylePayload(payload) {
        if (!payload) return;
        if (Array.isArray(payload.palette) && payload.palette.length > 0) {
          runtimeStyle.palette = payload.palette.slice(0, 4);
        }
        const uniforms = payload.uniforms || {};
        runtimeStyle.exposure = Number(uniforms.exposure ?? runtimeStyle.exposure);
        runtimeStyle.paletteStrength = Number(uniforms.paletteStrength ?? runtimeStyle.paletteStrength);
      }



      // Read initial state synchronously (before any async work).
      // NOTE: applyControlValues() is intentionally NOT called here — it references
      // BASE_SIM_RESOLUTION (declared later) and would throw a TDZ ReferenceError.
      // The onSettingsChange callback below handles the initial delivery after the
      // IIFE has run past all const declarations.
      applyRuntimeStylePayload(ctx.getStyle());
      applyRuntimeSettingsPayload(ctx.getSettings());
      updateModeLabel();

      // Subscribe to future changes
      unsubs.push(
        ctx.onStyleChange((payload) => {
          applyRuntimeStylePayload(payload);
          if (simReady) initDyeField();
        }),
        ctx.onSettingsChange((all, change) => {
          const needsRebuild = applyRuntimeSettingsPayload(all, change?.key ?? undefined);
          if (simReady) {
            applyControlValues();
            updateModeLabel();
            if (needsRebuild) scheduleRebuild();
          }
        }),
        ctx.onReset(() => {
          if (simReady) resetGentleDefaults();
        }),
        ctx.onModeChange((mode) => {
          interactionMode = mode === "inject" ? "inject" : "stir";
          if (simReady) updateModeLabel();
        }),
      );

      // Guard flag: true only after dye/velocity are initialized (post-await).
      // Callbacks that fire before init completes should skip simulation ops.
      let simReady = false;

      const BASE_SIM_RESOLUTION = 220;
      const BASE_DYE_RESOLUTION = 950;

      let stirs = 0;
      let elapsed = 0;
      let lastAmbient = 0;
      let seed = Math.random() * 1000;
      let rebuildTimer = null;
      let resizeDebounce = null;
      const activePointers = new Map();
      const ripples = [];

      function showFallback() {
        fallback.style.display = "flex";
      }

      function getDpr() {
        return Math.min(window.devicePixelRatio || 1, 2);
      }

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function lerp(a, b, t) {
        return a + (b - a) * t;
      }

      function randomBetween(min, max) {
        return min + Math.random() * (max - min);
      }

      function clamp01(value) {
        return clamp(value, 0.001, 0.999);
      }

      const app = new PIXI.Application();
      pixiApp = app;

      await app.init({
        resizeTo: window,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: getDpr(),
        preference: "webgl"
      });

      pixiLayer.appendChild(app.canvas);
      app.canvas.style.cursor = "crosshair";

      const wallLayer = new PIXI.Graphics();
      const rippleLayer = new PIXI.Graphics();
      app.stage.addChild(wallLayer);
      app.stage.addChild(rippleLayer);

      const gl = fluidCanvas.getContext("webgl2", {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance"
      });

      if (!gl) {
        showFallback();
        return;
      }

      const colorBufferFloat = gl.getExtension("EXT_color_buffer_float");
      const linearFloat =
        gl.getExtension("OES_texture_float_linear") ||
        gl.getExtension("OES_texture_half_float_linear");

      if (!colorBufferFloat) {
        showFallback();
        return;
      }

      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);

      const baseVertexShader = `#version 300 es
        layout(location = 0) in vec2 aPosition;
        out vec2 vUv;

        void main() {
          vUv = aPosition * 0.5 + 0.5;
          gl_Position = vec4(aPosition, 0.0, 1.0);
        }
      `;

      const clearShader = `#version 300 es
        precision highp float;
        in vec2 vUv;
        out vec4 outColor;
        uniform float value;

        void main() {
          outColor = vec4(value, value, value, 1.0);
        }
      `;

      const initDyeShader = `#version 300 es
        precision highp float;
        in vec2 vUv;
        out vec4 outColor;

        uniform vec2 resolution;
        uniform float seed;
        uniform float cellSize;
        // Palette is passed as hues (0-1) so vivid brightness is always guaranteed,
        // regardless of how dark the source hex color is (e.g. 0x3311ff).
        uniform float paletteHue0;
        uniform float paletteHue1;
        uniform float paletteHue2;
        uniform float paletteHue3;
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

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        // Branchless hue lookup — all four uniforms always referenced,
        // preventing dead-code elimination on aggressive GPU drivers.
        float hueAt(float index) {
          float h = paletteHue0;
          h = mix(h, paletteHue1, step(1.0, index));
          h = mix(h, paletteHue2, step(2.0, index));
          h = mix(h, paletteHue3, step(3.0, index));
          return h;
        }

        void promoteTop(inout float primaryW, inout float primaryI, inout float secondaryW, inout float secondaryI, float weight, float index) {
          if (weight > primaryW) {
            secondaryW = primaryW;
            secondaryI = primaryI;
            primaryW = weight;
            primaryI = index;
          } else if (weight > secondaryW) {
            secondaryW = weight;
            secondaryI = index;
          }
        }

        void main() {
          float aspect = resolution.x / resolution.y;
          float scale = 1.0 / max(cellSize, 0.35);
          vec2 p = vUv * vec2(aspect, 1.0);
          vec2 s1 = vec2(seed * 1.37, seed * 2.11);
          vec2 s2 = vec2(seed * 3.19, seed * 0.73);

          float cloudA = fbm(p * 1.7 * scale + s1 * 0.31 + vec2(4.1, -2.8));
          float cloudB = fbm(p * 3.05 * scale - s2 * 0.27 + vec2(-6.2, 3.9));
          float cloudC = fbm(p * 5.4 * scale + s1 * 0.13 - s2 * 0.09 + vec2(2.4, 7.1));
          float cloudD = fbm(p * 2.45 * scale - s1 * 0.21 + s2 * 0.14 + vec2(-4.9, -1.7));
          float mist   = fbm(p * 11.2 * scale + s2 * 0.53);

          float w0 = pow(0.04 + cloudA, 5.6);
          float w1 = pow(0.04 + cloudB, 5.6);
          float w2 = pow(0.04 + cloudC, 5.6);
          float w3 = pow(0.04 + cloudD, 5.6);

          float primaryW = -1.0; float secondaryW = -1.0;
          float primaryI = 0.0;  float secondaryI = 1.0;
          promoteTop(primaryW, primaryI, secondaryW, secondaryI, w0, 0.0);
          promoteTop(primaryW, primaryI, secondaryW, secondaryI, w1, 1.0);
          promoteTop(primaryW, primaryI, secondaryW, secondaryI, w2, 2.0);
          promoteTop(primaryW, primaryI, secondaryW, secondaryI, w3, 3.0);

          // Use the dominant region's hue directly — no cross-hue blending.
          // Blending toward a secondary hue on the "short arc" often passes through
          // red (e.g. pink→amber crosses 0°/red), inserting colours not in the palette.
          // Instead we modulate saturation at region boundaries to give soft transitions
          // without introducing spurious hues.
          float purity     = smoothstep(0.28, 0.86, primaryW / max(primaryW + secondaryW, 0.0001));
          float hue        = hueAt(primaryI);

          // Saturation and brightness are always high — mirrors the reference fluids.html
          // approach. Dark palette chips (e.g. 0x3311ff) produce vivid blue-violet because
          // we use only the hue, not the dim RGB value.
          float region     = smoothstep(0.2, 0.8, cloudA * 0.55 + cloudB * 0.3 + cloudC * 0.15);
          float saturation = clamp((0.78 + 0.20 * cloudC + 0.22 * paletteStrength) * (0.72 + 0.28 * purity), 0.0, 1.0);
          float brightness = 1.05 + 0.40 * region + 0.14 * mist; // HDR, tone-mapped by display

          outColor = vec4(hsv2rgb(vec3(hue, saturation, brightness)), 1.0);
        }
      `;

      const splatShader = `#version 300 es
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
        }
      `;

      const advectionShader = `#version 300 es
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
        }
      `;

      const boundaryShader = `#version 300 es
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

          if (left < texelSize.x || right < texelSize.x) {
            velocity.x = 0.0;
          }

          if (bottom < texelSize.y || top < texelSize.y) {
            velocity.y = 0.0;
          }

          velocity *= mix(wallDamping, 1.0, wall);
          outColor = vec4(velocity, 0.0, 1.0);
        }
      `;

      const divergenceShader = `#version 300 es
        precision highp float;
        precision highp sampler2D;
        in vec2 vUv;
        out vec4 outColor;

        uniform sampler2D uVelocity;
        uniform vec2 texelSize;

        vec2 velocityAt(vec2 uv) {
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            return vec2(0.0);
          }

          return texture(uVelocity, uv).xy;
        }

        void main() {
          float L = velocityAt(vUv - vec2(texelSize.x, 0.0)).x;
          float R = velocityAt(vUv + vec2(texelSize.x, 0.0)).x;
          float B = velocityAt(vUv - vec2(0.0, texelSize.y)).y;
          float T = velocityAt(vUv + vec2(0.0, texelSize.y)).y;

          float divergence = 0.5 * (R - L + T - B);
          outColor = vec4(divergence, 0.0, 0.0, 1.0);
        }
      `;

      const curlShader = `#version 300 es
        precision highp float;
        precision highp sampler2D;
        in vec2 vUv;
        out vec4 outColor;

        uniform sampler2D uVelocity;
        uniform vec2 texelSize;

        vec2 velocityAt(vec2 uv) {
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            return vec2(0.0);
          }

          return texture(uVelocity, uv).xy;
        }

        void main() {
          float L = velocityAt(vUv - vec2(texelSize.x, 0.0)).y;
          float R = velocityAt(vUv + vec2(texelSize.x, 0.0)).y;
          float B = velocityAt(vUv - vec2(0.0, texelSize.y)).x;
          float T = velocityAt(vUv + vec2(0.0, texelSize.y)).x;
          float curl = R - L - T + B;
          outColor = vec4(curl, 0.0, 0.0, 1.0);
        }
      `;

      const vorticityShader = `#version 300 es
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

          vec2 velocity = texture(uVelocity, vUv).xy;
          velocity += force * dt;
          velocity = clamp(velocity, vec2(-260.0), vec2(260.0));
          outColor = vec4(velocity, 0.0, 1.0);
        }
      `;

      const pressureShader = `#version 300 es
        precision highp float;
        precision highp sampler2D;
        in vec2 vUv;
        out vec4 outColor;

        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        uniform vec2 texelSize;

        float pressureAt(vec2 uv) {
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            return 0.0;
          }

          return texture(uPressure, uv).x;
        }

        void main() {
          float L = pressureAt(vUv - vec2(texelSize.x, 0.0));
          float R = pressureAt(vUv + vec2(texelSize.x, 0.0));
          float B = pressureAt(vUv - vec2(0.0, texelSize.y));
          float T = pressureAt(vUv + vec2(0.0, texelSize.y));
          float divergence = texture(uDivergence, vUv).x;
          float pressure = (L + R + B + T - divergence) * 0.25;
          outColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
      `;

      const gradientSubtractShader = `#version 300 es
        precision highp float;
        precision highp sampler2D;
        in vec2 vUv;
        out vec4 outColor;

        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;

        float pressureAt(vec2 uv) {
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            return 0.0;
          }

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
        }
      `;

      const displayShader = `#version 300 es
        precision highp float;
        precision highp sampler2D;
        in vec2 vUv;
        out vec4 outColor;

        uniform sampler2D uTexture;
        uniform vec2 texelSize;
        uniform vec2 resolution;
        uniform float exposure;
        uniform float time;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
          vec3 c = texture(uTexture, vUv).rgb;

          vec3 glow = vec3(0.0);
          glow += texture(uTexture, vUv + vec2( 2.0,  0.0) * texelSize).rgb;
          glow += texture(uTexture, vUv + vec2(-2.0,  0.0) * texelSize).rgb;
          glow += texture(uTexture, vUv + vec2( 0.0,  2.0) * texelSize).rgb;
          glow += texture(uTexture, vUv + vec2( 0.0, -2.0) * texelSize).rgb;
          glow *= 0.075;

          c += glow;
          float preToneBlue = smoothstep(0.015, 0.16, c.b - max(c.r, c.g));
          c += vec3(0.0, 0.012, 0.085) * preToneBlue;
          c = 1.0 - exp(-c * exposure);
          c = pow(c, vec3(0.9));
          float postToneBlue = smoothstep(0.015, 0.16, c.b - max(c.r, c.g));
          c = mix(c, vec3(c.r * 0.9 + 0.02, c.g * 0.94 + 0.035, max(c.b, 0.34)), postToneBlue * 0.46);

          float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
          float wallShadow = smoothstep(0.0, 0.035, edge);
          c *= 0.78 + 0.22 * wallShadow;

          float vignette = smoothstep(0.92, 0.20, distance(vUv, vec2(0.5)));
          c *= 0.82 + 0.18 * vignette;

          float grain = hash(vUv * resolution + time) - 0.5;
          c += grain * 0.012;

          outColor = vec4(max(c, 0.0), 1.0);
        }
      `;

      function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const message = gl.getShaderInfoLog(shader);
          gl.deleteShader(shader);
          throw new Error(message);
        }

        return shader;
      }

      function createProgram(vertexSource, fragmentSource) {
        const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          const message = gl.getProgramInfoLog(program);
          gl.deleteProgram(program);
          throw new Error(message);
        }

        return program;
      }

      function getUniforms(program) {
        const uniforms = {};
        const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

        for (let i = 0; i < count; i++) {
          const uniform = gl.getActiveUniform(program, i);
          const name = uniform.name.replace(/\[0\]$/, "");
          uniforms[name] = gl.getUniformLocation(program, name);
        }

        return uniforms;
      }

      class Program {
        constructor(fragmentSource) {
          this.program = createProgram(baseVertexShader, fragmentSource);
          this.uniforms = getUniforms(this.program);
        }

        bind() {
          gl.useProgram(this.program);
        }
      }

      let clearProgram;
      let splatProgram;
      let advectionProgram;
      let boundaryProgram;
      let divergenceProgram;
      let curlProgram;
      let vorticityProgram;
      let pressureProgram;
      let gradientSubtractProgram;
      let displayProgram;

      try {
        clearProgram = new Program(clearShader);
        splatProgram = new Program(splatShader);
        advectionProgram = new Program(advectionShader);
        boundaryProgram = new Program(boundaryShader);
        divergenceProgram = new Program(divergenceShader);
        curlProgram = new Program(curlShader);
        vorticityProgram = new Program(vorticityShader);
        pressureProgram = new Program(pressureShader);
        gradientSubtractProgram = new Program(gradientSubtractShader);
        displayProgram = new Program(displayShader);
      } catch (error) {
        console.error(error);
        showFallback();
        return;
      }

      const quadVAO = gl.createVertexArray();
      const quadBuffer = gl.createBuffer();

      gl.bindVertexArray(quadVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         3, -1,
        -1,  3
      ]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      const textureFilter = linearFloat ? gl.LINEAR : gl.NEAREST;
      const renderFormat = {
        internalFormat: gl.RGBA16F,
        format: gl.RGBA,
        type: gl.HALF_FLOAT
      };

      function createFBO(width, height, filter) {
        const texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          renderFormat.internalFormat,
          width,
          height,
          0,
          renderFormat.format,
          renderFormat.type,
          null
        );

        const fbo = gl.createFramebuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          texture,
          0
        );

        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

        if (status !== gl.FRAMEBUFFER_COMPLETE) {
          throw new Error("Framebuffer is incomplete: " + status);
        }

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return {
          texture,
          fbo,
          width,
          height,
          attach(unit) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            return unit;
          },
          dispose() {
            gl.deleteTexture(texture);
            gl.deleteFramebuffer(fbo);
          }
        };
      }

      function createDoubleFBO(width, height, filter) {
        let fbo1 = createFBO(width, height, filter);
        let fbo2 = createFBO(width, height, filter);

        return {
          width,
          height,
          get read() {
            return fbo1;
          },
          get write() {
            return fbo2;
          },
          swap() {
            const temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
          },
          dispose() {
            fbo1.dispose();
            fbo2.dispose();
          }
        };
      }

      function blit(target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);

        gl.viewport(
          0,
          0,
          target ? target.width : gl.drawingBufferWidth,
          target ? target.height : gl.drawingBufferHeight
        );

        gl.bindVertexArray(quadVAO);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      }

      function clearFBO(target, value = 0) {
        clearProgram.bind();
        gl.uniform1f(clearProgram.uniforms.value, value);
        blit(target);
      }

      function getResolution(baseResolution) {
        let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;

        if (!Number.isFinite(aspect) || aspect <= 0) {
          aspect = 1;
        }

        if (aspect < 1) {
          aspect = 1 / aspect;
        }

        const min = Math.round(baseResolution);
        const max = Math.round(baseResolution * aspect);

        if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
          return { width: max, height: min };
        }

        return { width: min, height: max };
      }

      let velocity;
      let dye;
      let pressure;
      let divergence;
      let curl;
      // Mark sim as ready once dye & velocity are in scope (set below after initFramebuffers)

      function disposeFramebuffers() {
        for (const target of [velocity, dye, pressure]) {
          if (target) {
            target.dispose();
          }
        }

        for (const target of [divergence, curl]) {
          if (target) {
            target.dispose();
          }
        }
      }

      function clearTarget(target) {
        clearFBO(target.read, 0);
        clearFBO(target.write, 0);
      }

      function initFramebuffers() {
        disposeFramebuffers();

        const simRes = getResolution(CONFIG.SIM_RESOLUTION);
        const dyeRes = getResolution(CONFIG.DYE_RESOLUTION);

        velocity = createDoubleFBO(simRes.width, simRes.height, textureFilter);
        dye = createDoubleFBO(dyeRes.width, dyeRes.height, textureFilter);
        pressure = createDoubleFBO(simRes.width, simRes.height, gl.NEAREST);
        divergence = createFBO(simRes.width, simRes.height, gl.NEAREST);
        curl = createFBO(simRes.width, simRes.height, gl.NEAREST);

        clearTarget(velocity);
        clearTarget(pressure);
        clearFBO(divergence, 0);
        clearFBO(curl, 0);

        gridEl.textContent = `${simRes.width}×${simRes.height} / ${dyeRes.width}×${dyeRes.height}`;
      }

      // ─── dye initialisation helpers ───────────────────────────────────────

      function uploadDyePixels(data, w, h) {
        gl.bindTexture(gl.TEXTURE_2D, dye.read.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.FLOAT, data);
        gl.bindTexture(gl.TEXTURE_2D, dye.write.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.FLOAT, data);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }

      function palHdrRgb(ci) {
        const pal = runtimeStyle.palette;
        const nc  = Math.max(1, pal.length);
        const hex = pal[Math.min(ci, nc - 1)];
        const hue = rgbToHue(((hex >> 16) & 0xff) / 255,
                              ((hex >>  8) & 0xff) / 255,
                              ( hex        & 0xff) / 255);
        return hsvToRgb(hue, 0.88, 1.28);
      }

      function makeFbmHelpers(seedVal) {
        const S = ((Math.abs(seedVal) * 1e6 + 1) >>> 0) || 0xdeadbeef;
        function h2(ix, iy) {
          let v = ((ix * 1619) ^ (iy * 31337) ^ S) >>> 0;
          v = (Math.imul(v ^ (v >>> 16), 0x45d9f3b)) >>> 0;
          v = (Math.imul(v ^ (v >>> 16), 0x45d9f3b)) >>> 0;
          return (v ^ (v >>> 16)) >>> 0;
        }
        function vn(x, y) {
          const ix = Math.floor(x), iy = Math.floor(y);
          const fx = x - ix, fy = y - iy;
          const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
          const N = 4294967296;
          const a = h2(ix,   iy  ) / N, bv = h2(ix + 1, iy  ) / N;
          const c = h2(ix,   iy+1) / N, dv = h2(ix + 1, iy+1) / N;
          return (a + (bv - a) * ux) * (1 - uy) + (c + (dv - c) * ux) * uy;
        }
        function fbm(x, y) {
          let v = 0, amp = 0.5;
          for (let i = 0; i < 4; i++) {
            v += amp * vn(x, y); x = x * 2.03 + 17.17; y = y * 2.03 + 31.71; amp *= 0.52;
          }
          return v;
        }
        function ss(a, b, x) {
          const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
          return t * t * (3 - 2 * t);
        }
        return { fbm, ss };
      }

      function initDyeCloud(w, h) {
        const data = new Float32Array(w * h * 4);
        const c0 = palHdrRgb(0), c1 = palHdrRgb(1), c2 = palHdrRgb(2);
        const { fbm, ss } = makeFbmHelpers(seed);
        const sc = 3.5 / Math.max(w, h);
        for (let py = 0; py < h; py++) {
          for (let px = 0; px < w; px++) {
            const nx = px * sc, ny = py * sc;
            const n1 = fbm(nx,       ny      );
            const n2 = fbm(nx + 7.3, ny + 4.1);
            const t1 = ss(0.46, 0.74, n1);
            const t2 = ss(0.50, 0.76, n2);
            let r = c0[0] + (c1[0] - c0[0]) * t1;
            let g = c0[1] + (c1[1] - c0[1]) * t1;
            let b = c0[2] + (c1[2] - c0[2]) * t1;
            r += (c2[0] - r) * t2; g += (c2[1] - g) * t2; b += (c2[2] - b) * t2;
            const idx = (py * w + px) * 4;
            data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 1.0;
          }
        }
        uploadDyePixels(data, w, h);
      }

      function initDyeVoronoi(w, h) {
        const pal = runtimeStyle.palette;
        const nc  = Math.max(1, pal.length);
        const hues = Array.from({ length: nc }, (_, ci) => {
          const hex = pal[ci];
          return rgbToHue(((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255);
        });
        // Seeded PRNG for seed placement
        let rng = ((Math.abs(seed) * 1e6 + 1) >>> 0) || 0xdeadbeef;
        const rand = () => {
          rng = (rng + 0x6D2B79F5) >>> 0;
          let t = Math.imul(rng ^ (rng >>> 15), 1 | rng);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const SEEDS_PER = 5;
        const total = nc * SEEDS_PER;
        const sx = new Float32Array(total), sy = new Float32Array(total), sh = new Float32Array(total);
        for (let i = 0; i < total; i++) {
          sx[i] = rand() * w; sy[i] = rand() * h; sh[i] = hues[i % nc];
        }
        const data = new Float32Array(w * h * 4);
        for (let py = 0; py < h; py++) {
          for (let px = 0; px < w; px++) {
            let minD = 1e30, hue = sh[0];
            for (let s = 0; s < total; s++) {
              const dx = px - sx[s], dy = py - sy[s];
              const d = dx*dx + dy*dy;
              if (d < minD) { minD = d; hue = sh[s]; }
            }
            const [r, g, b] = hsvToRgb(hue, 0.88, 1.28);
            const idx = (py * w + px) * 4;
            data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 1.0;
          }
        }
        uploadDyePixels(data, w, h);
      }

      function initDyeImage(w, h) {
        const url = CONFIG.INIT_IMAGE_URL;
        if (!url) { initDyeCloud(w, h); return; }

        // Canvas 2D has Y=0 at top; WebGL textures have Y=0 at bottom — flip rows.
        function canvasToFloat(raw) {
          const data = new Float32Array(w * h * 4);
          for (let py = 0; py < h; py++) {
            const srcRow = (h - 1 - py) * w; // flipped source row
            const dstRow = py * w;
            for (let px = 0; px < w; px++) {
              const s = (srcRow + px) * 4, d = (dstRow + px) * 4;
              const ri = raw[s]   / 255, gi = raw[s+1] / 255, bi = raw[s+2] / 255;
              const luma = ri * 0.2126 + gi * 0.7152 + bi * 0.0722;
              const boost = luma < 0.08 ? 1.5 : 1.0;
              data[d]   = ri * boost;
              data[d+1] = gi * boost;
              data[d+2] = bi * boost;
              data[d+3] = 1.0;
            }
          }
          return data;
        }

        function drawAndUpload(imgEl) {
          const c2d = Object.assign(document.createElement("canvas"), { width: w, height: h });
          const ctx2d = c2d.getContext("2d");
          ctx2d.drawImage(imgEl, 0, 0, w, h);
          const raw = ctx2d.getImageData(0, 0, w, h).data;
          if (dye) uploadDyePixels(canvasToFloat(raw), w, h);
        }

        function loadViaBlob(src) {
          const img = new Image();
          img.onload = () => drawAndUpload(img);
          img.onerror = () => { if (dye) initDyeCloud(dye.width, dye.height); };
          img.src = src;
        }

        // Try direct load first (works for same-origin / CORS-enabled hosts).
        // On failure, retry through corsproxy.io which re-serves with CORS headers.
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => drawAndUpload(img);
        img.onerror = () => {
          const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
          loadViaBlob(proxyUrl);
        };
        img.src = url;
      }

      function initDyeField() {
        const w = dye.width, h = dye.height;
        const mode = CONFIG.INIT_MODE === "random"
          ? (Math.random() < 0.5 ? "cloud" : "voronoi")
          : CONFIG.INIT_MODE;
        if (mode === "image") {
          initDyeImage(w, h);
        } else if (mode === "voronoi") {
          initDyeVoronoi(w, h);
        } else {
          initDyeCloud(w, h);
        }
      }

      function enforceVelocityBoundary() {
        boundaryProgram.bind();
        gl.uniform1i(boundaryProgram.uniforms.uVelocity, velocity.read.attach(0));
        gl.uniform2f(boundaryProgram.uniforms.texelSize, 1 / velocity.width, 1 / velocity.height);
        gl.uniform1f(boundaryProgram.uniforms.wallDamping, 0.08);
        blit(velocity.write);
        velocity.swap();
      }

      function settleVelocity() {
        clearTarget(velocity);
        clearTarget(pressure);
        clearFBO(divergence, 0);
        clearFBO(curl, 0);
      }

      function splatVelocity(x, y, vx, vy, radiusScale = 1, countStir = true) {
        splatProgram.bind();
        gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
        gl.uniform1f(splatProgram.uniforms.aspectRatio, velocity.width / velocity.height);
        gl.uniform3f(
          splatProgram.uniforms.color,
          vx * CONFIG.FINGER_FORCE,
          vy * CONFIG.FINGER_FORCE,
          0
        );
        gl.uniform2f(splatProgram.uniforms.point, clamp01(x), clamp01(y));
        const radius = CONFIG.STIR_RADIUS * radiusScale;
        gl.uniform1f(splatProgram.uniforms.radius, radius * radius);
        blit(velocity.write);
        velocity.swap();

        if (countStir) {
          stirs += 1;
          stirsEl.textContent = stirs.toString();
        }
      }

      function nextInjectColor(x, y, strength = 1) {
        const mode = CONFIG.INJECT_COLOR_MODE;
        let vivid;
        if (mode === "cyan") {
          vivid = [0.25, 1.0, 0.92];
        } else if (mode === "magenta") {
          vivid = [1.0, 0.26, 0.92];
        } else if (mode === "amber") {
          vivid = [1.0, 0.72, 0.2];
        } else if (mode === "rainbow") {
          vivid = hsvToRgb((elapsed * 0.14 + x * 0.52 + y * 0.31) % 1, 0.84, 1.0);
        } else {
          const palette = runtimeStyle.palette;
          const t = ((x * 0.71 + y * 0.29 + elapsed * 0.02) % 1 + 1) % 1;
          const span = Math.max(1, palette.length);
          const scaled = t * span;
          const idx = Math.floor(scaled) % span;
          const a = unpackColor(palette[idx] ?? 0x9dfff4);
          vivid = [a[0], a[1], a[2]];
        }
        const luma = vivid[0] * 0.2126 + vivid[1] * 0.7152 + vivid[2] * 0.0722;
        if (luma < 0.38) {
          // Scale up rather than additive lift: blue channels are already at 1.0
          // so additive lift can't raise luma — scale allows HDR values > 1.0
          // which is valid for RGBA16F dye targets.
          const scale = Math.min(0.38 / Math.max(luma, 0.025), 5.0);
          vivid = [vivid[0] * scale, vivid[1] * scale, vivid[2] * scale];
        }
        const amount = 0.24 + runtimeStyle.paletteStrength * 0.28 + strength * 0.14;
        return [vivid[0] * amount, vivid[1] * amount, vivid[2] * amount];
      }

      function injectDrop(x, y, vx, vy, strength = 1, countStir = true) {
        const radius = 0.78 + strength * 0.58;
        const spreadScale = 0.52 + strength * 0.44;
        const downBias = 0.62 + strength * 0.36;
        splatVelocity(x, y, vx * spreadScale, vy * spreadScale - downBias, radius, countStir);

        if (CONFIG.EDDY_ASSIST > 0) {
          splatVelocity(
            x,
            y,
            -(vy * spreadScale) * CONFIG.EDDY_ASSIST,
            (vx * spreadScale) * CONFIG.EDDY_ASSIST,
            radius * 1.2,
            false
          );
        }

        const dyeColor = nextInjectColor(x, y, strength);
        splatProgram.bind();
        gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
        gl.uniform1f(splatProgram.uniforms.aspectRatio, dye.width / dye.height);
        gl.uniform3f(splatProgram.uniforms.color, dyeColor[0], dyeColor[1], dyeColor[2]);
        gl.uniform2f(splatProgram.uniforms.point, clamp01(x), clamp01(y));
        gl.uniform1f(splatProgram.uniforms.radius, (CONFIG.STIR_RADIUS * radius * 0.95) ** 2);
        blit(dye.write);
        dye.swap();
      }

      function injectStroke(x, y, vx, vy, strength = 1, countStir = true) {
        const speed = Math.hypot(vx, vy);
        const segments = clamp(Math.ceil(speed / 1.8), 1, 3);
        const invLen = speed > 0.0001 ? 1 / speed : 0;
        const ux = vx * invLen;
        const uy = vy * invLen;
        const spacing = CONFIG.STIR_RADIUS * (0.65 + strength * 0.2);
        for (let i = 0; i < segments; i++) {
          const t = segments <= 1 ? 0 : i / (segments - 1);
          const px = x + ux * (t - 0.5) * spacing;
          const py = y + uy * (t - 0.5) * spacing;
          injectDrop(px, py, vx, vy, strength, countStir && i === segments - 1);
        }
      }

      function smallClickSwirl(x, y, screenX, screenY) {
        const count = 8;
        const strength = 0.55;

        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          const radius = randomBetween(CONFIG.STIR_RADIUS * 0.35, CONFIG.STIR_RADIUS * 0.9);
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius;
          const tangentX = -Math.sin(angle) * strength;
          const tangentY = Math.cos(angle) * strength;
          splatVelocity(px, py, tangentX, tangentY, 0.85, i === 0);
        }

        ripples.push({
          x: screenX,
          y: screenY,
          radius: 5,
          life: 0.8
        });
      }

      function seedRestingMotion() {
        for (let i = 0; i < 7; i++) {
          const angle = Math.random() * Math.PI * 2;
          splatVelocity(
            Math.random(),
            Math.random(),
            Math.cos(angle) * randomBetween(0.35, 0.75),
            Math.sin(angle) * randomBetween(0.35, 0.75),
            randomBetween(1.4, 2.4),
            false
          );
        }
      }

      function randomizeFluid() {
        seed = Math.random() * 1000;
        stirs = 0;
        stirsEl.textContent = "0";
        settleVelocity();
        initDyeField();
        seedRestingMotion();
      }

      function drawTankFrame() {
        const w = app.renderer.width / app.renderer.resolution;
        const h = app.renderer.height / app.renderer.resolution;
        const pad = 7;

        wallLayer.clear();
      }

      function resizeCanvas() {
        const width = Math.max(2, Math.floor(window.innerWidth * getDpr()));
        const height = Math.max(2, Math.floor(window.innerHeight * getDpr()));
        const changed = fluidCanvas.width !== width || fluidCanvas.height !== height;

        if (changed) {
          fluidCanvas.width = width;
          fluidCanvas.height = height;
          initFramebuffers();
          randomizeFluid();
        }

        drawTankFrame();
      }

      function pointerInfo(event) {
        const rect = app.canvas.getBoundingClientRect();
        const cssX = event.clientX - rect.left;
        const cssY = event.clientY - rect.top;
        const x = clamp(cssX / rect.width, 0, 1);
        const y = 1 - clamp(cssY / rect.height, 0, 1);

        return { x, y, cssX, cssY, rect };
      }

      function injectFingerTrail(previous, current) {
        const dxPx = current.cssX - previous.cssX;
        const dyPx = current.cssY - previous.cssY;
        const distancePx = Math.hypot(dxPx, dyPx);

        if (distancePx < 1.0) {
          return;
        }

        previous.movedDistance += distancePx;

        const samples = clamp(Math.ceil(distancePx / 18), 1, 8);
        const forceScale = 1 / Math.sqrt(samples);

        let vxCells = (dxPx / current.rect.width) * velocity.width;
        let vyCells = (-dyPx / current.rect.height) * velocity.height;
        const magnitude = Math.hypot(vxCells, vyCells);
        const maxMagnitude = 8.5;

        if (magnitude > maxMagnitude) {
          const scale = maxMagnitude / magnitude;
          vxCells *= scale;
          vyCells *= scale;
        }

        vxCells *= forceScale;
        vyCells *= forceScale;

        for (let i = 1; i <= samples; i++) {
          const t = i / samples;
          const x = lerp(previous.x, current.x, t);
          const y = lerp(previous.y, current.y, t);

          splatVelocity(x, y, vxCells, vyCells, 1.0, i === samples);

          if (CONFIG.EDDY_ASSIST > 0) {
            splatVelocity(
              x,
              y,
              -vyCells * CONFIG.EDDY_ASSIST,
              vxCells * CONFIG.EDDY_ASSIST,
              1.35,
              false
            );
          }
        }

        ripples.push({
          x: current.cssX,
          y: current.cssY,
          radius: 3,
          life: 0.48
        });
      }

      function injectDyeTrail(previous, current) {
        const dxPx = current.cssX - previous.cssX;
        const dyPx = current.cssY - previous.cssY;
        const distancePx = Math.hypot(dxPx, dyPx);

        if (distancePx < 1.0) {
          return;
        }

        previous.movedDistance += distancePx;

        const samples = clamp(Math.ceil(distancePx / 24), 1, 6);
        const forceScale = 1 / Math.sqrt(samples);

        let vxCells = (dxPx / current.rect.width) * velocity.width;
        let vyCells = (-dyPx / current.rect.height) * velocity.height;
        const magnitude = Math.hypot(vxCells, vyCells);
        const maxMagnitude = 8.5;

        if (magnitude > maxMagnitude) {
          const scale = maxMagnitude / magnitude;
          vxCells *= scale;
          vyCells *= scale;
        }

        vxCells *= forceScale;
        vyCells *= forceScale;

        for (let i = 1; i <= samples; i++) {
          const t = i / samples;
          const x = lerp(previous.x, current.x, t);
          const y = lerp(previous.y, current.y, t);
          injectStroke(x, y, vxCells, vyCells, 0.95, i === samples);
        }

        ripples.push({
          x: current.cssX,
          y: current.cssY,
          radius: 4,
          life: 0.54
        });
      }

      function onPointerDown(event) {
        app.canvas.setPointerCapture?.(event.pointerId);

        const p = pointerInfo(event);

        activePointers.set(event.pointerId, {
          x: p.x,
          y: p.y,
          cssX: p.cssX,
          cssY: p.cssY,
          movedDistance: 0
        });

        ripples.push({
          x: p.cssX,
          y: p.cssY,
          radius: 3,
          life: 0.36
        });
      }

      function onPointerMove(event) {
        const previous = activePointers.get(event.pointerId);

        if (!previous) {
          return;
        }

        const p = pointerInfo(event);
        if (interactionMode === "inject") {
          injectDyeTrail(previous, p);
        } else {
          injectFingerTrail(previous, p);
        }

        previous.x = p.x;
        previous.y = p.y;
        previous.cssX = p.cssX;
        previous.cssY = p.cssY;
      }

      function onPointerUp(event) {
        const previous = activePointers.get(event.pointerId);

        if (!previous) {
          return;
        }

        const p = pointerInfo(event);

        if (previous.movedDistance < 6) {
          if (interactionMode === "inject") {
            injectDrop(p.x, p.y, 0, 0, 1.2, true);
            ripples.push({
              x: p.cssX,
              y: p.cssY,
              radius: 7,
              life: 0.82
            });
          } else {
            smallClickSwirl(p.x, p.y, p.cssX, p.cssY);
          }
        }

        activePointers.delete(event.pointerId);
      }

      app.canvas.addEventListener("pointerdown", onPointerDown);
      app.canvas.addEventListener("pointermove", onPointerMove);
      app.canvas.addEventListener("pointerup", onPointerUp);
      app.canvas.addEventListener("pointercancel", onPointerUp);
      app.canvas.addEventListener("pointerleave", onPointerUp);

      function step(dt) {
        gl.disable(gl.BLEND);

        curlProgram.bind();
        gl.uniform2f(curlProgram.uniforms.texelSize, 1 / velocity.width, 1 / velocity.height);
        gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
        blit(curl);

        if (CONFIG.CURL > 0) {
          vorticityProgram.bind();
          gl.uniform2f(vorticityProgram.uniforms.texelSize, 1 / velocity.width, 1 / velocity.height);
          gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
          gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
          gl.uniform1f(vorticityProgram.uniforms.curlStrength, CONFIG.CURL);
          gl.uniform1f(vorticityProgram.uniforms.dt, dt);
          blit(velocity.write);
          velocity.swap();
          enforceVelocityBoundary();
        }

        divergenceProgram.bind();
        gl.uniform2f(divergenceProgram.uniforms.texelSize, 1 / velocity.width, 1 / velocity.height);
        gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
        blit(divergence);

        clearTarget(pressure);

        pressureProgram.bind();
        gl.uniform2f(pressureProgram.uniforms.texelSize, 1 / pressure.width, 1 / pressure.height);
        gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(1));

        for (let i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
          gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(0));
          blit(pressure.write);
          pressure.swap();
        }

        gradientSubtractProgram.bind();
        gl.uniform2f(
          gradientSubtractProgram.uniforms.texelSize,
          1 / velocity.width,
          1 / velocity.height
        );
        gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
        gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
        blit(velocity.write);
        velocity.swap();
        enforceVelocityBoundary();

        advectionProgram.bind();
        gl.uniform2f(advectionProgram.uniforms.texelSize, 1 / velocity.width, 1 / velocity.height);
        gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
        gl.uniform1i(advectionProgram.uniforms.uSource, velocity.read.attach(1));
        gl.uniform1f(advectionProgram.uniforms.dt, dt);
        gl.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.VELOCITY_DISSIPATION);
        blit(velocity.write);
        velocity.swap();
        enforceVelocityBoundary();

        advectionProgram.bind();
        gl.uniform2f(advectionProgram.uniforms.texelSize, 1 / velocity.width, 1 / velocity.height);
        gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
        gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
        gl.uniform1f(advectionProgram.uniforms.dt, dt);
        gl.uniform1f(advectionProgram.uniforms.dissipation, CONFIG.DENSITY_DISSIPATION);
        blit(dye.write);
        dye.swap();
      }

      function renderFluid() {
        displayProgram.bind();
        gl.uniform1i(displayProgram.uniforms.uTexture, dye.read.attach(0));
        gl.uniform2f(displayProgram.uniforms.texelSize, 1 / dye.width, 1 / dye.height);
        gl.uniform2f(displayProgram.uniforms.resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform1f(displayProgram.uniforms.exposure, CONFIG.EXPOSURE);
        gl.uniform1f(displayProgram.uniforms.time, elapsed);
        blit(null);
      }

      function ambientStir() {
        if (!CONFIG.AMBIENT) {
          return;
        }

        if (elapsed - lastAmbient < 0.28) {
          return;
        }

        lastAmbient = elapsed;

        const t = elapsed;
        for (let i = 0; i < 2; i++) {
          const phase = i * Math.PI;
          const x = 0.5 + Math.sin(t * 0.31 + phase) * 0.28;
          const y = 0.5 + Math.cos(t * 0.27 + phase * 1.3) * 0.24;
          const dx = Math.cos(t * 0.71 + phase) * 0.5;
          const dy = Math.sin(t * 0.63 + phase) * 0.5;
          splatVelocity(x, y, dx, dy, 2.0, false);
        }
      }

      function drawRipples(dt) {
        rippleLayer.clear();

        for (let i = ripples.length - 1; i >= 0; i--) {
          const ripple = ripples[i];
          ripple.life -= dt * 2.3;
          ripple.radius += dt * 65;

          if (ripple.life <= 0) {
            ripples.splice(i, 1);
            continue;
          }

          rippleLayer
            .circle(ripple.x, ripple.y, ripple.radius)
            .stroke({ color: 0xffffff, alpha: ripple.life * 0.28, width: 2 });
        }
      }

      function updateModeLabel() {
        const prefix = interactionMode === "inject" ? "dye inject" : "finger stir";
        modeEl.textContent = CONFIG.AMBIENT ? prefix + " + ambient" : prefix;
        ui.ambientBtn.textContent = CONFIG.AMBIENT ? "Ambient: on" : "Ambient: off";
        ui.ambientBtn.classList.toggle("active", CONFIG.AMBIENT);
      }

      function applyControlValues() {
        const cellSize = parseFloat(ui.cellSize.value);
        const fingerForce = parseFloat(ui.fingerForce.value);
        const fingerRadius = parseFloat(ui.fingerRadius.value);
        const viscosity = parseFloat(ui.viscosity.value);
        const curl = parseFloat(ui.curl.value);
        const eddy = parseFloat(ui.eddy.value);
        const dyePersistence = parseFloat(ui.dyePersistence.value);
        const pressureIterations = parseInt(ui.pressure.value, 10);

        CONFIG.CELL_SIZE = cellSize;
        CONFIG.SIM_RESOLUTION = Math.round(clamp(BASE_SIM_RESOLUTION / cellSize, 90, 260));
        CONFIG.DYE_RESOLUTION = Math.round(clamp(BASE_DYE_RESOLUTION / cellSize, 300, 1200));
        CONFIG.FINGER_FORCE = fingerForce;
        CONFIG.STIR_RADIUS = fingerRadius;
        CONFIG.VELOCITY_DISSIPATION = 0.996 - viscosity * 0.052;
        CONFIG.CURL = curl;
        CONFIG.EDDY_ASSIST = eddy;
        CONFIG.DENSITY_DISSIPATION = dyePersistence;
        CONFIG.PRESSURE_ITERATIONS = pressureIterations;

        const viewportMin = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
        const approxSimCellPx = viewportMin / Math.max(1, CONFIG.SIM_RESOLUTION);

        ui.cellSizeValue.textContent = `~${approxSimCellPx.toFixed(1)}px cells`;
        ui.forceValue.textContent = `${fingerForce.toFixed(1)}`;
        ui.radiusValue.textContent = `${Math.round(fingerRadius * 1000)} px-ish`;
        ui.viscosityValue.textContent = `${Math.round(viscosity * 100)}%`;
        ui.curlValue.textContent = `${curl.toFixed(1)}`;
        ui.eddyValue.textContent = `${eddy.toFixed(2)}`;
        ui.dyeValue.textContent = dyePersistence.toFixed(4);
        ui.pressureValue.textContent = `${pressureIterations}`;
      }

      function rebuildSimulation() {
        if (!velocity || !dye) {
          return;
        }

        initFramebuffers();
        randomizeFluid();
      }

      function scheduleRebuild() {
        clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => {
          rebuildSimulation();
        }, 140);
      }

      function resetGentleDefaults() {
        for (const [key, value] of Object.entries(DEFAULTS)) {
          ui[key].value = value;
        }

        applyControlValues();
        rebuildSimulation();
      }

      for (const type of ["pointerdown", "pointermove", "pointerup", "click", "touchstart", "touchmove"]) {
        controls.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
      }

      for (const slider of [
        ui.fingerForce,
        ui.fingerRadius,
        ui.viscosity,
        ui.curl,
        ui.eddy,
        ui.dyePersistence,
        ui.pressure
      ]) {
        slider.addEventListener("input", applyControlValues);
      }

      ui.cellSize.addEventListener("input", () => {
        applyControlValues();
        scheduleRebuild();
      });

      ui.randomizeBtn.addEventListener("click", randomizeFluid);
      ui.settleBtn.addEventListener("click", () => {
        injectDrop(0.5, 0.5, 0, 0, 1.25, true);
      });
      ui.ambientBtn.addEventListener("click", () => {
        CONFIG.AMBIENT = !CONFIG.AMBIENT;
        updateModeLabel();
      });
      ui.resetBtn.addEventListener("click", resetGentleDefaults);

      window.addEventListener("resize", () => {
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(resizeCanvas, 120);
      });

      window.addEventListener("keydown", (event) => {
        if (event.key === " " || event.code === "Space") {
          event.preventDefault();
          settleVelocity();
        } else if (event.key.toLowerCase() === "r") {
          randomizeFluid();
        } else if (event.key.toLowerCase() === "a") {
          CONFIG.AMBIENT = !CONFIG.AMBIENT;
          updateModeLabel();
        }
      });

      try {
        applyControlValues();
        updateModeLabel();
        resizeCanvas();
        simReady = true;
      } catch (error) {
        console.error(error);
        showFallback();
        return;
      }

      app.ticker.add((ticker) => {
        const dt = Math.min(ticker.deltaMS / 1000, 0.032);
        elapsed += dt;

        ambientStir();
        step(dt);
        renderFluid();
        drawRipples(dt);

        fpsEl.textContent = Math.round(app.ticker.FPS).toString();
      });
    })();

  return () => {
    unsubs.forEach((u) => u());
    if (pixiApp) {
      pixiApp.destroy(true);
      pixiApp = null;
    }
  };
}
