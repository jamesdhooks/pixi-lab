
# PixiJS Psychedelic Simulation Master Plan v7

## Table of Contents

1. Vision and Project Goals
2. Core Technical Philosophy
3. Shared Engine Architecture
4. Rendering and Style System
5. Performance, Quality, and GPU Management
6. Shared UX Systems
7. Ambient Experience System
8. Reusable FX / Burst Emitter System
9. Simulation Definition Template
10. Simulation Catalog
11. Shared Shader Technique Library
12. Shared Engine Primitive Systems
13. Procedural Texture Library
14. PixiJS Rendering Rules
14. Development and Debugging Tooling
15. Build Order and Implementation Milestones
16. Definition of Done
17. Final Recommendations


---

# 1. Vision and Project Goals

This project is a gallery/framework of highly interactive psychedelic simulations built using:

- PixiJS v8
- WebGL
- Raspberry Pi 5 class hardware
- custom shaders
- particles
- triangular grids
- low-resolution scalar/vector fields
- emergent behavior systems

The simulations are not intended to be scientifically accurate.

The goal is:

> Lightweight simulation data transformed through sophisticated rendering and interaction into visually rich, reactive, ambient experiences.

Key principles:

- beautiful over realistic
- emergent over scripted
- low-resolution simulation + high-quality shading
- reusable engine primitives
- shared rendering architecture
- style-driven visual variety
- graceful performance degradation
- touch-first interaction

This document is intended as:
- a technical design document
- a rendering architecture specification
- a simulation catalog
- an implementation handoff guide
- a shader/style framework reference

---

# 2. Core Technical Philosophy

## 2.1 The Big Rule

```txt
simulate cheap
render batched
shade smart
composite low-res
```

Avoid:
- realistic fluid simulation
- expensive rigid-body systems
- excessive draw calls
- per-object filters
- thousands of Pixi display objects

Prefer:
- particles
- grids
- scalar fields
- vector fields
- trails
- render textures
- shader compositing
- low-resolution simulation buffers

---

## 2.2 Rendering Hierarchy

The architecture separates:

```txt
simulation logic
-> render layers
-> style passes
-> final composite
```

Simulation state should never hardcode the final visual appearance.

Example:

```txt
Amoeba simulation:
  density + heat + charge

Basic style:
  soft blobs

Enhanced style:
  glowing membranes

Ultra style:
  oil-slick interiors
  chromatic edges
  electric arcs
```

---

## 2.3 Shared Simulation Requirements

Every simulation should support:

- Basic quality mode
- Enhanced quality mode
- style presets
- shared gestures
- director mode
- stagnation recovery
- debug rendering
- performance governor integration
- seeded reproducibility
- fallback rendering path


---

# 3. Shared Engine Architecture

## 3.1 High-Level Architecture

```txt
SimulationScene
  SimulationCore
  SimulationRenderer
  RenderStyleManager
  RenderTargetPool
  PerformanceGovernor
  DirectorMode
  DebugOverlay
```

---

## 3.2 Simulation Interface

```ts
interface Simulation {
  init(ctx: SimulationContext): void;
  update(dt: number, input: InputState): void;
  render(renderer: SimulationRenderer): void;

  getRenderLayers(): SimRenderLayers;
  getStyleManifest(): SimStyleManifest;

  setStyle(styleId: string): void;
  setQuality(quality: RenderQuality): void;

  detectStagnation(): StagnationReport;
  stabilize(): void;
  softReset(): void;
}
```

---

## 3.3 Render Layers

```ts
type SimRenderLayers = {
  primitive?: RenderTexture;
  particles?: RenderTexture;
  density?: RenderTexture;
  trails?: RenderTexture;
  field?: RenderTexture;
  mask?: RenderTexture;
  glow?: RenderTexture;
  debug?: RenderTexture;
};
```

---

## 3.4 Shared Engine Primitive Systems

The engine is built around reusable primitive systems.

### Particle Systems

Used for:
- debris
- spores
- dust
- flocks
- sparks
- nutrients

### Triangular Grids

Used for:
- fungus growth
- crystal lattices
- stained glass
- reaction systems

### Scalar Fields

Used for:
- heat
- charge
- moisture
- pressure
- wave amplitude
- stress

### Vector Fields

Used for:
- flow
- wind
- current
- turbulence
- magnetic direction

### Spring Systems

Used for:
- jelly webs
- membranes
- soft cells

### Trail Fields

Used for:
- pheromones
- echoes
- orbital dust
- plasma scars

### Density Fields

Used for:
- metaballs
- blobs
- membranes
- liquid-like surfaces


---

# 4. Rendering and Style System

## 4.1 Shared Style Philosophy

Each simulation:
- exposes render layers
- declares capabilities
- exposes style presets
- defines supported shader passes

Styles should mostly differ through:
- palettes
- enabled passes
- uniform presets
- glow/distortion settings
- compositing

NOT through completely separate rendering engines.

---

## 4.2 Quality Modes

### Basic

```txt
direct rendering
minimal post processing
Pi-safe fallback
```

### Enhanced

```txt
palette mapping
trails
edge glow
low-res bloom
simple distortion
```

### Ultra

```txt
chromatic aberration
fake normals
contour bands
extra composites
higher resolution fields
```

---

## 4.3 Style Manifest

```ts
type SimStyleManifest = {
  defaultStyleId: string;
  capabilities: SimRenderCapabilities;
  styles: SimStyle[];
};
```

---

## 4.4 Render Pass Types

```txt
primitive
paletteMap
densityMetaball
edgeGlow
trailFeedback
fieldVisualize
bloom
distortion
chromaticAberration
normalLighting
contourBands
shockwave
colorGrade
composite
```

---

## 4.5 Shared Shader Techniques

### Palette Mapping

Maps scalar values into color palettes.

### Edge Glow

Highlights density/material boundaries.

### Metaball Thresholding

Turns soft particle density into continuous blobs.

### Trail Feedback

Persistent fading render textures.

### Flow Distortion

Noise/vector-field-based UV distortion.

### Bloom Composite

Low-resolution bright-pass glow.

### Chromatic Aberration

RGB offset near energetic edges.

### Fake Normal Lighting

Fake dimensional lighting from scalar fields.

### Shockwaves

Screen-space ripple distortion.

### Contour Bands

Repeating density/wave rings.


---

# 5. Performance, Quality, and GPU Management

## 5.1 RenderTargetPool

All render textures must be centrally managed.

### Persistent Targets

Examples:
- trails
- pheromone fields
- history buffers

### Transient Targets

Examples:
- blur passes
- intermediate composites
- temporary masks

---

## 5.2 Ping-Pong Buffers

Used for:
- trails
- wave propagation
- reaction diffusion
- feedback systems

---

## 5.3 Performance Governor

Automatically adjusts quality based on FPS.

Downgrade order:

```txt
disable chromatic
reduce bloom
reduce field resolution
reduce particle count
reduce simulation rate
disable contour bands
downgrade quality mode
```

---

## 5.4 Pi 5 Rendering Rules

Avoid:
- native-resolution blur
- many texture samples
- filters on individual objects
- expensive procedural noise loops

Prefer:
- low-resolution fields
- shared filters
- palette textures
- combined shader passes
- render texture compositing


---

# 6. Shared UX Systems

## 6.1 Shared Gesture Vocabulary

| Gesture | Meaning |
|---|---|
| tap | seed / pulse |
| drag | stir / push |
| hold | intensify |
| fast swipe | rupture / shockwave |
| double tap | invert / flip |
| pinch | compress |
| spread | repel / explode |

---

## 6.2 Director Mode

Director mode keeps ambient displays alive.

Examples:
- spawn spores
- split blobs
- shift frequency
- trigger meteor showers
- inject charge
- softly rotate palettes

---

## 6.3 Stagnation Recovery

Every sim must recover from:
- over-saturation
- collapse
- uniformity
- dead states
- visual mud

Examples:
- split merged blobs
- seed new fungus
- increase pheromone decay
- inject energy
- soft reset


---

# 7. Ambient Experience System

Ambient experiences are first-class `LabExperience` entries with `kind: "ambient"`.

They are passive or lightly interactive living visual layers used for:
- dashboard backgrounds
- foreground overlays
- seasonal effects
- weather-reactive ambience
- home/status-reactive visual states
- widgets and preview tiles

Ambient experiences must extend the existing game/simulation architecture rather than becoming unrelated React components.

## 7.1 Experience Kinds

The lab supports four content categories:

```ts
type LabExperienceKind =
  | "game"
  | "simulation"
  | "ambient"
  | "effect";
```

Definitions:
- game: a goal-driven interactive experience
- simulation: an interactive emergent system
- ambient: a passive or lightly interactive living visual layer
- effect: a short-lived reusable visual event

## 7.2 Render Modes

Every lab experience can declare supported render modes:

```ts
type ExperienceRenderMode =
  | "fullscreen"
  | "background"
  | "foregroundOverlay"
  | "widget"
  | "previewTile";
```

Rules:
- fullscreen owns the screen
- background renders behind UI and must preserve readability
- foregroundOverlay renders above UI and defaults to `pointer-events: none`
- widget is a low-cost embedded canvas
- previewTile is the cheapest deterministic gallery rendering path

## 7.3 Ambient Contract

```ts
type AmbientExperience = LabExperienceBase & {
  kind: "ambient";
  renderModes: ExperienceRenderMode[];
  dataBindings: AmbientDataBinding[];
  behavior: AmbientBehaviorConfig;
  styles: AmbientStyle[];
};
```

Ambient data sources:

```ts
type AmbientDataSource =
  | "time"
  | "weather"
  | "calendar"
  | "homeAssistant"
  | "media"
  | "photos"
  | "tasks"
  | "presence"
  | "synthetic";
```

Ambients should support real data, but must not require it. The demo app uses synthetic adapters; host apps may inject real adapters.

## 7.4 Ambient Behavior Requirements

Every ambient declares:
- idle safety
- low-motion support
- sleep-mode support
- transparency support
- maximum brightness
- maximum particle count
- maximum update Hz
- background/foreground permission

Background ambients must preserve UI readability, support opacity/dimming, avoid flashing, and degrade gracefully.

Foreground overlays must default to `pointer-events: none`, stay subtle, avoid obscuring important UI, avoid heavy shaders, and respect sleep/quiet mode.

Sleep mode reduces brightness, saturation, motion, particle count, and disables fireworks/confetti or harsh flashes.

## 7.5 Ambient Experience Catalog

Deferred content queue:
- Day Rhythm Field
- Home Weather Glass
- Sleep Aquarium
- Music Dream Field
- House Pulse Map
- Task Garden
- Family Orbit
- Memory Drift

These ambient implementations are deferred until the supporting engine, React layer, synthetic data adapters, and emitter systems are complete.

---

# 8. Reusable FX / Burst Emitter System

Short-lived effects are reusable across games, simulations, ambients, and UI events. They must not be implemented separately per experience.

## 8.1 Burst Effect Definition

```ts
type BurstEffectKind =
  | "spark"
  | "firework"
  | "ember"
  | "confetti"
  | "plasma"
  | "ash"
  | "smoke"
  | "firefly"
  | "arcSpark";

type BurstEffect = {
  id?: string;
  kind: BurstEffectKind;
  x: number;
  y: number;
  count: number;
  energy: number;
  duration?: number;
  paletteId?: string;
  seed?: number;
  mode?: "foreground" | "background" | "simulationLayer";
  options?: Record<string, number | string | boolean>;
};
```

## 8.2 BurstEmitterSystem

```ts
class BurstEmitterSystem {
  emit(effect: BurstEffect): void;
  update(dt: number): void;
  clear(): void;
  setQuality(quality: RenderQuality): void;
  setSleepMode(enabled: boolean): void;
  setGlobalIntensity(value: number): void;
}
```

Every emitter supports:
- seeded randomness
- quality scaling
- max particle cap
- sleep mode reduction
- pause/resume
- automatic cleanup
- foreground/background/simulation layer mode

## 8.3 Required Emitters

Initial engine support must include reusable emitters for:
- SparkEmitter
- FireworkEmitter
- EmberEmitter
- ConfettiEmitter
- FireflyEmitter
- SmokeEmitter
- ArcSparkEmitter

Fireworks and confetti are disabled or heavily reduced in sleep mode and low-motion foreground overlays.

## 8.4 Event Integration

Common app/game/simulation events should route through `BurstEmitterSystem`:
- task completed -> confetti/sparkle
- birthday -> fireworks/confetti
- voice assistant wake -> ring ripple
- game collision -> spark burst
- game win -> firework/confetti
- simulation rupture/fracture/discharge -> smoke, sparks, arc sparks

---

# 9. Simulation Definition Template

Every simulation definition follows the same structure.

## Simulation Name

### Concept

Short high-level idea.

### Core Physics / Behaviors

List:
- growth
- flocking
- resonance
- charge
- etc.

### Primary Data Structures

What simulation primitives it uses.

### Rendering Architecture

Which render layers it exposes.

### Supported Shader Features

Which shared shader passes it supports.

### Style Presets

Named styles with visual direction.

### Shared Gestures

How gestures map to simulation behavior.

### Director Mode Events

Ambient behaviors while idle.

### Performance Notes

Pi-safe considerations and scaling strategy.

### Feasibility

Overall implementation complexity.


---
# 10. Simulation Catalog

---

## Mycelium Prism

### Concept

Triangular-grid fungal growth with spreading veins and competing strains.

### Core Physics / Behaviors

- growth fronts
- decay
- nutrient spread
- vein pulses

### Primary Data Structures

- triangular grid
- nutrient field
- active frontier

### Rendering Architecture

- grid mesh
- optional pulse trail layer

### Supported Shader Features

- palette map
- edge glow
- bloom
- contour bands

### Style Presets

- Neon Mold
- Rot Bloom
- Synaptic Fungus

### Shared Gestures

- tap seeds spores
- drag smears nutrients
- hold adds moisture

### Director Mode Events

- seed new colonies
- pulse active veins

### Performance Notes

- low-res grid
- frontier-only updates

### Feasibility

Very High

---

## Orbital Shrapnel Field

### Concept

Thousands of triangular debris particles orbiting a planet.

### Core Physics / Behaviors

- orbital motion
- gravity approximation
- collisions
- dust trails

### Primary Data Structures

- particles
- velocity
- trail field

### Rendering Architecture

- custom triangle mesh
- trail buffer

### Supported Shader Features

- trail feedback
- bloom
- shockwaves
- chromatic edges

### Style Presets

- Ice Ring
- Solar Debris
- Black Hole Lens

### Shared Gestures

- drag swishes debris
- hold creates gravity well

### Director Mode Events

- meteor showers
- gravity pulses

### Performance Notes

- custom mesh required
- avoid all-pairs gravity

### Feasibility

High

---

## Amoeba Lamp / Metaball Biosoup

### Concept

Glowing blob-like lava-lamp organisms formed from particle density fields.

### Core Physics / Behaviors

- surface tension
- buoyancy
- blob merging/splitting

### Primary Data Structures

- blob particles
- density field
- heat field

### Rendering Architecture

- metaball density pass
- membrane composite

### Supported Shader Features

- metaballs
- edge glow
- fake normals
- distortion

### Style Presets

- Bio Plasma
- Oil Slick
- Toxic Lagoon

### Shared Gestures

- drag stirs blobs
- hold heats blobs
- swipe splits

### Director Mode Events

- split oversized blobs
- inject heat plumes

### Performance Notes

- shader-heavy
- low-res density fields required

### Feasibility

High

---

## Electro-Osmotic Amoeba

### Concept

Charged amoeba blobs exchanging energy through membranes.

### Core Physics / Behaviors

- surface tension
- charge
- attraction/repulsion

### Primary Data Structures

- density field
- charge field
- nuclei

### Rendering Architecture

- density + arc overlay

### Supported Shader Features

- metaballs
- edge corona
- bloom
- arcs

### Style Presets

- Electric Cell
- Ion Lagoon
- Plasma Membrane

### Shared Gestures

- hold injects charge
- swipe discharges

### Director Mode Events

- polarity shifts
- ambient arc pulses

### Performance Notes

- cap arc counts carefully

### Feasibility

High

---

## Harmonic Sand Plate

### Concept

Particles organizing into resonance patterns.

### Core Physics / Behaviors

- standing waves
- resonance
- nodal attraction

### Primary Data Structures

- particles
- wave field

### Rendering Architecture

- particle layer
- wave visualization layer

### Supported Shader Features

- contour bands
- palette map
- bloom

### Style Presets

- Chladni Gold
- Laser Plate
- Ghost Frequency

### Shared Gestures

- drag moves emitters
- hold amplifies

### Director Mode Events

- frequency sweeps

### Performance Notes

- very Pi-friendly

### Feasibility

Very High

---

## Plasma Branch Terrarium

### Concept

Branching lightning/plasma growth across a charged field.

### Core Physics / Behaviors

- ionization
- branching discharge
- charge propagation

### Primary Data Structures

- charge grid
- arc mesh
- scar trail

### Rendering Architecture

- line mesh + glow composite

### Supported Shader Features

- bloom
- edge glow
- scars

### Style Presets

- Lightning Garden
- Neon Circuit
- Blood Plasma

### Shared Gestures

- tap injects charge
- swipe discharges

### Director Mode Events

- ambient charge build-up

### Performance Notes

- use frontier propagation only

### Feasibility

High

---

## Jelly Web Resonator

### Concept

Elastic glowing spring-web structures.

### Core Physics / Behaviors

- springs
- resonance
- stress propagation

### Primary Data Structures

- spring nodes
- line mesh

### Rendering Architecture

- line renderer
- pulse overlays

### Supported Shader Features

- glow
- stress palette
- trails

### Style Presets

- Spiderglass
- Bass Web
- Torn Neon

### Shared Gestures

- drag pulls web
- swipe tears

### Director Mode Events

- ambient pulses

### Performance Notes

- keep node counts modest

### Feasibility

Medium-High

---

## Cellular Ocean

### Concept

Soft translucent cells absorbing nutrients and dividing.

### Core Physics / Behaviors

- osmosis
- membrane pressure
- mitosis

### Primary Data Structures

- spring-ring cells
- nutrient particles

### Rendering Architecture

- membrane shading
- nuclei overlay

### Supported Shader Features

- fake normals
- contours
- bloom

### Style Presets

- Microbe Sea
- Glass Cells
- Toxic Tissue

### Shared Gestures

- tap nutrients
- swipe ruptures

### Director Mode Events

- nutrient blooms

### Performance Notes

- avoid true fluid simulation

### Feasibility

Medium

---

## Crystal Plasma Storm

### Concept

Electric crystal growth and fracture system.

### Core Physics / Behaviors

- crystallization
- charge buildup
- fracture

### Primary Data Structures

- triangular grid
- stress field

### Rendering Architecture

- crystal mesh
- discharge overlays

### Supported Shader Features

- facet lighting
- cracks
- bloom

### Style Presets

- Ice Lightning
- Ruby Fault
- Aurora Quartz

### Shared Gestures

- tap seeds crystals
- hold charges

### Director Mode Events

- random fractures

### Performance Notes

- excellent grid candidate

### Feasibility

Very High

---

## Cosmic Ink Ocean

### Concept

Flowing psychedelic turbulence and dye currents.

### Core Physics / Behaviors

- turbulence
- vortices
- dye advection

### Primary Data Structures

- particles
- vector field
- trails

### Rendering Architecture

- trail feedback composite

### Supported Shader Features

- distortion
- bloom
- palette map

### Style Presets

- Cosmic Smoke
- Velvet Ink
- Superfluid Neon

### Shared Gestures

- drag stirs flow
- hold creates vortex

### Director Mode Events

- ambient current drift

### Performance Notes

- fake fluid only

### Feasibility

High

---

## Proto-Galaxy Forge

### Concept

Galaxy formation with approximate gravity.

### Core Physics / Behaviors

- orbital capture
- accretion
- collapse

### Primary Data Structures

- particles
- gravity wells

### Rendering Architecture

- particle mesh + trails

### Supported Shader Features

- bloom
- lens distortion
- trails

### Style Presets

- Spiral Forge
- Black Hole
- Star Nursery

### Shared Gestures

- hold black hole
- swipe supernova

### Director Mode Events

- spawn new stars

### Performance Notes

- avoid all-pairs gravity

### Feasibility

Medium

---

## Ant Signal Civilization

### Concept

Swarm intelligence using pheromone trails.

### Core Physics / Behaviors

- stigmergy
- trail reinforcement
- distributed routing

### Primary Data Structures

- agents
- pheromone field

### Rendering Architecture

- trail field composite

### Supported Shader Features

- bloom
- trail feedback

### Style Presets

- Neon Colony
- Circuit Ants
- Fungal Roads

### Shared Gestures

- tap food source
- swipe wipe trails

### Director Mode Events

- shifting resource nodes

### Performance Notes

- very high emergence per CPU

### Feasibility

Very High

---

## Time Echo Particles

### Concept

Particles interacting with delayed ghost versions of themselves.

### Core Physics / Behaviors

- temporal echoes
- history attraction

### Primary Data Structures

- particles
- history buffers

### Rendering Architecture

- echo trail composites

### Supported Shader Features

- chromatic aberration
- shockwaves

### Style Presets

- Ghost Loop
- Time Glass
- Phase Storm

### Shared Gestures

- tap time anchor
- hold freeze

### Director Mode Events

- temporal pulses

### Performance Notes

- quality tied to history length

### Feasibility

High

---

## Turing Skin

### Concept

Reaction-diffusion biological skin patterns.

### Core Physics / Behaviors

- reaction diffusion
- morphogenesis

### Primary Data Structures

- low-res chemical fields

### Rendering Architecture

- scalar field visualization

### Supported Shader Features

- contour bands
- palette mapping

### Style Presets

- Leopard Skin
- Coral Vein
- Alien Tissue

### Shared Gestures

- drag smears chemicals

### Director Mode Events

- parameter drift

### Performance Notes

- low-res only

### Feasibility

High

---

## Prism Pool

### Concept

Caustic/refraction shader playground.

### Core Physics / Behaviors

- refraction
- ripples
- caustics

### Primary Data Structures

- density/height field

### Rendering Architecture

- refractive composite

### Supported Shader Features

- fake normals
- chromatic split

### Style Presets

- Glass Ocean
- Neon Prism
- Oil Lens

### Shared Gestures

- drag ripples water

### Director Mode Events

- light sweeps

### Performance Notes

- shader-focused sim

### Feasibility

High

---

## Neon River Delta

### Concept

Terrain erosion and sediment transport.

### Core Physics / Behaviors

- erosion
- sediment deposition
- downhill flow

### Primary Data Structures

- height field
- sediment field

### Rendering Architecture

- terrain composite

### Supported Shader Features

- contour bands
- bloom rivers

### Style Presets

- Toxic Delta
- Lava Flood
- Neon Canyon

### Shared Gestures

- drag carves channels

### Director Mode Events

- rainfall pulses

### Performance Notes

- simplified erosion only

### Feasibility

Medium-High

---

## Oil-Water Universe

### Concept

Immiscible domains separating and merging.

### Core Physics / Behaviors

- phase separation
- boundary tension

### Primary Data Structures

- material grid
- concentration field

### Rendering Architecture

- domain composite

### Supported Shader Features

- edge glow
- metaball boundaries

### Style Presets

- Oil Slick
- Bio Foam
- Cosmic Cells

### Shared Gestures

- drag stirs materials

### Director Mode Events

- cooling/reheating cycles

### Performance Notes

- strong visual payoff

### Feasibility

High

---

## Living Voronoi Tissue

### Concept

Voronoi-based living territory simulation.

### Core Physics / Behaviors

- territorial competition
- cell division

### Primary Data Structures

- Voronoi seeds
- pressure field

### Rendering Architecture

- Voronoi visualization

### Supported Shader Features

- membrane glow
- contour shading

### Style Presets

- Living Tissue
- Neon Hive
- Crystal Cells

### Shared Gestures

- tap seeds new cells

### Director Mode Events

- pressure pulses

### Performance Notes

- keep site counts low

### Feasibility

Medium

---

## Alien Vascular Tree

### Concept

Procedural vascular branching network growth.

### Core Physics / Behaviors

- branching
- nutrient flow
- pruning

### Primary Data Structures

- branch graph
- nutrient field

### Rendering Architecture

- line mesh rendering

### Supported Shader Features

- pulse glow
- thickness shading

### Style Presets

- Neon Roots
- Coral Veins
- Gold Arbor

### Shared Gestures

- drag light source

### Director Mode Events

- growth spurts

### Performance Notes

- cap branch counts

### Feasibility

High

---

## Chromatic Avalanche Bowl

### Concept

Granular glowing avalanche simulation.

### Core Physics / Behaviors

- granular flow
- avalanches
- compaction

### Primary Data Structures

- particles
- density buckets

### Rendering Architecture

- particle + dust composite

### Supported Shader Features

- glow ridges
- dust bloom

### Style Presets

- Neon Sand
- Toxic Gravel
- Plasma Ash

### Shared Gestures

- drag tilts bowl

### Director Mode Events

- vibration pulses

### Performance Notes

- fake granular flow

### Feasibility

Medium-High


---

# 11. Shared Shader Technique Library

## Palette Mapping
Maps scalar values into reusable palettes.

## Edge Glow
Highlights density/material boundaries.

## Metaball Thresholding
Turns density into continuous blobs.

## Trail Feedback
Persistent fading render textures.

## Flow Distortion
Noise/vector-field UV distortion.

## Bloom Composite
Low-resolution glow.

## Chromatic Aberration
RGB edge splitting.

## Fake Normal Lighting
Fake dimensional lighting from fields.

## Contour Bands
Repeating density/wave rings.

## Shockwaves
Screen-space ripple distortions.

---

# 12. Procedural Texture Library

Generate reusable textures at startup.

Includes:
- radial blobs
- sparks
- noise
- blue noise
- palette strips
- caustics
- grain
- scanlines

---

# 13. PixiJS Rendering Rules

## Use ParticleContainer For

- sparks
- spores
- nutrients
- bubbles
- dust

## Use Custom Mesh For

- triangles
- crystal grids
- debris
- fish/minnows
- spring lines

## Scene Partitioning

```txt
background
simulation primitives
trail/density layers
glow/composite
ui/debug
```

---

# 14. Development and Debugging Tooling

## Live Shader Tuning

Expose:
- glow strength
- thresholds
- distortion
- bloom
- palette speed
- field scale
- particle count

## Style Export

Export:
- simulation
- style
- seed
- uniforms
- quality

## Visual Regression

Capture:
- basic
- enhanced
- ultra
screenshots.

---

# 15. Build Order and Implementation Milestones

## Phase 1

- RenderTargetPool
- RenderStyleManager
- trail feedback
- bloom compositor
- procedural textures
- AmbientExperience / EffectExperience contracts
- AmbientDataManager with host-injected adapters and synthetic fallback data
- BurstEmitterSystem with shared GPU-batched particle layers
- AmbientLayer and ForegroundAmbientOverlay React wrappers
- reusable spark, firework, ember, confetti, firefly, smoke, and arc spark emitter facades

Ambient catalog implementations and foreground overlay content remain deferred until the engine support above is validated.

## Phase 2

- Amoeba Lamp
- Mycelium Prism
- Orbital Shrapnel
- Harmonic Sand

## Phase 3

- Plasma Branch
- Ant Signal
- Crystal Plasma
- Time Echo

## Phase 4

- Turing Skin
- Prism Pool
- River Delta
- Voronoi Tissue

---

# 16. Definition of Done

A simulation is complete when:

- supports Basic + Enhanced
- exposes style manifest
- supports shared gestures
- integrates performance governor
- supports director mode
- recovers from stagnation
- has debug rendering
- has seeded reproducibility
- uses shared render infrastructure
- has at least one polished style preset

---

# 17. Final Recommendations

The most important architectural principle is:

```txt
simple simulation
shared rendering primitives
style-driven variation
low-resolution compositing
performance-aware shaders
```

The strongest reusable systems are:

1. Palette + Edge Shader
2. Trail Feedback + Glow Composite
3. Metaball Density Shader

Once those exist, new simulations become mostly:
- new simulation logic
- new style presets
- new palette/uniform combinations

rather than entirely new rendering systems.
