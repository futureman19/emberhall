# Recovery toast layout fix

Only Toast presentation in hud.tsx changed. Portrait notification now sits below inventory/settings at top192px; wider viewports retain top96px. Z40 paints above movable minimap, pointer-events:none preserves underlying interaction, bounded width wraps text, role=status announces updates. No game/store or tool-art changes.

Reproduction recovery-toast-smoke red fails on toast paint priority. First candidate was readable but overlapped portrait inventory control in visual review; corrected vertical slot and added visible-button rectangle intersection assertion. Final local/deployed tests cover390x844,844x390,1440x960: toast above map stacking, within viewport, no text overflow, no button rectangle overlap, pointer transparency and status semantics. Representative two-line recovery message; no claim about arbitrarily long messages or every user-dragged map position.

Final lint,typecheck,full npm test,build all exit0. Scripts198/198, game/components562/562. Exact preview https://emberhall-vale-qkjxo92bb-andrews-projects-ffe8a9fd.vercel.app/art/phase1-preview.html inspected Preview/Ready dpl_8WyDPTg4tMMUjcBSyyd2GPeNKvAD. Three live toast viewports pass;36 existing live HUD checks pass. Live portrait screenshot visually confirms readable complete message,11px clearance below settings, no control/minimap overlap. Evidence under art/verification/toast plus phase1/toast-hud. First candidate/red evidence retained.

Stage: Phase2 acceptance cleanup. Tool readability, full animation/ghost-return checks and performance gaps unchanged. Production untouched. Preserve unrelated routeTree.gen.ts and earlier untracked art evidence.
