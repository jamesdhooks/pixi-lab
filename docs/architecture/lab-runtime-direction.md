# Lab Runtime Direction

PIXILAB-6 moves Pixi Lab toward a browser Lab Runtime for games, simulations, ambients, overlays, and toys. PixiJS remains a first-class renderer backend, but it should no longer be treated as the whole platform identity.

## Runtime boundary

The Lab Runtime owns the host concerns that every experience shares:

- experience discovery and launch contracts through `LabExperience`;
- lifecycle, input, settings, demo/autoplay, idle behavior, and reset hooks;
- preview vs fullscreen/background rendering intent;
- backend/profile selection and sanitization before an experience is mounted;
- app-agnostic React shell behavior.

An experience owns its model, scene-specific adapters, renderer details, style manifest, settings, demo AI behavior, and validation evidence.

## Backend vs profile vocabulary

Use these terms for new architecture work:

- **Renderer backend**: the rendering implementation family, for example `pixi`, `webgl2`, `three`, or `webgpu`.
- **Render profile**: the budget/intent within a backend, for example `preview`, `standard`, or `high`.
- **Legacy render quality**: the existing `basic | enhanced | raw` selector that current scenes and routes still use while migration proceeds.

`raw` should not be treated as a global quality tier. If an experience needs a raw/high-powered route, expose it only through that experience's capabilities and route sanitization. Prefer describing future raw-like work as an explicit backend/profile pairing, such as `webgl2` + `high`, with a Pixi-safe preview fallback.

## Migration guardrails

- Do not rewrite the whole engine or switch the project wholesale to another framework.
- Do not globally expose raw mode.
- Do not promote scene-owned WebGL/WebGPU experiments into core until repeated implementation patterns prove the boundary.
- Keep Pixi as the default shared backend and preserve existing demo/gallery discovery while adding backend-neutral vocabulary.
- Add small pure helpers/types before runtime rewiring, then validate with focused package checks.

## Implemented bridge slice

`packages/core/src/runtime/RenderBackendProfile.ts` provides a pure bridge from existing `qualityModes` to backend/profile candidates. It keeps current scene behavior intact while giving host UI/runtime code backend-neutral terms to consume. The bridge also centralizes legacy quality sanitization so unsupported `raw` requests fall back to Pixi-safe modes unless an experience explicitly advertises `raw`.

## Host selection descriptor slice

`resolveRenderBackendProfileSelection()` now returns a small host/runtime descriptor with `backend`, `profile`, and the sanitized `legacyQuality`. This gives route/query/runtime state one backend-neutral object to carry while existing scenes continue receiving `RenderQuality`. The descriptor deliberately derives from advertised experience capabilities, so `raw` remains scoped to experiences that opt in.

## React runtime adoption slice

`packages/react/src/qualitySelection.ts` now delegates persisted/query startup quality sanitization to the shared runtime bridge. `QualitySelector` groups options by renderer backend and derives button labels/tooltips from backend/profile candidates, keeping legacy route values intact while surfacing the new vocabulary at the host UI boundary.

## React runtime descriptor slice

`packages/react/src/qualitySelection.ts` now exports `resolveRenderSelection()`, a React-facing helper that returns the shared `backend/profile/legacyQuality` descriptor for startup and route state. Existing callers can continue using `sanitizeRenderQuality()` for scene compatibility, while new host/runtime code can consume backend-neutral state without reinterpreting `basic | enhanced | raw` locally.

## GameLauncher descriptor state slice

`GameLauncher` now stores the resolved render selection descriptor as runtime state and derives the legacy scene `quality` from `selection.legacyQuality`. Startup, persisted quality repair, and explicit quality changes all flow through `resolveRenderSelection()`, so the launcher can retain backend/profile state without changing current `quality=basic|enhanced|raw` URL and scene compatibility.

## Host-visible descriptor callback slice

`GameLauncher` now exposes `onRenderSelectionChange(selection)` so host apps and future debug/launcher UI can observe the backend-neutral `backend`, `profile`, and `legacyQuality` descriptor without changing current route params or scene contracts. This keeps Pixi-safe legacy `RenderQuality` plumbing in place while establishing a stable host boundary for backend/profile state.

## Demo host readout slice

`packages/demo/src/App.tsx` now consumes `GameLauncher`'s `onRenderSelectionChange()` callback for the active experience and shows a small Lab Runtime readout with the resolved renderer backend and render profile. This is intentionally host-only telemetry: it does not change route params, persisted quality, scene startup, preview behavior, or the legacy `quality=basic|enhanced|raw` compatibility contract.

## Query migration parser slice

`resolveRenderBackendProfileQuerySelection()` adds a pure bridge for future `backend` and `profile` query params while keeping legacy `quality` as the backward-compatible fallback. Backend/profile params win only when they map to an advertised experience capability; unsupported pairs such as global `webgl2/high` or `webgpu/high` fall back through the same legacy quality sanitizer, so raw/high-powered routes remain opt-in per experience.

## Demo query resolver slice

Demo route parsing now accepts future `backend` and `profile` query params through the shared resolver while continuing to pass only the sanitized legacy `quality` value into current scenes. Legacy `quality=basic|enhanced|raw` remains supported and unchanged. Backend/profile params only select capabilities advertised by the active experience, so requests such as global `webgl2/high` still fall back to Pixi-safe launch values unless that experience explicitly exposes the raw route.

## Route serialization helper slice

`serializeRenderBackendProfileRoute()` provides a pure host-route helper for internal links that need to mirror the active descriptor as `backend=<renderer>&profile=<profile>`. It intentionally omits legacy `quality` by default so public/default demo routes can continue using backward-compatible `quality=basic|enhanced|raw` serialization elsewhere. Compatibility test links can opt into including `quality` when they need both vocabularies side by side.

## Demo internal route helper slice

`packages/demo/src/App.tsx` now has `buildExperienceBackendProfileRoute()` as the narrow demo/internal path for composing `experience=<id>` links with backend/profile params. It delegates backend/profile serialization to the shared core helper and deliberately omits legacy `quality`, keeping the migration scoped to explicit internal links instead of changing public launch URL behavior globally.

## Next smallest slice

Wire `buildExperienceBackendProfileRoute()` into a visible developer/debug affordance only if the demo needs shareable backend/profile links. Keep normal gallery launch URLs legacy-compatible until enough host code consumes backend/profile descriptors directly.
