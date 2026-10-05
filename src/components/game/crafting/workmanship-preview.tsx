import { workmanshipChances } from "@/game/rare";
import type { MaterialGrade } from "@/game/resources/types";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function WorkmanshipPreview({
  skill,
  difficulty,
  primaryGrade,
}: {
  skill: number;
  difficulty: number;
  primaryGrade?: MaterialGrade;
}) {
  const chances = workmanshipChances(skill, difficulty, primaryGrade);
  const mastered = chances.ordinary === 0;
  return (
    <section className="rounded-[var(--radius-sm)] border border-border bg-surface p-2" aria-label="Workmanship odds">
      <p className="font-display text-xs tracking-wide text-muted uppercase">Workmanship</p>
      <div className="mt-1 grid grid-cols-3 gap-1 text-center text-xs">
        <span className="rounded bg-bg px-1 py-2 text-muted">Ordinary {percent(chances.ordinary)}</span>
        <span className="rounded bg-bg px-1 py-2 text-fg">Fine {percent(chances.fine)}</span>
        <span className="rounded bg-bg px-1 py-2 text-gold">Exceptional {percent(chances.exceptional)}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {mastered
          ? "A master's hand on rare stock — no ordinary work."
          : "Rare stock and mastery (80+) together rule out ordinary work."}
      </p>
      <p className="mt-1 text-[11px] text-muted">Workmanship changes physical quality only. Gems provide magic.</p>
    </section>
  );
}
