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

## 2026-05-26 — Mycelium Prism Revert + Mycelium Lattice + Simulation Improvements

Scope:
- revert Mycelium Prism rendering from `MeshLatticeRenderer` back to `FieldPaletteRenderer` (scalar-field projection, square cells)
- add new Mycelium Lattice simulation using `MeshLatticeRenderer` with tips-based triangular growth, probability sliders, and earth/arctic/volcanic palettes
- implement Orbital Shrapnel Field, Plasma Branch Terrarium, Ant Signal Civilization, Crystal Plasma Storm, and Time Echo Particles scene/model/definition work
- restore all 9 simulations to `packages/simulations/src/index.ts` barrel
- fix simulations build script to `tsc --build --force` to eliminate tsbuildinfo cache problems
- add `maxFps` cap to core Ticker/GameApp for preview tile thread sharing
- improve GameLauncher, GameTile, and SettingsDrawer in packages/react

---

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
| 2 | Mycelium Prism | IN_PROGRESS | triangle grid | Reverted to `FieldPaletteRenderer` square-cell projection; `MeshLatticeRenderer` rendering deferred. Full visual/Pi gate pending. |
| 2a | Mycelium Lattice | IN_PROGRESS | MeshLatticeRenderer | Tips-based triangular growth with probability sliders; `MeshLatticeRenderer` rendering; 3 styles; DemoAI; 10 model tests pass. Full visual/Pi gate pending. |
| 3 | Amoeba Lamp | IN_PROGRESS | density metaballs | Model/scene/preview/demo AI implemented with low-res density-field metaballs through the shared renderer; full gate pending. |
| 4 | Orbital Shrapnel Field | IN_PROGRESS | custom mesh + trails | Model/scene/preview/demo AI implemented with deterministic orbital debris and a shared low-res trail field renderer; full automated gate passes under temporary Node 22/pnpm 10 toolchain. |
| 5 | Plasma Branch Terrarium | IN_PROGRESS | charge field | Model/scene/preview/demo AI implemented with deterministic charge-grid branching and shared scalar/trail field rendering; full gate pending. |
| 6 | Ant Signal Civilization | IN_PROGRESS | trail field | Model/scene/preview/demo AI implemented with deterministic pheromone-routing agents and shared trail/field rendering; full gate pending. |
| 7 | Crystal Plasma Storm | IN_PROGRESS | triangle grid + stress | Model/scene/preview/demo AI implemented with deterministic crystal lattice growth, bounded stress/fracture fields, and shared scalar/trail field rendering; full gate pending. |
| 8 | Time Echo Particles | IN_PROGRESS | history buffers | Model/scene/preview/demo AI implemented with deterministic bounded history buffers, live-polled echo controls, shared trail/particle rendering, and temporal anchor/freeze gestures; full automated gate pending. |
| 9 | Electro-Osmotic Amoeba | IN_PROGRESS | Amoeba Lamp complete | Model/scene/preview/demo AI implemented with deterministic charged membrane particles, voltage/osmotic live controls, shared density rendering, and electro-fission gestures; full automated gate pending. |
| 10 | Jelly Web Resonator | IN_PROGRESS | spring system | Model/scene/preview/demo AI implemented with deterministic SpringSystem web rings, live tension/damping/resonance controls, shared field/particle rendering, and pluck/shear gestures; full automated gate pending. |
| 11 | Cellular Ocean | IN_PROGRESS | spring membranes | Model/scene/preview/demo AI implemented with deterministic SpringSystem membrane cells, live tension/viscosity/drift controls, shared field/particle rendering, and pulse/shear gestures; full automated gate pending. |
| 12 | Cosmic Ink Ocean | IN_PROGRESS | vector fields | Model/scene/preview/demo AI implemented with deterministic vector turbulence, bounded ink scalar field, live flow controls, shared field/particle rendering, and vortex/shear gestures; full automated gate pending. |
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
- Uses shared `TriangularGrid` for cell ownership/frontier state and projects nutrient/energy into a `ScalarField` rendered via `FieldPaletteRenderer` (square-cell projection). The `MeshLatticeRenderer` path was removed; a companion simulation (Mycelium Lattice) now owns the triangular mesh rendering approach.
- Gestures map to spore seeding, nutrient smearing, moisture blooms, and vein pulses.
- Stagnation recovery reseeds/feeds an active or central colony when frontiers are exhausted.

Deferred before marking COMPLETE:
- manual visual validation and Pi 5 FPS pass
- richer decay visuals after first playable pass

---

# 8. Mycelium Lattice

## Status

```txt
STATUS: IN_PROGRESS
OWNER: NeoBot
LAST_UPDATED: 2026-05-26
```

---

## Priority

SHOWCASE

Reason:
- first simulation to use `MeshLatticeRenderer` triangular grid rendering
- validates tips-based probabilistic growth architecture
- earth/arctic/volcanic palette trio

---

## Dependencies

- `MeshLatticeRenderer` (triangular grid, TriangularGrid type)
- `SeededRng`
- `SettingsField` resolution + probability sliders

---

## Core Requirements

Implemented:
- tips-based triangular growth with competing strains
- 4-direction headings with forward/side branching
- `growthProbability`, `branchChance`, `generationHueStep`, `resolution` live-polled sliders
- hold gesture resets; tap/drag seed colonies
- stagnation detection and `stabilize()` injects new spore
- `projectGrid()` maps strain/generation/moisture to hue-shifted `cell.value`

---

## Required Styles

### Earth Overgrowth

10-entry moss/clay/dusk palette, dark background.

### Arctic Lichen

10-entry frost-blue/ice-white palette, near-black cold background.

### Volcanic Spore

10-entry charcoal/ember/orange palette, near-black warm background.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | seed colony at touch point |
| drag | seed colony along drag path |
| hold | reset simulation |

---

## Director Mode Events

- `spore-scatter` — seed colony near random active tip
- `tip-surge` — temporarily boost growth probability
- `hue-drift` — nudge generationHueStep

---

## Stagnation Recovery

If no active tips remain, `stabilize()` seeds a new colony at a random empty cell.

---

## Validation Checklist

- [x] deterministic initialization from same seed
- [x] living cells appear after initialization
- [x] active tips present after initialization
- [x] growth advances over multiple ticks
- [x] tap/drag gestures increase living cells
- [x] reset clears growth state
- [x] live setters (`setGrowthProbability`, etc.) do not throw
- [x] grid cell values stay in [0, 1]
- [x] `stabilize()` adds new growth when stagnant
- [ ] manual visual validation
- [ ] Pi 5 FPS validation
- [ ] stable loop with DemoAI for extended session

---

## Notes

Implemented files:
- `packages/simulations/src/mycelium-lattice/mycelium-lattice.config.ts`
- `packages/simulations/src/mycelium-lattice/mycelium-lattice.definition.ts`
- `packages/simulations/src/mycelium-lattice/MyceliumLatticeModel.ts`
- `packages/simulations/src/mycelium-lattice/MyceliumLatticeScene.ts`
- `packages/simulations/src/mycelium-lattice/MyceliumLatticePreviewScene.ts`
- `packages/simulations/src/mycelium-lattice/MyceliumLatticeDemoAI.ts`
- `packages/simulations/src/mycelium-lattice/styles/earth-overgrowth.ts`
- `packages/simulations/src/mycelium-lattice/styles/arctic-lichen.ts`
- `packages/simulations/src/mycelium-lattice/styles/volcanic-spore.ts`
- `packages/simulations/src/mycelium-lattice/__tests__/MyceliumLatticeModel.test.ts`

Implementation notes:
- Uses `MeshLatticeRenderer` directly — no scalar-field projection. Growth state is stored in a `TriangularGrid`; `renderGrid()` is called each frame.
- `cell.value` is computed from strain, generation count, and moisture to produce hue-shifted colour bands through the renderer palette.
- Preview scene uses 28 columns (reduced budget).
- DemoAI defines 7 parameter presets covering the full slider range; overhaul cycle is 18–32 s.

Deferred before marking COMPLETE:
- manual visual validation and Pi 5 FPS pass
- richer moisture/decay visuals
- edge glow pass for active tips

---

# 9. Amoeba Lamp / Metaball Biosoup

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

# 9. Orbital Shrapnel Field
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
- validates particle orbit systems
- validates trail-field rendering and shockwave metadata
- establishes first space/field simulation for the gallery

---

## Dependencies

- particle renderer
- trail field
- shockwave/bloom pass metadata

---

## Core Requirements

Implemented:
- central gravity approximation
- bounded debris particles
- transient gravity wells
- swipe shockwaves
- dust trail deposition/fade

---

## Required Render Layers

```txt
particles
trails
glow
debug
```

---

## Required Shader Features

```txt
trailFeedback
paletteMap
bloom
shockwave
chromaticAberration
```

---

## Required Styles

### Ice Ring
Cold blue debris and dust trails.

### Solar Debris
Amber-hot asteroid shards and ember trails.

### Black Hole Lens
Violet/green high-contrast gravity-lens palette.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | soft shockwave |
| drag | swish debris |
| hold | temporary gravity well |
| swipe | strong shockwave |

---

## Director Mode Events

- meteor shower
- gravity pulse
- dust shear

---

## Stagnation Recovery

If:
- ring loses velocity
- radial variation collapses
- trails become uniform/dead

Then:
- inject central shockwave
- add tangential velocity variation
- heat/deposit fresh trails

---

## Performance Targets

```txt
particles:
  120-1200 first-playable budget

trail field:
  32x18 to 128x72
```

---

## Agent Implementation Guidance

IMPORTANT:
- first playable uses shared `SimulationCanvasLayer.renderField()` and `renderParticles()` rather than a custom debris mesh
- all forces are O(n) with capped wells/shockwaves
- no particle growth occurs during gestures

Do NOT:
- add all-pairs gravity
- create one Pixi object per debris shard

---

## Validation Checklist

- [x] debris orbits deterministically in model behavior
- [x] drag/hold/swipe gestures alter orbital motion
- [x] trails are bounded and fade over time
- [x] styles clearly distinct in style manifests
- [ ] stable FPS on Pi target
- [x] full automated gate in current environment

---

## Known Risks

- shared particle renderer does not yet render true triangular shards/custom mesh silhouettes
- trail feedback is a CPU-side low-resolution field projection for the first playable pass
- shockwave/chromatic/distortion effects are declared in style metadata but await reusable GPU compositor implementation

---

## Notes

Implemented files:
- `packages/simulations/src/orbital-shrapnel/OrbitalShrapnelModel.ts`
- `packages/simulations/src/orbital-shrapnel/OrbitalShrapnelScene.ts`
- `packages/simulations/src/orbital-shrapnel/OrbitalShrapnelPreviewScene.ts`
- `packages/simulations/src/orbital-shrapnel/OrbitalShrapnelDemoAI.ts`
- `packages/simulations/src/orbital-shrapnel/orbital-shrapnel.config.ts`
- `packages/simulations/src/orbital-shrapnel/orbital-shrapnel.definition.ts`
- `packages/simulations/src/orbital-shrapnel/styles/*.ts`
- `packages/simulations/src/orbital-shrapnel/__tests__/OrbitalShrapnelModel.test.ts`

Implementation notes:
- Uses deterministic seeded debris particles, central inverse-radius gravity approximation, capped transient gravity wells, capped shockwaves, and a bounded `TrailField`.
- Scene renders the trail field through the shared GPU field upload path and particles through the shared particle layer for a first playable pass.
- Model tests were authored before implementation; initial RED validation exposed a stagnation-recovery radial-variance failure, then the model was fixed and the full automated gate passed under a temporary Node 22/pnpm 10 toolchain.

Deferred before marking COMPLETE:
- install/restore persistent pnpm/node in the cron environment so future runs do not need a temporary toolchain bootstrap
- dedicated custom triangular debris mesh renderer
- real reusable trail feedback/shockwave/chromatic GPU compositor pass
- manual demo visual validation and Pi 5 FPS pass

---

# 10. Plasma Branch Terrarium
## Status

```txt
STATUS: IN_PROGRESS
OWNER: NeoBot
LAST_UPDATED: 2026-05-26
```

---

## Priority

FOUNDATIONAL

Reason:
- validates charge-field simulation behavior
- validates branching discharge and scar trail rendering metadata
- provides the first electric/plasma interaction showcase

---

## Dependencies

- scalar charge field
- trail field scars
- edge-glow/bloom pass metadata

---

## Core Requirements

Implemented:
- bounded charge grid with deterministic decay
- branching discharge tips with bounded branch budget
- charge injection and directional swipe discharges
- persistent scar trail deposition/fade
- stagnation recovery when charge or branches drain out

---

## Required Render Layers

```txt
field
trails
particles
stroke/glow
```

---

## Required Shader Features

```txt
paletteMap
edgeGlow
bloom
scars/trailFeedback
```

---

## Required Styles

### Lightning Garden
White-blue branching arcs over violet charge.

### Neon Circuit
Green/magenta circuit-like plasma scars.

### Blood Plasma
Red-gold ion branches and smoky crimson scars.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | inject charge and seed a branch |
| drag | paint ionized charge paths |
| hold | build charge bloom |
| swipe | directional discharge |

---

## Director Mode Events

- ambient charge build-up
- branch fork
- scar glow pulse

---

## Stagnation Recovery

If:
- charge drains away
- no active branches remain
- charge field becomes uniform

Then:
- inject a central charge bloom
- seed radial discharge tips
- reset stagnation timer

---

## Performance Targets

```txt
branches:
  80-420 first-playable budget

charge/scar field:
  32x18 to 128x72
```

---

## Agent Implementation Guidance

IMPORTANT:
- first playable uses shared `SimulationCanvasLayer.renderField()` and `renderParticles()` rather than a custom arc mesh
- branch growth is O(branches) with a capped branch budget
- charge/scar fields are low-resolution and bounded

Do NOT:
- create one Pixi object per arc segment
- add unbounded recursive branching
- implement simulation-specific shader infrastructure before reusable compositor support exists

---

## Validation Checklist

- [x] branching charge evolves deterministically in model behavior
- [x] tap/drag/hold/swipe gestures alter charge and discharge motion
- [x] scar trails are bounded and fade over time
- [x] styles clearly distinct in style manifests
- [ ] stable FPS on Pi target
- [x] full automated gate in current environment

---

## Known Risks

- shared particle renderer does not yet draw true continuous lightning polylines or variable-width arc meshes
- edge glow/bloom/scar effects are represented through shared field/particle render paths and style metadata until reusable GPU compositor work lands
- visual richness depends on future line/arc renderer improvements

---

## Notes

Implemented files:
- `packages/simulations/src/plasma-branch/PlasmaBranchModel.ts`
- `packages/simulations/src/plasma-branch/PlasmaBranchScene.ts`
- `packages/simulations/src/plasma-branch/PlasmaBranchPreviewScene.ts`
- `packages/simulations/src/plasma-branch/PlasmaBranchDemoAI.ts`
- `packages/simulations/src/plasma-branch/plasma-branch.config.ts`
- `packages/simulations/src/plasma-branch/plasma-branch.definition.ts`
- `packages/simulations/src/plasma-branch/styles/*.ts`
- `packages/simulations/src/plasma-branch/__tests__/PlasmaBranchModel.test.ts`

Implementation notes:
- Tests were written first and initially failed on the missing model import, then passed after model implementation.
- Uses deterministic seeded branch tips, a bounded scalar charge field, and a bounded `TrailField` for plasma scars.
- Scene renders charge/scar fields through the shared GPU field upload path and branch tips through the shared particle layer for the first playable pass.

Deferred before marking COMPLETE:
- dedicated reusable arc/line mesh renderer for continuous lightning branches
- real reusable edge-glow/bloom/scar compositor passes beyond declared style metadata
- manual demo visual validation and Pi 5 FPS pass

---

# 11. Ant Signal Civilization
## Status

```txt
STATUS: IN_PROGRESS
OWNER: NeoBot
LAST_UPDATED: 2026-05-26
```

---

## Priority

FOUNDATIONAL

Reason:
- validates swarm/agent emergence over low-resolution fields
- validates pheromone trail-field rendering and bounded routing signals
- provides the first stigmergy/civilization showcase for the gallery

---

## Dependencies

- trail field
- particle renderer
- palette/bloom pass metadata

---

## Core Requirements

Implemented:
- deterministic bounded ant agents
- central nest signal and shifting food sources
- pheromone deposition, fade, and user-painted guide roads
- food pickup/return state transitions
- stagnation recovery when food/trails collapse

---

## Required Render Layers

```txt
trails
field
particles
glow
debug
```

---

## Required Shader Features

```txt
trailFeedback
paletteMap
bloom
edgeGlow
contourBands
```

---

## Required Styles

### Neon Colony
Hot amber/magenta pheromone roads on a deep violet nest field.

### Circuit Ants
Green/cyan living PCB routing signals.

### Fungal Roads
Organic lime and magenta biological trail highways.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | add food source |
| drag | paint pheromone guide road |
| hold | seed dense food/signal bloom |
| swipe | wipe trails and redirect routing |

---

## Director Mode Events

- food bloom
- pheromone pulse
- route shift

---

## Stagnation Recovery

If:
- food sources disappear
- pheromone variation collapses
- trails fade to uniform darkness

Then:
- add fresh food sources
- paint a nest-to-food signal road
- perturb a subset of ants

---

## Performance Targets

```txt
ants:
  40-360 first-playable budget

trail/signals:
  32x18 to 128x72
```

---

## Agent Implementation Guidance

IMPORTANT:
- first playable uses shared `SimulationCanvasLayer.renderField()` and `renderParticles()` rather than a custom instanced ant mesh
- updates are O(ants + food sources) with bounded field sizes
- food and pheromone state remains capped to avoid unbounded growth

Do NOT:
- add expensive all-agent neighbor interactions
- create one Pixi object per ant
- build simulation-specific trail shaders before reusable compositor support exists

---

## Validation Checklist

- [x] ants route deterministically in model behavior
- [x] tap/drag/hold/swipe gestures alter food and pheromone state
- [x] pheromone trails are bounded and fade over time
- [x] styles clearly distinct in style manifests
- [ ] stable FPS on Pi target
- [x] full automated gate in current environment

---

## Known Risks

- first-playable particles are point sprites rather than ant silhouettes or oriented sprites
- pheromone feedback/bloom/contour effects are represented through shared field rendering and style metadata until reusable GPU compositor work lands
- emergent routing may need tuning after manual visual validation

---

## Notes

Implemented files:
- `packages/simulations/src/ant-signal/AntSignalModel.ts`
- `packages/simulations/src/ant-signal/AntSignalScene.ts`
- `packages/simulations/src/ant-signal/AntSignalPreviewScene.ts`
- `packages/simulations/src/ant-signal/AntSignalDemoAI.ts`
- `packages/simulations/src/ant-signal/ant-signal.config.ts`
- `packages/simulations/src/ant-signal/ant-signal.definition.ts`
- `packages/simulations/src/ant-signal/styles/*.ts`
- `packages/simulations/src/ant-signal/__tests__/AntSignalModel.test.ts`

Implementation notes:
- Tests were written first and initially failed on the missing model import, then passed after implementing the deterministic model.
- Uses seeded ant agents with food/nest signal sampling, bounded `TrailField` pheromone deposition/fade, and capped food-source growth.
- Scene renders food/pheromone fields through the shared GPU field upload path and ants through the shared particle layer for the first playable pass.

Deferred before marking COMPLETE:
- dedicated reusable oriented sprite/instanced ant renderer
- real reusable trail feedback/bloom/edge compositor passes beyond declared style metadata
- manual demo visual validation and Pi 5 FPS pass

---

# 12. Crystal Plasma Storm
## Status

```txt
STATUS: IN_PROGRESS
OWNER: NeoBot
LAST_UPDATED: 2026-05-26
```

---

## Priority

FOUNDATIONAL

Reason:
- validates triangular-grid crystal growth behavior
- validates stress/fracture field projection through shared render layers
- provides an electric faceted showcase before advanced membrane/temporal simulations

---

## Dependencies

- triangular grid
- scalar stress field
- trail/fracture field
- edge-glow/bloom/facet pass metadata

---

## Core Requirements

Implemented:
- deterministic seeded crystal facet growth
- bounded lattice cell activation and stress accumulation
- fracture trail deposition and fade
- tap/drag/hold/swipe gesture mapping
- stagnation recovery when lattice growth or stress collapses

---

## Required Render Layers

```txt
field
trails
particles
glow
debug
```

---

## Required Shader Features

```txt
paletteMap
edgeGlow
bloom
trailFeedback
contourBands
distortion
```

---

## Required Styles

### Ice Lightning
Cold blue facets with white electrical fractures.

### Ruby Fault
Crimson crystal stress with molten gold fault lines.

### Aurora Quartz
Green/violet/cyan quartz facets with aurora-like glow.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | seed crystal facets |
| drag | paint charge stress |
| hold | build stress bloom |
| swipe | fracture faults and discharge stress |

---

## Director Mode Events

- crystal growth spurt
- stress bloom
- random fracture

---

## Stagnation Recovery

If:
- crystal growth drains out
- stress field becomes uniform
- no active crystal facets remain

Then:
- seed central facets
- inject stress bloom
- reset stagnation timer

---

## Performance Targets

```txt
crystals:
  80-520 first-playable budget

stress/fracture field:
  32x18 to 128x72
```

---

## Agent Implementation Guidance

IMPORTANT:
- first playable uses shared `SimulationCanvasLayer.renderField()` and `renderParticles()` rather than a custom crystal mesh
- growth is O(active crystals) with a capped crystal budget
- stress and fracture fields are low-resolution and bounded

Do NOT:
- create one Pixi object per lattice cell
- introduce simulation-specific facet shaders before reusable compositor support exists
- allow unbounded recursive crystal growth

---

## Validation Checklist

- [x] crystal lattice grows deterministically in model behavior
- [x] tap/drag/hold/swipe gestures alter stress and fracture state
- [x] fracture trails are bounded and fade over time
- [x] styles clearly distinct in style manifests
- [ ] stable FPS on Pi target
- [x] model tests pass in current environment

---

## Known Risks

- first-playable render uses point sprites and scalar fields rather than true triangular facet mesh lighting
- facet lighting/crack/bloom effects are represented through shared field rendering and style metadata until reusable GPU compositor work lands
- crystal growth/fracture balance may need tuning after manual visual validation

---

## Notes

Implemented files:
- `packages/simulations/src/crystal-plasma/CrystalPlasmaModel.ts`
- `packages/simulations/src/crystal-plasma/CrystalPlasmaScene.ts`
- `packages/simulations/src/crystal-plasma/CrystalPlasmaPreviewScene.ts`
- `packages/simulations/src/crystal-plasma/CrystalPlasmaDemoAI.ts`
- `packages/simulations/src/crystal-plasma/crystal-plasma.config.ts`
- `packages/simulations/src/crystal-plasma/crystal-plasma.definition.ts`
- `packages/simulations/src/crystal-plasma/styles/*.ts`
- `packages/simulations/src/crystal-plasma/__tests__/CrystalPlasmaModel.test.ts`

Implementation notes:
- Tests were written first and initially failed on the missing model import, then exposed a fracture-deposition behavior gap that was fixed in the deterministic model.
- Uses a shared `TriangularGrid` for active crystal facets, a bounded `ScalarField` for stress, and a bounded `TrailField` for fracture scars.
- Scene renders stress/fracture fields through the shared GPU field upload path and crystal facets through the shared particle layer for the first playable pass.

Deferred before marking COMPLETE:
- dedicated reusable triangular facet/crystal mesh renderer with crack overlays
- real reusable facet lighting/edge-glow/bloom/fracture compositor passes beyond declared style metadata
- manual demo visual validation and Pi 5 FPS pass

---

# 13. Remaining Simulation Tracking Sections

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

# 14. Cellular Ocean
## Status

```txt
STATUS: IN_PROGRESS
OWNER: NeoCloud
LAST_UPDATED: 2026-05-26
```

---

## Priority

FOUNDATIONAL

Reason:
- validates soft membrane/cell behavior on top of the shared spring system
- provides a biological ocean simulation between Amoeba Lamp and Jelly Web complexity
- exercises live structural rebuilds for membrane/cell budgets and live setters for fluid tuning

---

## Dependencies

- spring membranes
- scalar field renderer
- particle renderer
- palette/bloom pass metadata

---

## Core Requirements

Implemented:
- deterministic bounded membrane cells built from `SpringSystem`
- low-resolution cellular density field projection
- cell drift, repulsion, membrane tension, viscosity, and pressure pulses
- live settings polling for resolution, cell count, membrane points, membrane tension, viscosity, pulse strength, and drift strength
- stagnation recovery that injects a fresh osmotic pulse

---

## Required Render Layers

```txt
field
particles
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
distortion
```

---

## Required Styles

### Lagoon Cells
Aqua membranes drifting through a dark tidal microscope field.

### Coral Mitosis
Warm coral and violet membranes pulsing like reef plankton under UV light.

### Abyssal Nuclei
Deep indigo cells with ghostly green nuclei and soft phosphor edges.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | send an osmotic pulse through nearby membranes |
| drag | shear cells into a flowing membrane current |
| hold | invert pressure and pull membranes inward |
| fast swipe | shock the ocean and scatter cells into a new pattern |

---

## Director Mode Events

- cell bloom
- tide shear
- osmotic shock

---

## Stagnation Recovery

If:
- membrane velocity collapses
- cellular density field becomes too uniform

Then:
- inject a strong seeded osmotic pulse
- reset stagnation timer

---

## Performance Targets

```txt
cells:
  4-18 first-playable budget

membrane points:
  8-24 per cell

density field:
  32x18 to 128x72 typical, capped at 256 setting max
```

---

## Agent Implementation Guidance

IMPORTANT:
- first playable uses shared `SimulationCanvasLayer.renderField()` and `renderParticles()` rather than custom membrane meshes
- updates remain bounded by cells, membrane points, and scalar field resolution
- structural setting changes rebuild the deterministic model; numeric tuning changes mutate model options live

Do NOT:
- create one Pixi object per membrane segment
- add custom membrane shaders before a reusable membrane renderer exists
- allow unbounded cell division/growth

---

## Validation Checklist

- [x] membrane cells initialize deterministically from seed
- [x] update advances membrane/cell state
- [x] tap/drag/hold/swipe gestures alter membrane dynamics
- [x] density field and membrane budgets remain bounded
- [x] stagnation detection and recovery covered by model tests
- [x] styles clearly distinct in style manifests
- [ ] stable FPS on Pi target
- [x] model tests pass in current environment

---

## Known Risks

- first-playable render uses scalar density fields and particle points rather than true filled membrane meshes
- advanced membrane lighting, normals, and cell interiors are represented through shared field rendering and style metadata until reusable membrane rendering lands
- visual balance may need tuning after manual gallery/Pi validation

---

## Notes

Implemented files:
- `packages/simulations/src/cellular-ocean/CellularOceanModel.ts`
- `packages/simulations/src/cellular-ocean/CellularOceanScene.ts`
- `packages/simulations/src/cellular-ocean/CellularOceanPreviewScene.ts`
- `packages/simulations/src/cellular-ocean/CellularOceanDemoAI.ts`
- `packages/simulations/src/cellular-ocean/cellular-ocean.config.ts`
- `packages/simulations/src/cellular-ocean/cellular-ocean.definition.ts`
- `packages/simulations/src/cellular-ocean/styles/*.ts`
- `packages/simulations/src/cellular-ocean/__tests__/CellularOceanModel.test.ts`

Implementation notes:
- Uses shared `SpringSystem` membrane loops, a bounded `ScalarField` for cellular density, and shared particle rendering for membrane nodes.
- Demo AI cycles styles plus every numeric setting so the settings panel and live scene polling are exercised.
- Preview scene uses reduced resolution, cell count, and membrane point budgets.

Deferred before marking COMPLETE:
- dedicated reusable membrane mesh/fake-normal renderer for filled soft cells
- manual demo visual validation and Pi 5 FPS pass

---

# 15. Cosmic Ink Ocean
## Status

```txt
STATUS: IN_PROGRESS
OWNER: NeoCloud
LAST_UPDATED: 2026-05-26
```

---

## Priority

FOUNDATIONAL

Reason:
- validates vector-field-driven motion with shared scalar-field rendering
- provides a turbulence showcase without introducing one-off renderers
- exercises live numeric settings across particle budgets, resolution, diffusion, and flow controls

---

## Dependencies

- vector fields
- scalar field renderer
- particle renderer
- palette/bloom/distortion pass metadata

---

## Core Requirements

Implemented:
- deterministic bounded ink particles advected by a reusable `VectorField`
- low-resolution scalar ink deposition through `ScalarField`
- tap/hold vortices, drag/shear currents, and fast-swipe current cuts
- live settings polling for resolution, particle count, turbulence, flow speed, ink diffusion, and vortex strength
- stagnation recovery that injects a seeded vortex and velocity/ink energy

---

## Required Render Layers

```txt
field
particles
glow
debug
```

---

## Required Shader Features

```txt
paletteMap
edgeGlow
bloom
trailFeedback
contourBands
chromaticAberration
distortion
```

---

## Required Styles

### Nebula Ink
Violet and cyan dye plumes over a dark interstellar bath.

### Golden Tide
Amber turbulence and pearl foam flowing through black ink.

### Deep Current
Cold green currents drifting below an abyssal blue surface.

---

## Shared Gestures

| Gesture | Action |
|---|---|
| tap | seed a clockwise ink vortex |
| hold | seed a reverse pull vortex |
| drag | shear particles into a flowing current |
| fast swipe | cut a bright current through the ocean |

---

## Director Mode Events

- vortex bloom
- current shear
- reverse tide

---

## Stagnation Recovery

If:
- particle motion collapses
- ink field variance becomes too uniform
- vector energy falls below visible turbulence

Then:
- inject a seeded central vortex
- kick particles with deterministic velocity and dye energy
- reset stagnation timer

---

## Performance Targets

```txt
particles:
  128-1200 configurable, 180 preview budget

field:
  32x18 to 160x90 typical, capped by shared resolution setting

rendering:
  basic uses field layer only; enhanced adds shared particle points
```

---

## Agent Implementation Guidance

IMPORTANT:
- first playable uses shared `FieldPaletteRenderer` and `ParticlePointRenderer`
- vector advection remains model-side and deterministic through `SeededRng`
- structural setting changes rebuild the deterministic model; tuning changes mutate model options live

Do NOT:
- create a custom fluid shader before reusable vector-field compositing exists
- create one Pixi object per particle or field cell
- allow unbounded vortex accumulation

---

## Validation Checklist

- [x] ink particles initialize deterministically from seed
- [x] update advances particle state and deposits bounded ink
- [x] tap/drag/hold/swipe gestures alter flow state
- [x] vector/ink fields and vortex budgets remain bounded
- [x] stagnation detection and recovery covered by model tests
- [x] styles clearly distinct in style manifests
- [ ] stable FPS on Pi target
- [ ] full automated gate passes in current environment

---

## Known Risks

- first-playable render visualizes vector turbulence through scalar ink deposition rather than a dedicated vector-field shader
- advanced flow-line/normal-map distortion is represented through shared field rendering and style metadata until reusable compositor support lands
- visual balance may need tuning after manual gallery/Pi validation

---

## Notes

Implemented files:
- `packages/simulations/src/cosmic-ink-ocean/CosmicInkOceanModel.ts`
- `packages/simulations/src/cosmic-ink-ocean/CosmicInkOceanScene.ts`
- `packages/simulations/src/cosmic-ink-ocean/CosmicInkOceanPreviewScene.ts`
- `packages/simulations/src/cosmic-ink-ocean/CosmicInkOceanDemoAI.ts`
- `packages/simulations/src/cosmic-ink-ocean/cosmic-ink-ocean.config.ts`
- `packages/simulations/src/cosmic-ink-ocean/cosmic-ink-ocean.definition.ts`
- `packages/simulations/src/cosmic-ink-ocean/styles/*.ts`
- `packages/simulations/src/cosmic-ink-ocean/__tests__/CosmicInkOceanModel.test.ts`

Implementation notes:
- Uses shared `VectorField` for flow, bounded `ScalarField` for ink density, and shared particle rendering for enhanced quality.
- Demo AI cycles styles plus every numeric setting so the settings panel and live scene polling are exercised.
- Preview scene uses reduced resolution and particle budgets.

Deferred before marking COMPLETE:
- reusable vector-field/flow-line compositor or normal-map fluid distortion pass
- manual demo visual validation and Pi 5 FPS pass

---

# 16. Agent Update Rules

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

# 17. Recommended Git Workflow

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

# 18. Final Guidance for Agents

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
