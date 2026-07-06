# Lab Runtime Direction

Pixi Lab main now carries the reusable browser Lab Runtime plus a deliberately small curated content set: Ball Pit, Harmonic Sand Plate, and Space Debris. The runtime should support games, simulations, previews, overlays, and future renderer backends, but main should only promote cleaned-up content one slice at a time.

## Runtime boundary

The Lab Runtime owns host concerns shared by every experience:

- experience discovery and launch contracts through `LabExperience`;
- lifecycle, input, settings, demo/autoplay, idle behavior, and reset hooks;
- preview versus fullscreen rendering intent;
- backend/profile selection and sanitization before an experience is mounted;
- app-agnostic React shell behavior.

An experience owns its model, scene-specific adapters, renderer details, style manifest, settings, demo AI behavior, and validation evidence.

## Backend and profile vocabulary

Use these terms for architecture work:

- **Renderer backend**: the rendering implementation family, for example `pixi`, `webgl2`, `three`, or `webgpu`.
- **Render profile**: the budget/intent within a backend, for example `preview`, `standard`, or `high`.
- **Legacy render quality**: the current `basic | enhanced | raw` selector retained for scene compatibility while host/runtime code migrates to backend/profile descriptors.

`raw` must not become a global quality tier. High-powered paths are opt-in per experience through advertised capabilities, and unsupported backend/profile requests fall back through the Pixi-safe sanitizer.

## Current implementation shape

- `packages/core/src/runtime/RenderBackendProfile.ts` owns backend/profile candidates, query parsing, route serialization, default descriptors, and persisted render-selection keys.
- `packages/react/src/qualitySelection.ts` adapts the shared runtime bridge for React startup, persisted state, and selector behavior.
- `packages/react/src/GameLauncher.tsx` keeps scene-facing `RenderQuality` compatibility while retaining the resolved backend/profile descriptor in host state.
- `packages/demo/src/demoRuntime.ts` owns the demo host's query parsing, runtime readout, and compatibility-storage helpers.
- `packages/demo/src/App.tsx` composes the curated registries and avoids scene-specific route forks.

## Migration guardrails

- Do not rewrite the whole engine or switch the project wholesale to another framework.
- Do not globally expose raw mode.
- Do not promote scene-owned WebGL/WebGPU experiments into core until repeated implementation patterns prove the boundary.
- Keep Pixi as the default shared backend and preserve demo/gallery discovery through `LabExperience`.
- Add small pure helpers/types before runtime rewiring, then validate with focused package checks.
- Keep tweakable experience settings in the gear/settings drawer; avoid duplicate top-of-scene sliders or selects that compete with the canvas.
- Keep reference scenes, exploratory ports, and draft documentation off main until they are intentionally promoted.

## Promotion order

1. Extend shared core/runtime capability only when a curated experience needs it.
2. Prove the capability with package-level tests.
3. Wire React/demo host behavior through reusable helpers.
4. Add one polished experience and its registry entry.
5. Update consolidated docs instead of adding scattered implementation notes.
