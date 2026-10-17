import { grantEverything } from "./testkit.ts";
import { SKILL_META } from "./catalog.ts";
import { maxMana } from "./magery.ts";
import type { SkillId, World } from "./types.ts";
export { isSandbox } from "./god.ts";

/** Only call on a dedicated sandbox world, never the normal character. */
export function prepareSandbox(world: World): void {
  Object.assign(world, { sandbox: true });
  grantEverything(world);
  for (const key of Object.keys(world.player.resources.stacks)) {
    const stacks = world.player.resources.stacks;
    const id = key as keyof typeof stacks;
    stacks[id] = Math.max(stacks[id] ?? 0, 999);
  }
  // The gain system caps each skill at 100; total skill affects gain speed,
  // not a shared cap. Placeholder skills remain placeholders even at 100.
  for (const id of Object.keys(SKILL_META) as SkillId[]) world.player.skills[id] = 100;
  const self = world.people.find(p => p.isPlayer);
  world.player.mana = maxMana(self?.int ?? 8, 100);
}
