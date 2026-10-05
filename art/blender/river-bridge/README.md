# Reedwake timber bridge

Original script-authored Blender geometry for the local Emberhall preview. Named editable planks, bearers, crossed rails, posts, iron pegs, stone abutments and graded stone approaches remain in `reedwake-bridge.blend`. Export copies are joined by four materials; the saved source is not joined.

- World placement: X=952, Y=0.6, Z=560 (waterline origin).
- Local deck top: Y=0.6; world deck top: Y=1.2.
- Deck length 7; width 3.2; canonical walk corridor 3 wide.
- End ramps extend to X=±5.5 and descend to world Y=0.8. Rails sit outside the walk corridor; neighboring rail tiles are blocked by the canonical navigation predicate.
- The narrowly scoped terrain renderer shows the stream beneath the deck. Ground height and tile navigation remain authoritative; a separate deck picking plane routes native input through the normal terrain handler.
- Failed downloads retain a simple deck, rails, supports and ramps with identical deck elevation.

## Regenerate / verify
From repository root, using Blender 5.2.1:

```
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/river-bridge/author_bridge.py
"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python art/blender/river-bridge/verify_source.py
node scripts/measure-river-bridge.mjs
node --test scripts/river-bridge-geometry.test.mjs
```

Regeneration **overwrites manual source changes and measured manifest fields**. Re-measure after export. The independent source reopening and real GLTFLoader measurement compare evaluated vertex sets at 0.0001-unit quantization, check geometry and record actual bounds/bytes/hash. The source ZIP excludes `.blend1` backups.

Initial verification: `art/verification/river-bridge/FINAL.md`. Latest approach polish and game-only ferry derivative: `art/verification/reedwake-waterfront/FINAL.md`. No physical-phone or performance claim. The original ferry gallery and mill kit remain unchanged; the game uses a separate waterfront derivative. The earlier source ZIP predates the approach polish; current editable source and runtime exports in Git are authoritative.
