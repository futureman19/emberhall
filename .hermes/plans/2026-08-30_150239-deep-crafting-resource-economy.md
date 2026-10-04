# Emberhall Deep Crafting and Resource Economy Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace Emberhall’s generic log/ore and random crafted-magic model with a scalable resource, refining, workmanship, gem-inlay, provenance, and optional NFT system—beginning with a small, fully playable vertical slice.

**Architecture:** Keep the current embodied UO-style simulation and local-first save model, but separate resource definitions, item forms, crafted instances, and resolved effects. Resource identity is deterministic from world seed and location; harvesting and refining are skill-gated; materials provide fixed physical traits; workmanship reflects the crafter; gems add deterministic magical attributes. Build the complete bow chain first, then reuse the same contracts for mining, metalworking, armor, additional resources, and eventually server-authoritative Vault minting.

**Tech Stack:** TypeScript, React 19, Three.js / React Three Fiber, Zustand, Node test runner, localStorage migrations, Playwright, existing 1Sat/BRC-100 Vault integration.

**Parent roadmap:** `.hermes/plans/2026-08-30_140944-emberhall-creator-sandbox-roadmap.md`

---

## 1. Purpose and user-visible outcome

The update should make gathering and crafting a deep game rather than a list of recipes.

A player should eventually be able to:

1. Discover an unusual tree or mineral vein in a specific region.
2. Identify it when their skill or tool is sufficient.
3. Mark the location and return later if they cannot harvest it.
4. Extract a material with a stable family and grade.
5. Refine it without silently losing its identity.
6. Select exact materials for exact recipe roles.
7. Produce a mundane, fine, or exceptional item.
8. Add a rare gem whose family and clarity deterministically define an attribute.
9. See the complete item story in its tooltip: form, materials, grade, workmanship, inlays, maker, place, and time.
10. Equip, repair, appraise, trade, save, and optionally place that exact item in the Vault.

Example final result:

> **Exceptional Redwood Bow of Might**  
> Choice redwood body · fine linen binding · flawed ruby inlay  
> Redwood: Accuracy · Ruby: Power II  
> Crafted by Brunhilde at Emberhall, Day 41

---

## 2. Scope boundaries

### Included in this implementation program

- Resource definitions for trees, ores/metals, fibers, and gems.
- Deterministic regional resource nodes.
- Discovery, identification, harvesting, grade, and depletion.
- Exact material selection and semantic recipe roles.
- Refining into boards, ingots, cloth bindings, and cut gems.
- Workmanship separate from magic.
- Unique crafted-item instances with provenance.
- Deterministic gem inlays.
- Tooltips, comparison, combat effects, appraisal, and equipment.
- Save migration and legacy compatibility.
- Vault payload v3 plus safe local round-trips.
- Desktop/mobile browser verification and performance checks.

### Deferred until the core loop is proven

- Public persistent economy.
- Server-authoritative world inventory and depletion.
- Paid commissions or escrow.
- Public NFT marketplace promotion.
- Three-inlay items.
- Free-form alloys or material averaging.
- Arbitrary player-authored stats or scripts.
- Raw-material NFTs.
- Full repair/durability simulation.
- Every proposed tree, ore, gem, cloth, hide, and monster component.

### Explicit product rules

- Material family determines a fixed physical trait.
- Material grade determines how strongly/efficiently the trait survives.
- Workmanship determines craft quality and maker identity.
- Gems determine magical attributes.
- Ordinary crafting does not randomly create magic.
- Rare gems are not destroyed by opaque rolls in the first release.
- All failed validation is non-mutating.
- Generic utility recipes may consume cheapest-first; equipment recipes may not.
- Only unique item instances are Vault eligible.

---

## 3. Current context and prerequisites

### Existing foundations

- `src/game/types.ts` contains the serializable world, inventory, skills, rares, buildings, and terrain scars.
- `src/game/catalog.ts` provides item metadata and resource tags.
- `src/game/craft.ts` already provides data-backed recipes, station checks, skill checks, batches, and material consumption.
- `src/game/rare.ts` already provides rank I–V affixes, maker marks, combat modifiers, loot rares, and exceptional crafting.
- `src/game/player.ts` owns chopping, mining, equipment, and combat.
- `src/game/biome.ts` already resolves six regional biome families.
- `src/components/game/terrain.tsx` already renders instanced trees and rocks with biome-aware colors.
- `src/game/save.ts` now contains explicit sequential migration infrastructure.
- `src/game/vault.ts`, `src/chain/oneSat.ts`, and `src/components/game/vault-gump.tsx` already mint, list, burn, and redeem Emberhall item ordinals.
- Baseline audit: 119 repository tests passed before this plan was written.

### Existing limitations to address

- All trees yield `log`; all rocks yield `ore`.
- `ItemId` and `pack: Record<ItemId, number>` encourage hard-coded combinations.
- Equipment recipes consume tag-compatible materials cheapest-first.
- The current bow costs five wood and no cloth.
- Crafted magic currently comes from `rollExceptional()` and a random affix pool.
- `RareItem` stores base, affixes, maker, seed, and hour, but not workmanship, component materials, inlays, recipe version, or source.
- The Vault trusts client-side game state and cannot prove public scarcity.

### Dirty-worktree safety gate

At plan time the repository already contains unrelated/in-progress changes:

- modified `README.md`;
- modified `package.json`;
- modified `src/game/save.ts`;
- untracked `src/game/save.test.ts`;
- untracked `.hermes/` plans.

Before implementation, inspect and finish the save-migration work as its own verified commit. Do not reset, overwrite, stash-and-drop, or mix those files into the resource-system implementation without reviewing their diff. The `.hermes/` plan may remain local/ignored unless the user explicitly wants it tracked.

---

## 4. Core domain model

### 4.1 Resource definitions

Create `src/game/resources/types.ts`:

```ts
export type ResourceKind = "timber" | "ore" | "metal" | "fiber" | "gem";
export type MaterialGrade = "rough" | "sound" | "choice" | "pristine";
export type GemClarity = "cracked" | "flawed" | "cut" | "flawless" | "perfect";

export interface ResourceDefinition {
  id: ResourceId;
  kind: ResourceKind;
  label: string;
  tags: string[];
  regions: Partial<Record<BiomeId, number>>;
  rarityWeight: number;
  identifySkill: { id: SkillId; minimum: number };
  extractSkill?: { id: SkillId; minimum: number };
  toolTier?: number;
  traitIds: MaterialTraitId[];
  visual: ResourceVisual;
  processing: ProcessingRoute[];
}
```

Use stable string IDs. Never encode balance numbers into IDs.

### 4.2 Resource stacks

Add to `PlayerState` without removing the legacy `pack` immediately:

```ts
export type ResourceStackKey = {
  [I in ResourceId]: `${I}:${ResourceFormFor<I>}:${QualityForResource<I>}`;
}[ResourceId];

export interface ResourceInventory {
  stacks: Record<ResourceStackKey, number>;
}
```

Compatibility rule:

- legacy `log` behaves as `oak:log:sound` when used by new recipes;
- legacy `ore` behaves as `iron_ore:ore:sound`;
- old utility recipes continue to work during migration;
- new harvesting yields resource stacks, not new hard-coded `ItemId` variants.

### 4.3 Item forms and recipes

Create `src/game/crafting/types.ts`:

```ts
export type MaterialRole =
  | "body"
  | "binding"
  | "edge"
  | "hilt"
  | "plate"
  | "lining"
  | "frame"
  | "finish";

export interface RecipeRole {
  role: MaterialRole;
  amount: number;
  accepts: ResourceSelector;
  contribution: "primary" | "secondary" | "cosmetic";
}

export interface ItemFormDefinition {
  id: ItemFormId;
  baseItem: ItemId;
  label: string;
  itemClass: "weapon" | "armor" | "jewelry" | "tool" | "placeable";
  roles: RecipeRole[];
  baseStats: ResolvedItemStats;
  inlayGroups: GemFamily[];
  maxInlays: number;
}
```

### 4.4 Unique crafted items

Evolve the existing rare-instance path rather than creating competing systems:

```ts
export type Workmanship = "ordinary" | "fine" | "exceptional";

export interface CraftedComponent {
  role: MaterialRole;
  resourceId: ResourceId;
  grade: MaterialGrade;
  amount: number;
}

export interface GemInlay {
  resourceId: GemResourceId;
  family: GemFamily;
  clarity: GemClarity;
  affixId: string;
  rank: 1 | 2 | 3 | 4 | 5;
}

export interface UniqueItem {
  uid: string;
  formId: ItemFormId;
  base: ItemId;
  workmanship: Workmanship;
  components: CraftedComponent[];
  inlays: GemInlay[];
  affixes: string[];
  resolvedStats: ResolvedItemStats;
  maker?: string;
  recipeId: string;
  recipeVersion: number;
  source: "crafted" | "loot" | "legacy";
  seed: number;
  hour: number;
}
```

Transitional strategy:

- introduce `UniqueItem`;
- temporarily export `type RareItem = UniqueItem` if that minimizes breakage;
- keep `player.rares` as a compatibility field during the first schema migration;
- rename storage only in a later dedicated migration after all call sites use neutral helpers such as `uniqueItems(world)`.

### 4.5 Resolved stats

Create one pure resolver:

```text
resolved stats = form base + workmanship + primary material traits
               + secondary material traits + gem affixes + finish
```

Rules:

- every modifier has an explicit source;
- every item class has hard caps;
- historical `resolvedStats` are stored on the instance;
- current balance tables do not silently rewrite existing crafted/NFT items;
- recipe upgrades increment `recipeVersion`.

---

## 5. First playable vertical slice

Do not begin with the entire catalog. Prove one end-to-end wood path and one narrow metal path.

### Resource set

**Timber**

- Common oak — baseline.
- Redwood — accuracy specialization.

**Ore/metal**

- Iron ore / iron ingot — baseline.
- Highland-steel ore / ingot — damage specialization.

**Fiber**

- Common cloth — baseline bow binding.
- Fine linen — handling/quality secondary material.

**Gems**

- Ruby — Power.
- Sapphire — Fortune.
- Initial testable clarities: flawed and flawless.
- Data contracts support all five clarities from the start.

### Item forms

- Bow — `5 wood body + 1 fiber binding`.
- Sword — `metal edge + wood hilt + fiber/leather binding` after the bow slice is stable.

### Player journey acceptance test

1. Start a new hall.
2. Chop ordinary oak and receive oak of a deterministic grade.
3. Discover a redwood in its weighted region.
4. Fail safely when Lumberjacking/tool requirements are insufficient.
5. Return with sufficient skill/tool and harvest redwood.
6. Craft a generic oak bow.
7. Craft a unique redwood bow and see its accuracy trait.
8. Find or inject a deterministic test-only flawed ruby through a fixture.
9. Inlay the ruby and preview Power II before confirmation.
10. Equip the bow and observe material/gem effects in combat.
11. Save and reload with identity unchanged.
12. Mint/encode and redeem/decode locally with all provenance unchanged.

---

## 6. Implementation phases and dependency order

### Phase A — Baseline and migration safety

**Outcome:** Existing behavior is locked down before changing types.

1. Finish and verify the in-progress `save.ts` / `save.test.ts` work separately.
2. Add current harvesting tests: generic tree → log; generic rock → ore; rejected attempts do not mutate terrain.
3. Add current crafting tests for bow, tag consumption, exceptional conversion, equipment, combat, appraisal, and Vault round-trip.
4. Capture current title, play, Work gump, inventory, and Vault screenshots.
5. Record baseline save fixtures under `src/game/fixtures/`.

**Gate:** `npm run check` and browser smoke pass before domain changes.

### Phase B — Resource and item contracts

**Outcome:** New types and catalogs exist without changing gameplay.

1. Create resource, trait, grade, recipe-role, form, and resolved-stat types.
2. Create validated registries for oak, redwood, iron ore, highland ore, cloth, linen, ruby, and sapphire.
3. Add catalog invariant tests.
4. Add neutral helper APIs for inventory and unique items.
5. Keep legacy behavior behind adapters.

**Gate:** No screenshot change; full tests pass.

### Phase C — Deterministic nodes and visuals

**Outcome:** Tree/rock coordinates have stable resource identity.

1. Implement `resourceAt(seed, tx, ty, biome)` as a pure resolver.
2. Add weighted regional distribution and stable grade generation.
3. Add identification and extraction requirement queries.
4. Render oak/redwood and iron/highland nodes with shared geometry families and distinct close-range silhouettes/colors.
5. Reuse the exact resolver for harvesting and rendering.
6. Add persistent depletion/regrowth metadata without serializing every world tile.

**Gate:** deterministic tests, render/harvest parity test, no per-node Three.js materials.

### Phase D — Harvesting and resource inventory

**Outcome:** Chopping/mining yield typed materials and respect skills/tools.

1. Add resource stacks to player state and snapshots.
2. Migrate legacy log/ore usage through compatibility helpers.
3. Change `chopNow()` and `mineNow()` to resolve node identity and recovered grade.
4. Add soft/hard skill feedback and node-preservation rules.
5. Add resource discovery journal entries.
6. Surface exact yields in toast/log/inventory.

**Gate:** no node loss on reject/error; save/reload preserves stacks and depletion.

### Phase E — Exact-material crafting and workmanship

**Outcome:** Players intentionally choose inputs and craft material-specific items.

1. Add semantic recipe roles and selected input payloads.
2. Keep utility recipes on current auto-consumption; equipment recipes require exact selection.
3. Change bow recipe to five wood plus one fiber.
4. Add an atomic craft transaction: validate all → consume once → create once.
5. Separate workmanship from magic.
6. Remove random gem-like affixes from crafted outputs; retain random loot affixes.
7. Create a unique instance whenever specialty materials or fine/exceptional workmanship are involved.
8. Generate stable names and visuals from canonical components.

**Gate:** plain bow cannot gain magic; redwood bow always gains its defined trait; failed craft does not mutate input.

### Phase F — Gem cutting and deterministic inlay

**Outcome:** Gems intentionally create magical properties.

1. Add gem family and clarity tables.
2. Add raw/cut state only if it improves play; otherwise treat clarity as the usable resource grade for v1.
3. Add inlay slot calculation from form/workmanship/skill.
4. Add exact preview and atomic inlay command.
5. Map flawed ruby → Power II and flawless sapphire → Fortune IV.
6. Reject duplicate affix groups and incompatible item classes.
7. Cap Fortune and keep it out of NFT/market/transaction outcomes — mechanically: Fortune is recomputed locally from gem components and never serialized into Vault v3 payloads (Power and material/workmanship stats only), so on-chain items cannot carry loot luck into market contexts.
8. Disable batch processing for unique inlaid outputs.

**Gate:** deterministic inlay tests and save/Vault round-trip pass.

### Phase G — Equipment, combat, appraisal, and UX

**Outcome:** Crafted differences are visible and meaningful.

1. Route combat through `resolvedStats` instead of recomputing only legacy affixes.
2. Update equipment comparison and paperdoll summaries.
3. Update item tooltip with component, trait, workmanship, inlay, maker, and provenance sections.
4. Update appraisal with an itemized value breakdown.
5. Add Work gump stages: Form → Materials → Workmanship → Inlay → Confirm.
6. Add keyboard, pointer, and touch flows.
7. Display exact odds only where randomness remains.

**Gate:** one Playwright path completes the full bow journey on desktop and mobile.

### Phase H — Refining, stations, and narrow metal path

**Outcome:** Mining and Blacksmithing reuse the same architecture.

1. Add ore → ingot processing with retained family/grade and bounded loss.
2. Add iron and highland-steel sword recipes.
3. Add mining, smelting, and blacksmithing requirements separately.
4. Add pick/forge tiers if they improve progression without blocking the first hour.
5. Add one temper choice with an explicit tradeoff.
6. Validate repair/salvage contracts before implementing full durability.

**Gate:** ore identity survives mine → smelt → forge → equip → save → Vault.

### Phase I — Vault payload v3 and authority boundary

**Outcome:** Unique items serialize completely and honestly.

1. Define Vault v3 payload with form, components, grades, workmanship, inlays, resolved stats, recipe version, maker, source, seed, and hour.
2. Decode v1/v2 payloads unchanged.
3. Preserve historical resolved identity during redeem.
4. Mint only unique items; exclude commodity stacks and raw resources.
5. Add pending local mint state to reduce interruption/duplication risk.
6. Label local mint provenance as beta/client-authoritative.
7. Write a separate server-authority design before public scarcity claims.

**Gate:** v1/v2/v3 fixtures decode; v3 mint/redeem is lossless; malformed canonical data is rejected.

### Phase J — Expansion and tuning

**Outcome:** The proven contracts support more content without rewrites.

Add one family at a time:

- ashwood;
- ironwood;
- yew;
- copper/tin and bronze;
- moon-silver;
- Emberite-class legendary ore;
- emerald, amethyst, diamond;
- hides, bone/horn, monster components;
- specialty stations, maps, named nodes, salvage, repair, commissions.

Every addition must include definition, source, visual, skill gates, recipe path, trait budget, tests, and playtest evidence.

---

## 7. Task-by-task execution plan

### Task 0: Establish the current save boundary

**Objective:** Begin from a known-good, reviewable current-version save foundation. Pre-v1/unversioned test saves do not require compatibility and may be rejected/reset.

**Files:**
- Inspect/finish: `src/game/save.ts`
- Inspect/finish: `src/game/save.test.ts`
- Inspect: `package.json`
- Preserve: `README.md`

**Steps:**

1. Review the existing diffs and establish the intended current save version.
2. Run only `src/game/save.test.ts` and verify current-version round-trip plus future-version/corrupt/malformed rejection.
3. Reject unversioned/pre-v1 test saves rather than maintaining broad compatibility code.
4. Add the test file to the explicit `npm test` list if that is the existing unfinished intent.
5. Run `npm run check`.
6. Commit this existing work separately before resource work.

**Expected:** the current save boundary is strict, green, and isolated from the new feature; obsolete private-test saves may reset.

### Task 1: Lock down current harvest behavior

**Objective:** Capture behavior before replacing generic yields.

**Files:**
- Create: `src/game/harvest.test.ts`
- Modify: `package.json`

**Tests:**

- adjacent valid tree yields one generic log;
- adjacent valid rock yields one generic ore;
- failed skill roll leaves node and inventory unchanged;
- invalid target clears intent without yield;
- depletion updates scars and `landRev` once;
- reload preserves depleted terrain.

**Run:**

```sh
node --experimental-strip-types --test src/game/harvest.test.ts
```

### Task 2: Add resource-domain types

**Objective:** Introduce stable contracts with no behavior change.

**Files:**
- Create: `src/game/resources/types.ts`
- Create: `src/game/resources/traits.ts`
- Create: `src/game/resources/catalog.ts`
- Create: `src/game/resources/catalog.test.ts`
- Modify: `src/game/types.ts`
- Modify: `package.json`

**Tests:** unique IDs, valid weights, legal grades/clarities, valid traits, valid skill references, complete processing routes.

### Task 3: Add item forms and stat resolution

**Objective:** Represent form, materials, workmanship, inlays, and stats independently.

**Files:**
- Create: `src/game/crafting/types.ts`
- Create: `src/game/crafting/forms.ts`
- Create: `src/game/crafting/resolve.ts`
- Create: `src/game/crafting/resolve.test.ts`

**Tests:**

- oak bow equals baseline;
- redwood body adds only the redwood trait;
- a hilt-sized redwood contribution cannot grant full body benefit;
- workmanship and gem groups apply once;
- class caps hold;
- resolver is deterministic.

### Task 4: Add resource inventory adapters

**Objective:** Add typed materials without breaking existing pack callers.

**Files:**
- Create: `src/game/inventory/resources.ts`
- Create: `src/game/inventory/resources.test.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/catalog.ts`
- Modify: `src/game/world.ts`
- Modify: `src/game/save.ts`
- Modify: `src/game/save.test.ts`

**Tests:** add/take/count exact stack, no negative counts, atomic multi-stack debit, legacy log/ore fallback, migration defaults, save round-trip.

**Architecture checkpoint amendments:**

- Define `ResourceStackKey` as a correlated union (or expose a validated constructor/parser); never use a Cartesian template that permits impossible keys such as `ruby:log:rough`.
- Make the persistence change explicit: bump the save schema, migrate only the supported current v1 save to the new version with empty resource stacks, validate every stack key/count, and continue rejecting pre-v1/unversioned and future saves.
- Ensure `writeSave` cannot begin persisting the new field accidentally through object spread before the schema/version validator supports it.
- Before exposing `buildResourceCatalog` to untrusted/runtime definitions, match the item-form boundary: plain or null-prototype records, own required fields, unknown-field rejection, clone-then-revalidate, and deep freeze. Trusted literal catalog use is not a Task 4 blocker.
- Add negative tests for impossible resource/form/quality keys, inherited required properties, malformed counts, duplicate canonicalization, and atomic rollback.

### Task 5: Add deterministic node resolution

**Objective:** Resolve resource family and grade from location.

**Files:**
- Create: `src/game/resources/nodes.ts`
- Create: `src/game/resources/nodes.test.ts`
- Modify: `src/game/biome.ts`

**Tests:** same seed/coordinate identity, biome distribution, stable grade, ordinary-resource floor, rare-resource cap, no dependence on frame/time/reload.

**Rule:** grade is owned by the node, recovery by the harvester. Each node has a seed-derived grade ceiling; a harvester recovers up to the lesser of that ceiling and their skill band. Identification reveals the band; it never rerolls it.

### Task 6: Render resource identities

**Objective:** Make resources readable without changing Emberhall’s aesthetic or renderer budget.

**Files:**
- Create: `src/components/game/resource-visuals.ts`
- Modify: `src/components/game/terrain.tsx`

**Steps:**

1. Add oak/redwood tree geometry/palette parameters.
2. Add iron/highland rock parameters.
3. Group instances by a bounded geometry/material family.
4. Ensure selection maps still resolve coordinates correctly.
5. Capture desktop/mobile screenshots in several regions.

**Expected:** no unique material per node; no obvious neon resource markers.

### Task 7: Skill-gate harvesting

**Objective:** Make rare resources discoverable before they are harvestable.

**Files:**
- Create: `src/game/resources/harvest.ts`
- Create: `src/game/resources/harvest.test.ts`
- Modify: `src/game/player.ts`
- Modify: `src/game/store.ts`
- Modify: `src/game/context.ts`

**Tests:** identification bands, extraction thresholds, tool gate, near-threshold grade cap, mastery yield, no node consumption on reject/error, exact journal/toast messages.

### Task 8: Persist depletion and discoveries

**Objective:** Nodes do not reroll or regenerate on reload.

**Files:**
- Create: `src/game/resources/state.ts`
- Create: `src/game/resources/state.test.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/save.ts`
- Modify: `src/game/save.test.ts`
- Modify: `src/game/live.ts`

**Data:** sparse map keyed by node ID; do not serialize every tile.

**Tests:** depletion round-trip, regrowth boundary, legacy defaults, named/finite node behavior, future-version rejection.

### Task 9: Introduce exact recipe roles

**Objective:** Equipment crafting never silently consumes a rare material.

**Files:**
- Create: `src/game/crafting/recipes.ts`
- Create: `src/game/crafting/recipes.test.ts`
- Create: `src/game/crafting/transaction.ts`
- Create: `src/game/crafting/transaction.test.ts`
- Modify: `src/game/craft.ts`

**Tests:** role compatibility, exact selection, mixed-material rejection, all-before-any mutation, rollback on failure, utility recipe compatibility, output count.

### Task 10: Ship the new bow recipe

**Objective:** Produce generic and material-specific bows.

**Files:**
- Modify: `src/game/crafting/forms.ts`
- Modify: `src/game/crafting/recipes.ts`
- Modify: `src/game/craft.ts`
- Modify: `src/game/rare.ts`
- Modify: `src/game/types.ts`
- Extend tests in: `src/game/crafting/transaction.test.ts`, `src/game/rare.test.ts`

**Acceptance:**

- five oak + one cloth → generic bow;
- five redwood + one cloth → unique redwood bow;
- redwood trait is deterministic;
- no magical affix without a gem;
- maker/workmanship are preserved.

### Task 11: Separate workmanship from magic

**Objective:** Stop ordinary crafting from randomly creating magical affixes.

**Files:**
- Modify: `src/game/rare.ts`
- Modify: `src/game/craft.ts`
- Modify: `src/game/rare.test.ts`
- Modify: `src/game/iteminfo.ts`

**Rules:**

- loot rares continue using weighted random affixes;
- crafting rolls only workmanship;
- fine/exceptional bonuses are physical and capped;
- maker mark belongs to fine/exceptional or gem-forged unique items.

### Task 12: Add gems and inlay transactions

**Objective:** Add deterministic Ruby/Sapphire magic.

**Files:**
- Create: `src/game/gems.ts`
- Create: `src/game/gems.test.ts`
- Create: `src/game/inlay.ts`
- Create: `src/game/inlay.test.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/rare.ts`

**Tests:** family/clarity mapping, compatibility, slot count, duplicate group, exact debit, no mutation on reject, deterministic Power/Fortune, Fortune cap.

### Task 13: Build the advanced Work UI

**Objective:** Make the system understandable without a spreadsheet.

**Files:**
- Create: `src/components/game/crafting/material-selector.tsx`
- Create: `src/components/game/crafting/workmanship-preview.tsx`
- Create: `src/components/game/crafting/inlay-panel.tsx`
- Create: `src/components/game/crafting/confirm-craft.tsx`
- Modify: `src/components/game/craft-gump.tsx`
- Modify: `src/game/store.ts`

**UI requirements:**

- explicit role and quantity;
- exact selected stack;
- before/after stats;
- exact guaranteed gem result;
- remaining randomness/odds;
- consume summary;
- disabled reason;
- touch-friendly controls;
- keyboard labels and focus order.

### Task 14: Update item presentation and combat

**Objective:** Ensure unique items work everywhere.

**Files:**
- Modify: `src/game/iteminfo.ts`
- Modify: `src/components/game/item-tip.tsx`
- Modify: `src/components/game/paperdoll.tsx`
- Modify: `src/game/player.ts`
- Modify: `src/game/rare.ts`
- Modify: `src/game/npcs.ts`
- Extend: `src/game/rare.test.ts`

**Rule:** unique items are never lost involuntarily — selling one to an NPC requires an explicit confirmation, and uniques do not drop on death/corpse creation.

**Tests:** equipment, damage/accuracy, comparison, appraisal, unequip, sell, death/corpse handling, bank/chest behavior where supported.

### Task 15: Add narrow mining/refining/sword slice

**Objective:** Prove reuse outside timber.

**Files:**
- Create: `src/game/refining.ts`
- Create: `src/game/refining.test.ts`
- Modify: resource and form catalogs
- Modify: `src/game/craft.ts`
- Modify: `src/game/player.ts`

**Acceptance:** highland ore → highland ingot → highland-steel sword with deterministic material trait and full round-trip.

### Task 16: Migrate saves and legacy rares

**Objective:** Preserve all existing player value.

**Files:**
- Modify: `src/game/save.ts`
- Modify: `src/game/save.test.ts`
- Create/update fixtures: `src/game/fixtures/*.json`

**Migration:**

- generic logs/ore remain usable as baseline resources;
- legacy rares become `source: "legacy"` unique items;
- existing affixes/stats/names remain unchanged;
- missing workmanship/components/inlays get explicit defaults;
- no migration rewrites world seed, hour, maker, equipment links, or Vault identity.

### Task 17: Add Vault v3

**Objective:** Preserve advanced item identity on-chain.

**Files:**
- Modify: `src/game/vault.ts`
- Modify: `src/game/vault.test.ts`
- Modify: `src/chain/oneSat.ts`
- Modify: `src/components/game/vault-gump.tsx`

**Tests:** v1/v2 compatibility, v3 schema, canonical validation, mint removal, redeem restoration, malformed stats rejection, unique-only eligibility, interrupted/pending state recovery.

### Task 18: Add creator-economy browser smoke

**Objective:** Verify the player journey, not only isolated functions.

**Files:**
- Create: `scripts/crafting-smoke.mjs`
- Create: `scripts/crafting-smoke-verdict.mjs` if needed
- Modify: `package.json`

**Flow:** fresh hall → deterministic fixture → harvest → craft oak bow → craft redwood bow → inlay ruby → equip → reload → compare → open Vault.

**Viewports:** desktop 1280×800 and mobile 390×844.

**Assertions:** no console/page errors, no overflow, expected body text, save identity unchanged, screenshots produced.

### Task 19: Balance and expansion gate

**Objective:** Decide whether the system is ready for more content.

**Evidence required:**

- acquisition time distributions from deterministic simulations;
- skill-gate success/failure curves;
- material and gem supply/sink counts;
- workmanship outcome distribution on max-grade inputs — if ordinary results on rare materials feel punishing, prefer skill-banded minimums before catalog expansion;
- stat-cap report across all legal combinations;
- representative inventory/save payload size;
- draw-call/frame responsiveness evidence;
- five human-readable sample items spanning common to masterwork.

Do not add the full catalog until the bow and sword paths pass this gate.

---

## 8. Test and validation matrix

### Unit tests

- Catalog integrity.
- Deterministic node identity.
- Biome weighting.
- Skill/tool gates.
- Resource stack accounting.
- Atomic crafting and inlay.
- Stat resolution and caps.
- Names and tooltip lines.
- Save migrations.
- Vault schema versions.

### Integration tests

- Tree appearance matches harvested resource.
- Mine → refine → craft preserves family/grade.
- Equipment applies resolved stats.
- Appraisal itemizes every source once.
- Death, sell, bank/chest, and redeem do not duplicate unique items.
- Reload does not reroll nodes or crafted identities.

### Browser tests

- Desktop and mobile Work flow.
- Material selector usability.
- Inlay preview and confirmation.
- Inventory/paperdoll tooltip readability.
- Vault display.
- No horizontal overflow or blocked canvas controls.

### Canonical commands

Targeted during development:

```sh
node --experimental-strip-types --test src/game/resources/catalog.test.ts
node --experimental-strip-types --test src/game/resources/nodes.test.ts
node --experimental-strip-types --test src/game/resources/harvest.test.ts
node --experimental-strip-types --test src/game/crafting/transaction.test.ts
node --experimental-strip-types --test src/game/gems.test.ts src/game/inlay.test.ts
node --experimental-strip-types --test src/game/save.test.ts src/game/vault.test.ts
```

Full gate after every milestone:

```sh
npm run check
```

Runtime verification against the dev server:

```sh
node scripts/browser-smoke.mjs
node scripts/crafting-smoke.mjs
```

Expected final observation: all automated checks pass, both viewport screenshots are readable, no runtime errors appear, and the full crafted-item identity survives reload and Vault round-trip.

---

## 9. Performance and storage budgets

- Resource identity is derived, not stored for every tile.
- Only sparse depletion/discovery overrides are saved.
- No unique Three.js material per node or item.
- Tree/ore visuals remain instanced by bounded geometry/material families.
- Commodity stacks remain aggregated.
- Only specialty/fine/exceptional/inlaid equipment becomes unique.
- Resource catalogs and recipe definitions are static/versioned.
- Save payload growth is measured with 500 resource stacks and 250 unique items before expansion.
- Tooltips resolve from cached canonical stats; do not recalculate the entire catalog each render.
- Fortune and loot modifiers do not trigger unbounded extra rolls.

---

## 10. Security and economy requirements

### Local-first stage

- Treat local scarcity as gameplay, not cryptographic proof.
- Clearly label Vault provenance as beta/client-authoritative.
- Keep wallet keys outside the game through the existing wallet interface.
- Show network fees separately from game costs.
- Never promise market value, rarity-based profit, or guaranteed resale.

### Before public shared scarcity

A server must authoritatively verify:

- node identity and depletion;
- player skill/tool eligibility;
- yielded resource family/grade/amount;
- refining and crafting transactions;
- unique item ownership and status;
- mint authorization for one exact item ID/payload;
- pending/minted/redeemed state;
- every paid listing or commission mutation.

P2P clients may share movement/presence later but must not decide inventory, scarcity, crafting, or NFT ownership.

### Abuse controls

- Rate-limit harvest and craft commands in shared worlds.
- Reject client-supplied resolved stats.
- Resolve stats from server-owned definition versions.
- Sign or authorize canonical mint payloads.
- Never publish secret node coordinates in public NFT metadata.
- Bound text, thumbnails, component count, inlays, and payload size.
- Keep immutable audit history for high-value items.

---

## 11. Rollout strategy

### Release 1: Resource foundation

- Oak, redwood, iron, highland ore.
- Deterministic nodes, identification, harvesting, grade, inventory.
- No gem UX yet.

### Release 2: Advanced bowcraft

- Wood + fiber recipe roles.
- Exact selection.
- Workmanship and unique redwood bow.
- Tooltip/combat/save support.

### Release 3: Ruby and Sapphire

- Deterministic inlay.
- Power and capped Fortune.
- Full Work UX.
- Raw rubies/sapphires appear as rare yields from existing rock nodes, so gems are legitimately obtainable before full Mining progression arrives in Release 4.

### Release 4: Metalworking

- Refining and highland-steel sword.
- Tempering.
- Mining/Smithing progression.

### Release 5: Vault v3 beta

- Complete payload identity.
- Local mint/redeem compatibility.
- Clear trust disclosure.

### Release 6+: Content expansion

- Additional timber, ores, gems, secondary materials, named nodes, journals/maps, repair/salvage, and later authoritative multiplayer economy.

Every release is independently playable and can be rolled back without invalidating prior saves.

---

## 12. Risks and mitigations

1. **Combinatorial explosion**  
   Use definitions + roles + instances; never one ID per combination.

2. **Save corruption**  
   Sequential migrations, fixtures, strict validation, and legacy adapters.

3. **Silent consumption of rare materials**  
   Exact selection and all-before-any atomic transactions.

4. **One universal best material**  
   Shared stat budgets, tradeoffs, role weighting, and hard caps.

5. **Opaque gambling**  
   Deterministic gem effects and explicit odds only for workmanship/drop randomness.

6. **Inventory clutter**  
   Aggregate commodities; instantiate only meaningful equipment.

7. **Visual drift**  
   Curated silhouettes/palettes within existing instancing and lighting.

8. **Performance collapse**  
   Derived nodes, sparse state, instancing, cached stat resolution, measured budgets.

9. **Client-created fake scarcity**  
   Honest beta labeling now; server authority before public economy claims.

10. **Massive horizontal refactor that never becomes fun**  
    Build complete vertical slices: bow first, sword second.

---

## 13. Decision log

- **Decision:** Materials provide deterministic physical traits; gems provide deterministic magic.  
  **Reason:** Players can understand and intentionally create item identity.

- **Decision:** Workmanship is separate from magic.  
  **Reason:** A master can make exceptional mundane work without inventing magical power from ordinary wood.

- **Decision:** Keep legacy pack/rare adapters during the first migration.  
  **Reason:** Reduces simultaneous breakage across inventory, equipment, combat, save, and Vault code.

- **Decision:** Derive resource nodes from seed/coordinate/biome.  
  **Reason:** Stable scarcity without serializing the entire map.

- **Decision:** Use exact material selection for equipment.  
  **Reason:** Cheapest-first consumption is unsafe for rare inputs.

- **Decision:** First complete slice is oak/redwood bow + ruby/sapphire.  
  **Reason:** It exercises discovery, harvesting, material traits, workmanship, gems, combat, save, UI, and Vault with minimal content.

- **Decision:** Metalworking follows after bowcraft.  
  **Reason:** It proves architecture reuse without blocking the first playable result.

- **Decision:** No public scarcity claim while game state is client-authoritative.  
  **Reason:** Local saves can be modified and cannot prove legitimate acquisition.

- **Decision:** Pre-v1/unversioned saves are not compatibility targets during private testing.  
  **Reason:** The user is the only tester and explicitly approved resetting obsolete saves; prefer a smaller strict current schema over migration complexity.

- **Decision:** Legacy crafted items with random affixes become unobtainable once crafting rolls only workmanship (Task 11).  
  **Reason:** Intentional scarcity — existing magic items become legacy collector pieces (`source: "legacy"`); no new random-affix crafts can ever be created.

---

## 14. Progress tracking template

Update this section during implementation.

### Progress

- [x] Task 0 — current save boundary isolated and green
- [x] Task 1 — current harvesting locked down
- [x] Task 2 — resource domain
- [x] Task 3 — item forms/stat resolution
- [x] Task 4 — resource inventory
- [x] Task 5 — deterministic nodes
- [x] Task 6 — resource visuals
- [x] Task 7 — skill-gated harvesting
- [x] Task 8 — depletion/discovery persistence
- [x] Task 9 — exact recipe roles
- [x] Task 10 — advanced bow recipe
- [x] Task 11 — workmanship separated from magic
- [x] Task 12 — gems/inlay
- [x] Task 13 — advanced Work UI
- [x] Task 14 — presentation/combat/appraisal
- [x] Task 15 — mining/refining/sword
- [x] Task 16 — save migrations
- [x] Task 17 — Vault v3
- [x] Task 18 — browser smoke
- [x] Task 19 — balance/expansion gate (READY after skill-banded workmanship minimums)

### Surprises and discoveries

Record unexpected code coupling, migration edge cases, balance findings, renderer constraints, and user-playtest observations here as they occur.

- **Task 19 gate remedy (2026-09-20):** the gate held on max-skill ordinary workmanship >50% on rare inputs. Shipped the approved hybrid: grade margin bonus (choice +15, pristine +30) plus a floor — skill ≥80 with choice/pristine primary stock never rolls ordinary (mass moves to fine; exceptional never floored). Gate flipped HOLD → READY. `rare.test.ts` covers floor/shift/legacy paths; Work gump preview shows grade-adjusted odds.
- **Acquisition drift:** the committed gate report pre-dated "wild woods keep to named groves." Re-run against the groves world: redwood bow body p50 ≈ 5,485 node inspections (~2.3 h modeled) vs 758 before — redwood is Southmere-only now. Legal combinations 22,656 → 90,624 from catalog growth since the last recorded run. Scarcity is intentional; re-run `npm run gate:crafting` after any world/catalog change to keep evidence honest.
- **Ironwood shipped (2026-09-21, `7e0be7a`):** the last Phase J timber — master-tier northern wood (identify 55 / extract 70 / tool 2), damage trait, taiga-tundra groves at Wolfhollow and Ridgewatch, saw at carpentry 45. Lesson: a new timber species also needs an authored GLB — `timber-renderer.test.ts` pins `TIMBER_IDS` == canonical catalog list, and the manifest must carry every species' hash. `build_timber.py` gained a `TIMBER_ONLY=<species>` single-species mode that merges into the manifest without re-touching sibling GLBs.

### Outcomes and retrospective

Complete after each release:

- What became playable?
- What evidence passed?
- What was deferred?
- Did any system become more complicated than the player-facing value justified?
- What should be simplified before adding another resource family?

---

## 15. Recommended starting execution

Start with **Tasks 0–3 only**:

1. finish and isolate the existing save migration;
2. lock down current harvest behavior;
3. add resource/catalog contracts;
4. add item forms and deterministic stat resolution.

Stop at that gate for architecture review before changing world generation or player inventory. This establishes the vocabulary and compatibility layer for the entire update while keeping current gameplay visually and behaviorally unchanged.

After that review, execute the first playable vertical slice in this order:

```text
Deterministic oak/redwood nodes
→ typed harvesting and inventory
→ exact bow materials
→ redwood trait
→ workmanship
→ ruby/sapphire inlay
→ tooltip/combat/save
→ Vault v3
```

This is the fastest safe path to a real, testable result without attempting the whole economy in one patch.
