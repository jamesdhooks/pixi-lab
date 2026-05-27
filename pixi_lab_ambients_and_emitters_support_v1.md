# Pixi Lab Support Document: Ambients, Foreground Overlays, and Burst Emitters v1

This is a companion document for the PixiJS Game / Simulation / Ambient Lab.

It is intended to be integrated later into:

1. the main master architecture document
2. the simulation tracking / progress document
3. the eventual implementation repository

This document adds a new first-class content category:

```txt
Ambient Experiences
```

And a new shared polish/effects system:

```txt
Reusable Burst / Emitter FX
```

These systems should not replace the existing game/simulation architecture. They extend it.

---

# 1. Purpose

The existing lab already covers:

- games
- simulations
- shader styles
- particles
- grids
- render targets
- performance scaling
- director mode
- gestures

This document adds the missing layer for:

- dashboard backgrounds
- foreground overlays
- seasonal effects
- UI celebration effects
- weather-reactive ambience
- home/status-reactive visual states
- firework/spark/confetti/ember systems
- reusable emitter effects shared by games, simulations, and ambients

The goal is to make the lab useful not only as a gallery of experiments, but also as a living visual layer for the family assistant app.

---

# 2. Integration Instructions for Local Agent

When integrating this document into the existing master plan:

## Add to Master Document

Add a new major section:

```txt
Ambient Experience System
```

Place it after the shared UX systems and before the simulation catalog.

Add another new major section:

```txt
Reusable FX / Burst Emitter System
```

Place it after the rendering/style system or after procedural texture library.

## Add to Tracking Document

Add top-level tracking rows for:

```txt
AmbientExperience contract
AmbientLayer React component
ForegroundAmbientOverlay React component
BurstEmitterSystem
SparkEmitter
FireworkEmitter
EmberEmitter
ConfettiEmitter
FireflyEmitter
SmokeEmitter
ArcSparkEmitter
```

Add ambient experiences to the implementation queue separately from simulations.

## Add to Code Architecture

Create these packages/modules:

```txt
src/ambient/
  AmbientExperience.ts
  AmbientRegistry.ts
  AmbientLayer.ts
  ForegroundAmbientOverlay.ts
  ambients/
    HomeWeatherGlass.ts
    DayRhythmField.ts
    FamilyOrbit.ts
    HousePulseMap.ts
    MusicDreamField.ts
    MemoryDrift.ts
    SleepAquarium.ts
    TaskGarden.ts

src/fx/
  BurstEmitterSystem.ts
  EffectEmitter.ts
  emitters/
    SparkEmitter.ts
    FireworkEmitter.ts
    EmberEmitter.ts
    ConfettiEmitter.ts
    FireflyEmitter.ts
    SmokeEmitter.ts
    ArcSparkEmitter.ts
```

## Do Not

- Do not build ambients as unrelated one-off React components.
- Do not duplicate particle rendering systems.
- Do not let foreground overlays block UI input by default.
- Do not make ambients depend on real Home Assistant/weather/calendar data for demo mode.
- Do not hardcode app-specific data sources into the Pixi lab package.

## Required Demo Behavior

The GitHub/demo version must run with synthetic data.

The family assistant integration may inject real data.

---

# 3. Content Categories

The lab should support four render/content modes:

```ts
type LabExperienceKind =
  | "game"
  | "simulation"
  | "ambient"
  | "effect";
```

## 3.1 Game

A goal-driven interactive experience.

Examples:
- racecar game
- physics golf
- maze ball
- catapult tower

## 3.2 Simulation

An interactive emergent system.

Examples:
- Amoeba Lamp
- Mycelium Prism
- Harmonic Sand Plate
- Orbital Shrapnel

## 3.3 Ambient

A passive or lightly interactive living visual layer.

Examples:
- weather-reactive glass
- calendar/day rhythm background
- family presence orbit
- sleep aquarium
- music dream field

## 3.4 Effect

A short-lived reusable visual event.

Examples:
- spark burst
- firework
- confetti
- ember drift
- fireflies
- smoke puff
- plasma arc

---

# 4. Render Modes

Every lab experience should declare which render modes it supports.

```ts
type ExperienceRenderMode =
  | "fullscreen"
  | "background"
  | "foregroundOverlay"
  | "widget"
  | "previewTile";
```

---

## 4.1 Fullscreen

The experience owns the screen.

Use for:
- games
- simulation gallery
- music visualizer
- dedicated interactive toy mode

Example:

```tsx
<FullscreenExperience id="amoeba-lamp" />
```

---

## 4.2 Background

The experience renders behind the UI.

Use for:
- family dashboard
- calendar page
- photo frame page
- weather page
- music page

Example:

```tsx
<AmbientLayer id="day-rhythm-field" opacity={0.35} />
<MainUI />
```

Requirements:
- low motion mode
- opacity control
- no harsh flashes
- optional blur/tint
- should not reduce UI readability

---

## 4.3 Foreground Overlay

The experience renders above the UI.

Use for:
- snow
- rain
- leaves
- sparks
- confetti
- fireflies
- celebratory effects
- status bursts
- weather overlays

Example:

```tsx
<ForegroundAmbientOverlay id="snowfall" intensity={0.35} />
```

CSS:

```css
.pixi-foreground-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
}
```

Pixi app setup:

```ts
await app.init({
  resizeTo: window,
  backgroundAlpha: 0,
  antialias: true,
});
```

Important:
- default `pointer-events: none`
- should never block UI interaction
- should be visually subtle
- should be easy to disable

---

## 4.4 Widget

Small embedded live canvas.

Use for:
- dashboard cards
- preview tiles
- mini status cards
- interactive widgets

Example:

```tsx
<ExperienceTile id="orbital-shrapnel" mode="widget" />
```

Requirements:
- low particle count
- no expensive bloom by default
- low update rate option
- deterministic preview seed

---

## 4.5 Preview Tile

An even lighter widget used for galleries and selection screens.

Requirements:
- very low cost
- no heavy post-processing
- deterministic
- can pause when offscreen
- can render static thumbnail fallback

---

# 5. Ambient Experience Contract

```ts
type AmbientExperience = {
  id: string;
  kind: "ambient";
  title: string;
  description: string;

  createScene: () => LabScene;

  renderModes: ExperienceRenderMode[];

  dataBindings: AmbientDataBinding[];

  behavior: AmbientBehaviorConfig;

  styles: AmbientStyle[];

  preview: PreviewConfig;
};
```

---

## 5.1 Ambient Data Bindings

Ambients should support real data, but must not require it.

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

type AmbientDataBinding = {
  source: AmbientDataSource;
  optional: boolean;
  fallback: "synthetic" | "idle" | "disabled";
};
```

Example:

```ts
const HomeWeatherGlassBindings = [
  { source: "weather", optional: true, fallback: "synthetic" },
  { source: "time", optional: true, fallback: "synthetic" },
];
```

The demo app should use synthetic adapters.

The family assistant app should inject real adapters.

---

## 5.2 Ambient Behavior Config

```ts
type AmbientBehaviorConfig = {
  idleSafe: boolean;
  supportsLowMotion: boolean;
  supportsSleepMode: boolean;
  supportsTransparency: boolean;
  maxBrightness: number;
  maxParticleCount: number;
  maxUpdateHz: number;
  allowForeground: boolean;
  allowBackground: boolean;
};
```

Recommended defaults:

```ts
const DEFAULT_AMBIENT_BEHAVIOR = {
  idleSafe: true,
  supportsLowMotion: true,
  supportsSleepMode: true,
  supportsTransparency: true,
  maxBrightness: 0.65,
  maxParticleCount: 3000,
  maxUpdateHz: 30,
  allowForeground: false,
  allowBackground: true,
};
```

Foreground overlays should usually be lighter:

```ts
const DEFAULT_FOREGROUND_BEHAVIOR = {
  maxBrightness: 0.45,
  maxParticleCount: 1000,
  maxUpdateHz: 30,
  allowForeground: true,
  allowBackground: false,
};
```

---

# 6. Ambient Safety Rules

Ambients are allowed to be beautiful, but they must not fight the UI.

## 6.1 Background Ambient Rules

Background ambients should:

- preserve text readability
- avoid high-contrast motion behind dense UI
- support opacity
- support dimming
- support low motion
- support pause/resume
- degrade gracefully

Avoid:
- flashing
- constant high-speed particles
- saturated colors behind text
- strong contrast behind UI cards
- unbounded particle accumulation

---

## 6.2 Foreground Overlay Rules

Foreground overlays should:

- default to pointer-events none
- be subtle
- be event-driven or low-density
- not obscure important UI
- not run heavy shaders
- not use bright full-screen flashes without permission
- respect sleep/quiet mode

Foreground effects are accents, not the main visual system.

Rule of thumb:

```txt
background ambients = mood
foreground overlays = accents
fullscreen = experience
widgets = previews/status
```

---

## 6.3 Night / Sleep Mode

All ambients and foreground effects should support sleep mode.

Sleep mode should:

```txt
reduce brightness
reduce saturation
reduce motion
disable fireworks/confetti
disable harsh flashes
prefer slow particles
prefer warm/dim palettes
```

Example:

```ts
if (mode === "sleep") {
  intensity *= 0.35;
  bloom *= 0.25;
  particleCount *= 0.4;
  maxVelocity *= 0.5;
  allowBurstEffects = false;
}
```

---

# 7. Ambient Experience Catalog

## 7.1 Home Weather Glass

### Concept

A living glass/weather panel that reacts to weather and time of day.

### Data Inputs

```txt
weather
time
synthetic fallback
```

### Behaviors

```txt
sunny -> warm caustic particles
rain -> blue ripple glass
snow -> drifting flakes
storm -> distant plasma veins
windy -> flow ribbons
cloudy -> soft gray/blue fog
```

### Render Modes

```txt
background
fullscreen
widget
```

### Rendering

- flow fields
- caustic texture
- particle trails
- soft ripples
- subtle bloom

### Styles

- Morning Glass
- Storm Window
- Snow Drift
- Sunset Caustics

### Agent Guidance

Implement first with synthetic weather states.

Do not integrate real weather until the adapter interface exists.

---

## 7.2 Day Rhythm Field

### Concept

A slow ambient background that changes with time of day.

### Data Inputs

```txt
time
calendar optional
synthetic fallback
```

### Behaviors

```txt
morning -> bright bloom
afternoon -> structured flow
evening -> warm currents
night -> dark minimal particles
```

### Render Modes

```txt
background
fullscreen
widget
```

### Rendering

- gradient palette shifts
- slow vector fields
- particles or soft blobs
- low motion by default

### Styles

- Sunrise Bloom
- Afternoon Flow
- Evening Ember
- Midnight Quiet

### Agent Guidance

This should be one of the first ambients because it does not require complex real data.

---

## 7.3 Family Orbit

### Concept

Family members/devices represented as abstract orbiting bodies.

### Data Inputs

```txt
presence
homeAssistant optional
synthetic fallback
```

### Behaviors

```txt
home -> close orbit
away -> distant orbit
asleep -> dim slow orbit
active -> brighter pulse
```

### Render Modes

```txt
background
widget
fullscreen
```

### Rendering

- orbital particles
- soft glow
- connection lines
- status pulses

### Styles

- Soft Solar System
- Neon Household
- Quiet Satellites

### Agent Guidance

Do not hardcode real family names in the engine package.

Use generic member slots.

The host app can map names/devices.

---

## 7.4 House Pulse Map

### Concept

Rooms/devices become abstract nodes in a living nervous-system map.

### Data Inputs

```txt
homeAssistant
presence
synthetic fallback
```

### Behaviors

```txt
motion -> ripple
lights on -> warm halo
door opened -> edge pulse
temperature rising -> heat shimmer
alarm/warning -> amber glow
```

### Render Modes

```txt
background
widget
fullscreen
```

### Rendering

- nodes
- pulses
- soft line connections
- bloom
- event shockwaves

### Styles

- Neural Home
- Warm Circuit
- Night Watch

### Agent Guidance

Keep this abstract. Do not require a literal floorplan.

---

## 7.5 Music Dream Field

### Concept

A music-reactive visual layer.

### Data Inputs

```txt
media
audio analysis optional
album palette optional
synthetic fallback
```

### Behaviors

```txt
bass -> blob pulses
treble -> sparks
tempo -> wave frequency
album art -> palette extraction
volume -> bloom intensity
```

### Render Modes

```txt
background
fullscreen
widget
foregroundOverlay optional
```

### Rendering

- beat pulses
- flow fields
- particles
- bloom
- palette extraction

### Styles

- Album Aura
- Bass Plasma
- Spark Tempo
- Dream Equalizer

### Agent Guidance

Initial implementation should work with synthetic beat data.

Real audio analysis can be integrated later.

---

## 7.6 Memory Drift

### Concept

Photo-frame-adjacent ambient where recent photos influence color and motion.

### Data Inputs

```txt
photos
time
synthetic fallback
```

### Behaviors

```txt
photo palette -> ambient palette
date clusters -> constellation groups
tap -> reveal actual photo
idle -> drifting memory particles
```

### Render Modes

```txt
background
fullscreen
widget
```

### Rendering

- soft mosaic particles
- blurred color fields
- constellation trails
- gentle transitions

### Styles

- Soft Memories
- Photo Constellations
- Dream Mosaic

### Agent Guidance

Engine package should accept photo palette data, not directly manage photo storage.

---

## 7.7 Sleep Aquarium

### Concept

A low-brightness nighttime ambient.

### Data Inputs

```txt
time
sleep mode
synthetic fallback
```

### Behaviors

```txt
slow organisms
soft drifting bubbles
dim glow
minimal motion
no harsh flashes
```

### Render Modes

```txt
background
fullscreen
foregroundOverlay optional
```

### Rendering

- slow particles
- soft glow
- deep colors
- optional fish/plankton

### Styles

- Deep Sleep
- Night Plankton
- Moon Aquarium

### Agent Guidance

This ambient is the safety reference for sleep mode.

All foreground effects should be disabled or greatly reduced here.

---

## 7.8 Task Garden

### Concept

Tasks/reminders become living plants.

### Data Inputs

```txt
tasks
calendar optional
synthetic fallback
```

### Behaviors

```txt
new task -> seed
due soon -> bloom
overdue -> wilt/darken
completed -> sparkle/fruit drop
recurring -> perennial plant
```

### Render Modes

```txt
background
widget
fullscreen
```

### Rendering

- growth particles
- plant-like branching
- soft bloom
- completion sparkle events

### Styles

- Morning Chores
- Bloom Board
- Neon Garden

### Agent Guidance

Engine receives abstract task state. Host app owns task/calendar integration.

---

# 8. Foreground Ambient Catalog

Foreground ambients render above the UI and usually do not receive pointer events.

## 8.1 Snowfall

### Use Cases

- winter seasonal overlay
- weather-reactive snow
- holiday mode

### Rendering

- sprite/particle flakes
- slow drift
- depth by scale/alpha
- optional wind field

### Rules

- low brightness
- low density by default
- disable in sleep mode if distracting

---

## 8.2 Rain Streaks

### Use Cases

- weather overlay
- storm mode
- Home Weather Glass foreground

### Rendering

- short line particles
- directional wind
- occasional glass ripple

### Rules

- should not obscure text
- avoid high contrast over UI

---

## 8.3 Leaves / Pollen

### Use Cases

- fall/spring seasonal overlays
- cozy dashboard mode

### Rendering

- drifting particles
- sinusoidal motion
- rotation
- slow fall

### Rules

- sparse by default
- no heavy shaders

---

## 8.4 Embers

### Use Cases

- evening mode
- fireplace mode
- cooking/recipe UI
- cozy ambient state

### Rendering

- glowing sprites
- upward drift
- turbulence
- fade by age

### Rules

- very subtle
- warm palette
- low particle count

---

## 8.5 Fireflies

### Use Cases

- summer night
- Sleep Aquarium
- quiet ambient overlay

### Rendering

- wandering particles
- blink phases
- optional synchronized pulses
- slight cursor attraction

### Rules

- low motion
- low brightness
- good sleep-mode candidate if dim

---

## 8.6 Confetti

### Use Cases

- birthday
- task completed
- achievement
- race win
- holiday

### Rendering

- short-lived colored rectangles/triangles
- gravity
- drag
- rotation
- fade out

### Rules

- event-driven only
- disabled in sleep mode
- cap count aggressively

---

# 9. Reusable Burst / Emitter FX System

Short-lived effects should be reusable across games, simulations, ambients, and UI events.

Do not implement sparks/fireworks/confetti separately for each simulation.

---

## 9.1 BurstEffect Definition

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

---

## 9.2 BurstEmitterSystem

```ts
class BurstEmitterSystem {
  emit(effect: BurstEffect): void;
  update(dt: number): void;
  render(renderer: SimulationRenderer): void;
  clear(): void;

  setQuality(quality: RenderQuality): void;
  setSleepMode(enabled: boolean): void;
  setGlobalIntensity(value: number): void;
}
```

---

## 9.3 Shared Emitter Requirements

Every emitter must support:

```txt
seeded randomness
quality scaling
max particle cap
sleep mode reduction
pause/resume
automatic cleanup
foreground/background mode
```

---

## 9.4 SparkEmitter

### Use Cases

- impact
- collision
- electrical crackle
- race crash
- plasma discharge

### Behavior

- radial burst
- short lifetime
- gravity optional
- high velocity
- fades quickly

### Rendering

- small glow sprites
- additive blending
- optional line streaks

---

## 9.5 FireworkEmitter

### Use Cases

- birthdays
- celebrations
- holiday events
- achievement unlocks
- fullscreen toy mode

### Behavior

- rocket launch
- timed explosion
- radial burst
- secondary crackles
- smoke drift
- gravity + drag

### Rendering

- bright particles
- trail feedback
- bloom
- smoke layer
- optional shockwave ring

### Styles

- Classic Fireworks
- Neon Plasma
- Gold Sparkler
- Aurora Burst
- Pixel Confetti

### Safety

Fireworks should be disabled or heavily reduced in:
- sleep mode
- low-motion mode
- foreground overlay over important UI

---

## 9.6 EmberEmitter

### Use Cases

- cozy evening
- fireplace mode
- recipe/cooking UI
- task completion warmth

### Behavior

- slow upward drift
- turbulence
- fade by age
- occasional bright pulse

### Rendering

- tiny glow particles
- warm palette
- low bloom

---

## 9.7 ConfettiEmitter

### Use Cases

- task completed
- birthday
- win state
- party mode
- calendar milestone

### Behavior

- gravity
- rotation
- drag
- color variety
- fade out

### Rendering

- tiny rectangles/triangles
- no heavy shader required
- optional sparkle glints

---

## 9.8 FireflyEmitter

### Use Cases

- quiet summer ambient
- sleep aquarium
- foreground night overlay

### Behavior

- wandering
- blinking
- soft attraction
- optional synchronization

### Rendering

- tiny soft glow sprites
- low intensity
- slow motion

---

## 9.9 SmokeEmitter

### Use Cases

- fireworks
- embers
- plasma burn
- alchemical reactions
- orbital impacts

### Behavior

- soft upward drift
- expansion
- fade
- turbulence

### Rendering

- soft radial blob texture
- low alpha
- gray/violet palettes
- low-res trail optional

---

## 9.10 ArcSparkEmitter

### Use Cases

- Plasma Branch Terrarium
- Magnetic Cathedral
- Electro-Osmotic Amoeba
- UI power-on transition

### Behavior

- short branching line arcs
- high energy
- very short lifetime
- optional target point

### Rendering

- line mesh
- additive glow
- bloom composite

### Performance Rules

```txt
max arcs per frame: 16-32
max segments per arc: 4-8
lifetime: very short
```

---

# 10. Event Integration

The emitter system should be triggered from common app events.

## 10.1 UI Events

```txt
task completed -> confetti/sparkle
birthday -> fireworks/confetti
new message -> soft pulse
voice assistant wake -> ring ripple
voice assistant success -> sparkle
voice assistant error -> amber pulse
```

## 10.2 Home Events

```txt
door opened -> edge ripple
washer done -> sparkle burst
weather storm -> lightning sparks
sunset -> ember drift
holiday -> themed overlay
```

## 10.3 Game Events

```txt
collision -> spark burst
win -> firework/confetti
lap complete -> streak burst
power-up -> plasma pulse
```

## 10.4 Simulation Events

```txt
blob rupture -> smoke/spark burst
crystal fracture -> arc sparks
plasma discharge -> arc spark emitter
orbital impact -> spark + smoke
ant colony milestone -> glow pulse
```

---

# 11. Tracking Document Additions

Add the following implementation tracking section.

## Ambient and FX Infrastructure Queue

| Priority | System | Status | Depends On | Notes |
|---|---|---|---|---|
| 1 | AmbientExperience Contract | NOT_STARTED | LabExperience | defines ambient interface |
| 2 | AmbientLayer React Component | NOT_STARTED | Pixi app wrapper | background canvas |
| 3 | ForegroundAmbientOverlay | NOT_STARTED | transparent Pixi canvas | above-UI effects |
| 4 | Synthetic Ambient Data Adapters | NOT_STARTED | ambient contract | demo mode |
| 5 | BurstEmitterSystem | NOT_STARTED | particle renderer | shared FX |
| 6 | SparkEmitter | NOT_STARTED | BurstEmitterSystem | core effect |
| 7 | EmberEmitter | NOT_STARTED | BurstEmitterSystem | ambient effect |
| 8 | ConfettiEmitter | NOT_STARTED | BurstEmitterSystem | UI celebration |
| 9 | FireworkEmitter | NOT_STARTED | BurstEmitterSystem + trails | celebration/showcase |
| 10 | FireflyEmitter | NOT_STARTED | BurstEmitterSystem | quiet ambient |
| 11 | SmokeEmitter | NOT_STARTED | BurstEmitterSystem | supporting effect |
| 12 | ArcSparkEmitter | NOT_STARTED | line mesh renderer | plasma/electric effect |

---

## Ambient Experience Queue

| Priority | Ambient | Status | Depends On | Notes |
|---|---|---|---|---|
| 1 | Day Rhythm Field | COMPLETE | AmbientLayer | Implemented as first packaged ambient with deterministic seeded particle field, synthetic/time data fallback, sleep/low-motion controls, styles, registry wiring, and demo/browser validation. |
| 2 | Home Weather Glass | NOT_STARTED | synthetic weather | strong dashboard value |
| 3 | Sleep Aquarium | NOT_STARTED | low-motion mode | night/sleep reference |
| 4 | Music Dream Field | NOT_STARTED | synthetic beat | media integration later |
| 5 | House Pulse Map | NOT_STARTED | synthetic home events | HA integration later |
| 6 | Task Garden | NOT_STARTED | synthetic tasks | organizer integration |
| 7 | Family Orbit | NOT_STARTED | synthetic presence | presence integration later |
| 8 | Memory Drift | NOT_STARTED | palette input | photo integration later |

---

## Foreground Overlay Queue

| Priority | Overlay | Status | Depends On | Notes |
|---|---|---|---|---|
| 1 | Snowfall | NOT_STARTED | ForegroundAmbientOverlay | simplest overlay |
| 2 | Embers | NOT_STARTED | EmberEmitter | cozy mode |
| 3 | Fireflies | NOT_STARTED | FireflyEmitter | quiet night |
| 4 | Confetti | NOT_STARTED | ConfettiEmitter | UI celebration |
| 5 | Rain Streaks | NOT_STARTED | particle/line renderer | weather |
| 6 | Leaves/Pollen | NOT_STARTED | particle renderer | seasonal |

---

# 12. Implementation Milestones

## Milestone A: Overlay Foundation

Implement:
- transparent foreground Pixi canvas
- `pointer-events: none`
- resize handling
- pause/resume
- sleep mode integration
- global intensity setting

Validation:
- overlay does not block UI
- overlay resizes correctly
- overlay can be disabled instantly
- no GPU leaks after toggling

---

## Milestone B: First Emitters

Implement:
- SparkEmitter
- EmberEmitter
- ConfettiEmitter

Validation:
- emitters auto-clean
- particle caps work
- sleep mode reduces/disables appropriately
- styles/palettes work

---

## Milestone C: First Ambients

Implement:
- Day Rhythm Field
- Home Weather Glass with synthetic data
- Snowfall overlay
- Embers overlay

Validation:
- background mode does not reduce UI readability
- foreground mode does not block input
- synthetic data can drive state changes
- performance governor can reduce intensity

---

## Milestone D: Event Integration

Implement event triggers:

```txt
task completed
birthday
weather state change
voice assistant wake/success/error
game win/collision
simulation burst
```

Validation:
- events route through BurstEmitterSystem
- no duplicate emitter logic
- foreground effects respect quiet/sleep mode

---

# 13. Definition of Done

The ambient / FX system is complete when:

- ambient experiences can run as background layers
- foreground overlays can render above UI without blocking input
- emitters are reusable across games/sims/ambients/UI
- synthetic data works in demo mode
- host app can inject real data
- sleep mode reduces/disables effects
- performance governor can scale intensity
- burst particles auto-clean
- all effects have particle caps
- foreground effects can be toggled globally
- no render target leaks occur
- GitHub demo can showcase ambients and emitters independently

---

# 14. Final Guidance

The ambient and emitter systems should make the lab feel integrated into the family assistant.

The goal is not merely:

```txt
cool particle demos
```

The goal is:

```txt
a living visual layer for the home interface
```

Use this split:

```txt
background ambients = mood
foreground overlays = accents
emitters = feedback/polish
fullscreen = experiences
widgets = previews/status
```

Most importantly:

```txt
Ambients should support real app data, but never require it.
Emitters should be reusable everywhere, but never implemented ad hoc.
Foreground overlays should look magical, but never interfere with UI.
```
