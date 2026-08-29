# Emberhall

A browser game: Ultima Online rules in a Guild Maker vale.

You are a body, not a guildmaster spreadsheet. Click the dirt and walk. Chop, hunt, tame, bank, die, wake at the hall. Night belongs to wolves. The vale is a country — Ridgewatch to Brinegate — not a yard.

## Play

```
npm install
npm run dev
```

**New hall** starts a life. **Continue** loads the last one from the browser.

Click the ground to walk. Right-click for verbs. Open **You** for the paperdoll and pack. The book in the pack is magery: Mark writes this dirt on a rune. Walk off. Tap the mark — Recall folds you back. Public moongates still hold.

Die and you walk pale. Chop, hunt, and the book are closed until a healer returns you. Ione stands at the hall. Your corpse keeps a third of your gold and half the stacks — a body on the dirt, a ring on the vale. Vault stays. Walk back living and take it.

## Spine

- Gameplay: UO sandbox — avatar, use-based skills, pack, bank, karma, corpse, day/night, fauna, magery.
- Look: warm timber, red cloth, gold type, faceted trees, chunky hall.
- Not in scope: Fibonacci / Pisano / 60-clock physics.

## Stack

TanStack Start, React 19, Three.js / R3F, Zustand. Auth and a shared database are off; a hall lives in `localStorage`.
