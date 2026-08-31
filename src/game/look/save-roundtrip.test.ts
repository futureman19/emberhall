// save-roundtrip.test.ts — the treaty test: a person's look rides the save
// boundary untouched, and a lookless person loads exactly as before (parity).
// If the save validator ever tightens against optional fields, this fails LOUD.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { loadSave, writeSave } from "../save.ts";
import { createWorld } from "../world.ts";
import { LOOK_SCHEMA } from "./types.ts";

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
  }
});

test("a person's look survives writeSave -> loadSave bit-for-bit", () => {
  const w = createWorld();
  const self = w.people.find((p) => p.isPlayer)!;
  self.name = "Neris Thorn";
  self.cls = "mage";
  self.look = {
    schema: LOOK_SCHEMA,
    cls: "mage",
    skin: "#96795d",
    hairStyle: "long",
    hairColor: "#a85a42",
    garb: "#6a5a78",
    parts: ["u_test_cap"],
  };
  writeSave(w);
  const loaded = loadSave();
  assert.ok(loaded, "save should load");
  const loadedSelf = loaded!.people.find((p) => p.isPlayer)!;
  assert.equal(loadedSelf.name, "Neris Thorn");
  assert.equal(loadedSelf.cls, "mage");
  assert.deepEqual(loadedSelf.look, self.look);
});

test("parity: a lookless person loads with no look and no complaint", () => {
  const w = createWorld();
  writeSave(w);
  const loaded = loadSave();
  assert.ok(loaded, "save should load");
  const loadedSelf = loaded!.people.find((p) => p.isPlayer)!;
  assert.equal(loadedSelf.look, undefined);
});
