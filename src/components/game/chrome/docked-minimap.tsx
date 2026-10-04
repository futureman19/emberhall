import { Minimize2 } from "lucide-react";
import { MiniVale } from "@/components/game/vale-map";
import { useGame } from "@/game/store";
import { MapToggle } from "./rail";
import type { useMinimapDock } from "./use-minimap-dock";

/**
 * The mini-map, docked to the frame: top-right against the rail on desktop
 * (`right` = rail width + gap), a smaller square on mobile. Collapses to the
 * rail's map toggle on desktop, a floating button on mobile.
 */
export function DockedMinimap({ dock }: { dock: ReturnType<typeof useMinimapDock> }) {
  const panel = useGame((s) => s.panel);
  const openBook = useGame((s) => s.openBook);
  const openCraft = useGame((s) => s.openCraft);
  if (panel === "vale" || openBook || openCraft) return null;
  if (!dock.ready) return null;
  if (dock.collapsed) {
    // The desktop rail carries the show-map toggle; mobile needs a floater.
    return (
      <div className="fixed top-3 right-3 md:hidden">
        <MapToggle collapsed={dock.collapsed} onToggle={dock.toggle} />
      </div>
    );
  }
  return (
    <section
      aria-label="Mini-map"
      data-testid="docked-minimap"
      className="pointer-events-auto absolute top-3 right-3 size-32 overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-bg/90 shadow-lg md:right-[68px] md:size-44"
    >
      <div className="size-full touch-none select-none" title="Tap to walk">
        <MiniVale />
      </div>
      <button
        type="button"
        aria-label="Hide mini-map"
        title="Hide mini-map"
        className="absolute top-0 right-0 z-30 grid size-11 place-items-center text-fg drop-shadow-md"
        onClick={(event) => {
          event.stopPropagation();
          dock.toggle();
        }}
      >
        <Minimize2 className="size-3" aria-hidden />
      </button>
    </section>
  );
}
