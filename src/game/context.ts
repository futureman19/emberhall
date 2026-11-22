import { CROP_META, plotAt } from "./farm.ts";
import { houseOnTile } from "./house.ts";
import { plantVerbLabel, isGhostwoodTree, isTimberId } from "./forestry.ts";
import { GHOSTWOOD_LUMBERJACK, RESOURCE_CATALOG, timberGradeLabel } from "./resources/catalog.ts";
import { actorPerson, actorState } from "./actor.ts";
import { herbReady } from "./herbs.ts";
import { getWorld } from "./live.ts";
import { effSkill } from "./player.ts";
import { identifyHarvestNode } from "./resources/harvest.ts";
import { discoverResourceNode, hasDiscoveredResourceNode } from "./resources/state.ts";
import { isDoorOpen, objectFn } from "./placeables/functions.ts";
import type { CtxTarget, CtxVerb, World } from "./types.ts";

function harvestVerbLabel(world: World, actorId: string | undefined, tx: number, ty: number, nodeKind: "tree" | "rock"): string {
  const verb = nodeKind === "tree" ? "Chop" : "Mine";
  const skill = nodeKind === "tree" ? "lumberjack" : "mining";
  const planted = nodeKind === "tree" ? world.plantedTimber?.[`${tx},${ty}`] : undefined;
  const plantedTimber = isTimberId(planted) ? planted : null;
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
    effectiveSkill: effSkill(world, skill, actorId),
    discovered: Boolean(plantedTimber) || discovered,
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
  if (plantedTimber) {
    // Planting knows the family; the canonical tile still owns its quality ceiling.
    const grade = timberGradeLabel(identification.identity.qualityCeiling);
    return `${verb} ${grade[0]!.toUpperCase()}${grade.slice(1)} ${RESOURCE_CATALOG[plantedTimber].label}`;
  }
  return `${verb} ${identification.label}`;
}

type ContextVerb = { verb: CtxVerb; label: string };

export function verbsFor(t: CtxTarget): ContextVerb[];
export function verbsFor(world: World, actorId: string | undefined, target: CtxTarget): ContextVerb[];
export function verbsFor(worldOrTarget: World | CtxTarget, actorId?: string, target?: CtxTarget): ContextVerb[] {
  const w = target === undefined ? getWorld() : worldOrTarget as World;
  const t = target ?? worldOrTarget as CtxTarget;
  const actor = actorState(w, actorId);
  const out: { verb: CtxVerb; label: string }[] = [];
  if (actor.ghost || (actorId !== undefined && actorPerson(w, actorId)?.ghost)) {
    if (t.kind === "tile") {
      out.push({ verb: "walk", label: "Walk here" });
      const tile = w.tiles[t.ty]?.[t.tx];
      if (tile?.kind === "tree" && isGhostwoodTree(w, t.tx, t.ty) && effSkill(w, "lumberjack", actorId) >= GHOSTWOOD_LUMBERJACK) {
        out.push({ verb: "chop", label: harvestVerbLabel(w, actorId, t.tx, t.ty, "tree") });
      }
    }
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
    if (tile?.kind === "tree" && !isGhostwoodTree(w, t.tx, t.ty)) out.push({ verb: "chop", label: harvestVerbLabel(w, actorId, t.tx, t.ty, "tree") });
    if (tile?.kind === "rock") out.push({ verb: "mine", label: harvestVerbLabel(w, actorId, t.tx, t.ty, "rock") });
    if (tile?.kind === "water") out.push({ verb: "fish", label: "Cast a line" });
    const bed = plotAt(w, t.tx, t.ty);
    if (bed) {
      if (bed.crop && bed.stage >= 3) out.push({ verb: "harvest", label: "Harvest" });
      if (!bed.crop) {
        if ((actor.pack.cabbage_seed ?? 0) > 0) out.push({ verb: "sowCabbage", label: "Sow cabbage seed" });
        if ((actor.pack.wheat_seed ?? 0) > 0) out.push({ verb: "sowWheat", label: "Sow wheat seed" });
        if ((actor.pack.garlic_seed ?? 0) > 0) out.push({ verb: "sowGarlic", label: "Sow garlic seed" });
      }
    } else if (tile && (tile.kind === "grass" || tile.kind === "dirt" || tile.kind === "sand" || tile.kind === "road")) {
      out.push({ verb: "till", label: "Till a plot" });
      if ((tile.kind === "grass" || tile.kind === "dirt") && (actor.pack.acorn ?? 0) > 0) {
        out.push({ verb: "sowAcorn", label: plantVerbLabel(actor.skills.forestry ?? 0) });
      }
    }
      const dug = w.holes?.[`${t.tx},${t.ty}`];
      if (dug?.open) out.push({ verb: "fill", label: "Fill the hole" });
      else if (tile && (tile.kind === "grass" || tile.kind === "dirt" || tile.kind === "sand" || tile.kind === "snow" || tile.kind === "marsh")) {
        const cover = houseOnTile(w, t.tx, t.ty);
        const cellar = Boolean(cover && cover.ownerId === actor.id);
        out.push({ verb: "dig", label: dug?.buried ? "Unearth" : cellar ? "Dig a cellar" : "Dig" });
      }
    if ((actor.pack.spellbook ?? 0) > 0) out.push({ verb: "teleport", label: "Teleport here" });
    out.push({ verb: "track", label: "Track" });
  }
  if (t.kind === "plot") {
    out.push({ verb: "walk", label: "Walk here" });
    const bed = plotAt(w, t.tx, t.ty);
    if (bed?.crop && bed.stage >= 3) out.push({ verb: "harvest", label: `Take the ${CROP_META[bed.crop].label.toLowerCase()}` });
    if (bed && !bed.crop) {
      if ((actor.pack.cabbage_seed ?? 0) > 0) out.push({ verb: "sowCabbage", label: "Sow cabbage seed" });
      if ((actor.pack.wheat_seed ?? 0) > 0) out.push({ verb: "sowWheat", label: "Sow wheat seed" });
      if ((actor.pack.garlic_seed ?? 0) > 0) out.push({ verb: "sowGarlic", label: "Sow garlic seed" });
    }
  }
  if (t.kind === "fauna") {
    const c = w.fauna.find((x) => x.id === t.id);
    if (c?.task === "dead") out.push({ verb: "skin", label: "Dress" }, { verb: "loot", label: "Loot" });
    else if (c?.ownerId === actor.id) {
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
      if ((actor.pack.spellbook ?? 0) > 0) {
        out.push({ verb: "cast", label: "Magic Arrow" }, { verb: "fireball", label: "Fireball" });
      }
    }
  }
  if (t.kind === "person") out.push({ verb: "talk", label: "Talk" }, { verb: "walk", label: "Walk" });
  if (t.kind === "pile") out.push({ verb: "loot", label: "Take" });
  if (t.kind === "herb") {
    const patch = w.herbs?.find((h) => h.id === t.id);
    if (patch && herbReady(w, patch)) out.push({ verb: "pick", label: `Pick the ${t.label}` });
    out.push({ verb: "walk", label: "Walk" });
  }
  if (t.kind === "gate") out.push({ verb: "enter", label: "Enter" });
  if (t.kind === "building") {
    const piece = w.placedObjects.find((o) => o.id === t.id);
    if (piece) {
      const fn = objectFn(piece);
      if (fn === "door") out.push({ verb: "use", label: isDoorOpen(piece) ? "Shut the door" : "Open the door" });
      else if (fn === "storage") out.push({ verb: "house", label: "Open the chest" });
      else if (fn === "bed") out.push({ verb: "use", label: "Rest" });
      else if (fn === "sign") out.push({ verb: "use", label: "Read the sign" });
      else if (fn === "hearth") out.push({ verb: "use", label: "Work the fire" });
      else if (fn === "craftStation") out.push({ verb: "use", label: `Work at ${t.label}` });
      out.push({ verb: "walk", label: "Walk" });
      return out;
    }
    if (t.label === "hall") out.push({ verb: "roster", label: "Read the roster" });
    if (t.label === "bank") out.push({ verb: "bank", label: "Open the box" });
    else if (t.label === "porch" || t.label === "hut" || t.label === "homestead") {
      out.push({ verb: "house", label: "Open the chest" });
    } else out.push({ verb: "use", label: t.label === "forge" ? "Work the fire" : "Use the bench" });
    out.push({ verb: "walk", label: "Walk" });
  }
  return out;
}
