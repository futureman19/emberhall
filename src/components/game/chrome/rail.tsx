import { Backpack, Eye, Map as MapIcon, Settings } from "lucide-react";
import { toggleFirstPerson } from "@/game/first-person-view";
import { getGraphicsSettings, updateGraphicsSettings, useGraphicsSettings } from "@/game/graphics-settings";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";
import { MusicToggle, SfxToggle } from "./sound-toggles";

export function YouButton() {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  return (
    <button
      type="button"
      onClick={() => setPanel("you")}
      className={cn(
        "hud-glass pointer-events-auto relative grid size-11 place-items-center rounded-[var(--radius-md)] text-muted",
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
        "hud-glass pointer-events-auto relative grid size-11 place-items-center rounded-[var(--radius-md)] text-muted",
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
        "hud-glass pointer-events-auto grid size-11 place-items-center rounded-[var(--radius-md)] text-muted",
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
        "hud-glass pointer-events-auto grid size-11 place-items-center rounded-[var(--radius-md)] text-muted",
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

/** The right edge, floating: personal toggles in a frameless glass column. */
export function Rail() {
  return (
    <div
      data-testid="right-rail"
      className="pointer-events-none absolute top-2 right-1.5 bottom-[var(--corner-clear)] hidden flex-col items-center gap-1.5 md:flex"
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
