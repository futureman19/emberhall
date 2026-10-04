# Emberhall Creator Sandbox Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Give Emberhall Roblox-like freedom to build, craft, customize, share, and eventually create playable experiences while preserving Emberhall’s UO-style embodied sandbox and warm, low-poly Guild Maker aesthetic.

**Architecture:** Evolve the current one-building-per-kind system into a data-driven placeable/structure/blueprint model. Begin local-first with a polished single-player “Hearthwright” vertical slice, then add sharing and authoritative multiplayer only after the object model, save migrations, permissions, and performance budgets are stable. Player freedom comes from recombining curated Emberhall primitives—not from arbitrary meshes, unrestricted colors, or untrusted JavaScript.

**Tech Stack:** React 19, Three.js / React Three Fiber, Zustand, TypeScript, localStorage save migrations, Node test runner, Playwright browser smoke; later, authenticated cloud persistence and an authoritative realm service for shared worlds.

---

## 1. Product thesis

Do not try to clone Roblox’s catalog, avatars, or visual language. Copy its **capability ladder**:

1. **Make:** place and combine pieces quickly.
2. **Personalize:** recolor, furnish, dress, name, and tune what was made.
3. **Save and reuse:** turn a structure into a blueprint.
4. **Share:** publish or trade a blueprint and visit another hold.
5. **Collaborate:** build together with explicit permissions.
6. **Create play:** connect safe, bounded rules to objects so a player can make a workshop, inn, arena, maze, market, or quest—not execute arbitrary code.

Emberhall’s differentiator is that building remains part of the world simulation:

- The player has a body, location, pack, skills, risk, and time.
- Materials are harvested and crafted; creation is not a disconnected editor inventory.
- Structures have functions: shelter, storage, beds, work surfaces, doors, heat, light, trade, farming, defense.
- Craftsmanship and maker marks matter.
- A hold should look handmade and coherent rather than infinitely skinned.

**Working feature name:** **Hearthwright** for the building discipline, with **The Hold** remaining the diegetic UI entry point.

---

## 2. Current-state audit

### Strong foundations already present

- `src/game/types.ts`
  - Persistent `World`, `Building`, inventory, equipment, crops, campfires, rare items, skills, and snapshots already exist.
  - `ResourceTag` makes recipes material-aware instead of hard-coding every input.
- `src/game/craft.ts`
  - Data-driven recipes, stations, skill checks, batch work, exceptional results, and maker marks are already implemented.
- `src/game/catalog.ts`
  - Central metadata for items, resources, buildings, skills, and prices.
- `src/game/store.ts`
  - Existing build-arming, hover, placement, crafting, and UI command boundaries can be evolved rather than replaced wholesale.
- `src/game/world.ts` and `src/game/building-size.ts`
  - Placement validation, costs, collision checks, and building creation already form a small vertical slice.
- `src/components/game/building-meshes.tsx`
  - Buildings are already generated from 0.5-unit voxel-like pieces, instanced by material, with transparent placement ghosts and interior roof cutaway.
- `src/components/game/hud.tsx`
  - “The Hold” is already a diegetic build menu.
- `src/components/game/craft-gump.tsx`
  - Crafting is already grouped by workstation and reads from recipe data.
- `src/game/save.ts`
  - Explicit sequential save migration support now exists; use it for every creator-data schema change.
- `scripts/browser-smoke.mjs`
  - Desktop/mobile Playwright screenshots and runtime-error checks already exist.

### Limits that must be removed deliberately

- `Building` stores only `id`, `kind`, position, and beds; there is no rotation, variant, material, ownership, permissions, component state, parent structure, or custom name.
- `siteError()` allows only one building of each kind and charges flat gold. This blocks expressive construction and makes materials irrelevant to building.
- Building geometry and its footprint are duplicated between private `SPECS` in `building-meshes.tsx` and `BUILD_SIZE` in `building-size.ts`.
- Whole buildings are the smallest build unit; players cannot furnish, assemble, move, rotate, reclaim, or revise.
- Crafting recipes are data-driven but item IDs are a closed TypeScript union and all recipes live in one file.
- Persistence is local-only. This is correct for the first phase, but cannot support durable shared realms or creator publishing by itself.
- `src/lib/multiplayer/p2p.ts` is infrastructure, not an integrated game mode. Its client-authoritative full mesh is unsuitable as the source of truth for persistent public worlds, economies, permissions, or moderation.
- Current working tree has unrelated changes in `README.md`, `package.json`, `src/game/save.ts`, and `src/game/save.test.ts`. Preserve them; do not reset, overwrite, or mix them into the first implementation commit.

---

## 3. Aesthetic constitution

Every creator feature must pass these constraints.

### Visual grammar

- **Grid:** retain the existing `0.5` world-unit building module from `building-meshes.tsx`; expose 0.5, 1, and 2-unit snap modes, never free-floating by default.
- **Materials:** start with the existing palette: timber, dark timber, cobble, red wool, muted gold, glass, thatch, pale stone, coal, soil, and leaf.
- **Color freedom:** use curated dye families—ember red, soot, moss, flax, bone, iron, ochre, faded blue—with 3–5 restrained values each. No full RGB picker in normal play.
- **Silhouette:** chunky, readable modules; broad roof planes, oversized lintels, faceted props, visible craft joints. Avoid thin photorealistic pieces.
- **Surface:** high roughness, limited metalness, no PBR asset-pack mismatch, no neon except magical effects.
- **Scale:** door, bed, table, chest, and workbench dimensions derive from the current avatar and voxel module.
- **Lighting:** player pieces use the same tone mapping, weather response, shadow rules, and night readability as the authored world.

### Diegetic creator language

- Build mode is **The Hold**, not “Studio.”
- Catalog categories: **Frames, Roofs, Doors, Hearths, Work, Keeping, Comfort, Signs, Garden**.
- Commands: **Set, Turn, Shift, Copy, Reclaim, Mark as Blueprint**.
- Object rules are **Runes** or **Mechanisms**, not scripts.
- Validation text stays physical: “No footing,” “The doorway is blocked,” “This roof has no support.”

### Coherence controls

- Player-created content may combine approved primitives and parameters only.
- Imported meshes/textures are out of scope until there is a reviewed asset pipeline, moderation, LOD generation, collision validation, and strict size/material limits.
- Arbitrary executable JavaScript/Lua is out of scope. Later creator logic uses a bounded declarative graph or rune system with an allowlist of triggers/actions.
- Published blueprints store definition IDs and parameters, never raw executable code.

---

## 4. Target object model

Replace the overloaded whole-building record with four layers.

### Definitions (static, versioned content)

Create `src/game/placeables/`:

- `types.ts` — `PlaceableDefinition`, `Footprint`, `SnapPoint`, `PlaceableFunction`, `MaterialSlot`, `PlacementRule`.
- `catalog.ts` — curated placeable definitions and category indexes.
- `kits/emberhall.ts` — walls, posts, floors, roof sections, doors, windows, furniture, stations, storage, signs, farm pieces.
- `materials.ts` — approved material/dye tokens mapped to the existing palette.

Each definition includes:

- stable ID and schema version;
- category, label, description, tags;
- voxel/procedural geometry recipe;
- footprint/collision shape;
- valid rotations and snap points;
- material slots and allowed palettes;
- resource cost and required skill/station;
- optional gameplay functions such as `door`, `bed`, `storage`, `craftStation`, `light`, `sign`, `vendor`, or `spawnPoint`;
- render/performance cost score.

### Instances (saved player objects)

Add to `src/game/types.ts`:

```ts
interface PlacedObject {
  id: string;
  definitionId: string;
  definitionVersion: number;
  tx: number;
  ty: number;
  level: number;
  rotation: 0 | 1 | 2 | 3;
  materialSlots: Record<string, string>;
  ownerId: string;
  structureId: string | null;
  name: string | null;
  state: Record<string, unknown>;
}
```

Do not leave `state` unvalidated in persisted or network input. Each functional component must own a Zod schema or explicit validator and default migration.

### Structures (grouping and permissions)

```ts
interface Structure {
  id: string;
  name: string;
  ownerId: string;
  objectIds: string[];
  anchor: { tx: number; ty: number };
  permissions: {
    visit: "private" | "friends" | "public";
    use: "owner" | "members" | "visitors";
    build: "owner" | "members";
  };
  revision: number;
}
```

### Blueprints (portable recipes)

```ts
interface Blueprint {
  id: string;
  version: number;
  name: string;
  author: string;
  bounds: { w: number; d: number; h: number };
  objects: BlueprintObject[];
  billOfMaterials: ResourceRequirement[];
  tags: string[];
  thumbnail?: string;
}
```

Blueprint application is transactional: validate all pieces, permissions, bounds, and total resources before consuming anything or placing any object.

### Compatibility bridge

Keep legacy `Building` records temporarily. Add a save migration that maps each current building to either:

- a locked legacy structure definition, or
- a generated structure containing equivalent kit pieces.

Prefer the locked legacy definition for the first migration; converting every old building to editable pieces immediately is higher risk and unnecessary for the MVP.

---

## 5. The first shippable vertical slice: Hearthwright v1

### Player promise

A player can harvest timber and stone, craft a **builder’s mallet**, open **The Hold**, and make a small personalized workshop from Emberhall pieces. They can place, rotate, move, recolor within the approved palette, add a door, chest, bench, hearth, sign, and bed, undo mistakes, leave the game, and return to the same intact workshop.

### Piece set

Ship only enough to prove the system:

- 2 floors;
- 3 wall pieces (solid, window, doorway);
- 2 roof pieces (slope, ridge/end);
- post/beam/fence;
- door;
- chest;
- workbench;
- hearth;
- bed;
- table/stool;
- sign;
- planter.

### Tool behavior

- Catalog preview with search/filter later; category tabs now.
- Gold placement ghost when valid, ember/rust when invalid.
- Rotate in 90° steps.
- Move existing object without paying again.
- Copy costs resources and creates a new instance.
- Reclaim refunds 75% of base materials; never convert crafting failures into free duplication.
- Undo/redo covers the current build session and restores exact inventory deltas.
- Selection outline, footprint, doorway direction, snap-point hints, and plain-English error.
- Keyboard and pointer controls; touch gets large rotate/confirm/cancel controls.
- Build mode pauses personal movement intent but does not freeze world simulation unless the player explicitly pauses time.

### Acceptance criteria

1. Build at least a 4×4 enclosed workshop with roof, door, bed, chest, and bench.
2. Walk through the door; roof cutaway still works.
3. Use the chest, bench, hearth, and bed through the same world interaction model as authored structures.
4. Save/reload without object loss, duplication, transform drift, or material reset.
5. Undo/redo 20 mixed set/move/rotate/reclaim operations without inventory drift.
6. No placement inside water, walls, pits, blocked doorways, authored structures, or another placed object’s collision volume.
7. Desktop and 390px mobile layout remain usable with no horizontal overflow.
8. A representative 250-piece hold stays within the frame/render budget below.

---

## 6. Phased roadmap

### Phase 0 — Stabilize the foundation (1–2 implementation cycles)

**Outcome:** one canonical definition/footprint source and safe save evolution.

1. Extract the existing `SPECS` geometry data from `building-meshes.tsx` into shared, renderer-agnostic definitions.
2. Make collision/footprint queries consume the same definitions.
3. Add build-specific unit tests before changing behavior.
4. Complete and merge the in-progress save-migration work separately.
5. Establish a creator-data schema version and migration fixtures.
6. Capture desktop/mobile visual baselines of title, normal play, The Hold, and placement ghost.

### Phase 1 — Hearthwright v1 local-first (3–5 implementation cycles)

**Outcome:** modular single-player construction and furnishing.

1. Add the placeable/material catalogs and instance types.
2. Add atomic build commands and a session undo/redo journal.
3. Add a new build-mode Zustand slice or isolated store module; do not continue growing the monolithic `GameUI` interface indefinitely.
4. Render static placeables through shared instancing by geometry/material; render interactive pieces as sparse components.
5. Replace the one-of-each list with category-based Hold inventory.
6. Add rotate/move/copy/reclaim, touch controls, keyboard shortcuts, snapping, and selection.
7. Wire door, storage, bed, hearth, bench, and sign functions.
8. Add save migration and round-trip tests.
9. Tune resource costs and carpentry/smithing progression through playtesting.

### Phase 2 — Deep customization and blueprints (2–4 cycles)

**Outcome:** player identity and reusable creations.

1. Add curated dyes/material variants for structures, equipment cloth, banners, signs, and furniture.
2. Add structure naming and owner maker-mark plaques.
3. Add blueprint capture, bill of materials, local library, preview ghost, and transactional placement.
4. Add blueprint export/import as signed/versioned JSON for trusted testing before any public catalog.
5. Add thumbnail capture from a fixed isometric camera.
6. Add starter blueprints: hunter’s lean-to, smithy, roadside stall, herb garden, small hall.

### Phase 3 — Visiting, publishing, and collaboration (multiple releases)

**Outcome:** controlled social creation.

1. Add accounts only when cross-device saves, publishing, ownership, or shared worlds are intentionally enabled.
2. Add server-side schemas and authoritative storage for structures, blueprints, revisions, permissions, and moderation state.
3. Start with asynchronous **visit a snapshot** worlds; this is much simpler and safer than synchronous co-building.
4. Add publishing with title, description, tags, thumbnail, version, report state, and immutable revision history.
5. Add invite-only co-building with owner/member/visitor permissions and server-validated commands.
6. Add optimistic client previews but authoritative server commits with revision checks.
7. Add rollback/audit history for grief recovery.
8. Only then add economy/marketplace behavior; never trust P2P clients for scarcity, ownership, resource spending, or paid transfers.

### Phase 4 — Safe creator logic (“Runes and Mechanisms”)

**Outcome:** players can make activities, not merely houses.

Start with a small declarative graph:

- triggers: interact, enter area, time, object opened, item deposited, creature defeated;
- conditions: has item/tag, skill threshold, time/weather, permission, counter value;
- actions: open/close, light/extinguish, show text, update counter, grant locally scoped objective, spawn from approved table, play approved sound/effect;
- limits: graph size, execution count per tick, spawn count, recursion depth, storage bytes, network events.

Ship templates before a blank graph editor: locked door and key, timed arena, delivery chest, shop stall, scavenger trail, inn room, simple dungeon gate.

Do not expose arbitrary code, network requests, file access, DOM access, wallet access, or unrestricted asset URLs.

---

## 7. Concrete implementation sequence

### Task 1: Add regression tests around the current whole-building system

**Files:**
- Create: `src/game/building-size.test.ts`
- Create: `src/game/building-placement.test.ts`
- Modify: `package.json` test list

**Tests:**
- canonical footprint dimensions for every current `BuildingKind`;
- overlap at edges/corners;
- water/wall/pit rejection;
- one-of-each legacy rule;
- exact gold debit and dorm/farm side effects;
- no mutation after failed placement.

**Verify:** run the two targeted tests, then `npm run check`.

### Task 2: Create the shared definition layer

**Files:**
- Create: `src/game/placeables/types.ts`
- Create: `src/game/placeables/materials.ts`
- Create: `src/game/placeables/legacy-buildings.ts`
- Modify: `src/components/game/building-meshes.tsx`
- Modify: `src/game/building-size.ts`

Move geometry, bounds, enterability, materials, and cutaway metadata into shared definitions. Rendering and collision must query the same object.

**Verify:** existing screenshots should be visually unchanged; existing placement tests remain green.

### Task 3: Add creator instance and save schemas

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/save.ts`
- Modify: `src/game/save.test.ts`
- Create: `src/game/placeables/schema.ts`
- Create: `src/game/placeables/schema.test.ts`

Add `placedObjects`, `structures`, and `blueprints` to `World`, default them for legacy saves, reject malformed future versions, and validate every persisted functional state.

**Verify:** v0/v1 legacy fixtures load; new saves round-trip; future/corrupt saves fail closed without throwing.

### Task 4: Add the Hearthwright kit

**Files:**
- Create: `src/game/placeables/kits/emberhall.ts`
- Create: `src/game/placeables/catalog.ts`
- Create: `src/game/placeables/catalog.test.ts`

Define the initial 15–20 pieces, stable IDs, allowed rotations, footprints, snap points, material slots, costs, skills, functions, and performance weights.

**Verify:** a catalog invariant test confirms unique IDs, valid material references, nonnegative costs, legal rotations, valid footprints, and bounded geometry counts.

### Task 5: Implement pure placement and resource transactions

**Files:**
- Create: `src/game/placeables/placement.ts`
- Create: `src/game/placeables/placement.test.ts`
- Create: `src/game/placeables/commands.ts`
- Create: `src/game/placeables/commands.test.ts`

Commands: `canPlace`, `placeObject`, `moveObject`, `rotateObject`, `copyObject`, `reclaimObject`, `setObjectMaterial`, and `renameStructure`.

Rules must be pure or transaction-like: validate first, mutate once, and return typed results. Every failure test must assert world and inventory are unchanged.

### Task 6: Add undo/redo with inventory integrity

**Files:**
- Create: `src/game/placeables/history.ts`
- Create: `src/game/placeables/history.test.ts`

Store inverse commands and exact before/after resource deltas for the active build session. Bound history length (default 100) and clear it on world load/new hall.

**Verify:** randomized mixed-command test returns world and inventory to the starting hash after undo-all, then restores the final hash after redo-all.

### Task 7: Isolate build UI state

**Files:**
- Create: `src/game/build-mode.ts`
- Modify: `src/game/store.ts`
- Modify: `src/game/world-pointer.ts`
- Modify: `src/components/game/world-scene.tsx`

State: mode, selected definition/instance, hovered transform, rotation, material choices, snap level, validity reason, history state. Keep game simulation data in `World`; keep transient creator UI outside saves.

**Verify:** entering/exiting build mode never changes the save; pointer cancellation cannot accidentally place a piece.

### Task 8: Render scalable modular placeables

**Files:**
- Create: `src/components/game/placeables/placeable-meshes.tsx`
- Create: `src/components/game/placeables/placeable-preview.tsx`
- Create: `src/components/game/placeables/selection-outline.tsx`
- Modify: `src/components/game/world-scene.tsx`
- Modify: `src/components/game/building-meshes.tsx`

Batch static modules by geometry/material with instancing. Interactive components get separate lightweight meshes only when required. Selection/preview helpers must not receive normal world raycasts.

**Verify:** 250 static pieces do not create 250 independent materials or React subtrees; capture frame-time and draw-call evidence in the plan handoff.

### Task 9: Replace The Hold panel with the Hearthwright catalog

**Files:**
- Create: `src/components/game/build/hold-gump.tsx`
- Create: `src/components/game/build/build-toolbar.tsx`
- Create: `src/components/game/build/material-picker.tsx`
- Create: `src/components/game/build/object-inspector.tsx`
- Modify: `src/components/game/hud.tsx`

Desktop and touch UI must expose category, piece, rotate, move, copy, reclaim, undo, redo, confirm, cancel, and error reason without obscuring the placement area.

**Verify:** keyboard-only and pointer-only flows can each complete the vertical slice; mobile has no horizontal overflow and all targets meet the existing touch sizing style.

### Task 10: Wire gameplay functions to placed components

**Files:**
- Create: `src/game/placeables/functions.ts`
- Create: `src/game/placeables/functions.test.ts`
- Modify: `src/game/craft.ts`
- Modify: `src/game/context.ts`
- Modify: `src/game/pathfinding.ts`
- Modify: `src/components/game/context-menu.tsx`

Doors affect navigation; bench/hearth satisfy stations; bed offers rest; chest owns validated storage; sign owns bounded text; planter integrates with crops. Reuse existing verbs and station semantics where possible.

**Verify:** every function has a direct unit test and one integrated Playwright path.

### Task 11: Add blueprint capture and transactional application

**Files:**
- Create: `src/game/blueprints.ts`
- Create: `src/game/blueprints.test.ts`
- Create: `src/components/game/build/blueprint-gump.tsx`
- Modify: `src/game/save.ts`

Normalize objects relative to an anchor, compute bounds and bill of materials, preview as one ghost, validate all pieces before spending, and place atomically.

**Verify:** partial collisions or insufficient materials place nothing and spend nothing; rotated blueprints preserve doorway/snap relationships.

### Task 12: Add creator visual/runtime QA

**Files:**
- Modify: `scripts/browser-smoke.mjs` or create a focused `scripts/creator-smoke.mjs`
- Create: `src/game/placeables/perf.test.ts` if a deterministic budget can be asserted without fragile GPU timing
- Update: `README.md` only after the feature is real

Playwright flow:

1. start a fresh hall;
2. obtain/use test materials through a dev-only deterministic fixture, never production cheats;
3. open The Hold;
4. place floor, walls, window, door, roof, bed, chest, bench, hearth, sign;
5. rotate/move/reclaim/undo/redo;
6. reload;
7. walk inside and use functional pieces;
8. collect desktop/mobile screenshots, console errors, page errors, overflow, and save-state assertions.

**Final gate:** `npm run check`, then Playwright creator smoke on desktop and mobile, then manual screenshot inspection.

---

## 8. Performance budgets

Initial budgets for a normal player hold:

- 250 placed pieces in the loaded hold without visible interaction lag on a mid-range laptop;
- static pieces batched by geometry/material, targeting fewer than 80 creator-related draw calls in the representative scene;
- no unique `Material` per object;
- capped transparent preview geometry;
- creator save payload target below 1 MB before thumbnails;
- bounded sign text and component state;
- spatial query/index for collision and selection before supporting thousands of objects;
- far holds or shared-world snapshots use structure-level culling/LOD, not per-piece always-on React trees.

Treat these as measurable release gates, not aspirational notes. Adjust only with captured browser/GPU evidence.

---

## 9. Multiplayer, security, and moderation boundaries

### Recommended progression

1. local private holds;
2. shareable blueprint files with explicit import confirmation;
3. server-hosted blueprint catalog;
4. asynchronous read-only visits;
5. invite-only co-building;
6. public worlds and economy.

### Hard rules

- Validate all network/imported creator data against server-owned definitions.
- Server checks ownership, permission, bounds, revision, resources, and rate limits for every shared-world mutation.
- Never let clients choose prices, balances, ownership, or paid-transfer outcomes.
- Blueprint revisions are immutable; updates publish a new revision.
- Keep audit logs and owner rollback points.
- Rate-limit placement, deletion, naming, publishing, invites, and reports.
- Filter names, signs, blueprint text, thumbnails, and tags; give users mute/block/report controls before public discovery.
- Cap pieces, lights, emitters, logic nodes, spawns, storage, and update frequency per structure/realm.
- Keep 1Sat/Vault assets optional and downstream of safe game-state ownership; do not put blockchain ownership in the critical path of basic building.

### Why not use the current P2P layer as authority

`src/lib/multiplayer/p2p.ts` can be useful later for low-stakes transient presence or movement. It is client-authoritative and full-mesh, so it should not adjudicate persistent structures, resource spending, permissions, public content, trading, or grief recovery.

---

## 10. Explicit non-goals for the first three phases

- No arbitrary user code.
- No user-uploaded meshes, textures, audio, or remote asset URLs.
- No Roblox-like avatar proportions or bright plastic visual style.
- No giant public marketplace before blueprint versioning and moderation.
- No synchronous MMO-scale world.
- No procedural “everything editor.” Terrain sculpting waits until structure placement is stable.
- No NFT requirement for creating, saving, sharing, or using normal pieces.
- No replacement of embodied harvesting/crafting with a separate unlimited creative inventory in the core mode. A dev/test sandbox can exist behind a non-production flag.

---

## 11. Release gates and success measures

### Quality gates

- Zero save-loss regressions across migration fixtures.
- Atomic commands: no resource or object mutation after any rejected operation.
- No visual drift in authored legacy buildings after shared-definition extraction.
- No inaccessible creator action on desktop, touch, or keyboard.
- Runtime smoke has zero page errors/console errors and no horizontal overflow.
- Representative hold meets draw-call/frame responsiveness targets.

### Product measures

For internal playtests, measure:

- time to place the first valid object;
- time to complete a functional shelter;
- percentage of testers who discover rotate, move, undo, and reclaim without instruction;
- number of materially different structures made from the same starter kit;
- percentage of crafted pieces that are actually placed/used;
- save/reload confidence and reported loss;
- blueprint reuse rate once Phase 2 exists.

The key signal is not raw piece count. It is whether players create **different useful places** that still unmistakably look like Emberhall.

---

## 12. Risks and decisions

1. **Scope explosion** — Roblox-level freedom is a platform, not one feature. Ship the capability ladder one rung at a time.
2. **Aesthetic dilution** — solve with curated kits/material slots and definition validation, not post-hoc moderation alone.
3. **Performance collapse** — solve with shared definitions, instancing, spatial indexes, and budgets before thousands of pieces.
4. **Save fragility** — all creator fields require explicit versions, migrations, defaults, and round-trip fixtures.
5. **Duplicated economy state** — all commands must validate then apply atomically; undo/redo records exact deltas.
6. **Monolithic store growth** — isolate build-mode state and pure commands instead of adding dozens more fields to `store.ts`.
7. **Multiplayer cheating/griefing** — shared persistent state becomes server-authoritative; P2P is presence-only.
8. **Over-tooling before fun** — the first release proves one beautiful functional workshop, not a general game engine.

### Default decisions to proceed without blocking

- Core mode remains survival/economy-based; no unlimited creative inventory.
- Existing whole buildings remain as legacy locked structures during the first migration.
- Curated materials and 90° rotation only for v1.
- Build pieces are created from resources through Hearthwright commands, with carpentry/smithing governing quality and unlocks.
- Local-first through Phase 2; accounts/cloud are introduced only for publishing and cross-device/shared-world requirements.
- Safe declarative runes, never arbitrary scripts.

---

## 13. Recommended first milestone

Implement **Phase 0 plus Tasks 1–4**, then stop for a reviewed playable prototype containing only floor, wall, doorway, roof, door, chest, and bench. Validate the data model, save migration, aesthetic fit, instancing strategy, and placement feel before building the rest of the kit.

That milestone is the cheapest point to correct the architecture while still producing something visibly more flexible than the current one-building-per-kind Hold.

---

## 14. Gem-forged advanced crafting

### Design principle

Separate **ordinary manufacture** from **intentional rare manufacture**.

- A normal bow is predictable: `5 wood + 1 cloth` at a bench produces a mundane, stackable bow.
- A gem-forged bow uses the same base bill plus one or more rare gems. It becomes a singular `RareItem` with deterministic gem-derived attributes, full material provenance, a maker's mark, and optional Vault eligibility.
- Ordinary crafting should not randomly create magic. High skill may produce non-magical **fine** or **exceptional** workmanship, but magical attributes come from explicit rare catalysts. This keeps rare-item scarcity legible and makes player choices—not hidden dice—the source of the item's identity.

### Gem families and attribute identity

Start with five readable families:

| Gem | Attribute family | Example weapon effect | Example armor/jewelry effect |
|---|---|---|---|
| Ruby | Power | bonus damage | strength or physical vigor |
| Sapphire | Fortune | luck / improved quality odds | fortune or discovery |
| Emerald | Precision | accuracy or critical control | dexterity or evasion |
| Amethyst | Arcana | spell potency or mana efficiency | magery or resistance |
| Diamond | Warding | armor penetration resistance | armor or protection |

Every gem family maps to one affix group. An item may never receive two affixes from the same group. Applicability is explicit per item class so nonsensical combinations fail before consuming materials.

### Gem quality ladder

Use a five-step clarity ladder aligned with the existing rank I–V affix system:

1. **Cracked** — rank I
2. **Flawed** — rank II
3. **Cut** — rank III
4. **Flawless** — rank IV
5. **Perfect** — rank V

The family determines **what** the item gains; clarity determines **how much**. A flawed ruby always produces a low-rank Power property. A flawless sapphire always produces a high-rank Fortune property. The player sees the exact projected result before confirming.

Allow a lapidary/fusion recipe to combine multiple gems of one family and clarity into the next clarity. The exact ratio must be tuned from measured acquisition rates; it must be data-driven rather than embedded in UI code.

### Workmanship and socket capacity

Workmanship and magic are separate axes:

- **Mundane:** ordinary base stats, stackable when otherwise identical.
- **Fine:** small non-magical base-stat or durability improvement, singular.
- **Exceptional:** stronger bounded workmanship bonus plus maker's mark, singular.
- **Gem-forged:** one or more deterministic magical affixes, always singular; it may also be fine/exceptional.

Skill controls craft access, base success, workmanship, and safe inlay capacity—not the gem's identity:

- novice recipes accept no gems;
- trained crafters can make one-inlay items;
- masters can make two-inlay items;
- the rarest three-inlay work requires a top-tier station, high skill, and an exceptional base.

Do not gamble ultra-rare gems behind an opaque destruction roll. Recommended flow:

1. Craft the base item.
2. Inspect its workmanship and available inlay slots.
3. Add gems at the proper station.
4. Preview exact resulting attributes and fees.
5. Confirm one atomic transaction.

A rejected or interrupted inlay changes nothing. If inlay failure is ever added, show exact odds and failure consequences and never allow a client reload to duplicate the gem.

### Data model

Extend `RareItem` instead of creating a second unique-item system:

```ts
interface CraftedMaterial {
  item: ItemId;
  amount: number;
  role: "body" | "binding" | "edge" | "lining" | "inlay";
}

interface GemInlay {
  family: GemFamily;
  clarity: GemClarity;
  affixId: string;
  rank: 1 | 2 | 3 | 4 | 5;
}

interface RareItem {
  uid: string;
  base: ItemId;
  workmanship: "mundane" | "fine" | "exceptional";
  materials: CraftedMaterial[];
  inlays: GemInlay[];
  affixes: string[];
  maker?: string;
  recipeId: string;
  recipeVersion: number;
  seed: number;
  hour: number;
}
```

Save migrations must default legacy rares to `workmanship: "exceptional"`, empty `materials`/`inlays`, and a legacy recipe/version marker without changing their existing stats.

### Crafting architecture changes

Refactor the current `rollExceptional()` path in `src/game/craft.ts` and `src/game/rare.ts`:

- `Recipe` gains a typed base-material bill, output class, allowed optional inlays, and recipe version.
- Base crafting creates either a stackable mundane output or a singular workmanship item.
- A new pure inlay command validates ownership, station, item class, free slots, duplicate affix groups, and gem availability before mutation.
- Affix generation receives an explicit source (`loot`, `workmanship`, `gem`) and records provenance.
- Gem-derived affixes are deterministic from family + clarity + item class.
- Loot rares may continue to roll, but crafted magical items never use an unrelated random affix pool.

Suggested files:

- Create: `src/game/gems.ts`
- Create: `src/game/gems.test.ts`
- Create: `src/game/inlay.ts`
- Create: `src/game/inlay.test.ts`
- Create: `src/components/game/inlay-gump.tsx`
- Modify: `src/game/types.ts`
- Modify: `src/game/catalog.ts`
- Modify: `src/game/craft.ts`
- Modify: `src/game/rare.ts`
- Modify: `src/game/iteminfo.ts`
- Modify: `src/components/game/craft-gump.tsx`
- Modify: `src/components/game/item-tip.tsx`
- Modify: `src/game/save.ts`
- Modify: `src/game/vault.ts`

### Material identity: timber, metal, cloth, and stone

Gems should add magical properties, while ordinary materials determine the item's physical character. Keep the layers distinct:

```text
final item = base form + workmanship + material traits + gem inlays
```

Examples:

- a redwood bow is naturally more accurate;
- an ironwood bow hits harder and lasts longer but draws more slowly;
- a yew bow favors range or arcane compatibility;
- a common-oak bow is balanced and inexpensive;
- a highland-steel sword holds an edge;
- a moon-silver weapon favors undead or magical foes;
- an Emberhall-original ultra-rare ore can fill the role Valorite filled in UO without copying its name or palette directly.

Materials should use bounded, fixed traits rather than rolling affixes. A redwood bow always expresses the redwood accuracy trait. The recipe preview shows that trait before crafting.

#### Recommended first material families

**Timber**

| Material | Identity | Tradeoff |
|---|---|---|
| Common oak | balanced baseline | no specialty |
| Ashwood | light / quick handling | lower durability |
| Redwood | accuracy | lower raw power |
| Ironwood | power / durability | heavier or slower |
| Yew | range / arcane affinity | difficult to work |

**Metal**

| Material | Identity | Tradeoff |
|---|---|---|
| Iron | balanced baseline | no specialty |
| Bronzework | durability / low skill access | lower peak damage |
| Highland steel | damage / edge | higher smithing requirement |
| Moon-silver | magical-creature affinity | softer or costly repair |
| Emberite | top-tier bounded potency | extremely scarce, hard to work |

These names and values are starting points; use Emberhall-original lore names in the final catalog. Rare materials should often specialize rather than dominate every stat, so the best material depends on the intended item.

#### Recipe material roles

Recipes declare semantic roles instead of accepting an undifferentiated resource pile:

- bow: `body: 5 wood`, `binding: 1 cloth`;
- sword: `edge: metal`, `hilt: wood`, `binding: cloth/leather`;
- armor: `plate: metal`, `lining: cloth/leather`;
- building piece: `frame: wood/stone`, `finish: cloth/metal`.

Each role states which material traits it contributes. Five redwood used as a bow body may grant accuracy; one redwood used only as a sword hilt must not grant the full bow-body bonus.

The crafting UI must let the player choose exact material stacks. The current cheapest-first tag consumption in `src/game/craft.ts` is acceptable for campfires and bulk utility work, but not for intentional equipment crafting: it could silently consume rare redwood or Emberite. Preview and confirmation must show the selected species/ore and exact quantities.

If mixed materials are permitted, use an explicit **mixed** output with a defined baseline—not an average that players can exploit with one rare unit. Rare or NFT-eligible equipment should require a coherent primary material batch.

#### World generation and harvesting

Do not multiply `TileKind` into dozens of tree and rock tile kinds. Add deterministic resource identity on top of the existing terrain:

- `TreeSpecies` and `OreType` registries define biome weights, rarity, skill requirement, yields, visuals, and material traits.
- `resourceAt(world.seed, tx, ty, biome)` deterministically resolves the node's species/type.
- Existing terrain scars continue to persist depletion.
- `chopNow()` and `mineNow()` yield the resolved material instead of generic `log`/`ore`.
- `terrain.tsx` uses the same resolver to tint trunk/canopy or add restrained mineral flecks, preserving the current instanced low-poly renderer.
- Biomes and named regions bias resources: redwood in warmer deep forest, ironwood in harsher woodland, rare ores in Ironfold/highland/deep-mine areas.

Do not make every rare resource visually obvious from maximum camera distance. Skill, tracking/prospecting tools, close inspection, and regional knowledge should matter.

Suggested files:

- Create: `src/game/materials.ts`
- Create: `src/game/materials.test.ts`
- Create: `src/game/resources.ts`
- Create: `src/game/resources.test.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/catalog.ts`
- Modify: `src/game/biome.ts`
- Modify: `src/game/player.ts`
- Modify: `src/components/game/terrain.tsx`
- Modify: `src/game/craft.ts`
- Modify: `src/components/game/craft-gump.tsx`
- Modify: `src/game/iteminfo.ts`
- Modify: `src/game/save.ts`
- Modify: `src/game/vault.ts`

#### Material balance rules

- Material traits use a shared stat budget by rarity tier.
- Most advanced materials carry a tradeoff; avoid one universal best-in-slot resource.
- Workmanship may scale a material's bounded trait slightly, but cannot transform common wood into rare-wood potency.
- Gem affixes and material traits occupy separate groups and caps.
- Material luck/fortune cannot influence paid-market or minting outcomes.
- Repair cost and durability, if added, must create meaningful maintenance without making rare NFT equipment unusable.
- Salvage must never reproduce more rare material than the item originally contains.

#### Additional required tests

1. The same coordinate and world seed always resolve the same tree species or ore type.
2. Biome weighting changes distribution without changing deterministic results.
3. Chopping redwood yields redwood, not a generic log.
4. Mining a rare ore respects the Mining skill requirement and consumes no node on rejected attempts.
5. A redwood bow receives the exact redwood accuracy trait.
6. A mixed/common bow cannot inherit a full rare-material trait from one rare unit.
7. Exact material selection never falls through to cheapest-first consumption.
8. Material roles prevent a decorative/hilt unit from granting a full body/edge trait.
9. Render colors and harvested identities use the same resource resolver.
10. Save, tooltip, appraisal, Vault mint, and redeem preserve the full material bill.
11. Salvage cannot create material or duplicate rare inputs.
12. Legacy generic logs/ore remain craftable and migrate to baseline common materials without changing old saves unexpectedly.

### Content taxonomy and combinatorial item architecture

Adding tree, ore, gem, cloth, hide, bone, and monster-component families must not create a hard-coded item ID for every possible result. Avoid IDs such as `flawless_sapphire_redwood_exceptional_bow`: the combinations grow exponentially and make saves, UI, balance, and Vault compatibility brittle.

Use three layers:

1. **Resource definitions** — `redwood`, `moon_silver`, `sapphire`, `warg_hide`.
2. **Item form definitions** — `bow`, `sword`, `cuirass`, `chair`, `roof_beam`.
3. **Crafted instances** — one form plus selected materials, workmanship, inlays, finishing, and provenance.

```ts
interface ResourceStack {
  resourceId: ResourceId;
  grade: MaterialGrade;
  amount: number;
}

interface CraftedItem {
  uid: string;
  formId: ItemFormId;
  workmanship: Workmanship;
  components: CraftedMaterial[];
  inlays: GemInlay[];
  finish: FinishId | null;
  resolvedStats: ResolvedItemStats;
  maker?: string;
  recipeId: string;
  recipeVersion: number;
  born: { world: number; hour: number };
}
```

Keep generic commodity items stackable. Specialty-material equipment, fine/exceptional work, gem-forged work, named decorations, and NFT-eligible outputs become instances. Generate names and visuals from the canonical component record rather than storing a separate handcrafted definition for each combination.

#### Starter resource catalog

Ship a bounded vertical slice before expanding.

**Trees / timber**

- common oak — baseline;
- ashwood — handling/speed;
- redwood — accuracy;
- ironwood — power/durability;
- yew — range/arcane affinity.

Each species needs: biome weights, rarity, identification skill, extraction skill, tool tier, yield, regrowth rule, trunk/canopy palette, silhouette parameters, fixed traits, grade curve, and processing recipes.

**Ore / metal**

- iron — baseline;
- copper/tin family — accessible alloy path;
- highland-steel ore — edge/damage;
- moon-silver — magical-creature affinity;
- Emberite-class legendary ore — bounded top-tier specialization.

Each ore needs: biome/depth weights, vein rarity, prospecting requirement, mining requirement, pick tier, raw yield, purity/grade curve, smelting loss, alloy recipes, ingot visual, fixed traits, and repair/salvage rules.

**Gems**

- ruby — Power;
- sapphire — Fortune;
- emerald — Precision;
- amethyst — Arcana;
- diamond — Warding.

Each gem needs: source pools, clarity distribution, identification/appraisal requirement, fusion recipe, cutting requirement, applicable item classes, deterministic rank mapping, palette/glyph, and global stat cap.

#### Secondary materials worth adding

Wood, ore, and gems alone would leave many recipes shallow. Stage these next:

- **Fibers/cloth:** flax, wool, spider silk, fine linen; handling, comfort, spellcasting, or binding quality.
- **Leather/hide:** deer, wolf, warg, troll, scaled hide; flexibility, cold resistance, toughness, or creature affinity.
- **Bone/horn/shell/chitin:** bow tips, handles, armor inserts, trophies, ritual components.
- **Monster components:** venom sacs, salamander glands, wight ash, ogre sinew; authored specialty recipes rather than generic stat dust.
- **Finishes:** resin, oil, dye, temper, quench, polish; one bounded finishing choice per item.

Do not launch all categories simultaneously. The first complete equipment chain should use wood + cloth + two gem families; the first metal chain should then add ore + smelting + one alloy + armor/weapon output.

#### Visual identity requirements

Resource types must differ by silhouette and close-range detail, not color alone:

- oak: broad faceted crown;
- ash: lighter branching form;
- redwood: taller, straighter trunk and warm bark;
- ironwood: squat/dense dark form;
- yew: irregular old silhouette;
- ore nodes: restrained shape/fleck differences tied to the canonical resource resolver;
- gems: small heraldic glyphs and muted jewel colors within the existing gump palette.

Maintain instancing by grouping nodes by geometry/palette family. Do not allocate one material or React component per tree/rock.

#### Generated naming

Names should compose predictably:

```text
[workmanship] [primary material] [form] [gem suffixes]
```

Examples:

- redwood bow;
- exceptional ironwood bow of might;
- moon-silver sword of wight-slaying;
- flawless-sapphire yew bow of fortune.

Store canonical IDs and resolved effects; generate display strings from versioned naming rules. NFT payloads may store a display name for historical presentation but must also carry canonical component data.

#### Catalog invariants

Automated tests must verify:

- globally unique resource/form/trait IDs;
- every resource has a source, visual, tags, skill gates, and processing path;
- every trait has applicability and a stat-budget cost;
- every gem family maps every clarity to exactly one legal rank;
- every recipe role accepts at least one resource and rejects unrelated ones;
- generated names are stable for a recipe version;
- no crafted combination exceeds item-class stat caps;
- every NFT-eligible instance round-trips all canonical component data.

### Resource mastery, discovery, and artisan depth

Rare resources should be difficult at four separate stages rather than relying on one tiny drop percentage:

1. **Find:** the player must reach the right region and recognize clues.
2. **Extract:** Lumberjacking or Mining plus a suitable tool must meet the node requirement.
3. **Refine:** Carpentry, Smelting, or a specialist process must preserve the material's quality.
4. **Craft:** the final discipline must be capable of expressing the material trait without ruining it.

A player may discover an ancient redwood before being able to fell it. The journal records the location or a player-made map mark, giving them a reason to return after training rather than turning the find into a dead click.

#### Example progression bands (tuning placeholders)

**Lumberjacking**

| Skill band | Reliable access |
|---|---|
| novice | common oak, deadfall, ordinary ash |
| practiced | straight ash, dense pine, better yields |
| journeyman | redwood and region-special timber |
| master | yew, ironwood, heartwood-bearing ancient trees |
| grandmaster | exceptional ancient specimens and maximum-grade extraction |

**Mining**

| Skill band | Reliable access |
|---|---|
| novice | iron and common stone |
| practiced | copper/tin families and cleaner iron |
| journeyman | highland steel ores and silver-bearing seams |
| master | moon-silver and deep regional minerals |
| grandmaster | Emberite-class legendary veins and maximum-purity extraction |

**Refining/crafting**

Finding ore is not equivalent to forging it. Mining controls extraction and purity; Smelting/Blacksmithing controls ingot yield, alloying, temper, and final workmanship. Lumberjacking controls felling and log quality; Carpentry/Bowcraft controls seasoning, cutting, laminating, and final workmanship.

Use mostly soft failure:

- below discovery knowledge: the node looks unusual but is unidentified;
- below extraction requirement: the player gets an honest skill message and the node remains;
- near requirement: slower work or reduced yield/grade, with no chance to produce impossible top-grade material;
- at mastery: full yield and a bounded chance for heartwood/pure-vein grade;
- never consume a legendary node on a rejected command, disconnect, or client error.

#### Node identity and persistence

A resource node needs a stable identity derived from world seed + coordinate plus persisted depletion state:

```ts
interface ResourceNodeState {
  nodeId: string;
  resourceId: MaterialId;
  grade: MaterialGrade;
  discovered: boolean;
  depletedAt: number | null;
  regrowsAt: number | null;
}
```

Do not reroll a node when a player reloads or approaches it. In shared worlds, node state and rewards must be server-authoritative. Legendary groves and veins should have long, explicit renewal rules or be finite world discoveries; ordinary resources may regrow through the existing ecological simulation.

#### Discovery tools and clues

- **Forester's eye:** high Lumberjacking reveals bark/grain clues and identifies species at close range.
- **Prospecting:** Mining skill plus a prospecting tool reveals vein family, estimated purity, and directional hints.
- **Cartography:** players can mark discoveries and create tradable resource maps without exposing raw coordinates in public metadata.
- **Environmental clues:** soil color, nearby fauna, elevation, weathering, and restrained visual differences point toward rare resources.
- **Lore/NPC knowledge:** books, miners, foresters, and regional factions teach where a family tends to occur without giving exact nodes.

#### Resource grade

Keep complexity legible with two primary axes:

1. **Material family** — determines the fixed trait (redwood accuracy, ironwood power, moon-silver affinity).
2. **Grade** — determines how strongly or efficiently that trait survives refining.

Suggested grades: rough, sound, choice, pristine. A rare family at poor grade remains interesting but cannot equal pristine material. Avoid adding independent age, moisture, grain, purity, temperature, and weather rolls to every unit; those can appear as flavor or occasional named anomalies rather than six multiplicative stat systems.

#### Tools, stations, and processing

- Tool quality changes extraction speed, durability cost, and maximum recoverable grade—not the species/type of the node.
- Rare trees may require a hardened axe; rare veins may require a reinforced pick.
- Specialty stations unlock processes: drying rack, sawbench, bloomery, high forge, quench trough, lapidary bench.
- Processing choices create tradeoffs: temper for damage versus resilience; season timber for stability versus speed; laminate woods for an explicit composite recipe.
- Failed refinement yields bounded scrap, slag, offcuts, or downgraded material; it must never duplicate inputs.

#### Artisan specialization and player economy

Use-based skills remain, but high-end recipes can ask the player to specialize through knowledge, tools, and stations rather than permanent classes:

- bowyer;
- weaponsmith;
- armorer;
- lapidary;
- shipwright/carpenter;
- prospector/forester.

Specialization should create reasons to commission another player without making solo play impossible. Commission contracts can escrow supplied materials, specify the requested recipe/materials/inlays, and pay only when the canonical output matches. Do not implement paid escrow until shared inventory and command authority are server-side.

#### Additional sophisticated systems worth staging later

- **Material discovery journal:** records known families, regions, traits, and personal first finds.
- **Player resource maps:** decay or become approximate as ecology/veins change.
- **Named ancient nodes:** finite lore-bearing trees or veins that produce provenance-worthy material.
- **Alloys and laminates:** explicit authored combinations with tradeoffs; no free-form stat averaging.
- **Tempering/finishing:** one final bounded choice that specializes an item; never infinite rerolling.
- **Repair history:** meaningful maintenance and item history without permanently bricking rare/NFT equipment.
- **Salvage:** returns bounded fractions and may recover an inlay only through an explicit high-skill rule.
- **Commissions:** player-authored work orders for a canonical recipe and supplied materials.
- **Appraisal:** low skill sees broad descriptions; experts reveal exact grade and effects before purchase or crafting.
- **Craft lineage:** optional record of gatherer, refiner, and final maker, while keeping private resource coordinates off-chain.
- **Regional events:** storms, fires, cave-ins, migrations, or seasonal access can reveal temporary high-value sites without rerolling permanent nodes.

#### Scope order

Implement sophistication in this order:

1. material family + skill-gated extraction;
2. exact material selection + deterministic traits;
3. material grade + refining skill;
4. specialist tools/stations;
5. gems/inlays;
6. journals, maps, named nodes, salvage, and commissions;
7. only then shared-world scarcity and paid/NFT markets.

Each layer must be understandable and fun before adding the next. Depth should come from interacting clear systems, not from hiding dozens of invisible percentages.

### Acquisition and economy rules

- Gems do not appear in ordinary shops.
- Sources are explicit and world-bound: dangerous creature loot, deep mining seams, treasure/locked containers, regional events, and high-level quest rewards.
- Different regions can bias families without guaranteeing them.
- Gem clarity and family must both remain scarce; perfect gems should normally arise through long-term accumulation/fusion or exceptional encounters.
- Reclaiming or salvaging an inlaid item should not guarantee the gem back. Define a bounded recovery rule tied to a future Tinkering/Lapidary skill, and execute it server-authoritatively once the economy is shared.
- Fortune must be tightly capped. It may improve a loot-quality roll, but must not multiply gem quantity, minting power, or paid-market outcomes.

### NFT payload

Only singular items are Vault candidates. Extend the inscription with canonical, versioned fields:

- unique item ID;
- base item and recipe version;
- workmanship;
- material bill;
- gem family/clarity inlays;
- resolved canonical affixes and stats;
- maker identity;
- world/time provenance;
- visual variant data;
- server mint authorization or provenance signature once the economy is authoritative.

The chain payload records the item's identity; the server-owned schema remains authoritative for what those fields mean in each game version. Never recalculate a historical item's identity from mutable current balance tables.

### UI flow

The Work gump becomes a three-stage craft surface:

1. **Form** — choose the base item and required materials.
2. **Workmanship** — show skill, station, success, and expected quality range.
3. **Inlay** — optional gem slots with exact before/after attributes.

The confirmation must state:

- all consumed materials and gems;
- exact produced item or bounded workmanship outcomes;
- whether the output is stackable or singular;
- maker's mark;
- in-game gold or network fee separately;
- no market-value or profit promise.

### Required tests

1. Plain bow consumes exactly five wood and one cloth and creates one mundane bow.
2. Plain crafting cannot receive a magical affix.
3. A flawed ruby maps deterministically to rank-II Power for a bow.
4. A flawless sapphire maps deterministically to rank-IV Fortune for an eligible item.
5. Invalid family/item combinations consume nothing.
6. Duplicate affix groups consume nothing.
7. Inlay validation failure and interruption leave item and gems unchanged.
8. Batch crafting never batches singular gem-forged outputs.
9. Save migration preserves all legacy rare stats and names.
10. Tooltip, appraisal, combat, Vault mint, and redeem all preserve workmanship, materials, inlays, affixes, maker, and recipe version.
11. Fortune respects its global cap and cannot affect transaction, NFT, or marketplace outcomes.
12. Client-supplied gem metadata is rejected by the authoritative mint path.

### Recommended first crafting slice

Implement one complete chain before adding the whole gem catalog:

- mundane bow: five wood + one cloth;
- ruby clarity ladder mapped to Power ranks I–V;
- sapphire clarity ladder mapped to Fortune ranks I–V;
- one inlay slot;
- deterministic preview and atomic inlay;
- complete item tooltip and save round-trip;
- Vault encoding/decoding tests, but no claim of authoritative scarcity until server validation exists.

This proves the economy, UX, item-instance schema, and NFT provenance model with bounded content.
