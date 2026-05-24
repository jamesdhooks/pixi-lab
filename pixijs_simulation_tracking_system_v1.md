# PixiJS Simulation Implementation Tracking System v1

This document is a companion to the main master architecture/specification document.

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
| RenderTargetPool | NOT_STARTED | |
| RenderStyleManager | NOT_STARTED | |
| Shared Palette Shader | NOT_STARTED | |
| Trail Feedback System | NOT_STARTED | |
| Bloom Composite | NOT_STARTED | |
| PerformanceGovernor | NOT_STARTED | |
| DirectorMode | NOT_STARTED | |
| Gesture Interpreter | NOT_STARTED | |
| ProceduralTextureLibrary | NOT_STARTED | |
| Debug Overlay | NOT_STARTED | |
| Style Export System | NOT_STARTED | |
| Shader Uniform Tuning UI | NOT_STARTED | |

Status values:
- NOT_STARTED
- IN_PROGRESS
- BLOCKED
- COMPLETE
- NEEDS_REFACTOR
- PERFORMANCE_ISSUES

---

# 3. Simulation Implementation Queue

Implement simulations in roughly this order unless dependencies require otherwise.

| Priority | Simulation | Status | Depends On | Notes |
|---|---|---|---|---|
| 1 | Harmonic Sand Plate | NOT_STARTED | palette + particles | easiest high-payoff |
| 2 | Mycelium Prism | NOT_STARTED | triangle grid | foundational grid sim |
| 3 | Amoeba Lamp | NOT_STARTED | density metaballs | foundational blob renderer |
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
STATUS: NOT_STARTED
OWNER:
LAST_UPDATED:
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

- [ ] particles organize into visible nodal lines
- [ ] frequency changes reorganize patterns smoothly
- [ ] no flickering at low frequencies
- [ ] stable FPS on Pi target
- [ ] style presets visibly distinct
- [ ] director mode remains subtle

---

## Known Risks

- visual noise from excessive contour bands
- too much bloom obscuring patterns
- particle overcrowding near nodes

---

## Notes

Implementation notes go here.

---

# 7. Mycelium Prism

## Status

```txt
STATUS: NOT_STARTED
OWNER:
LAST_UPDATED:
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

- [ ] growth appears organic
- [ ] active fronts visually readable
- [ ] decay visible
- [ ] styles visually distinct
- [ ] stable FPS
- [ ] no memory growth over time

---

## Known Risks

- visually muddy overgrowth
- all strains merging into one color
- frontier update bugs

---

## Notes

Implementation notes go here.

---

# 8. Amoeba Lamp / Metaball Biosoup

## Status

```txt
STATUS: NOT_STARTED
OWNER:
LAST_UPDATED:
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

- [ ] blobs merge smoothly
- [ ] membrane edges visually readable
- [ ] styles clearly distinct
- [ ] touch interaction satisfying
- [ ] stable FPS
- [ ] no density artifacts

---

## Known Risks

- excessive blur causing mushy visuals
- aliasing around threshold edges
- unstable blob clustering

---

## Notes

Implementation notes go here.

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
