import { COURT } from "../../game/atlas.ts";

/** Presentation only: the caller supplies canonical/planted resource identity. */
export function usesAuthoredOak(resourceId: string, tx: number, ty: number, ready: boolean) {
  return ready && resourceId === "oak" && Math.hypot(tx - COURT.tx, ty - COURT.ty) <= 22;
}
