import { Cloud, CloudLightning, CloudRain, CloudSun, Sun } from "lucide-react";
import { insideLabel } from "@/components/game/building-meshes";
import { BUILDING_META } from "@/game/catalog";
import { phaseName } from "@/game/gates";
import { useGame } from "@/game/store";

function clockLabel(clock: number, day: number) {
  const h = Math.floor(clock) % 24;
  const m = Math.floor((clock % 1) * 60);
  return `Day ${day}  ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const WEATHER_ICON = { clear: Sun, fair: CloudSun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning } as const;

/**
 * Where-you-are chip: region, clock, phase, weather and status effects in one
 * small glass plate floating top-left. Vitals numbers live on the globes in
 * the combat cluster — this chip is pure context. Phones get the weather as
 * an icon and a tighter measure so it never meets the utility plate.
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
  const WeatherIcon = WEATHER_ICON[snap.weather.kind as keyof typeof WEATHER_ICON] ?? Cloud;
  return (
    <div data-testid="vitals-chip" className="hud-glass pointer-events-auto fixed top-3 left-3 max-w-32 min-w-0 rounded-[var(--radius-md)] px-2.5 py-1.5 md:max-w-none md:px-3 md:py-2">
      <button
        type="button"
        onClick={() => setPanel("vale")}
        className="block max-w-full truncate text-left font-display text-xs tracking-wider text-gold uppercase hover:text-fg md:max-w-48"
        aria-label="Open the vale map"
        title="The chart of the vale"
      >
        {inside ? BUILDING_META[inside].label : snap.region}
      </button>
      <p className="flex items-center gap-1 text-[10px] text-muted tabular-nums md:text-xs">
        {ghost ? "Ghost" : <span className="truncate">{clockLabel(snap.clock, snap.day)} · {phaseName(snap.hour)}</span>}
        <WeatherIcon className="size-3.5 shrink-0 md:hidden" aria-label={snap.weather.label} />
        <span className="hidden md:inline">· {snap.weather.label}</span>
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
