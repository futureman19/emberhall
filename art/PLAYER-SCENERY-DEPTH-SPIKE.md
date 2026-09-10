# Scenery-only depth visibility prototype

Local frozen browser prototype renders scene with player figure hidden to temporary depth texture, restores player, then applies an overlay only where player fragment depth lies behind sampled scenery depth. Original scene, camera and picking untouched. Isolated non-player mesh hiding is negative-control setup only, never product behavior.

Four checks passed: desktop/mobile isolated player pixel-identical with overlay; desktop/mobile occluded tavern render changes; all removals restore exact pixels. Each21 cloned ordinary meshes. No page/shader errors. Mobile image reviewed at gameplay scale: location cue readable, detailed pose/facing not established. This avoids prior self-depth tint in these fixtures.

NOT integrated/deployed. Extra full-scene depth render may be expensive; no performance claim. Frozen only: no moving-transform sync, ghost/equipment/death lifecycle, transparency-depth, picking parity or resource-cleanup-on-error acceptance. A production path must address those before shipping. Raw results and images civic/player-scenery-depth-spike/. Next bounded motion/ghost experiment, then measured cost; reject if extra pass defeats performance budget.
