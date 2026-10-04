import { useEffect, useMemo } from "react";
import { getWorld } from "@/game/live";
import { houseTouchTarget } from "@/game/house-touch";
import { useGame } from "@/game/store";
import { createTouchHold, type TouchContact, type TouchTile } from "@/game/touch-hold";
import { hitAt, leftAt } from "@/game/world-pointer";

function target(tile: TouchTile) {
  const state = useGame.getState();
  return state.phase === "playing" && !state.buildKind && !state.tillArmed
    ? houseTouchTarget(getWorld(), tile) : null;
}

/** A house-only touch menu. Short taps still walk; existing command gates own chest access. */
export function useHouseTouch() {
  const gesture = useMemo(() => {
    let identity: { world: ReturnType<typeof getWorld>; id: string; owner: string | null | undefined } | null = null;
    const hold = createTouchHold({
      schedule: (fn, ms) => window.setTimeout(fn, ms),
      unschedule: handle => window.clearTimeout(handle),
      eligible: tile => {
        const house = target(tile);
        return !!house && identity?.world === getWorld() && house.id === identity.id && house.ownerId === identity.owner;
      },
      tap: ({ tx, ty }) => leftAt(tx, ty),
      hold: ({ tx, ty }, point) => hitAt(tx, ty, point.clientX, point.clientY),
    });
    return {
      hold,
      begin(point: TouchContact, tile: TouchTile) {
        if (point.pointerType !== "touch") return false;
        const house = target(tile);
        if (!house) return false;
        identity = { world: getWorld(), id: house.id, owner: house.ownerId };
        hold.begin({ pointerId: point.pointerId, pointerType: point.pointerType, clientX: point.clientX, clientY: point.clientY }, tile);
        return true;
      },
    };
  }, []);
  useEffect(() => {
    const down = (e: PointerEvent) => gesture.hold.trackDown(e);
    const move = (e: PointerEvent) => gesture.hold.move(e);
    const up = (e: PointerEvent) => gesture.hold.end(e);
    const cancel = () => gesture.hold.cancel();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      cancel();
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, [gesture]);
  return gesture.begin;
}
