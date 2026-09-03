import { inBounds } from "./atlas.ts";
import { mulberry32 } from "./rng.ts";
import type { Building, BuildingKind, ClassId, Tile, World } from "./types.ts";
import { createPerson, nid } from "./world.ts";

/**
 * Kingsford — the capital. A walled ward on the vale's west road: curtain
 * wall with towers and two gatehouses, the King's keep over a cobbled
 * bailey, market row on the high street, and townhomes behind.
 *
 * Two halves:
 *  - stampCityTiles(tiles): the ground truth — streets, plaza, the wall
 *    ring (real `wall` tiles, so the ward is genuinely enclosed) and the
 *    keep's shell. Runs at the end of generateTiles so every save/load
 *    round-trip rebuilds the same city ground.
 *  - ensureCity(world): the buildings and townsfolk, idempotent, so old
 *    saves gain the capital on load.
 */

export const WARD = { x0: 152, x1: 200, z0: 310, z1: 362 };
export const CITY = { tx: 176, ty: 336 };
const WARD_H = 3;
const GATE_Z = [334, 335, 336, 337, 338];
export const KEEP = { tx: 176, ty: 320, x0: 166, x1: 186, z0: 312, z1: 327 };

function paintRoad(tiles: Tile[][], ax: number, ay: number, bx: number, by: number, w = 1) {
  const n = Math.max(1, Math.hypot(bx - ax, by - ay));
  const steps = Math.ceil(n);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t);
    for (let dy = -w; dy <= w; dy++) {
      for (let dx = -w; dx <= w; dx++) {
        if (!inBounds(x + dx, y + dy)) continue;
        const tile = tiles[y + dy]![x + dx]!;
        if (tile.kind === "water") continue;
        if (Math.abs(dx) + Math.abs(dy) > w) continue;
        tile.kind = Math.abs(dx) + Math.abs(dy) === 0 ? "road" : "dirt";
      }
    }
  }
}

function box(tiles: Tile[][], x0: number, z0: number, x1: number, z1: number, kind: Tile["kind"]) {
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBounds(x, z)) continue;
      tiles[z]![x]!.kind = kind;
    }
  }
}

export function stampCityTiles(tiles: Tile[][]): void {
  // Approach roads first — the ward stamps over whatever reaches the gates.
  paintRoad(tiles, 96, 300, WARD.x0, 336); // Millcross to the west gate
  paintRoad(tiles, WARD.x1, 336, 256, 384); // east gate to The Ford
  paintRoad(tiles, WARD.x1, 334, 256, 292); // east gate to Emberhall

  // The ward plateau: tame the wild ground, keep any road that found its way in.
  for (let z = WARD.z0; z <= WARD.z1; z++) {
    for (let x = WARD.x0; x <= WARD.x1; x++) {
      if (!inBounds(x, z)) continue;
      const t = tiles[z]![x]!;
      t.h = WARD_H;
      if (t.kind === "tree" || t.kind === "rock" || t.kind === "snow" || t.kind === "marsh" || t.kind === "sand") {
        t.kind = "grass";
      }
    }
  }
  // A gentle rim so the plateau doesn't cliff into the vale.
  for (let d = 1; d <= 3; d++) {
    for (let z = WARD.z0 - d; z <= WARD.z1 + d; z++) {
      for (let x = WARD.x0 - d; x <= WARD.x1 + d; x++) {
        if (!inBounds(x, z)) continue;
        const inside = x >= WARD.x0 - d + 1 && x <= WARD.x1 + d - 1 && z >= WARD.z0 - d + 1 && z <= WARD.z1 + d - 1;
        if (inside) continue;
        const t = tiles[z]![x]!;
        t.h = Math.max(0, Math.round(WARD_H + (t.h - WARD_H) * (d / 4)));
      }
    }
  }

  // High street (west gate to east gate), the market plaza, and the bailey.
  box(tiles, WARD.x0, 335, WARD.x1, 337, "cobble");
  box(tiles, 170, 333, 182, 339, "cobble");
  box(tiles, 168, 324, 184, 333, "cobble");

  // The curtain wall — a real wall, gates excepted.
  for (let x = WARD.x0; x <= WARD.x1; x++) {
    tiles[WARD.z0]![x]!.kind = "wall";
    tiles[WARD.z1]![x]!.kind = "wall";
  }
  for (let z = WARD.z0; z <= WARD.z1; z++) {
    tiles[z]![WARD.x0]!.kind = "wall";
    tiles[z]![WARD.x1]!.kind = "wall";
  }
  for (const z of GATE_Z) {
    tiles[z]![WARD.x0]!.kind = "cobble";
    tiles[z]![WARD.x1]!.kind = "cobble";
  }

  // The keep's shell: stone walls you cannot walk through, a floor within,
  // and a three-wide door off the bailey's south face.
  for (let z = KEEP.z0; z <= KEEP.z1; z++) {
    for (let x = KEEP.x0; x <= KEEP.x1; x++) {
      const edge = x === KEEP.x0 || x === KEEP.x1 || z === KEEP.z0 || z === KEEP.z1;
      tiles[z]![x]!.kind = edge ? "wall" : "floor";
    }
  }
  for (let x = KEEP.tx - 1; x <= KEEP.tx + 1; x++) tiles[KEEP.z1]![x]!.kind = "cobble";
}

interface CityBuilding {
  kind: BuildingKind;
  tx: number;
  ty: number;
}

const RAMP_X = [156, 164, 172, 180, 188, 196];
const RAMP_Z = [314, 322, 330, 342, 350, 358];

function cityBuildings(): CityBuilding[] {
  const out: CityBuilding[] = [{ kind: "keep", tx: KEEP.tx, ty: KEEP.ty }];
  for (const x of RAMP_X) {
    out.push({ kind: "rampart", tx: x, ty: WARD.z0 });
    out.push({ kind: "rampart", tx: x, ty: WARD.z1 });
  }
  for (const z of RAMP_Z) {
    out.push({ kind: "rampartV", tx: WARD.x0, ty: z });
    out.push({ kind: "rampartV", tx: WARD.x1, ty: z });
  }
  out.push(
    { kind: "tower", tx: WARD.x0, ty: WARD.z0 },
    { kind: "tower", tx: WARD.x1, ty: WARD.z0 },
    { kind: "tower", tx: WARD.x0, ty: WARD.z1 },
    { kind: "tower", tx: WARD.x1, ty: WARD.z1 },
    { kind: "gatehouse", tx: WARD.x0, ty: 336 },
    { kind: "gatehouse", tx: WARD.x1, ty: 336 },
    // The bailey and market row.
    { kind: "notice", tx: 166, ty: 331 },
    { kind: "market", tx: 170, ty: 343 },
    { kind: "shop", tx: 182, ty: 343 },
    { kind: "forge", tx: 192, ty: 344 },
    { kind: "tavern", tx: 160, ty: 345 },
    // North quarter homes.
    { kind: "townhome", tx: 162, ty: 330 },
    { kind: "townhouse", tx: 190, ty: 330 },
    { kind: "cottage", tx: 157, ty: 326 },
    { kind: "townhome", tx: 193, ty: 324 },
    // South quarter homes.
    { kind: "cottage", tx: 166, ty: 352 },
    { kind: "townhome", tx: 176, ty: 354 },
    { kind: "townhouse", tx: 186, ty: 353 },
    { kind: "cottage", tx: 195, ty: 349 },
  );
  return out;
}

interface CitySoul {
  x: number;
  z: number;
  cls: ClassId;
  role?: "banker" | "provisioner" | "healer";
  name: string;
}

const CITY_SOULS: CitySoul[] = [
  { x: 178, z: 339, cls: "merchant", role: "banker", name: "Odo Goldhand" },
  { x: 170, z: 342, cls: "merchant", role: "provisioner", name: "Wren Hall" },
  { x: 181, z: 333, cls: "mage", role: "healer", name: "Sister Anselm" },
  { x: 192, z: 343, cls: "warrior", name: "Baldric Smith" },
  { x: 160, z: 344, cls: "merchant", name: "Maeb Oakley" },
  { x: 166, z: 330, cls: "rogue", name: "Tam Crier" },
  { x: 154, z: 336, cls: "warrior", name: "Hodge Ward" },
  { x: 198, z: 336, cls: "warrior", name: "Lysa Ward" },
  { x: 168, z: 336, cls: "merchant", name: "Pip Farthing" },
  { x: 184, z: 337, cls: "ranger", name: "Nell Brook" },
  { x: 173, z: 345, cls: "merchant", name: "Cobb Alder" },
  { x: 188, z: 340, cls: "rogue", name: "Fenn Lark" },
  { x: 160, z: 339, cls: "ranger", name: "Greta Moss" },
  { x: 195, z: 334, cls: "merchant", name: "Simm Vale" },
];

/** Snap the keep (and Anselm) onto the massive shell so old halls pick it up. */
export function ensureKeepSite(world: World) {
  const keep = world.buildings.find((b) => b.kind === "keep");
  if (keep) {
    keep.tx = KEEP.tx;
    keep.ty = KEEP.ty;
  }
  const anselm = world.people.find((p) => p.name === "Sister Anselm");
  if (anselm && anselm.z <= KEEP.z1) {
    anselm.x = 181;
    anselm.z = 333;
    anselm.path = [];
    anselm.home = { tx: 181, ty: 333 };
  }
}
export function ensureCity(world: World): void {
  if (world.buildings.some((b) => b.kind === "keep")) {
    ensureKeepSite(world);
    return;
  }
  for (const b of cityBuildings()) {
    const rec: Building = { id: nid(world, "b"), kind: b.kind, tx: b.tx, ty: b.ty, beds: [] };
    world.buildings.push(rec);
  }
  const rng = mulberry32(world.seed + 1337);
  for (const s of CITY_SOULS) {
    world.people.push(createPerson(world, rng, { x: s.x, z: s.z, cls: s.cls, role: s.role, name: s.name }));
  }
}
