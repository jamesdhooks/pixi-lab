# SKILL: Add a New Experience (Game or Simulation)

Use this skill when creating a new game or interactive simulation in `packages/games`.

---

## Step 1 — Choose a Name and ID

Pick a kebab-case `id` (e.g. `race-track`, `bubble-pop`) and a PascalCase prefix (e.g. `RaceTrack`, `BubblePop`).

---

## Step 2 — Create the folder structure

```bash
mkdir -p packages/games/src/<id>/__tests__
```

Files to create:
```
packages/games/src/<id>/
  <id>.config.ts           — SettingsField[] for user-configurable options
  <id>.definition.ts       — GameDefinition satisfying the LabExperience contract
  <PascalId>Scene.ts       — primary gameplay (extends Scene)
  <PascalId>PreviewScene.ts — lightweight preview (extends Scene, ≤5 bodies)
  <PascalId>AI.ts          — (optional) AI player (extends BasicAI)
  __tests__/<PascalId>Scene.test.ts
```

---

## Step 3 — Write `<id>.config.ts`

```typescript
import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const <camelId>SettingsFields: SettingsField[] = [
  {
    key: 'speed',
    label: 'Ball Speed',
    description: 'How fast balls move',
    type: 'range',
    min: 1,
    max: 10,
    step: 1,
    default: 5,
  },
  // …more fields
];
```

---

## Step 4 — Write `<PascalId>Scene.ts`

```typescript
import {
  Scene,
  createCircleBody,
  createEdgeWall,
  destroyBody,
  styleRegistry,
} from '@hooksjam/pixi-lab-core';
import type { GameContext } from '@hooksjam/pixi-lab-core';
import type { Sprite } from 'pixi.js';
import * as planck from 'planck';

export class <PascalId>Scene extends Scene {
  // declare instance state

  override init(ctx: GameContext): void {
    super.init(ctx);
    // create physics bodies, sprites, audio subscriptions
  }

  override update(ctx: GameContext, dt: number): void {
    // per-frame logic: physics step, collision handling, score updates
  }

  override destroy(): void {
    // clean up bodies, sprites
    super.destroy();
  }
}
```

**Rules:**
- Import only from `@hooksjam/pixi-lab-core` (never raw `pixi.js` or `planck`)
- Call `ctx.emit({ kind: 'score_update', value: newScore })` to update HUD
- Call `ctx.emit({ kind: 'game_over' })` when the game ends

---

## Step 5 — Write `<PascalId>PreviewScene.ts`

Identical structure to the main scene but:
- ≤5 physics bodies
- No audio
- Uses `ctx.mode === 'preview'` guard if needed

---

## Step 6 — Write `<id>.definition.ts`

```typescript
import type { GameDefinition } from '@hooksjam/pixi-lab-core';
import { <camelId>SettingsFields } from './<id>.config';
import { <PascalId>Scene } from './<PascalId>Scene';
import { <PascalId>PreviewScene } from './<PascalId>PreviewScene';

export const <camelId>Definition: GameDefinition = {
  id: '<id>',
  name: '<Display Name>',
  icon: '🎮',
  short: 'One-line tagline',
  long: 'Two to three sentence description of the experience.',
  capabilities: {
    screensaver: false,
    multiplayer: false,
    tutorial: true,
  },
  tutorialPages: [
    {
      title: 'How to Play',
      body: 'Tap or click to interact.',
      image: undefined,
    },
  ],
  palette: 'neon',
  settingsFields: <camelId>SettingsFields,
  sceneFactory: () => new <PascalId>Scene(),
  previewFactory: () => new <PascalId>PreviewScene(),
};
```

---

## Step 7 — Register in `packages/games/src/index.ts`

```typescript
import { <camelId>Definition } from './<id>/<id>.definition';
export { <camelId>Definition } from './<id>/<id>.definition';

export const GAME_REGISTRY: readonly GameDefinition[] = [
  ballPitDefinition,
  <camelId>Definition,   // ← add here, alphabetical order
] as const;
```

---

## Step 8 — Write a unit test

```typescript
// packages/games/src/<id>/__tests__/<PascalId>Scene.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { <PascalId>Scene } from '../<PascalId>Scene';
import type { GameContext, InputSnapshot } from '@hooksjam/pixi-lab-core';

vi.mock('@hooksjam/pixi-lab-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hooksjam/pixi-lab-core')>();
  return {
    ...actual,
    createCircleBody: vi.fn(() => ({ body: {}, sprite: {} })),
    // mock other helpers as needed
  };
});

function makeCtx(): GameContext {
  return {
    mode: 'play',
    width: 400,
    height: 600,
    palette: 'neon',
    userId: 'test-user',
    emit: vi.fn(),
    input: { /* InputSnapshot shape */ } as InputSnapshot,
  };
}

describe('<PascalId>Scene', () => {
  it('emits game_over when lives reach zero', () => {
    const scene = new <PascalId>Scene();
    const ctx = makeCtx();
    scene.init(ctx);
    // trigger conditions…
    expect(ctx.emit).toHaveBeenCalledWith({ kind: 'game_over' });
  });
});
```

---

## Step 9 — Quality gates

```bash
pnpm --filter @hooksjam/pixi-lab-games typecheck
pnpm --filter @hooksjam/pixi-lab-games build
pnpm test
```

---

## Step 10 — Verify in demo

```bash
pnpm --filter @hooksjam/pixi-lab-demo dev
```

Open http://localhost:5173/pixi-lab/ — the new experience should appear on the home page.

---

## Checklist

- [ ] `<id>.config.ts` created
- [ ] `<PascalId>Scene.ts` created and extends `Scene`
- [ ] `<PascalId>PreviewScene.ts` created (lightweight)
- [ ] `<id>.definition.ts` created with all required fields
- [ ] Registered in `packages/games/src/index.ts`
- [ ] Unit test written
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] Visible and playable in demo app
