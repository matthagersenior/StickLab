# StickLab — Unified Living Physics Sandbox

**Approved design baseline** · 2026-10-26 · v0.2–v0.4 roadmap

**Status:** Approved as the implementation direction on 2026-10-26. The described future features are not claims about the existing game.

## 1. Vision and product promise

StickLab is an offline-first, 2D, stick-figure physics sandbox in which construction, destruction, and autonomous character behavior use **one shared simulation**. Every structure, body, and agent occupies the same simulated world and follows the same physical interaction rules. Switching from building to playing changes the input tool, not the game engine or scene.

The experience begins instantly: open a playground, build or spawn something, press Play, observe, interfere, and rebuild. No account or network is required. The core game must work through HTML5 Canvas 2D and widely supported JavaScript; installability through a PWA is an optional enhancement, not a runtime requirement.

### Design principles

1. **One ruleset:** Objects, machines, characters, and debris collide and connect in the same world.
2. **Simple visuals, deep interaction:** Black-line figures and procedural shapes take priority over image assets.
3. **Player freedom:** No required missions, energy currency, login, or progression gate in Sandbox Mode.
4. **Observable causality:** Events can be traced to pushes, forces, break thresholds, or agent decisions.
5. **Graceful performance:** Simulate less distant or inactive detail; do not silently erase user creations.
6. **Recoverability:** A badly broken build or corrupt import must not destroy the last valid saved world.

## 2. Existing baseline (verified from supplied v0.1 source)

The original v0.1 contains a single HTML/JavaScript game with Canvas rendering, an offline distributable, optional PWA shell, touch/pointer/mouse/keyboard controls, three preset scenes, ragdoll figures, boxes, balls, fixed anchors, ropes, springs, direct player controls, local one-slot saving, JSON export/import, and Eco/Standard/High settings. Its Verlet-like constraint solver runs at a nominal 60-Hz fixed step and caps catch-up steps. Boxes are axis-aligned (no rotation). The collision loop compares every pair of parts (`O(n²)`), so broad-phase collision indexing is the earliest performance upgrade. There is currently **no agent AI, material stress/damage model, hinges, motors, fracture, or named save slot system**.

Retain existing scene import compatibility, starter tools, visual style, and the single-file offline build as v0.2 is developed. Refactor implementation modules without requiring modern module loaders for the distributed artifact.

## 3. The four player activities (one simulation)

| Activity | Player can | Simulation does |
|---|---|---|
| **Build** | Place, rotate, resize, attach, configure, duplicate, freeze/unfreeze objects | Applies gravity and joint constraints if running, otherwise previews connectors |
| **Experiment** | Drag, push, change gravity, pause, single-step, reset, replay | Computes collisions, contacts, force, stress, and break events |
| **Inhabit** | Select any figure and control it, switch to follow camera | AI takes over unselected figures and reacts to persistent world events |
| **Observe** | Pan, zoom, inspect forces/contacts, follow an agent | Continues only active simulation near interactions; retains world state elsewhere |

A player may switch between activities without recreating a world. Paused editing and live editing both support undo for **edits**; physical motion itself is not initially a fully undoable operation.

## 4. World model and interfaces

**Scene:** `{schemaVersion, id, title, environment, bodyRecords[], jointRecords[], actorRecords[], materialRecords[], sceneRules, nextId}`. Every persistent object and constraint has a stable ID.

**Body:** position, previous/current velocity representation, angle (when rotation is supported), shape (circle/rectangle/capsule/segment), dimensions, material ID, dynamic/static flag, durability, collision mask, sleeping flag, and stable ID.

**Joint:** IDs of two bodies or body anchor points, type, geometric anchors, stiffness, rest length or angular limits, motor settings, break-force threshold, and stable ID. Kinds: rigid, rope, spring, hinge, motor/axle. A joint may fail only if its defined threshold is exceeded.

**Actor:** ID of a ragdoll group plus current controller (human or AI), pose/goal/state, attention target, last observed incident, and saved behavior parameters. Agents use ordinary body and joint records. Switching human control sets a controller reference; it does not replace the body with an animation puppet.

**Material:** normalized named presets with density, friction, restitution, impact tolerance, fracture behavior, and procedural visual pattern. Starter set: wood, metal, rubber, glass, generic. Values should be tuned as *game mechanics*, not marketed as physical engineering accuracy.

**Events:** `contact`, `impact`, `jointBroken`, `bodyDamaged`, `bodyDestroyed`, `actorObserved`, `actorChangedGoal`, `toolActivated`. Physics emits events; AI consumes them at its lower tick rate; the UI displays effects. Each event includes affected stable IDs, a simulation-tick number, event category, and bounded magnitude. Consumers must not mutate the physics arrays while collision pairs are being enumerated; queue structural changes for the next simulation boundary.

**Subsystem boundaries:**

- **SceneStore:** create/validate/migrate/save/load/export worlds; never executes game physics.
- **PhysicsCore:** advances bodies and constraints using fixed time steps; yields events; no DOM or UI dependencies.
- **DamageSystem:** converts measured stresses and impacts to part wear/fracture requests within budgets.
- **AgentBrain:** decides character intentions periodically; never directly teleports bodies.
- **Controller:** translates human input and AI intentions to the same legal force/actuator commands.
- **ToolSystem:** interprets build/grab/connect/erase mode, previews, valid placements, undoable edit commands.
- **CanvasRenderer:** renders world snapshots and optional diagnostics, with visual complexity caps.
- **ProfileManager:** chooses quality tiers from performance samples, stores user override, preserves simulation correctness.

### Compatibility and migration

A **v1 importer** transforms existing `parts/links/groups` to the new model. The adapter must preserve positions, shapes, anchor semantics, rope/spring rest lengths, and ragdoll node IDs, then validate references before replacing the active scene. All future serialized scenes are versioned. Original files remain readable; new saves never overwrite a source file on import.

## 5. Construction mechanics

Initial build palette: ground/fixed anchors, squares/rectangles, circles, beams, platforms, wheels, rope, spring, hinge, and powered axle. A second palette provides wood/metal/rubber/glass presets and controls for mass, friction, bounce, motor direction, and break strength. Snap-to-grid is optional (off by default); snap-to-joint occurs within a visible on-screen radius.

**Interaction rules:**

- Placement first shows a preview. Confirm by tap/click; cancel with Escape or Cancel.
- Connect tool first selects A, then B; invalid endpoints display a reason without consuming A.
- Fixed objects can be connected but do not move under applied force.
- Deleting a body removes or detaches its own invalid joints at the next simulation boundary; other bodies survive.
- Long-press or right-click opens a context palette: duplicate, pin/unpin, material, rotate, resize, motor, erase.
- Build operations are atomic editor commands so undo/redo changes topology, not elapsed physics.
- When paused, changes affect the frozen pose. When running, new objects spawn without overlapping nearby solids if a valid offset is available; otherwise show a placement collision warning.
- A locked or grouped construction moves as a unit only in editing mode; during simulation its bodies still obey joints and stress.

**Progression:** v0.2 rotation, angular collisions, hinges and first motor; v0.3 powered vehicles, switches and optional blueprints; v0.4 advanced contraptions and shareable blueprints.

## 6. Ragdoll and destruction rules

Figures use a compact articulated skeleton that can stand, walk, fall, balance imperfectly, and take external impulses. Keep a one-figure silhouette readable at low resolution. A figure's animation/locomotion commands apply forces or impulses consistent with the simulation; collapse and recovery use the same joints. The first character upgrade needs controller recovery, floor/ladder awareness, and realistic-enough foot contacts rather than complex muscle simulation.

**Destruction:** An impact produces a bounded damage impulse after collision resolution. Beams and joints accumulate stress according to their material. Repeated over-threshold load may break a joint; a high-energy collision may fracture a brittle body. Break events detach connected components, play an optional low-cost sound and minimal 2D particle burst, and produce budgeted debris. Small fragments are decorative when necessary and despawn after a bounded life; structural debris remains saved unless the player deletes it. A high-debris cap must prevent cascading explosions from freezing low-end devices.

**Safety of simulation:** Bodies have velocity and impulse caps; invalid/non-finite states are restored from last valid positions, and repeatedly unstable bodies are frozen with an unobtrusive warning. The solver never recursively spawns an unbounded chain of debris.

## 7. Living world behavior

All non-player figures are optionally autonomous. Initial actor personalities are parameter presets rather than separate AI implementations:

- **Explorer:** chooses nearby reachable points and investigates unusual motion or structures.
- **Builder:** transports/places a limited set of simple objects and attempts repair tasks when assigned.
- **Playful:** interacts with loose balls, buttons, and other harmless toys.
- **Cautious:** retreats from obvious moving hazards or structurally unstable areas.

**Common state machine:** `Idle → Observe → ChooseGoal → Navigate → Interact → Recover → Idle`. Explicit interrupts: `Hazard → Avoid`; `Fall → Recover`; `PlayerControl → SuspendedAI`. Each decision and transition has a short cooldown to prevent erratic behavior. The character brain runs at a coarse tick (recommend 2–5 decisions/s for active agents, less often for far-away figures), while the physics solver runs separately.

**Perception:** Cheap proximity query, near-field collision events, line-of-sight ray sample only when necessary, and a short memory of the last few salient incidents. No expensive per-frame omniscient planning. Offscreen figures sleep or follow simplified schedules; when activated, they resume from saved states rather than jumping to a falsely simulated future position.

**Navigation:** Initially walkable ground and platform connectivity, with simple local steering around obstacles. Rebuild a coarse connectivity graph only after topology changes, not every frame. Intelligent construction, cooperation, advanced path planning, and social reputation are future options rather than v0.2 promises.

**Player takeover:** Tap figure → **Control**; movement force commands replace the AI's intent while all collisions and joints remain active. **Release** restores AI intent after a brief grace interval. A figure can be a passive ragdoll if AI is disabled.

## 8. Input and interface contracts

### Desktop

Left click selects/places, drag grabs, right click opens object actions, mouse wheel zooms, middle drag or empty-space grab pans. `W/A/D` or arrows for active figure. Space jumps if controlling a figure, otherwise pauses. `P` pauses; `.` single-steps only while paused; `Ctrl+Z` undo edit; `Ctrl+Y` redo edit; Delete removes selection; Escape cancels current action.

### Touch

One finger taps/spawns/drags selected items, two fingers pan/zoom; long press opens object actions. Bottom toolbar exposes five frequently used tools, with a labeled expandable palette. When a figure is controlled, a prominent left/right/jump overlay replaces build shortcuts. Touch hit targets should be at least 44 × 44 CSS pixels wherever feasible, with a high-contrast alternative and an optional simplified UI.

### UI state constraints

- One active tool, one optional selected body/actor, and at most one unfinished connector.
- Switching tools cancels transient operations but never deletes a completed construction.
- UI displays the current quality profile, active body budget, paused/running state, and unsaved-change indicator.
- Show a clearly labeled confirmation before loading a scene that replaces unsaved changes.
- When the device cannot perform a feature (storage/export/installation), provide a textual explanation and allow continued play.

## 9. Performance and compatibility plan

**Platform baseline:** Canvas 2D, `requestAnimationFrame` with an older-browser fallback if needed, standard DOM events, and a JavaScript bundle compiled for the chosen legacy browser baseline. No required WebGL, WebGPU, WebAssembly, OffscreenCanvas, Web Worker, native app store, internet, or remote server. PWA install and offline cache are additive capabilities on secure HTTPS-hosted modern browsers.

**Physics:** Fixed 60-Hz nominal step with accumulator, at most 4 catch-up steps/frame; render rate may be 30 or 60 FPS independently. Run spatial-hash broad-phase against occupied cells to replace the current all-pairs collision enumeration; filter same-ragdoll neighbors and settled bodies. Solver iterations depend on quality tier, but rules and material thresholds remain consistent. Avoid tying physics to wall-clock frame rate.

**Conservative *starting targets* for profiling — not measured device guarantees:**

| Profile | Render target | Dynamic body cap | Joint cap | Active AI figures | Solver iterations | Canvas pixel ratio cap |
|---|---:|---:|---:|---:|---:|---:|
| Eco | 30 FPS | 48 | 100 | 3 | 3 | 1.0 |
| Standard | 60 FPS | 128 | 280 | 8 | 5 | 1.5 |
| High | 60 FPS | 280 | 600 | 18 | 7 | 2.0 |

Each stick figure in v0.1 consumes 14 **bodies**, so the figure caps above deliberately stay within each tier's body limit; structural objects further reduce available headroom. Display body utilization explicitly and show estimated remaining figure capacity. Fixed scenery is accounted separately but still constrained by collision/geometry storage and world caps. Auto mode starts conservatively, drops visual effects/pixel ratio first, then AI update rates and collision iterations within verified tolerances, and only reduces creation capacity for new objects; existing creations remain intact. Do not permanently reduce user-customized settings without consent.

**Active-area optimization:** Sleeping dynamic bodies skip updates until force/contact/nearby movement wakes them. Static geometry can be cached. Render only visible or near-visible bodies. A scene divided into zones can activate near-camera physics and agents while preserving saved offscreen positions and topology. **Do not pretend distant physics was fully simulated**; a distant static or sleeping area resumes from its last simulation state.

**Battery safeguards:** Pause or stop accumulating physics time when browser is hidden; resume without simulating huge wall-clock jumps. Limit expensive particle effects and avoid perpetual high-frequency AI scans. Test orientation changes and touch cancel paths.

**Distribution size goal:** Keep the dependency-free offline HTML under 250 KB if practical (a product target, not an existing result). Publish the same core as a static-hosted PWA with optional HTTPS service worker. Keep all nonessential sound, decorative themes, and advanced content optional. Do not promise operation on hardware lacking a functioning Canvas/JavaScript browser.

## 10. Saves, security, and error handling

- Support at least three named local scene slots plus portable JSON import/export; original v0.1 one-slot save remains migratable.
- Exported scenes are self-contained, versioned, and contain no executable scripts or references to remote resources.
- Parse into an isolated candidate world, validate node counts, numeric ranges, stable ID uniqueness, references, constraints, materials, and schema version **before** swapping the live scene.
- Unknown future schemas show an incompatibility notice without overwriting the current state. Corrupt files fail atomically.
- Save scene and editor state without persisting frame-to-frame temporary UI input, pointer capture, or network state.
- Provide an export action whenever local storage is blocked/full; never imply saving succeeded if it failed.
- Default is entirely on-device with no telemetry, chat, accounts, multiplayer, or online permissions.

## 11. Example emergent scenario

1. Player uses beams, hinges, and ropes to build a bridge above a small gap.
2. Player spawns two cautious agents and one explorer.
3. Explorer starts to cross. A cart is released from a ramp and strikes a support.
4. Impact propagates into a measurable joint stress event; the damaged joint breaks.
5. Bridge rotates under the remaining joints. The explorer ragdoll loses footing; cautious agents react to a nearby hazard event and turn away.
6. Player pauses, inspects the failed joint, repairs it, and resumes; all the same bodies and agents continue from the paused world.

The expected outcome is **plausible emergent behavior**, not guaranteed identical AI choices on every computer. If the impact is insufficient to break the support, it stays intact; this is desirable causal consistency.

## 12. Delivery sequence, dependencies, acceptance criteria

### Milestone A: One-world foundation (v0.2)

**Deliver:** SceneStore v2 + v1 importer, collision spatial hash, rotatable bodies, hinges, refined touch tools, named saves and old-browser bundle.

**Accept:** Existing v0.1 scene imports without missing figures/links; rectangle can rotate and collide with ground; hinge allows angular motion; no invalid object references after 100 delete/connect cycles; comparable crowded scenes show fewer narrow-phase collision checks than all-pairs baseline; mobile two-finger camera and touch cancellation function.

### Milestone B: Destruction and machines (v0.3)

**Deliver:** Motorized axle, adjustable material presets, stress/break events, capped fragment generation, vehicle blueprint, one-step diagnostic overlay.

**Accept:** Structural damage correlates with force and material threshold; fragile joints fail while stronger joints survive equivalent scenarios; broken pieces remain physically interactive; sustained impact storms respect object and debris caps; pause/single-step changes topology only at safe simulation boundaries.

### Milestone C: Living inhabitants (v0.4)

**Deliver:** AI state machine, four personality presets, local hazard sensing, walkable platform graph, player takeover/release, AI serialization and performance throttling.

**Accept:** Spawn three figures, observe distinct goal choices; figures react to hazard events; player can assume/release control without resetting their bodies; save/restore preserves agent controller state and goal; sleeping agents do not burn CPU while offscreen; Eco scene remains responsive under the agreed test matrix.

### Validation matrix and quality gates

- Test touch Android browser, a modern desktop browser, and at least one older Canvas-capable browser when available; do not claim hardware compatibility from desktop emulation alone.
- Test all quality profiles against an empty world, a stack of 50 bodies, and a mixed world with moving agents, constraints, and breakable beams.
- Measure median and 1% low frame rate, physics time per step, peak object count, and memory use on test hardware; revise caps after measurement.
- Verify no script or content downloads are required for the standalone file; verify install/offline caching separately over HTTPS.
- Test reload after storage refusal, malicious/corrupt JSON, schema migration, pause/resume after tab hide, excessive impulses, and mobile browser resize.

## 13. Non-goals for the initial living-world release

No fully simulated infinite world, GPU requirement, photorealism, multiplayer sync, server AI models, voice chat, real-money economy, or complex combat. A physics toy must stay useful with **all character AI disabled**. Online sharing, programmable logic gates, chemistry, electricity, combat, and city-scale society are possible later modules and must not block the minimal complete sandbox.

## 14. Adopted product defaults and later validation

1. **Mood:** Friendly and comedic by default, or include an optional darker/destruction-focused setting?
2. **Agent persistence:** Should inhabitants have simple named identities and recollections, or remain replaceable sandbox toys in the first AI milestone?
3. **Minimum supported hardware:** Browser capability based is the proposed contract; naming an exact minimum Android/iOS/desktop OS will require physical-device testing.

**Approved defaults:** Friendly/comedic tone; named inhabitants with lightweight memories; ability to switch off AI; browser-capability-based support with Eco mode. These remain proposed behavior until implemented. Physical-device tests will determine minimum practical hardware support.