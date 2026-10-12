import { useGame } from "@/game/store";
import { Hotbar } from "./hotbar";
import { HealthOrb, ManaOrb } from "./orb-vitals";
import { TechniqueBar } from "./technique-bar";

/**
 * The Direland heart of the HUD: move chips over quick slots in a floating
 * stack, vitals globes flanking at the baseline — dark glass on the 3D view,
 * no carved bar. Orbs always show; the stack appears as it's earned (chips
 * need a kit weapon, quick slots need a first pin). The cluster steps aside
 * whenever a panel, gump, card or ghost banner owns the screen.
 */
export function CombatCluster() {
  const busy = useGame(
    (s) =>
      s.phase !== "playing" ||
      s.panel !== "none" ||
      s.selectedId !== null ||
      Boolean(s.openBook || s.openCraft || s.openVault || s.openPets || s.openSettings) ||
      Boolean(s.snap.player?.ghost || s.snap.people.find((p) => p.isPlayer)?.ghost),
  );
  if (busy) return null;
  return (
    <div
      data-testid="combat-cluster"
      className="pointer-events-none absolute bottom-[calc(8px+env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-end gap-2.5"
    >
      <HealthOrb />
      <div className="flex flex-col items-center gap-1.5">
        <TechniqueBar />
        <Hotbar />
      </div>
      <ManaOrb />
    </div>
  );
}
