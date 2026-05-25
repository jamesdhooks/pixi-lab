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

Quality gates:

```bash
pnpm --filter @hooksjam/pixi-lab-games typecheck
pnpm --filter @hooksjam/pixi-lab-games build
pnpm test
pnpm --filter @hooksjam/pixi-lab-demo dev
```
