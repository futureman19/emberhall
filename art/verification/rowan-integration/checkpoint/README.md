# Rowan local integration checkpoint

This checkpoint saves the existing player/creator integration, not a new art revision or production release. It supersedes the older reports' “no commit” status only; their browser runs remain historical, not rerun here.

Fresh acceptance: 12 focused character/facing/figure/save tests passed; scoped ESLint, TypeScript check and art inventory audit exited 0. All 38 payloads in the previous review-handoff manifest still match byte-for-byte, including original integration source and browser evidence. The later equipment/ghost report is retained separately as historical evidence. The approved Rowan GLB is unchanged from HEAD.

Fresh repository lint still reports 7,951 errors and 145 warnings in unrelated experiment/vendor inputs; none of this checkpoint's Rowan code paths appears in that output. Therefore this is a LOCAL CHECKPOINT, NOT full release acceptance. No push, deployment, new server, new browser test or whole-repository cleanup was performed. Gameplay/source behavior is unchanged by this checkpoint operation.

`verification.json` pins source hashes and distinguishes current CPU checks from previous browser results. `raw-logs.zip` preserves original .txt reports, the original RED test output, and the fresh full-repository lint failure without rewriting raw output. Earlier failed continuation attempts remain alongside their successful successor.

Only Rowan source, its inventory metadata, its smoke scripts, documentation and acceptance evidence are included. The unrelated experiments, generated files, backup .blend1 files, source models and main/Oak worktree are untouched.

Next release step: port this bounded player-only change onto current main in an isolated branch, run the full gates and desktop/mobile browser checks there, and obtain push/deployment authorization. Do not merge the entire older worldwide-art branch into main.
