# Closed destination diagnosis

Both desktop/mobile live probes reproduce no path and toast "The way is closed." Destination262,304 is cobble height1; no build/till/spell mode or plot. Resource-action hypothesis ruled out.

Captured local grid x256..268,z297..307 in civic/route-destination-grid/results.json. Eight-neighbor flood using pathfinding.ts climbOk/kindWalk constraints finds 13 connected tiles around destination and no captured-boundary exit. Thus this low cobble island is enclosed by impassable height changes even under permissive diagonal handling. Nearby tavern center262,302; this fixture's terrain prevents the requested traversal. Not caused or solved by scenery flora filtering; historical origin not established by this probe.

Raw desktop/mobile diagnosis: civic/route-destination-diagnostic/results.json. Original visibility failure retained. Diagnostic scripts intentionally return exit1 because route still fails; not a passing acceptance. No terrain edits, runtime changes or deployment. Camera/occlusion acceptance remains blocked for this route. Next: investigate review-save tavern access versus intended entrance/terrain grading before modifying a fixture or claiming a game regression.
