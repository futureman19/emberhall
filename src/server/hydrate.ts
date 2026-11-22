// Mirrors live.ts withFauna without binding the singleton or enabling god mode.
// Keep parity tests when either hydration path changes.
import { paintBiomes } from "../game/biome.ts";
import { settleGear, SKILL_META } from "../game/catalog.ts";
import { ensureExpansionFauna, ensureStarterFauna, seedBarrow, seedFauna } from "../game/ecology.ts";
import { seedFarmPlots } from "../game/farm.ts";
import { maxMana } from "../game/magery.ts";
import { mulberry32 } from "../game/rng.ts";
import { ensureWeather } from "../game/weather.ts";
import { ensureCity, ensureKeepSite } from "../game/city.ts";
import { ensureHerbs } from "../game/herbs.ts";
import { ensureRynWain, seedEmberhallBank, seedFieldStones, seedTownNpcs } from "../game/world.ts";
import { defaultBuildingPreview, ensureLookHut } from "../game/house.ts";
import { createResourceNodeStateMap, regrowResourceNodes } from "../game/resources/state.ts";
import type { Person, PlayerState, SkillId, World } from "../game/types.ts";

/** Apply the same legacy-save defaults once to each distinct body sheet. */
function hydratePlayerState(state: PlayerState, person?: Person) {
  settleGear(state);
  // Older saves predate the placeholder skills — put them on the books at zero.
  for (const id of Object.keys(SKILL_META) as SkillId[]) {
    if (state.skills[id] == null) state.skills[id] = 0;
    if (state.lastGain[id] == null) state.lastGain[id] = 0;
  }
  if (state.nightSightUntil == null) state.nightSightUntil = 0;
  if (state.poisonUntil == null) state.poisonUntil = 0;
  if (state.poisonTickAt == null) state.poisonTickAt = 0;
  if (state.blessUntil == null) state.blessUntil = 0;
  if (state.invisUntil == null) state.invisUntil = 0;
  if (state.ironwoodUntil == null) state.ironwoodUntil = 0;
  if (state.flyUntil == null) state.flyUntil = 0;
  if (state.armedSpell === undefined) state.armedSpell = null;
  if (state.armedTechnique === undefined) state.armedTechnique = null;
  if (state.techniqueCoolUntil === undefined) state.techniqueCoolUntil = {};
  if (state.lastBittenAt == null) state.lastBittenAt = 0;
  if (state.lastStrikeAt == null) state.lastStrikeAt = 0;
  if (!Array.isArray(state.marks)) state.marks = [];
  if (state.ghost == null) state.ghost = false;
  if (state.corpseAt === undefined) state.corpseAt = null;
  if (state.workT == null) state.workT = 0;
  const max = maxMana(person?.int ?? 8, state.skills.magery ?? 0);
  if (state.mana == null || Number.isNaN(state.mana)) state.mana = max;
  state.mana = Math.min(max, state.mana);
}

export function hydrateWorld(w: World) {
  if (!w.playerStates) w.playerStates = {};
  if (!w.fauna) w.fauna = [];
  if (!w.piles) w.piles = [];
  if (!w.campfires) w.campfires = [];
  if (!w.herbs) w.herbs = [];
  if (!w.plots) w.plots = [];
  if (!w.saplings) w.saplings = [];
  if (!w.plantedTimber) w.plantedTimber = {};
  if (!w.placedObjects) w.placedObjects = [];
  if (!w.structures) w.structures = [];
  if (!w.blueprints) w.blueprints = [];
  if (w.buildings) {
    for (const b of w.buildings) if (b.kind === "farm") seedFarmPlots(w, b.tx, b.ty);
  }
  if (w.scars == null) w.scars = {};
  if (w.holes == null) w.holes = {};
  if (w.resourceNodes == null) w.resourceNodes = createResourceNodeStateMap();
  if (w.landRev == null) w.landRev = 1;
  if (w.tiles.length) seedFieldStones(w);
  if (w.tiles.length) paintBiomes(w);
  if (w.tiles.length && w.fauna.length === 0) seedFauna(w, mulberry32(w.seed));
  if (w.tiles.length) ensureExpansionFauna(w);
  if (w.tiles.length) ensureStarterFauna(w);
  if (w.tiles.length) seedBarrow(w, mulberry32(w.seed + 17));
  if (w.fauna) {
    for (const c of w.fauna) {
      if (c.loyalty == null) c.loyalty = 0;
      if (c.name === undefined) c.name = null;
      if (c.warnedLoyal == null) c.warnedLoyal = false;
      if (c.stay == null) c.stay = false;
    }
  }
  if (!w.seen) w.seen = {};
  if (w.seenRev == null) w.seenRev = 1;
  const sheets = new Set([w.player, ...Object.values(w.playerStates)]);
  for (const state of sheets) {
    if (!state) continue;
    const person = state === w.player
      ? w.people.find((x) => x.isPlayer)
      : w.people.find((x) => x.id === state.id);
    hydratePlayerState(state, person);
  }
  if (w.objectives) {
    const extra = [
      { id: "plank", text: "Saw a log into boards at the yard", done: false },
      { id: "smelt", text: "Smelt ore at a forge", done: false },
      { id: "smith", text: "Beat ingot into a tool at the fire", done: false },
      { id: "farm", text: "Raise a farm", done: false },
      { id: "till", text: "Till a plot of land", done: false },
      { id: "plant", text: "Sow a seed in a bed", done: false },
      { id: "harvest", text: "Take a crop from the dirt", done: false },
      { id: "forest", text: "Plant an acorn on grass or dirt", done: false },
    ];
    for (const e of extra) {
      if (!w.objectives.some((o) => o.id === e.id)) w.objectives.push(e);
    }
  }
  if (w.player) {
    if (!Array.isArray(w.zones)) w.zones = [];
    const p = w.people.find((x) => x.isPlayer);
    if (p && p.ghost == null) p.ghost = Boolean(w.player.ghost);
    if (p && (p.story == null || Number.isNaN(p.story))) p.story = 0;
    for (const person of w.people) {
      if (person.story == null || Number.isNaN(person.story)) person.story = 0;
    }
  }
  if (w.tiles.length) seedTownNpcs(w, mulberry32(w.seed + 91));
  seedEmberhallBank(w);
  ensureCity(w);
  ensureKeepSite(w);
  defaultBuildingPreview(w);
  ensureLookHut(w);
  ensureRynWain(w);
  ensureWeather(w);
  ensureHerbs(w);
  regrowResourceNodes(w);
  return w;
}
