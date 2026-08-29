import { Button } from "@/components/ui/button";
import { ItemGlyph } from "@/components/game/paperdoll";
import { ITEM_META } from "@/game/catalog";
import { SPELL_CIRCLES, SPELL_META, maxMana } from "@/game/magery";
import { useGame } from "@/game/store";
import type { SpellId } from "@/game/types";
import { cn } from "@/lib/utils";

export function SpellbookGump() {
  const open = useGame((s) => s.openBook);
  const close = useGame((s) => s.closeBook);
  const cast = useGame((s) => s.cast);
  const forget = useGame((s) => s.forgetMark);
  const pack = useGame((s) => s.snap.player?.pack);
  const mana = useGame((s) => s.snap.player?.mana ?? 0);
  const magery = useGame((s) => s.snap.player?.skills.magery ?? 0);
  const marks = useGame((s) => s.snap.player?.marks ?? []);
  const people = useGame((s) => s.snap.people);
  const x = useGame((s) => s.snap.youX);
  const z = useGame((s) => s.snap.youZ);
  const self = people.find((p) => p.isPlayer);
  const max = maxMana(self?.int ?? 8, magery);
  if (!open) return null;
  const book = (pack?.spellbook ?? 0) > 0;

  return (
    <div className="pointer-events-auto absolute top-16 right-3 max-h-[min(70vh,36rem)] w-[min(100%-1.5rem,22rem)] overflow-auto rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4 sm:right-4">
      <p className="font-display text-sm text-fg">Spellbook</p>
      <p className="mt-2 text-pretty text-xs leading-relaxed text-muted">
        Dust from the pack. Mana {Math.floor(mana)}/{max}. The words take or they do not. The moons still hold.
      </p>
      {!book && <p className="mt-3 text-sm text-fg">The book is gone.</p>}
      <div className="mt-3">
        <p className="font-display text-xs tracking-wider text-muted uppercase">Travel</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Mark writes this dirt. Walk away. Tap a mark to Recall. The moons still hold.
        </p>
        <ul className="mt-1 space-y-1">
          <li>
            <SpellRow id="mark" onCast={() => cast("mark")} />
          </li>
          <li>
            <SpellRow id="recall" onCast={() => cast("recall")} />
          </li>
        </ul>
        {marks.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No marks yet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {marks.map((m) => {
              const d = Math.round(Math.hypot(m.tx - x, m.ty - z));
              return (
                <li key={m.id} className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => cast("recall", { kind: "mark", id: m.id })}
                    className="flex min-h-11 min-w-0 flex-1 items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
                  >
                    <span className="truncate text-sm text-fg">{m.name}</span>
                    <span className="shrink-0 font-display text-xs tracking-wider text-accent uppercase">
                      {d < 3 ? "here" : `Recall · ${d}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Forget ${m.name}`}
                    onClick={() => forget(m.id)}
                    className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-xs)] border border-border bg-surface-2 text-muted"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {SPELL_CIRCLES.map((ring) => (
        <div key={ring.circle} className="mt-3">
          <p className="font-display text-xs tracking-wider text-muted uppercase">{ring.label}</p>
          <ul className="mt-1 space-y-1">
            {ring.ids.map((id) => (
              <li key={id}>
                <SpellRow id={id} onCast={() => cast(id)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Button className="mt-3 w-full" variant="secondary" onClick={close}>
        Close
      </Button>
    </div>
  );
}

function SpellRow({ id, onCast }: { id: SpellId; onCast: () => void }) {
  const pack = useGame((s) => s.snap.player?.pack);
  const mana = useGame((s) => s.snap.player?.mana ?? 0);
  const marks = useGame((s) => s.snap.player?.marks ?? []);
  const meta = SPELL_META[id];
  const haveDust = meta.reagents.every((r) => (pack?.[r] ?? 0) > 0);
  const haveMana = mana >= meta.mana;
  const extra = id === "mark" ? (pack?.rune ?? 0) > 0 : id === "recall" ? marks.length > 0 : true;
  const ready = haveDust && haveMana && extra;
  return (
    <button
      type="button"
      onClick={onCast}
      className={cn(
        "flex min-h-11 w-full flex-col items-stretch rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 py-2 text-left",
        !ready && "opacity-60",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm text-fg">{meta.label}</span>
        <span className="font-display text-xs tracking-wider text-muted uppercase">{meta.mana} mana</span>
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        {meta.reagents.map((r) => (
          <span key={r} className="flex items-center gap-0.5 text-xs text-muted">
            <ItemGlyph id={r} className="size-3.5" />
            {ITEM_META[r].label}
          </span>
        ))}
        {id === "mark" && (
          <span className="flex items-center gap-0.5 text-xs text-muted">
            <ItemGlyph id="rune" className="size-3.5" />
            Blank rune
          </span>
        )}
      </span>
      <span className="mt-1 text-xs text-muted">
        {meta.words} · {meta.hint}
      </span>
    </button>
  );
}
