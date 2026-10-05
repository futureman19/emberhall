# Rowan-only current-main port

Runtime integration is ported narrowly from `603e6f7206036b5cbc52978a9732a4338ad1cfbf`, retaining current-main first-person visibility and all existing pose/equipment ownership. Only player and creator opt into Rowan; NPC policy and fallback remain unchanged.

## Immutable asset source

- Asset source commit: `41257d7bb7e2c77eb63ea95e1f315072f69590ea`.
- Runtime file: `public/art/character-reimagined/rowan.glb` (366696 bytes).
- SHA-256: `2b5cff5a268c53c36c26351a42e5c2fce7a70fd74d7c13f7414d353fa4fb0ad4`.
- Editable source at that commit: `art/blender/character-reimagined/rowan.blend`.
- Generator at that commit: `art/blender/character-reimagined/build_characters.py`; consult the adjacent README and integration contract before regeneration. That generator is a multi-character/gallery pipeline, not an isolated Rowan build command. This port deliberately references the immutable source instead of importing other characters, gallery tooling, vendor code or historical screenshots.
- GLB bytes were compared with the original worktree and the immutable asset commit; no asset regeneration occurred.

## Acceptance boundary

This is a local offline integration checkpoint, not deployment or fresh browser acceptance. Historical smoke harnesses and results remain in integration commit `603e6f7206036b5cbc52978a9732a4338ad1cfbf`; they are not evidence for this current-main port.

Before release, run fresh real-app desktop/mobile creator/player, rejected-download fallback, selected-color/hair, normal walk/action, equipment and seeded-poison death/healer restoration checks against this branch and its production build. Confirm current-main first-person hiding and Forged Oak UI remain correct. Run the auth invariant against the same owned running application. No server was started, and no push, PR, merge or deployment is authorized by this checkpoint.
