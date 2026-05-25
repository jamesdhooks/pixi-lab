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
7. Conventional Commits: `type(scope): subject` — scopes: `core` `react` `games` `sims` `demo` `ci` `deps` `config`

## Adding a New Experience

Read `.github/skills/add-experience/SKILL.md` first. It routes to the game or simulation scaffold.

## Common Commands

```bash
pnpm install
pnpm --recursive build
pnpm --recursive typecheck
pnpm --filter @hooksjam/pixi-lab-demo dev
pnpm test
```
