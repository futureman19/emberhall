import { CROP_META, plotAt } from "./farm";
import { hasBook } from "./magery";
import { getWorld } from "./live";
import type { CtxTarget, CtxVerb } from "./types";

export function verbsFor(t: CtxTarget): { verb: CtxVerb; label: string }[] {
  const w = getWorld();
  const out: { verb: CtxVerb; label: string }[] = [];
  if (w.player.ghost) {
    if (t.kind === "tile") out.push({ verb: "walk", label: "Walk here" });
    if (t.kind === "person") {
      const p = w.people.find((x) => x.id === t.id);
      out.push(
        { verb: "talk", label: p?.role === "healer" ? "Return me" : "Talk" },
        { verb: "walk", label: "Walk" },
      );
    }
    if (t.kind === "gate") out.push({ verb: "enter", label: "Enter" });
    return out;
  }
  if (t.kind === "tile") {
    out.push({ verb: "walk", label: "Walk here" });
    const tile = w.tiles[t.ty]?.[t.tx];
    if (tile?.kind === "tree") out.push({ verb: "chop", label: "Chop" });
    if (tile?.kind === "rock") out.push({ verb: "mine", label: "Mine" });
    const bed = plotAt(w, t.tx, t.ty);
    if (bed) {
      if (bed.crop && bed.stage >= 3) out.push({ verb: "harvest", label: "Harvest" });
      if (!bed.crop) {
        if ((w.player.pack.cabbage ?? 0) > 0) out.push({ verb: "sowCabbage", label: "Sow cabbage" });
        if ((w.player.pack.wheat ?? 0) > 0) out.push({ verb: "sowWheat", label: "Sow wheat" });
        if ((w.player.pack.garlic ?? 0) > 0) out.push({ verb: "sowGarlic", label: "Sow garlic" });
      }
    }
    if (hasBook(w)) out.push({ verb: "teleport", label: "Teleport here" });
  }
  if (t.kind === "plot") {
    out.push({ verb: "walk", label: "Walk here" });
    const bed = plotAt(w, t.tx, t.ty);
    if (bed?.crop && bed.stage >= 3) out.push({ verb: "harvest", label: `Take the ${CROP_META[bed.crop].label.toLowerCase()}` });
    if (bed && !bed.crop) {
      if ((w.player.pack.cabbage ?? 0) > 0) out.push({ verb: "sowCabbage", label: "Sow cabbage" });
      if ((w.player.pack.wheat ?? 0) > 0) out.push({ verb: "sowWheat", label: "Sow wheat" });
      if ((w.player.pack.garlic ?? 0) > 0) out.push({ verb: "sowGarlic", label: "Sow garlic" });
    }
  }
  if (t.kind === "fauna") {
    const c = w.fauna.find((x) => x.id === t.id);
    if (c?.task === "dead") out.push({ verb: "skin", label: "Dress" }, { verb: "loot", label: "Loot" });
    else if (c?.ownerId === w.player.id) {
      out.push(
        { verb: "stay", label: "Stay" },
        { verb: "follow", label: "Follow" },
        { verb: "feed", label: "Feed" },
        { verb: "release", label: "Release" },
      );
    } else {
      out.push({ verb: "hunt", label: "Hunt" }, { verb: "tame", label: "Tame" });
      if (hasBook(w)) {
        out.push({ verb: "cast", label: "Magic Arrow" }, { verb: "fireball", label: "Fireball" });
      }
    }
  }
  if (t.kind === "person") out.push({ verb: "talk", label: "Talk" }, { verb: "walk", label: "Walk" });
  if (t.kind === "pile") out.push({ verb: "loot", label: "Take" });
  if (t.kind === "gate") out.push({ verb: "enter", label: "Enter" });
  if (t.kind === "building") {
    out.push({ verb: "use", label: t.label === "forge" ? "Work the fire" : "Use the bench" });
    out.push({ verb: "walk", label: "Walk" });
  }
  return out;
}
