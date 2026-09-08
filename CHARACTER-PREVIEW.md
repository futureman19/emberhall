# Authored player character preview

Preview: https://emberhall-vale-rccgjnbug-andrews-projects-ffe8a9fd.vercel.app
Deployment: dpl_GwKD96cAsE8bRi114oeHiSqfuhUN, independently inspected as Preview / Ready. Production untouched; no merge/commit made. Branch feature/emberhall-authored-character.

## Scope
Player-only custom Blender geometry and the same geometry in the Looking Glass. Rounded head/jaw, fitted hair crown with fringe, tailored tunic with shoulder connections, softer sleeves/hands/boots, draped cape and rounded headgear. Original look colors, five hairstyle choices, equipment materials, original animation refs/anchors, held tools, ghost materials, user-authored voxel attachments and NPC meshes remain. Face and collar details are runtime procedural geometry, not in the Blender source. No simulation/schema/collision/camera source changes.

The mirror camera now starts on the face side and has brighter fill. Mirror viewport is bounded to 320px desktop / 192px mobile. Ordinary in-game camera is unchanged. This is an art pass, not a new skeleton or full animation redesign.

## Sources
- art/blender/character.blend: assembled editable source; optional hair/headgear hidden in viewport.
- art/blender/build_character.py: repeatable script-authored modeling and export. Rebuilding overwrites .blend and GLB, so save manual edits separately.
- public/art/lanternwood/character.glb: 15 named centered modular geometries, 231732 bytes.
- public/art/lanternwood/character-manifest.json: actual per-part geometry counts and bounds.
- src/components/game/authored-character-data.ts: async cache, node-transform baking, original box fallback.
- src/components/game/authored-character.tsx: shared geometry, face and tunic-detail rendering.

Rebuild from repository root using the installed Blender, never system Python:
`"C:/Users/futur/AppData/Local/Programs/Blender-5.2.1/blender.exe" --background --factory-startup --python-exit-code 1 --python C:/Users/futur/Desktop/emberhall-lanternwood-preview/art/blender/build_character.py`

## Verification
- Blender export succeeded, actual GLB parsed by GLTFLoader; named centered geometry and axes/bounds/finite data tested.
- 509 game tests passed; lint/typecheck/build/auth invariant passed.
- Baseline full npm test still has 12 previously verified unrelated script failures; full release gate not claimed green.
- Local and deployed Playwright exercised all five hairstyle buttons; selected skin and garb survived Step into the vale into actual world data. The mirror was entered from a disposable loaded-save fixture, not a fresh full intro journey.
- Deployed character.glb returned HTTP 200; no captured page/shader errors.
- Actual deployed mouse click walked to target; simulation command entry/exit reached hall-center/outside destinations.
- Actual local tilling, sowing, harvesting and forestry smoke completed, with no console/page errors. Tilling body/tool screenshot inspected. Other combat/spell/equipment/ghost permutations are source/test preserved but not exhaustively runtime-smoked.
- Final deployed crop-hair mirror and mobile screen visually inspected; shoulder gap found in first version was corrected. All hair style screenshots collected, not all individually visually reviewed.

Evidence in profile lanternwood-review: character-live-*, character-actions/*, character-live-walk-probe.json. Capture tools: emberhall-character-capture.mjs, character-gather-smoke.mjs. Browser screenshot waits were unusually slow; CDP captures plus a generous bounded whole-journey timeout completed. This is not a frame-rate benchmark. Existing mobile in-game minimap overlap remains.
