import { useEffect, useMemo } from "react";
import { useGame } from "@/game/store";
import { createTouchHold, type TouchContact, type TouchTile } from "@/game/touch-hold";
import { hitAt, leftAt } from "@/game/world-pointer";

function eligible(_tile: TouchTile) {
  const state = useGame.getState();
  return state.phase === "playing" && !state.buildKind && !state.tillArmed;
}

/**
 * The general touch path to secondary verbs: a short tap keeps the primary
 * action (walk/chop/hunt/talk), a touch-and-hold opens the same context menu
 * a right-click would. Houses and ghostwood keep their specialized hooks —
 * this only covers the targets they decline. The shared hold contract keeps
 * movement tolerance, second-finger and lifecycle cancellation, so a harmless
 * hold never begins hunting, casting, planting or walking before a menu pick.
 */
export function useWorldTouch() {
  const hold = useMemo(
    () =>
      createTouchHold({
        schedule: (fn, ms) => window.setTimeout(fn, ms),
        unschedule: (handle) => window.clearTimeout(handle),
        eligible,
        tap: ({ tx, ty }) => leftAt(tx, ty),
        hold: ({ tx, ty }, point) => hitAt(tx, ty, point.clientX, point.clientY),
      }),
    [],
  );
  useEffect(() => {
    const down = (e: PointerEvent) => hold.trackDown(e);
    const move = (e: PointerEvent) => hold.move(e);
    const up = (e: PointerEvent) => hold.end(e);
    const cancel = () => hold.cancel();
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
