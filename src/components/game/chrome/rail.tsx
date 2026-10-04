import { Backpack, Eye, Map as MapIcon, Settings } from "lucide-react";
import { toggleFirstPerson } from "@/game/first-person-view";
import { getGraphicsSettings, updateGraphicsSettings, useGraphicsSettings } from "@/game/graphics-settings";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";
import { BAND_HEIGHT, MINIMAP_CORNER, RAIL_WIDTH } from "./frame";
import { MusicToggle, SfxToggle } from "./sound-toggles";

export function YouButton() {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  return (
    <button
      type="button"
      onClick={() => setPanel("you")}
      className={cn(
        "pointer-events-auto relative z-10 grid size-11 place-items-center rounded-[var(--radius-md)] border border-border bg-bg/80 text-muted",
        panel === "you" && "bg-surface-2 text-fg",
      )}
      aria-label="You — pack, paperdoll, skills"
    >
      <Backpack className="size-4" />
    </button>
  );
}

export function SettingsButton() {
  const open = useGame((s) => s.openSettings);
  const toggleSettings = useGame((s) => s.toggleSettings);
  return (
    <button
      type="button"
      onClick={toggleSettings}
      className={cn(
        "pointer-events-auto relative z-10 grid size-11 place-items-center rounded-[var(--radius-md)] border border-border bg-bg/80 text-muted",
        open && "bg-surface-2 text-fg",
      )}
      aria-label="Settings — sound, graphics and the Vault"
      aria-expanded={open}
    >
      <Settings className="size-4" />
    </button>
  );
}

export function FirstPersonChip() {
  const firstPerson = useGraphicsSettings().firstPerson;
  return (
    <button
      type="button"
      onClick={() => updateGraphicsSettings({ firstPerson: toggleFirstPerson(getGraphicsSettings().firstPerson) })}
      className={cn(
        "pointer-events-auto grid size-11 place-items-center rounded-[var(--radius-md)] border border-border bg-bg/80 text-muted",
        firstPerson && "bg-surface-2 text-fg",
      )}
      aria-pressed={firstPerson}
      aria-label={firstPerson ? "First-person: on" : "First-person: off"}
      title="Eyes (V)"
    >
      <Eye className="size-4" />
    </button>
  );
}

export function MapToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "pointer-events-auto grid size-11 place-items-center rounded-[var(--radius-md)] border border-border bg-bg/80 text-muted",
        !collapsed && "bg-surface-2 text-fg",
      )}
      aria-label={collapsed ? "Show mini-map" : "Hide mini-map"}
      aria-expanded={!collapsed}
      title="Mini-map"
    >
      <MapIcon className="size-4" />
    </button>
  );
}

/** The right edge of the L: panel toggles above, sound at the foot. Desktop only. */
export function Rail({ mapCollapsed }: { mapCollapsed: boolean }) {
  return (
    <div
      data-testid="right-rail"
      className="pointer-events-auto absolute top-0 right-0 hidden flex-col items-center gap-1 border-l border-border bg-bg/90 p-2 md:flex"
      style={{
        width: RAIL_WIDTH,
        bottom: `calc(${mapCollapsed ? BAND_HEIGHT : MINIMAP_CORNER}px + env(safe-area-inset-bottom))`,
      }}
    >
      <YouButton />
      <SettingsButton />
      <FirstPersonChip />
      <div className="flex-1" aria-hidden />
      <MusicToggle />
      <SfxToggle />
    </div>
  );
}
