---
applyTo: packages/games/**/*.ts
---

# Games Package Instructions

## Purpose
`packages/games` is the game content layer. It contains self-contained game and simulation definitions.
It imports engine types from `@hooksjam/pixi-lab-core` and exports `GameDefinition` objects.

## Structure

Each game lives in its own folder:
```
packages/games/src/
  <game-name>/
    <game-name>.definition.ts   — GameDefinition (id, name, icon, scenes, …)
    <game-name>.config.ts       — SettingsField[] for this game
    <GameName>Scene.ts          — primary gameplay Scene subclass
    <GameName>PreviewScene.ts   — lightweight scene for GameTile preview
    <GameName>AI.ts             — (optional) AI player extending BasicAI
    __tests__/                  — Vitest unit tests
  index.ts                      — exports GAME_REGISTRY, getGame()
```

## Rules

1. **Import only from `@hooksjam/pixi-lab-core`** — never import from `pixi.js` or `planck` directly.
   Use the wrappers: `createCircleBody`, `PhysicsWorld`, `PixiApp`, `SpriteFactory`, etc.
2. **Each `GameDefinition` must have a unique `id`** (kebab-case, e.g. `ball-pit`).
3. **Register in `index.ts`** — add to `GAME_REGISTRY` array.
4. **Test Scene logic** — unit test `update()` logic, scoring, and physics interaction.
   Mock engine modules via `vi.mock('@hooksjam/pixi-lab-core', ...)`.
5. **`PreviewScene` must be lightweight** — ≤5 physics bodies, no audio, ≤30 FPS cap.
6. **No React** — game files are pure TypeScript engine code.

## To add a new game, use the `/add-experience` skill.
