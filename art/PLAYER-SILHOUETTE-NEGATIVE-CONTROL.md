# Player silhouette fails unobstructed negative control

Browser-only isolated render hides non-player meshes synchronously, then restores their visibility. Original gameplay camera and all assets remain unchanged; no runtime integration. This is a diagnostic isolation, NOT removal of scenery as a solution.

Desktop and mobile both fail unobstructedEqual: overlay changes the unobstructed player. Each clones21 meshes; removing overlay restores exact original canvas bytes. No page/shader errors. Mobile candidate visually reviewed at gameplay scale; gold coloration present but still image alone cannot distinguish base palette. Exact before/candidate mismatch establishes unwanted effect in absence of external mesh occluders.

Simple GreaterDepth silhouette therefore cannot be accepted as scenery-only visibility treatment. Self-depth/overlap is a plausible mechanism; do not claim individual triangles diagnosed. Stop animation integration of this prototype. Next candidate must distinguish scenery depth from player depth (separate depth/stencil treatment) or use a clearly intentional marker; preserve camera, picking, approved scene and ghost visibility contracts. Public preview unchanged.
