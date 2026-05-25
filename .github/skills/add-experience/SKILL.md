# SKILL: Add a New Experience

Use this skill as a router when adding new pixi-lab content.

Choose the correct scaffold:

- **Game** — competitive or score/rule-driven content in `packages/games`.
- **Simulation** — ambient, emergent, style-driven visual systems in `packages/simulations`.
- **Toy** — future lightweight interactive experiences that are neither game nor simulation.

For simulations, use `.github/skills/add-simulation/SKILL.md`.

For games, follow the existing game package structure:

```txt
packages/games/src/<id>/
  <id>.config.ts
  <id>.definition.ts
  <PascalId>Scene.ts
  <PascalId>PreviewScene.ts
  <PascalId>AI.ts
  __tests__/<PascalId>Scene.test.ts
```

Game definitions must use `kind: 'game'` and satisfy the `GameDefinition` alias exported by `@hooksjam/pixi-lab-core`.

## Minimum viable game definition

```ts
export const myGame: GameDefinition = {
  id: 'my-game',
  kind: 'game',
  name: 'My Game',
  short: 'One-liner shown on the tile',
  long: 'Longer description for the intro card',
  tags: ['action'],
  icon: '🎮',
  capabilities: {
    score: true,  // only declare what you actually use
  },
  factory: (_ctx) => new MyScene(),
  previewFactory: (_ctx) => new MyPreviewScene(),
};
```

- `settingsFields` / `configDefaults` — omit entirely if the game has no user-configurable settings
- `tutorialPages` — omit if no tutorial; the launcher hides the tutorial button automatically
- Capability booleans default to `false`/absent — only declare `true` values

## Capabilities checklist

When authoring `definition.capabilities`, consider:

| Capability | When to add | Requirement |
|---|---|---|
| `score: true` | Scene emits `score_update` events | Required for leaderboard |
| `qualityModes: ['basic', 'enhanced']` | Scene has two rendering tiers | Implement `setQuality()` |
| `reset: true` | Scene supports user-triggered drain/restart | Override `Scene.reset()` — see `BallPitScene` |
| `tutorial: true` | `tutorialPages` array is non-empty | Provide at least one tutorial page |
| `aiAutoplay: true` | AI player extends `BasicAI` | Implement `<Name>AI.ts` |
| `screensaver: true` | Safe to run unattended | No score requirement, stable infinite loop |

## UI provided by the shell (GameLauncher)

You **do not** need to build these UI elements — the launcher handles them:

- **Reset button** — shown bottom-right when `capabilities.reset: true`. Calls `appRef.current.resetScene()` → `scene.reset()`.
- **Debug panel** — the `DebugPanel` component (bottom-right) shows live fps/quality/bodies. It calls `app.getDebugStats()` and `app.setDebugEnabled()`. No code needed in the scene.
- **Quality selector** — shown in HUD controls when `qualityModes` is set. Calls `app.setQuality()`.
- **Settings modal** — centered card (desktop) / bottom-sheet (mobile). Renders `definition.settingsFields` automatically.

## Quality gates

```bash
pnpm --filter @hooksjam/pixi-lab-core build   # rebuild core first if you touched it
pnpm --filter @hooksjam/pixi-lab-games typecheck
pnpm --filter @hooksjam/pixi-lab-games build
pnpm test
pnpm --filter @hooksjam/pixi-lab-demo dev
```

