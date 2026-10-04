# U3 offline bow, torch and shields

Four script-authored items, eight centered GLB parts. Editable offhands.blend independently reopened. Actual GLTFLoader finite-vertex/normal and envelope checks passed; enlarged static lineup reviewed. Runtime files and frozen U1/U2 packets unchanged.

This completes offline models for the nine previously primitive equipment entries when combined with VIS-U3-weapons-r1. The four approved tools are retained, not regenerated.

## Integration boundary
Do not overwrite approved tools.glb. New assets are offline and have no runtime loader/attachments yet. Preserve existing parent transforms, arrow ref/visibility/position logic, torch light behavior and original materials/ghost-state contracts when integrating.

Bow is a deliberate geometry exception: parts use the COMBINED original stave/string envelope, not each individual old narrow box. Original boxes occupy x [-.02,.09], y [-.03,.59], z [-.02,.02]. New limb/string parts center at game [.035,.28,0] and fit size [.11,.62,.04]. This center must be respected at integration; blindly replacing old stave or string geometry at their old centers is incorrect. Arrow anchor stays original.

Shield/torch parts remain within original per-part dimensions. Static image suggests bosses seated and string connected; side/contact, actual hand grip, character-scale readability, animation and performance remain unverified. The static flame shape must not replace runtime light/ghost behavior.

Regeneration overwrites this folder's authored outputs. Source scripts do not write src or public. Runtime integration remains paused until a U1/U2 QA result frees a slot.
