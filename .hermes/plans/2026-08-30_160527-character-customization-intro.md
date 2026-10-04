# Emberhall Character Customization, Intro Cinematic, and Custom Parts — Implementation Plan

**Date:** 2026-08-30
**Status:** Proposed — pending owner review of Decision Points (§13)
**Scope:** Player appearance customization, first-run intro cinematic, player-sculpted custom parts, and (at launch) on-chain parts.
**Neighbors:** Deep Crafting & Resource Economy plan (`2026-08-30_150239-deep-crafting-resource-economy.md`). Coordination rules in §3 are binding on both plans.

---

## 1. Overview and intent

Emberhall today renders every player identically: hard-coded `SKIN`/`HAIR` constants, class-colored chest, equipment-driven wear slots. There is no intro, no character setup, and no way for a player to be visibly *themselves*.

This plan adds, in safe phases:

1. a **look recipe** (`emberhall.look/1`) — skin tone, hair style/color, accessory, aura, name, class — stored on the player record with explicit defaults;
2. a **character setup gump** with a live 3D preview of the real in-game figure;
3. a **first-run intro cinematic** rendered with the actual vale (live camera, no pre-rendered art pipeline);
4. a **voxel part creator** (`emberhall.part/1`) so players sculpt their own hair/hat-style parts in Emberhall's native box-mesh art style;
5. at launch only: parts mint as 1Sat ordinal NFTs through the Vault, sharing one canonical-payload convention with the crafting plan's Vault v3.

**Provenance.** This architecture was designed and proven in a sibling project (Grydbound: paperdoll engine, forge wizard, intro, pixel part editor; local commits `72b49d3`, `52ec6ad`, `147806c`, `2c6151a`). What transfers **as pattern**: recipe/schema design, runtime part registry, validation rules, editor interaction model (undo, tools, live mannequin), per-phase gates. What is **rebuilt natively**: all rendering (voxel mesh parameters, not 2D pixels), the editor (voxel sculptor, not pixel canvas), the intro (live camera, not art panels), and all UI (Emberhall gump style).

---

## 2. Current state (verified 2026-08-30)

- `src/components/game/people-meshes.tsx` — `Figure` assembles the player from `boxGeometry` parts: legs/feet/chest/arms/hands/head/hair cap/hood/cloak/backpack/held items. `SKIN = "#c9c3b6"` and `HAIR = "#3a322c"` are module constants (lines 15–16); chest/legs/feet/hands derive from `WEAR_HEX` by wear slot (lines 17–32, 304–321); `ghost` mode overrides all materials (death state).
- `src/game/types.ts` — `Person` (line 248) has identity (`name`, `cls`), vitals, position, `ghost`. **No appearance fields.**
- `src/game/catalog.ts` — `CLASS_META` (line 122): ranger, warrior, mage, rogue, merchant (label + color).
- `src/game/world.ts` — new player starts `cls: "ranger"` (line 390).
- `src/game/save.ts` — `SAVE_KEY = "emberhall-save-v4"`, `CURRENT_SAVE_VERSION = 1`, sequential `migrateSave` with explicit defaults; rejects future versions. **Dirty in the worktree with untracked `save.test.ts` — owned by crafting Task 0.**
- `src/game/store.ts` — boot flow: `fresh` → `clearSave()` + `resetWorld()`, else `loadSave()`; loading notes ("Laying the hills." … "The door is open."); phase becomes `"playing"`. Gump visibility is store-driven (`openCraft`, `openVault`, `openSettings`, …).
- `src/components/game/hud.tsx` — mounts all gumps (`GateGump`, `NpcGump`, `YouDressing` (paperdoll), `SpellbookGump`, `CraftGump`, `VaultGump`, `SettingsGump`).
- `src/game/names.ts` — `GIVEN`/`SURNAMES` pools + `personName(rng)`.
- `src/game/vault.ts`, `src/chain/oneSat.ts`, `src/components/game/vault-gump.tsx` — 1Sat ordinal mint/redeem exists.
- Tests: `node --test 'scripts/**/*.test.mjs'` + `node --experimental-strip-types --test` over listed `src/game/*.test.ts` (see `package.json` `test` script). Gate: `npm run check` = lint + test + typecheck + build + `check:auth`. Dev server: `npm run dev` (port 8080). Playwright available for browser checks.
- Single route app (`src/routes/index.tsx`); intro/setup mount as overlays/gumps, not routes.

---

## 3. Constraints and coordination with the crafting plan

The deep-crafting plan and this plan touch the same files: `types.ts`, `player.ts`, `store.ts`, `save.ts`, `hud.tsx`, `package.json`.

**Binding rules:**

1. **Crafting Tasks 0–3 land first.** No character code touches the repo until the crafting foundation gate (save isolation, harvest lock-down, resource/item-form contracts) is green. Exception: §4 read-only recon and this document.
2. **Save-version discipline.** The crafting plan owns `CURRENT_SAVE_VERSION` increments. This plan introduces **no save-version bump**: `look` and `introSeen` are optional fields resolved with explicit defaults at read time (the pattern `migrateV0ToV1` already established). If a bump ever becomes unavoidable, the character plan takes the *next* number after whatever crafting has defined at that moment, and the migration must be additive-with-defaults.
3. **One Vault convention.** Part minting (Phase 5) reuses the crafting plan's Vault v3 canonical payload rules (deterministic serialization, validation, unique-only eligibility). No parallel NFT schema.
4. **Shared authority boundary.** Both plans: local-first, client-authoritative, honestly labeled beta. No scarcity claims before server authority (crafting §10 applies verbatim to looks/parts).
5. **One gate.** `npm run check` must pass after every phase of either plan. Neither plan may land red.

---

## 4. Domain model

### 4.1 Look recipe — `emberhall.look/1`

```ts
type LookRecipe = {
  schema: "emberhall.look/1";
  name: string;                 // player-chosen; validated, bounded
  cls: ClassId;                 // chosen at creation (see DP3)
  body: string;                 // skin tone id from catalog
  hair: { style: string; color: string };   // style id + hex from curated palette
  accessory: string | null;     // catalog id or custom part id ("u_…"), head slot
  aura: string | null;          // cosmetic ground-ring/palette id; never a stat
};
```

- `Person` gains `look?: LookRecipe | null` (player only; NPCs keep class-driven rendering).
- **Equipment stays equipment.** Wear slots keep driving chest/legs/feet/hands/head exactly as today. The look customizes what equipment does not: skin, hair (shown when no helm/hood, matching today's hair-cap rule), accessory (a *cosmetic* head layer under helms), aura (cosmetic ring/glow).
- Resolver: `resolveLook(look | null) -> FigureParams` — pure, deterministic; `null` returns today's constants. `Figure` consumes `FigureParams`; no other renderer changes.

### 4.2 Catalog (`src/game/look/catalog.ts`)

- 6 skin tones (curated to Emberhall's palette).
- 6 hair styles as **voxel definitions** (box lists, e.g. crop, mop, braid, long, topknot, shaved), each rendering ≤ 6 boxes, positioned relative to the head box.
- 12-color hair palette.
- Accessories: circlet, band, beard (jaw boxes), none — bounded box lists.
- Auras: none / ember glow (warm ring, additive, subtle) — cosmetic only.
- Catalog ids are **frozen once shipped** (same rule as crafting catalogs).

### 4.3 Custom parts — `emberhall.part/1` (Phase 4)

```ts
type PartRecord = {
  schema: "emberhall.part/1";
  id: string;                   // "u_head_<base36time>_<rand>"
  name: string;                 // bounded
  slot: "head";                 // v1: head only
  voxels: { x: number; y: number; z: number; c: number }[];  // c = palette index
  palette: string[];            // ≤ 8 hex colors
  author: string;               // local label; wallet id at mint time
  createdAt: number;
  rev: number;
};
```

**Validation:** grid bounds (12 wide × 8 tall × 12 deep, anchored above the head box), ≤ 64 voxels, ≤ 8 colors, must be connected (single component, no floating cubes), ≥ 4 voxels, name 1–24 chars. Validation mirrors Grydbound's `customParts.ts` pattern (size/coverage/anchor rules) in voxel terms.

**Storage:** per-save on the player (`player.customParts?: PartRecord[]`, capped at 16) — travels with the save, no separate localStorage key, no save-version bump (optional field, explicit default).

**Rendering:** each part resolves to one merged geometry per figure (never one mesh per voxel — see §9).

---

## 5. Phases, tasks, and acceptance

### Phase 0 — Lock today's figure and boot (no behavior change)

**Objective:** Baseline before touching rendering.

**Tasks:**

- **Task 0:** Wait for crafting Tasks 0–3 green. Confirm `git status` shows only crafting-owned files.
- **Task 1:** Characterize the current figure: `src/game/look/resolve.test.ts` pins today's default `FigureParams` (skin/hair hex, hair-cap visibility vs hood rules, cloak rules per class/ghost). These tests must pass *before and after* every later phase for a `null` look.
- **Task 2:** Screenshot baseline (desktop + mobile) of the player figure in-world and the boot sequence; store under `scripts/baselines/`.

**Gate:** new tests pass with zero source changes outside `src/game/look/` and `scripts/baselines/`.

### Phase 1 — Look domain (no visible change)

**Objective:** Contracts + resolver + storage, all default-invisible.

**Files:**

- Create `src/game/look/types.ts`, `catalog.ts`, `resolve.ts`, `resolve.test.ts`, `catalog.test.ts`
- Modify `src/game/types.ts` (`Person.look?`, `Person.introSeen?` — optional, documented defaults)
- Modify `package.json` (add new test files to the `test` script)

**Tests:** catalog integrity (unique ids, valid hex, box budgets, hair fits head bounds), resolver determinism, `null` → exact legacy params, unknown ids rejected, recipe round-trip.

**Gate:** `npm run check` green; gameplay visually identical (baseline screenshots diff-clean).

### Phase 2 — The Looking Glass (character setup gump)

**Objective:** Players create and edit their look through a native gump with a live 3D preview.

**Files:**

- Create `src/components/game/look-gump.tsx` — tabbed wizard (Class → Body → Hair → Adorn → Name), live rotating `Figure` preview in a small embedded R3F canvas, "Fate's hand" randomizer, name roller using `names.ts` pools, save/cancel
- Modify `people-meshes.tsx` — `Figure` accepts optional `FigureParams` (defaults preserve every current caller)
- Modify `src/game/store.ts` — `openLook` panel state + first-run hook: after a `fresh` boot, open the Looking Glass before `phase: "playing"` completes (skippable; skip = default ranger look)
- Modify `src/components/game/hud.tsx` — mount the gump
- Modify `src/components/game/settings-gump.tsx` — "Change appearance" re-opens it

**Class rule (DP3):** class is chosen at creation only for beta. What `cls` drives (stats/skills/spawn gear) must be enumerated in `resolve.test.ts` before the class tab is enabled.

**Acceptance:** new game → setup → chosen skin/hair/class visible on the in-world figure → save → reload preserves look → `null`-look legacy saves render exactly as before → editing via Settings round-trips.

### Phase 3 — Intro cinematic (live vale)

**Objective:** A first-run cinematic using the real world, not an art pipeline.

**Design:** 4–5 story beats as full-screen text cards over a slow camera path across the player's actual generated vale (hall, court, wilds, dawn lighting via existing `sky.tsx`/`lighting.tsx`). One soft chime per beat (existing feedback/audio conventions if present; otherwise a tiny synth helper mirroring the established pattern). Tap/click/→ advances; Esc/Skip; final card CTA opens the Looking Glass.

**Files:**

- Create `src/components/game/intro-cinematic.tsx` (+ optional `src/game/intro/beats.ts` for text, unit-tested for presence/length bounds)
- Modify `src/game/store.ts` — boot order on fresh games: world ready → intro → Looking Glass → `phase: "playing"`
- Modify `src/game/types.ts` — `introSeen` default rule: absent on a **restored** save ⇒ treated as seen; fresh world sets `false` explicitly; completing/skipping sets `true`

**Acceptance:** fresh boot plays intro once; reload never replays; restored legacy saves never see it; skip lands in the Looking Glass; no console errors; desktop + mobile screenshots readable.

### Phase 4 — Voxel Part Creator

**Objective:** Players sculpt `emberhall.part/1` head parts in the native box style.

**Files:**

- Create `src/game/look/parts.ts` — schema, validation (§4.3), runtime registry (`registerCustomPart`, `partById` consults it; `u_preview_*` internal ids hidden from pickers — the leak we already fixed once upstream)
- Create `src/game/look/parts.test.ts`
- Create `src/components/game/voxel-editor.tsx` — 12×8×12 grid editor: place/erase/paint/fill-layer, undo (cap 40), palette ≤ 8, ghost head-box guide, live `Figure` mannequin wearing the part
- Modify `look-gump.tsx` — Adorn tab gains "Your sculptures" + "Sculpt new"; ✎ ribbon on custom parts
- Modify `people-meshes.tsx` — accessory slot renders resolved voxel parts (merged geometry)

**Acceptance:** sculpt a part → mannequin wears it live → save → part appears in the picker → equip → save/reload persists → validation rejects: floating voxels, > 64 voxels, out of bounds, > 8 colors, empty, name overflow.

### Phase 5 — On-chain parts (launch flip only)

- Custom parts mintable as 1Sat ordinal NFTs through the Vault, using the crafting plan's v3 canonical payload conventions (deterministic serialization, unique-only, validated).
- Inscription = part JSON + tiny preview PNG (generated off-chain at mint, bounded size).
- Tradable through existing trade surfaces when they exist.
- Clear beta labeling until server authority (crafting §10).
- Stretch (not promised): creator royalties.

**Do not start Phase 5 before the crafting plan's Vault v3 (its Task 17) exists.**

---

## 6. First playable vertical slice

```text
fresh vale
→ intro flyover (skippable)
→ Looking Glass: pick class, skin, hair, name
→ walk the vale as YOUR figure
→ save → reload → look intact
→ Settings → Change appearance → tweak → saved
```

Then, Phase 4 slice: sculpt a 20-voxel hat → wear it in-world → reload → still yours.

Each slice is independently playable and rollback-safe (look fields are optional; removing the feature code restores legacy rendering exactly).

---

## 7. Save compatibility strategy

- No `CURRENT_SAVE_VERSION` bump from this plan. `look`, `introSeen`, `customParts` are optional; readers apply explicit defaults (`null` look = legacy constants; absent `introSeen` on restored save = seen).
- If the crafting plan's Task 16 bumps the version first, these fields ride along unchanged — migrations stay sequential and additive.
- Fixtures: add one legacy-save fixture (no look) and one look-bearing fixture to the crafting plan's fixture directory convention when it exists; both must round-trip.

---

## 8. Test matrix and commands

**Unit (node --experimental-strip-types --test):** catalog integrity, resolver determinism, legacy-default parity, part validation (all reject cases), registry behavior (id collision, internal-id hiding), intro beats presence, save default rules.

**Integration:** figure renders look params; wear-slot precedence over look; ghost mode overrides look; class tab applies real `cls` consequences.

**Browser (Playwright / existing smoke scripts):** fresh-boot intro → setup → in-world identity; reload persistence; gump usability at 1280×800 and 390×844; no console/page errors; no canvas overflow.

```sh
# targeted during development
node --experimental-strip-types --test src/game/look/resolve.test.ts
node --experimental-strip-types --test src/game/look/catalog.test.ts
node --experimental-strip-types --test src/game/look/parts.test.ts
# full gate after every milestone
npm run check
```

---

## 9. Performance budgets

- Look resolution is pure and memoized per figure; never resolved per frame.
- Hair/accessory/aura add ≤ 10 boxes per figure; custom parts render as **one merged geometry** per figure (merge at equip/registry time, cache by part id + rev).
- No new materials per part: share a small `meshStandardMaterial` pool keyed by hex (the file already centralizes materials).
- Intro adds no assets; it reuses the live scene (one camera path, no extra geometry).
- Save payload growth: measured with 16 custom parts (≤ 64 voxels each) before Phase 4 ships.

---

## 10. Security and economy boundaries

- Local-first, client-authoritative, labeled beta — identical posture to crafting §10. No scarcity or value claims for looks/parts before server authority.
- Wallet keys stay behind the existing wallet interface; fees shown separately.
- Bounded payloads: voxel count, palette size, name length, part count per save — all enforced in validation.
- No world coordinates or player-identifying data in part metadata.
- Server verification required before public trading of parts (mirrors crafting: mint authorization for one exact payload, pending/minted/redeemed state, audit history).

---

## 11. Rollout

- **Release A:** Look foundation + Looking Glass (Phases 0–2). Players make themselves.
- **Release B:** Intro cinematic (Phase 3). First-run story.
- **Release C:** Voxel sculptor (Phase 4). Players make things.
- **Release D (launch):** Phase 5 mint flip, after crafting Vault v3 and its own balance gate.

Every release is independently playable; removing the feature restores legacy rendering bit-for-bit (Phase 0 parity tests prove it).

---

## 12. Risks and mitigations

1. **Collision with crafting work** → §3 binding rules; no character code before crafting Tasks 0–3 green.
2. **Save corruption** → optional fields + explicit defaults only; fixtures; no version bump.
3. **Visual drift from the voxel aesthetic** → parts constrained to the same box vocabulary, curated palettes, head-slot bounds, screenshot review.
4. **Draw-call creep** → merged geometry per figure, material pooling, budgets in §9 with measurement.
5. **Class choice quietly changing game balance** → DP3: enumerate `cls` consequences in tests before enabling; creation-only for beta.
6. **Custom-part garbage (offensive/oversized)** → validation bounds + local-only for beta + report/hide tooling before any public sharing.
7. **Intro annoyance** → plays once per character, skippable, never on restored saves.
8. **Scope creep into equipment visuals** → look never touches wear slots; equipment stays equipment (crafting plan owns item visuals).

---

## 13. Decision log and open decision points

**Decided:**

- **Decision:** Voxel-mesh compositing, not 2D paperdoll. **Reason:** Emberhall renders people as box-mesh figures; the look system must speak the same vocabulary.
- **Decision:** Look is optional-with-defaults; no save-version bump. **Reason:** Zero collision with crafting migrations; legacy saves render bit-identical.
- **Decision:** Equipment keeps owning wear-slot visuals. **Reason:** Avoids fighting the crafting/equipment systems; customization lives where equipment is silent (skin, hair, cosmetic accessory, aura).
- **Decision:** One Vault convention shared with crafting v3. **Reason:** No parallel NFT schemas.

**Decision points — RESOLVED (2026-08-30, owner-approved lane):**

- **DP1 — Custom part editor:** **voxel sculptor.** Native to the box-mesh art; 2D decals would clash with the 3D figures.
- **DP2 — Intro rendering:** **pre-rendered art panels.** Resolved by deed — five commissioned panels (Gemini, owner-directed) are already wired into the cinematic (`intro_{vale,hall,folk,land,arrival}.png`). The live-flyover idea is retired; the panels won on beauty.
- **DP3 — Class mutability:** **freely changeable.** Audit (2026-08-30): `cls` drives nothing mechanical for the player — no gates in magery/combat/loot/skills; player chest color comes from equipment; HUD shows "You" over any class label; `CLASS_META` colors NPCs only. If class later gains mechanics, gate changes behind a guild/shrine then — the look recipe stores `cls` as plain data, so tightening needs no migration.
- **DP4 — Setup framing:** **the Looking Glass** — a diegetic gump: the intro's final card ("Answer the door") steps you inside your hall, where the glass makes you *you*. No world-object dependency in beta.

---

## 14. Progress checklist

- [x] Phase 0 — crafting Tasks 0–3 confirmed green; figure/boot baseline locked (gate approved 2026-08-30)
- [x] Phase 1 — look domain + tests; gameplay visually identical (`e99b87e`…`76ee876`; parity tested)
- [x] Phase 2 — Looking Glass setup; first-run hook; live preview (`76ee876`; wired via `367280e`)
- [x] Phase 3 — intro cinematic; once-per-character; skip-safe (`3799c5b`, `daad584`; wired via `367280e` — fresh saves only, Continue skips)
- [x] Phase 4 — voxel sculptor; validation; persistence (`11d8980` + renderer wiring in `367280e`)
- [ ] Phase 5 — mint flip (blocked on crafting Vault v3 + launch decision)

> **MERGED 2026-08-30:** lane rebased onto Tasks 0–3 and fast-forwarded to `main` at `367280e`. Full gate on main: ESLint 0 warnings, **186/186 tests**, tsc, build, auth-invariant — all green. Live-verified: New hall → raising → intro (5 commissioned panels) → Looking Glass → playing as Wren Ashdown with look in save; Continue skips both ceremonies with the look intact.

### Surprises and discoveries

Record coupling surprises, `cls` consequence audit results, renderer budget findings, and playtest observations here.

---

## 15. Recommended starting execution

1. Owner answers DP1–DP4 (§13).
2. Confirm crafting Tasks 0–3 are green and the worktree is clean of anything but crafting-owned files.
3. Execute Phase 0 (baseline), then Phase 1 (domain), and **stop** for review before any visible change.
4. Then Phases 2 → 3 → 4 in order, one local commit per phase, `npm run check` after each, browser-verified before claiming done.

This keeps Emberhall playable at every step, never fights the economy overhaul, and lands player identity in the safest possible order.
