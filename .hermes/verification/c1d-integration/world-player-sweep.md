# C1d integration world/player authority sweep

Task: t_934f17c8 — integrate the C1d parent migrations and re-run the world/player authority census on the integrated tree.

- Integrated tree: branch `wt/t_934f17c8`, worktree `C:/Users/futur/Desktop/emberhall/.worktrees/t_934f17c8`.
- Base: `9135794c220f25406b412a15ce5871476a9237f8` (C1c tip, per card).
- Integrated commits: `d59947e` (weather + AI targeting ownership doc/locks, from 79371aa on wt/t_4dc578ac), `635d792` (kit undo per-actor journals, from 480d32a on wt/t_640a949b), `d288db6` (NPC trade + commissions actor authority, from a9d9ea1 on wt/t_ecf5919f).
- Audit method: static read-only census of the committed integrated tree; no tests edited, no chain ops, no deploy.

## Baseline provenance

The requested C1c baseline `.worktrees/t_d042973e/.hermes/verification/c1c/world-player-sweep.md` is **file-not-found** — the t_d042973e worktree is merged/gone (confirmed by t_4dc578ac and visible in `git worktree list`). The umbrella successor census at `.worktrees/t_e420743a/.hermes/verification/c1d/world-player-sweep.md` (86 occurrences / 73 lines on 131 files) measured telegram2's **dirty WIP tree**, which implements the SUPERSEDED per-actor policies (per-actor douse deadlines, ai-target.ts threat table, piles range guard) and is **not** the tree integrated here; it is used only as a classification framework reference, per its own header it is NOT final acceptance evidence.

To obtain a like-for-like baseline, this sweep re-ran the identical census snippet on the untouched base worktree `.worktrees/t_db6b526c` (HEAD verified `9135794c…`). Result: **130 files, 165 occurrences, 143 matching lines** (`world.player` 121, `w.player` 42, `getWorld().player` 2).

## Integrated-tree census

Same snippet, same exclusions (`__tests__`, `tests/`, `.test.`, `.spec.` filenames). Result: **130 files, 126 occurrences, 107 matching lines** (`world.player` 82, `w.player` 42, `getWorld().player` 2). Full hit list: `census-integrated.txt`; base per-file counts: `base-byfile.json`.

**Net delta vs base: −39 occurrences.** All movement is attributable to the three integrated lanes:

| File | Base | Integrated | Δ | Lane |
|---|---:|---:|---:|---|
| `src/game/npcs.ts` | 18 | 0 | −18 | NPC trade (d288db6) |
| `src/game/commissions.ts` | 10 | 0 | −10 | NPC trade (d288db6) |
| `src/game/placeables/history.ts` | 2 | 0 | −2 | kit undo (635d792) |
| `src/game/placeables/placement.ts` | 4 | 0 | −4 | kit undo (635d792) |
| `src/game/placeables/commands.ts` | 6 | 0 | −6 | kit undo (635d792) |
| `src/game/sim.ts` | 1 | 2 | +1 | NPC trade (adds skip-solo-alias registry loop for commission expiry, line 157) |

Every other file is byte-unchanged from base (`git diff 9135794c..HEAD --stat` touches only the lane files + `package.json` test string + `art/asset-ledger.json` pins).

Reproduce (from the integrated worktree):

```python
from pathlib import Path
import re, collections
root = Path(".")
files = sorted(p for p in (root / "src/game").rglob("*")
    if p.is_file() and p.suffix in (".ts", ".tsx", ".js")
    and not any(x in p.parts for x in ("__tests__", "tests"))
    and not re.search(r"\.(test|spec)\.", p.name))
pat = re.compile(r"\b(?:world\.player|w\.player|getWorld\(\)\.player)\b")
hits = [(p.as_posix(), i, m.group(), s.strip()) for p in files
    for i, s in enumerate(p.read_text(encoding="utf-8").splitlines(), 1)
    for m in pat.finditer(s)]
print("files", len(files), "occurrences", len(hits),
      "matching lines", len({(p, i) for p, i, _, _ in hits}))
```

## Requested domain accounting

### 1. NPC trade / commissions — MIGRATED (approved policy #4)
Zero literal hits remain in `npcs.ts` / `commissions.ts` (grep-verified, exit 1). All pack/rares/wearRare/intent/commission access resolves through `actorState(world, actorId)`: omitted ID resolves the legacy solo sheet through the same code path (no competing solo writer); unknown IDs throw before mutation (actor-trade tests prove world-unchanged). Gold, rep and quest flags stay **shared world state** per the approved policy (no per-player economy). `sim.ts` `tickWorld` expires every registered actor's commission exactly once, skipping the solo alias (mirrors the `tickPets` registry-loop pattern). Locked by `actor-trade.test.ts` (15 tests).

### 2. Kit undo — MIGRATED (approved policy #1)
Zero literal hits remain in `placeables/history.ts`, `placement.ts`, `commands.ts` (grep-verified, exit 1). Session journals are per-actor (`WeakMap<World, Map<actorId, Session>>`) with conflict-checked deltas (pack/placed/structures/plots/scars/tile kinds), validate-before-inverse with whole-op reject on conflict, ownership guard (no cross-owner undo; shared structures undoable only via the placing actor's journal), `canPlace` recheck with actorId, pop-after-success, lifecycle clears (omitted-ID `clearHistory(world)` wipes all journals for the world — the deliberate integrator deviation kept from the t_640a949b lane), bounded session-only history. Costs/ownership land on the acting actor; omitted ID behaves exactly as base solo; unknown IDs fail closed. Locked by `c1d-undo.test.ts` (12 tests).

### 3. Vault commits — RETAINED SOLO, APPROVED, PROTECTED (policy #5)
`vault.ts` keeps its 15 base occurrences (unchanged): solo mint/redeem sheet mutations at lines 206–285. This is the approved outcome: t_5f775f73 closed as a deliberate no-op — authority boundaries unchanged, commit mutations untouched, stays client-beta until the host is the only mint signer. Protection evidence: `git diff --exit-code 9135794c..HEAD -- src/chain src/game/vault.ts src/components/game/vault-gump.tsx` exits 0 (no diff). No actor-capture finalization code was integrated — that belonged to the superseded umbrella WIP.

### 4. Rain / weather — DOCUMENTED + LOCKED, world-global singular (approved policy #2)
`weather.ts` keeps its 2 base occurrences: legacy torch douse deadline (line 155 arm check, line 169 unequip) scoped to the legacy solo sheet exactly as the approved world-global singular policy requires (no actor param; per-actor exposure deferred to host). Single authoritative tick path verified at base and re-verified here: `tickWeather` is called only from `tickWorld`. Ownership contract: `docs/actor-ownership-weather-ai.md`. Locked by `weather-policy.test.ts` (6 tests: transitions/propagation/douse lifecycle/stale repair/sheltering).

### 5. AI target acquisition — DOCUMENTED + LOCKED, sim authority (approved policy #3)
AI-domain files keep their base occurrences: `ecology.ts` 4 (602 owner follow, 649 night-hunter gate, 660 ghost/invis gates), `embercrawler.ts` 2, `emberdeep-monsters.ts` 3 (incl. 70 lastBittenAt), `furnace-warden.ts` 3, `gloomwraith.ts` 2. These are the preserved **current-target semantics**: isPlayer-first body selection, validity gates (ghost/invisibility/sanctuary/leash/LOS), windup position lock, cancel-never-transfer. The multi-actor threat table (nearest validated actor + lexical tie-break, per-target windup identity) is **deferred to the host** per approved policy — it was deliberately NOT built client-side (the umbrella WIP's `ai-target.ts` is superseded and absent here). Single authoritative species tick path verified: species ticks dispatch only from `tickEcology`. Locked by `ai-targeting-policy.test.ts` (6 tests: selection/invalidation/stale-strike/encounter lifecycle).

## Remaining solo boundaries and their status

| Boundary | Hits | Status |
|---|---:|---|
| Solo UI adapters: `store.ts` 25, `spell-effects.ts` 8, `iteminfo.ts` 4, `house-touch.ts` 2 | 39 | **Approved retained** — intentional solo UI/presentation; not authority endpoints. Host dispatch seam supersedes. |
| Compat paths: `actor.ts` 1, `live.ts` 5 (hydration 85/88/108/111, snapshot 192), `save.ts` 3, `world.ts` 3, `house.ts` 4 (look-hut preview), `piles.ts` 2 (all-actor cleanup loops 91/138), `sim.ts` 2 (skip-solo-alias registry loops 157/218), `zones.ts` 2 (actor-aware finishBeast 110/113), `agent/intent.ts` 1 (comment), fixtures 2 (`court-morning`, `station-test-fixture`) | 24 | **Approved retained** — explained legacy/inclusion paths; verified not solo-authority mutations (each row in census-integrated.txt). |
| Developer grants: `testkit.ts` 9, `live.ts` 4 (135×3, 137 testkit grant) | 13 | **Approved retained** — explicit testkit/Godmode gates; intentionally enabled. |
| `blueprints.ts` 6, `placeables/functions.ts` 6 | 12 | **BLOCKED — controller decision pending.** Amendment items #9; t_640a949b deliberately left wider owner-check surfaces (chest/door/bed, blueprint author/costs) to root reconciliation. Only implemented in the superseded umbrella WIP. |
| `salvage.ts` 6 | 6 | **BLOCKED — controller decision pending.** Amendment item #7; same superseded-WIP situation. |
| GAP-1: indirect `isPlayer` authority alias in `sim.ts` (lines 54, 166) | n/a (predicate, not literal) | **Documented, pre-existing at base** (byte-identical, verified via `git show 9135794c:src/game/sim.ts`). A second unregistered `isPlayer: true` body enters the actor movement branch with omitted-ID authority. Ordinary registries unaffected. Hardening (restrict legacy branch to `p === solo`) is a host-side policy decision. |
| Boundary-2: `takeFromPile` loot-all gold path lacks range/life/expiry validation (`piles.ts:117–149`, dispatch via `player.ts`, `store.ts`) | n/a | **Open controller item.** The range guard that produced the `loot.test.ts:84/:96` fixture conflict belonged to the superseded umbrella WIP and was NOT integrated; base contract preserved. Intentional-legacy-contract vs hardening remains a controller/host decision (flagged by t_ecf5919f, blocked in t_e420743a). |

## Verdict scope

No direct literal is classified GAP on the integrated tree: the three integrated lanes removed all 40 owned-packet occurrences they were carded for (net −39 with the one intentional skip-alias line). This is **not** an unqualified zero-gap authority verdict: GAP-1 and Boundary-2 are pre-existing/base-contract items above, and the blocked residuals (blueprints/functions/salvage) await controller routing. Solo gameplay behavior is unchanged by construction — every lane preserves the omitted-ID legacy solo path, and the full gate suite on this tree is recorded in `handoff.json`.
