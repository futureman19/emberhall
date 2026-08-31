import { ITEM_META } from "@/game/catalog";
import { craftedItemLines, gearCompare, statLines, tagLine, worthLine } from "@/game/iteminfo";
import { describeAffix, rareName } from "@/game/rare";
import { getWorld } from "@/game/live";
import type { ItemId, RareItem } from "@/game/types";

/**
 * ItemTip — everything an item wants to say about itself. Mundane
 * items show stats, tags, and shop worth; rares lead with their name
 * and spell every affix out, maker's mark at the foot. Anything that
 * can be worn also answers the real question: better or worse than
 * what you're wearing? (skipCompare on rows that ARE the wearing.)
 */
export function ItemTipContent({ id, rare, skipCompare }: { id: ItemId; rare?: RareItem; skipCompare?: boolean }) {
  const meta = ITEM_META[id];
  const stats = statLines(id);
  const worth = worthLine(id);
  const cmp = skipCompare ? null : gearCompare(getWorld(), id, rare ?? null);
  const crafted = rare ? craftedItemLines(rare) : [];
  return (
    <span className="block">
      <span className={`block font-display text-xs ${rare ? "text-gold" : "text-fg"}`}>
        {rare ? rareName(rare) : meta.label}
      </span>
      {stats.length > 0 ? <span className="mt-0.5 block text-[11px] text-fg">{stats.join(" · ")}</span> : null}
      {rare
        ? rare.affixes.map((a) => (
            <span key={a} className="block text-[11px] text-gold">
              {describeAffix(a)}
            </span>
          ))
        : null}
      {crafted.map((line) => (
        <span key={line} className="block text-[11px] text-fg">{line}</span>
      ))}
      {cmp ? (
        <span
          className={`mt-0.5 block text-[11px] font-semibold ${
            cmp.delta > 0 ? "text-emerald-400" : cmp.delta < 0 ? "text-red-400" : "text-muted"
          }`}
        >
          {cmp.delta > 0 ? "▲" : cmp.delta < 0 ? "▼" : "="}
          {cmp.delta !== 0 ? ` ${Math.abs(cmp.delta)}` : " even —"} {cmp.stat} vs {cmp.vsLabel}
        </span>
      ) : null}
      {rare?.maker ? <span className="mt-0.5 block text-[11px] text-muted italic">crafted by {rare.maker}</span> : null}
      <span className="mt-0.5 block text-[11px] text-muted">{tagLine(id)}</span>
      {worth ? <span className="block text-[11px] text-muted">{worth}</span> : null}
    </span>
  );
}
