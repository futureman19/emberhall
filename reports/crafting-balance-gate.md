# Crafting balance and expansion gate

**Decision: HOLD**

## Why
- Max-skill workmanship still yields ordinary quality more than 50% of the time on rare inputs; add skill-banded workmanship minimums before expanding the catalog.

## Evidence
- Legal combinations enumerated: **22,656**; cap violations: **0**.
- Max-skill bow workmanship: ordinary 67.2%, fine 16.4%, exceptional 16.4%.
- Max-skill sword workmanship: ordinary 68.0%, fine 16.0%, exceptional 16.0%.
- Representative save payload: **18,792 bytes**; largest Vault inscription: **779 bytes**.
- Desktop/mobile browser journey: **PASS**.

## Acquisition model
Deterministic 200-seed simulations use 1.5s per surveyed node plus 0.72s per successful harvest impact. Travel, loading, combat, and cloth acquisition are explicitly excluded.

| Goal | Skill | p50 inspections | p90 | p99 | Modeled p50 seconds |
|---|---:|---:|---:|---:|---:|
| oak bow body | 50 | 5 | 5 | 6 | 11.1 |
| redwood bow body | 50 | 758 | 1316 | 1729 | 1140.6 |
| highland sword edge | 55 | 319 | 594 | 861 | 482.1 |
| ruby inlay | 60 | 567 | 1583 | 2590 | 851.22 |
| sapphire inlay | 65 | 265 | 1049 | 1888 | 398.22 |

## Supply and sinks
- Harvest: 1 unit below skill 100; 2 at skill 100.
- Timber refining: 1 log → 2 boards, family and grade preserved.
- Ore refining: 1 ore → 1 ingot, family and grade preserved.
- Bow: 5 timber + 1 cloth + optional 1 gem.
- Sword: 5 ingots + 1 timber + 1 cloth + optional 1 gem.

## Stat caps
- **bow:** 4,224 legal combinations; max damage 14/15, hit 5.25/10, armor 0/0, local Fortune 5/5; 0 violations.
- **sword:** 18,432 legal combinations; max damage 18/18, hit 3/8, armor 0/0, local Fortune 0/5; 0 violations.

## Five representative items
- **common:** an oak bow — damage 8, hit 0, armor 0.
- **skilled:** a fine oak bow — damage 8, hit 1.1875, armor 0.
- **rare:** a redwood bow of Power II — damage 10, hit 2, armor 0; inlay ruby flawed.
- **highland:** a fine highland ore sword — damage 11.5, hit 1, armor 0.
- **masterwork:** an exceptional highland ore sword of Power V — damage 18, hit 3, armor 0; inlay ruby perfect.

## Expansion rule
Do not add the full catalog yet. First prevent high-skill use of rare/max-grade materials from producing ordinary workmanship more than half the time. The existing bow/sword vertical slices remain release-testable; this HOLD applies to catalog expansion.

Full machine-readable evidence: `reports/crafting-balance-gate.json`.
