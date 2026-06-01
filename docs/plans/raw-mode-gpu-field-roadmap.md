# RAW Mode GPU Field Roadmap

Date: 2026-05-29  
Branch: `neocloud/pixi-lab-continuous-implementation`  
Source: James' RAW mode guidance attached in Discord thread `Pixi Lab`.

## Purpose

This document refines Pixi Lab's RAW MODE direction after the Fluid Tank `basic`/`raw` split. The guidance is intentionally staged: RAW mode should showcase stateful GPU simulation when a scene can actually benefit from it, but `raw` must remain opt-in per experience and must not become a global quality default.

## Core interpretation

The strongest opportunity is not "more pixels" or "more CPU particles." It is using GPU textures as living state:

```text
frame N state texture
        ↓ shader/pass update
frame N+1 state texture
        ↓ render/composite pass
high-fidelity continuous visual
```

Valid RAW MODE candidates should fit at least one of these patterns:

1. GPU particle textures: position, velocity, age/life, metadata.
2. Field feedback buffers: trails, dye, pheromones, heat, charge, scars.
3. Scalar/vector ping-pong fields: reaction-diffusion, height waves, phase separation.
4. Particle-to-field rendering: particles are hidden sources/samplers; the field is the hero image.
5. Graph/mesh plus field overlays: crisp geometry remains, while fields add stress, glow, charge, or scars.

## Non-negotiable constraints

- `raw` is advertised only when a verified raw route exists in `capabilities.qualityModes` and style-manifest capabilities.
- `basic` and `enhanced` remain Pixi-native and run through the shared `GameApp` Pixi app.
- RAW adapters are scene/package-owned until two or more implementations prove a shared abstraction.
- Prefer shared-Pixi raw adapters for non-fluid scenes when the route can be expressed as bounded texture uploads, render textures, or shader passes inside the existing `GameApp` Pixi app. Only introduce an extra raw WebGL canvas for scenes that truly need a separate low-level solver.
- DOM/raw WebGL adapters that do need the legacy DOM bridge must use the typed `DomMountContext` mount API; do not add new string-injected `DomScriptScene` paths.
- Preview factories stay cheap/basic unless an explicit QA slice proves a raw preview is safe.
- Do not build a giant `FieldRenderer` before implementation evidence exists. Extract small modules from repeated code.
- Browser QA must verify raw routes separately from basic routes. Raw may intentionally create an additional scene-owned WebGL canvas only for DOM/WebGL-solver routes such as Fluid; Pixi-owned raw texture adapters should still keep a single shared Pixi canvas.
- After core engine changes that add or export runtime bridge types, rebuild `@hooksjam/pixi-lab-core` before registry or package-consumer smoke tests so stale `dist` output does not masquerade as a source wiring failure.

## Recommended staged engine modules

Build these in order only as concrete scene work needs them:

1. `PingPongTarget` / render-texture lifecycle helper.
2. Fullscreen shader-pass helper.
3. Splat pass abstraction for pointer/particle injection.
4. Scalar/vector field upload and sampling helpers.
5. `ParticleTexture` abstraction for GPU particle state.
6. Trail feedback buffer with decay/blur/composite.
7. Gradient/normal derivation pass.
8. Bloom/composite pass.
9. Debug field viewer.
10. Preset registry for scene-specific raw demos.

## Scene priority tiers

| Tier | Scene | RAW MODE goal | Why |
|---:|---|---|---|
| 1 | `amoeba-lamp` | Density-field metaball organism: particles splat density/heat, shader thresholds membrane, gradients fake normals. | Highest likely visual payoff; "alive" look; particles become hidden skeleton. |
| 1 | `orbital-shrapnel` | GPU particle texture + trail feedback around central gravity wells. | Cleanest high-particle showcase; 20k particles plus trails can look premium. |
| 1 | `ant-signal` | Agents deposit/sample pheromone texture; glowing network is hero visual. | Emergent behavior with simpler physics than fluid. |
| 2 | `turing-skin` | Reaction-diffusion A/B ping-pong textures with palette, contours, fake normals. | Stable shader simulation with strong visual return. |
| 2 | `prism-pool` | Height-field wave equation, normals, refraction, chromatic caustics. | Elegant tactile raw demo; distinct from fluid. |
| 2 | `plasma-branch` | Charge/scar fields plus arc mesh and glow feedback. | Dramatic, but should preserve branching/arc identity. |
| 2 | `oil-water-universe` | Phase field domain separation with glowing boundaries and oil-slick palette. | Strong fluid-adjacent implicit-boundary demo. |
| 3 | `harmonic-sand` | GPU particle texture sampling standing-wave/height-field gradients. | Scientific/neon clarity; simple force math. |
| 3 | `proto-galaxy-forge` | GPU particles + gravity/accretion trail fields. | Big spectacle but needs careful gravity approximation. |
| 3 | `neon-river-delta` | Height/water/sediment fields with terrain normals and glowing rivers. | Beautiful long-form simulation; more tuning complexity. |
| 3 | `crystal-plasma` | Stress/crack/charge fields over faceted crystal mesh. | Strong contrast to soft-fluid scenes; graph/mesh hybrid. |

`cosmic-ink-ocean` remains a useful immediate Pixi-feedback extraction candidate from the existing audit, but the stronger RAW MODE showcase candidates from this guidance are `amoeba-lamp`, `orbital-shrapnel`, and `ant-signal`.

## Implementation sequencing for the active loop

1. Finish any remaining Fluid Tank quality split stabilization.
2. Do one non-fluid **Pixi feedback** slice if it is already scoped (`cosmic-ink-ocean` remains valid for proving shared feedback helpers).
3. Before adding `raw` to another scene, write a scene-specific mini-plan covering:
   - state textures/fields,
   - quality modes advertised,
   - preview behavior,
   - browser QA route,
   - fallback behavior when WebGL2/raw setup fails,
   - validation commands.
4. Pick the first true RAW MODE implementation from:
   - `amoeba-lamp` for premium organic metaballs,
   - `orbital-shrapnel` for GPU particles/trails,
   - `ant-signal` for pheromone emergence.
5. Extract shared raw/field helpers only after at least two concrete scene implementations prove the boundary.

## 2026-05-29 first true raw candidate decision

After inspecting the current Tier 1 candidates, choose **Amoeba Lamp** for the first true non-fluid RAW MODE implementation slice.

Evidence:

- `AmoebaLampModel` already exposes deterministic blob particles plus `densityField` and `heatField`, so the first raw adapter can treat particles as hidden density/heat sources while persistent GPU textures become the hero visual.
- `AmoebaLampScene` already separates `basic` (`FieldPaletteRenderer`) from `enhanced` (`DensityMetaballRenderer` + particles), making raw quality selection a scene-owned extension without disturbing the existing Pixi paths.
- `AntSignal` remains an excellent pheromone-field candidate, but a valid raw path needs agent sampling/depositing against a pheromone texture and a CPU fallback bridge.
- `OrbitalShrapnel` remains the strongest GPU-particle showcase, but the first valid slice needs particle texture lifecycle plus trail feedback together.

Mini-plan: `docs/plans/amoeba-lamp-raw-mode-mini-plan.md`. Do not advertise `raw` on Amoeba Lamp until that adapter is implemented, validated, and browser-smoked.

## 2026-05-29 Amoeba helper slice

Added `AmoebaLampRawSplatMapper` as the first implementation building block for the Amoeba raw adapter. It converts CPU model particles into bounded density/heat splat descriptors suitable for persistent density/heat texture ping-pong injection, with deterministic upload budgeting. This is intentionally a pure helper only; Amoeba Lamp still advertises `basic`/`enhanced` and raw browser QA is deferred until the adapter exists.

## 2026-05-29 Amoeba heat-source follow-up

Patched the helper contract so raw splats can use actual model particle heat instead of deriving heat from normalized Y position when `heat` is available. `AmoebaLampModel.particleSnapshot()` now exposes heat with coordinates, and the mapper clamps provided heat into the raw upload range. This keeps the future heat ping-pong texture tied to simulation state rather than a screen-space proxy while still leaving `raw` unadvertised until the adapter is implemented and browser-smoked.

## 2026-05-29 Amoeba field-state follow-up

Added `AmoebaLampRawFieldState` as a pure stand-in for the future raw density/heat texture lifecycle. It creates ping-pong density and heat buffers, injects clamped splats, and advances persistent state with decay, diffusion, and upward heat drift. This proves the first adapter state semantics without creating a generic GPU Field Engine or advertising `raw` before a renderer/browser QA slice exists.

## 2026-05-30 Amoeba texture upload follow-up

Added `AmoebaLampRawTextureUpload` as the next raw-adapter helper. It packs persistent density/heat field state into a reusable clamped RGBA upload buffer for the future scene-owned texture adapter, keeping particles as hidden field sources and avoiding a generic GPU Field Engine extraction. Amoeba Lamp still does not advertise `raw` until a selectable adapter and browser QA land.

## 2026-05-30 Amoeba composite mapper follow-up

Added `AmoebaLampRawCompositeMapper` as the next raw-adapter helper. It converts packed persistent density/heat upload buffers into styled RGBA membrane pixels with thresholded background preservation, gradient edge glow, heat-driven warm tinting, and reusable output storage. This proves the first composite-pass semantics without wiring a Pixi/raw adapter or advertising `raw` before browser QA.

## 2026-05-30 Amoeba raw Pixi texture adapter follow-up

Added `AmoebaLampRawRenderer` as the first scene-owned adapter boundary for the Amoeba raw route. It keeps the existing deterministic CPU particles as density/heat sources, steps the persistent raw frame pipeline, composites styled membrane pixels, and uploads them through a Pixi `BufferImageSource` layer sized by a bounded aspect-preserving helper. This is intentionally wired only behind the scene's internal `quality === 'raw'` branch; `amoeba-lamp` still does not advertise `raw`, and previews remain basic/enhanced until browser QA validates the selectable raw route.

## 2026-06-01 engine-change adaptation

Rebased the raw plan over the new typed DOM runtime bridge. The forward path is now:

- Keep Fluid's raw WebGL solver on the typed `DomMountContext`/`DomScriptQualityAdapter` bridge because it intentionally owns a DOM/WebGL canvas below the Pixi shell.
- Keep Amoeba Lamp's first raw route Pixi-owned through `AmoebaLampRawRenderer` because its state can be packed into a bounded texture upload and rendered through the shared Pixi app.
- Treat a core rebuild as mandatory before registry probes whenever core bridge exports change; the observed blocker was stale `packages/core/dist` missing `DomScriptQualityAdapter`, not a source-level adapter mismatch.
- Next implementation slice should expose Amoeba `raw` only after adding an explicit QA route/selector coverage and smoke-testing basic, enhanced, raw, plus raw-leakage into a non-raw simulation.

## 2026-06-01 Amoeba raw exposure slice

Exposed Amoeba Lamp `raw` through `capabilities.qualityModes` and the style manifest after the Pixi-owned `AmoebaLampRawRenderer` landed. Added registry coverage proving only `amoeba-lamp` and `fluid-tank` advertise raw, while Amoeba's factory/preview stay on normal scene classes rather than `DomScriptScene`. Browser QA verified Amoeba basic/enhanced/raw launch with one shared Pixi canvas and no console errors, and confirmed `?quality=raw` sanitizes to basic for Harmonic Sand as a non-raw simulation.

## Acceptance for future raw scenes

A scene may advertise `raw` only when all are true:

- The raw adapter is implemented and selectable through existing `GameLauncher` quality selection.
- Basic/enhanced still function and do not depend on raw resources.
- Preview remains cheap/basic.
- Focused tests cover any pure helper logic.
- Browser smoke confirms raw and basic are visually distinct and no unsupported raw leaks into other experiences.
- The plan/audit is updated with what actually shipped, not just what was proposed.
