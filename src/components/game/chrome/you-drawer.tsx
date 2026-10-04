import { X } from "lucide-react";
import { useCallback } from "react";
import { YouDressing } from "@/components/game/paperdoll";
import { usePanelA11y } from "@/components/game/use-panel-a11y";
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
  const ref = usePanelA11y<HTMLDivElement>(close, true);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label="You — pack, paperdoll, skills"
      data-testid="you-drawer"
      className="drawer-in pointer-events-auto absolute top-3 right-0 bottom-[var(--corner-clear)] w-[min(100%-1rem,22rem)] overflow-auto rounded-l-[var(--radius-lg)] border-y border-l border-border bg-bg/92 p-4 outline-none"
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
    </div>
  );
}
