import { getWorld } from "./live.ts";
import { useGame } from "./store.ts";
import { castNow, commandCast } from "./magery.ts";
import { spellEffects, visitSpellStatuses } from "./spell-effects.ts";
const spells = { castNow, commandCast, spellEffects, visitSpellStatuses };

/** Floors lighting at half-day so dev stays visible — the sun still rides the real clock, and clock, wolves and HUD keep the hour. Flip false for true night. */
export const DEV_DAYLIGHT = true;

declare global {
  interface Window {
    __ember: {
      getWorld: typeof getWorld;
      useGame: typeof useGame;
      spells: typeof spells;
    };
  }
}

if (typeof window !== "undefined") {
  window.__ember = { getWorld, useGame, spells };
}