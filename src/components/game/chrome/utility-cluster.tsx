import { Anvil, CircleHelp, Hammer, Hand, ScrollText } from "lucide-react";
import { useGame } from "@/game/store";
import type { PanelId } from "@/game/types";
import { cn } from "@/lib/utils";
import { FirstPersonChip, SettingsButton, YouButton } from "./rail";
import { MusicToggle, SfxToggle } from "./sound-toggles";

/**
 * Utility buttons as a free-floating glass plate: nearby actions, guide,
 * hold, spellbook and work for everyone; the personal toggles (you, settings,
 * eyes, sound) join on small screens where the right-edge rail is hidden.
 * Phones pin it top-right in two tidy right-aligned rows beside the vitals
 * chip (the combat cluster owns the bottom edge); desktops float it
 * bottom-left in a single row.
 */
export function UtilityCluster({
  actionsOpen,
  onToggleActions,
}: {
  actionsOpen: boolean;
  onToggleActions: () => void;
}) {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const openBook = useGame((s) => s.openBookGump);
  const openCraft = useGame((s) => s.openCraftGump);
  const items: { id: PanelId; icon: typeof CircleHelp; label: string }[] = [
    { id: "help", icon: CircleHelp, label: "Guide" },
    { id: "build", icon: Hammer, label: "Hold" },
  ];
  return (
    <div
      data-testid="bottom-dock"
      className="hud-glass pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-0.5 rounded-[var(--radius-md)] p-1 md:top-auto md:right-auto md:bottom-[calc(8px+env(safe-area-inset-bottom))] md:left-2 md:flex-row md:items-center md:gap-1"
    >
      <div className="flex items-center gap-0.5 md:gap-1">
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
      <div className="flex items-center gap-0.5 md:hidden">
        <YouButton />
        <SettingsButton />
        <FirstPersonChip />
        <MusicToggle />
        <SfxToggle />
      </div>
    </div>
  );
}
