# Water survival slice — audit and pre-implementation rules

Task `t_dd0f07c3` (audit/spec only). Status: **proposed, not implemented.**
Implementation is gated to `t_77f1af48`; root goal `t_086e14fb`. This document
is the contract that card must implement against. No code changes are made
here. All file/line references are against `wt/t_dd0f07c3` @ `8d3c1e7`
(Emberhall `main`, 2026-11-24).

**Boundaries (owner decisions, binding):**

- Deferred follow-up selected by the owner 2026-11-23 for overnight Qwen work.
  It must **not** block Phase 4 character creation, unleash integration, or
  onboarding, and must not consume their fleet capacity.
- **No general boating/swimming redesign.** Water stays non-walkable terrain;
  this slice adds thirst, a drink action, and a narrow drowning rule for the
  one edge case where a living body can already end up on water (fly expiry).
- The closed **Phase 3.6 baseline is preserved**: it did not establish thirst,
  drowning, or water-pressure survival. Its historical projected cost
  (`$0.08634750361415493` per agent per wall day, `docs/phase-3.6-evidence.md`)
  is a closed record and is not edited or re-baselined by this slice.
- Local-only: no push, deploy, chain actions, or paid providers without
  explicit authorization. The proof plan below is zero-paid-cost by design.

---

## 1. Audit — implemented behavior (verified against code)

### 1.1 Vitals

- `Person` carries `hunger`, `energy`, `morale` (`src/game/types.ts:399`).
  There is **no thirst field** anywhere in `src/` (the only "thirst" mention
  in the repo is the limitation note in `docs/phase-3.6-risk-cadence.md`).
- Decay (`src/game/sim.ts:166-170`, `tickWorld`): for each person that is
  `isPlayer` **or has a `playerStates` entry** (hosted bodies — the `actorId`
  routing at `sim.ts:166-167`), while not ghost and not sleeping:
  `hunger -= 3.2 * dt / 36`, `energy -= 2.4 * dt / 36` per vale-hour
  (`SECONDS_PER_HOUR = 36`, `src/game/catalog.ts:5`).
- **Neither hunger nor energy causes HP damage at zero.** There is no
  starvation, exhaustion, or dehydration damage anywhere in the sim. The
  manual states this explicitly: "the vale will not yet kill you for
  ignoring them" (`docs/vale-manual.md`, Survival). Energy has **no recovery
  source at all** (no sleep/bed energy restore exists; bed rest heals HP via
  the rest task, not energy). Morale is decorative.
- Food: `commandEat` (`src/game/player.ts:1039+`) restores hunger by item
  value; the host verb wire executes it (`src/server/shard.ts:32,49`,
  `VERB_KINDS = ["eat","track","bank_gold","bank_item","craft","equip"]`).
  The reflex autopilot synthesizes an "Eat … from pack" option because pack
  food is not a context-menu verb (`src/game/agent/autopilot.ts`, prepare).
- HUD: the paperdoll vitals row shows Health / Mana / Belly chips
  (`src/components/game/paperdoll.tsx:215-222`). No thirst display exists.

### 1.2 Night pressure

- Night is `hour < 5 || hour >= 20` (`isNight`, `src/game/catalog.ts:86`).
  The reflex quiet window is 22:00–06:00 (`src/game/agent/scheduler.ts:25`,
  `inQuietWindow`); non-survival triggers are dropped inside it, survival
  triggers bypass it and are retained across cooldown/failure
  (`scheduler.ts:281-282,341-373`).
- `NIGHT_HUNTERS` (wolf, pine_lynx, ridgeback_warg, brine_hound, brine_troll,
  barrow_hound, stonefang_ogre, orc_marauder, reedback_stalker, orebeetle, …;
  `src/game/ecology.ts:125+`) aggro at night within 10 tiles
  (`ecology.ts:649-655`) — **but the target is only
  `world.people.find(p => p.isPlayer)`** (`ecology.ts:601`), the legacy solo
  camera body. This is deliberate and documented: "the multi-actor threat
  table is deferred to the host and must NOT appear here"
  (`docs/actor-ownership-weather-ai.md:35-42`,
  `src/game/ai-targeting-policy.test.ts` header).
- **Consequence for hosted agents:** a fresh dedicated agent on the shard
  (`isPlayer: false`, `src/server/shard.ts:118-127`) is **not** passively
  hunted at night. Fauna damage reaches a hosted body only through
  retaliation when the agent itself attacks (`src/game/player.ts:883`,
  `RETALIATE_KINDS`, melee or bow < 1.8 tiles) or through boss-zone mechanics
  (Emberdeep / gloomwraith / warden, which also target the legacy body).
  Night pressure for a hosted agent today is therefore **cadence-only**
  (quiet window, nightfall/daybreak events). Adding a multi-actor threat
  table is out of scope for this slice (see decision D7).

### 1.3 Water tiles and movement

- Water generation: the starter river runs y ≈ 384 ± 2 across x 6..506 with
  a **dry ford gap at |x − 256| ≤ 6** (`src/game/world.ts:134-137`); lakes at
  `world.ts:137-143`; frontier rivers and the Reedwake bridge
  (`src/game/frontier.ts`, `src/game/river-bridge.ts` — the bridge deck is a
  canonical walk surface, water stays below, `river-bridge.test.ts`); the
  **starter pond** is a 7×7 basin centered (247, 301), ~13 water tiles,
  sand-ringed, with a graded approach (252,300) h2 → (252,301) h1
  (`src/game/emberhall-pond.ts:24-36`). Court spawn is (256, 292)
  (`src/game/atlas.ts:13`); the pond's north-east shore is ~9 tiles from a
  fresh spawn at (256, 293).
- **Water is strictly non-walkable** for living bodies: `kindWalk` excludes
  it (`src/game/pathfinding.ts:14-21`). `canStep` validates only the
  *destination* tile plus climb and diagonal shoulders
  (`pathfinding.ts:107-124`) — so a body already standing on water **can**
  path back to shore (water h0 → sand h1 is a legal climb). `astar` snaps
  non-walkable goals to `nearestWalkable` (r = 6); `landAt` (teleport,
  `src/game/magery.ts:29-38`) and gate travel (`src/game/gates.ts:76`) also
  use `nearestWalkable`, so **no teleport can land a body on water**.
- **The fly spell is the one existing way a living body ends up on water:**
  while `world.hour < flyUntil`, pathfinding uses `fly = true` (water/rock/
  rise passable, walls still bar; `pathfinding.ts:112-116`) and movement runs
  at `FLY_SPEED = 1.7` (`catalog.ts:64`, `sim.ts` followPath). When fly
  expires mid-crossing, the body is left standing on a water tile with the
  remaining path; `followPath` revalidates legs only on `landRev` changes
  (`src/game/sim.ts`), and fly expiry is not a terrain change, so the body
  simply keeps walking the planted path. **Today this is harmless** — no
  drowning, no slowdown, no log. Ghosts cannot cross water (walkable
  excludes it; ghost speed bonus is not fly).
- **No swimming, boating, drowning, or drink mechanic exists.** "drown"
  appears only in the fauna name `drowned_reaver`. Fishing is the only water
  interaction: water tiles offer the `fish` verb (`src/game/context.ts:83`),
  `commandFish` requires the target tile to be water and a held fishing rod
  (`src/game/player.ts:308-313`), and `fishNow` re-checks the water, rolls
  `successChance(fishing, 18)`, and yields `raw_fish`
  (`player.ts:763-776`). The fresh-host pack template (`emptyPack`,
  `world.ts:411-421`) includes `fishing_rod: 1`, `raw_fish: 1`, `cabbage: 2`,
  `bandage: 3` — but **no bread and no water item**.

### 1.4 Agent observations and reflex responses

- `BodySheet` = `{id, name, x, z, hp, maxHp, hunger, energy, ghost, task,
  pack, gold, wear, skills}` (`src/game/agent/types.ts`). `Observation` =
  `{tick, hour, isNight, weather, you, people, fauna, piles, buildings,
  plots, herbs, verbs, logTail}`. **There is no terrain or water awareness**
  in the observation: an agent only sees water through the tile verb menu
  (`TILE_MENU_RADIUS = 2`, `src/game/agent/candidates.ts:25`) when it is
  already within 2 tiles of it. `AGENT_OBS_RADIUS = 24`
  (`src/game/agent/observe.ts:27`).
- The shard pushes an observation whenever the body/verb-menu hash changes
  (`src/server/ws.ts:41-46`); the host ticks at 10 Hz with `world.speed = 1`
  (`world.ts:432`), so one vale day = 864 sim-seconds ≈ 14.4 wall-minutes.
  `WALK_SPEED = 2.6` tiles/sim-second (`sim.ts:22`) — the pond shore is
  ~3.5 sim-seconds (~0.1 vale-hour) from court spawn.
- Reflex pipeline: `deriveEvents` is edge-triggered
  (`src/game/agent/events.ts:158+`; `DEFAULT_EVENT_CONFIG`: hungerLow 25,
  hungerCritical 10, energyLow 25, energyCritical 10, hpCriticalFraction
  0.25, hostileRadius 8); one-shot `boot` event on first observation.
  Survival triggers bypass the quiet window and survive failed attempts
  (`scheduler.ts`). Prepared decisions replay deterministically
  (`src/game/agent/reflex.ts`: normalize → topPick, first-max ties).
  The live proof harness (`scripts/phase36-live.mjs`) is opt-in, local-only,
  requires a dedicated `ws://127.0.0.1` host + identity, and drives
  `createReflexAutopilot` with an injected backend.

### 1.5 Persistence

- Save format version **6** (`CURRENT_SAVE_VERSION`, `src/game/save.ts:10`).
  `isPerson` requires `hunger` and `energy` to be finite numbers
  (`save.ts:377-379`); a new vitals field must be added to validation.
  Migration chain v1→v6 lives at `save.ts:671-741` (pattern: default-fill
  missing fields, then bump). `playerStates` serializes the whole `Person`
  by spread (`save.ts:750`), so a new `Person` field rides along automatically
  once validation accepts it.
- Hosted bodies hydrate through `hydrateWorld` (`src/server/hydrate.ts`),
  which default-fills missing optional fields on the actor template — the
  established place to default a new vitals field for old saves.
- Host body creation: `createPerson(world, rng, {x: COURT.tx, z: COURT.ty+1,
  cls: "ranger", member: true, isPlayer: false, name})` with actor template
  `createStubWorld().player` (`src/server/shard.ts:118-135`) → a fresh
  dedicated agent starts at court with hunger 80, energy 80, the emptyPack
  kit, and the ranger skill spread.

### 1.6 Relevant tests (existing coverage to extend, not break)

`src/game/fishing.test.ts`, `pathfinding.test.ts`, `movement.test.ts`,
`actor-consumption.test.ts`, `actor-save.test.ts`, `save.test.ts`,
`emberhall-pond.test.ts`, `river-bridge.test.ts`, `frontier-river.test.ts`,
`src/game/agent/{risk-cadence,autopilot,scheduler,hostfeed,intent-dispatch,
integration,replay-safety}.test.ts`, `src/server/{shard,ws,save-decode}.test.ts`.
**Registration requirement:** `npm test` runs an explicit file list
(`package.json:22`) — every new test file must be added there. Full gate:
`npm run check` = lint && test && typecheck && build && check:auth.

---

## 2. Missing mechanics (gap list)

1. No thirst meter, no dehydration damage, no death-by-thirst path.
2. No drink action (verb, command, or wire); water is fish-only.
3. No water awareness in `Observation` — a reflex agent cannot know water
   exists until it stands within 2 tiles of it, so it cannot seek water.
4. No drowning rule; fly-expiry-over-water is silently harmless.
5. No reflex events/options for thirst or in-water survival.
6. No thirst persistence/validation; no thirst HUD; manual does not mention
   water pressure.

---

## 3. Proposed minimal slice (rules for `t_77f1af48`)

All tunables live in one constants block (proposed: `src/game/survival.ts`
or alongside the existing catalog constants) so tuning is a one-file change.
Numbers below are **proposals**; owner confirmation is decision D1/D2/D4.

### 3.1 Thirst (player-visible)

- New `Person.thirst: number`, 0..100, **start 80** (matches hunger/energy
  defaults, `world.ts:333-334`).
- Decay **4.8 per vale-hour** (1.5× hunger) for living, non-sleeping player
  actors — same routing as hunger (`sim.ts:166-170`, solo + hosted).
  Ghosts and sleepers do not decay. From 80: empty in **16.67 vale-hours**.
- Thresholds (mirror hunger's event shape):
  - `thirst ≤ 25` → log line + `vitals.thirst_low` event (**non-survival**;
    from 80 this fires at hour ≈ 11.46).
  - `thirst ≤ 10` → log line + `vitals.thirst_critical` (**survival**;
    hour ≈ 14.58 from 80).
  - `thirst = 0` → **dehydration: 1 HP per 0.25 vale-hour** (9 sim-seconds),
    logged each tick-beat, routed through the existing damage/death path
    (`dieAsGhost` — corpse, ghost, healer resurrection unchanged). At 40 HP
    an untreated body dies ~10 vale-hours after reaching zero.
- HUD: a `StatChip` (Droplet icon, label "Water", cyan) in the paperdoll
  vitals row beside Belly (`paperdoll.tsx:215-222`).
- `docs/vale-manual.md` Survival section gains the thirst rules and the
  drink instruction; the "will not yet kill you" sentence is amended to
  carve out thirst/dehydration (hunger/energy remain non-lethal this slice).

### 3.2 Drink (player-visible action)

- New tile verb **`drink`** on water tiles in `context.ts` (both `tileVerbs`
  and the click menu), label "Drink".
- `commandDrink(world, tx, ty, actorId?)`: requires the target tile to be
  water and the body adjacent (`pathBeside`, same geometry as fish);
  **no item, no skill, no cost**. Effect: `thirst = min(100, thirst + 40)`,
  one log line ("You drink deep." style). Refusals mirror existing command
  voice: not beside water → "You need to stand beside water."; tile no
  longer water → "The water is gone."
- Host wire: add `"drink"` to `VERB_KINDS` and `executeVerb`
  (`src/server/shard.ts:32,49`), with `tx/ty` carried like the existing
  targeted verbs; `validateVerb` unchanged otherwise.
- **All water tiles are drinkable this slice** (pond, river, lakes, frontier
  streams). Salt/brine distinction (brinegate, southmere) is deferred — D3.

### 3.3 Drowning (narrow rule, no swimming redesign)

- Trigger: a **living, non-ghost, non-flying** body whose rounded tile is
  water. Audit §1.3 shows the only current reach path is fly expiry
  mid-crossing; the rule is written generally so any future reach path is
  covered, but **no new way to enter water is added**.
- While in water: movement at **0.5× WALK_SPEED** (floundering; the existing
  path follower and `canStep` destination-only validation already let the
  body walk out — verified, no pathfinding change needed).
- **Grace 0.5 vale-hour (18 sim-seconds)** with one log line ("You are in
  over your head — reach shore!"), then **2 HP per 0.1 vale-hour**
  (3.6 sim-seconds) until the body reaches a walkable tile or dies
  (existing death path; corpse pile may sit on water — lootable from shore
  via `pathBeside`, resurrection unaffected).
- Flying (`hour < flyUntil`) and ghosts are immune. Re-entering fly while
  in water clears the drowning clock.
- Events: `vitals.in_water` (**survival**) on entering water;
  `vitals.drowning` (**survival**) when damage starts; cleared on shore.

### 3.4 Agent observations (additive wire fields)

- `BodySheet.thirst: number` (rides the existing hash → observation push).
- `Observation.water: {tx, ty, dist} | null` — the **nearest water tile
  within `AGENT_OBS_RADIUS` (24)**, computed by the sim (code supplies the
  prediction; the harness contract's division of labor,
  `docs/agent-harness-contract.md`). `null` when no water is in range.
  This is the minimal awareness that lets a reflex agent *seek* water
  instead of stumbling onto it.

### 3.5 Reflex responses (safe, deterministic, replayable)

- `deriveEvents` additions (`events.ts`, config thresholds beside
  `hungerLow/hungerCritical`): `vitals.thirst_low` (≤25, non-survival),
  `vitals.thirst_critical` (≤10, survival), `vitals.in_water` /
  `vitals.drowning` (survival). Edge-triggered exactly like hunger.
- Autopilot `prepare` additions (mirror the synthetic pack-food precedent,
  `autopilot.ts`):
  1. **In water** → top-priority synthetic option "Scramble to shore":
     `walk` intent to `nearestWalkable(bodyTile, r = 6)` (sim-computed).
  2. **Thirst ≤ 60 and a water tile within the verb-menu radius** →
     synthetic "Drink from water" option mapped to the `drink` verb wire
     (like "Eat … from pack").
  3. **Thirst ≤ 25, `obs.water` known, not adjacent** → synthetic
     "Go to water (N tiles)" option: `walk` intent to the nearest walkable
     shore tile adjacent to `obs.water` (sim supplies the tile; the reflex
     layer only chooses).
- Survival water responses must execute **without a paid backend**: the
  deterministic local provider used by the proof harness (and the existing
  replay path, `reflex.ts` topPick) selects the water option when the
  survival trigger is present. No new fallback machinery — reuse the
  existing prepared-decision replay.
- Quiet-window behavior is inherited: thirst_low is dropped 22:00–06:00;
  thirst_critical / in_water / drowning bypass and are retained on failure
  (existing scheduler semantics, no change).

### 3.6 Persistence semantics

- `thirst` lives on `Person` (with hunger/energy), so `playerStates` spread
  carries it (`save.ts:750`).
- **Save version 7**: migration default-fills absent `thirst` to **80** on
  load (v6 saves predate thirst; a returning body is not retroactively
  thirsty), following the v5→v6 pattern (`save.ts:671-741`). `isPerson`
  accepts `thirst` as finite when present; `hydrateWorld` default-fills the
  actor template. Drowning state is **not persisted** (it is re-derived from
  position each tick — a body saved on water resumes drowning on load, which
  is correct and needs no stored clock).
- Decision logs / replay records are unchanged in shape; thirst rides
  `BodySheet`, water rides `Observation`, both already inside the hashed
  observation payload.

### 3.7 Timing summary (vale-hours; sim-seconds at speed 1)

| Rule | Vale-hours | Sim-seconds |
|---|---|---|
| Thirst decay 80 → 0 | 16.67 | 600 |
| Thirst 80 → low (25) | 11.46 | 412.5 |
| Thirst 80 → critical (10) | 14.58 | 525 |
| Dehydration beat (1 HP) | 0.25 | 9 |
| Drowning grace | 0.5 | 18 |
| Drowning beat (2 HP) | 0.1 | 3.6 |
| Drink effect | +40 thirst | instant |
| Court → pond shore walk | ~0.1 | ~3.5 |
| Full vale day | 24 | 864 |

### 3.8 Edge cases (explicit)

- **Fly expiry over water** → drowning rule engages; body can path out
  (canStep destination-only, verified); re-casting fly clears the clock.
- **Sleep / ghost** → no thirst decay, no drowning.
- **Teleport / gates** → never land on water (nearestWalkable, unchanged).
- **Corpse on water** → loot from shore; resurrection unchanged.
- **Old save (v6)** → thirst defaults 80; no retroactive pressure.
- **Body saved standing on water** → drowning re-derived on load (no clock
  persisted); grace restarts.
- **Drink refusals** → not adjacent / water gone / unknown verb wire verb:
  sim log refusal, no state change (existing verb-wire ack semantics).
- **Rain / digging** → do not create water tiles today (holes wash to dirt);
  no new terrain interaction is added.
- **Hosted vs solo** → identical rules via the existing actorId routing;
  the solo camera body is unaffected in behavior except gaining thirst.

### 3.9 Non-goals (this slice)

Boating, swimming as a movement mode, water combat, salt/brine poisoning,
waterskin/flask items, fishing changes, energy recovery, starvation damage,
multi-actor fauna threat table (D7), any Phase 4 surface, any edit to the
closed Phase 3.6 evidence or cost record.

---

## 4. Full-vale-day demonstration (fresh dedicated reflex agent)

**Setup (existing conventions):** isolated local shard
(`scripts/phase36-live.mjs` pattern: dedicated `ws://127.0.0.1` host, one
fresh character key, seeded world), reflex-only autopilot (no mind), a
**deterministic local backend** (scripted probabilities — zero paid calls),
decision logging on. Fresh character = court spawn (256,293), ranger
template, hunger 80 / thirst 80 / energy 80, emptyPack kit
(fishing_rod, raw_fish ×1, cabbage ×2).

**Scenario A — full day, fresh defaults (the headline proof).** Run 24
vale-hours (864 sim-seconds ≈ 14.4 wall-minutes) from hour 0:

- hour ≈ 11.46: `vitals.thirst_low` → exchange offers "Go to water (9
  tiles)" → local backend picks it → walk intent → pond shore in ~0.1h.
- On arrival (water in verb menu): "Drink from water" offered → picked →
  thirst 25 → 65, `drink` verb ack in log. **Water pressure encountered and
  answered.**
- hour ≈ 17.2: `vitals.hunger_low` (80 − 3.2×17.2 ≈ 25) → "Eat … from pack"
  → raw_fish/cabbage eaten. **Food pressure encountered and answered.**
- hour 20: `world.nightfall`; hour 22: quiet window begins (non-survival
  triggers dropped); hour 05: `world.daybreak` + quiet-end wake event.
  **Night encountered** as cadence pressure (see D7 for why passive fauna
  aggro is not part of this proof).
- Trace sampled per vale-hour: thirst/hunger/hp/energy, position, event
  kinds, decisions. Acceptance: all three pressures appear in the trace,
  the agent survives the day, and total paid cost = 0.

**Scenario B — quiet-window survival bypass.** Fixture: hour 21.5, thirst
12 (host fixture sets initial vitals, same pattern as
`risk-cadence.test.ts`). `vitals.thirst_critical` fires inside the quiet
window → exchange must still be offered and executed (survival bypass).

**Scenario C — drowning edge.** Fixture: grant fly, plant a path across the
pond, expire `flyUntil` mid-water. Assert: in_water event → grace log →
2 HP beats → "Scramble to shore" option picked → body reaches walkable
tile → damage stops. Also assert a fly-active body crossing water takes no
damage.

**Scenario D — refusals, persistence, replay.** Drink from non-adjacent
tile refused; unknown verb wire verb refused; a v6 save (no thirst) loads
at thirst 80; a body saved on water resumes drowning; **same seed re-run
reproduces the identical event/decision trace** (deterministic replay,
`reflex.ts` topPick semantics).

### 4.1 Proof artifacts and replay criteria (project conventions)

Following `docs/phase-3.6-evidence.md`:

- `evidence/water-survival-live/report.json` — machine-readable: scenario
  ids, seed, character id, per-scenario event timeline (kind, vale-hour,
  vitals snapshot), decisions (trigger kinds, options offered, pick,
  backend = local), attempt counts, refusals exercised, cost
  `{totalUsd: 0, projectedPerAgentWallDay: <derived from attempt cadence>}`,
  trace hash per scenario, replay-match boolean.
- `evidence/water-survival-live/review.md` — human verdict per scenario
  (PASS/FAIL with the exact acceptance line it satisfies), plus the
  unresolved-decisions register status.
- `evidence/water-survival-live/raw/` — decision/attempt JSONL and vitals
  traces; **gitignored** (add `evidence/water-survival-*/raw/` to
  `.gitignore`, mirroring line 35's `evidence/phase36-*/raw/`).
- **Replay criteria:** (1) re-running any scenario with its seed reproduces
  the report's event sequence and trace hash exactly; (2) every survival
  trigger in the trace has a matching executed decision or a recorded
  refusal/denial — none silently lost; (3) scenario A's trace contains
  thirst_low + drink ack + hunger_low + eat ack + nightfall + quiet-window
  entry/exit; (4) zero paid-provider attempts in all scenarios; (5)
  `npm run check` green with the new tests registered in `package.json:22`.
- The Phase 3.6 evidence directory and its cost figure are **not touched**.

---

## 5. Unresolved product decisions (owner must pick before implementation)

- **D1 — Thirst lethality.** Proposed: decay 4.8/h, dehydration 1 HP/0.25h.
  Alternatives: slower decay (survival pressure without death risk) or
  faster damage. Affects how punishing a missed drink is.
- **D2 — Drink economics.** Proposed: +40 per drink, repeatable, no item.
  Alternative: one drink to full, or a waterskin item gate (rejected for
  slice size, but owner may want the item loop).
- **D3 — Brine/salt water.** Proposed: all water drinkable. Alternative:
  coastal brine (brinegate/southmere) undrinkable or sickening — deferred.
- **D4 — Drowning numbers.** Proposed: 0.5h grace, 2 HP/0.1h, 0.5× speed.
  Alternative: auto-divert the expired-fly path to shore instead of damage
  (kinder, but removes the survival event the proof demonstrates).
- **D5 — UI.** Proposed: Droplet "Water" chip beside Belly. Energy recovery
  and starvation damage stay out of scope (owner may disagree).
- **D6 — Save migration.** Proposed: version 7, absent thirst → 80.
  Alternative: optional-field hydration without a version bump.
- **D7 — Night fauna pressure on hosted agents.** The multi-actor threat
  table is deferred host work (`docs/actor-ownership-weather-ai.md`). This
  slice does **not** add it; the full-day proof demonstrates night via
  cadence (nightfall/quiet window), optionally plus provoked retaliation.
  Owner must accept cadence-only night pressure for hosted agents until the
  threat table lands, or commission that separately.
- **D8 — Drink wire shape.** Proposed: verb-wire only (`drink` in
  VERB_KINDS) + synthetic walk-to-water option. Alternative: a `drink`
  intent kind (task-based walk-and-drink like fish) — larger surface.

---

## 6. Implementation surface (for `t_77f1af48`, after decisions)

| Surface | Files |
|---|---|
| Thirst field + decay + dehydration | `src/game/types.ts`, `sim.ts`, `world.ts` (defaults), new constants block |
| Drink command + verb | `src/game/player.ts`, `context.ts`, `src/server/shard.ts` (VERB_KINDS/executeVerb/validate) |
| Drowning | `src/game/sim.ts` (tick beat), `player.ts` (log), constants |
| Observation | `src/game/agent/types.ts`, `observe.ts` (water nearest), `hostfeed.ts` if sheet mirrored |
| Reflex | `src/game/agent/events.ts` (triggers/config), `autopilot.ts` (synthetic options), `scheduler.ts` unchanged |
| Persistence | `src/game/save.ts` (v7 migration + isPerson), `src/server/hydrate.ts` |
| UI + docs | `src/components/game/paperdoll.tsx`, `docs/vale-manual.md` |
| Tests (register in `package.json:22`) | new `src/game/survival.test.ts` (thirst/drink/drowning rules), extend `save.test.ts`, `actor-save.test.ts`, `shard.test.ts`, `agent/autopilot.test.ts`, `agent/risk-cadence.test.ts` (full-day water variant), `src/server/save-decode.test.ts` |
| Proof | `scripts/water-survival-live.mjs` (phase36-live.mjs pattern), `evidence/water-survival-live/`, `.gitignore` entry |

Acceptance for the implementation card: `npm run check` green; scenarios
A–D pass with replay-match; zero paid cost; Phase 3.6 record untouched;
no push/deploy/chain without authorization.