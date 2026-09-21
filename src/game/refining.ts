import { addResource, debitResources, makeResourceStackKey, parseResourceInventory, parseResourceStackKey } from "./inventory/resources.ts";
import { RESOURCE_CATALOG } from "./resources/catalog.ts";
import type { GradeResourceId, MaterialGrade, ProcessingRoute, ProcessingStation, ResourceDefinition, ResourceForm } from "./resources/types.ts";
import type { PlayerState, ResourceStackKey } from "./types.ts";

export type RefiningPlayer = Pick<PlayerState, "resources">;

/** Single discovery path for the refine command and the work gump. Today a
 * route begins with the owner's own material; alloy routes widen this scan. */
export function findProcessingRoute(
  resourceId: GradeResourceId,
  form: ResourceForm,
): Readonly<{ owner: ResourceDefinition; route: ProcessingRoute }> | null {
  const definition = RESOURCE_CATALOG[resourceId];
  if (!definition || definition.qualityType !== "grade") return null;
  const route = definition.processing.find((candidate) => candidate.input.form === form);
  return route ? Object.freeze({ owner: definition, route }) : null;
}

export type RefiningResult =
  | Readonly<{ status: "blocked"; reason: "route" | "station" | "skill" | "materials"; message: string }>
  | Readonly<{ status: "refined"; input: ResourceStackKey; output: ResourceStackKey; quantity: number }>;

export function refineResource(
  player: RefiningPlayer,
  rawKey: ResourceStackKey,
  station: ProcessingStation,
  effectiveSkill: number,
): RefiningResult {
  const key = parseResourceStackKey(rawKey);
  const [resourceId, form, grade] = key.split(":") as [GradeResourceId, string, MaterialGrade];
  const found = findProcessingRoute(resourceId, form as ResourceForm);
  if (!found) {
    const definition = RESOURCE_CATALOG[resourceId];
    const reason = !definition || definition.qualityType !== "grade" ? "That resource cannot be refined." : "No refining route begins with that material.";
    return Object.freeze({ status: "blocked", reason: "route", message: reason });
  }
  const { route } = found;
  if (route.station !== station) {
    return Object.freeze({ status: "blocked", reason: "station", message: `This work requires a ${route.station}.` });
  }
  if (!Number.isFinite(effectiveSkill) || effectiveSkill < route.skill.minimum) {
    return Object.freeze({ status: "blocked", reason: "skill", message: `Need ${route.skill.minimum} skill to refine this material.` });
  }

  const resources = parseResourceInventory(player.resources);
  if (!debitResources(resources, [{ key, amount: route.input.quantity }])) {
    return Object.freeze({ status: "blocked", reason: "materials", message: "Not enough selected material to refine." });
  }
  const output = makeResourceStackKey(resourceId, route.output.form as never, grade as never);
  addResource(resources, output, route.output.quantity);
  player.resources = resources;
  return Object.freeze({ status: "refined", input: key, output, quantity: route.output.quantity });
}
