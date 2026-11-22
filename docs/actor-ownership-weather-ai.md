# Actor ownership: weather and AI target acquisition (C1d)

Controller-approved policy (kanban `t_f37cd205`, 2026-11-21), scoped on `t_4dc578ac`:

- **Weather: world-global singular.** One authoritative weather simulation. No actor
  parameter. Documented and locked here; per-actor exposure is deferred.
- **AI targeting: sim authority, current-target semantics preserved.** The threat
  table (validated multi-actor candidates, nearest + lexical tie-break, per-target
  windup identity) is **deferred to the host** (Phase 2, `src/server/`). Do not
  build it in the client sim.

Base for this contract: `9135794c220f25406b412a15ce5871476a9237f8`.
Predecessor boundary census: `.hermes/verification/c1d/world-player-sweep.md`
(umbrella worktree; static evidence).

## Weather — world-global singular

| Aspect | Contract |
|---|---|
| Authoritative owner | `tickWorld` (`src/game/sim.ts`) is the **only** caller of `tickWeather`. No store, UI, or second sim path may advance weather. |
| State ownership | One `world.weather` record (kind, cloud, wet, wind, untilHour, rolls, douseHour). It rides the save blob and is validated by `isWeather` in `save.ts`. |
| RNG / replay | Regime rolls draw `mulberry32(seed…, rolls…)`, so a save/load round-trip replays the same sky. No `Math.random` in this subsystem. |
| Torch douse | The singular `douseHour` belongs to the **legacy solo sheet only** (`world.player.wear.main`). It arms once while rain ≥ 0.25 and a torch is held, clears on unequip, and rearms fresh on a new hold. Deadline range 0.3–0.5 world hours — unchanged. |
| Observation | `rainRate` (renderers, hole washing, torch), `sheltering` (ecology small game), `weatherSnap` (HUD) are read-only views. |
| Timing / ordering | Each `tickWorld` runs `tickWeather` **before** `tickEcology`: a rain-doused torch is already gone when `gloomTorch` reads the sheet in the same tick. |
| Propagation | `washHoles` fires only at rainRate ≥ 0.35; wet rises only while rainRate > 0 and dries otherwise. |
| Stale / duplicate | `ensureWeather` repairs missing/NaN fields (including `douseHour`) on every tick; regime rolls are time-gated (`hour >= untilHour`), so duplicate sub-hour ticks cannot double-roll. |
| Deferred | Per-actor torch/exposure deadlines and any shelter mechanics are **not** client-sim policy. Ownership: the host. |

## AI target acquisition — sim authority (current-target semantics)

| Aspect | Contract |
|---|---|
| Authoritative owner | `tickEcology` (`src/game/ecology.ts`) is the **only** dispatcher of the species ticks (`tickEmberdeepMonster`, `tickEmbercrawler`, `tickGloomwraith`, `tickWarden`, wildlife), itself called once per `tickWorld`. |
| Candidate selection | The legacy `isPlayer`-first body (`world.people.find(p => p.isPlayer)`). Deliberately **not** nearest-body and **not** actor-parameterized at this layer; a nearer bystander is never acquired. |
| Validation gates | Live body and sheet (not ghost, hp > 0), dungeon species require `inEmberdeep`, `hour >= invisUntil`, not blinded, within home leash (< 14), and never on sanctuary ground. |
| Windup lock | Entering windup locks `targetX/targetZ` to the mark's position. The strike revalidates: the mark must still be near the locked spot, in reach, and in sight — a dodged or stale lock whiffs. |
| Invalidation | Any gate failure resets to patrol/prowl (`task = "wander"`, path cleared). A lost, ghosted, invisible, departed, or dead target is **dropped, never finished off**. |
| No transfer | A queued strike or accumulated contact heat is cancelled on invalidation — it never lands on another body. `strikePlayer` enforces the body↔actor match and throws on mismatch (`"Strike target does not match actor"`). |
| Encounter lifecycle | The Furnace Warden ticks only while `emberdeep.bossEncounter === "fighting"`; `updateFurnace` owns spawn/reset/despawn on player death, exit, and victory. |
| Persistence | In-flight `monster` / `crawler` / `gloom` phases ride creature save validation (`save.ts`). A stale phase loaded from an old save revalidates against current state and cancels when its mark is no longer valid. |
| Deferred | Multi-actor candidate sets, nearest + lexical tie-break, per-target windup identity lock, and companion-owner resolution belong to the host threat table. |

## Verified single-path evidence (base `9135794`)

- `tickWeather` — sole call site `src/game/sim.ts:206` (`tickWorld`).
- `tickEcology` — sole call site `src/game/sim.ts:209`; species ticks dispatch only
  from `ecology.ts` (golem/crawler/gloomwraith/warden lines 579–588).
- `rainRate` readers are render-only (`lighting.tsx`, `sky.tsx`, `weather-fx.tsx`)
  plus the in-sim `sheltering`/wash paths — no second authoritative writer.

Focused lock tests: `src/game/weather-policy.test.ts`,
`src/game/ai-targeting-policy.test.ts`.
