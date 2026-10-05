import { Anvil, CircleHelp, FastForward, Hammer, Hand, Pause, Play, ScrollText } from "lucide-react";
import { insideLabel } from "@/components/game/building-meshes";
import { BUILDING_META } from "@/game/catalog";
import { phaseName } from "@/game/gates";
import { maxMana } from "@/game/magery";
import { useGame } from "@/game/store";
import type { PanelId, Speed } from "@/game/types";
import { cn } from "@/lib/utils";
import { BAND_HEIGHT, MINIMAP_CORNER } from "./frame";
import { FirstPersonChip, MapToggle, SettingsButton, YouButton } from "./rail";
import { MusicToggle, SfxToggle } from "./sound-toggles";

function clockLabel(clock: number, day: number) {
  const h = Math.floor(clock) % 24;
  const m = Math.floor((clock % 1) * 60);
  return `Day ${day}  ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Stacked vitals card: floats top-left on small screens so the band stays one row. */
function VitalsBox() {
  const snap = useGame((s) => s.snap);
  const setPanel = useGame((s) => s.setPanel);
  const self = snap.people.find((p) => p.isPlayer);
  const max = maxMana(self?.int ?? 8, snap.player?.skills.magery ?? 0);
  const ghost = Boolean(self?.ghost || snap.player?.ghost);
  const hp = ghost ? 0 : self ? self.hp / self.maxHp : 0;
  const mana = (snap.player?.mana ?? 0) / max;
  const inside = insideLabel(snap.buildings, snap.youX, snap.youZ);
  return (
    <div className="fixed top-3 left-3 min-w-0 md:hidden">
      <div className="min-w-0 rounded-[var(--radius-md)] border border-border bg-bg/80 px-3 py-2">
        <button
          type="button"
          onClick={() => setPanel("vale")}
          className="pointer-events-auto block max-w-48 truncate text-left font-display text-xs tracking-wider text-gold uppercase hover:text-fg"
          aria-label="Open the vale map"
          title="The chart of the vale"
        >
          {inside ? BUILDING_META[inside].label : snap.region}
        </button>
        <p className="text-xs text-muted tabular-nums">
          {ghost ? "Ghost" : clockLabel(snap.clock, snap.day)} · {phaseName(snap.hour)} · {snap.weather.label}
        </p>
        <div
          className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-surface-2"
          role="meter"
          aria-label="Health"
          aria-valuemin={0}
          aria-valuemax={self?.maxHp ?? 1}
          aria-valuenow={ghost ? 0 : (self?.hp ?? 0)}
        >
          <div className="h-full bg-health" style={{ width: `${Math.max(0, Math.min(1, hp)) * 100}%` }} />
        </div>
        <div
          className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-surface-2"
          role="meter"
          aria-label="Mana"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={snap.player?.mana ?? 0}
        >
          <div className="h-full bg-mana" style={{ width: `${Math.max(0, Math.min(1, mana)) * 100}%` }} />
        </div>
        {(snap.hour < (snap.player?.poisonUntil ?? 0) || snap.hour < (snap.player?.blessUntil ?? 0) || snap.hour < (snap.player?.invisUntil ?? 0)) && (
          <p className="mt-1 text-[10px] tracking-wider uppercase">
            {snap.hour < (snap.player?.poisonUntil ?? 0) && <span className="text-gold">Poisoned</span>}
            {snap.hour < (snap.player?.poisonUntil ?? 0) && (snap.hour < (snap.player?.blessUntil ?? 0) || snap.hour < (snap.player?.invisUntil ?? 0)) && <span className="text-muted"> · </span>}
            {snap.hour < (snap.player?.blessUntil ?? 0) && <span className="text-gold">Blessed</span>}
            {snap.hour < (snap.player?.blessUntil ?? 0) && snap.hour < (snap.player?.invisUntil ?? 0) && <span className="text-muted"> · </span>}
            {snap.hour < (snap.player?.invisUntil ?? 0) && <span className="text-fg">Unseen</span>}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Vitals as a single horizontal strip docked in the band's left end — region
 * and clock in one column, the two meters beside them. Stays inside the
 * band's fixed height so the rail joint holds.
 */
function VitalsStrip() {
  const snap = useGame((s) => s.snap);
  const setPanel = useGame((s) => s.setPanel);
  const self = snap.people.find((p) => p.isPlayer);
  const max = maxMana(self?.int ?? 8, snap.player?.skills.magery ?? 0);
  const ghost = Boolean(self?.ghost || snap.player?.ghost);
  const hp = ghost ? 0 : self ? self.hp / self.maxHp : 0;
  const mana = (snap.player?.mana ?? 0) / max;
  const inside = insideLabel(snap.buildings, snap.youX, snap.youZ);
  return (
    <div className="mr-1 hidden min-w-0 shrink-0 items-center gap-3 md:flex">
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => setPanel("vale")}
          className="pointer-events-auto block max-w-36 truncate text-left font-display text-xs tracking-wider text-gold uppercase hover:text-fg"
          aria-label="Open the vale map"
          title="The chart of the vale"
        >
          {inside ? BUILDING_META[inside].label : snap.region}
        </button>
        <p className="text-[11px] leading-tight text-muted tabular-nums">
          {ghost ? "Ghost" : clockLabel(snap.clock, snap.day)} · {phaseName(snap.hour)}
        </p>
      </div>
      <div className="w-32 shrink-0">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="meter"
          aria-label="Health"
          aria-valuemin={0}
          aria-valuemax={self?.maxHp ?? 1}
          aria-valuenow={ghost ? 0 : (self?.hp ?? 0)}
        >
          <div className="h-full bg-health" style={{ width: `${Math.max(0, Math.min(1, hp)) * 100}%` }} />
        </div>
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="meter"
          aria-label="Mana"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={snap.player?.mana ?? 0}
        >
          <div className="h-full bg-mana" style={{ width: `${Math.max(0, Math.min(1, mana)) * 100}%` }} />
        </div>
      </div>
      {(snap.hour < (snap.player?.poisonUntil ?? 0) || snap.hour < (snap.player?.blessUntil ?? 0) || snap.hour < (snap.player?.invisUntil ?? 0)) && (
        <p className="shrink-0 text-[10px] tracking-wider whitespace-nowrap uppercase">
          {snap.hour < (snap.player?.poisonUntil ?? 0) && <span className="text-gold">Poisoned</span>}
          {snap.hour < (snap.player?.poisonUntil ?? 0) && (snap.hour < (snap.player?.blessUntil ?? 0) || snap.hour < (snap.player?.invisUntil ?? 0)) && <span className="text-muted"> · </span>}
          {snap.hour < (snap.player?.blessUntil ?? 0) && <span className="text-gold">Blessed</span>}
          {snap.hour < (snap.player?.blessUntil ?? 0) && snap.hour < (snap.player?.invisUntil ?? 0) && <span className="text-muted"> · </span>}
          {snap.hour < (snap.player?.invisUntil ?? 0) && <span className="text-fg">Unseen</span>}
        </p>
      )}
    </div>
  );
}

function ActionCluster({ actionsOpen, onToggleActions }: { actionsOpen: boolean; onToggleActions: () => void }) {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const openBook = useGame((s) => s.openBookGump);
  const openCraft = useGame((s) => s.openCraftGump);
  const items: { id: PanelId; icon: typeof CircleHelp; label: string }[] = [
    { id: "help", icon: CircleHelp, label: "Guide" },
    { id: "build", icon: Hammer, label: "Hold" },
  ];
  return (
    <div data-testid="bottom-dock" className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onToggleActions}
        className={cn(
          "grid size-11 place-items-center rounded-[var(--radius-md)] text-muted",
          actionsOpen && "bg-surface-2 text-fg",
        )}
        aria-label="Nearby actions — keyboard: period"
        aria-expanded={actionsOpen}
        title="Nearby actions (.)"
      >
        <Hand className="size-4" />
      </button>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => setPanel(it.id)}
            className={cn(
              "grid size-11 place-items-center rounded-[var(--radius-md)] text-muted",
              panel === it.id && "bg-surface-2 text-fg",
            )}
            aria-label={it.label}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
      <button type="button" onClick={openBook} className="grid size-11 place-items-center rounded-[var(--radius-md)] text-accent" aria-label="Spellbook">
        <ScrollText className="size-4" />
      </button>
      <button type="button" onClick={openCraft} className="grid size-11 place-items-center rounded-[var(--radius-md)] text-gold" aria-label="Work">
        <Anvil className="size-4" />
      </button>
    </div>
  );
}

function TimeCluster() {
  const speed = useGame((s) => s.speed);
  const cur = useGame((s) => s.snap.speed);
  return (
    <div className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-bg/80 p-1">
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
    </div>
  );
}

/** The bottom edge of the L: vitals left, actions center, time + map at the corner. */
export function Band({
  actionsOpen,
  onToggleActions,
  mapOpen,
  onToggleMap,
}: {
  actionsOpen: boolean;
  onToggleActions: () => void;
  mapOpen: boolean;
  onToggleMap: () => void;
}) {
  return (
    <div
      data-testid="bottom-band"
      className="classic-frame pointer-events-auto absolute bottom-0 left-0 flex items-center gap-1 border-t border-border bg-bg/90 px-2 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom))]"
      style={{
        height: `calc(${BAND_HEIGHT}px + env(safe-area-inset-bottom))`,
        right: mapOpen ? MINIMAP_CORNER : 0,
      }}
    >
      <VitalsBox />
      <VitalsStrip />
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <ActionCluster actionsOpen={actionsOpen} onToggleActions={onToggleActions} />
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <YouButton />
          <SettingsButton />
          <FirstPersonChip />
          <MusicToggle />
          <SfxToggle />
        </div>
        <div className="flex-1" aria-hidden />
      </div>
      <TimeCluster />
      <MapToggle collapsed={!mapOpen} onToggle={onToggleMap} />
    </div>
  );
}
