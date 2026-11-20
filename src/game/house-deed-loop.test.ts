import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { COURT } from "./atlas.ts";
import { ITEM_META, emptyChest } from "./catalog.ts";
import {
  HOUSE_DEEDS,
  commandHouseItem,
  ensureLookHut,
  houseSiteError,
  placeHouse,
  playerHouse,
} from "./house.ts";
import { setWorld, snapshot } from "./live.ts";
import { takeFromPile } from "./piles.ts";
import { you } from "./player.ts";
import { SAVE_KEY, encodeSave, loadSave } from "./save.ts";
import { createWorld } from "./world.ts";
import type { HouseKind } from "./house.ts";
import type { ItemId, World } from "./types.ts";

/** A live vale: createWorld + setWorld, exactly the path every real session takes. */
function liveVale(): World {
  const world = createWorld();
  setWorld(world);
  return world;
}

function previewOf(world: World) {
  return world.buildings.find((b) => b.preview === true) ?? null;
}

function grassPlot(world: World) {
  const p = you(world)!;
  const tx = Math.round(p.x) + 12;
  const ty = Math.round(p.z) + 12;
  for (let z = ty - 6; z <= ty + 6; z++) {
    for (let x = tx - 6; x <= tx + 6; x++) {
      const tile = world.tiles[z]?.[x];
      if (tile) tile.kind = "grass";
    }
  }
  p.x = tx;
  p.z = ty;
  p.path = [];
  return { tx, ty };
}

function withDeed(world: World, kind: HouseKind) {
  world.player.pack[HOUSE_DEEDS[kind]] = 1;
}

function standAt(world: World, tx: number, ty: number) {
  const p = you(world)!;
  p.x = tx;
  p.z = ty;
  p.path = [];
}

class MemoryStorage {
  #values = new Map<string, string>();
  getItem(key: string) {
    return this.#values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.#values.set(key, String(value));
  }
  removeItem(key: string) {
    this.#values.delete(key);
  }
}

const originalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
});

afterEach(() => {
  if (originalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalStorageDescriptor);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
});

test("deed loop - a live vale previews a hut, yet the porch deed still places", () => {
  const world = liveVale();
  const preview = previewOf(world);
  assert.ok(preview, "the live vale must seed the look-hut preview");
  assert.equal(preview.kind, "hut");
  assert.equal(preview.ownerId, world.player.id);
  assert.equal(playerHouse(world), null, "a preview is not a kept house");

  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(houseSiteError(world, "porch", tx, ty), null);
  assert.equal(placeHouse(world, "porch", tx, ty), null);

  assert.equal(previewOf(world), null, "the preview must be gone once the deed house stands");
  assert.equal(world.buildings.some((b) => b.id === preview.id), false);
  const house = playerHouse(world);
  assert.ok(house);
  assert.equal(house.kind, "porch");
  assert.equal(house.preview, false);
  assert.equal(world.player.pack.deed_porch, 0);
  assert.equal(placeHouse(world, "porch", tx + 8, ty), "You already have a house.");
});

test("deed loop - preview chest goods move into the new house chest", () => {
  const world = liveVale();
  const preview = previewOf(world)!;
  standAt(world, preview.tx, preview.ty);
  world.player.pack.log = 5;
  world.player.pack.board = 3;
  world.player.pack.ore = 2;
  assert.equal(commandHouseItem(world, preview.id, "log", 5), "Into the chest.");
  assert.equal(commandHouseItem(world, preview.id, "board", 3), "Into the chest.");
  assert.equal(commandHouseItem(world, preview.id, "ore", 2), "Into the chest.");

  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(placeHouse(world, "porch", tx, ty), null);

  const house = playerHouse(world)!;
  assert.equal(house.chest?.log, 5);
  assert.equal(house.chest?.board, 3);
  assert.equal(house.chest?.ore, 2);
  assert.equal(world.player.pack.log ?? 0, 0);
  assert.equal(world.player.pack.board ?? 0, 0);
  assert.equal(world.player.pack.ore ?? 0, 0);
  assert.equal(world.buildings.some((b) => b.id === preview.id), false);
});

test("deed loop - a deed may replace the look-hut on its own footprint", () => {
  const world = liveVale();
  const preview = previewOf(world)!;
  standAt(world, preview.tx, preview.ty);
  world.player.pack.board = 2;
  assert.equal(commandHouseItem(world, preview.id, "board", 2), "Into the chest.");
  withDeed(world, "porch");
  assert.equal(houseSiteError(world, "porch", preview.tx, preview.ty), null);
  assert.equal(placeHouse(world, "porch", preview.tx, preview.ty), null);

  assert.equal(previewOf(world), null);
  const house = playerHouse(world)!;
  assert.equal(house.kind, "porch");
  assert.equal(house.tx, preview.tx);
  assert.equal(house.ty, preview.ty);
  assert.equal(house.chest?.board, 2);
});

test("deed loop - chest overflow beyond eight kinds lands in the pack", () => {
  const world = liveVale();
  const preview = previewOf(world)!;
  // Fixture: a legacy/godmode chest can hold more kinds than the native eight-slot
  // command allows; write it directly to exercise the overflow boundary.
  const ids = (Object.keys(ITEM_META) as ItemId[]).slice(0, 9);
  preview.chest = emptyChest();
  for (const id of ids) preview.chest[id] = 1;
  const packBefore = world.player.pack[ids[8]!] ?? 0;

  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(placeHouse(world, "porch", tx, ty), null);

  const house = playerHouse(world)!;
  for (const id of ids.slice(0, 8)) assert.equal(house.chest?.[id], 1, `${id} fits the chest`);
  assert.equal(house.chest?.[ids[8]!] ?? 0, 0);
  assert.equal(world.player.pack[ids[8]!], packBefore + 1, "the ninth kind overflows to the pack");
});

test("deed loop - a pack stack that cannot be accepted falls back to a ground pile", () => {
  const world = liveVale();
  const preview = previewOf(world)!;
  const ids = (Object.keys(ITEM_META) as ItemId[]).slice(0, 9);
  preview.chest = emptyChest();
  for (const id of ids) preview.chest[id] = 1;
  const refused = ids[8]!;
  // Defensive fixture: simulate a pack that refuses the stack (a future cap or a
  // sealed record). The goods must stay recoverable on the ground, never vanish.
  Object.defineProperty(world.player.pack, refused, {
    configurable: true,
    get: () => 0,
    set: () => {},
  });

  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(placeHouse(world, "porch", tx, ty), null);

  const pile = world.piles.find((p) => p.tx === preview.tx && p.ty === preview.ty);
  assert.ok(pile, "overflow the pack refuses must land at the old hut spot");
  assert.equal(pile.items[refused], 1);
  assert.equal(pile.source, "drop");
  assert.ok(pile.until > world.hour);
  const house = playerHouse(world)!;
  for (const id of ids.slice(0, 8)) assert.equal(house.chest?.[id], 1);
});

test("deed loop - preview chest gold keeps into the new house", () => {
  const world = liveVale();
  const preview = previewOf(world)!;
  preview.chestGold = 7;
  const { tx, ty } = grassPlot(world);
  withDeed(world, "hut");
  assert.equal(placeHouse(world, "hut", tx, ty), null);
  const house = playerHouse(world)!;
  assert.equal(house.chestGold, 7);
  assert.equal(previewOf(world), null);
});

test("deed loop - ensureLookHut is idempotent and skips a real house", () => {
  const world = liveVale();
  const preview = previewOf(world)!;
  const count = world.buildings.length;
  ensureLookHut(world);
  ensureLookHut(world);
  assert.equal(world.buildings.length, count);
  assert.equal(previewOf(world)?.id, preview.id);

  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(placeHouse(world, "porch", tx, ty), null);
  ensureLookHut(world);
  snapshot(world);
  assert.equal(previewOf(world), null, "no preview may return while a real house stands");
  assert.equal(world.buildings.filter((b) => b.kind === "porch").length, 1);
});

test("deed loop - an old save without the preview flag loads and completes the loop", () => {
  const world = liveVale();
  const preview = previewOf(world)!;
  const payload = JSON.parse(encodeSave(world)) as { buildings: Array<Record<string, unknown>> };
  for (const b of payload.buildings) delete b.preview; // old saves predate the flag
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));

  const loaded = loadSave();
  assert.ok(loaded, "the legacy save must load");
  setWorld(loaded);
  const restored = previewOf(loaded);
  assert.ok(restored, "the legacy look-hut must be recognized as the preview");
  assert.equal(restored.id, preview.id);
  assert.equal(playerHouse(loaded), null);

  const { tx, ty } = grassPlot(loaded);
  withDeed(loaded, "porch");
  assert.equal(placeHouse(loaded, "porch", tx, ty), null);
  assert.equal(previewOf(loaded), null);
  assert.equal(playerHouse(loaded)?.kind, "porch");
});

test("deed loop - a placed deed house survives the save roundtrip without a new preview", () => {
  const world = liveVale();
  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(placeHouse(world, "porch", tx, ty), null);

  localStorage.setItem(SAVE_KEY, encodeSave(world));
  const loaded = loadSave();
  assert.ok(loaded);
  setWorld(loaded);
  assert.equal(previewOf(loaded), null);
  const house = playerHouse(loaded);
  assert.ok(house);
  assert.equal(house.kind, "porch");
  assert.equal(house.preview, false);
});

test("deed loop - a stranger's hut is never claimed or cleared by the deed", () => {
  const world = liveVale();
  const preview = previewOf(world)!;
  preview.ownerId = "someone-else";
  preview.chest = emptyChest();
  preview.chest.log = 4;

  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(placeHouse(world, "porch", tx, ty), null);
  const stranger = world.buildings.find((b) => b.id === preview.id);
  assert.ok(stranger, "a stranger's building must survive the player's deed");
  assert.equal(stranger.ownerId, "someone-else");
  assert.equal(stranger.chest?.log, 4);
});

test("deed loop - a legacy real hut away from the look spots stays a real house", () => {
  const world = liveVale();
  world.buildings = world.buildings.filter((b) => !b.preview);
  world.buildings.push({
    id: "legacy-real",
    kind: "hut",
    tx: COURT.tx + 40,
    ty: COURT.ty + 40,
    beds: [],
    ownerId: world.player.id,
    chest: emptyChest(),
    chestGold: 0,
  });
  setWorld(world);
  const house = playerHouse(world);
  assert.ok(house, "an unflagged hut off the look spots must default to a real house");
  assert.equal(house.id, "legacy-real");
  assert.equal(house.preview, false);
  assert.equal(previewOf(world), null);
  withDeed(world, "porch");
  const { tx, ty } = grassPlot(world);
  assert.equal(placeHouse(world, "porch", tx, ty), "You already have a house.");
});

test("deed loop - takeFromPile still recovers spilled hut goods", () => {
  const world = liveVale();
  const preview = previewOf(world)!;
  const ids = (Object.keys(ITEM_META) as ItemId[]).slice(0, 9);
  preview.chest = emptyChest();
  for (const id of ids) preview.chest[id] = 1;
  const refused = ids[8]!;
  Object.defineProperty(world.player.pack, refused, {
    configurable: true,
    get: () => 0,
    set: () => {},
  });
  const { tx, ty } = grassPlot(world);
  withDeed(world, "porch");
  assert.equal(placeHouse(world, "porch", tx, ty), null);
  const pile = world.piles.find((p) => p.tx === preview.tx && p.ty === preview.ty)!;
  // Restore a writable pack, then lift the pile natively.
  delete (world.player.pack as Record<string, unknown>)[refused];
  assert.equal(takeFromPile(world, pile.id), null);
  assert.equal(world.player.pack[refused], 1);
});