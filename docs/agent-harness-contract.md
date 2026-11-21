# Emberhall Agent Harness Contract

**Status:** Phase 0 contract — the protocol every AI-MMO workstream builds against.
**Landed:** `src/game/agent/` (types, observe, candidates, intent, reflex, log) + golden fixture tests.
**Owner:** Kimi lane. Changes to this document require a contract bump note in the doc itself.

---

## 1. The shape of an agent

Every body in the vale is driven by two brains:

- **Reflexes** (bundled, ours): fast, cheap, enumerable decisions — *which of these legal
  verbs now?* Jev-shaped exchange: state + typed questions in, calibrated probabilities out.
  Day-one backend is TypeSafe's hosted Jev API; the scale backend is a self-hosted small
  decision model trained from our own decision log (§7).
- **Mind** (the owner's, BYO): an LLM the user connects — cloud subscription or local
  endpoint. Sets goals, interprets the directive, writes the journal, handles anything
  requiring simulation or prose. Slow path, event-driven.

The sim never knows which backend answered. It only ever sees **intents**.

## 2. The wire

```
        ┌────────────┐  Observation   ┌─────────────┐
        │   sim      │ ─────────────► │  reflexes   │──┐
        │  (truth)   │                │  (fast)     │  │ ReflexAnswer
        │            │ ◄───────────── └─────────────┘  │ (pick from candidates)
        │            │   AgentIntent                   ▼
        │            │ ─────────────► ┌─────────────┐  validate → submitIntent
        └────────────┘  Observation   │    mind     │──┘ (advisory hints only)
                                      │  (BYO LLM)  │
                                      └─────────────┘
```

- **Observation** (`observeWorld`): the body's sheet (skills, pack, wear, hp, hunger,
  position), entities within `AGENT_OBS_RADIUS` (24 tiles), weather, night flag, the legal
  verb menu, and the last 20 log lines. JSON-safe, no sim internals.
- **VerbCandidate** (`candidatesForPlayer`): the exact context-menu entries the sim affords
  right now — same `verbsFor` the UI uses, never a parallel rules copy. Reflex choice options
  are built from this list, so a backend **structurally cannot hallucinate an action**.
- **AgentIntent** = the sim's own `Intent` (`{ kind, tx, ty, targetId, spell }`) — the same
  wire the UI writes on click. The harness never calls `command*` directly and never writes
  pack/state. `submitIntent` validates (kind ∈ `INTENT_KINDS` shared with `save.ts`, integer
  in-bounds coords, nullable refs) and hands to the existing pipeline. Rejects never mutate.
- **Server-authoritative for free:** when the host owns the tick, nothing about this wire
  changes — the browser stops submitting intents, the agent runtimes start.

## 3. Reflex exchange (System One)

```ts
ReflexExchange { state, questions: ReflexQuestion[] } → ReflexResult { answers }
```

Three question types, mirroring Jev: `choice` (2–255 options), `score` (2–10 ordered
levels), `noul` (yes/no probability). `src/game/agent/reflex.ts` provides builders,
defensive normalization (all-zero rows fall back to uniform), deterministic `topPick`
(first max wins ties — replayable), and clamping. Backends MUST return probabilities;
the harness applies them — it never lets a backend submit intents directly.

What reflexes decide (evaluation-shaped, per the Jev research): which verb now, fight or
flee, eat now or later, bank run worth it. What they never decide (simulation-shaped):
goals, routes of subgoals, trade judgment, anything in prose — that is the mind (§4).
When a decision needs simulation, code supplies the prediction (the sim knows the world)
and reflexes evaluate against it.

## 4. Mind exchange (BYO LLM)

```ts
MindRequest { directive, rolePack, manual, observation, goals, journalTail }
→ MindResponse { goals, journalEntry, intentHints }
```

- Injected at character creation: the **role skill pack** (`agent-packs/*.md`) and the
  **vale manual** (`docs/vale-manual.md`) — "the skills we automatically input."
- `intentHints` are **advisory**: each is validated against the live `VerbCandidate` set
  before becoming an intent. A confused mind degrades gracefully — reflexes keep the body
  alive (autopilot).
- Local minds sleep when the owner's machine sleeps. The character never logs off; it runs
  on instinct. This is a feature, and the marketing word for it is *autopilot*.

## 5. Cadence (the cost contract)

`DEFAULT_CADENCE`: mind heartbeat every 3 vale hours; reflex cooldown 2 ticks; quiet window
22:00–06:00 unless the body is in danger. **Reflexes fire on events, never on a polling
timer** — per-second polling was costed at ~$4/agent/day and is forbidden. Phase 3 carries
a hard gate: ≤ $0.50/agent/day on reflexes, measured from the decision log.

## 6. Multi-body path (Codex lane)

Phase 0 is player-centric: `you` = `world.player`, and `candidatesForPlayer` requires the
live world because `verbsFor` reads `getWorld()`. The multi-body refactor:

1. Parameterizes actors across `command*` verbs (~1k `world.player` sites, default-
   preserving mechanics — every existing test stays green).
2. Parameterizes `verbsFor(world, actor, target)`; `candidatesFor` drops its live-world
   constraint. `observeWorld(world, bodyId)` replaces the `isPlayer` scan.
3. `submitIntent(world, bodyId, intent)` writes that body's intent slot.

None of this changes the wire shapes in §2–§5.

## 7. Decision log → training set

`DecisionLogRow`: `(tick, bodyId, lane, question, candidates, answer, intent, stateHash,
 outcome)`. Outcome deltas (hp, gold, pack counts) are back-filled after N ticks by diffing
observations. `hashObservation` (FNV-1a over key-sorted JSON of you + verb menu + tick)
makes states dedupe-able and replayable. Every reflex call from day one is a training row
for **Emberhall Reflex v1** (~0.6B backbone, Inner-Jev/NanoJev recipe) — flipped to
self-hosted when the API bill says so.

## 8. Drift guards (unchanged from the pivot plan)

- Solo vale ships green on `main` every week. No `p2p.ts`. No auth-flip-as-progress.
- No new `Math.random` as client-side world truth. Verbs stay `command*` on `World`.
- Renderer, voxel art, and the Guild Maker look are out of scope.
- Chain vault stays `client-beta`; the host becomes the only mint signer in a later phase.

---

### Contract history

- **v0 (2026-11-21):** first land — types, observe, candidates, intent, reflex, log,
  golden court-morning fixture, `agent.test.ts` on the repo `test` script.
