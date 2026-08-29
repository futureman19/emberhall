import type { Tile } from "./types";

export const MAP = 512;
export const TILE = 1;
export const EH = 0.2;
export const VIEW = 128;
export const CHUNK = 8;

export const COURT = { tx: 256, ty: 292 };
export const GATE = { tx: 256, ty: 312 };

export type PlaceKind = "town" | "woods" | "mine" | "ford" | "ruins" | "ridge" | "water";

export interface Place {
  id: string;
  name: string;
  tx: number;
  ty: number;
  radius: number;
  kind: PlaceKind;
  blurb: string;
}

export const PLACES: Place[] = [
  { id: "emberhall", name: "Emberhall", tx: 256, ty: 292, radius: 8, kind: "town", blurb: "Your hall. The only bed that is yours." },
  { id: "oakstand", name: "Oakstand", tx: 248, ty: 148, radius: 28, kind: "woods", blurb: "Old oaks. Wolves own the night." },
  { id: "wolfhollow", name: "Wolfhollow", tx: 188, ty: 88, radius: 18, kind: "woods", blurb: "Pine and shadow. Wolves own the stand." },
  { id: "ridgewatch", name: "Ridgewatch", tx: 250, ty: 48, radius: 16, kind: "ridge", blurb: "The north wall. Snow on the height." },
  { id: "hearthfen", name: "Hearthfen", tx: 400, ty: 168, radius: 8, kind: "town", blurb: "Peat smoke and wet marsh." },
  { id: "ironfold", name: "Ironfold", tx: 420, ty: 268, radius: 18, kind: "mine", blurb: "The east slope. Iron in the bone of the hill." },
  { id: "millcross", name: "Millcross", tx: 96, ty: 300, radius: 8, kind: "town", blurb: "A mill and a stall. Brann's cousins." },
  { id: "cairnash", name: "Cairn of Ash", tx: 64, ty: 96, radius: 14, kind: "ruins", blurb: "A ring of burnt stone. Do not sleep here." },
  { id: "ford", name: "The Ford", tx: 256, ty: 384, radius: 7, kind: "ford", blurb: "The river is shallow here. Nowhere else." },
  { id: "greybarrow", name: "Greybarrow", tx: 110, ty: 440, radius: 14, kind: "ruins", blurb: "A sunken tomb. Stairs under the stones." },
  { id: "southmere", name: "Southmere", tx: 360, ty: 460, radius: 9, kind: "town", blurb: "Warm reeds and a thick green." },
  { id: "brinegate", name: "Brinegate", tx: 470, ty: 420, radius: 8, kind: "town", blurb: "Salt air. Sand takes the east." },
];

export function placeById(id: string) {
  return PLACES.find((p) => p.id === id)!;
}

export const BARROW = {
  cx: 110,
  cy: 440,
  mouth: { tx: 110, ty: 428 },
  relic: { tx: 110, ty: 444 },
};

export function inGreybarrow(tx: number, ty: number) {
  return tx >= 106 && tx <= 114 && ty >= 432 && ty <= 447;
}

export interface Station {
  id: string;
  name: string;
  placeId: string;
  tx: number;
  ty: number;
  blurb: string;
}

export const STATIONS: Station[] = [
  { id: "emberhall", name: "Emberhall", placeId: "emberhall", tx: 261, ty: 304, blurb: "The hall's own ring. East of the steps." },
  { id: "millcross", name: "Millcross", placeId: "millcross", tx: 102, ty: 306, blurb: "West mill and stall." },
  { id: "southmere", name: "Southmere", placeId: "southmere", tx: 366, ty: 454, blurb: "Reeds and the south water." },
  { id: "brinegate", name: "Brinegate", placeId: "brinegate", tx: 464, ty: 414, blurb: "Salt air." },
  { id: "hearthfen", name: "Hearthfen", placeId: "hearthfen", tx: 406, ty: 174, blurb: "Peat smoke." },
  { id: "ironfold", name: "Ironfold", placeId: "ironfold", tx: 414, ty: 274, blurb: "The east slope." },
  { id: "ridgewatch", name: "Ridgewatch", placeId: "ridgewatch", tx: 256, ty: 58, blurb: "The north wall of the vale." },
  { id: "cairnash", name: "Cairn of Ash", placeId: "cairnash", tx: 64, ty: 96, blurb: "Burnt stone. The dark ring." },
];

export function stationById(id: string) {
  return STATIONS.find((s) => s.id === id) ?? null;
}

export function stationNear(x: number, z: number, r = 0.9) {
  return STATIONS.find((s) => Math.hypot(s.tx - x, s.ty - z) < r) ?? null;
}

export function regionAt(tx: number, ty: number) {
  let best = PLACES[0]!;
  let d = Infinity;
  for (const p of PLACES) {
    const dd = Math.hypot(p.tx - tx, p.ty - ty);
    if (dd < d) {
      d = dd;
      best = p;
    }
  }
  return best;
}

export const ROADS: [string, string][] = [
  ["emberhall", "oakstand"],
  ["oakstand", "ridgewatch"],
  ["oakstand", "wolfhollow"],
  ["emberhall", "ironfold"],
  ["emberhall", "millcross"],
  ["emberhall", "ford"],
  ["ford", "southmere"],
  ["southmere", "brinegate"],
  ["emberhall", "hearthfen"],
  ["millcross", "cairnash"],
  ["ford", "greybarrow"],
];

export function inBounds(tx: number, ty: number) {
  return tx >= 0 && ty >= 0 && tx < MAP && ty < MAP;
}

export function tileAt(tiles: Tile[][], tx: number, ty: number) {
  if (!inBounds(tx, ty)) return null;
  return tiles[ty]?.[tx] ?? null;
}
