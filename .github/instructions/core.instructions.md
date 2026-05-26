---
applyTo: packages/core/**/*.ts
---

# Core Package Instructions

## Purpose
`packages/core` is the engine layer. It must be **React-free** and **framework-free**.
All types that cross package boundaries are defined here.

## Key Files

- `types.ts` — all primitive types (`Vec2`, `GameEvent`, `ScoreEntry`, `SettingsField`, etc.)
- `LabExperience.ts` — `GameDefinition` interface. This is the contract every game must satisfy.
- `GameApp.ts` — the main runtime orchestrator. One per canvas.
- `Scene.ts` — base class for all game scenes.
- `index.ts` — the public barrel. Add new exports here to expose them to consumers.

## Rules

1. **No React imports** — zero `import React` or JSX in this package
2. **No `any`** — use `unknown` with type guards
3. **Physics via `physics/` wrappers only** — never import `planck` directly in scene files; use the helpers in `physics/Bodies.ts` and `physics/World.ts`
4. **PixiJS via `render/` wrappers** — use `PixiApp`, `SpriteFactory`, `ParticleSystem` instead of raw `pixi.js` in scene files
5. **Every public symbol must be exported** from `index.ts`
6. **`GameDefinition` fields are stable API** — changing them is a breaking change requiring a version bump
7. **Renderer families live in core** — Pixi-specific simulation renderers belong in `packages/core/src/render` and must be exported from `src/index.ts`. Simulation packages compose these renderer APIs; they must not implement their own Pixi render pipelines.

## Simulation Renderer Families

- `FieldPaletteRenderer` — scalar/wave/heat field visualization.
- `DensityMetaballRenderer` — smooth blob/metaball membranes decoupled from model grid resolution.
- `TrailFeedbackRenderer` — pheromones, echoes, scars, orbital dust, and persistent trail fields.
- `MeshLatticeRenderer` — triangular grids, crystal facets, fungal lattices, and mesh-like growth.
- `ArcLineRenderer` — plasma branches, discharges, velocity streaks, and temporal arcs.
- `ParticlePointRenderer` — agents, debris, sparks, nuclei, and lightweight particle overlays.

Prefer adding or improving one of these shared renderers over adding a one-off renderer to a simulation folder.

## Adding to the Public API

When you add a new class, type, or function that consumers should use:
1. Export it from the appropriate source file
2. Add it to `src/index.ts`
3. Rebuild: `pnpm --filter @hooksjam/pixi-lab-core build`
