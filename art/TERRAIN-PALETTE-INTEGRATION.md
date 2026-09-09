# Terrain palette local integration

Fixed KIND_COLOR palette now converted once and copied during colorAt. Helper retains only fixed palette entries, snapshots input strings, and refreshes when ColorManagement.enabled or workingColorSpace changes. Live tile reads, blend order, local Lanternwood conversion, geometry and update timing unchanged.

Verified local: 207 script tests, 562 game/component tests, lint, typecheck, production build. Four desktop/mobile same-state comparisons have exact geometry/instance buffers and rendered pixels. Palette numeric test covers supported srgb-linear/srgb working-space transitions and enabled toggles; scratch mutation does not change palette. Initial red test failed due to unsupported LinearDisplayP3ColorSpace import, not missing implementation; corrected to installed supported spaces before green. No claim of valid missing-helper red proof.

Production-built local preview8098 (proc_9c1b898d3c1c) HTTP200; 82 settlement checks and two real-time completion outcomes passed. Single action maxima149.9ms hatchet,183.4ms hoe; these are not a controlled final-source speedup proof. Prior browser candidate ABBA remains separate evidence. No page/shader errors in settlement probe.

Evidence: palette-integrated-parity.json; palette-tests.log; palette-build.log; palette-lint-final.log; actions-palette-integrated-completion/results.json; phase1/palette-local/results.json. Source integrated locally only. Public isolated preview and production unchanged. Next: final-source controlled performance check and isolated deployment/live verification. Global performance and physical-mobile acceptance remain open.
