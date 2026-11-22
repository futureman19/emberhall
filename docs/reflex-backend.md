# Reflex backend — zero-shot TypeSafe Jev (Phase 3)

The day-one reflex backend for the agent harness: it answers the contract's
`ReflexExchange` (`src/game/agent/types.ts`) through TypeSafe's hosted Jev API and
returns contract `ReflexAnswer`s built by `src/game/agent/reflex.ts` — this layer
never re-implements normalization, picks, or clamping, and never submits intents.
Backends are structurally unable to hallucinate actions: choice options are the
sim's own candidate labels and any pick outside the candidate set fails the attempt.

Wire shapes verified against the live docs on 2026-11-22
(`docs.typesafe.ai` → API reference, Choice/Score/Noul primitives, Models):

- `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <key>`.
- Request `{ model, state, questions: { <id>: Question } }`; answers return under
  the same ids with `usage: { input_tokens, output_tokens }` at the top level.
- Choice criteria are an option→description map (options self-describe on this
  wire — they are context-menu labels). Score criteria are 0-based level
  descriptions; the provider's own 0-based `score` is ignored — the contract
  builder recomputes the harness's 1-based expectation from probabilities, so the
  bases never mix. Noul needs no criteria.

## Files

- `src/game/agent/reflex-backend.ts` — the pluggable seam: `ReflexBackend`,
  `ReflexCallOutcome`, and the accounting metadata (`ReflexCallMeta` /
  `ReflexAttemptMeta` / `ReflexUsage`). Any backend (Jev today, self-hosted
  Emberhall Reflex v1 later) implements this. `decide()` is total: it resolves for
  every expected failure mode instead of rejecting, so callers can log without a
  try/catch around provider flakiness.
- `src/game/agent/jev.ts` — the TypeSafe Jev implementation (`createJevBackend`,
  `jevConfigFromEnv`). Server-side only in operation: it carries no secret itself,
  but the bundled key is injected from the host environment and never crosses to
  the client bundle.
- `src/game/agent/jev.test.ts` — mocked contract tests (on the repo `test`
  script): valid exchanges, invalid actions, provider errors, timeouts, bounded
  retries, credential hygiene, usage accounting.

## Configuration (host environment only — no `.env`, no client exposure)

| Variable | Default | Meaning |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | — (required) | Bundled application key. Rides the `Authorization` header only; never written to errors, attempt metadata, or logs (every provider detail string passes through a redactor). |
| `TYPESAFE_BASE_URL` | `https://api.typesafe.ai` | Override for staging/proxies. |
| `TYPESAFE_MODEL` | `jev-latest` | Model alias; the response's concrete `model` (e.g. `jev-1.13.0`) is recorded as `resolvedModel`. |
| `TYPESAFE_TIMEOUT_MS` | `8000` | Per-attempt timeout, clamped to (0, 60s]. |
| `TYPESAFE_MAX_RETRIES` | `2` | Retries after the first attempt. |

`jevConfigFromEnv(env)` returns `null` when no key is provisioned — the caller
decides whether reflexes are simply off for this run (dev) or the absence is
fatal (host). Nothing is logged on that path.

## Failure behavior (bounded, always recorded)

- **No HTTP on a bad request.** Exchange validation (question shape, unique ids,
  state JSON-serializable and ≤ 32 KiB) fails with `invalid_request` and zero
  provider calls.
- **Retries:** at most `maxRetries + 1` attempts; exponential backoff
  (`250ms · 2^(n-1)`); a `Retry-After` hint is honored up to a 5s cap so the
  provider cannot park the tick loop.
- **Never retried:** 4xx rejections (`provider_rejected`) — retrying a request the
  provider already refused only burns tokens. **Retried:** timeouts, network
  errors, 429, and 5xx (including 529 overloaded), and well-formed HTTP 200s whose
  answers fail validation (`invalid_response` — e.g. a pick outside the candidate
  set, a missing probability, a type mismatch). Exhaustion reports `exhausted`
  with every attempt in `meta.attempts`.

## Accounting surface (for the DecisionLog / cost lane)

Every `decide()` returns `meta`:

- `provider` (`"typesafe-jev"`), requested `model`, provider-reported
  `resolvedModel`, total `latencyMs` across attempts and backoff.
- `attempts[]`: per-attempt `latencyMs`, `outcome`
  (`ok | timeout | network_error | http_error | invalid_response`), `httpStatus`,
  `usage`, and a sanitized one-line `error` — including failed attempts and
  retries, so the log sees every billable call.
- `usage`: the successful attempt's tokens, else the last usage the provider
  reported, else `null`. **`null` means unknown, never free** — a cost lane must
  not zero-fill it.

Pricing provenance for cost attribution (models page, 2026-11-22): Jev 1.13/1.14
at `$42 / Btok = $0.042 / Mtok`; 64k context per request, 32k per question.
Pricing math, reservations, and durable records belong to the cost lane
(t_e3f72207); this file only guarantees the measurements exist.

## Integration points

- **Scheduler / autopilot lane (t_282dd560):** consumes `ReflexBackend` — stub it
  with `{ provider: "stub", decide: async () => ({ ok: true, result: …, meta }) }`.
  Event-driven cadence, budget hooks, and lifecycle live there, not here.
- **Host (`src/server/`):** instantiate once at boot:
  `createJevBackend(jevConfigFromEnv(process.env) ?? …)`; a `null` config means
  reflexes disabled. The shard shell itself is unchanged — no edits to
  `shard.ts`/`ws.ts` were needed or made.
- **DecisionLog lane (t_e3f72207):** append one record per `decide()` carrying the
  full `meta`, including `ok: false` outcomes — that is where failed attempts and
  retries stay visible. `DecisionLogRow` in `types.ts` is deliberately untouched
  here; its durable extension is that lane's call.

## Known limits

- Score levels cross the wire as generic `Level i of N` descriptions because the
  contract's `ReflexScore` carries a count, not labels. Richer per-level
  descriptions are an additive contract extension if scoring quality needs them.
- State cap is harness-side (32 KiB), far under the provider's 32 MiB body limit;
  oversized states fail `invalid_request` locally instead of surfacing as 413s.
