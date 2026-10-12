import { FastForward, Pause, Play } from "lucide-react";
import { useGame } from "@/game/store";
import type { Speed } from "@/game/types";
import { cn } from "@/lib/utils";
import { MapToggle } from "./rail";

/**
 * Time controls + the mini-map toggle as one small glass plate that floats
 * just above the mini-map corner block (or the corner itself when the map is
 * tucked away) — the controls that belong to the corner, without a bar.
 */
export function CornerCluster({ mapOpen, onToggleMap }: { mapOpen: boolean; onToggleMap: () => void }) {
  const speed = useGame((s) => s.speed);
  const cur = useGame((s) => s.snap.speed);
  return (
    <div
      data-testid="corner-cluster"
      className="hud-glass pointer-events-auto absolute right-2 bottom-[var(--corner-clear)] flex items-center gap-0.5 rounded-[var(--radius-md)] p-1"
    >
      <button
        type="button"
        onClick={() => speed((cur === 0 ? 1 : 0) as Speed)}
        className="grid size-9 place-items-center rounded-[var(--radius-xs)] text-muted hover:text-fg"
        aria-label={cur === 0 ? "Resume time" : "Pause time"}
      >
        {cur === 0 ? <Play className="size-4" /> : <Pause className="size-4" />}
      </button>
      <button
        type="button"
        onClick={() => speed(cur === 3 ? 1 : 3)}
        className={cn("grid size-9 place-items-center rounded-[var(--radius-xs)] hover:text-fg", cur === 3 ? "text-accent" : "text-muted")}
        aria-label={cur === 3 ? "Normal time" : "Faster time"}
      >
        <FastForward className="size-4" />
      </button>
      <MapToggle collapsed={!mapOpen} onToggle={onToggleMap} />
    </div>
  );
}
