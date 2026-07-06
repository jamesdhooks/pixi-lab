# Settings field organization

Settings are shared metadata rendered by the React settings drawer. Keep scene settings predictable with these rules:

- Use `section` on every new `SettingsField`.
- Use stable section labels such as `Input Mode`, `Physics`, `Simulation`, `Rendering`, `Planet`, `Secondary Bodies`, and `Demo`.
- Put input-tool controls under `section: 'Input Mode'`.
- Pair every input-tool-only control with `visibleModes`, for example `visibleModes: ['interact']`.
- Keep global simulation, rendering, and physics controls visible across modes unless the setting truly only affects one mode.
- Use `visibleRenderStyles`, `visibleQualities`, or `visibleEngineConfigurations` for renderer/style-specific controls, not `visibleModes`.
- Keep preview/demo-only controls clearly labeled with `Demo` if they are still useful in the drawer.

The drawer groups fields by `section` in declaration order. Fields without a section fall back to `Experience` or `Advanced`, but new scene settings should not rely on that fallback.
