import { insideLabel } from "@/components/game/building-meshes";
import { BUILDING_META } from "@/game/catalog";
import { phaseName } from "@/game/gates";
import { useGame } from "@/game/store";

function clockLabel(clock: number, day: number) {
  const h = Math.floor(clock) % 24;
  const m = Math.floor((clock % 1) * 60);
  return `Day ${day}  ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Where-you-are chip: region, clock, phase, weather and status effects in one
 * small glass plate floating top-left. Vitals numbers live on the globes in
 * the combat cluster — this chip is pure context.
 */
export function VitalsChip() {
  const snap = useGame((s) => s.snap);
  const setPanel = useGame((s) => s.setPanel);
  const self = snap.people.find((p) => p.isPlayer);
  const ghost = Boolean(self?.ghost || snap.player?.ghost);
  const inside = insideLabel(snap.buildings, snap.youX, snap.youZ);
  const poisoned = snap.hour < (snap.player?.poisonUntil ?? 0);
  const blessed = snap.hour < (snap.player?.blessUntil ?? 0);
  const unseen = snap.hour < (snap.player?.invisUntil ?? 0);
  return (
    <div data-testid="vitals-chip" className="hud-glass pointer-events-auto fixed top-3 left-3 min-w-0 rounded-[var(--radius-md)] px-3 py-2">
      <button
        type="button"
        onClick={() => setPanel("vale")}
        className="block max-w-48 truncate text-left font-display text-xs tracking-wider text-gold uppercase hover:text-fg"
        aria-label="Open the vale map"
        title="The chart of the vale"
      >
        {inside ? BUILDING_META[inside].label : snap.region}
      </button>
      <p className="text-xs text-muted tabular-nums">
        {ghost ? "Ghost" : clockLabel(snap.clock, snap.day)} · {phaseName(snap.hour)} · {snap.weather.label}
      </p>
      {(poisoned || blessed || unseen) && (
        <p className="mt-1 text-[10px] tracking-wider uppercase">
          {poisoned && <span className="text-gold">Poisoned</span>}
          {poisoned && (blessed || unseen) && <span className="text-muted"> · </span>}
          {blessed && <span className="text-gold">Blessed</span>}
          {blessed && unseen && <span className="text-muted"> · </span>}
          {unseen && <span className="text-fg">Unseen</span>}
        </p>
      )}
    </div>
  );
}
