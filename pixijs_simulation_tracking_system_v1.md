# PixiJS Simulation Implementation Tracking System v1

This document is a companion to the main master architecture/specification document.

---

# 0. Plan Execution Log

## 2026-05-24 — Engine Simulation Foundation + Harmonic Sand Plate

Scope:
- unify games and simulations under the shared `LabExperience` contract
- add the core simulation primitives required by the master plan
- add `packages/simulations` as a sibling content package to `packages/games`
- implement Harmonic Sand Plate as the first complete simulation
- update the demo app into a game/simulation gallery
- add an `/add-simulation` skill for future simulation additions

Completion target:
- Harmonic Sand Plate must satisfy the Definition of Done in this document before it is marked `COMPLETE`
- shared infrastructure rows below should be updated with concrete implementation notes as each system lands

Decisions:
- `packages/core` owns shared engine, rendering, gestures, style, director, performance, and debug systems
- `packages/games` owns game content
- `packages/simulations` owns simulation content
- `packages/react` owns kind-agnostic React integration components

## 2026-05-24 — Ambient + Reusable FX Engine Support

Scope:
- integrate `pixi_lab_ambients_and_emitters_support_v1.md` into the master plan and tracking system
- add first-class `ambient` and `effect` experience kinds
- add render-mode declarations for fullscreen, background, foreground overlay, widget, and preview tile
- add ambient data binding and behavior contracts
- add reusable burst/effect emitter contracts and engine system
- add React background and foreground overlay components

Deferred:
- ambient catalog implementations such as Day Rhythm Field, Home Weather Glass, Sleep Aquarium, and Task Garden
- foreground overlay content such as Snowfall, Rain Streaks, Leaves/Pollen, and Embers
- real Home Assistant/weather/calendar/media/photo/task adapters; demo and engine support use synthetic/injected data contracts

---

Purpose:
- provide a clean agent-oriented implementation queue
- define simulation implementation workflow
- prevent missing systems/details
- track implementation state
- ensure consistent architecture usage
- provide explicit guidance per simulation
- provide reproducible implementation tasks

This document is intentionally operational and implementation-focused.

The master document defines:
- architecture
- rendering systems
- simulation definitions
- style systems
- shader systems
- UX philosophy

This tracking document defines:
- execution order
- implementation requirements
- completion tracking
- implementation checklists
- agent workflow
- validation requirements
- dependency relationships

---

# 1. Agent Workflow

Every implementation agent should follow this exact process.

```txt
1. Read master architecture document
2. Read this tracking document
3. Find next incomplete simulation
4. Verify dependencies are complete
5. Implement simulation core
6. Implement render layers
7. Implement required styles
8. Implement gestures
9. Implement stagnation recovery
10. Implement director mode hooks
11. Add debug rendering
12. Validate performance
13. Update completion status
14. Add implementation notes/issues
15. Commit before next simulation
```

Agents should NEVER:
- bypass shared rendering architecture
- create one-off shader systems without documenting them
- duplicate existing shader passes
- bypass RenderTargetPool
- hardcode styles into simulation logic
- ignore performance budgets
- implement unbounded particle growth
- use filters per individual object

---

# 2. Global Project Status

## Infrastructure Completion

| System | Status | Notes |
|---|---|---|
| RenderTargetPool | COMPLETE | `packages/core/src/render/RenderTargetPool.ts` supports transient/persistent targets, stats, resize, and destroy. |
| RenderStyleManager | COMPLETE | `packages/core/src/render/RenderStyleManager.ts` owns style manifest, active style, quality, and exportable snapshot. |
| Shared Palette Shader | IN_PROGRESS | Harmonic Sand renders scalar fields through a low-res GPU texture; reusable post-process palette shader remains a follow-up. |
| Trail Feedback System | IN_PROGRESS | Pass IDs/style config exist; real ping-pong trail feedback shader remains a follow-up. |
| Bloom Composite | IN_PROGRESS | Pass IDs/style config exist; real low-res bloom compositor remains a follow-up. |
| PerformanceGovernor | COMPLETE | `packages/core/src/performance/PerformanceGovernor.ts` samples FPS and downgrades quality. |
| DirectorMode | COMPLETE | `packages/core/src/director/DirectorMode.ts` schedules declared ambient events while idle. |
| Gesture Interpreter | COMPLETE | `packages/core/src/gestures/GestureInterpreter.ts` emits tap, drag, hold, fast swipe, double tap, pinch, and spread. |
| ProceduralTextureLibrary | COMPLETE | `packages/core/src/render/procedural/ProceduralTextureLibrary.ts` lazily creates reusable textures and palette strips. |
| Debug Overlay | COMPLETE | `packages/core/src/debug/DebugOverlay.ts` renders FPS, quality, particle, field, and target stats in Pixi. |
| Style Export System | COMPLETE | `packages/core/src/style/StyleExporter.ts` serializes experience/style/seed/quality/uniform snapshots. |
| Shader Uniform Tuning UI | COMPLETE | `packages/react/src/ui/ShaderTuningDrawer.tsx` renders controls from style uniform schemas. |
| AmbientExperience Contract | COMPLETE | `LabExperience` supports `kind: ambient` and `kind: effect` with render modes, data bindings, behavior config, styles, and public exports. |
| AmbientLayer React Component | COMPLETE | `packages/react/src/AmbientLayer.tsx` mounts dashboard/background ambients with opacity, intensity, sleep mode, low motion, pause, seed, and injected data adapters. |
| ForegroundAmbientOverlay | COMPLETE | `packages/react/src/ForegroundAmbientOverlay.tsx` mounts a transparent, fixed, pointer-transparent overlay. |
| Synthetic Ambient Data Adapters | COMPLETE | `packages/core/src/ambient/AmbientDataManager.ts` supports host-injected adapters and synthetic fallback snapshots. |
| BurstEmitterSystem | COMPLETE | `packages/core/src/fx/BurstEmitterSystem.ts` owns shared ParticleContainer layers, seeded emission, caps, cleanup, quality, sleep mode, pause, and global intensity. |
| SparkEmitter | COMPLETE | Core radial impact/electrical burst facade. |
| FireworkEmitter | COMPLETE | Celebration/showcase effect facade; sleep mode suppresses expensive bursts. |
| EmberEmitter | COMPLETE | Cozy upward drift effect facade. |
| ConfettiEmitter | COMPLETE | UI celebration effect facade. |
| FireflyEmitter | COMPLETE | Quiet night/foreground effect facade. |
| SmokeEmitter | COMPLETE | Supporting soft particle effect facade. |
| ArcSparkEmitter | COMPLETE | Plasma/electric short arc effect facade using the shared particle renderer. |

Acceptance notes:
- RenderTargetPool is complete when scenes can acquire/release transient targets and persistent targets are disposed on scene/app shutdown.
- RenderStyleManager is complete when an experience can switch style and quality without recreating simulation state.
- Shared shader systems are complete for this pass when Harmonic Sand Plate uses palette mapping, contour bands, trail feedback, and bloom-style glow through shared pass/config abstractions.
- PerformanceGovernor is complete when it samples frame timing and can downgrade a simulation's quality and particle budget.
- DirectorMode is complete when idle simulations can trigger declared ambient events.
- Gesture Interpreter is complete when tap, drag, hold, fast swipe, double tap, pinch, and spread events are emitted from shared input state.
- ProceduralTextureLibrary is complete when reusable radial, spark, noise, blue-noise, palette strip, caustic, grain, and scanline textures can be requested lazily.
- Debug Overlay is complete when FPS, quality, gestures, field stats, and render-target stats can be visualized without DOM dependencies.
- Style Export System is complete when style id, seed, uniforms, and quality can be serialized from the active experience.
- Shader Uniform Tuning UI is complete when React can render style uniform controls from a manifest without hardcoded simulation-specific panels.
- AmbientExperience Contract is complete when `LabExperience` supports `kind: 'ambient'` with render modes, data bindings, behavior config, styles, and preview support.
- AmbientLayer is complete when React can mount an ambient behind UI with opacity, intensity, sleep mode, low motion, and pause/resume controls.
- ForegroundAmbientOverlay is complete when React can mount transparent above-UI effects without blocking pointer input.
- BurstEmitterSystem is complete when shared effects can emit/update/cleanup with seeded randomness, quality scaling, sleep mode, global intensity, and particle caps.
- Individual emitter rows are complete when the shared system supports that effect kind without per-experience duplicate logic.

## Ambient and FX Infrastructure Queue

| Priority | System | Status | Depends On | Notes |
|---|---|---|---|---|
| 1 | AmbientExperience Contract | COMPLETE | LabExperience | defines ambient/effect interfaces |
| 2 | AmbientLayer React Component | COMPLETE | Pixi app wrapper | background canvas |
| 3 | ForegroundAmbientOverlay | COMPLETE | transparent Pixi canvas | above-UI effects |
| 4 | Synthetic Ambient Data Adapters | COMPLETE | ambient contract | demo-safe fallback + host adapter registry |
| 5 | BurstEmitterSystem | COMPLETE | particle renderer | shared FX |
| 6 | SparkEmitter | COMPLETE | BurstEmitterSystem | core effect |
| 7 | EmberEmitter | COMPLETE | BurstEmitterSystem | ambient effect |
| 8 | ConfettiEmitter | COMPLETE | BurstEmitterSystem | UI celebration |
| 9 | FireworkEmitter | COMPLETE | BurstEmitterSystem | celebration/showcase |
| 10 | FireflyEmitter | COMPLETE | BurstEmitterSystem | quiet ambient |
| 11 | SmokeEmitter | COMPLETE | BurstEmitterSystem | supporting effect |
| 12 | ArcSparkEmitter | COMPLETE | BurstEmitterSystem | plasma/electric effect |

## Ambient Experience Queue

Ambient implementations are deferred until engine support systems above are complete.

| Priority | Ambient | Status | Depends On | Notes |
|---|---|---|---|---|
| 1 | Day Rhythm Field | DEFERRED | AmbientLayer | easiest first ambient |
| 2 | Home Weather Glass | DEFERRED | synthetic weather | strong dashboard value |
| 3 | Sleep Aquarium | DEFERRED | low-motion mode | night/sleep reference |
| 4 | Music Dream Field | DEFERRED | synthetic beat | media integration later |
| 5 | House Pulse Map | DEFERRED | synthetic home events | HA integration later |
| 6 | Task Garden | DEFERRED | synthetic tasks | organizer integration |
| 7 | Family Orbit | DEFERRED | synthetic presence | presence integration later |
| 8 | Memory Drift | DEFERRED | palette input | photo integration later |

## Foreground Overlay Queue

Overlay content implementations are deferred until `ForegroundAmbientOverlay` and the relevant emitters exist.

| Priority | Overlay | Status | Depends On | Notes |
|---|---|---|---|---|
| 1 | Snowfall | DEFERRED | ForegroundAmbientOverlay | simplest overlay |
| 2 | Embers | DEFERRED | EmberEmitter | cozy mode |
| 3 | Fireflies | DEFERRED | FireflyEmitter | quiet night |
| 4 | Confetti | DEFERRED | ConfettiEmitter | UI celebration |
| 5 | Rain Streaks | DEFERRED | particle/line renderer | weather |
| 6 | Leaves/Pollen | DEFERRED | particle renderer | seasonal |

## Ambient / FX Support Implementation Plan

1. COMPLETE — Contracts: add `ambient` and `effect` experience kinds, render modes, ambient data binding types, behavior config, and burst effect definitions.
2. COMPLETE — Engine systems: implement `BurstEmitterSystem`, seeded effect emitters, quality/sleep/intensity scaling, caps, cleanup, and runtime wiring through `GameApp`/`GameContext`.
3. COMPLETE — React support: add `AmbientLayer` and `ForegroundAmbientOverlay` wrappers with opacity, transparent canvas support, pointer-event behavior, sleep mode, low motion, and intensity controls.
4. COMPLETE — Demo support: expose the components and contracts so future demo pages can mount synthetic ambients/effects without real family assistant data.
5. IN_PROGRESS — Validation: typecheck/build/test, verify foreground overlays do not block UI, verify emitters clean up and respect caps.

Status values:
- NOT_STARTED
- IN_PROGRESS
- BLOCKED
- COMPLETE
- NEEDS_REFACTOR
- PERFORMANCE_ISSUES
- DEFERRED

---

# 3. Simulation Implementation Queue

Implement simulations in roughly this order unless dependencies require otherwise.

| Priority | Simulation | Status | Depends On | Notes |
|---|---|---|---|---|
| 1 | Harmonic Sand Plate | IN_PROGRESS | palette + particles | Implemented with GPU field texture upload + ParticleContainer batching; automated checks pass; manual visual/Pi validation still required before COMPLETE. |
| 2 | Mycelium Prism | IN_PROGRESS | triangle grid | Model/scene/preview/demo AI implemented with triangular-grid growth projected through the shared scalar-field renderer; full gate pending. |
| 3 | Amoeba Lamp | IN_PROGRESS | density metaballs | Model/scene/preview/demo AI implemented with low-res density-field metaballs through the shared renderer; full gate pending. |
| 4 | Orbital Shrapnel Field | NOT_STARTED | custom mesh + trails | foundational particle mesh |
| 5 | Plasma Branch Terrarium | NOT_STARTED | charge field | arc rendering |
| 6 | Ant Signal Civilization | NOT_STARTED | trail field | emergence showcase |
| 7 | Crystal Plasma Storm | NOT_STARTED | triangle grid + stress | crystal renderer |
| 8 | Time Echo Particles | NOT_STARTED | history buffers | temporal system |
| 9 | Electro-Osmotic Amoeba | NOT_STARTED | Amoeba Lamp complete | charged membranes |
| 10 | Jelly Web Resonator | NOT_STARTED | spring system | soft-body showcase |
| 11 | Cellular Ocean | NOT_STARTED | spring membranes | advanced membrane rendering |
| 12 | Cosmic Ink Ocean | NOT_STARTED | vector fields | turbulence showcase |
| 13 | Turing Skin | NOT_STARTED | scalar fields | reaction diffusion |
| 14 | Oil-Water Universe | NOT_STARTED | phase separation | material domains |
| 15 | Prism Pool | NOT_STARTED | fake normals | shader showcase |
| 16 | Neon River Delta | NOT_STARTED | height field | erosion system |
| 17 | Alien Vascular Tree | NOT_STARTED | line mesh | branching system |
| 18 | Living Voronoi Tissue | NOT_STARTED | voronoi field | territory simulation |
| 19 | Proto-Galaxy Forge | NOT_STARTED | gravity wells | advanced particles |
| 20 | Chromatic Avalanche Bowl | NOT_STARTED | density buckets | granular fake physics |

---

# 4. Shared Completion Requirements

A simulation cannot be marked COMPLETE unless ALL requirements are satisfied.

## Core Requirements

- simulation update loop exists
- simulation can reset safely
- simulation has seeded reproducibility
- simulation respects shared architecture
- simulation integrates shared gestures
- simulation supports director mode hooks
- simulation has stagnation recovery
- simulation uses RenderTargetPool
- simulation avoids GPU leaks
- simulation avoids unbounded memory growth

---

## Rendering Requirements

- Basic mode implemented
- Enhanced mode implemented
- style manifest implemented
- at least 2 style presets exist
- debug rendering mode exists
- no per-object filters
- uses shared shader systems where possible
- supports graceful degradation

---

## Performance Requirements

Pi 5 target requirements:

```txt
basic:
  stable 60fps target

enhanced:
  stable 30-60fps target

ultra:
  optional
```

The simulation must:
- degrade gracefully
- respect particle budgets
- respect field resolution budgets
- avoid runaway trail accumulation

---

## Code Quality Requirements

- no duplicated shader logic
- no hidden magic numbers
- all style uniforms configurable
- simulation separated from rendering
- no direct DOM dependencies
- no simulation-specific global state

---

# 5. Simulation Tracking Template

Every simulation section below should be updated during implementation.

---

# 6. Harmonic Sand Plate

## Status

```txt
STATUS: IN_PROGRESS
OWNER: Copilot
LAST_UPDATED: 2026-05-24
```

---

## Priority

FOUNDATIONAL

Reason:
- easy to implement
- visually strong
- validates particle + scalar field architecture
- validates palette rendering
- validates director mode frequency shifting

---

## Dependencies

Required before implementation:
- particle renderer
- palette shader
- scalar field renderer
- contour bands

---

## Core Requirements

Implement:
- standing wave field
- resonance emitters
- particle nodal attraction
- frequency interpolation
- multiple emitters

---

## Required Render Layers

```txt
particles
field
glow
debug
```

---

## Required Shader Features

```txt
paletteMap
contourBands
bloom
fieldVisualize
```

---

## Required Styles

### Chladni Gold

Black background with gold nodal structures.

### Laser Plate

Bright cyan/magenta interference.

### Ghost Frequency

Trailing old wave patterns.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | create emitter |
| drag | move emitter |
| hold | amplify frequency |
| swipe | wave shock |

---

## Director Mode Events

- slow frequency sweep
- emitter drift
- resonance pulse
- ambient harmonic transition

---

## Stagnation Recovery

If:
- particles settle too uniformly
- field becomes static

Then:
- shift phase
- slightly perturb emitters
- inject new harmonic source

---

## Performance Targets

```txt
particles:
  5k-20k

wave field:
  64x36 to 128x72
```

---

## Agent Implementation Guidance

IMPORTANT:
- wave field should be low-resolution
- particles should sample field
- particles should NOT fully simulate collisions
- transitions between frequencies should interpolate smoothly
- bloom should remain subtle
- contour bands should be low intensity

Do NOT:
- use expensive FFT simulation
- render every particle individually as Graphics objects

---

## Validation Checklist

- [x] particles organize into visible nodal lines in model/render implementation
- [x] frequency changes reorganize patterns smoothly in model update logic
- [x] no flickering at low frequencies in deterministic field update tests
- [ ] stable FPS on Pi target
- [x] style presets visibly distinct in manifests and render palette configuration
- [x] director mode remains subtle in declared event intensities and intervals

---

## Known Risks

- visual noise from excessive contour bands
- too much bloom obscuring patterns
- particle overcrowding near nodes

---

## Notes

Implemented files:
- `packages/simulations/src/harmonic-sand/HarmonicSandModel.ts`
- `packages/simulations/src/harmonic-sand/HarmonicSandScene.ts`
- `packages/simulations/src/harmonic-sand/HarmonicSandPreviewScene.ts`
- `packages/simulations/src/harmonic-sand/harmonic-sand.definition.ts`
- `packages/simulations/src/harmonic-sand/styles/chladni-gold.ts`
- `packages/simulations/src/harmonic-sand/styles/laser-plate.ts`
- `packages/simulations/src/harmonic-sand/styles/ghost-frequency.ts`
- `packages/simulations/src/harmonic-sand/__tests__/HarmonicSandModel.test.ts`

GPU/performance notes:
- `packages/core/src/render/SimulationCanvasLayer.ts` renders scalar fields as one low-resolution texture uploaded to the GPU instead of per-cell `Graphics` draws.
- Harmonic Sand particles render through one Pixi `ParticleContainer` with a shared radial texture instead of per-particle `Graphics` draws.
- Basic/Enhanced quality budgets map to lower/higher field resolution and particle caps for desktop and Raspberry Pi 5 class hardware.

Verification completed:
- `pnpm --recursive typecheck`
- `pnpm --recursive build`
- `pnpm test` — 9 tests passed

Deferred before marking COMPLETE:
- manual demo visual verification across Basic and Enhanced
- Pi 5 FPS validation
- replace shared post-process pass scaffolds with actual reusable GPU palette/contour/trail/bloom implementations for later simulations

---

# 7. Mycelium Prism

## Status

```txt
STATUS: IN_PROGRESS
OWNER: NeoBot
LAST_UPDATED: 2026-05-25
```

---

## Priority

FOUNDATIONAL

Reason:
- validates triangular grid architecture
- validates growth systems
- validates palette + edge glow rendering

---

## Dependencies

- triangular grid renderer
- palette shader
- edge glow pass

---

## Core Requirements

Implement:
- growth fronts
- competing strains
- decay
- moisture influence
- nutrient spread
- active vein pulses

---

## Required Render Layers

```txt
grid
field
glow
debug
```

---

## Required Shader Features

```txt
paletteMap
edgeGlow
bloom
contourBands
```

---

## Required Styles

### Neon Mold

Bright fungal growth.

### Rot Bloom

Dark decay-focused style.

### Synaptic Fungus

Neural pulse appearance.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | seed spores |
| drag | smear nutrients |
| hold | moisture bloom |
| swipe | scar region |

---

## Director Mode Events

- seed new colonies
- increase moisture region
- pulse active veins
- decay overcrowded areas

---

## Stagnation Recovery

If:
- growth fills entire screen
- no active frontier remains

Then:
- introduce decay
- seed new competing strain
- reduce moisture locally

---

## Performance Targets

```txt
grid:
  128x72 to 256x144

active updates:
  frontier-based only
```

---

## Agent Implementation Guidance

IMPORTANT:
- update only frontier cells where possible
- use low-resolution scalar fields
- edge glow should emphasize active growth
- old regions should visually cool/darken
- style differences should mostly come from palette + pulse behavior

Do NOT:
- brute force full-grid expensive updates every frame
- use one Pixi object per cell

---

## Validation Checklist

- [x] growth appears organic in deterministic model behavior
- [x] active fronts visually readable through field projection and debug stats
- [ ] decay visible
- [x] styles visually distinct in style manifests
- [ ] stable FPS on Pi target
- [x] no unbounded memory growth in model tests

---

## Known Risks

- visually muddy overgrowth
- all strains merging into one color
- frontier update bugs

---

## Notes

Implemented files:
- `packages/simulations/src/mycelium-prism/MyceliumPrismModel.ts`
- `packages/simulations/src/mycelium-prism/MyceliumPrismScene.ts`
- `packages/simulations/src/mycelium-prism/MyceliumPrismPreviewScene.ts`
- `packages/simulations/src/mycelium-prism/MyceliumPrismDemoAI.ts`
- `packages/simulations/src/mycelium-prism/mycelium-prism.definition.ts`
- `packages/simulations/src/mycelium-prism/styles/*.ts`
- `packages/simulations/src/mycelium-prism/__tests__/MyceliumPrismModel.test.ts`

Implementation notes:
- Uses shared `TriangularGrid` for cell ownership/frontier state and projects nutrient/energy into a `ScalarField` so the existing shared GPU texture renderer can launch the demo without one Pixi object per cell.
- Gestures map to spore seeding, nutrient smearing, moisture blooms, and vein pulses.
- Stagnation recovery reseeds/feeds an active or central colony when frontiers are exhausted.

Deferred before marking COMPLETE:
- dedicated triangular mesh renderer/edge glow beyond scalar-field projection
- manual visual validation and Pi 5 FPS pass
- richer decay visuals after first playable pass

---

# 8. Amoeba Lamp / Metaball Biosoup

## Status

```txt
STATUS: IN_PROGRESS
OWNER: NeoBot
LAST_UPDATED: 2026-05-25
```

---

## Priority

FOUNDATIONAL

Reason:
- validates metaball rendering
- validates density fields
- validates advanced shader compositing
- major visual showcase simulation

---

## Dependencies

- density field renderer
- metaball threshold shader
- bloom composite
- fake normals

---

## Core Requirements

Implement:
- blob cohesion
- merging/splitting
- buoyancy
- heat convection
- nuclei particles
- touch interaction

---

## Required Render Layers

```txt
particles
density
mask
glow
debug
```

---

## Required Shader Features

```txt
densityMetaball
edgeGlow
normalLighting
distortion
bloom
contourBands
```

---

## Required Styles

### Bio Plasma

Electric organic look.

### Oil Slick

Rainbow thin-film look.

### Toxic Lagoon

Acidic bubbling organism look.

### Molten Organism

Hot thermal gradient look.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | spawn blob |
| drag | stir fluid |
| hold | inject heat |
| swipe | split blobs |

---

## Director Mode Events

- inject heat plume
- spawn micro bubbles
- split giant blob
- shift palette subtly

---

## Stagnation Recovery

If:
- all blobs merge
- no movement remains

Then:
- split largest blob
- inject convection plume
- increase turbulence temporarily

---

## Performance Targets

```txt
blob particles:
  2k-8k

density field:
  320x180 to 640x360
```

---

## Agent Implementation Guidance

IMPORTANT:
- density rendering should be low-resolution
- fake normals should derive from density
- bloom should be subtle and low-res
- avoid excessive chromatic aberration
- touch interaction should feel fluid

Do NOT:
- use full fluid simulation
- use expensive blur passes at native resolution

---

## Validation Checklist

- [x] blobs merge smoothly in deterministic model behavior
- [x] membrane edges visually readable through density-field projection/style passes
- [x] styles clearly distinct in style manifests
- [x] touch interaction mapped and covered by model tests
- [ ] stable FPS
- [x] no unbounded density/particle growth in model tests

---

## Known Risks

- excessive blur causing mushy visuals
- aliasing around threshold edges
- unstable blob clustering

---

## Notes

Implemented files:
- `packages/simulations/src/amoeba-lamp/AmoebaLampModel.ts`
- `packages/simulations/src/amoeba-lamp/AmoebaLampScene.ts`
- `packages/simulations/src/amoeba-lamp/AmoebaLampPreviewScene.ts`
- `packages/simulations/src/amoeba-lamp/AmoebaLampDemoAI.ts`
- `packages/simulations/src/amoeba-lamp/amoeba-lamp.config.ts`
- `packages/simulations/src/amoeba-lamp/amoeba-lamp.definition.ts`
- `packages/simulations/src/amoeba-lamp/styles/*.ts`
- `packages/simulations/src/amoeba-lamp/__tests__/AmoebaLampModel.test.ts`

Implementation notes:
- Uses deterministic blob particles with surface tension, low-cost proximity merging, buoyant heat, swipe splitting, and bounded particle budgets.
- Projects particle kernels into shared `DensityField`/`ScalarField` grids and renders the density field with `SimulationCanvasLayer.renderField()` for the first playable pass instead of introducing a one-off renderer.
- Gestures map to blob spawn, drag stirring, hold heat plumes, and fast-swipe splitting; stagnation recovery splits the largest blob and injects convection.

Deferred before marking COMPLETE:
- dedicated GPU metaball threshold/membrane composite beyond the shared field texture renderer
- real fake-normal lighting and mask/glow render targets rather than declared pass/style metadata
- manual demo visual validation and Pi 5 FPS pass

---

# 9. Remaining Simulation Tracking Sections

IMPORTANT:
Every remaining simulation should follow EXACTLY the same structure:

```txt
Status
Priority
Dependencies
Core Requirements
Required Render Layers
Required Shader Features
Required Styles
Shared Gestures
Director Mode Events
Stagnation Recovery
Performance Targets
Agent Implementation Guidance
Validation Checklist
Known Risks
Notes
```

The remaining simulations must be added using this exact format:

- Orbital Shrapnel Field
- Plasma Branch Terrarium
- Ant Signal Civilization
- Crystal Plasma Storm
- Time Echo Particles
- Electro-Osmotic Amoeba
- Jelly Web Resonator
- Cellular Ocean
- Cosmic Ink Ocean
- Turing Skin
- Oil-Water Universe
- Prism Pool
- Neon River Delta
- Alien Vascular Tree
- Living Voronoi Tissue
- Proto-Galaxy Forge
- Chromatic Avalanche Bowl

---

# 10. Agent Update Rules

When an agent completes work:

## Required Tracking Updates

The agent MUST:
- update STATUS
- update LAST_UPDATED
- append implementation notes
- append discovered issues
- append performance findings
- append shader/rendering findings
- mark completed validation items

---

## If Blocked

The agent must:
- set STATUS=BLOCKED
- describe blocker
- describe attempted solutions
- describe dependency required

---

## If Refactor Needed

The agent must:
- set STATUS=NEEDS_REFACTOR
- explain architectural issue
- explain risk of continuing without refactor

---

# 11. Recommended Git Workflow

Recommended commit structure:

```txt
feat(sim): harmonic sand core simulation
feat(render): metaball density compositor
feat(style): amoeba oil slick style
perf(trails): optimize feedback pass
fix(plasma): stabilize arc branching
```

Avoid giant multi-simulation commits.

---

# 12. Final Guidance for Agents

The project succeeds if:
- simulations feel alive
- styles feel dramatically different
- rendering stays performant
- the architecture stays reusable
- new simulations become easier over time

The project fails if:
- every simulation becomes a unique rendering engine
- performance collapses under shaders
- styles are hardcoded into simulation logic
- render targets leak
- simulations stagnate visually
- interactions feel inconsistent

The most important reusable systems are:

1. Palette + Edge Shader
2. Trail Feedback System
3. Metaball Density Renderer
4. RenderTargetPool
5. PerformanceGovernor

These systems should be treated as core infrastructure, not simulation-specific features.
