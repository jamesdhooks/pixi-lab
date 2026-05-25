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

## Capabilities

Declare only the capabilities you actually use — everything else defaults to `false`/absent.

```ts
capabilities: {
  score: true,              // scene emits score_update events
  qualityModes: ['basic', 'enhanced'],  // scene switches rendering path on setQuality()
  reset: true,              // scene overrides Scene.reset() with a drain/restart cycle
  tutorial: true,           // tutorialPages array is non-empty
  aiAutoplay: true,         // AI player extends BasicAI
  screensaver: true,        // safe to run unattended as screensaver
}
```

- **`reset: true`** — implement `override reset()` in the main `Scene` subclass.
  The launcher renders a "Reset" button in the top-right bar automatically. The convention is:
  1. Drop the bottom wall so balls fall out.
  2. In `update()` while `isResetting`, clean up bodies that have drained below the canvas.
  3. When all are gone (or a timeout of ~2.5 s), restore the wall, reset score to 0, emit
     `{ kind: 'score_update', value: 0 }`, and set `isResetting = false`.
  See `BallPitScene.ts` for the canonical implementation.

- **`qualityModes`** — implement `setQuality(q: RenderQuality)` to switch sprite detail.
  Use `SpriteFactory.makeEnhancedBallSprite()` for `'enhanced'`,
  `SpriteFactory.makeUltraBallSprite()` for `'ultra'` (baked drop-shadow + AO), and
  `SpriteFactory.makeCircleSprite()` for `'basic'`.

## Style Changes

When `styleManifest` is present the launcher renders a **StylePicker** in the top bar.
The shell calls `GameApp.setStyle(id)` which forwards to `Scene.setStyle(id)`.
Override `setStyle` in your scene to react immediately:

```ts
override setStyle(id: string) {
  this.currentPaletteName = id;
  this.recolorAllContent(id);
}
```

Additionally, persist the style in the scene's `onEnter` by reading `settings.get('style')` as the
initial value (so reloads honour the last selection).

## Settings Fields and Top Sliders

`settingsFields` are declared as `SettingsField[]` on the definition.

- **`type: 'number'` fields** — rendered as floating horizontal sliders at the **top of the screen**
  via `SimControlPanel`. Only fields whose `visibleModes` array includes the currently active mode
  (or fields without `visibleModes`) are shown.
- **`type: 'select'` fields** — currently only used for internal logic (e.g. `'style'`).
  The StylePicker is the canonical UI for style selection.
- **`type: 'boolean'` fields** — rendered in the SettingsDrawer when
  `capabilities.settings !== false`.

The `visibleModes` property gates a field to specific interaction modes:

```ts
{ key: 'rapidSpeed', label: 'Spawn Rate', type: 'number', min: 5, max: 100, step: 5,
  default: 10, visibleModes: ['rapid'] }
```

> **Important:** `capabilities.settings: false` hides the SettingsDrawer but does **not**
> prevent numeric `settingsFields` from appearing as top-of-screen sliders.

Read settings in your scene via `ctx.systems.settings.get(key)` — the value is always in sync
with both the slider and localStorage.

## Mode Toggle

Games can advertise named interaction modes via the `modes` array on the definition:

```ts
modes: [
  { id: 'single',  label: 'Single',  icon: '⬤',    description: 'Tap to drop one ball' },
  { id: 'rapid',   label: 'Rapid',   icon: '⬤⬤⬤', description: 'Hold to spray' },
  { id: 'explode', label: 'Explode', icon: '✦',    description: 'Hold for explosion' },
],
```

When `modes.length > 1`, the launcher renders a **top-centre pill toggle** automatically.
The launcher calls `GameApp.setInteractionMode(id)` on every change, which forwards to
`Scene.setMode(id)`. Override `setMode` in your scene to switch behavior:

```ts
override setMode(id: string) {
  this.interactionMode = id as MyGameMode;
  // Clean up any mode-specific state (hold graphics, timers, etc.)
}
```

Rules:
- If `modes` has exactly one entry, the toggle is not rendered.
- Modes are optional — omit the array for games with a single fixed interaction style.
- The first mode in the array is the default. The launcher calls `setInteractionMode` with it on
  game start and on every restart.
- Mode IDs should be stable strings (not numbers) so they survive serialization.

## Input Best Practices

- **Spawn on pointer UP**, not DOWN — use `snap.justUp` to spawn objects on release.
- **`Input.onUp` removes the pointer from `snap.pointers`** — you cannot read its position
  in the same frame as `justUp`. Track positions manually with a `Map<number, PointerTrackData>`
  updated each frame in the `update()` loop.
- **Drag velocity** — smooth velocity with exponential moving average:
  ```ts
  data.vx = data.vx * 0.55 + rawVx * 0.45;
  ```
- **Hold-to-explode** — track `holdElapsed` per pointer; reset it when `movedThisFrame > threshold`.
  Only wire this logic when `this.interactionMode === 'explode'`.

## PreviewScene drain/fill pattern

`PreviewScene` should loop autonomously: fill with a few bodies, let them settle, drain (remove
bottom wall), then fill again. Track phase with an enum or number and a `phaseTimer`.

## To add a new game, use the `/add-experience` skill.

