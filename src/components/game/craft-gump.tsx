import { Button } from "@/components/ui/button";
import { ItemGlyph } from "@/components/game/paperdoll";
import { countTag, hasTag, ITEM_META } from "@/game/catalog";
import { RECIPES, haveNeed, stationsHere, type Recipe, type Station } from "@/game/craft";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import type { ItemId } from "@/game/types";
import { cn } from "@/lib/utils";

type Group = Station | "field";

const TITLE: Record<Group, { title: string; blurb: string }> = {
  bench: { title: "The bench", blurb: "Logs to boards. Then torch, club, crate, staff, cap, shield, bow, cuirass — any wood serves." },
  forge: { title: "The fire", blurb: "Ore to ingot. Then ring, knife, tools, gorget, boots, gauntlets, mace, sword, helm, iron shield, greaves, mail." },
  field: { title: "In the field", blurb: "A blade in hand. Any cloth to bandages, two hides to a leather shirt." },
};

export function CraftGump() {
  const open = useGame((s) => s.openCraft);
  const close = useGame((s) => s.closeCraft);
  const make = useGame((s) => s.makeRecipe);
  const pack = useGame((s) => s.snap.player?.pack);
  const skills = useGame((s) => s.snap.player?.skills);
  const held = useGame((s) => s.snap.player?.wear?.main);
  const x = useGame((s) => s.snap.youX);
  const z = useGame((s) => s.snap.youZ);
  if (!open) return null;
  const here = stationsHere(getWorld());
  void x;
  void z;
  const bladeOk = Boolean(held && hasTag(held, "blade"));
  const groups: Group[] = ["bench", "forge", "field"];
  return (
    <div className="pointer-events-auto absolute top-16 right-3 max-h-[min(70vh,36rem)] w-[min(100%-1.5rem,22rem)] overflow-auto rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4 sm:right-4">
      <p className="font-display text-sm text-fg">Work</p>
      <p className="mt-2 text-pretty text-xs leading-relaxed text-muted">
        Wood at the yard. Iron at a forge. A blade anywhere. The work takes, or it splits.
      </p>
      {groups.map((st) => {
        const at = st === "field" ? true : here.includes(st);
        const list = st === "field" ? RECIPES.filter((r) => r.station === null) : RECIPES.filter((r) => r.station === st);
        if (st === "field" && list.length === 0) return null;
        return (
          <div key={st} className="mt-4">
            <p className="font-display text-xs tracking-wider text-muted uppercase">{TITLE[st].title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{at ? TITLE[st].blurb : st === "forge" ? "Raise a forge, then stand by the fire." : "Stand in the yard, or the hall."}</p>
            <ul className="mt-2 space-y-1">
              {list.map((r) => (
                <li key={r.id}>
                  <RecipeRow rec={r} at={at} pack={pack} skill={skills?.[r.skill] ?? 0} bladeOk={bladeOk} onMake={() => make(r.id)} />
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
  bladeOk,
  onMake,
}: {
  rec: Recipe;
  at: boolean;
  pack?: Record<string, number>;
  skill: number;
  bladeOk: boolean;
  onMake: () => void;
}) {
  const ready = at && haveNeed(pack, rec) && (!rec.needsBlade || bladeOk);
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
            <span className="text-muted">({pack?.[k as ItemId] ?? 0})</span>
          </span>
        ))}
        {(rec.needTags ?? []).map((nt) => (
          <span key={nt.tag} className="flex items-center gap-0.5 text-xs text-muted">
            {nt.n} <span className="italic">{nt.tag}</span>
            <span className="text-muted">({countTag(pack, nt.tag)})</span>
          </span>
        ))}
        {rec.needsBlade ? <span className={cn("text-xs", bladeOk ? "text-muted" : "text-accent")}>+ a blade in hand</span> : null}
      </span>
      <span className="mt-1 text-xs text-muted">{rec.hint}</span>
    </button>
  );
}
