import { Button } from "@/components/ui/button";
import { ItemGlyph } from "@/components/game/paperdoll";
import { ITEM_META } from "@/game/catalog";
import { RECIPES, haveNeed, stationsHere, type Recipe, type Station } from "@/game/craft";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import type { ItemId } from "@/game/types";
import { cn } from "@/lib/utils";

const TITLE: Record<Station, { title: string; blurb: string }> = {
  bench: { title: "The bench", blurb: "Logs to boards. Then torch, club, crate, staff, cap, shield, bow, cuirass." },
  forge: { title: "The fire", blurb: "Ore to ingot. Then ring, knife, tools, gorget, boots, gauntlets, mace, sword, helm, iron shield, greaves, mail." },
};

export function CraftGump() {
  const open = useGame((s) => s.openCraft);
  const close = useGame((s) => s.closeCraft);
  const make = useGame((s) => s.makeRecipe);
  const pack = useGame((s) => s.snap.player?.pack);
  const skills = useGame((s) => s.snap.player?.skills);
  const x = useGame((s) => s.snap.youX);
  const z = useGame((s) => s.snap.youZ);
  if (!open) return null;
  const here = stationsHere(getWorld());
  void x;
  void z;
  const groups: Station[] = ["bench", "forge"];
  return (
    <div className="pointer-events-auto absolute top-16 right-3 max-h-[min(70vh,36rem)] w-[min(100%-1.5rem,22rem)] overflow-auto rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4 sm:right-4">
      <p className="font-display text-sm text-fg">Work</p>
      <p className="mt-2 text-pretty text-xs leading-relaxed text-muted">
        Wood at the yard. Iron at a forge. The work takes, or it splits.
      </p>
      {groups.map((st) => {
        const at = here.includes(st);
        const list = RECIPES.filter((r) => r.station === st);
        return (
          <div key={st} className="mt-4">
            <p className="font-display text-xs tracking-wider text-muted uppercase">{TITLE[st].title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{at ? TITLE[st].blurb : st === "forge" ? "Raise a forge, then stand by the fire." : "Stand in the yard, or the hall."}</p>
            <ul className="mt-2 space-y-1">
              {list.map((r) => (
                <li key={r.id}>
                  <RecipeRow rec={r} at={at} pack={pack} skill={skills?.[r.skill] ?? 0} onMake={() => make(r.id)} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <Button className="mt-3 w-full" variant="secondary" onClick={close}>
        Close
      </Button>
    </div>
  );
}

function RecipeRow({
  rec,
  at,
  pack,
  skill,
  onMake,
}: {
  rec: Recipe;
  at: boolean;
  pack?: Record<string, number>;
  skill: number;
  onMake: () => void;
}) {
  const ready = at && haveNeed(pack, rec);
  return (
    <button
      type="button"
      onClick={onMake}
      className={cn(
        "flex min-h-11 w-full flex-col items-stretch rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 py-2 text-left",
        !ready && "opacity-60",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm text-fg">{rec.label}</span>
        <span className="font-display text-xs tracking-wider text-muted uppercase">{Math.round(skill)}</span>
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        {Object.entries(rec.need).map(([k, n]) => (
          <span key={k} className="flex items-center gap-0.5 text-xs text-muted">
            <ItemGlyph id={k as ItemId} className="size-3.5" />
            {n} {ITEM_META[k as ItemId].label}
            <span className="text-muted">({pack?.[k] ?? 0})</span>
          </span>
        ))}
      </span>
      <span className="mt-1 text-xs text-muted">{rec.hint}</span>
    </button>
  );
}
