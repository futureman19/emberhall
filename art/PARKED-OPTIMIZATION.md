# Active-count optimization parked; next CPU bottleneck

User explicitly chose to park the optimization, restore prior renderer and pursue another bottleneck. Removed only mesh.count=from in terrain hideRest; git diff77daea2^ -- terrain.tsx is empty. Text equals parent after newline normalization (raw working-tree CRLF differs from Git blob LF). Preserved active-count regression under art/verification/civic/parked-active-count-regression.mjs outside canonical script discovery; it documents the parked implementation and is expected to fail against restored renderer. Existing candidate commits/assets/evidence retained. No reset, no unrelated routeTree changes.

Rollback gates:199 scripts and562 game/component tests pass; lint/typecheck/build pass after ledger refresh/annotations. No deployment; external preview already had prior renderer.

New actual CPU probe wraps658 registered R3F callbacks over600 paused mobile-hall frames. Horizon callback consumed507.6ms total (max1.7ms), compared with game tick20.5ms and lighting16.6ms totals. Instrumented timings include overhead and are not GPU/frame-time attribution or promised speedup. Source terrain.tsx948–975 confirms Horizon recalculates distant-tree distances/fades, ground heights, matrices and colors every frame even when player is stationary and stock unchanged. This is a separate measurable optimization candidate: skip only exact repeated inputs, including world/terrain revision, stock, position, graphics limits and mesh identity. Preserve all scenery/LOD/picking; verify invalidation before implementing.

Raw CPU data hall-cpu-callbacks.json retained locally. Historical pixel mismatch unresolved; broad-probe explanation corrected in ACTIVE-COUNT-STREAMING.md. No more repeated active-count parity runs planned.
