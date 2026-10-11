import assert from "node:assert/strict";
import test from "node:test";
import {
  HOTBAR_SLOTS,
  loadHotbar,
  pinItem,
  saveHotbar,
  unpinItem,
} from "./hotbar-dock.ts";
import type { ItemId } from "../../../game/types.ts";

// A storage test-double — the dock never touches window directly in tests.
function memStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

test("hotbar - pin appends, dedupes, and stops at the slot limit", () => {
  let ids: ItemId[] = [];
  ids = pinItem(ids, "hatchet");
  ids = pinItem(ids, "sword");
  assert.deepEqual(ids, ["hatchet", "sword"]);
  ids = pinItem(ids, "hatchet");
  assert.deepEqual(ids, ["hatchet", "sword"], "no duplicates");
  for (const id of ["pick", "bow", "torch", "staff", "club", "mace"]) ids = pinItem(ids, id);
  assert.equal(ids.length, HOTBAR_SLOTS, "full at the slot cap");
  const after = pinItem(ids, "hoe");
  assert.equal(after.length, HOTBAR_SLOTS, "cap holds");
  assert.ok(!after.includes("hoe"));
});

test("hotbar - pin rejects ids that are not items", () => {
  assert.deepEqual(pinItem([], "dragon_lance"), []);
});

test("hotbar - unpin removes and keeps order", () => {
  const ids: ItemId[] = ["hatchet", "sword", "torch"];
  assert.deepEqual(unpinItem(ids, "sword"), ["hatchet", "torch"]);
  assert.deepEqual(unpinItem(ids, "hoe"), ["hatchet", "sword", "torch"]);
});

test("hotbar - load tolerates junk: bad JSON, unknown ids, over-cap", () => {
  const storage = memStorage();
  assert.deepEqual(loadHotbar(storage), [], "empty storage");
  storage.setItem("emberhall-hotbar-v1", "not json{");
  assert.deepEqual(loadHotbar(storage), [], "bad json falls back");
  storage.setItem("emberhall-hotbar-v1", JSON.stringify(["hatchet", "dragon_lance", "torch"]));
  assert.deepEqual(loadHotbar(storage), ["hatchet", "torch"], "unknown ids filtered");
  storage.setItem("emberhall-hotbar-v1", JSON.stringify(["hatchet", "sword", "pick", "bow", "torch", "staff", "club", "mace", "hoe"]));
  assert.equal(loadHotbar(storage).length, HOTBAR_SLOTS, "over-cap loads truncated");
});

test("hotbar - save/load roundtrip", () => {
  const storage = memStorage();
  saveHotbar(storage, ["hatchet", "potion_heal"]);
  assert.deepEqual(loadHotbar(storage), ["hatchet", "potion_heal"]);
});
