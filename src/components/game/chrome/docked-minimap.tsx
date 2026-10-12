import { Minimize2 } from "lucide-react";
import { MiniVale } from "@/components/game/vale-map";
import { MINIMAP_CORNER } from "./frame";

/**
 * The mini-map docks at bottom-right as a free-floating glass block — no
 * carved frame, just the map with a thin edge. `open` is computed by the
 * overlay root so the rail and panel offsets all agree.
 */
export function DockedMinimap({ open, onHide }: { open: boolean; onHide: () => void }) {
  if (!open) return null;
  return (
    <section
      aria-label="Mini-map"
      data-testid="docked-minimap"
      className="hud-glass pointer-events-auto absolute right-0 bottom-0 overflow-hidden rounded-tl-[var(--radius-md)]"
      style={{
        width: MINIMAP_CORNER,
        height: `calc(${MINIMAP_CORNER}px + env(safe-area-inset-bottom))`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="size-full touch-none select-none" title="Tap to walk">
        <MiniVale />
      </div>
      <button
        type="button"
        aria-label="Hide mini-map"
        title="Hide mini-map"
        className="absolute top-0 left-0 z-30 grid size-11 place-items-center text-fg drop-shadow-md"
        onClick={(event) => {
          event.stopPropagation();
          onHide();
        }}
      >
        <Minimize2 className="size-3" aria-hidden />
      </button>
    </section>
  );
}
