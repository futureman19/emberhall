# VIS-U2-r1 — plants, rocks and shared loot

Status: implemented; independent QA pending. Local only; no commit, push or publication.

## Changes
- Six crop types at three growth stages and five wild reagent types with ready/picked states: 28 script-authored Blender state meshes. Editable flora.blend and build_flora.py retained.
- Neutral layered stone geometry, rendered through a shared instanced batch with existing catalog tint, dimensions, tilt, mining wobble and tile mapping. Applies to the existing iron_ore/highland_ore/ruby/sapphire rock renderer, without adding discovery hints, crystallized rarity markers or new resource nodes.
- Drawstring canvas loot pouch for drop/corpse sources, corpse tint retained. Contents, quantities, labels, ownership, expiry and opening behavior unchanged. Original DeathBody geometry deferred to U3, not replaced.
- Original rock/crop/pile proxy meshes retained with color/depth writes disabled only while authored geometry exists. They still submit draw calls; no performance improvement claim. Authored meshes do not raycast. Actual rejected GLB downloads restore original paint.
- No terrain generation, navigation, simulation, inventory/save, camera, forestry or U1 changes. 161 protected files matched pre-U2 hashes; original DeathBody and crop sapling/till source blocks matched.

## Quick verification
- Seven new real-GLB/proxy tests pass; package explicit test list appended, not regenerated.
- Typecheck, targeted lint and build pass; asset coverage ledger refreshed.
- Twelve selected bounded browser cases pass: flora dev/fallback/final-built and props dev/fallback/built, each desktop plus actual browser touch.
- Flora: dev checks 28 rendered state names; native garlic-bed harvest command targets exact tile. Not completed growth/yield acceptance.
- Props: dev checks authored rock batch plus two ordinary pouch roots, exact mine command tile and native opening of QA drop pile. Contents/resource records unchanged while paused. Not mining yield or transfer/expiry acceptance.
- Built HTML-linked JS/CSS and both GLBs match build bytes; tracked preview restarted after build. Final flora smoke rerun against combined U2 build.
- Evidence: art/verification/worldwide/vis-u2-flora-dev-v1, vis-u2-flora-fallback-v1, vis-u2-flora-built-final, vis-u2-props-dev-v2, vis-u2-props-fallback-v1, vis-u2-props-built-v1, VIS-U2-work.

## Retained failures and limitations
Initial flora export was all-white: fixed explicit Blender color-node wiring; normalized vertex palette tested. Initial props fixture used resource ID oak where GroundPile requires ItemId; PileGump failed on missing catalog label. Fixture corrected to valid log item; application catalog/render behavior not weakened. Failing vis-u2-props-dev-v1 evidence retained.

Small sprouts, moss and pale reagents remain subtle on mobile. A large tan looped scenery/fixture object exists even with new flora rejected; it is not the compact new pouch. Responsible original mesh not identified. Mobile pile panel overlaps the left control rail/weather toast in the controlled fixture: independent tester should compare U1 baseline and return exact bounds; no claim that this pre-existing panel layout is accepted. U6 owns general panel cohesion, but blocked essential looting must interrupt dependent work.

Tests use disposable cleared arrays/tiles and a distant owned fixture hut to avoid auto-look-hut insertion. No natural field, full lifecycle, save/reload, all resource identities, real-phone or measured-performance acceptance. Full npm test/lint regression belongs to independent QA.

## Handoff boundary
Freeze source/build/evidence as VIS-U2-r1. Ask user to forward TESTING-PROMPT.txt to @grokhermesautobot. Posted/acknowledged/testing are not confirmed. U1 and U2 now occupy the two pending-QA slots: pause further visual integration until at least one result is returned. No automatic publication.
