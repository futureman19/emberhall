import { getWorld } from "./live";
import { useGame } from "./store";

/** Pin lighting to day so we can see. Clock, wolves, and the HUD still keep the hour. Flip false to restore night. */
export const DEV_DAYLIGHT = true;

declare global {
  interface Window {
    __ember: {
      getWorld: typeof getWorld;
      useGame: typeof useGame;
    };
  }
}

if (typeof window !== "undefined") {
  window.__ember = { getWorld, useGame };
}