# Visual review and scope notes

## Inspected actual renders

Reviewed all four beauty views, candidate facial closeups, Mira's braid/back view, the assembled hero/contact/world-distance plates, desktop and mobile GLTFLoader gallery screenshots, candidate/current face comparisons, and the raised rigid-arm study. These are actual generated renders and actual browser screenshots, not painted mockups.

### Revisions made from inspection

- Initial eye whites and dark sockets looked excessively protruding. Reduced the socket/eye depth and outline size and aligned the irises for a calmer, better-seated face.
- Initial lip pieces read as fragmented and later sank into the planar face. Replaced them with one restrained two-segment smile and seated it just ahead of the face surface.
- The first diagonal satchel strap read like a cylindrical rigid bar. Replaced it with a thin flat beveled strap and an over-shoulder continuation.
- Added a distinct scarf/knot/tail to Mira and stand collar, shoulder tab and toggle closures to Arden so the proposals are not only color swaps.
- Independent geometry checks caught zero-area triangulation at Mira's thin satchel flap: bevel radius had met half the thickness. Limited bevels to at most 40% of the minimum part dimension. Final Blender and actual GLTFLoader triangle checks pass; initial failures are retained as `failed-bevel-source.log` and `failed-bevel-geometry.log`.
- Fixed a missing third coordinate in the gallery's orbit target before browser acceptance. Made mobile face framing aspect-aware, keeping complete heads visible rather than cropping both half-width comparison panes.
- Clarified plate labels: current *hairstyle*, silver *crop*, and native-pixel crops that must be viewed at 100%.

Initial renders are retained under `revision-01/` and are NOT the final design. Earlier build logs are historical; the final geometry build is `build-final-bevel-safe.log`.

## Final observations

- Full figures and faces are framed without important clipping. Both current and proposed figures retain ground contact.
- The proposals have a shared compact body and broad head; faces, hair shapes, scarf/collar/closures, boots, hands and accessories show substantive changes.
- Rowan remains close to the rust/brown identity; Mira's teal and dark hair and Arden's pale crop/plum clothing separate more strongly at default world distance.
- The head/eye/nose surfaces and materials load coherently in WebGL as well as Blender. Hair is deliberately faceted and chunky. Deep dark joins beneath Mira's fringe remain visibly stylized rather than strand-like; topology/source↔export checks found no missing/degenerate surfaces in the final models. More natural hair flow would be an art-direction refinement, not something this review claims solved.
- Hands/arms are connected and the rigid shoulder study visibly moves the hand. Its single raised pose can overlap scarf/chest clothing. Full range-of-motion, action-specific collision and tool grip are NOT accepted by that study.
- At native world distance, fine facial/hand details reduce to pixels. The head, hair/outfit values and boots carry most identity. Static studio evidence is not a substitute for a later busy-world/animation readability test.
- Current reconstructed height is approximately 1.25 units and candidate height approximately 1.177 units (about 94.16% of current). They are rendered at identical physical/camera scale, not normalized to disguise this small proportion change. Shared head/shoulder anchors are not enough to imply drop-in compatibility.
- Desktop and 390px mobile screenshots show both models, all viewer buttons and readable main hierarchy without horizontal overflow. Small secondary labels/footer links remain compact; no accessibility-conformance claim is made.

## Evidence boundaries

`browser-full-verification.json` is the full delivery harness report, including server-close probe. `browser-verification.json` is the separately authored independent reviewer harness. Both use the same final asset hashes. Their screenshots and logs are retained; they do not represent two different product versions. Additional independently authored `verify_glb.mjs`, `verify_browser.mjs`, `compose_sheets.py` and source audit scripts are included for traceability; the main reproduction sequence is in README.md.

No full application build/test/deployment was run because this is an isolated art-only preview. No live characters were replaced, no gameplay acceptance is claimed, and triangle/material counts are measurements rather than performance claims.
