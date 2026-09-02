import { CROP_META, plotAt } from "./farm.ts";
import { plantVerbLabel } from "./forestry.ts";
import { hasBook } from "./magery.ts";
import { getWorld } from "./live.ts";
import { effSkill } from "./player.ts";
import { identifyHarvestNode } from "./resources/harvest.ts";
import { discoverResourceNode, hasDiscoveredResourceNode } from "./resources/state.ts";
import type { CtxTarget, CtxVerb } from "./types.ts";

function harvestVerbLabel(tx: number, ty: number, nodeKind: "tree" | "rock"): string {
  const world = getWorld();
  const verb = nodeKind === "tree" ? "Chop" : "Mine";
  const skill = nodeKind === "tree" ? "lumberjack" : "mining";
  const discovered = hasDiscoveredResourceNode({
    seed: world.seed,
    tx,
    ty,
    nodeKind,
    resourceNodes: world.resourceNodes,
  });
  const identification = identifyHarvestNode({
    seed: world.seed,
    tx,
    ty,
    nodeKind,
    effectiveSkill: effSkill(world, skill),
    discovered,
  });
  if (identification.status !== "identified") return verb;
  world.resourceNodes = discoverResourceNode({
    seed: world.seed,
    tx,
    ty,
    nodeKind,
    hour: world.hour,
    resourceNodes: world.resourceNodes,
  });
  return `${verb} ${identification.label}`;
}

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
    if (tile?.kind === "tree") out.push({ verb: "chop", label: harvestVerbLabel(t.tx, t.ty, "tree") });
    if (tile?.kind === "rock") out.push({ verb: "mine", label: harvestVerbLabel(t.tx, t.ty, "rock") });
    const bed = plotAt(w, t.tx, t.ty);
    if (bed) {
      if (bed.crop && bed.stage >= 3) out.push({ verb: "harvest", label: "Harvest" });
      if (!bed.crop) {
        if ((w.player.pack.cabbage_seed ?? 0) > 0) out.push({ verb: "sowCabbage", label: "Sow cabbage seed" });
        if ((w.player.pack.wheat_seed ?? 0) > 0) out.push({ verb: "sowWheat", label: "Sow wheat seed" });
        if ((w.player.pack.garlic_seed ?? 0) > 0) out.push({ verb: "sowGarlic", label: "Sow garlic seed" });
      }
    } else if (tile && (tile.kind === "grass" || tile.kind === "dirt" || tile.kind === "sand" || tile.kind === "road")) {
      out.push({ verb: "till", label: "Till a plot" });
      if ((tile.kind === "grass" || tile.kind === "dirt") && (w.player.pack.acorn ?? 0) > 0) {
        out.push({ verb: "sowAcorn", label: plantVerbLabel(w.player.skills.forestry ?? 0) });
      }
    }
    if (hasBook(w)) out.push({ verb: "teleport", label: "Teleport here" });
  }
  if (t.kind === "plot") {
    out.push({ verb: "walk", label: "Walk here" });
    const bed = plotAt(w, t.tx, t.ty);
    if (bed?.crop && bed.stage >= 3) out.push({ verb: "harvest", label: `Take the ${CROP_META[bed.crop].label.toLowerCase()}` });
    if (bed && !bed.crop) {
      if ((w.player.pack.cabbage_seed ?? 0) > 0) out.push({ verb: "sowCabbage", label: "Sow cabbage seed" });
      if ((w.player.pack.wheat_seed ?? 0) > 0) out.push({ verb: "sowWheat", label: "Sow wheat seed" });
      if ((w.player.pack.garlic_seed ?? 0) > 0) out.push({ verb: "sowGarlic", label: "Sow garlic seed" });
    }
  }
  if (t.kind === "fauna") {
    const c = w.fauna.find((x) => x.id === t.id);
    if (c?.task === "dead") out.push({ verb: "skin", label: "Dress" }, { verb: "loot", label: "Loot" });
    else if (c?.ownerId === w.player.id) {
      out.push(
        { verb: "care", label: "Care" },
        { verb: "stay", label: "Stay" },
        { verb: "follow", label: "Follow" },
        { verb: "feed", label: "Feed" },
        { verb: "name", label: "Name" },
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
    if (t.label === "hall") out.push({ verb: "roster", label: "Read the roster" });
    if (t.label === "bank") out.push({ verb: "bank", label: "Open the box" });
    else if (t.label === "porch" || t.label === "hut" || t.label === "homestead") {
      out.push({ verb: "house", label: "Open the chest" });
    } else out.push({ verb: "use", label: t.label === "forge" ? "Work the fire" : "Use the bench" });
    out.push({ verb: "walk", label: "Walk" });
  }
  return out;
}
