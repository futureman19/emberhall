import { Minimize2 } from "lucide-react";
import { MiniVale } from "@/components/game/vale-map";
import { MINIMAP_CORNER } from "./frame";

/**
 * The mini-map IS the corner of the L: docked at bottom-right, the band ends
 * at its left edge and the rail ends at its top — one connected frame. When
 * collapsed the band's map toggle brings it back. `open` is computed by the
 * overlay root so the band, rail and panel offsets all agree.
 */
export function DockedMinimap({ open, onHide }: { open: boolean; onHide: () => void }) {
  if (!open) return null;
  return (
    <section
      aria-label="Mini-map"
      data-testid="docked-minimap"
      className="pointer-events-auto absolute right-0 bottom-0 border-t border-l border-border bg-bg/90"
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
