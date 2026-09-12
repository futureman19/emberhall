import { useEffect, useMemo } from "react";
import { isGhostwoodTree } from "@/game/forestry";
import { getWorld } from "@/game/live";
import { effSkill } from "@/game/player";
import { GHOSTWOOD_LUMBERJACK } from "@/game/resources/catalog";
import { useGame } from "@/game/store";
import { createTouchHold, type TouchContact, type TouchTile } from "@/game/touch-hold";
import { hitAt, leftAt } from "@/game/world-pointer";

function eligible(tile: TouchTile) {
  const state = useGame.getState();
  const world = getWorld();
  return state.phase === "playing" && !state.buildKind && !state.tillArmed
    && world.player.ghost && effSkill(world, "lumberjack") >= GHOSTWOOD_LUMBERJACK
    && isGhostwoodTree(world, tile.tx, tile.ty);
}

/** Adds only the missing ghostwood touch context gesture; mouse/other tiles stay unchanged. */
export function useGhostwoodTouch() {
  const hold = useMemo(() => createTouchHold({
    schedule: (fn, ms) => window.setTimeout(fn, ms),
    unschedule: (handle) => window.clearTimeout(handle),
    eligible,
    tap: ({ tx, ty }) => leftAt(tx, ty),
    hold: ({ tx, ty }, point) => hitAt(tx, ty, point.clientX, point.clientY),
  }), []);
  useEffect(() => {
    const down = (e: PointerEvent) => hold.trackDown(e);
    const move = (e: PointerEvent) => hold.move(e);
    const up = (e: PointerEvent) => hold.end(e);
    const cancel = () => hold.cancel();
    // Capture catches second fingers and release/cancel outside the hit mesh.
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      hold.cancel();
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, [hold]);
  return (point: TouchContact, tile: TouchTile) => {
    if (point.pointerType !== "touch" || !eligible(tile)) return false;
    hold.begin({ pointerId: point.pointerId, pointerType: point.pointerType, clientX: point.clientX, clientY: point.clientY }, tile);
    return true;
  };
}
