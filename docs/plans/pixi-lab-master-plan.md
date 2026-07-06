# Pixi Lab Master Plan

Updated: 2026-07-01  
Status: active plan for the clean-slate Pixi Lab rebuild

## Current reality

Pixi Lab is no longer the broad legacy catalog from the old `main` branch. The active rebuild is a focused PixiJS v8 lab with:

- a reusable TypeScript engine package;
- an app-agnostic React runtime shell;
- a Vite demo app that composes curated registries;
- exactly three fully promoted launch experiences:
  - Ball Pit;
  - Harmonic Sand Plate;
  - Space Debris.

This is the new baseline. The old ambient catalog, exploratory ports, raw-mode drafts, and scattered implementation notes are legacy/reference material until a future slice deliberately cleans and promotes them.

## Product goal

Pixi Lab should feel like a polished, interactive engine gallery: small enough to trust, rich enough to prove the engine, and structured enough to accept future experiences without returning to a dumping-ground architecture.

The rebuild is considered successful when the engine, React runtime, demo host, and three launch experiences are implemented, testable, deployable, and documented as the promoted foundation.

As of this update, that foundation is implemented and deployed from the rebuild branch. Remaining work is about hardening, visual QA, performance budgets, and future promotion governance — not recovering the old catalog wholesale.

## Scope boundary

### In scope for the foundation

- Core runtime and engine contracts.
- React host shell and reusable UI controls.
- Demo app launcher/gallery/runtime routing.
- Registry-driven experience discovery.
- Backend/profile render selection with legacy quality compatibility.
- Pixi-safe fallback behavior for unsupported render requests.
- Preview and fullscreen launch paths.
- Settings, tutorial, debug, style, demo/autoplay, reset, and runtime capability plumbing.
- Curated launch experiences:
  - Ball Pit;
  - Harmonic Sand Plate;
  - Space Debris.
- Package-level tests that protect runtime and promoted content behavior.
- Deployment through the dev-tools lab stack.

### Out of scope until deliberately promoted

- Broad ambient package restoration.
- Old reference-scene dumps.
- One-off exploratory ports.
- Draft plan fragments that no longer match the clean architecture.
- Global raw mode as a universal quality tier.
- Wholesale framework rewrites.
- Scene-owned WebGL/WebGPU experiments promoted into core before multiple experiences prove the boundary.

## Architecture baseline

```txt
packages/
  core/src/         Shared engine/runtime primitives and renderer adapters
  react/src/        App-agnostic React host shell and UI controls
  games/src/        Curated games exposed through GAME_REGISTRY
  simulations/src/  Curated simulations exposed through SIMULATION_REGISTRY
  demo/src/         Vite host app composing the curated registries
```

All launchable content enters through `LabExperience`-compatible definitions. The demo app should not special-case individual scenes except for explicitly documented, temporary compatibility flags.

```txt
GAME_REGISTRY + SIMULATION_REGISTRY
  → demo App experience list
  → GameLauncher / runtime shell
  → LabExperience.factory(ctx)
  → Scene implementation
```

## Engine package plan

Package: `@hooksjam/pixi-lab-core`

The core package is the reusable engine surface. It owns shared contracts, runtime primitives, renderer helpers, simulation primitives, and compatibility adapters.

Implemented foundation includes:

- `GameApp`, `Scene`, `Ticker`, `Input`, `Audio`, `Settings`, and `Telemetry` exports.
- `LabExperience`, `GameDefinition`, and `SimulationDefinition` typing.
- physics world/body helpers and pooling.
- Pixi app helpers, sprite/particle systems, style registry, render target pooling, ping-pong buffers, and style management.
- semantic render frame/pipeline helpers for Pixi and WebGL2 paths.
- raw WebGL2 scene/resource utilities.
- simulation primitives for scalar, density, trail, and vector fields.
- demo AI, simulation AI, intent handling, director mode, performance governance, stagnation recovery, debugging, ambient/effect data contracts, gesture interpretation, and style export support.
- backend/profile render selection helpers in `runtime/RenderBackendProfile.ts`.

Engine priorities after the foundation:

1. Keep core generic. Only promote APIs proven by at least one curated experience and preferably reused by more than one.
2. Preserve Pixi as the default safe backend.
3. Treat raw/WebGL2 paths as opt-in capabilities advertised by individual experiences.
4. Keep compatibility with legacy `basic | enhanced | raw` quality only as a bridge, not the final vocabulary.
5. Add focused tests for every shared runtime helper before expanding it.

## React runtime plan

Package: `@hooksjam/pixi-lab-react`

The React package is the app-agnostic host shell and UI/control layer. It should remain reusable by any host app that wants to launch Pixi Lab experiences.

Implemented foundation includes:

- `ExperienceRuntime`, `GameRuntime`, and `SimulationRuntime`.
- `GameLauncher` for mounting experience factories.
- gallery and preview tile components.
- viewport provider/hooks.
- HUD, quit, intro, tutorial, pause, game-over, press-hint, start-card, settings drawer, style picker, engine configuration selector, quality selector, debug controls, mode toggle, shader tuning drawer, simulation control panel, bottom sheet, and overflow menu.
- render-quality/backend-profile selection bridge through runtime helpers.

React runtime priorities after the foundation:

1. Keep the shell scene-agnostic.
2. Avoid route forks and per-experience host hacks.
3. Make controls capability-driven from definitions.
4. Preserve mobile/desktop behavior through shared viewport infrastructure.
5. Keep debug/performance tools available without polluting the experience implementations.

## Demo app plan

Package: `@hooksjam/pixi-lab-demo`

The demo app is the product surface for the current foundation. It composes the curated game and simulation registries into a launcher/gallery.

Implemented foundation includes:

- registry composition from `GAME_REGISTRY` and `SIMULATION_REGISTRY`.
- kind filtering for games/simulations/overlays-compatible future categories.
- active experience launching.
- carousel/docked navigation behavior.
- app demo/autoplay staging with crossfade.
- query routing for direct experience launch.
- runtime render-selection query parsing and compatibility storage.
- production Vite build served by the lab deployment container.

Demo app priorities after the foundation:

1. Perform browser visual QA across all three promoted experiences.
2. Track bundle size and split chunks if the app bundle continues growing.
3. Keep direct URLs stable for each promoted experience.
4. Keep app-level demo/autoplay safe for preview budgets.
5. Add smoke coverage for launch routing where practical.

## Launch experience plan

### Ball Pit

Package: `@hooksjam/pixi-lab-games`

Registry status: promoted via `GAME_REGISTRY` as the only current game.

Implemented definition includes:

- id `ball-pit`;
- score support;
- AI autoplay;
- screensaver support;
- tutorial pages;
- settings fields and defaults;
- fullscreen scene factory;
- preview and screensaver factories;
- AI factory.

Product role: the game-loop and physics proving ground. It validates touch input, spawning, attraction, scoring, tutorial flow, preview, AI/autoplay, and score-capable runtime behavior.

Remaining hardening:

- visual QA on desktop and mobile;
- confirm scoring/readability under high object counts;
- tune preview and screensaver budgets if needed;
- add regression tests when gameplay behavior changes.

### Harmonic Sand Plate

Package: `@hooksjam/pixi-lab-simulations`

Registry status: promoted via `SIMULATION_REGISTRY`.

Implemented definition includes:

- id `harmonic-sand`;
- settings/defaults;
- style manifest;
- preview scene;
- Pixi/enhanced scene;
- raw scene path;
- demo AI;
- tutorial pages;
- gesture map;
- director events;
- stagnation policy;
- engine configurations for `basic`, `enhanced`, and `raw`;
- capabilities for interactivity, ambient behavior, gestures, reset, director mode, stagnation recovery, debug overlay, style export, procedural textures, render target pooling, demo, and settings.

Product role: the simulation-control and resonance-field proving ground. It validates particle simulation controls, style manifests, raw/Pixi selection, presets/settings, debug controls, procedural texture capability, and demo automation.

Remaining hardening:

- visual QA for every style preset;
- compare basic/enhanced/raw behavior for user-visible parity;
- tune particle counts and field resolution under preview/fullscreen budgets;
- expand tests around model invariants when controls change.

### Space Debris

Package: `@hooksjam/pixi-lab-simulations`

Registry status: promoted via `SIMULATION_REGISTRY`.

Implemented definition includes:

- id `orbital-shrapnel`;
- settings/defaults;
- style manifest;
- preview scene;
- Pixi/enhanced scene;
- raw reference scene;
- localhost-gated experimental raw-engine scene;
- raw composite mapper and texture plan support;
- demo AI;
- tutorial pages;
- modes for add/influence tools;
- gesture map and keyboard hints for raw mode;
- director events;
- stagnation policy;
- engine configurations for `basic`, `enhanced`, and `raw`;
- capabilities for interactivity, ambient behavior, gestures, reset, director mode, stagnation recovery, debug overlay, style export, procedural textures, render target pooling, demo, and settings.

Product role: the high-end renderer and orbital-model proving ground. It validates deterministic particle/orbit modeling, Pixi simulation layers, raw reference rendering, raw composite planning, advanced controls, and guarded experimental engine work.

Remaining hardening:

- visual QA for raw reference versus Pixi/enhanced paths;
- keep experimental raw engine gated until it is safe beyond localhost/test usage;
- verify keyboard controls and touch controls across devices;
- use existing raw texture/composite tests as the baseline for future renderer upgrades.

### Fireworks

Package: `@hooksjam/pixi-lab-simulations`

Registry status: registered via `SIMULATION_REGISTRY`; manual demo QA still pending.

Implemented definition includes:

- id `fireworks`;
- raw WebGL2 scene;
- preview scene;
- settings/defaults;
- style manifest;
- demo AI with full style and numeric setting overhauls;
- tutorial pages;
- launch, fan, and finale modes;
- gesture map for taps, double taps, drags, and fast swipes;
- director events;
- stagnation policy;
- raw engine configuration;
- capabilities for interactivity, ambient behavior, gestures, reset, director mode, stagnation recovery, debug overlay, style export, procedural texture capability, render target pooling, demo, and settings.

Product role: the high-count event-command particle showcase. It validates 32 GPU shader explosion templates, GPU-resident spark stepping, lifespan aging, color transitions, point-sprite rendering, trail feedback, probabilistic secondary shell actors, and demo-AI-driven parameter overhauls.

Remaining hardening:

- James' manual demo QA pass;
- browser visual QA across launch/fan/finale modes;
- tune style palettes and high-density finale budgets after live inspection;
- capture screenshots or clips once the look is approved.

## Testing and verification baseline

The clean foundation is expected to pass:

```bash
pnpm --recursive typecheck
pnpm test -- --run
pnpm --recursive build
```

Current known package-level coverage includes:

- core input/settings/render-backend-profile/performance/raw-WebGL2/semantic-render tests;
- React engine configuration selection and quality selector tests;
- demo query route tests;
- Ball Pit scene tests;
- Harmonic Sand model tests;
- Space Debris model/raw texture/raw composite tests.

Deployment readiness requires the dev-tools Pixi Lab container to rebuild successfully and serve the demo app locally, with the public hostname protected by Cloudflare Access where configured.

## Promotion policy

A new feature or restored legacy experience may enter the active baseline only when it satisfies all of the following:

1. It has a clear product role that strengthens the engine/gallery.
2. It uses existing runtime contracts where possible.
3. Any new shared core API is small, typed, and tested.
4. It has preview and fullscreen behavior when appropriate.
5. It advertises capabilities through its definition rather than host-specific forks.
6. It passes package checks and recursive build.
7. Its docs update this master plan or the tracking summary instead of creating scattered drift.

## Next milestones

### Milestone 1 — Foundation acceptance

- Confirm all three promoted experiences launch from the deployed app.
- Perform desktop visual QA for gallery, direct routes, preview tiles, fullscreen launch, settings, debug controls, and app demo mode.
- Perform mobile visual QA for touch gestures, safe areas, carousel behavior, and performance.
- Record any bugs in the tracking summary.

### Milestone 2 — Performance and bundle budget

- Investigate the current large Vite bundle warning.
- Decide whether to split demo chunks by package/experience.
- Add lightweight runtime performance notes for preview versus fullscreen budgets.

### Milestone 3 — Raw/backend vocabulary cleanup

- Continue migration from global legacy quality language to backend/profile descriptors.
- Preserve `basic | enhanced | raw` compatibility only where scene code still needs it.
- Keep raw capability per-experience and sanitized by runtime helpers.

### Milestone 4 — Legacy promotion lane

- Review old main catalog one candidate at a time.
- Pick only candidates that add a distinct engine capability or product value.
- Rewrite, test, and promote through the current registry contracts.

## Definition of done for the rebuild

The clean-slate rebuild is done when:

- the engine package exposes the shared runtime needed by the curated set;
- the React shell launches experiences without scene-specific host forks;
- the demo app composes registries and supports direct launch/demo/gallery behavior;
- Ball Pit, Harmonic Sand Plate, and Space Debris are implemented as promoted experiences;
- Fireworks is implemented as a registered raw simulation awaiting manual QA approval;
- typecheck, tests, and build pass;
- the lab service deploys and serves the current demo app;
- this master plan and the tracking summary describe the new reality accurately.

By this definition, the core rebuild is implemented. The active work now shifts to acceptance QA, performance/bundle hardening, and disciplined future promotion.
