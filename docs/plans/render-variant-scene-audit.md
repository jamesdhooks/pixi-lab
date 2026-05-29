# Render Variant Scene Audit

Date: 2026-05-29  
Branch: `neocloud/pixi-lab-continuous-implementation`  
Source plan: `docs/plans/2026-05-29-fluid-basic-pixi-raw-render-quality.md` Task 7  
Reference report: `gpu_field_rendering_simulation_upgrade_report.md`

## Purpose

This audit records which existing Pixi Lab simulations should receive render-quality variants after the Fluid Tank basic/raw split. It intentionally does **not** introduce new renderer abstractions yet. Per the plan, the next implementation slice should port one non-fluid scene first, then extract shared helpers only after concrete duplication exists.

## Current shared constraints

- `raw` must stay opt-in per experience via `capabilities.qualityModes` and style-manifest capabilities.
- Existing non-fluid simulations currently advertise `['basic', 'enhanced']`; only Fluid Tank advertises `raw` today.
- Basic quality should remain Pixi-native and run through the shared `GameApp` Pixi app.
- Preview tiles should stay cheap/basic.
- Raw/WebGL implementations must remain scene/package-owned until a repeated pattern is proven.

## Summary ranking

| Priority | Scene | Current state source | Current render path | Recommended next quality work | Why |
|---:|---|---|---|---|---|
| 1 | `cosmic-ink-ocean` | Scalar + vector fields, particles, velocity/tracer state | `FieldPaletteRenderer` + `ParticlePointRenderer` | Add Pixi RenderTexture feedback in `basic`/`enhanced`; defer `raw` WebGL dye advection | Closest non-fluid sibling to Fluid Tank; ideal first duplication source for splats, decay, blur, and palette feedback. |
| 2 | `ant-signal` | Agent particles, food/nest scalar fields, trail/pheromone field | Basic `FieldPaletteRenderer`; enhanced `TrailFeedbackRenderer` + particles | Promote trail feedback into a richer Pixi basic path; defer raw pheromone texture diffusion | Small, focused pheromone/trail case; good second data point for extracting shared feedback helpers after Cosmic Ink. |
| 3 | `amoeba-lamp` | Blob particles, density and heat fields | Basic field fallback; enhanced `DensityMetaballRenderer` + particles | Improve basic with Pixi density-splat/metaball surface; raw density+normal shader later | High visual payoff but uses implicit-surface rendering rather than fluid feedback, so not first extraction target. |
| 4 | `oil-water-universe` | Phase/concentration scalar fields and density boundaries | `FieldPaletteRenderer` + `DensityMetaballRenderer` | Plan phase-field raw shader; basic can gain smoother Pixi phase feedback | Strong raw candidate, but needs phase-specific solver semantics before implementation. |
| 5 | `turing-skin` | Reaction-diffusion scalar fields | `FieldPaletteRenderer` | Add raw chemical A/B ping-pong shader after non-fluid feedback slice | Excellent raw fit, less reusable for immediate Fluid-style feedback extraction. |
| 6 | `orbital-shrapnel` | Particles + trail field | Basic field fallback; enhanced `TrailFeedbackRenderer` + particles | Upgrade basic trail feedback after Ant Signal; raw debris trail/bloom later | Already follows trail-feedback shape; useful validation for particle-to-trail helpers. |
| 7 | `time-echo` | Particles + history/trail field | `TrailFeedbackRenderer` + particles | Consider multi-buffer temporal feedback; raw only after shared trail helpers exist | Good history-buffer target, but less direct than Ant Signal/Orbital. |
| 8 | `mycelium-prism` | Triangular grid, nutrient/growth scalar fields | `FieldPaletteRenderer` | Add nutrient/trail Pixi field composite; raw graph+multi-field later | High value but triangular-grid identity means helper extraction should wait. |
| 9 | `plasma-branch` | Charge scalar field, arc mesh, scar trail field, particles | `FieldPaletteRenderer`, `TrailFeedbackRenderer`, `ArcLineRenderer`, particles | Improve scar feedback and glow in Pixi; raw charge/scar composite later | Strong visual ROI, but graph/arc hybrid is more bespoke. |
| 10 | `prism-pool` | Height/velocity scalar fields | `FieldPaletteRenderer` | Add raw height/normal/refraction renderer later | Height-field renderer family, not a Fluid feedback first step. |
| 11 | `neon-river-delta` | Height/water/sediment-like scalar fields | `FieldPaletteRenderer` | Raw terrain/water/sediment composite later | Needs height-field/normal architecture and careful UX. |
| 12 | `proto-galaxy-forge` | Particles + density/gravity fields | `FieldPaletteRenderer` + particles | Add particle-to-density/trail feedback after trail helper extraction | Good beneficiary of shared helpers once available. |
| 13 | `alien-vascular-tree` | Branch/particle graph plus nutrient/pulse fields | `FieldPaletteRenderer` + `ArcLineRenderer` | Graph+field hybrid raw later | Keep crisp graph identity; add field glow only after graph hybrid pattern emerges. |
| 14 | `jelly-web` | Spring system + resonance scalar field | `SimulationCanvasLayer.renderField()` + particles | Replace canvas-layer fallback with renderer-family path before raw work | Current path is older/less aligned with AGENTS renderer guidance. |
| 15 | `cellular-ocean` | Spring-ring cells, scalar/density fields | `SimulationCanvasLayer.renderField()` + particles | Replace canvas-layer fallback, then consider implicit membrane renderer | Needs basic renderer-family cleanup first. |
| 16 | `harmonic-sand` | Wave/height scalar field + emitters | `FieldPaletteRenderer` | Raw height/normal renderer later | Already a clean scalar-field case; not urgent for feedback extraction. |
| 17 | `chromatic-avalanche-bowl` | Density/height-like scalar fields | `FieldPaletteRenderer` + `DensityMetaballRenderer` | Height/dust field renderer later | Better handled by height/density renderer family after first feedback work. |
| 18 | `crystal-plasma` | Triangular grid, stress/charge fields, fracture trail, particles | `FieldPaletteRenderer`, `TrailFeedbackRenderer`, `MeshLatticeRenderer`, particles | Graph/mesh+field hybrid raw later | Preserve hard crystal geometry; not a fluid-style first port. |
| 19 | `living-voronoi-tissue` | Voronoi territory/boundary/signal fields, particles | Multiple `FieldPaletteRenderer`s + particles | Shader Voronoi/raw pass later | Needs specialized Voronoi distance-field pass, not immediate feedback extraction. |

## Recommended first implementation slice after this audit

Implement a Pixi feedback renderer variant for **`cosmic-ink-ocean`** without adding `raw` yet:

1. Keep advertised quality modes as `['basic', 'enhanced']` unless a raw WebGL route is implemented and verified.
2. Add a scene-owned Pixi feedback variant that uses the shared Pixi app and render textures.
3. Feed it from existing model vector/scalar/tracer state and gestures.
4. Keep preview basic/cheap.
5. Add focused tests where pure helpers are introduced; avoid renderer internals in core.
6. Browser-smoke `cosmic-ink-ocean` before extracting helpers.

Why Cosmic Ink first:

- It is the closest match to the Fluid Tank feedback algorithm.
- It can prove which pieces are reusable: ping-pong render textures, splat texture creation, decay/blur, displacement/warp, palette composite, and cleanup.
- It avoids prematurely designing a universal field renderer before two concrete ports exist.

## Deferred extraction candidates

Only after Fluid Tank and Cosmic Ink both have Pixi feedback code, evaluate extraction of small package-owned helpers under `packages/simulations/src/rendering/`, such as:

- RenderTexture ping-pong lifecycle helper.
- Generated soft splat/noise texture helpers.
- Safe Pixi filter scale setter.
- Feedback decay/blur/composite option types.
- Palette-to-tint/color utility functions.

Do **not** extract a general `FieldRenderer` API yet. The report recommends broad renderer families, but the active plan explicitly requires two concrete scene ports before abstraction.

## Notes by renderer family

### Field advection / feedback

Best immediate candidates: `cosmic-ink-ocean`, then `ant-signal` or `orbital-shrapnel`.

These scenes already have scalar/trail/vector model state and can show visible gains by treating fields as render data rather than literal cells or particles.

### Metaball / implicit surface

Best candidates: `amoeba-lamp`, `cellular-ocean`, `oil-water-universe` boundaries.

Amoeba Lamp already uses `DensityMetaballRenderer` in enhanced quality. The main opportunity is making basic look less like a fallback while preserving cheap previews.

### Reaction-diffusion / cellular field

Best candidate: `turing-skin`.

This is likely a raw shader solver slice, not a Pixi feedback slice. Keep it behind explicit `raw` only when the solver exists.

### Height field / normal

Best candidates: `prism-pool`, `neon-river-delta`, `harmonic-sand`, `chromatic-avalanche-bowl`.

These need normal/refractive/lighting passes more than dye feedback. They should wait until after the first non-fluid feedback port.

### Trail feedback

Best candidates: `ant-signal`, `orbital-shrapnel`, `time-echo`, `proto-galaxy-forge`, `plasma-branch` scars.

`ant-signal` is the cleanest trail-first scene because the visual concept is pheromone roads and the model already separates food/nest/trail fields.

### Graph/mesh + field hybrid

Best candidates: `plasma-branch`, `crystal-plasma`, `alien-vascular-tree`, `jelly-web`, `living-voronoi-tissue`, `mycelium-prism`.

These should keep crisp geometry as identity and add field buffers for glow/stress/scars/pulses. They are not first-pass raw candidates unless a scene-specific shader is explicitly scoped.
