import type { FaunaKind } from "@/game/types";

/** Exhaustive worldwide mapping; no region, seed, task or owner filtering. */
export const FAUNA_ART_URLS = {
  hare: "/art/lanternwood/fauna-hare.glb",
  hart: "/art/lanternwood/fauna-hart.glb",
  wolf: "/art/lanternwood/fauna-wolf.glb",
  wight: "/art/lanternwood/fauna-wight.glb",
  brambleback_stag: "/art/lanternwood/fauna-brambleback_stag.glb",
  ironwood_boar: "/art/lanternwood/fauna-ironwood_boar.glb",
  pine_lynx: "/art/lanternwood/fauna-pine_lynx.glb",
  ember_fox: "/art/lanternwood/fauna-ember_fox.glb",
  moss_badger: "/art/lanternwood/fauna-moss_badger.glb",
  ridgeback_warg: "/art/lanternwood/fauna-ridgeback_warg.glb",
  thornhide_doe: "/art/lanternwood/fauna-thornhide_doe.glb",
  mire_croaker: "/art/lanternwood/fauna-mire_croaker.glb",
  reedback_stalker: "/art/lanternwood/fauna-reedback_stalker.glb",
  bog_toad: "/art/lanternwood/fauna-bog_toad.glb",
  saltback_tortoise: "/art/lanternwood/fauna-saltback_tortoise.glb",
  brine_hound: "/art/lanternwood/fauna-brine_hound.glb",
  dune_crawler: "/art/lanternwood/fauna-dune_crawler.glb",
  coal_salamander: "/art/lanternwood/fauna-coal_salamander.glb",
  orebeetle: "/art/lanternwood/fauna-orebeetle.glb",
  stonecrawl_spider: "/art/lanternwood/fauna-stonecrawl_spider.glb",
  greybarrow_wightling: "/art/lanternwood/fauna-greybarrow_wightling.glb",
  barrow_hound: "/art/lanternwood/fauna-barrow_hound.glb",
  ashen_banshee: "/art/lanternwood/fauna-ashen_banshee.glb",
  bonecrow: "/art/lanternwood/fauna-bonecrow.glb",
  brine_troll: "/art/lanternwood/fauna-brine_troll.glb",
  stonefang_ogre: "/art/lanternwood/fauna-stonefang_ogre.glb",
  orc_marauder: "/art/lanternwood/fauna-orc_marauder.glb",
  oak_bear: "/art/lanternwood/fauna-oak_bear.glb",
  frosthorn_ram: "/art/lanternwood/fauna-frosthorn_ram.glb",
  fen_leech: "/art/lanternwood/fauna-fen_leech.glb",
  tideclaw_crab: "/art/lanternwood/fauna-tideclaw_crab.glb",
  cavern_bat: "/art/lanternwood/fauna-cavern_bat.glb",
  tomb_sentinel: "/art/lanternwood/fauna-tomb_sentinel.glb",
  cinder_drake: "/art/lanternwood/fauna-cinder_drake.glb",
  willow_wisp: "/art/lanternwood/fauna-willow_wisp.glb",
  blackbriar_hag: "/art/lanternwood/fauna-blackbriar_hag.glb",
  rime_revenant: "/art/lanternwood/fauna-rime_revenant.glb",
  fen_ghoul: "/art/lanternwood/fauna-fen_ghoul.glb",
  drowned_reaver: "/art/lanternwood/fauna-drowned_reaver.glb",
  deepmaw_basilisk: "/art/lanternwood/fauna-deepmaw_basilisk.glb",
  ossuary_knight: "/art/lanternwood/fauna-ossuary_knight.glb",
  ash_demon: "/art/lanternwood/fauna-ash_demon.glb",
  grave_lich: "/art/lanternwood/fauna-grave_lich.glb",
  redtail_squirrel: "/art/lanternwood/fauna-redtail_squirrel.glb",
  whiteback_elk: "/art/lanternwood/fauna-whiteback_elk.glb",
  highland_aurochs: "/art/lanternwood/fauna-highland_aurochs.glb",
  reed_heron: "/art/lanternwood/fauna-reed_heron.glb",
  river_otter: "/art/lanternwood/fauna-river_otter.glb",
  brine_seal: "/art/lanternwood/fauna-brine_seal.glb",
  cave_mole: "/art/lanternwood/fauna-cave_mole.glb",
  dusk_owl: "/art/lanternwood/fauna-dusk_owl.glb",
  field_rat: "/art/lanternwood/fauna-field_rat.glb",
} as const satisfies Record<FaunaKind, string>;

/** Visual-only spell-art ids. Gameplay ignores these. */
export const FAUNA_SPELL_ART_IDS = ["thornbound", "stonebound", "galebound", "tidebound", "risen"] as const;
export type FaunaSpellArt = (typeof FAUNA_SPELL_ART_IDS)[number];
const SPELL_ART = new Set<string>(FAUNA_SPELL_ART_IDS);
const ELEMENTAL_ART = new Set<FaunaSpellArt>(["thornbound", "stonebound", "galebound", "tidebound"]);

export const FAUNA_SPELL_ART_URLS = {
  thornbound: "/art/lanternwood/spell-fauna-thornbound.glb",
  stonebound: "/art/lanternwood/spell-fauna-stonebound.glb",
  galebound: "/art/lanternwood/spell-fauna-galebound.glb",
  tidebound: "/art/lanternwood/spell-fauna-tidebound.glb",
} as const satisfies Record<Exclude<FaunaSpellArt, "risen">, string>;

export function faunaArtUrl(kind: FaunaKind, art?: FaunaSpellArt): string {
  if (art && art !== "risen") return FAUNA_SPELL_ART_URLS[art];
  return FAUNA_ART_URLS[kind];
}

export function faunaSpellArt(c: { art?: string | null; name?: string | null }): FaunaSpellArt | undefined {
  if (c.art && SPELL_ART.has(c.art)) return c.art as FaunaSpellArt;
  if (c.name && ELEMENTAL_ART.has(c.name as FaunaSpellArt)) return c.name as FaunaSpellArt;
  if (c.name?.startsWith("risen ")) return "risen";
}

export function faunaArtEnabled(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("faunaArt") !== "off" && params.get("faunaArtFail") !== "1";
}
