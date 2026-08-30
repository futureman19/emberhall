import { ITEM_META } from "@/game/catalog";
import { statLines, tagLine, worthLine } from "@/game/iteminfo";
import { describeAffix, rareName } from "@/game/rare";
import type { ItemId, RareItem } from "@/game/types";

/**
 * ItemTip — everything an item wants to say about itself. Mundane
 * items show stats, tags, and shop worth; rares lead with their name
 * and spell every affix out, maker's mark at the foot.
 */
export function ItemTipContent({ id, rare }: { id: ItemId; rare?: RareItem }) {
  const meta = ITEM_META[id];
  const stats = statLines(id);
  const worth = worthLine(id);
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
      {rare?.maker ? <span className="mt-0.5 block text-[11px] text-muted italic">crafted by {rare.maker}</span> : null}
      <span className="mt-0.5 block text-[11px] text-muted">{tagLine(id)}</span>
      {worth ? <span className="block text-[11px] text-muted">{worth}</span> : null}
    </span>
  );
}
