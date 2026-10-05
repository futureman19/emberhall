import { getWorld } from "../live.ts";
import { PLACEABLE_BY_ID } from "./catalog.ts";
import { placeObject } from "./commands.ts";
import { withHistory } from "./history.ts";
import { canPlace, defaultMaterials } from "./placement.ts";
import type { Rotation } from "./schema.ts";

export type HoldSnap = 0.5 | 1 | 2;

export interface HoldBuildState {
  active: boolean;
  definitionId: string | null;
  instanceId: string | null;
  tx: number | null;
  ty: number | null;
  rotation: Rotation;
  materials: Record<string, string>;
  snap: HoldSnap;
  reason: string | null;
}

function idle(): HoldBuildState {
  return {
    active: false,
    definitionId: null,
    instanceId: null,
    tx: null,
    ty: null,
    rotation: 0,
    materials: {},
    snap: 1,
    reason: null,
  };
}

let hold: HoldBuildState = idle();

export function getHoldBuild(): HoldBuildState {
  return hold;
}

export function enterHoldBuild() {
  hold = { ...idle(), active: true };
}

export function exitHoldBuild() {
  hold = idle();
}

export function cancelHoldBuild() {
  hold = { ...hold, tx: null, ty: null, reason: null, instanceId: null };
}

export function selectHoldPiece(definitionId: string | null) {
  if (!hold.active) enterHoldBuild();
  if (!definitionId) {
    hold = { ...hold, definitionId: null, materials: {}, reason: null };
    return;
  }
  const def = PLACEABLE_BY_ID[definitionId];
  if (!def) {
    hold = { ...hold, definitionId: null, reason: "No such piece.", materials: {} };
    return;
  }
  hold = {
    ...hold,
    definitionId,
    materials: defaultMaterials(def),
    rotation: def.rotations[0] ?? 0,
    reason: null,
  };
}

export function hoverHold(tx: number, ty: number) {
  if (!hold.active || !hold.definitionId) return;
  const reason = canPlace(getWorld(), hold.definitionId, tx, ty, hold.rotation);
  hold = { ...hold, tx, ty, reason };
}

export function turnHold() {
  if (!hold.definitionId) return;
  const def = PLACEABLE_BY_ID[hold.definitionId];
  if (!def) return;
  const i = def.rotations.indexOf(hold.rotation);
  const rotation = def.rotations[(i + 1) % def.rotations.length] ?? 0;
  hold = { ...hold, rotation };
  if (hold.tx != null && hold.ty != null) hoverHold(hold.tx, hold.ty);
}

export function confirmHold(): string | null {
  if (!hold.active || !hold.definitionId || hold.tx == null || hold.ty == null) return "No footing.";
  const world = getWorld();
  const err = withHistory(world, () => placeObject(world, hold.definitionId!, hold.tx!, hold.ty!, hold.rotation));
  if (!err) hoverHold(hold.tx, hold.ty);
  return err;
}
