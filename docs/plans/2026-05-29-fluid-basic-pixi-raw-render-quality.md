# Fluid Basic Pixi + Raw Render Quality Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Fluid Tank use the new Pixi-native feedback implementation for `basic` quality, add `raw` as the explicit quality for the current raw WebGL fluid adapter, then plan raw/field rendering upgrades for the scenes identified in `gpu_field_rendering_simulation_upgrade_report.md`.

**Architecture:** Keep Pixi Lab’s public runtime path unchanged (`GameLauncher → GameRuntime → GameApp → LabExperience.factory() → Scene`). Add a render-variant selection layer inside simulations so a scene can choose a Pixi-native renderer for normal/basic quality and a raw WebGL renderer only when the quality is explicitly `raw`. Treat raw renderers as scene-owned adapters, not as core Pixi Lab engine API.

**Tech Stack:** TypeScript, PixiJS v8, Pixi RenderTexture ping-pong, Pixi filters (`DisplacementFilter`, `BlurFilter`), existing `DomScriptScene`, current raw WebGL fluid runtime, existing style/settings bridge.

---

## Current Evidence

- `reference/pixi-fluid.html` proves Fluid can be rendered with PixiJS only:
  - creates a single `PIXI.Application`
  - uses `PIXI.RenderTexture` ping-pong buffers
  - uses `PIXI.DisplacementFilter` and `PIXI.BlurFilter`
  - draws soft circular splats into a paint layer
  - decays/warps/blur-composites the previous frame into the next texture
  - renders glow + display sprites back to the Pixi stage
- Current `RenderQuality` is `basic | enhanced` in `packages/core/src/types.ts`.
- Current Fluid definition advertises `qualityModes: ['basic', 'enhanced']` and uses a `DomScriptScene` wrapper around `fluid-runtime-script.ts` for both full scene and preview.
- Current raw WebGL implementation should not disappear; it should become the `raw` quality path.
- `gpu_field_rendering_simulation_upgrade_report.md` identifies the strongest raw/GPU field candidates and six reusable engine families:
  1. Field Advection Engine
  2. Metaball / Implicit Surface Engine
  3. Reaction-Diffusion / Cellular Field Engine
  4. Height Field / Normal Engine
  5. Trail Feedback Engine
  6. Graph/Mesh + Field Hybrid Engine

---

## Quality Semantics

Define quality modes as:

```ts
export type RenderQuality = 'basic' | 'enhanced' | 'raw';
```

- `basic`: engine-safe Pixi renderer. For Fluid Tank this is the Pixi feedback implementation from `reference/pixi-fluid.html` adapted into a scene-owned class. It must run through the shared Pixi Lab `GameApp` Pixi application, not create its own app.
- `enhanced`: future room for richer Pixi/composited scene variants. Initially it can alias `basic` for Fluid if there is no distinct enhanced implementation yet.
- `raw`: scene-owned raw WebGL renderer/adapter. For Fluid Tank this is the existing `fluid-runtime-script.ts`/raw WebGL path, exposed intentionally as raw quality.

---

## Task 1: Extend RenderQuality to include raw

**Objective:** Add `raw` to the public quality model without changing default behavior.

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify if necessary: `packages/core/src/performance/*`
- Modify if necessary: `packages/core/src/GameApp.ts`
- Search: `RenderQuality` usages in all packages

**Steps:**
1. Change `RenderQuality` to `'basic' | 'enhanced' | 'raw'`.
2. Confirm `GameApp` still defaults to `basic`.
3. Confirm performance governor does not accidentally downgrade from/to `raw` unless explicitly desired.
4. If governor only understands `basic/enhanced`, make `raw` sticky/manual: when quality is `raw`, do not auto-govern it unless the user explicitly switches quality.
5. Run:
   ```bash
   pnpm --filter @hooksjam/pixi-lab-core build
   pnpm --filter @hooksjam/pixi-lab-demo typecheck
   ```

**Acceptance:** Typecheck/build pass, default launch still uses `basic`.

---

## Task 2: Add a generic scene render-variant contract

**Objective:** Let simulations choose renderer implementation by quality without putting scene-specific renderers into core.

**Files:**
- Create: `packages/simulations/src/rendering/SceneRenderVariant.ts` or similar
- Modify: Fluid files only at first

**Suggested interface:**

```ts
export interface SceneRenderVariant {
  enter(): void;
  exit(): void;
  resize(width: number, height: number): void;
  update(dt: number): void;
  render(alpha: number): void;
  setStyle?(styleId: string): void;
  setMode?(modeId: string): void;
  reset?(): void;
}
```

**Rule:** This lives in simulations or scene package code. Do not export Fluid-specific renderers from `@hooksjam/pixi-lab-core`.

**Acceptance:** No changes to public core API except the `raw` quality type unless a truly generic abstraction is needed.

---

## Task 3: Port `reference/pixi-fluid.html` into a Pixi-native Fluid renderer

**Objective:** Convert the standalone Pixi feedback demo into a reusable class that uses the existing Pixi Lab `GameContext.systems.pixi.app` instead of creating a new `PIXI.Application`.

**Files:**
- Create: `packages/simulations/src/fluid-tank/PixiFeedbackFluidRenderer.ts`
- Possibly create: `packages/simulations/src/fluid-tank/PixiFeedbackFluidOptions.ts`
- Reference: `reference/pixi-fluid.html`

**Implementation notes:**
- Preserve these reference concepts:
  - `rtA`, `rtB`, `flowRT` render textures
  - `feedbackContainer`, `prevSprite`, `paintLayer`
  - `flowContainer`, `flowLayer`, `flowSprite`
  - `DisplacementFilter` warp
  - `BlurFilter` softness
  - soft circular splat texture
  - vector noise texture
  - display sprite + glow sprite
- Remove standalone UI panel/HUD/fallback code.
- Use scene settings/style from Pixi Lab instead:
  - resolution → quality/options
  - force/finger size/retention/blur/warp/glow → existing or new Fluid settings fields
  - dye colors → `SimStyle.palette`
- Use existing `GameContext` input snapshots, not DOM-local pointer listeners.
- Ensure cleanup destroys Pixi containers, filters, textures, render textures, and generated textures.

**Acceptance:** `basic` Fluid Tank renders colorful Pixi-native feedback inside the normal Pixi Lab scene, with no extra DOM script canvas and no raw WebGL context.

---

## Task 4: Move current raw WebGL fluid path behind raw quality

**Objective:** Keep the current high-fidelity WebGL2 fluid implementation, but make it opt-in via `quality === 'raw'`.

**Files:**
- Modify: `packages/simulations/src/fluid-tank/fluid-tank.definition.ts`
- Modify/create: `packages/simulations/src/fluid-tank/FluidTankScene.ts` or a new variant coordinator scene
- Existing raw files:
  - `packages/simulations/src/fluid-tank/fluid-runtime-script.ts`
  - `packages/simulations/src/fluid-tank/fluid-runtime-markup.ts`
  - `packages/simulations/src/fluid-tank/GpuFluidTankRenderer.ts`

**Approach:**
- Prefer one `FluidTankScene`/coordinator that selects:
  - `basic` → `PixiFeedbackFluidRenderer`
  - `enhanced` → initially `PixiFeedbackFluidRenderer` with higher resolution/glow, or current `basic` alias
  - `raw` → current raw WebGL adapter
- If using `DomScriptScene` for raw, wrap selection in the factory rather than branching in demo app code.
- Update Fluid capabilities:
  ```ts
  qualityModes: ['basic', 'enhanced', 'raw']
  ```
- Update `fluidTankStyleManifest.capabilities.qualities` similarly.

**Acceptance:** The route can render both paths:
- default/basic route: Pixi feedback fluid
- explicit raw quality: current raw WebGL fluid

---

## Task 5: Add debug route/query support for quality selection

**Objective:** Make visual verification easy.

**Files:**
- Modify: `packages/demo/src/App.tsx` or existing GameLauncher prop path
- Verify existing query parsing before changing

**Expected routes:**

```txt
/pixi-lab/?fluidEngine=1&quality=basic
/pixi-lab/?fluidEngine=1&quality=raw
/pixi-lab/?fluidGallery=1&quality=basic
/pixi-lab/?fluidGallery=1&quality=raw
```

**Acceptance:** Browser console can prove the selected quality and renderer path. Visual checks confirm:
- `basic`: single Pixi canvas/render texture feedback look
- `raw`: current raw WebGL dye-advection look

---

## Task 6: Verify Fluid implementation

**Objective:** Prove the new quality split works and does not regress dashboard/preview.

**Commands:**

```bash
pnpm --filter @hooksjam/pixi-lab-core build
pnpm --filter @hooksjam/pixi-lab-react build
pnpm --filter @hooksjam/pixi-lab-simulations build
pnpm --filter @hooksjam/pixi-lab-demo typecheck
pnpm --filter @hooksjam/pixi-lab-demo exec vite build --outDir dist-fluid-debug --emptyOutDir
```

**Browser checks:**
- `/pixi-lab/?fluidEngine=1&quality=basic`
- `/pixi-lab/?fluidEngine=1&quality=raw`
- `/pixi-lab/?fluidGallery=1&quality=basic`
- `/pixi-lab/` dashboard still shows all entries

**Acceptance:** Basic and raw are visually distinct and both functional.

---

## Task 7: Candidate scene audit for raw/GPU-field upgrades

**Objective:** Use the report to decide which scenes should receive raw modes and which should receive Pixi field feedback modes first.

**High-priority raw/field candidates from the report:**

| Scene | Recommended engine family | Proposed quality path |
|---|---|---|
| `cosmic-ink-ocean` | Field Advection Engine | `basic`: Pixi feedback trails; `raw`: velocity+dye+curl WebGL |
| `amoeba-lamp` | Metaball / Implicit Surface Engine | `basic`: Pixi density splats; `raw`: density texture + gradient normals |
| `oil-water-universe` | Phase/Reaction + Metaball boundary | `basic`: Pixi phase feedback; `raw`: phase-field ping-pong shader |
| `turing-skin` | Reaction-Diffusion Engine | `raw`: chemical A/B ping-pong texture solver |
| `ant-signal` | Trail Feedback Engine | `basic`: Pixi trail RT; `raw`: pheromone texture diffusion/decay |
| `mycelium-prism` | Graph/Mesh + Field Hybrid | `basic`: Pixi nutrient/trail RT; `raw`: multi-field growth composite |
| `prism-pool` | Height Field / Normal Engine | `raw`: height/velocity textures + normal/refraction shader |
| `neon-river-delta` | Height/Sediment Field | `raw`: height/water/sediment field composite |
| `plasma-branch` | Trail Feedback + Graph Hybrid | `basic`: Pixi scar/glow RT; `raw`: charge/scar textures + arc composite |
| `crystal-plasma` | Graph/Mesh + Field Hybrid | `raw`: stress/crack/charge field composite |
| `orbital-shrapnel` | Trail Feedback Engine | `basic`: Pixi trail feedback; `raw`: debris trail texture + bloom |
| `time-echo` | Trail Feedback Engine | `basic`: Pixi temporal feedback; `raw`: multi-frame trail buffers |
| `proto-galaxy-forge` | Trail Feedback Engine | `basic`: Pixi glow/trail RT; `raw`: gravitational trail field |
| `alien-vascular-tree` | Graph/Mesh + Field Hybrid | `raw`: vessel graph + pulse/stress field |
| `jelly-web` | Graph/Mesh + Field Hybrid | `raw`: web geometry + resonance/stress field |
| `cellular-ocean` | Metaball / Implicit Surface Engine | `raw`: cell density/membrane field |
| `harmonic-sand` | Height Field / Normal Engine | `raw`: wave/height field renderer |
| `chromatic-avalanche-bowl` | Height Field / Normal Engine | `raw`: terrain/flow normal composite |
| `living-voronoi-tissue` | Graph/Mesh + Field Hybrid | `raw`: tissue graph + biochemical field overlay |

**Audit steps:**
1. For each scene, inspect current render code.
2. Classify current state source: particles, grid, graph, scalar field, vector field, height field.
3. Decide whether `basic` can be improved by Pixi RenderTexture feedback first.
4. Decide whether `raw` needs custom WebGL shaders or can use a shared future FieldRenderer.
5. Record output in `docs/plans/render-variant-scene-audit.md`.

---

## Task 8: Build shared field renderer only after two concrete scene ports

**Objective:** Avoid premature abstraction.

**Rule:** Do not create a giant generic `FieldRenderer` first. First implement:
1. Fluid Tank Pixi feedback basic + raw split.
2. One non-fluid Pixi feedback scene, recommended `cosmic-ink-ocean` or `ant-signal`.
3. Then extract shared helpers for RenderTexture ping-pong, splats, decay, blur, palette mapping, and trail feedback.

**Acceptance:** Shared renderer API is based on proven duplication, not guessed architecture.

---

## Task 9: Commit strategy

**Commits:**
1. `feat: add raw render quality mode`
2. `feat: add pixi feedback fluid renderer`
3. `refactor: select fluid renderer by quality`
4. `docs: add render variant scene audit`
5. Later per-scene commits: `feat(<scene>): add raw field renderer`

**Always run before push:**

```bash
git status --short --branch
pnpm --filter @hooksjam/pixi-lab-core build
pnpm --filter @hooksjam/pixi-lab-simulations typecheck
pnpm --filter @hooksjam/pixi-lab-demo typecheck
```

---

## Open Questions

1. Should `enhanced` initially mean “same Pixi renderer as basic with higher resolution/glow” or remain existing behavior until each scene opts in?
2. Should `raw` be globally selectable in the UI immediately, or only enabled when an experience advertises it in `qualityModes`?
3. Should generated `packages/demo/dist-fluid-debug/` stay committed long-term, or should a later cleanup move it to ignored build output?
