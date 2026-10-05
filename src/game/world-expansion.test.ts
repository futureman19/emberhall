import test from "node:test";
import assert from "node:assert/strict";
import { MAP, COURT, placeById } from "./atlas.ts";
import { generateTiles } from "./world.ts";
import { astar, walkable } from "./pathfinding.ts";
import type { World } from "./types.ts";

test("frontier sites have clear named approaches connected by traversable roads", async () => {
  const { FRONTIER_SITES, FRONTIER_ROUTES, FRONTIER_ART, sceneryBlocked } =
    await import("./frontier.ts");
  const world = { tiles: generateTiles(7) } as World;
  assert.equal(new Set(FRONTIER_ART.map((p) => p.family)).size, 7);
  for (const site of FRONTIER_SITES) {
    assert.ok(placeById(site.id));
    assert.ok(walkable(world, site.tx, site.ty), site.id);
  }
  for (const [a, b] of FRONTIER_ROUTES) {
    const from = placeById(a),
      to = placeById(b);
    assert.ok(astar(world, from.tx, from.ty, to.tx, to.ty, 48000), `${a} -> ${b}`);
  }
  assert.ok(!sceneryBlocked(900, 265), "camp entrance corridor remains open");
  assert.ok(sceneryBlocked(900, 257), "tent is solid");
  assert.ok(sceneryBlocked(760, 549), "mine mouth is sealed");
  assert.ok(!sceneryBlocked(560, 557), "shrine approach remains open");
});

test("scenery is deterministic, seated on flat clear pads and queried in bounded chunks", async () => {
  const { FRONTIER_ART, visibleFrontierArt } = await import("./frontier.ts");
  const tiles = generateTiles(7);
  for (const p of FRONTIER_ART) {
    assert.ok(p.x >= 512 || p.z >= 512);
    assert.equal(tiles[p.z]![p.x]!.h, 4);
    assert.notEqual(tiles[p.z]![p.x]!.kind, "tree");
  }
  assert.deepEqual(visibleFrontierArt(560, 268), visibleFrontierArt(560, 268));
  assert.ok(visibleFrontierArt(256, 292).length === 0);
  assert.ok(visibleFrontierArt(560, 268).length < FRONTIER_ART.length);
});

test("chart-scale routes reach every frontier marker from the retained spawn", async () => {
  const { createWorld } = await import("./world.ts");
  const { setWorld } = await import("./live.ts");
  const { FRONTIER_SITES } = await import("./frontier.ts");
  const random = Math.random;
  let world;
  try {
    Math.random = () => 7 / 1e9;
    world = createWorld();
  } finally {
    Math.random = random;
  }
  setWorld(world);
  assert.ok(world.herbs.every(h => h.tx < 512 && h.ty < 512), "existing herb populations stay in the retained vale");
  for (const site of FRONTIER_SITES) {
    assert.ok(astar(world, 256, 293, site.tx, site.ty, 48000), site.id);
    assert.ok(astar(world, site.tx, site.ty, 256, 292, 48000), `${site.id} return`);
  }
});

test("v4 tile-free saves expand without rewriting storage or losing appearance, state or scars", async () => {
  const { createWorld } = await import("./world.ts");
  const { loadSave, writeSave, SAVE_KEY } = await import("./save.ts");
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
  });
  try {
    const w = createWorld();
    w.people[0]!.look = {
      schema: "emberhall.look/1",
      skin: "#96795d",
      hairStyle: "crop",
      garb: "#526b54",
    };
    w.gold = 321;
    w.scars["270,320"] = { h: 2, kind: "dirt" };
    writeSave(w);
    const raw = storage.get(SAVE_KEY)!;
    assert.equal(JSON.parse(raw).tiles, null);
    const loaded = loadSave()!;
    assert.ok(loaded);
    assert.equal(loaded.tiles.length, MAP);
    assert.equal(storage.get(SAVE_KEY), raw, "loading never rewrites the existing save");
    assert.deepEqual(loaded.people, w.people);
    assert.deepEqual(loaded.buildings, w.buildings);
    assert.deepEqual(loaded.player, w.player);
    assert.equal(loaded.gold, 321);
    assert.deepEqual(loaded.tiles[320]![270], { h: 2, kind: "dirt" });
    loaded.people[0]!.x = 1020;
    loaded.people[0]!.z = 1000;
    writeSave(loaded);
    assert.equal(loadSave()!.people[0]!.x, 1020);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

test("mill watercourse is blocked except the connected stepping-stone ford", () => {
  const world = { tiles: generateTiles(7) } as World;
  assert.equal(world.tiles[546]![951]!.kind, "water");
  assert.equal(walkable(world, 951, 546), false);
  assert.equal(walkable(world, 951, 560), true);
  assert.ok(astar(world, 945, 560, 957, 560));
});

test("frontier climates match the authored regions", async () => {
  const { biomeAt } = await import("./biome.ts");
  assert.equal(biomeAt(720, 268), "tundra");
  assert.equal(biomeAt(560, 552), "taiga");
  assert.equal(biomeAt(960, 552), "fen");
});

test("map grows to the nearest square grid to five times the original area", () => {
  assert.equal(MAP, Math.round(Math.sqrt(5) * 512));
  assert.ok(Math.abs(MAP * MAP - 5 * 512 * 512) <= MAP);
  assert.deepEqual(COURT, { tx: 256, ty: 292 });
  assert.equal(placeById("ironfold").tx, 420);
  const tiles = generateTiles(7);
  assert.equal(tiles.length, MAP);
  assert.equal(tiles[MAP - 1]!.length, MAP);
});
