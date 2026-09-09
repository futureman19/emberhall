# Phase 2 tool geometry pilot

Four existing ItemIds only: hatchet, pick, hoe, fishing_rod. No weapons or wearables in this batch. Preserve exact existing parent grips, mesh offsets, rotations, animation refs, equip logic, local -Z player front, materials, ghost behavior and picking. Replace only eight geometry attachments: four handles and four heads/reel. All other equipment and appearance surfaces unchanged; inventory/paperdoll remain their existing lightweight representations.

Art: warm rounded timber shafts; broad shaped hatchet wedge, tapered forged pick ends, beveled garden hoe, tapered fishing pole and faceted reel. No added lights, textures, simulation fields, attributes or yields. Bounds must stay inside original mesh envelopes. Editable named Blender source parts; exports centered on the original mesh anchors rather than floor-grounded (held equipment is not a building).

Export budget: eight mesh parts, each under 1500 triangles; total GLB under 150KB. Same draw calls expected by attachment replacement but performance must be measured, not inferred. Original Box/Cylinder/TorusGeometry remains on missing/invalid asset. Keep original ghost/material semantics, including original opaque metal parts; do not silently change ghost styling under art scope.

Before integration: original same-save desktop/mobile equipped screenshots and timing. After: same state, four tools, idle/action phase/ghost/failure, actual gameplay where reachable, full canonical gates. Release performance gaps remain open. Preview-only; no production promotion.
