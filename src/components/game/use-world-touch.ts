import { useEffect, useMemo, useRef } from "react";
import { useGame } from "@/game/store";
import { createTouchHold, type TouchContact, type TouchTile } from "@/game/touch-hold";
import { hitAt, leftAt } from "@/game/world-pointer";

type WorldTouchTile = TouchTile & { tap?: () => void; secondary?: (point: TouchContact) => void };
let dispatchTouch: ((point: TouchContact, tile: WorldTouchTile) => boolean) | null = null;

/** Intercepting meshes share Terrain's single gesture owner. */
export function beginWorldTouch(point: TouchContact, tile: WorldTouchTile) {
  return dispatchTouch?.(point, tile) ?? false;
}

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
  // The finger that releases a hold fires one compatibility click at the hold
  // point — right where the menu just opened. It must not activate or dismiss
  // anything. Every genuine later click is preceded by its own pointerdown,
  // which disarms the swallow; the release's compat click is the only click
  // that arrives without one.
  const swallowReleaseClick = useRef(false);
  const hold = useMemo(
    () =>
      createTouchHold({
        schedule: (fn, ms) => window.setTimeout(fn, ms),
        unschedule: (handle) => window.clearTimeout(handle),
        eligible,
        tap: (tile: WorldTouchTile) => tile.tap ? tile.tap() : leftAt(tile.tx, tile.ty),
        hold: (tile: WorldTouchTile, point) => {
                  swallowReleaseClick.current = true;
                  if (tile.secondary) tile.secondary(point);
                  else hitAt(tile.tx, tile.ty, point.clientX, point.clientY);
        },
      }),
    [],
  );
  useEffect(() => {
    const click = (e: Event) => {
      if (!swallowReleaseClick.current) return;
      swallowReleaseClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const disarm = () => {
      swallowReleaseClick.current = false;
    };
    window.addEventListener("click", click, true);
    window.addEventListener("pointerdown", disarm, true);
    return () => {
      window.removeEventListener("click", click, true);
      window.removeEventListener("pointerdown", disarm, true);
    };
  }, []);
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
  useEffect(() => {
    dispatchTouch = (point, tile) => {
      if (point.pointerType !== "touch" || !eligible(tile)) return false;
      hold.begin(point, tile);
      return true;
    };
    return () => { dispatchTouch = null; };
  }, [hold]);
  return (point: TouchContact, tile: TouchTile) => {
    if (point.pointerType !== "touch" || !eligible(tile)) return false;
    hold.begin({ pointerId: point.pointerId, pointerType: point.pointerType, clientX: point.clientX, clientY: point.clientY }, tile);
    return true;
  };
}
