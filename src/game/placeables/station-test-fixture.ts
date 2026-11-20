import { you } from "../player.ts";
import type { World } from "../types.ts";

/** Domain-test fixture only; native placement is covered separately. */
export function withSpecialtyStation(world: World, definitionId: "loom" | "alchemy_bench") {
  const player = you(world)!;
  world.placedObjects.push({
    id: `fixture-${definitionId}`, definitionId, definitionVersion: 1,
    tx: Math.floor(player.x) + 1, ty: Math.floor(player.z), level: 0, rotation: 0,
    materialSlots: {}, ownerId: world.player.id, structureId: null, name: null, state: {},
  });
  return world;
}
