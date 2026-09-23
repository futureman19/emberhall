# Crafting balance and expansion gate

**Decision: READY**

## Why
- All measured gates passed.

## Evidence
- Legal combinations enumerated: **1,533,408**; cap violations: **0**.
- Max-skill bow workmanship on choice-grade inputs: ordinary 0.0%, fine 80.6%, exceptional 19.4%.
- Max-skill sword workmanship on choice-grade inputs: ordinary 0.0%, fine 81.0%, exceptional 19.0%.
- Representative save payload: **23,746 bytes**; largest Vault inscription: **779 bytes**.
- Desktop/mobile browser journey: **PASS**.

## Acquisition model
Deterministic 200-seed simulations use 1.5s per surveyed node plus 0.72s per successful harvest impact. Travel, loading, combat, and cloth acquisition are explicitly excluded.

| Goal | Skill | p50 inspections | p90 | p99 | Modeled p50 seconds |
|---|---:|---:|---:|---:|---:|
| oak bow body | 50 | 5 | 5 | 7 | 11.1 |
| redwood bow body | 50 | 5485 | 8401 | 11333 | 8231.1 |
| ironwood bow body | 70 | 5085 | 8619 | 10925 | 7631.1 |
| copper sword edge | 20 | 29 | 47 | 68 | 47.1 |
| tin for bronze | 35 | 248 | 422 | 585 | 375.6 |
| highland sword edge | 55 | 677 | 1153 | 1833 | 1019.1 |
| emberite sword edge | 90 | 45693 | 85358 | 109903 | 68543.1 |
| moon silver sword edge | 75 | 19030 | 30480 | 40434 | 28548.6 |
| ruby inlay | 60 | 909 | 2567 | 5944 | 1364.22 |
| emerald inlay | 70 | 219 | 855 | 1500 | 329.22 |
| amethyst inlay | 60 | 230 | 863 | 1688 | 345.72 |
| diamond inlay | 70 | 184 | 599 | 1185 | 276.72 |
| sapphire inlay | 65 | 516 | 1810 | 3572 | 774.72 |

## Supply and sinks
- Harvest: 1 unit below skill 100; 2 at skill 100.
- Timber refining: 1 log → 2 boards, family and grade preserved.
- Ore refining: 1 ore → 1 ingot, family and grade preserved.
- Bow: 5 timber + 1 cloth + optional 1 gem.
- Sword: 5 ingots + 1 timber + 1 cloth + optional 1 gem.

## Stat caps
- **bow:** 46,368 legal combinations; max damage 15/15, hit 10/10, armor 0/0, local Fortune 5/5; 0 violations.
- **sword:** 989,184 legal combinations; max damage 18/18, hit 8/8, armor 0/0, local Fortune 0/5; 0 violations.
- **shield:** 456,192 legal combinations; max damage 0/0, hit 0/0, armor 5/5, local Fortune 5/5; 0 violations.
- **helm:** 7,392 legal combinations; max damage 0/0, hit 0/0, armor 5/5, local Fortune 5/5; 0 violations.
- **mail:** 7,392 legal combinations; max damage 0/0, hit 0/0, armor 7/7, local Fortune 5/5; 0 violations.
- **boots:** 7,392 legal combinations; max damage 0/0, hit 0/0, armor 5/5, local Fortune 5/5; 0 violations.
- **gauntlets:** 7,392 legal combinations; max damage 0/0, hit 0/0, armor 5/5, local Fortune 5/5; 0 violations.
- **greaves:** 7,392 legal combinations; max damage 0/0, hit 0/0, armor 6/6, local Fortune 5/5; 0 violations.
- **leather:** 1,056 legal combinations; max damage 0/0, hit 0/0, armor 5/5, local Fortune 5/5; 0 violations.
- **hood:** 1,056 legal combinations; max damage 0/0, hit 0/0, armor 4/4, local Fortune 5/5; 0 violations.
- **gloves:** 1,056 legal combinations; max damage 0/0, hit 0/0, armor 4/4, local Fortune 5/5; 0 violations.
- **hose:** 1,056 legal combinations; max damage 0/0, hit 0/0, armor 5/5, local Fortune 5/5; 0 violations.
- **charm:** 480 legal combinations; max damage 0/0, hit 0/0, armor 2/2, local Fortune 0/5; 0 violations.

## Five representative items
- **common:** an oak bow — damage 8, hit 0, armor 0.
- **skilled:** a fine oak bow — damage 8, hit 1.1875, armor 0.
- **rare:** a redwood bow of Power II — damage 10, hit 2, armor 0; inlay ruby flawed.
- **highland:** a fine highland ore sword — damage 11.5, hit 1, armor 0.
- **masterwork:** an exceptional highland ore sword of Power V — damage 18, hit 3, armor 0; inlay ruby perfect.

## Expansion rule
Do not add the full catalog yet. First prevent high-skill use of rare/max-grade materials from producing ordinary workmanship more than half the time. The existing bow/sword vertical slices remain release-testable; this HOLD applies to catalog expansion.

Full machine-readable evidence: `reports/crafting-balance-gate.json`.
