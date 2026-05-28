# AGENTS.md — pixi-lab

> Universal agent entry point. Auto-read by OpenAI Codex, Claude Code, GitHub Copilot Workspace, and any agent following the AGENTS.md convention.

## Project Identity

| Field | Value |
|---|---|
| **Monorepo** | `@hooksjam/pixi-lab` |
| **Purpose** | Standalone, publishable PixiJS v8 game engine + game content library |
| **Stack** | TypeScript 5.4+ strict · PixiJS v8 · planck physics v1 · React 18 · Vite 5 |
| **Package manager** | `pnpm` ONLY |

## Package Map

| Package | Path | Description |
|---|---|---|
| `@hooksjam/pixi-lab-core` | `packages/core` | Engine: types, GameApp, Scene, physics, AI, scoring |
| `@hooksjam/pixi-lab-react` | `packages/react` | React shell: GameRuntime, GameLauncher, GameTile, UI |
| `@hooksjam/pixi-lab-games` | `packages/games` | Game content: Ball Pit, future games |
| `@hooksjam/pixi-lab-simulations` | `packages/simulations` | Simulation content: Harmonic Sand Plate, future sims |
| `@hooksjam/pixi-lab-demo` | `packages/demo` | Vite demo app (not published) |

## Non-Negotiable Rules

1. TypeScript strict — no `any`, no `@ts-ignore` without explanation
2. No `console.log` in library code
3. `@hooksjam/pixi-lab-core` is the single import for all engine types
4. `LabExperience` (in `core/src/LabExperience.ts`) is the shared contract between games, simulations, and toys
5. `GameLauncher` in react is app-agnostic — no routing, no fetch calls
6. Each game is a self-contained folder under `packages/games/src/<game-name>/`
7. Simulation rendering must use the appropriate core renderer family, not the lowest-common-denominator field painter. Use `FieldPaletteRenderer` for true scalar/wave fields, `DensityMetaballRenderer` for blobs, `TrailFeedbackRenderer` for persistent trails, `MeshLatticeRenderer` for triangular/crystal/fungal grids, `ArcLineRenderer` for plasma/discharge/streaks, and `ParticlePointRenderer` for agents/debris.
8. Rendering is idle-by-default. Plain `Scene` subclasses must not force continuous rendering or per-frame simulation when there are no active pointers, particles, awake physics bodies, or custom visual animations. Override `shouldRender()` only for visual work the engine cannot infer, and prefer dirty/active flags over unconditional buffer uploads.
9. `aiAutoplay` means the game supports AI; it must not run in normal play unless explicitly enabled by the host/runtime. AI drags must use stable negative pointer ids and must always release them.
10. Conventional Commits: `type(scope): subject` — scopes: `core` `react` `games` `sims` `demo` `ci` `deps` `config`

## Adding a New Experience

Read `.github/skills/add-experience/SKILL.md` first. It routes to the game or simulation scaffold.

## Manual Demo QA

Demo-capable experiences are marked as needing QA in the gallery until James explicitly approves them. When that happens, use `.github/skills/qa-experience/SKILL.md` and update both `pixijs_simulation_tracking_system_v1.md` and `packages/demo/src/demoQaStatus.ts`.

## Common Commands

```bash
pnpm install
pnpm --recursive build
pnpm --recursive typecheck
pnpm --filter @hooksjam/pixi-lab-demo dev
pnpm test
```
