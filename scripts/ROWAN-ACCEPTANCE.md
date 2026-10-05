# Bounded Rowan release acceptance

Run from repository root after `npm ci`. Set `EMBERHALL_ARTIFACT_DIR` to an absolute **outside-repository** directory; every run label must be new. Scripts refuse to overwrite reports. Build before preview; select unused strict ports and stop only servers you own.

```bash
npm run dev -- --port 59008 --strictPort
npm run lint && npm test && npm run typecheck && npm run build
node scripts/check-auth-invariant.mjs --dev-url http://127.0.0.1:59008
npm run preview -- --host 127.0.0.1 --port 59009 --strictPort
export EMBERHALL_ARTIFACT_DIR='C:/Users/futur/.hermes/profiles/telegram2/cache/documents/rowan-release-acceptance'
node scripts/rowan-character-smoke.mjs http://127.0.0.1:59008 dev-new
node scripts/rowan-character-smoke.mjs http://127.0.0.1:59008 failure-new
node scripts/rowan-equipment-ghost-smoke.mjs http://127.0.0.1:59008 equipment-new
node scripts/rowan-built-smoke.mjs http://127.0.0.1:59009 built-new
```

The character and equipment scripts require Vite dev Fiber modules. They verify real scene geometry, original NPC isolation, shoulder/held anchors, appearance parity, fixed-tick walk/action, representative equipment, native seeded-poison death and healer restoration. `failure-` labels actually reject Rowan requests in a fresh context. Keep the approved GLB unchanged.

The built script never imports dev Fiber modules. It records actual bundled script hashes and the approved served GLB hash; exercises desktop/mobile creator controls and persisted appearance, native walk/equip/action, seeded-poison death, healer UI and a separate rejected-GLB fallback context. Built mesh/material internals are **not** introspected. Inspect screenshots before release. Mobile creator content intentionally scrolls; `mobile-creator-navigation.png` and hit-testing prove the final button is reachable.

All contexts use fresh disposable local storage loaded from `public/art/phase1-review-save.json`; no logged-in browser profile is reused. WebSockets and non-GET network requests are denied. GETs are permitted for app assets, fonts and anonymous session discovery. No remote game save/write is performed. The tests pause and seed a bounded local world; they do not certify natural combat acquisition, all animation states, performance, physical phones, or general multiplayer/auth behavior.

## Post-deploy read-only acceptance (parent/operator only)

```bash
ROWAN_ALLOW_REMOTE=1 node scripts/rowan-built-smoke.mjs https://emberhall-vale.vercel.app live-new
```

Run only once the intended deployment is live; compare `results.json` bundle and GLB hashes with candidate evidence. This explicit HTTPS opt-in keeps local default safeguards. The `?qa=1` game debug interface must be present on the deployed build; lack of it is a blocker, not permission to inject substitute application code.

## Harness corrections retained in external evidence

- Read appearance from the player **Person** (`people.find(isPlayer).look`), not runtime `player.look`.
- Do not mistake intentionally blocked external font/session GET errors for app defects. Deny mutations, allow GETs, and preserve console failures from earlier restrictive runs.
- Use the current catalog's `hart`, not historical `deer`, for a durable action target. An unregistered kind renders a fallback but correctly fails save validation; require `saveNow` to succeed with the action fixture still present.
- Keep simulation time monotonic instead of resetting it after hydration, and retain all original failed evidence.

No runtime source, auth configuration, economy/schema policy, renderer kit, or approved asset is changed by these harnesses.
