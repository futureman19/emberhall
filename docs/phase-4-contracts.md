# Emberhall Phase 4 Contracts — Character Creation + Unleash

**Status:** Phase 4 contract — the protocol the host, console, and integration workers build
against. Builds on `docs/agent-harness-contract.md` (Phase 0); changes require a contract
bump note in this document.
**Executable half:** `src/game/agent/account.ts` (+ `account.test.ts`, fixtures
`src/game/agent/fixtures/phase4.ts`). Validators there are normative — host and console
MUST produce identical verdicts.
**Verified baseline:** 2026-11-21, branch `ai/harness-contract` @ `698865e`,
`agent.test.ts` 8/8 green, `account.test.ts` 10/10 green.

---

## 1. What Phase 4 is

The flow a director (player) walks:

```
create character → pick role (skill pack injected) → write directive
→ connect mind (cloud key OR local endpoint URL) → unleash
```

After unleash, the character is a live agent on the shard. If its mind is a local LLM and
the owner's machine sleeps, the character does **not** stop, log off, or fail — it runs on
the bundled reflex layer. That state is called **autopilot**, and it is a feature (§6).

Subscription/billing is a **stub** (§9): beta is free, activation is never gated, pricing
is a launch decision.

## 2. Verified foundations and readiness assessment

Inspected firsthand on 2026-11-21 (branch `ai/harness-contract` @ `698865e`, plus `main` @
`08939dc`; every local branch swept for `src/server/`, `agent-packs/`, `vale-manual` — none
exist anywhere):

| Piece | State | Evidence |
|---|---|---|
| Harness wire types (`Observation`, `AgentIntent`, `ReflexExchange`, `MindRequest`, `DecisionLogRow`, `DEFAULT_CADENCE`) | **Landed** | `src/game/agent/types.ts`; `agent.test.ts` 8/8 green (ran fresh this run) |
| Observe/candidates/intent submit path | **Landed** | `observe.ts`, `candidates.ts`, `intent.ts` — player-centric until multi-body lands |
| Reflex normalizers (`choice`/`score`/`noul`, normalize/topPick/clamp) | **Landed** | `reflex.ts` — pure builders, no backend yet |
| Decision log + observation hashing | **Landed** | `log.ts` — append-only, JSONL, FNV-1a hash |
| Reflex **backend** (zero-shot Jev API client) | **In flight** | Kanban `t_0b00ee59` (running). The sim side is ready; the live API client is not landed |
| Event-driven reflex scheduler / autopilot loop | **In flight** | Kanban `t_282dd560` (running) |
| DecisionLog replay + ≤ $0.50/agent/day cost enforcement | **In flight** | Kanban `t_e3f72207` (running); acceptance proof `t_166eb9f5` (todo) |
| Host shell (`src/server/`, tick, shard persistence, WS feed) | **Missing** | Kanban `t_02d160e2` (todo). No `src/server/` exists on any branch |
| Role packs + vale manual (`agent-packs/*.md`, `docs/vale-manual.md`) | **Missing** | Kanban `t_ff41f9ab` (todo, content lane). §7 pins the manifest contract it must satisfy |
| Mind adapters (`src/server/adapters/`) | **Missing** | Kanban `t_32f0cf70` (todo, content lane). §8 pins the config contract it implements |
| Multi-body refactor (actor parameterization) | **Missing** | Kanban `t_b4e18ab8`, `t_f081a849`, `t_d042973e` (todo) |

**Is the reflex layer live?** The reflex *interface and sim-side machinery* are landed and
tested; the *live backend and scheduler* are being built right now by the running Phase 3
children. Phase 4 therefore proceeds in two lanes per the task graph: host APIs
(`t_2cc15c31`) and console (`t_c7826c9c`) build against the contract + fixtures now; the
integration worker (`t_bd9b2aef`) wires the real backend/scheduler when Phase 3 lands, and
the root card's dependency on `t_7199f16f` (Phase 3) gates final acceptance. **Nothing in
Phase 4 rebuilds the reflex layer.**

**Blocking gaps for Phase 4 acceptance (not for Phase 4 start):**
1. Reflex backend + scheduler must land (P3 children) — integration worker consumes them.
2. Role packs + manifest must exist for real unleash validation — until then the host
   accepts the manifest as its only source of roles and returns `UNKNOWN_ROLE` for
   anything absent (fixtures cover dev).
3. Mind adapters must exist for live mind exchanges — config shape is pinned here (§8).
4. Host shell must exist for the real deployment — registry/routes are specified here (§4,
   §11) so they drop into `src/server/` when it arrives; until then the registry module is
   standalone-testable with the file store.

## 3. Shared data contracts

Normative shapes live in `src/game/agent/account.ts` (zero runtime deps; host and console
both import it). Summary:

- **`Account`** — `{ id, createdAt, billing }`. Created in one call; no email, password,
  or payment. The `ownerToken` returned at creation is the only owner credential; the host
  stores it hashed, shows it once.
- **`Character`** — `{ id, accountId, name, roleId, directive, mind, lifecycle, createdAt,
  updatedAt, unleashedAt, recalledAt }`. One row per agent credential; `accountId` enforces
  ownership.
- **`RoleId`** — closed set `["ranger", "smith", "banker", "mule"]` (beta). Adding a role
  = union + manifest + pack file, same closed-set discipline as `SkillId`.
- **`MindConfig`** — discriminated union:
  `{ kind: "cloud", provider, baseUrl?, model? }` with `provider ∈ ["openai-compatible"]`
  (day-one allowlist), or `{ kind: "local", endpointUrl, model? }`. The API key is **never**
  part of this shape (§8).
- **Limits** — `NAME_MAX 32`, `DIRECTIVE_MAX 2000`, `ENDPOINT_URL_MAX 2048`.
- **`CharacterStatus`** — the runtime overlay the console polls/subscribes to:
  `{ lifecycle, driver: "mind"|"reflex", mindState: "unconfigured"|"awake"|"asleep",
  autopilotSince, lastMindExchangeTick, lastReflexTick, body, journalTail }`.

### Lifecycle state machine

```
draft     --unleash-->  ✕  (CONFIG_INCOMPLETE — finish setup first)
ready     --unleash-->  unleashed
unleashed --unleash-->  unleashed   (idempotent no-op, returns the same agent)
recalled  --unleash-->  unleashed   (re-unleash; durable state resumes)
unleashed --recall--->  recalled
recalled  --recall--->  recalled    (idempotent no-op)
ready     --recall--->  ✕           (nothing running)
```

`nextLifecycle()` in `account.ts` is the normative machine. **Idempotent unleash is a hard
requirement**: repeated unleash requests MUST NOT create duplicate agents — the runtime
keys agents by `characterId`.

Validation is write-time and actionable (`FieldError { field, code, message }` — the
console shows `message` verbatim). Invalid configuration is never persisted; a draft may
persist partially-filled fields (name only, role only, etc.) so the owner can resume.

## 4. Host API contract (v1)

Mounted under the host's HTTP server (`src/server/`, Phase 2). Owner auth is
`Authorization: Bearer <ownerToken>` on every route except account creation. All errors
are `{ error: { code, message, field? } }` with `message` actionable.

| Route | Behavior |
|---|---|
| `POST /api/v1/accounts` | Creates account stub. `201 { account, ownerToken }` — token shown once. |
| `GET /api/v1/roles` | Returns the role manifest (`RolePackManifest`). 404 rows never; absent manifest ⇒ `503 CONFIG_UNAVAILABLE`. |
| `GET /api/v1/characters` | Lists the caller's characters (secret-free view). |
| `POST /api/v1/characters` | Creates a character (draft or ready per completeness). Validates with `readinessErrors` semantics; `422 { error: { code: "VALIDATION", ... }, fields: FieldError[] }` on failure. Name unique per account ⇒ `409 CONFLICT`. |
| `GET /api/v1/characters/:id` | Character + `PublicMind` (`{ config, secretHint }`). Ownership enforced: foreign id ⇒ **404** (existence must not leak). |
| `PATCH /api/v1/characters/:id` | Updates name/role/directive/mind config. Same validation. Role change post-unleash applies to subsequent mind exchanges only (§7). |
| `PUT /api/v1/characters/:id/mind-secret` | `{ secret }` — write-only. Stored in the secret store, never logged, never returned. `204`. |
| `POST /api/v1/characters/:id/unleash` | Idempotent. `200 { characterId, lifecycle: "unleashed", agentId, startedTick, mindState, driver }`. Blocked draft ⇒ `409 CONFIG_INCOMPLETE` + `fields`. Runtime down ⇒ `503 RUNTIME_UNAVAILABLE`. |
| `POST /api/v1/characters/:id/recall` | Idempotent stop. `200 { lifecycle: "recalled", stoppedTick }`. Durable character state is preserved. |
| `GET /api/v1/characters/:id/status` | `CharacterStatus` (§3). Cheap poll; also rides the WS observation feed when the Phase 2 feed lands. |
| `GET /api/v1/characters/:id/journal` | Append-only journal lines (mind entries + marked system lines). |

**Ownership:** every `:id` route resolves the character, then checks
`character.accountId === token.accountId`; mismatch ⇒ 404, not 403.

**Redaction:** `mind-secret` values and any request body containing `secret` are masked by
a `redactSecrets()` helper before any log write. API serializers pass through
`PublicMind` — there is no code path that returns a raw secret. `maskSecret()` yields
`…last4` for hints.

## 5. Persistence contract

- **Registry** (accounts, characters, lifecycle, mind configs): a `CharacterRegistry`
  repository interface in `src/server/registry.ts`; beta store is one JSON document
  (`server-data/registry.json`) written **atomically** (temp file + rename) on every
  mutation — same "blob first, Postgres only if profiling says so" convention as the
  shard save. Restart persistence = reload the document; tests cover it.
- **Secrets**: separate file `server-data/secrets.json`, filesystem-permission tightened,
  keyed by `characterId`. Never inside `registry.json`, never in API payloads, never in
  logs.
- **Character runtime state** (the body, its pack, its house): the shard save blob (Phase
  2 conventions — v6 save). Role starting skills apply **exactly once at first spawn**;
  on recovery they come from the save, never re-applied.
- **Journal**: append-only per character, persisted beside the registry; `journalTail` in
  status is the last N lines.

## 6. Autopilot — the sleeping-mind contract (headline behavior)

**When a local mind sleeps, the character continues via the reflex layer. It never stops,
never logs off, never enters an error state.** Observable behavior:

1. **Detection.** A failed mind exchange or health check (timeout ~30s) marks
   `mindState: "asleep"`, records `autopilotSince`, and writes one journal system line via
   `AUTOPILOT_COPY.sleepLine(name)` — prefixed `(autopilot)` so machine lines are never
   dressed in the character's voice. Mind heartbeat attempts back off (1m → 5m → 15m) and
   burn no tokens while asleep.
2. **Driving.** `driver` flips to `"reflex"`. The event-driven scheduler (Phase 3) keeps
   the body alive within `DEFAULT_CADENCE` — eats, sleeps at night, avoids danger, keeps
   working its loop. Every decision keeps writing `DecisionLogRow`s with `lane: "reflex"`.
3. **Console.** Status shows the locked banner copy (`AUTOPILOT_COPY.banner`): *"Autopilot
   — {name}'s mind is asleep. Its instincts keep it going; it will think again when the
   mind wakes."* This is presented as a normal state with a calm treatment — not red, not
   an error, not a failure.
4. **Wake.** A successful probe or exchange flips `mindState: "awake"`, clears
   `autopilotSince`, writes `AUTOPILOT_COPY.wakeLine(name)`, and issues one immediate
   `MindRequest` with a fresh observation so the mind re-orients. Standing goals refresh
   from the response; reflexes keep evaluating against them.
5. **Unleash is never gated on mind connectivity.** Config-time validation checks URL
   *shape* only. A local endpoint that is currently unreachable (machine asleep) yields a
   warning, not a block — sleeping minds are the designed case.

## 7. Role selection and skill-pack injection

- **Registry:** `agent-packs/packs.json` (`RolePackManifest`) — id, label, summary, pack
  file, `startingSkills`. Owned by the content lane (`t_ff41f9ab`); the fixture version in
  `src/game/agent/fixtures/phase4.ts` is illustrative only. The console lists roles from
  `GET /api/v1/roles`; it never hardcodes the set.
- **Injection:** exactly-once semantics by construction. The character row holds **one**
  `roleId`; the prompt assembler (content lane) reads it and substitutes the pack markdown
  into `MindRequest.rolePack` per exchange. There is no append operation, so retries of
  create/update/unleash cannot double-inject. The vale manual injects the same way into
  `MindRequest.manual`.
- **Starting skills:** applied by the host once at first spawn from the manifest; absent
  from the save afterwards (§5).
- **Role change:** allowed any time via PATCH. Pre-unleash it just updates the row. Post-
  unleash it takes effect on the next mind exchange (prompt content changes); it never
  rewrites learned skills.

## 8. Mind configuration and secrets

- **Cloud:** `{ kind: "cloud", provider: "openai-compatible", baseUrl?, model? }` + a key
  delivered via `PUT …/mind-secret`. The adapter lane (`t_32f0cf70`) implements the
  OpenAI-compatible HTTP adapter against this shape. `baseUrl` allows compatible gateways;
  http(s) only, no userinfo.
- **Local:** `{ kind: "local", endpointUrl, model? }`. http(s) only, no userinfo, length
  cap. Loopback (`127.0.0.1`, `localhost`) and LAN addresses are explicitly allowed — the
  endpoint is user-hosted by definition. (SSRF note: the host fetches user-supplied URLs
  by design in beta; the adapter MUST NOT follow redirects off-origin and should cap
  response size. Documented risk, accepted for beta.)
- **Secret hygiene:** write-only endpoint; stored in the secret store; API returns
  `secretHint` (`…last4`) only; `redactSecrets()` guards logs; tests assert GET payloads
  and captured logs contain no secret material.

## 9. Billing stub (explicitly out of the activation path)

`BillingStub { plan: "beta-free", entitled: true }` is the only billing state.
`activationAllowed()` is a constant `true`. The API has **no** payment, plan, or
subscription fields beyond the stub; the console renders **no** billing step; QA asserts
no gate. Pricing and tiers are launch decisions parked in the pivot plan's "Later" section.

## 10. Integration locations

**Host worker (`t_2cc15c31`):**
- `src/server/registry.ts` — `CharacterRegistry` interface + atomic JSON store + secret
  store (§5). Standalone-testable now; mounts into the Phase 2 server later.
- `src/server/routes/accounts.ts`, `characters.ts`, `unleash.ts` — the v1 surface (§4).
- `src/server/redact.ts` — `redactSecrets()`.
- Tests: `src/server/registry.test.ts` (+ CRUD/restart/ownership/redaction/injection
  vectors), registered on the `package.json` `test` string (patch in place, run
  `node --test scripts/audit-safety-test-registration.test.mjs`).

**Console worker (`t_c7826c9c`):**
- `src/routes/console.tsx` — new file route, gated by `VITE_DIRECTOR_CONSOLE` (pivot work
  never dark-launches into the solo game).
- `src/components/console/` — the five-step flow (Character → Role → Directive → Mind →
  Unleash), status card with the autopilot banner (§6 copy is locked), journal view.
- `src/lib/console-api.ts` — typed client for §4; injectable fetch so tests run against
  `src/game/agent/fixtures/phase4.ts` mocks.
- Owner token in `localStorage` (`emberhall-owner-token-v1`); non-secret form state
  preserved across recoverable failures; secret field cleared after submit.

**Integration worker (`t_bd9b2aef`):**
- `src/server/agent-runtime.ts` — per-character agent handles keyed by `characterId`
  (unleash idempotency), the sleep/wake transitions (§6), restart recovery from the shard
  save.
- Consumes the reflex backend interface from `t_0b00ee59` and the scheduler from
  `t_282dd560` **as delivered** — this contract deliberately defines only the runtime port
  (`ensureAgent(character) → handle`, `stopAgent(id)`, `status(id) → CharacterStatus`) so
  Phase 3 owns its internals.
- Wires mind adapters from `t_32f0cf70` and the prompt assembler's `MindRequest`
  construction (role pack + manual injection, §7).

**QA worker (`t_11629bc1`):** runs the acceptance scenarios below, measures the 5-minute
gate, reports prerequisites (live reflex layer, one credential or local endpoint).

## 11. Acceptance scenarios

| # | Scenario | Pass criteria | Primary owner |
|---|---|---|---|
| S1 | Cloud path, zero → unleashed | Account → character → role → directive → cloud key → unleash returns `unleashed`, `driver: "mind"`; elapsed < 5 min; no billing UI anywhere | QA |
| S2 | Local path + sleep/wake | Unleash on local endpoint works while endpoint is up; stop the endpoint ⇒ within one detection window status shows `mindState: "asleep"`, `driver: "reflex"`, autopilot banner visible, journal gains the marked sleep line, and `lastReflexTick` keeps advancing; restart endpoint ⇒ `awake`, wake line, immediate mind exchange | Integration + QA |
| S3 | Restart persistence | Kill host, restart: account, character, role, directive, masked mind config, and lifecycle all survive; an unleashed character resumes from the shard save without re-applying starting skills | Host |
| S4 | Ownership isolation | Account B's token cannot read, patch, unleash, or recall account A's character — every attempt 404 | Host |
| S5 | Credential redaction | No API response contains the secret (hint only); captured host logs across create/update/unleash contain no secret material | Host + QA |
| S6 | Idempotent unleash | Two concurrent + one sequential unleash ⇒ exactly one agent, same `agentId`, one body in the sim | Integration |
| S7 | Invalid configuration | Empty name, over-long directive, unknown role, non-http URL, userinfo URL, unknown provider ⇒ `422` with actionable `fields`; nothing persisted | Host + Console |
| S8 | Retry preservation | A failed submit (e.g. 503) keeps all non-secret entries in the form; secret field clears; re-submit succeeds without retyping | Console |
| S9 | No billing gate | Fresh account reaches unleash with zero payment/plan interaction; `activationAllowed()` constant-pass covered by test | QA |
| S10 | Role injection exactly-once | Character row holds one `roleId`; assembled `MindRequest.rolePack` contains the pack once across create retry, update retry, and unleash retry | Host |

**Prerequisites QA must state (not assume):** reflex backend + scheduler live (Phase 3
children done), one cloud credential **or** one reachable local endpoint, role manifest
present.

## 12. Out of scope / drift guards (unchanged)

- No renderer, voxel, or look work. No `p2p.ts`. No `VITE_AUTH_ENABLED` flip — the owner
  token here is the host's own stub, not the Grok auth scaffolding. Chain vault stays
  `client-beta`. Subscription pricing stays parked. The reflex layer is consumed, never
  rebuilt, by Phase 4.

---

### Contract history

- **v0 (2026-11-21):** first land — `account.ts` types/validators/state machine + locked
  autopilot copy, `account.test.ts` 10 vectors green, `fixtures/phase4.ts` mocks, readiness
  assessment verified firsthand against `ai/harness-contract` @ `698865e`.
