# Unmodified-terrain regional walks

Phase2 verification against isolated flora preview1hq8nnatn. Both predefined routes passed on first attempt, without terrain/height/building/clock/weather edits. Player repositioned to start, simulation paused for settling then normal speed; QA useTile rather than screen input. Disposable review save and mobile viewport on desktop GPU, not physical mobile. Screenshots captured but not visually reviewed. No runtime changes or deployment.

[
  {
    "region": "north",
    "passed": true,
    "errors": [],
    "frames": 733,
    "maxFrameMs": 99.89999999999782,
    "p95": 16.700000000000728,
    "start": [
      80,
      100
    ],
    "destination": [
      104,
      100
    ],
    "final": [
      104.04411667791506,
      99.82353328833977
    ]
  },
  {
    "region": "southeast",
    "passed": true,
    "errors": [],
    "frames": 635,
    "maxFrameMs": 133.29999999999927,
    "p95": 16.799999999999272,
    "start": [
      420,
      400
    ],
    "destination": [
      444,
      400
    ],
    "final": [
      443.8485524631293,
      400.0504825122902
    ]
  }
]

Raw evidence civic/natural-walk-{north,southeast}.json and .png. Lint passed. Inherited cached=true is a legacy harness label, not a near-biome-cache setting. Two route arrivals close only these route checks, not universal traversal, visual occlusion or performance acceptance. Next unresolved acceptance: actual pointer-driven walking and camera/occlusion checks; do not continue equivalent corridor timing reruns.
