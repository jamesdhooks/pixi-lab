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
- Current Fluid definition advertises `qualityModes: ['basic', 'enhanced']` and still uses a `DomScriptScene` wrapper around `fluid-runtime-script.ts` for both full scene and preview.
- `packages/simulations/src/fluid-tank/FluidTankScene.ts` already exists and wraps `GpuFluidTankRenderer`, but the definition is not using it. Treat this as an unfinished Pixi Lab scene path: either retire it behind `raw` if it is raw-canvas-owned, or refactor it into the coordinator that selects a Pixi-native renderer for `basic` and raw WebGL for `raw`.
- `packages/react/src/GameLauncher.tsx` stores one global `pixi-lab:quality` value and passes `definition.capabilities.qualityModes` to `QualitySelector`; implementation must sanitize stored/query quality against the active experience's advertised modes so `raw` never leaks into experiences that do not support it.
- `packages/core/src/performance/PerformanceGovernor.ts` currently downgrades anything slow to `basic`; `raw` must be sticky/manual and never auto-downgraded unless a user explicitly changes quality.
- Current raw WebGL implementation should not disappear; it should become the `raw` quality path only.
- `gpu_field_rendering_simulation_upgrade_report.md` identifies the strongest raw/GPU field candidates and six reusable engine families:
  1. Field Advection Engine
  2. Metaball / Implicit Surface Engine
  3. Reaction-Diffusion / Cellular Field Engine
  4. Height Field / Normal Engine
  5. Trail Feedback Engine
  6. Graph/Mesh + Field Hybrid Engine
- `docs/plans/raw-mode-gpu-field-roadmap.md` refines the RAW MODE direction from James' follow-up guidance. Treat raw as a staged GPU field/particle platform: state textures, ping-pong passes, particle-to-field visuals, and scene-owned adapters. Do **not** globally enable raw for all scenes just because they are listed; each scene must earn `raw` through a verified implementation and browser QA.

---

## Implementation Guardrails Added After Repo Inspection

1. **Do not make `raw` global by default.** Add `raw` to the shared type, but only expose it when an experience advertises `qualityModes: ['basic', 'enhanced', 'raw']`.
2. **Sanitize persisted quality.** If `localStorage.getItem('pixi-lab:quality')` is `raw` and the next opened experience lacks `raw`, start that experience at `basic` and overwrite/ignore the stale value.
3. **Sanitize debug query quality.** `?quality=raw` may select raw only for Fluid or future raw-enabled entries. Invalid query quality falls back to `basic` with no crash.
4. **Keep previews cheap.** `previewFactory` should keep using a Pixi-safe/basic renderer. Do not run raw WebGL in preview tiles unless a future explicit QA slice proves it is cheap and stable.
5. **No raw renderer in core API.** Raw WebGL adapters remain scene/package-owned. Core only knows the quality string.
6. **One default Pixi canvas for `basic`.** The default/basic Fluid route must not create an extra DOM script canvas or standalone `PIXI.Application`.
7. **No broad abstraction first.** Implement Fluid's split, then one non-fluid Pixi feedback scene, then extract shared helpers from proven duplication.
8. **Raw mode is a GPU simulation privilege, not a label.** Only advertise `raw` after a scene has a verified stateful GPU path (particle textures, field ping-pong, trail/height/density/phase/reaction textures, or graph+field raw composite) and browser QA for that path.
9. **Particles should usually drive fields.** For RAW candidates such as `amoeba-lamp`, `orbital-shrapnel`, and `ant-signal`, the hero visual should be a density/trail/pheromone/charge field composite rather than CPU dots.

---

## Task 0: Baseline and route-state verification

**Objective:** Prove the implementer starts from the expected commit and understands the current unfinished Fluid wiring.

**Files to inspect, no edits yet:**
- `packages/core/src/types.ts`
- `packages/core/src/performance/PerformanceGovernor.ts`
- `packages/react/src/GameLauncher.tsx`
- `packages/demo/src/App.tsx`
- `packages/simulations/src/fluid-tank/fluid-tank.definition.ts`
- `packages/simulations/src/fluid-tank/FluidTankScene.ts`
- `packages/simulations/src/fluid-tank/GpuFluidTankRenderer.ts`
- `packages/simulations/src/fluid-tank/fluid-runtime-script.ts`
- `reference/pixi-fluid.html`

**Steps:**
1. Run `git status --short --branch` and confirm the branch is clean before editing.
2. Run `git log --oneline -5` and confirm `docs: plan fluid raw render quality split` is included.
3. Search for `RenderQuality`, `qualityModes`, `fluidEngine`, `fluidGallery`, and `DomScriptScene` usages.
4. Record any drift from this plan directly in this document before implementing.

**Acceptance:** The first implementation commit starts from a clean branch and does not overwrite unrelated local changes.

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
3. Update `PerformanceGovernor.update()` so `raw` returns `null` before considering fallback; `raw` is manual/sticky.
4. Confirm `GameApp.setQuality()` and the governor callback still emit quality changes for explicit user choices.
5. Add or update a focused core test for `PerformanceGovernor`: enhanced can fall back to basic under sustained low fps, raw does not auto-fallback.
6. Search all comparisons such as `quality === 'basic' ? ... : ...`; when raw reaches a generic renderer, it should behave like `enhanced` or be rejected by capabilities rather than crashing.
7. Run:
   ```bash
   pnpm --filter @hooksjam/pixi-lab-core build
   pnpm --filter @hooksjam/pixi-lab-core test
   pnpm --filter @hooksjam/pixi-lab-demo typecheck
   ```

**Acceptance:** Typecheck/build pass, default launch still uses `basic`.

**2026-05-29 slice note:** Task 1 implemented on `neocloud/pixi-lab-continuous-implementation`: `RenderQuality` now includes `raw`, `PerformanceGovernor.update()` leaves raw quality sticky/manual under sustained low FPS, and the core burst emitter quality caps explicitly handle raw as an enhanced-equivalent generic fallback. Added `PerformanceGovernor.test.ts` covering enhanced→basic fallback and raw no-fallback behavior. The initial RED run failed on the raw sticky assertion before the implementation, then passed after the change.

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

**Coordinator rule:** A `SceneRenderVariant` must not assume ownership of the app lifecycle. It may own child containers, render textures, filters, generated textures, and raw canvases it creates, but it must clean them in `exit()`/`destroy()` without destroying the shared Pixi app.

**Acceptance:** No changes to public core API except the `raw` quality type unless a truly generic abstraction is needed.

**2026-05-29 slice note:** Task 2 added `SceneRenderVariant` under simulations with lifecycle/update/render hooks plus optional quality/style/mode/reset hooks. The type is exported from `@hooksjam/pixi-lab-simulations` and remains package-owned, with no new core API.

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

**2026-05-29 slice note:** Task 3 ported the reference Pixi feedback algorithm into `PixiFeedbackFluidRenderer`. The renderer uses the shared Pixi app, RenderTexture ping-pong, displacement/blur feedback, generated soft splat and vector-noise textures, style palettes, live settings-derived force/warp/retention, and scene input snapshots. It does not create a standalone app or DOM-local pointer listeners.

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
- If using `DomScriptScene` for raw, wrap selection in the simulation factory/scene coordinator rather than branching in demo app code. A definition factory may receive context only if the core contract already supports it; otherwise keep factory stable and switch inside the scene via `ctx.quality`/`setQuality()`.
- Replace the current `fluidTankDefinition.factory` default path so `basic` no longer directly returns `new DomScriptScene(...)`.
- Keep `previewFactory` on a cheap/basic path. Do not make preview tiles instantiate raw WebGL.
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

**Required UI/runtime behavior:**
- Parse `quality` once in `packages/demo/src/App.tsx` and pass it to `GameLauncher`/`GameRuntime` through an explicit prop or an existing safe path.
- Validate parsed quality against `definition.capabilities.qualityModes`; invalid or unsupported values fall back to `basic`.
- `QualitySelector` options must remain exactly the active definition's advertised modes.
- If the stored global quality is unsupported for the active definition, use `basic` for that session and do not display raw as selected.

**Acceptance:** Browser console can prove the selected quality and renderer path. Visual checks confirm:
- `basic`: single Pixi canvas/render texture feedback look
- `raw`: current raw WebGL dye-advection look

**2026-05-29 slice note:** Task 5 added sanitized host/query startup quality wiring. `GameLauncher` now accepts an optional `initialQuality`, sanitizes query and persisted values against the active experience's `qualityModes`, and overwrites stale unsupported persisted values when no query override is present. Demo routes parse `?quality=basic|enhanced|raw` once and pass it into launched Fluid surfaces; unsupported or invalid query values fall back through the same sanitizer so raw cannot be selected for non-raw experiences. Added `qualitySelection.test.ts` covering raw support, unsupported raw fallback, invalid values, and non-basic fallback modes.

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
- `/pixi-lab/?fluidGallery=1&quality=raw`
- `/pixi-lab/` dashboard still shows all entries
- Open a non-fluid experience after using raw and confirm it starts at `basic` or another supported quality, never an unsupported raw value.

**Acceptance:** Basic and raw are visually distinct and both functional.

**2026-05-29 slice note:** Task 6 validation passed for the raw quality routing slice. Added a focused `PixiFeedbackFluidRenderer` regression test for Pixi `DisplacementFilter.scale` objects that do or do not expose `set()`, then patched the renderer to use the helper. Ran `pnpm test -- packages/simulations/src/fluid-tank/__tests__/PixiFeedbackFluidRenderer.test.ts`, `pnpm --filter @hooksjam/pixi-lab-core build`, `pnpm --filter @hooksjam/pixi-lab-simulations typecheck`, and `pnpm --filter @hooksjam/pixi-lab-demo typecheck`. Browser smoke checks passed for `/pixi-lab/?fluidEngine=1&quality=basic`, `/pixi-lab/?fluidEngine=1&quality=raw`, `/pixi-lab/?fluidGallery=1&quality=basic`, and `/pixi-lab/?fluidGallery=1&quality=raw`, including launching Fluid from the gallery. Basic routes rendered one Pixi canvas; raw routes intentionally rendered the Pixi shell plus the explicit raw WebGL canvas, with no console errors observed.

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

**2026-05-29 slice note:** Task 7 completed in `docs/plans/render-variant-scene-audit.md`. The audit inspected current scene/model renderer usage across the report candidates, confirmed all non-fluid candidates still advertise only `basic`/`enhanced`, and ranked `cosmic-ink-ocean` as the next safe implementation slice because it is the closest reusable match to Fluid Tank's Pixi feedback path. `ant-signal` and `orbital-shrapnel` are the next trail-feedback validation candidates; shader/raw-only families such as `turing-skin`, `prism-pool`, and Voronoi/graph hybrids are deferred until after one non-fluid Pixi feedback port proves reusable helpers.

---

## Task 8: Build shared field renderer only after concrete scene ports

**Objective:** Avoid premature abstraction while still steering toward the GPU Field Engine direction from `raw-mode-gpu-field-roadmap.md`.

**Rule:** Do not create a giant generic `FieldRenderer` first. First implement:
1. Fluid Tank Pixi feedback basic + raw split.
2. One non-fluid Pixi feedback scene, recommended `cosmic-ink-ocean` or `ant-signal`.
3. One true raw GPU-field/particle scene from the roadmap, recommended `amoeba-lamp`, `orbital-shrapnel`, or `ant-signal` depending on which is smallest and best aligned with existing state.
4. Then extract shared helpers for RenderTexture/WebGL ping-pong, splats, decay, blur, palette mapping, trail feedback, gradient/normal passes, and particle texture lifecycle.

**Acceptance:** Shared renderer APIs are based on proven duplication, not guessed architecture. A scene advertises `raw` only after its raw adapter exists, is selectable, and passes browser QA.

**2026-05-29 slice note:** Began Task 8's first non-fluid Pixi feedback candidate with `cosmic-ink-ocean`. Added a scene-owned `CosmicInkFeedbackRenderer` using the shared Pixi app, ping-pong `RenderTexture`s, blur/glow feedback, generated soft splats, and existing model particles as field sources. Wired `CosmicInkOceanScene` so `basic` now renders through the Pixi feedback path and `enhanced` keeps the feedback path plus a lighter particle overlay; no `raw` quality was advertised. Added focused tests for the pure particle-to-feedback stamp mapper and verified the RED failure before implementation. Browser-smoked the gallery launch after validation: Cosmic Ink Ocean opened with one Pixi canvas, visible feedback rendering, visible settings/quality controls, basic-to-enhanced switching, and no JavaScript console errors.

**2026-05-29 slice note:** Task 8 validation passed for the first non-fluid Pixi feedback slice (`cosmic-ink-ocean`). The next required pre-raw step inspected `amoeba-lamp`, `ant-signal`, and `orbital-shrapnel` current scene/model code and selected Amoeba Lamp as the smallest valid first true RAW MODE candidate. Added `docs/plans/amoeba-lamp-raw-mode-mini-plan.md` naming density/heat ping-pong textures, fallback behavior, preview behavior, browser QA routes, and validation commands. `raw` is still not advertised on Amoeba Lamp until a concrete adapter lands and passes QA.

**2026-05-29 slice note:** Began the Amoeba Lamp raw implementation path with a focused pure helper rather than wiring `raw` prematurely. Added `AmoebaLampRawSplatMapper` plus tests for bounded normalized density/heat splats and deterministic upload budgeting. This prepares the future density/heat ping-pong adapter while keeping `qualityModes` at `['basic', 'enhanced']` until the adapter and browser QA are complete.

**2026-05-29 slice note:** Continued the Amoeba Lamp raw path with a second pure helper, `AmoebaLampRawFieldState`, covering bounded density/heat ping-pong buffers, splat injection, decay, diffusion, and upward heat drift. This gives the future scene-owned raw adapter concrete state semantics while keeping `raw` unadvertised until the adapter is selectable and browser-smoked.

---

## Task 8A: RAW MODE roadmap integration

**Objective:** Keep the active implementation loop aligned with James' RAW MODE guidance without overbuilding abstractions.

**Files:**
- Read: `docs/plans/raw-mode-gpu-field-roadmap.md`
- Read/update: `docs/plans/render-variant-scene-audit.md`
- Modify per-scene only after inspecting current model and renderer code.

**Implementation rules:**
1. Treat `amoeba-lamp`, `orbital-shrapnel`, and `ant-signal` as the strongest first true-raw candidates.
2. Treat `cosmic-ink-ocean` as still valid for the first non-fluid Pixi feedback extraction slice, not necessarily the first true raw WebGL showcase.
3. Before adding `raw` to any scene, write or update a mini-plan that names the exact state textures/fields and fallback behavior.
4. Prefer particles-as-field-sources over visible dot clouds for `amoeba-lamp`, `ant-signal`, `oil-water-universe`, `harmonic-sand`, and `chromatic-avalanche-bowl`.
5. Prefer particle textures plus trail feedback for `orbital-shrapnel` and `proto-galaxy-forge`.
6. Prefer scalar ping-pong shader passes for `turing-skin`, `prism-pool`, `neon-river-delta`, and `oil-water-universe`.
7. Keep graph/mesh identity for `plasma-branch`, `crystal-plasma`, `alien-vascular-tree`, `jelly-web`, and `living-voronoi-tissue`; add raw field overlays only when scoped.

**Acceptance:** Each cron run chooses one narrow slice from the current docs, validates it, and updates the plan with actual evidence.

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

**Cron/automation behavior:** The autonomous job should implement one cohesive slice per run, in this order:
1. Task 0–1: shared quality type + sticky raw governor + tests.
2. Task 2–3: Pixi-native Fluid basic renderer.
3. Task 4–5: raw quality selection + route/query/UI sanitization.
4. Task 6: automated and browser QA.
5. Task 7: render-variant audit document.
6. Task 8: one non-fluid Pixi feedback candidate, then one true raw GPU-field candidate from `raw-mode-gpu-field-roadmap.md`, then shared helper extraction only after duplication is proven.

Each run must pull/rebase first, avoid broad rewrites, commit and push only when validation passes, and report what changed plus any remaining verification gaps.

---

## Open Questions

1. **Resolved for implementation:** `enhanced` may initially alias the Pixi-native renderer with higher resolution/glow for Fluid. It must not keep pointing at raw WebGL by accident.
2. **Resolved for implementation:** `raw` is selectable only when an experience advertises it in `qualityModes`.
3. **Deferred cleanup:** generated `packages/demo/dist-fluid-debug/` is currently committed. Do not remove it as part of the raw/basic split unless a separate cleanup plan confirms it is safe.
