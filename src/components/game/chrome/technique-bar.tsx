import { useEffect, useState } from "react";
import { useGame } from "@/game/store";
import { getWorld } from "@/game/live";
import { SECONDS_PER_HOUR, SKILL_META } from "@/game/catalog";
import { TECHNIQUES, techniqueCooldownLeft, techniqueUnlocked, techniqueWeaponOf } from "@/game/techniques";
import { TechniqueIcon } from "@/components/game/item-icon";
import { cn } from "@/lib/utils";

/**
 * The chips row — spells for warriors. A sword or bow in hand brings its
 * three moves above the quick bar: locked chips show the skill tier they ask
 * for, ready chips tap to arm (gold), cooling chips count down the seconds.
 * Bare hands, tools and staffs keep the row out of sight entirely.
 */
export function TechniqueBar() {
  const phase = useGame((s) => s.phase);
  const armTechnique = useGame((s) => s.armTechnique);
  // Cooldown numbers tick with the world's hour, not with React state —
  // nudge a repaint twice a second while the row is up.
  const [, beat] = useState(0);
  useEffect(() => {
    const t = setInterval(() => beat((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);
  if (phase !== "playing") return null;
  const w = getWorld();
  const weapon = techniqueWeaponOf(w);
  if (!weapon) return null;
  const kit = Object.values(TECHNIQUES).filter((t) => t.weapon === weapon);
  return (
    <div
      data-testid="technique-bar"
      className="hud-glass pointer-events-auto flex gap-1.5 rounded-[var(--radius-sm)] p-1"
    >
      {kit.map((t) => {
        const unlocked = techniqueUnlocked(w, t.id);
        const secs = Math.ceil(techniqueCooldownLeft(w, t.id) * SECONDS_PER_HOUR);
        const armed = w.player.armedTechnique === t.id;
        const usable = unlocked && (secs <= 0 || armed);
        return (
          <button
            key={t.id}
            type="button"
            aria-label={`${t.label} (technique)`}
            aria-disabled={!usable}
            title={
              unlocked
                ? `${t.label} — ${t.blurb}`
                : `${t.label} asks for ${t.minSkill} ${SKILL_META[t.skill].label.toLowerCase()}`
            }
            onClick={() => {
              if (unlocked) armTechnique(t.id);
            }}
            className={cn(
              "relative grid size-12 place-items-center rounded-[var(--radius-xs)] border bg-surface-2",
              armed ? "border-gold text-gold" : usable ? "border-accent/60 text-fg" : "border-border text-muted",
              !usable && "opacity-50",
            )}
          >
            <TechniqueIcon id={t.id} className="size-7" />
            {!unlocked ? (
              <span className="absolute right-0.5 bottom-0 text-[10px] text-muted tabular-nums">{t.minSkill}</span>
            ) : secs > 0 ? (
              <span className="absolute right-0.5 bottom-0 text-[10px] text-accent tabular-nums">{secs}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
