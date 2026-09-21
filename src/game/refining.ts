import { addResource, debitResources, makeResourceStackKey, parseResourceInventory, parseResourceStackKey, resourceCount } from "./inventory/resources.ts";
import { RESOURCE_CATALOG } from "./resources/catalog.ts";
import type { GradeResourceId, MaterialGrade, ProcessingRoute, ProcessingStation, ResourceDefinition, ResourceForm } from "./resources/types.ts";
import type { PlayerState, ResourceStackKey } from "./types.ts";

export type RefiningPlayer = Pick<PlayerState, "resources">;

const GRADE_ORDER = ["rough", "sound", "choice", "pristine"] as const satisfies readonly MaterialGrade[];

/** Single discovery path for the refine command and the work gump. A route is
 * found by its PRIMARY input (inputs[0]) — alloy routes live on their output
 * resource but surface under the metal the player selects. */
export function findProcessingRoute(
  resourceId: GradeResourceId,
  form: ResourceForm,
): Readonly<{ owner: ResourceDefinition; route: ProcessingRoute }> | null {
  for (const owner of Object.values(RESOURCE_CATALOG)) {
    if (owner.qualityType !== "grade") continue;
    const route = owner.processing.find(
      (candidate) => candidate.inputs[0]?.resourceId === resourceId && candidate.inputs[0].form === form,
    );
    if (route) return Object.freeze({ owner, route });
  }
  return null;
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

  // Plan the full melt before anything moves: the selected primary stack plus
  // every secondary input, lowest-grade stock first, weakest-link output grade.
  const primary = route.inputs[0]!;
  const debits: { key: ResourceStackKey; amount: number }[] = [];
  if (resourceCount(resources, key) < primary.quantity) {
    return Object.freeze({ status: "blocked", reason: "materials", message: "Not enough selected material to refine." });
  }
  debits.push({ key, amount: primary.quantity });
  let weakest = GRADE_ORDER.indexOf(grade);

  for (const input of route.inputs.slice(1)) {
    let needed = input.quantity;
    for (const inputGrade of GRADE_ORDER) {
      if (needed === 0) break;
      const stackKey = makeResourceStackKey(input.resourceId, input.form as never, inputGrade as never);
      const available = resourceCount(resources, stackKey);
      if (available === 0) continue;
      const take = Math.min(needed, available);
      debits.push({ key: stackKey, amount: take });
      needed -= take;
      weakest = Math.min(weakest, GRADE_ORDER.indexOf(inputGrade));
    }
    if (needed > 0) {
      const label = RESOURCE_CATALOG[input.resourceId].label.toLowerCase();
      return Object.freeze({
        status: "blocked",
        reason: "materials",
        message: `The melt needs ${input.quantity} ${label} ${input.form}.`,
      });
    }
  }

  if (!debitResources(resources, debits)) {
    return Object.freeze({ status: "blocked", reason: "materials", message: "Not enough selected material to refine." });
  }
  const output = makeResourceStackKey(found.owner.id as GradeResourceId, route.output.form as never, GRADE_ORDER[weakest] as never);
  addResource(resources, output, route.output.quantity);
  player.resources = resources;
  return Object.freeze({ status: "refined", input: key, output, quantity: route.output.quantity });
}
