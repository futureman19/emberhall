# Emberhall

A browser game: Ultima Online rules in a Guild Maker–looking vale.

You are a body, not a guildmaster spreadsheet. Click-to-walk, harvest, hunt, sell, die, wake at the hall. Other people have errands. Night belongs to wolves.

## Spine (do not drift)

- Gameplay: Ultima Online sandbox (avatar, use-based skills, pack, bank chest, karma, corpse, day/night, fauna).
- Look: Guild Maker — warm timber, red cloth, gold type, faceted trees, chunky hall, cozy courtyard opening onto woods.
- Not in scope: Fibonacci / Pisano / 60-clock / Metatron / chirality physics. That experiment is closed unless the user explicitly reopens it.

## Current deliverable

- `emberhall.html` — single-file playable game. Open locally. **New hall** starts a life. **Continue** loads `localStorage` key `emberhall.uo.v1`.

## How it plays

- Click ground to walk. Camera follows.
- Click tree / ore / animal / person / chest when adjacent.
- Wield hatchet, pick, or blade from the pack list.
- Skills rise by use: lumberjacking, mining, swordsmanship, animal lore, tactics, stealing.
- Bank chest at the hall (tile 16,22). Goods in, tools out.
- Hunger. Eat bread or meat.
- Death drops the pack as a corpse. Wake on hall cobbles in a robe.
- Shift-click a person to attack. Cap. Wren hunts criminals.
- NPCs: Ione Hale (woods), Brann (buys logs/ore/hides), Cap. Wren (guard), Old Pell (well).

## What to build next (priority)

1. Painted isometric sprites that still read as Guild Maker low-poly, not UO classic.
2. A hall that does something while you are away (sleep, visitors, Wren’s circuit).
3. One other agent who can take your wood.
4. Death/exile that costs a real day.
5. Then more map: named landmarks, bank as the only safe tile, a forest that refills and one that does not.

## Voice

Honest. No glazing. If a verb is busywork, say so. Prefer cutting systems over stacking cosmology. One-sentence fantasy on the title screen: you are a body in a vale that does not wait.

## Files to keep in this project

- emberhall.html — playable build
- EMBERHALL_PROJECT.md — this brief
- Recreating Ultima Online- A Deep Dive.pdf — mechanics reference only
- Do not treat the Fibonacci PDFs as engine design unless asked
