import { COURT, regionAt } from "./atlas.ts";
import { paintBiomes } from "./biome.ts";
import { hourOfDay, isDusk, isNight, settleGear, SKILL_META } from "./catalog.ts";
import { seedBarrow, seedFauna } from "./ecology.ts";
import { seedFarmPlots } from "./farm.ts";
import { maxMana } from "./magery.ts";
import { you } from "./player.ts";
import { mulberry32 } from "./rng.ts";
import { ensureWeather, weatherSnap } from "./weather.ts";
import { ensureCity } from "./city.ts";
import { createStubWorld, createWorld, seedEmberhallBank, seedFieldStones, seedTownNpcs } from "./world.ts";
import { ensureLookHut } from "./house.ts";
import { createResourceNodeStateMap, regrowResourceNodes } from "./resources/state.ts";
import type { SkillId, Snapshot, World } from "./types.ts";

function withFauna(w: World) {
  if (!w.fauna) w.fauna = [];
  if (!w.piles) w.piles = [];
  if (!w.campfires) w.campfires = [];
  if (!w.plots) w.plots = [];
  if (!w.saplings) w.saplings = [];
  if (!w.plantedTimber) w.plantedTimber = {};
  if (w.buildings) {
    for (const b of w.buildings) if (b.kind === "farm") seedFarmPlots(w, b.tx, b.ty);
  }
  if (w.scars == null) w.scars = {};
  if (w.resourceNodes == null) w.resourceNodes = createResourceNodeStateMap();
  if (w.landRev == null) w.landRev = 1;
  if (w.tiles.length) seedFieldStones(w);
  if (w.tiles.length) paintBiomes(w);
  if (w.tiles.length && w.fauna.length === 0) seedFauna(w, mulberry32(w.seed));
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
  if (w.player) {
    settleGear(w.player);
    // Older saves predate the placeholder skills — put them on the books at zero.
    for (const id of Object.keys(SKILL_META) as SkillId[]) {
      if (w.player.skills[id] == null) w.player.skills[id] = 0;
      if (w.player.lastGain[id] == null) w.player.lastGain[id] = 0;
    }
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
    if (w.player.nightSightUntil == null) w.player.nightSightUntil = 0;
    if (w.player.armedSpell === undefined) w.player.armedSpell = null;
    if (!Array.isArray(w.player.marks)) w.player.marks = [];
    if (w.player.ghost == null) w.player.ghost = false;
    if (w.player.corpseAt === undefined) w.player.corpseAt = null;
    if (w.player.workT == null) w.player.workT = 0;
    const p = w.people.find((x) => x.isPlayer);
    if (p && p.ghost == null) p.ghost = Boolean(w.player.ghost);
    const max = maxMana(p?.int ?? 8, w.player.skills.magery ?? 0);
    if (w.player.mana == null || Number.isNaN(w.player.mana)) w.player.mana = max;
    w.player.mana = Math.min(max, w.player.mana);
  }
  if (w.tiles.length) seedTownNpcs(w, mulberry32(w.seed + 91));
  seedEmberhallBank(w);
  ensureCity(w);
  ensureLookHut(w);
  ensureWeather(w);
  regrowResourceNodes(w);
  return w;
}

let world: World = createStubWorld();

export function getWorld() {
  return world;
}
export function setWorld(next: World) {
  world = withFauna(next);
}
export function resetWorld() {
  world = withFauna(createWorld());
  return world;
}

export function snapshot(w: World = world): Snapshot {
  ensureLookHut(w);
  regrowResourceNodes(w);
  const visible = w.people.filter((p) => p.task !== "away");
  const self = you(w);
  const region = regionAt(Math.round(self?.x ?? COURT.tx), Math.round(self?.z ?? COURT.ty));
  return {
    hour: w.hour,
    day: Math.floor(w.hour / 24) + 1,
    clock: hourOfDay(w.hour),
    gold: Math.floor(w.gold),
    prestige: Math.floor(w.prestige),
    speed: w.speed,
    memberCount: w.people.filter((p) => p.member && !p.isPlayer).length,
    visitorCount: w.people.filter((p) => !p.member && !p.role && p.task !== "away").length,
    people: visible,
    buildings: w.buildings,
    plots: w.plots ?? [],
    saplings: w.saplings ?? [],
    quests: w.quests,
    log: w.log.slice(0, 12),
    rep: { ...w.rep },
    nightOffer: w.nightOffer,
    boom: w.boom,
    objectives: w.objectives,
    restored: w.restored,
    isNight: isNight(w.hour),
    isDusk: isDusk(w.hour),
    weather: weatherSnap(w),
    player: w.player,
    fauna: w.fauna,
    piles: w.piles ?? [],
    campfires: w.campfires ?? [],
    landKey: String(w.landRev),
    region: region.name,
    youX: self?.x ?? COURT.tx,
    youZ: self?.z ?? COURT.ty,
    youPath: self?.path.length ?? 0,
    seenRev: w.seenRev ?? 0,
  };
}
