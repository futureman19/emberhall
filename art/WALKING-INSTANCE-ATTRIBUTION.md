# Active instance method attribution

Browser-only AST interception in deployed routes-BfNKbK8R.js. Timers accrue only while selected scenery grid is active; updateMatrix/setMatrixAt/setColorAt calls preserve receiver and optional-object argument short-circuiting. Calls outside grid execute normally through wrapper, adding diagnostic dispatch overhead; no CPU/GPU throughput claim.

Across both captured scenery scans: updateMatrix5,075 calls/~1.5ms; setMatrixAt8,523/~1.5ms; setColorAt8,523/~1.4ms. Grid totals50.8ms at action start and46.7ms at boundary. Method timing is nested within grids, not additive. This is method-body elapsed CPU excluding some wrapper overhead and argument preparation, not all transform-related costs (position/rotation/scale operations remain unmeasured).

One real controlled walk arrived,636frames,p95~16.7ms, no page errors; lint passed. Matrix/color copying and matrix composition are not dominant measured costs in this fixture. Remaining work includes tile/biome/resource/occupancy queries, transform setup, and instrumentation overhead. Next useful target: identify expensive query branches within the grid, not direct buffer-writing replacements or parked active-count changes.

Raw civic/walking-instance-costs.json and walking-instance-lint.log retained. No runtime change or deployment; public palette preview unchanged. No physical-mobile/global acceptance.
