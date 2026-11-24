import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { actorState } from "./actor.ts";
import { emptySkills } from "./catalog.ts";
import { setWorld } from "./live.ts";
import { maxMana } from "./magery.ts";
import { commandArmTechnique } from "./techniques.ts";
import { CURRENT_SAVE_VERSION, SAVE_KEY, encodeSave, loadSave, writeSave } from "./save.ts";
import { createWorld } from "./world.ts";

const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
});
afterEach(() => {
  if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
});

function multiBody() {
  const world = createWorld();
  const person = structuredClone(world.people.find((p) => p.id === world.player.id)!);
  person.id = "second-body";
  person.isPlayer = false;
  world.people.push(person);
  const second = structuredClone(world.player);
  second.id = person.id;
  second.mana = 17;
  second.pack.log = 9;
  second.vault = 123;
  second.marks = [{ id: "second-mark", tx: 11, ty: 12, name: "Second home" }];
  world.playerStates = { [world.player.id]: world.player, [second.id]: second };
  return world;
}

function payload() {
  return JSON.parse(encodeSave(multiBody()));
}

test("live hydration defaults every saved actor sheet before explicit technique commands", () => {
  const saved = payload();
  saved.playerStates.absent = structuredClone(saved.playerStates["second-body"]);
  saved.playerStates.absent.id = "absent";
  const zeroFields = ["poisonUntil", "poisonTickAt", "blessUntil", "invisUntil", "ironwoodUntil", "flyUntil", "lastBittenAt", "lastStrikeAt"];
  for (const sheet of [saved.player, ...Object.values(saved.playerStates)] as (Record<string, unknown> & { skills: Record<string, number>; lastGain: Record<string, number>; wear: Record<string, string> })[]) {
    for (const key of [...zeroFields, "techniqueCoolUntil"]) delete sheet[key];
    delete sheet.skills.tracking;
    delete sheet.lastGain.tracking;
    sheet.wear.main = "sword";
    sheet.skills.swords = 100;
  }
  const raw = store(saved);
  const loaded = loadSave();
  assert.ok(loaded, "optional omissions remain valid save input");
  setWorld(loaded);
  assert.equal(commandArmTechnique(loaded, "lunge", "second-body"), null);
  assert.equal(loaded.player.armedTechnique, null);
  assert.equal(loaded.playerStates![loaded.player.id], loaded.player);
  for (const sheet of Object.values(loaded.playerStates!)) {
    for (const key of zeroFields) assert.equal((sheet as unknown as Record<string, unknown>)[key], 0, `${sheet.id}.${key}`);
    assert.deepEqual(sheet.techniqueCoolUntil, {});
    assert.equal(sheet.skills.tracking, emptySkills().tracking);
    assert.equal(sheet.lastGain.tracking, 0);
  }
  assert.notEqual(loaded.player.techniqueCoolUntil, loaded.playerStates!["second-body"].techniqueCoolUntil);
  assert.equal(localStorage.getItem(SAVE_KEY), raw);
});

test("live hydration preserves actor values and clamps mana using that body's intelligence", () => {
  const saved = payload();
  const second = saved.playerStates["second-body"];
  second.poisonUntil = 23;
  second.techniqueCoolUntil = { lunge: 42 };
  second.mana = 999;
  second.skills.magery = 50;
  saved.people.find((person: { id: string }) => person.id === "second-body").int = 31;
  store(saved);
  const loaded = loadSave();
  assert.ok(loaded);
  setWorld(loaded);
  const hydrated = actorState(loaded, "second-body");
  assert.equal(hydrated.mana, maxMana(31, 50));
  assert.equal(hydrated.poisonUntil, 23);
  assert.deepEqual(hydrated.techniqueCoolUntil, { lunge: 42 });
  assert.deepEqual(hydrated.marks, second.marks);
  assert.equal(hydrated.pack.log, 9);
  assert.equal(hydrated.vault, 123);
});

function store(value: unknown) {
  const raw = JSON.stringify(value);
  localStorage.setItem(SAVE_KEY, raw);
  return raw;
}

test("actor save v7 round-trips independent bodies and restores solo alias identity", () => {
  const world = multiBody();
  assert.equal(writeSave(world).ok, true);
  assert.equal(CURRENT_SAVE_VERSION, 7);
  assert.equal(SAVE_KEY, "emberhall-save-v4");
  const loaded = loadSave();
  assert.ok(loaded);
  assert.equal(actorState(loaded, loaded.player.id), loaded.player);
  assert.deepEqual(actorState(loaded, "second-body"), world.playerStates!["second-body"]);
  actorState(loaded, "second-body").pack.log = 3;
  assert.notEqual(loaded.player.pack.log, 3);
});

test("actor save v5 migration fills missing map without rewriting stored bytes", () => {
  const saved = payload();
  saved.saveVersion = 5;
  delete saved.playerStates;
  saved.player.futureOptional = { journal: ["preserve"] };
  const raw = store(saved);
  const loaded = loadSave();
  assert.ok(loaded);
  assert.equal(actorState(loaded, loaded.player.id), loaded.player);
  assert.deepEqual((loaded.player as unknown as Record<string, unknown>).futureOptional, { journal: ["preserve"] });
  assert.equal(localStorage.getItem(SAVE_KEY), raw);
});

test("actor save v5 migration preserves existing body states", () => {
  const saved = payload();
  saved.saveVersion = 5;
  const raw = store(saved);
  const loaded = loadSave();
  assert.ok(loaded);
  assert.deepEqual(loaded.playerStates!["second-body"], saved.playerStates["second-body"]);
  assert.equal(loaded.playerStates![loaded.player.id], loaded.player);
  assert.equal(localStorage.getItem(SAVE_KEY), raw);
});

test("actor save preserves sheets without currently spawned bodies", () => {
  for (const version of [5, 6]) {
    const saved = payload();
    saved.saveVersion = version;
    saved.people = saved.people.filter((person: { id: string }) => person.id !== "second-body");
    const raw = store(saved);
    const loaded = loadSave();
    assert.ok(loaded);
    assert.deepEqual(loaded.playerStates!["second-body"], saved.playerStates["second-body"]);
    assert.equal(localStorage.getItem(SAVE_KEY), raw);
  }
});

test("actor save rejects mismatched, malformed and divergent solo sheets", () => {
  for (const version of [5, 6]) {
    for (const mutate of [
      (p: ReturnType<typeof payload>) => { p.playerStates = null; },
      (p: ReturnType<typeof payload>) => { p.playerStates = []; },
      (p: ReturnType<typeof payload>) => { p.playerStates["second-body"].id = "mismatch"; },
      (p: ReturnType<typeof payload>) => { p.playerStates["second-body"].mana = "full"; },
      (p: ReturnType<typeof payload>) => { p.playerStates[p.player.id].mana += 1; },
    ]) {
      const saved = payload();
      saved.saveVersion = version;
      mutate(saved);
      const raw = store(saved);
      assert.ok(loadSave() === null);
      assert.equal(localStorage.getItem(SAVE_KEY), raw);
    }
  }
});

test("actor save refuses inherited and accessor maps without invoking getters", () => {
  let calls = 0;
  const world = multiBody();
  const second = world.playerStates!["second-body"];
  const accessor = {};
  Object.defineProperty(accessor, "second-body", { enumerable: true, get() { calls++; return second; } });
  for (const states of [accessor, Object.assign(Object.create({ inherited: second }), world.playerStates)]) {
    world.playerStates = states;
    localStorage.setItem(SAVE_KEY, "keep");
    assert.deepEqual(writeSave(world), { ok: false, reason: "invalid-state" });
    assert.equal(localStorage.getItem(SAVE_KEY), "keep");
  }
  assert.equal(calls, 0);
});
