# AI-MMO soak — ranger + smith on one local shard

**Lane** qwen · **task** t_8b32a7bd · **base** e7593e6 · **branch** wt/t_3b1e4b19
**Seed** 20261121 · **vale days** 1 · **ticks** 8640/8640 · **real seconds** 143.7

## Time compression
shard.step(0.1) every 10ms (nominal 10x); measured 60.1 ticks/real-s = 6x effective under policy load. 1 vale day = 8640 ticks.
Nominal **10x**, measured **6x** (60.1 ticks/real-s, ~0.2 vale hours/real-s). SECONDS_PER_HOUR=36, 8640 ticks/vale day. The shard tick is driven manually (shard.step), never wall-clock; all agent mutations still cross the authenticated WS wire.

## Five assertions
1. **Authority — PASS**: valid accepted 290, valid rejected 0, invalid sent 16, invalid rejected 16, invalid accepted 0.
2. **Economy — PASS**: gold start 80 → end 80; violations 0; felled nodes tracked 0; checkpoints 29.
3. **Role loops — PASS**: ranger visible [hunt, track, eat]; smith visible [mine, bank_gold]. No player sleep verb exists in the sim (energy never regenerates; hall beds are legacy occupancy). Smith/ranger night-rest is idle at the hall, not sleep. Content gap flagged for the controller.
4. **Cost shape — PASS**: ranger 144 reflex calls ≈ $0.0067/vale-day, 9 mind calls; smith 144 reflex calls ≈ $0.0067/vale-day, 9 mind calls. Gate $0.5/agent/day. Mind slow-path exercised via runMindExchange against a scripted local adapter (no paid LLM provisioned). External mind cost = $0 here; BYO endpoint cost is the owner's and not modeled.
5. **Stability — PASS**: uncaught 0, unhandled 0, shard error lines 0; heap 332→615.5 MB (peak 656.4); handles 7→7.

## Top reflex questions
- **ranger**: "What should the ranger do now?" ×85; "quiet-window" ×58; "rest-at-night?" ×1
- **smith**: "What should the smith do now?" ×101; "quiet-window" ×42; "rest-at-night?" ×1

## Findings (SIM-level, flagged not fixed)
- world.gold is a SINGLE GLOBAL purse, not per-player: commandBankGold sweeps the entire purse into the acting player's vault (bank.ts). With two agents, whoever banks first collects both agents' loot gold. Conservation holds (no duplication) but attribution is wrong for multi-agent. SIM-level economy gap — flagged, not drive-by fixed.
- No player sleep mechanic: CtxVerb has no sleep; energy only decays (sim.ts) and never regenerates; hall/dorm beds carry legacy occupantId with no rest command. The smith pack's 'sleeps' loop cannot run as written; night-rest is idle at the hall. Content gap.
- Reflexes use the contract's choice/noul builders but the pick is sampled (seeded mulberry32) from normalized weights — answerChoice is greedy argmax, which collapses a role to one dominant verb. Mind via scripted local adapter through the real runMindExchange pipeline. Cost is the contract's modeled estimate, not a billed amount.

## Blockers
- none

## Reproduce
```
node --experimental-strip-types scripts/soak-run.mjs --days 1
```
Evidence: artifacts/soak/journal-ranger.jsonl, artifacts/soak/journal-smith.jsonl; artifacts/soak/decisions-ranger.jsonl, artifacts/soak/decisions-smith.jsonl; artifacts/soak/shard.jsonl; artifacts/soak/checkpoints/.
