# Near-ground vertex attribution

Browser-only instrumentation of routes-DihN2Dqi.js in the existing isolated preview; no runtime edits or deployment. One settled controlled hoe action, mobile viewport on desktop GPU, real-time simulation with four completion frames.

Successful capture: actions-terrain-vertex-fixed/results.json. Near vertex loop 95.9ms; post-loop finalization (attribute dirty flags, computeVertexNormals, computeBoundingSphere) 6.7ms; enclosing near-ground block 102.6ms. Far ground 13.2ms. Maximum frame interval 183.3ms. Actual tilling outcome passed; no page errors; npm run lint passed. These are instrumented CPU measurements, not physical-mobile or whole-game performance acceptance.

Hypothesis supported within this capture: vertex calculations dominate near-ground rebuilding, not normals/bounds. Next investigate groundY versus biome/color/cover calculations, retaining exact geometry and update timing.

Failures retained: actions-terrain-vertex-costs and actions-terrain-vertex-retry. First timed out waiting for Continue with no pageerror; console capture on retry exposed Unexpected token if. Diagnostic injection lacked a separator after the minified final expression. Added explicit semicolons; corrected capture passed. No deployed code was modified by the failed browser interception.
