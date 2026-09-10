# Edge mismatch isolated; conditional haze locally restored

The diagnostic localized edge differences to far-ground color only (position begins -200,-8,88), not near-ground positions or coverage. Old harness injected changed shared haze inside near prepare, after the far callback had already sampled it. Second comparison therefore saw a different far-ground input. This was a test-order artifact.

Corrected harness applies identical haze before BOTH ground callbacks; alternates haze RGB for every case. Unchanged baseline4/4 and restored conditional-haze candidate4/4 exact buffer and pixel comparisons pass (desktop/mobile x interior/world edge). No page errors. Prior failures preserved. Edge diagnostic passed flag denotes collection completed, NOT parity; its cases explicitly show failures.

Conditional-haze runtime restored locally: padded snapshot span must contain all tiles to omit haze dependencies; any missing tile retains haze invalidation. Seven planner tests passed (including hole/removal/restoration/edge); typecheck and lint passed. Renderer math unchanged. No full suite/build/performance rerun in this batch and no deployment. Next production build and measured action controls before rollout.
