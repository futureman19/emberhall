# Tavern access and sampled visibility

Building center262,302 (historical hospitality entry target) is reachable from256,298 on both deployed desktop/mobile tests, unchanged terrain. Both arrived exactly; no page/shader errors. Route goes via257,296;258,297;259,300;260,301;261,301. Thus prior inaccessible262,304 must not be described as an inaccessible tavern entrance.

world.ts196 flattens261,304 radius2 height1; git blame attributes line to boundary commit97e9e4d dated2026-08-28. This grading predates flora optimization; no repair made. The low patch and intended building center are distinct destinations.

Twelve mobile center crops visually reviewed: player clear0–2, partially roof-obscured3, indistinguishable4–5, partially visible6, indistinguishable behind foreground foliage7–11. This identifies a sampled visual obstruction despite successful traversal; not continuous animation proof. Desktop arrival passed but its image sequence not reviewed yet. Raw civic/tavern-center-access/results.json, mobile-contact.png and all24 original screenshots retained. Screenshot sampling perturbs frame timings; no performance claim. Test scope uses QA useTile, not pointer targeting.

Next: compare identical path/images against pre-flora preview before classifying visual obstruction as regression or baseline. Avoid terrain repair: actual entry works. Runtime/preview/production unchanged.
