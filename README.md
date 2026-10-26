# StickLab v0.2 — Living Physics Sandbox

[Play StickLab on GitHub Pages](https://matthagersenior.github.io/StickLab/) · [Offline standalone HTML](StickLab-Offline.html) · [Release notes](docs/releases/v0.2.md)

A tiny, offline-first, touch-friendly 2D sandbox combining ragdoll figures, construction, and physical experiments. **No runtime dependencies, account, telemetry, WebGL, or network connection required for the standalone file.**

## v0.2 Features

- Freeform placement of **stick figures, boxes, balls, fixed anchors**, ropes and springs.
- **Rotatable boxes** with rotated collision handling; **hinges** connect two bodies at their selected attachment points.
- **Spatial grid collision broad phase** replaces the original all-pairs loop to reduce work in spread-out scenes.
- **Three named save slots**, import/export of version 2 scenes, and a safe legacy v0.1 slot-1 load fallback.
- Paused one-step physics advancement, grab/throw/erase, undo for edits, gravity, bounce and simulation speed.
- Touch **tap-to-place** and two-finger pinch/pan with a mouse/keyboard fallback.
- Responsive Canvas scene with Eco, Standard, High, and automatic performance choices.
- Three preset worlds: Playground, Tower, and Chaos.

**Controls:** Use the side toolbar or mobile bottom toolbar. Select **Hinge** and tap two bodies to join them; connect to a fixed anchor to create a suspended rotating beam. The first tap selects a local joint position; the second creates the joint. Tap **Step ·** to advance physics while paused. Keyboard: `1`–`8` original tools, `P` pause, `.` step, Ctrl+Z undo, A/D or arrows to move a selected figure, W/↑/Space to jump.

**Save compatibility:** This release exports `{format: "StickLab", version: 2, world: ...}`. Existing v0.1 JSON scenes remain readable. On Slot 1, Load also checks the original `sticklab_scene_v1` browser-storage key if no v0.2 Slot 1 save exists. Import validation runs before modifying the active scene. Browser save slots are specific to each device/browser/origin.

## Development

Edit the maintainable source in `src/index.html`, `src/style.css`, `src/core.js`, `src/game.js`. Do not hand-edit generated `index.html` and `StickLab-Offline.html`.

```sh
node scripts/build-offline.cjs
node --check src/core.js && node --check src/game.js
node --test tests/*.test.cjs
```

GitHub Actions runs the same checks and fails if the generated files differ.

GitHub Pages publishes `index.html` with a manifest and service worker for supported browsers. `StickLab-Offline.html` is a self-contained file suitable for keeping on a device or transferring offline. Runtime compatibility depends on JavaScript and HTML5 Canvas support; very old devices may need Eco mode or a smaller scene. Chrome/Android web-app installation varies by browser/device.

## Roadmap

The unified design is in [Living Sandbox specification](docs/specs/2026-10-26-living-sandbox-design.md) and the [v0.2 plan](docs/plans/2026-10-26-v0.2-foundation.md).

v0.3 will expand materials, motors, breakable joints and vehicle parts. v0.4 targets living inhabitants with autonomous behavior. **Those features are not included in v0.2.** Ragdolls already obey physics but are not autonomous inhabitants.

## License

No explicit software license has been selected yet. Until one is added, public visibility does not grant redistribution permission.
