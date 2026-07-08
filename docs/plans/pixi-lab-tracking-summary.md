# Pixi Lab Tracking Summary

Updated: 2026-07-01  
Status: active tracking summary for the clean-slate rebuild

## Summary

Pixi Lab has moved from a broad legacy branch into a focused rebuild baseline. The current active branch implements the engine package, React runtime shell, demo host app, and the three promoted launch experiences:

- Ball Pit;
- Harmonic Sand Plate;
- Space Debris.

The old main catalog is intentionally not the active tracking source anymore. This document replaces the old scattered tracker style with a concise record of what is implemented, what was deliberately left behind, and what remains before the rebuild should be treated as accepted on `main`.

## Current branch and deployment state

- Active rebuild branch: `agent/pixi-lab-core-rebuild-clean`.
- Last verified commit during deployment: `f7af912 test(games): align Ball Pit package harness`.
- Deployed service: `dev-tools-pixi-lab`.
- Local service URL: `http://127.0.0.1:4173/`.
- Public hostname: `https://pixi.jameshooks.tech/`, protected by Cloudflare Access.
- Demo app title marker: `pixi-lab — Interactive Demos`.

Latest verified checks before this summary:

- `pnpm --recursive typecheck` passed.
- `pnpm test -- --run` passed: 15 test files, 104 tests.
- `pnpm --recursive build` passed, including the demo production build.
- Docker redeploy completed successfully through the dev-tools lab stack.
- Container health check reported healthy.
- Local endpoint returned `HTTP/1.1 200 OK`.
- Public endpoint returned Cloudflare Access `HTTP/2 302`, expected for the protected route.

Known non-blocking warnings:

- Vite CJS Node API deprecation warning during tests.
- Vite/Rollup large chunk warning during demo build.
- Docker Compose optional environment-variable warnings for unrelated/defaulted values.
- Docker Compose Bake/buildx warning.

## Implementation progress

### Foundation packages

| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| `packages/core` | Implemented | Public barrel exports engine runtime, scene/ticker/input/audio/settings/telemetry, experience definitions, physics, Pixi/render helpers, semantic pipelines, raw WebGL2 utilities, simulation fields, performance/stagnation/debug/AI helpers | Treat as foundation-complete; future shared APIs should be proven and tested before expansion |
| `packages/react` | Implemented | Public barrel exports runtime components, launcher/gallery/preview tiles, viewport infrastructure, HUD/tutorial/settings/style/engine/debug/mode/shader/sim controls | Keep app-agnostic and capability-driven |
| `packages/games` | Implemented for launch scope | `GAME_REGISTRY` contains `ballPitDefinition` | Only Ball Pit is promoted now |
| `packages/simulations` | Implemented for launch scope | `SIMULATION_REGISTRY` contains `harmonicSandDefinition` and `orbitalShrapnelDefinition` | Only two simulations are promoted now |
| `packages/demo` | Implemented | App composes game/simulation registries, launches active experience, handles filters, carousel/docked navigation, app demo mode, direct route parsing | Needs visual QA and bundle hardening |

### Runtime and engine capabilities

| Capability | Status | Notes |
| --- | --- | --- |
| Scene lifecycle | Implemented | `Scene`, `GameApp`, runtime factories, preview/fullscreen paths |
| Input and gestures | Implemented | Shared input plus per-definition gesture maps for simulations |
| Settings/defaults | Implemented | Experience definitions provide settings fields and config defaults |
| Render selection | Implemented | Backend/profile selection helpers plus legacy quality compatibility |
| Pixi rendering | Implemented | Default safe runtime path |
| Semantic simulation layers | Implemented | Shared render frame/layer/pipeline utilities present in core |
| Raw WebGL2 utilities | Implemented | Raw scene/resource utilities exist; raw usage remains opt-in by experience |
| Physics support | Implemented | Ball Pit uses physics/game-loop path; core exports body/world helpers |
| Preview tiles | Implemented | Definitions expose preview factories; demo uses preview tiles |
| Tutorial flow | Implemented | Definitions expose tutorial pages |
| Demo/autoplay | Implemented | Ball Pit AI factory; Harmonic/Orbital demo AI factories; demo app demo stage mode |
| Debug/settings/style controls | Implemented | React package exports controls and promoted simulation definitions advertise support |
| Stagnation/director metadata | Implemented for simulations | Harmonic and Orbital definitions include policies/events |

## Promoted experience status

### Ball Pit

Status: implemented and promoted.

Evidence:

- Registered in `GAME_REGISTRY`.
- Definition id: `ball-pit`.
- Kind: `game`.
- Exposes scene factory, preview factory, screensaver factory, AI factory, tutorial pages, settings fields, and config defaults.
- Advertises score, AI autoplay, screensaver, and tutorial capabilities.
- Covered by `packages/games/src/ballpit/__tests__/BallPitScene.test.ts`.

Tracking notes:

- Serves as the physics/game-loop proof point.
- Remaining work is acceptance QA, score readability under load, mobile touch validation, and preview/screensaver budget tuning if needed.

### Harmonic Sand Plate

Status: implemented and promoted.

Evidence:

- Registered in `SIMULATION_REGISTRY`.
- Definition id: `harmonic-sand`.
- Kind: `simulation`.
- Exposes Pixi/enhanced scene, raw scene, preview scene, demo AI, tutorial pages, settings/defaults, style manifest, gesture map, director events, stagnation policy, and engine configurations for `basic`, `enhanced`, and `raw`.
- Advertises interactive, ambient, gestures, reset, director mode, stagnation recovery, debug overlay, style export, procedural textures, render target pool, demo, and settings capabilities.
- Covered by `packages/simulations/src/harmonic-sand/__tests__/HarmonicSandModel.test.ts`.

Tracking notes:

- Serves as the resonance-field and simulation-control proof point.
- Remaining work is visual QA across style presets and render profiles, performance tuning for preview/fullscreen budgets, and model regression expansion when controls change.

### Space Debris

Status: implemented and promoted.

Evidence:

- Registered in `SIMULATION_REGISTRY`.
- Definition id: `orbital-shrapnel`.
- Kind: `simulation`.
- Exposes Pixi/enhanced scene, raw reference scene, localhost/test-gated experimental raw-engine scene, preview scene, demo AI, tutorial pages, modes, settings/defaults, style manifest, gesture map, director events, stagnation policy, and engine configurations for `basic`, `enhanced`, and `raw`.
- Advertises interactive, ambient, gestures, reset, director mode, stagnation recovery, debug overlay, style export, procedural textures, render target pool, demo, and settings capabilities.
- Covered by model, raw texture plan, and raw composite mapper tests.

Tracking notes:

- Serves as the high-end renderer/orbital-model proof point.
- Experimental raw engine path is intentionally gated to localhost/test conditions.
- Remaining work is visual QA across Pixi/enhanced/raw paths, keyboard/touch validation, and measured confidence before expanding experimental raw engine availability.

### Fireworks

Status: implemented and registered; awaiting manual demo QA.

Evidence:

- Registered in `SIMULATION_REGISTRY`.
- Definition id: `fireworks`.
- Kind: `simulation`.
- Exposes raw WebGL2 scene, preview scene, demo AI, tutorial pages, modes, settings/defaults, style manifest, gesture map, director events, stagnation policy, and raw engine configuration.
- Advertises interactive, ambient, gestures, reset, director mode, stagnation recovery, debug overlay, style export, procedural textures, render target pool, demo, and settings capabilities.
- Covered by `packages/simulations/src/fireworks/__tests__/FireworksDemoAI.test.ts` and `packages/simulations/src/fireworks/__tests__/fireworks.definition.test.ts`.

Tracking notes:

- Serves as the event-command GPU particle proof point: CPU-scheduled launch actors feed bounded spawn commands while dense spark motion, lifespan aging, color transition, point rendering, and trail feedback stay GPU-resident.
- Includes 32 shader-level explosion templates plus probabilistic secondary shell actors for recursive smaller bursts.
- Remaining work is James' manual demo QA, visual tuning across styles/densities, and performance capture for high-density finale settings.

### Particle Fluid

Status: implemented and registered; awaiting manual demo QA.

Evidence:

- Registered in `SIMULATION_REGISTRY`.
- Definition id: `particle-fluid`.
- Kind: `simulation`.
- Exposes raw WebGL2 scene, preview scene, demo AI, tutorial pages, modes, settings/defaults, style manifest, gesture map, director events, stagnation policy, and raw engine configuration.
- Advertises interactive, ambient, gestures, reset, debug overlay, style export, demo, and settings capabilities.
- Covered by `packages/simulations/src/particle-fluid/__tests__/particle-fluid.definition.test.ts`.

Tracking notes:

- Serves as a particle-fluid companion to Fluid Tank: it uses CPU spatial-grid particle integration with GPU point-density rendering for a Haxiomic-inspired dye-fluid look.
- Attribution is carried in the definition/tutorial/advanced physics notes: visual reference is Haxiomic GPU Fluid Experiments, https://github.com/haxiomic/GPU-Fluid-Experiments.
- Remaining work is James' manual demo QA, visual tuning across palettes/render styles, and performance capture for high-count particle settings.

### Splash MPM

Status: implemented and registered; awaiting manual demo QA.

Evidence:

- Registered in `SIMULATION_REGISTRY`.
- Definition id: `splash-mpm`.
- Kind: `simulation`.
- Exposes raw WebGL2 scene, preview scene, demo AI, tutorial pages, modes, settings/defaults, style manifest, gesture map, director events, stagnation policy, and raw engine configuration.
- Advertises interactive, ambient, gestures, reset, debug overlay, style export, demo, and settings capabilities.
- Covered by `packages/simulations/src/splash-mpm/__tests__/splash-mpm.definition.test.ts`.

Tracking notes:

- Serves as an independent 2D APIC/MLS-MPM-inspired water scene: particles transfer mass and momentum to a grid, grid pressure/viscosity/boundaries update the velocity field, and FLIP/PIC blending returns motion to particles before density-surface rendering.
- Attribution is carried in the definition/tutorial/advanced physics notes: technique reference is Splash by matsuoka-601, https://github.com/matsuoka-601/Splash.
- Remaining work is James' manual demo QA, visual tuning across the glass/foam/depth render styles, and performance capture at high particle/grid settings.

## Legacy material disposition

The old `main` branch contained a broad catalog and many plan fragments. Those files are not the active implementation target for the clean rebuild.

Legacy material left behind includes:

- `packages/ambients` and its ambient scene catalog;
- numerous exploratory simulations and reference scenes;
- old raw-mode mini-plans and render-variant audits;
- debug-only demo artifacts;
- previous master/tracking documents whose scope no longer matches the new baseline.

Disposition policy:

1. Do not bulk-copy the old catalog into the rebuild.
2. Treat legacy docs as source material only.
3. Promote one candidate at a time through the current package/registry/contracts.
4. Rewrite docs when a legacy candidate is promoted; do not preserve stale task lists as active truth.

## Acceptance checklist for the clean rebuild

### Completed

- [x] Core engine package exists and exports the current shared runtime surface.
- [x] React runtime package exists and exports the reusable host shell and controls.
- [x] Demo app composes promoted registries.
- [x] Ball Pit is implemented and registered.
- [x] Harmonic Sand Plate is implemented and registered.
- [x] Space Debris is implemented and registered.
- [x] Fireworks is implemented and registered.
- [x] Typecheck passed.
- [x] Test suite passed.
- [x] Recursive build passed.
- [x] Dev-tools lab redeploy succeeded.
- [x] Local health/HTTP verification succeeded.
- [x] Public hostname reached Cloudflare Access as expected.
- [x] New master plan and tracking summary created for the clean baseline.

### Remaining before `main` promotion / acceptance signoff

- [ ] Review these new docs for product accuracy.
- [ ] Browser-open deployed app through Cloudflare Access and visually test the gallery.
- [ ] Launch Ball Pit from the deployed app and verify gameplay loop, scoring, tutorial, preview, and AI/screensaver behavior.
- [ ] Launch Harmonic Sand Plate from the deployed app and verify touch gestures, settings, style presets, demo mode, debug overlay, and render profile behavior.
- [ ] Launch Space Debris from the deployed app and verify add/influence modes, raw controls where available, style presets, demo mode, and render profile behavior.
- [ ] Launch Fireworks from the deployed app and verify launch/fan/finale modes, secondary bursts, style presets, demo mode, debug overlay, and raw density behavior.
- [ ] Launch Particle Fluid from the deployed app and verify vortex/inject/repel modes, attribution text, palette presets, settings, demo mode, and raw particle density performance.
- [ ] Launch Splash MPM from the deployed app and verify splash/jet/repel modes, attribution text, palette presets, settings, demo mode, and raw particle-grid performance.
- [ ] Decide whether to address Vite large-bundle warning before or after main promotion.
- [ ] Decide whether to merge/squash/promote `agent/pixi-lab-core-rebuild-clean` onto `main` as the new baseline.

## Current risks

### Bundle size

The demo production build currently emits a large chunk warning. This does not block deployment, but it should be tracked before the catalog expands.

Likely future work:

- split vendor/app/experience chunks;
- lazy-load experience packages;
- keep preview paths cheap.

### Raw mode vocabulary

The current system still bridges legacy `basic | enhanced | raw` quality language. The rebuild has a backend/profile selector foundation, but not every scene should treat raw as universally safe.

Likely future work:

- keep per-experience advertised engine configurations;
- prefer backend/profile wording in UI and docs;
- keep old quality strings as compatibility shims.

### Visual QA gap

Automated checks prove compile/test/build/deploy health, but they do not prove the polished feel of each visual experience.

Likely future work:

- perform deployed browser QA;
- capture screenshots or short clips for each promoted experience;
- record defects in this tracking file or issue tracker.

### Legacy catalog temptation

The old branch contains many interesting scenes. Restoring them too quickly would recreate the same sprawl the clean rebuild was meant to solve.

Likely future work:

- introduce a promotion rubric;
- pick one legacy candidate at a time;
- require tests, preview/fullscreen behavior, and product rationale.

## Verification commands

Use these commands from the repo root for local verification:

```bash
pnpm --recursive typecheck
pnpm test -- --run
pnpm --recursive build
```

Use the dev-tools deployment command for lab service redeploy:

```bash
/home/hermes/projects/dev-tools/scripts/deploy-lab-stack.sh pixi-lab
```

Use these checks after deploy:

```bash
docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' dev-tools-pixi-lab
curl -I http://127.0.0.1:4173/
curl -I https://pixi.jameshooks.tech/
```

Redact cookies, tokens, connection strings, and private URLs in any copied output.

## Next recommended action

Review and commit this documentation update with the clean branch if it matches product intent. Then do a browser QA pass against the deployed app. If the visual pass is clean enough, promote the rebuild branch as the new `main` baseline.
