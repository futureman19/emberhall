# Phase 4 v1 — implementation-ready contract and readiness review

Owner: t_599e2031. 2026-11-22. **Specification, not deployed-feature acceptance.** This document supersedes conflicting statements in `phase-4-contracts.md` and the recovered `account.ts` scaffold. Keep the v0 fields/routes unless explicitly changed here. Host worker owns aligning shared types and fixtures to v1; console mocks follow v1, not incomplete validators.

## Scope and baselines

Plan `.hermes/plans/2026-11-21-ai-mmo-pivot.md` Phase 4: create character → role/pack → directive → cloud key or local endpoint → unleash; durable ownership; zero-to-self-sustaining within five minutes. Beta is **free**. Billing stays `{plan:"beta-free",entitled:true}` and is never an activation prerequisite. No subscription work, renderer change, solo control change, chain work or reflex rebuild.

Board workspace is misrouted to BoxSV. Actual recovered commit `e1123a2`, branch `wt/t_599e2031`, worktree `C:/Users/futur/Desktop/emberhall/.worktrees/t_599e2031`. It already contains shared types, fixtures, 10 contract tests and v0 spec. BoxSV remains untouched.

Read source at main `f1148c4`, scheduler `4d0e434` (t_282dd560), Jev backend `376bdd9` (t_0b00ee59), cost `9ebc650` (t_e3f72207). P3 integration branch was `56710cd` when inspected, not an accepted final build.

| Area | Actual implementation | Integration decision |
|---|---|---|
| Console | `src/routes/index.tsx` mounts WorldScene, ScreenRain, Hud; no console route/components on inspected main | Add flagged `/console`, preserve `/` |
| Host | `src/server/{main,shard,ws,hydrate}.ts`; `createShard` persists `characters.json` and `shard-save.json`; name-derived configured IDs | Extend authority, never spawn a second world |
| WS | `ws.ts:createTransport`: healthz, one controlling socket per character, key-bound intent and verb queues | Mount owner APIs here; separate observer from controlling session |
| Roles | Four `agent-packs/{ranger,smith,banker,mule}.md`, `docs/vale-manual.md`, `packs.test.ts`; no packs.json | Host builds manifest from authored packs |
| Prompt | `assembler.ts:assembleMindMessages` already inserts rolePack/manual/directive/goals/observation/journal | Load exactly one selected pack, no append-buffer |
| Mind | `src/game/agent/mind.ts`, `adapters/openai-compatible.ts`, `adapters/local.ts` | Reuse these; v0's proposed `src/server/adapters` path is obsolete |
| Reflex | `reflex.ts` builders plus separate scheduler/autopilot/hostfeed and Jev/cost commits | Consume P3 integration, no second scheduler |

## Reflex readiness — honest gate

**Local scheduler + real shard transport executes: confirmed. Live production bundled reflex service: NOT confirmed.** Fresh tests at scheduler `4d0e434`: **26/26 pass**, including in-process real-shard WebSocket boot/admission/stop. Backend is deterministic in these tests, not paid Jev. Recovered account+harness tests: **18/18 pass**. These do not prove full-day survival or production deployment.

Blocking gaps for final P4 acceptance, not contract/mock work:

1. P3 `t_166eb9f5` / root `t_7199f16f` own integrated provider/metering and full-vale-day cost/survival proof. Separate green component tests are insufficient. Explicitly select real backend; never silently ship `createStubBackend()` default. There is a concrete seam mismatch across inspected sibling commits: scheduler expects `decide → ReflexResult`, Jev `reflex-backend.ts` returns `decide → ReflexCallOutcome`, and cost `metering.ts:ReflexBackend` expects `call → ReflexCallOutcome`. P3 must supply the adapter and ensure authorization/logging happens for **each internal retry**, not merely once around the multi-attempt call. These modules are not drop-in compatible as v0 implied.
2. `autopilot.ts:INTENT_FOR_VERB` at 4d0e434 omits eat/bank/craft/rest; `prepare` skips fewer than two mapped candidates. Host has `enqueueVerb` but autopilot only submits intents. “Eats, rests, sustains its loop” is unproved; P3 integration must establish executable survival coverage. P4 must not substitute scripted human actions or rebuild reflexes.
3. Main's `shard.observationFor` lacks legal candidates; scheduler commit supplies them. Include that change.
4. Existing `ws.ts` clears active orders on disconnect/replacement. Browser or laptop connection must not own the always-on agent controller. P4 needs server-owned runtime and read-only owner status/observation.
5. `runMindExchange` returns standing-goal fallback on transport/parse failure; returned goals cannot prove awake. Instrument explicit per-attempt and final validated outcome.
6. Owner registry, dynamic spawn, role manifest, lifecycle recovery, endpoint egress guard and UI are new P4 work. Existing shard and adapters are not missing, contrary to v0 assessment.

## 1. Records, credentials and validation

Use `src/game/agent/account.ts` as shared type location. Preserve v0 Account/Character/MindConfig fields, add `Character.revision: number` (positive integer). Timestamps `*At` = Unix milliseconds; `*Tick` and autopilotSince = authoritative shard ticks. IDs are server-generated opaque IDs; new bodyId equals characterId, never a caller's identity.

Account creation needs no email/payment. Generate owner token with 32 CSPRNG bytes; store digest, reveal once. Owner token and actor controller key are distinct. Private host record holds token/key bindings, body ID, role version, spawnInitialized, recovery operation; never expose them in public Character.

Public wrapper `CharacterView = {character: Character, publicMind: PublicMind|null}`. `PublicMind.config` is secret-free. `secretHint` is **"configured" or null**, not a key suffix: v0 maskSecret can disclose short secrets. Don't use it in responses. Character list `{characters: CharacterView[]}`. Reject secret/apiKey fields embedded in config rather than persisting unknown keys.

Write validation and readiness are distinct. Name-only draft must save. Invalid supplied values fail atomically. Full readiness is not create/update validation.

- Name: trim, 1–32 UTF-16 code units, unique case-insensitively per account.
- Directive: string ≤2000 code units; empty/whitespace is valid draft but incomplete for unleash.
- Role: null or ranger/smith/banker/mule present in manifest; unknown ⇒ UNKNOWN_ROLE; absent manifest ⇒503 CONFIG_UNAVAILABLE.
- Mind: reject arrays, unknown keys and wrong types; kind cloud/local, cloud provider openai-compatible. Optional model, when supplied, trimmed 1–128 code units.
- Ready: name + role pack/manual + nonblank directive + valid config + resolved model + stored cloud key. Missing model may use explicit operator default; otherwise MODEL_REQUIRED. Never invent model or subscription. Cloud base default `https://api.openai.com/v1`; local has no endpoint default.
- Model URLs are API bases (including /v1 when needed), adapters append /chat/completions. ≤2048 chars, no userinfo/query/fragment, http(s) only plus deployment egress policy below.
- Connectivity is **not** readiness. Unreachable configured local endpoint can unleash on healthy reflexes. Missing cloud key is incomplete config. Billing is never consulted.

Recovered validators lack closed-key parsing, model/key checks and whitespace-directive handling. Host worker adds these before acceptance; 10 green scaffold tests don't cover them.

## 2. API v1

Extend HTTP handler in `ws.ts:createTransport` through injected routes/services; don't create another world/listener. Existing healthz and character-key protocol remain compatible. JSON body cap 16 KiB, no-store responses, trusted console Origin allowlist, rate-limited account creation/mutations. Never log bodies or Authorization. Owner Bearer required except account creation. All foreign/nonexistent character IDs return indistinguishable 404; invalid token 401.

Errors `{error:{code,message,field?},fields?:FieldError[]}`. Controlled actionable text, no raw provider errors. Invalid JSON 400; invalid fields 422; conflict 409; infrastructure unavailable 503.

| Route | Body | Success |
|---|---|---|
| POST /api/v1/accounts | {} | 201 {account,ownerToken} |
| GET /api/v1/roles | — | 200 RolePackManifest |
| GET /api/v1/characters | — | 200 {characters:CharacterView[]} |
| POST /api/v1/characters | {name,roleId?,directive?,mind?} | 201 CharacterView |
| GET /api/v1/characters/:id | — | 200 CharacterView |
| PATCH /api/v1/characters/:id | partial name/roleId/directive/mind + expectedRevision | 200 CharacterView |
| PUT /api/v1/characters/:id/mind-secret | {secret,expectedRevision} | 204; refetch revision |
| DELETE /api/v1/characters/:id/mind-secret | {expectedRevision} | 204; refetch revision |
| POST /api/v1/characters/:id/unleash | {expectedRevision} | 200 {characterId,lifecycle:"unleashed",agentId,startedTick,mindState,driver} |
| POST /api/v1/characters/:id/recall | {expectedRevision} | 200 {lifecycle:"recalled",stoppedTick} |
| GET /api/v1/characters/:id/status | — | 200 CharacterStatus |
| GET /api/v1/characters/:id/journal?after=sequence&limit=n | default limit50, cap100 | 200 {entries:{sequence,tick,source:"mind"\|"system",text}[],nextCursor:number\|null} |

All ownership checks apply to secret/status/journal/action routes too. Reject writable accountId/bodyId/lifecycle/billing. Revision mismatch ⇒ REVISION_CONFLICT; UI reloads. Already-achieved unleash/recall is idempotent success even with stale revision; other mutations require current revision.

Create account/character requires `Idempotency-Key` (opaque 16–128 chars), reused on retry; persist request digest/result for 24 hours. Same key/different payload ⇒409. Account retry returns same token via encrypted expiring replay record, not a second account. Serialize per-character transitions; runtime Map alone is not crash idempotency.

## 3. Storage and lifecycle

Single-writer beta under EMBERHALL_DATA_DIR. New `accounts.json` and `director-characters.json` use schemaVersion:1 envelope, atomic temp+rename and serialized writes. Preserve legacy `characters.json`; explicitly bridge existing actor identities. Fail closed on corrupt ownership files. Shard body/skills/items remain in shard-save.json, not config copies.

Separate encrypted secrets store, operator key outside data directory, restricted filesystem permissions/Windows ACL. Protect account replay token similarly. No plaintext keys in registry/save/logs/journal/fixtures. If protection unavailable reject secret writes; never fall back to plaintext. Console token in memory/session storage for beta, clear on logout; no cloud keys in local/session storage. Non-secret form autosave excludes all credentials.

Transitions:
- draft→ready when complete; ready→draft if incomplete edit. Recalled stays recalled until unleash.
- ready/recalled→unleashed after readiness + bundled-runtime checks; draft refuses CONFIG_INCOMPLETE. Already unleashed is no-op, same agentId/body.
- unleashed→recalled; recalled→recalled no-op; draft/ready recall ⇒ NOT_RUNNING.
- Reject clearing required config/deleting cloud secret while unleashed with RECALL_REQUIRED. Complete role/directive/config replacements allowed; new revision takes effect next exchange, stale response cannot overwrite it.
- Recall cancels scheduling and in-flight work, unsubscribes, generation-fences late submissions, clears queued/active orders via shard authority. Body/assets persist; recall is not deletion or promised invulnerability.

Crash-safe activation: persist desired state + operation ID; ensure stable actor on shard tick boundary; initialize only if never spawned; checkpoint actor + spawn marker together; attach one generation-fenced runtime; finalize registry result before success. Restart reconciles operation, body existence and checkpoint before agents/ticks start. Crash tests before/after each write must prove one body and no repeated skills/gear. Migrated existing bodies count initialized. Return RUNTIME_UNAVAILABLE when bundled reflex cannot start, not when user mind is asleep.

## 4. Role pack and directive wiring

Host owns `agent-packs/packs.json`: existing RolePackManifest plus `version:1`. Entries id,label,summary,file,startingSkills. Values must match existing authored starting-skill tables and live SkillId bounds; fixtures are not authority. Resolve only allowlisted pack files, never caller paths.

For each exchange set exactly one MindRequest.rolePack/manual/directive/goals/observation/journalTail; existing assembler runs once. No accumulated prompt buffer, retry append or double pack. Starting skills once at initial spawn. Later role change modifies prompt only, never learned skills/items. Persist directive immediately, emit one coalesced mind trigger; retain latest while asleep for wake. Pack text is game guidance, not permission to override security boundaries.

## 5. Connector and network boundary

Cloud → `createOpenAIAdapter({baseUrl,model,apiKey})`; local endpointUrl → `createLocalAdapter({baseUrl,model})` from **src/game/agent/adapters/**. Reuse implementation via injected guarded fetch.

Local is relative to process fetching: **Fly's localhost is not the owner's laptop**. Hosted beta needs owner HTTPS tunnel/reachable endpoint; UI explains topology. Same-machine development can explicitly allow loopback. Reverse connector is future work, not a capability to imply. Offline allowed local URL can still activate in reflex mode.

Hosted egress must block loopback/private/link-local/reserved/metadata destinations (literal + DNS + rebinding), forbid redirects, require HTTPS; only explicit operator-managed development allowlist permits particular LAN/loopback HTTP origins. Apply policy to cloud custom URLs too. Validate at save where possible and every fetch after resolution. Bound response to 1 MiB and enforce abort. Never forward credentials across origins. This **replaces v0 blanket acceptance of SSRF**.

Current runMindExchange retries once with 20s per attempt. Add explicit transport/validated-parse outcome reporting; fallback goals are not awake proof. Bound failed exchange to 40s including noncooperative-adapter cancellation. Auth/invalid JSON ⇒ error/degraded, not healthy mind. Sleeping retries back off 1m→5m→15m; non-generating probes where supported, otherwise meter every completion. No assertion that asleep probes inherently cost zero tokens.

## 6. Runtime and observable sleep/wake

New runtime port in src/server/agent-runtime.ts: ensureAgent(character,operationId), stopAgent(characterId), status(characterId). Server owns lifetime independently of console/laptop. Reuse integrated P3 backend/source/submission/metering. Mind updates goals/advisory hints; no second concurrent action writer.

Extend CharacterStatus:
```
driver: "mind" | "reflex" | "none"
mindState: "unconfigured" | "connecting" | "awake" | "asleep" | "error"
runtimeState: "inactive" | "starting" | "running" | "degraded" | "recovering"
reflexState: "ready" | "unavailable" | "budget-exhausted"
reasonCode: string | null
lastAppliedActionTick: number | null
configRevision: number
```
Retain characterId/lifecycle/autopilotSince/lastMindExchangeTick/lastReflexTick/body/journalTail. Driver mind means planning available, not bypassing reflex validation. Inactive/recalled driver none. lastReflexTick means completed logged decision, not every tick; lastAppliedActionTick means actual authoritative effect, not queue admission.

Local unreachable: lifecycle stays unleashed, same body; asleep + reflex + running when reflex ready; set autopilotSince once and append one marked system sleep line. Reflex event scheduling continues against latest observation. AUTOPILOT_COPY banner only when reflex truly ready. Closing browser or local endpoint must not stop body or server runtime.

Wake: valid mind response ⇒ awake, clear autopilotSince, one wake line, latest directive/goals/journal + fresh observation. Coalesce recovery: if successful exchange already used fresh state, don't issue duplicate immediate exchange. Prevent stale late responses and double controllers.

Reflex outage/budget denial: retain desired lifecycle but degraded + unavailable/budget-exhausted; show “Autopilot unavailable” with sanitized reason, **not** “instincts keep it going.” Preserve legal sim state and P3 bounded retries; no free stub, unmetered provider or hidden scripted fallback. Actual injury/death stays visible; spec promises continued control, not immortality.

## 7. Work ownership and hotspots

- Host t_2cc15c31: account.ts/fixtures alignment, registry/secrets/manifest, DTOs, HTTP routing, authoritative dynamic registration.
- Console t_c7826c9c: new routes/console.tsx, components/console, lib/console-api.ts; VITE_DIRECTOR_CONSOLE off by default; non-secret form retries, no billing; typed mocks follow v1. Authenticated status poll at 2s while visible, back off errors/stop on unmount; UI polling never triggers model calls. Don't open actor control socket.
- Integration t_bd9b2aef: agent-runtime, sleep outcome instrumentation, generation fencing, durable activation recovery, independent observation feed. Consume P3; report incompatible seams, don't rebuild scheduler.
- P3 t_166eb9f5/root t_7199f16f: backend + metering wiring, action coverage, survival/cost gate.
- QA t_11629bc1: independent live-host/browser scenarios and stopwatch.

Hotspots: src/server/shard.ts, src/server/ws.ts, package.json, account.ts. Host owns shared API/types; integration coordinates incremental additions. Patch test registration string, don't rewrite package.json. No deploy or paid call authorized by this spec.

## 8. Acceptance matrix (downstream gates, not claimed passed)

| ID | Required proof | Owner |
|---|---|---|
| S1 | Fresh browser/account to role/directive/cloud key/unleashed + first actual authoritative action <300 wall seconds; prepared authorized provider; no billing UI/API dependency | QA |
| S2 | Local reachable then endpoint off AND console closed; within ≤40s after triggered failed exchange asleep/reflex + one sleep line; same body continues real legal actions/survival for vale day, no scripted fallback | P3/integration/QA |
| S3 | Restart and crash each activation write boundary; same owner/config/body/skills/items and one runtime; no double grants | Host/integration |
| S4 | Foreign account list/read/patch/secret/status/journal/unleash/recall isolation, generic404; invalid token401; read-only observer cannot act | Host |
| S5 | Unique fake key absent from responses/logs/journal/registry/save/browser storage; short key never leaked; unavailable protected storage refuses write | Host/console |
| S6 | Concurrent + replay create/unleash/recall same identity; differing idempotency payload409; stale edit409; late callback after recall cannot submit | Host/integration |
| S7 | Name-only draft succeeds; whitespace directive/missing model/cloud key block unleash; bad types/keys/roles/URL schemes/userinfo/query/fragment/metadata/DNS redirect fail atomically | Host/console |
| S8 | 503 preserves non-secret form, clears secret; if key was persisted refetch presence, otherwise require honest re-entry | Console |
| S9 | Free-beta activation without card/subscription/payment; billing never consulted | All |
| S10 | Pack/manual once per request across retries/restart; role values match authored packs; role switch doesn't reset skills | Host |
| S11 | Initially offline but valid allowed local URL/model unleashes on ready reflexes; warning not activation error | Integration |
| S12 | Wake uses newest revision + fresh observation, one wake line, no duplicate controller/exchange; malformed response not awake | Integration |
| S13 | Reflex failure/budget denial visibly degraded, no healthy-autopilot banner or unmetered/stub substitution; execution distinct from admission | P3/integration |
| S14 | Recall cancels all pending activity but preserves character; idle causes no model calls; observer disconnect doesn't cancel runtime | Integration |

S1 clock starts first account action on clean console, stops only after unleashed plus real action; report elapsed/build/provider/pre-provisioning. S2 day proof separate from five-minute onboarding. Quiet-window inactivity is not reason to poll. Advancing lastReflexTick alone is not survival proof.

## Verification actually performed

- Read plan Phase 4, recovered contracts, actual console entry, host, packs/prompt, mind adapters and scheduler implementation.
- At recovered e1123a2: `node --experimental-strip-types --test src/game/agent/account.test.ts src/game/agent/agent.test.ts` exit0, 18 passed.
- At scheduler4d0e434: `node --experimental-strip-types --test src/game/agent/events.test.ts src/game/agent/scheduler.test.ts src/game/agent/autopilot.test.ts src/game/agent/hostfeed.test.ts` exit0, 26 passed including real local WS/shard.
- No paid Jev, deployed reflex, full-day survival, browser onboarding or full-suite claim. This task only refreshes specification; recovered code is preserved, not expanded.
