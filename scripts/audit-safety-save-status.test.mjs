import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "../src/game/world.ts";
import { writeSave } from "../src/game/save.ts";

test("save explicitly distinguishes success, invalid state and storage failure", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let value = "previous";
  try {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: (_, next) => { value = next; } } });
    const world = createWorld();
    assert.deepEqual(writeSave(world), { ok: true });
    const good = value;
    world.gold = NaN;
    assert.deepEqual(writeSave(world), { ok: false, reason: "invalid-state" });
    assert.equal(value, good);
    world.gold = 10;
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("storage denied"); } });
    assert.deepEqual(writeSave(world), { ok: false, reason: "storage-unavailable" });
    assert.equal(value, good);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});

test("store exposes save failure and clears it only after a successful retry", async () => {
  const { useGame } = await import("../src/game/store.ts");
  const { getWorld, setWorld } = await import("../src/game/live.ts");
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const oldWorld = getWorld();
  const oldUI = useGame.getState();
  try {
    setWorld(createWorld());
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("denied"); } });
    assert.equal(useGame.getState().saveNow(), false);
    assert.match(useGame.getState().saveError, /could not be saved/);
    assert.equal(useGame.getState().toast, useGame.getState().saveError);
    useGame.setState({ toast: null });
    assert.ok(useGame.getState().saveError, "toast expiry must not erase save failure state");
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem() {} } });
    assert.equal(useGame.getState().saveNow(), true);
    assert.equal(useGame.getState().saveError, null);
  } finally {
    setWorld(oldWorld);
    useGame.setState(oldUI);
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
