# StickLab v0.4.3 — Living Physics Sandbox

**Freeform connections:** The **Pin** tool creates new fixed anchor points anywhere in the world. Rope, Spring, and Hinge attach any two existing bodies. **Detach** removes one connection without deleting either object; tap a purple anchor with Detach to release its connectors and reuse it. Undo restores detached links. See [v0.4.3 release notes](docs/releases/v0.4.3-detach.md).



**Device layout:** StickLab supports responsive portrait/landscape layouts for phone and tablet touchscreens as well as desktop mouse/keyboard play. The title and action buttons stack on portrait phones, while short landscape screens use compact controls without covering each other. The game maintains a Canvas-compatible, offline-first fallback. See [the v0.4.2 responsive release notes](docs/releases/v0.4.2-responsive.md) for tested viewports and limitations.

**[Play in your browser](https://matthagersenior.github.io/StickLab/)** · **[Portable offline version](StickLab-Offline.html)** · [v0.4 release notes](docs/releases/v0.4.md)

StickLab is a tiny, offline-first, cross-device physics playground. Build contraptions, experiment with stick-figure ragdolls and vehicles, **solve levels through physical interactions**, and give independent stick-figure inhabitants their own behavior. Canvas rendering, plain JavaScript and zero runtime dependencies keep the game usable on older devices.

## Two connected ways to play

**Free Sandbox:** use Playground, Tower or Chaos scenes, or clear the world to build your own. No success condition, time limit or login.

**Physics Challenges:** select Level 01, 02 or 03 in the sidebar. Each puzzle has a **blue target ball** and **green goal**. Get the target ball fully inside the goal and keep it settled for **12 consecutive physics steps**. Any physical construction that works is valid: falling weights, ramps, wheels, ropes, springs, hinges, or a powered cart. You cannot directly grab the target ball, and importing a scene exits Challenge mode. Win to unlock the next level; unlocks are retained on your device. **Hint**, **Restart level**, **Next level** and **Free sandbox** controls are available.

The starter levels are: **First Push** (move a ball across the floor), **Bridge the Gap** (move the ball from a raised platform), and **Over the Wall** (get it across a fixed obstacle). They have no mandatory scripted solution.

## v0.4 living inhabitants

- **Resident** tool spawns an articulated figure with a unique name, a curious/cautious/helpful personality and a small saved memory. The original **Ragdoll** tool remains passive.
- Characters wander, investigate loose balls, avoid nearby falling objects, and try to hop over low fixed obstacles. They move by applying impulses to their existing ragdoll joints, not teleporting.
- Select a resident in Grab mode to control it directly (keyboard or on-screen arrows/jump); **Release control** resumes its AI.
- Set Explore, Help or Rest, or switch AI on/off globally while keeping the physical simulation running.
- In Help mode, characters can approach a loose ball, assist by pushing it through collisions, or activate an unpowered nearby wheel. They may help with Physics Challenges, but **do not automatically solve every level**.
- Offline decision-making is throttled: Eco 2 active agents, Standard 5, High 8; the remaining figures continue as physics-driven ragdolls.
- v4 exports save resident names, settings, personalities and bounded hazard/interaction memories. Imports and old v0.1–v0.3 save files remain supported and migrate safely; old figures remain passive.

## v0.3 physics features

- **Motor cart prefab:** a chassis with two wheel bodies attached with hinged axles; motors propel grounded wheels.
- **Wheel tool:** add unpowered free-rolling wheels; **Motor tool:** tap a wheel to cycle forward / reverse / off.
- **Materials:** select wood, rubber or steel before placing boxes. Impact damage weakens non-fixed boxes; broken boxes make a small, performance-capped amount of debris.
- **Fracture:** newly created ropes, springs, and hinges may fail under excessive stress. Old non-breakable v0.1/v0.2 connections keep their original behavior.
- **Build tools:** articulated stick figures, rotatable boxes, balls, anchors, ropes, springs, hinges, wheel, motor cart, motor, grab and erase.
- **World tools:** simulation pause/step, gravity, speed, bounce, three save slots, undo construction edits, JSON scene import/export.
- **Performance:** spatial-grid collision candidates, Eco/Standard/High profiles, object limits, and debris caps.

### Controls

Touch: tap a tool and tap the canvas; two fingers pan/zoom. Keyboard: number keys 1–9 control original tools, `P` pauses, `.` single-steps, Ctrl+Z undoes construction, and A/D/arrows + jump control a selected figure. New vehicle tools are available in the sidebar and touch toolbar.

## Save and compatibility

v0.4 exports `{format:"StickLab",version:4,world:{parts,links,groups,aiEnabled,...}}`. Imported v0.1 and v0.2 scene files are migrated and validated before changing the active world. Save Slot 1 can read legacy v0.1 storage, and each slot can read an existing v0.2/v0.3 save when no v0.4 save exists. Current saves use `sticklab_scene_v4_<slot>`. Challenge unlocks are stored separately under `sticklab_challenge_unlocks_v03` and are **not** granted by importing a saved scene. Save and unlock data do not synchronize across devices.

## Development

Source: `src/index.html`, `src/style.css`, `src/core.js`, `src/levels.js`, `src/machines.js`, `src/inhabitants.js`, `src/game.js`. Generated: `index.html` (Pages) and `StickLab-Offline.html` (standalone).

```sh
node scripts/build-offline.cjs
node --check src/core.js && node --check src/levels.js && node --check src/machines.js && node --check src/inhabitants.js && node --check src/game.js
node --test tests/*.test.cjs
```

GitHub Actions additionally verifies that committed generated files match the source build. The Pages app caches its hosted files for offline use in compatible browsers; the downloadable standalone HTML works without the cache.

**Limits:** This is stylized game physics, not an engineering solver. Vehicle traction, impact fracture, and high-density piles use approximations; old-device FPS targets require physical-device benchmarking. v0.4 adds local reactive autonomous inhabitants; long-range route planning, character relationships, and learned puzzle solutions remain outside this release.

## License

No repository license selected yet; visibility does not grant reuse or redistribution permissions.
