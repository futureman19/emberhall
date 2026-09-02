import { VIEW } from "./atlas.ts";
import { buildingAt } from "./craft.ts";
import { houseAt } from "./house.ts";
import { CROP_META, plotAt } from "./farm.ts";
import { getWorld } from "./live.ts";
import { markBuildHold, takeBuildHold, useGame } from "./store.ts";
import type { CtxTarget } from "./types.ts";

export function hitAt(tx: number, ty: number, sx: number, sy: number) {
  const w = getWorld();
  const g = useGame.getState();
  const pile = w.piles.find((p) => p.tx === tx && p.ty === ty);
  if (pile) {
    g.openCtx(sx, sy, { kind: "pile", id: pile.id, tx, ty, label: pile.label });
    return;
  }
  const fauna = w.fauna.find((c) => Math.round(c.x) === tx && Math.round(c.z) === ty);
  if (fauna) {
    g.openCtx(sx, sy, { kind: "fauna", id: fauna.id, tx, ty, label: fauna.kind });
    return;
  }
  const person = w.people.find((p) => !p.isPlayer && Math.round(p.x) === tx && Math.round(p.z) === ty);
  if (person) {
    g.openCtx(sx, sy, { kind: "person", id: person.id, tx, ty, label: person.name });
    return;
  }
  const bed = plotAt(w, tx, ty);
  if (bed) {
    const crop = bed.crop ? CROP_META[bed.crop].label : "bed";
    g.openCtx(sx, sy, { kind: "plot", id: bed.id, tx, ty, label: crop });
    return;
  }
  const house = houseAt(w, tx, ty, 2.6);
  if (house) {
    g.openCtx(sx, sy, { kind: "building", id: house.id, tx: house.tx, ty: house.ty, label: house.kind });
    return;
  }
  const b = buildingAt(w, tx, ty, 2.6);
  if (b) {
    g.openCtx(sx, sy, { kind: "building", id: b.id, tx: b.tx, ty: b.ty, label: b.kind });
    return;
  }
  const t: CtxTarget = { kind: "tile", id: `${tx},${ty}`, tx, ty, label: "dirt" };
  g.openCtx(sx, sy, t);
  void VIEW;
}

export function hoverAt(tx: number, ty: number) {
  const g = useGame.getState();
  if (g.buildKind) g.hoverBuild(tx, ty);
  if (g.tillArmed) g.hoverTill(tx, ty);
}

export function liftAt(tx: number, ty: number) {
  if (!takeBuildHold()) return;
  const g = useGame.getState();
  if (!g.buildKind) return;
  g.hoverBuild(tx, ty);
  g.useTile(tx, ty);
}

export function leftAt(tx: number, ty: number) {
  const w = getWorld();
  const g = useGame.getState();
  if (g.buildKind) {
    markBuildHold();
    g.hoverBuild(tx, ty);
    return;
  }
  const fauna = w.fauna.find((c) => c.task !== "dead" && Math.hypot(c.x - tx, c.z - ty) < 0.9);
  if (fauna) {
    g.hunt(fauna.id);
    return;
  }
  const person = w.people.find((p) => !p.isPlayer && Math.hypot(p.x - tx, p.z - ty) < 0.9);
  if (person) {
    g.select(person.id);
    g.talk(person.id);
    return;
  }
  const pile = w.piles.find((p) => Math.hypot(p.tx - tx, p.ty - ty) < 0.8);
  if (pile) {
    g.openPile(pile.id);
    return;
  }
  g.useTile(tx, ty);
}
