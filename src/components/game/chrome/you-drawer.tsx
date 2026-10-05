import { X } from "lucide-react";
import { useCallback } from "react";
import { YouDressing } from "@/components/game/paperdoll";
import { DrawerShell } from "./drawer-shell";
import { useGame } from "@/game/store";

/**
 * The right side popped out: a drawer that slides in from the right edge with
 * the paperdoll, pack and skills. Flush against the edge (it covers the rail
 * while open), bottom clears the band — or the corner block when the map is
 * docked, via the shared `--corner-clear` offset. Same nonmodal behavior as
 * the other panels: focus on open, Escape closes only this layer.
 */
export function YouDrawer() {
  const close = useCallback(() => useGame.getState().setPanel("none"), []);
  return (
    <DrawerShell
      onClose={close}
      role="dialog"
      aria-label="You — pack, paperdoll, skills"
      data-testid="you-drawer"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display text-sm text-fg">You</p>
        <button
          type="button"
          onClick={close}
          aria-label="Put the paperdoll away"
          className="grid size-11 place-items-center text-muted hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>
      <YouDressing />
    </DrawerShell>
  );
}
