import { FAUNA_META, SECONDS_PER_HOUR } from "./catalog.ts";
import type { Creature, World } from "./types.ts";
import { log } from "./world.ts";
import { emitCompanionFx } from "./companion-animation.ts";

/**
 * Companions — the bond made visible. Pets carry names, loyalty ebbs
 * with neglect, a hungry friend speaks up once, and a forgotten one
 * slips back into the wild. Feeding is love; love is a full belly.
 */

/** How fast loyalty ebbs (per game hour). A fresh bond (40) lasts ~80 hours unfed. */
const LOYALTY_EBB = 0.5;
/** Below this the pet speaks up once. */
const RESTLESS_AT = 15;

/** What to call a beast — its given name, else its kind. */
export function petLabel(c: Creature): string {
  return c.name ?? FAUNA_META[c.kind].label.toLowerCase();
}

/** Name a companion. Trimmed, 1–20 chars, letters and spaces. */
export function commandNamePet(world: World, id: string, raw: string): string {
  const c = world.fauna.find((x) => x.id === id);
  if (!c || c.ownerId !== world.player.id) return "It is not yours.";
  if (c.task === "dead") return "The dead keep their names.";
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "A name, then — say something.";
  if (name.length > 20) return "Twenty letters is plenty.";
  if (!/^[A-Za-z' -]+$/.test(name)) return "Plain letters for a name.";
  const old = petLabel(c);
  c.name = name;
  emitCompanionFx(world, { kind: "name", targetId: c.id, x: c.x, z: c.z, name });
  const note = old === name ? `${name} already answers to it.` : `${old} is ${name} now.`;
  log(world, note);
  return note;
}

/** Loyalty ebbs; the restless speak once; the forgotten leave. */
export function tickPets(world: World, dt: number): void {
  for (const c of world.fauna) {
    if (c.ownerId !== world.player.id || c.task === "dead") continue;
    c.loyalty = Math.max(0, c.loyalty - LOYALTY_EBB * (dt / SECONDS_PER_HOUR));
    const who = c.name ?? `the ${FAUNA_META[c.kind].label.toLowerCase()}`;
    if (c.loyalty <= 0) {
      // Forgotten — the wild takes it back.
      c.ownerId = null;
      c.stay = false;
      c.task = "wander";
      c.warnedLoyal = false;
      log(world, `${who} slips back into the wild.`);
    } else if (c.loyalty < RESTLESS_AT && !c.warnedLoyal) {
      c.warnedLoyal = true;
      log(world, `${who} looks restless — it wants a feed.`);
    }
  }
}
