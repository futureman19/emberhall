import assert from "node:assert/strict";
import test from "node:test";
import { createWorld } from "./world.ts";
import { prepareSandbox, isSandbox } from "./sandbox.ts";
import { ITEM_META, SKILL_META } from "./catalog.ts";
import { RESOURCE_CATALOG } from "./resources/catalog.ts";
import { parseResourceStackKey } from "./inventory/resources.ts";
import { SPELL_META, hasBook, maxMana } from "./magery.ts";
import { TECHNIQUES, techniqueUnlocked, type TechniqueId } from "./techniques.ts";
import { encodeSave, SAVE_KEY, SANDBOX_SAVE_KEY, writeSave, loadSave } from "./save.ts";
import { setGodOverride } from "./god.ts";
import { encodeCharacterLookInscription, encodePartInscription } from "./chain-artifacts.ts";
import { preflightItemRedeem } from "../chain/vault-preflight.ts";
import { tickMana } from "./magery.ts";
import { setWorld, getWorld } from "./live.ts";
import { encodeItemInscription } from "./vault.ts";

test("sandbox covers every catalog entry, actual cap, reagent and implemented technique; top-up is idempotent", () => {
  const w = createWorld(1);
  prepareSandbox(w);
  assert.ok(isSandbox(w));
  for (const id of Object.keys(ITEM_META)) assert.ok(w.player.pack[id as keyof typeof ITEM_META]! >= 99, id);
  for (const d of Object.values(RESOURCE_CATALOG)) for (const f of d.forms) {
    for (const q of d.qualityType === "clarity" ? ["cracked", "flawed", "cut", "flawless", "perfect"] : ["rough", "sound", "choice", "pristine"]) {
      assert.ok(w.player.resources.stacks[parseResourceStackKey(`${d.id}:${f}:${q}`)]! >= 999);
    }
  }
  for (const id of Object.keys(SKILL_META)) assert.equal(w.player.skills[id as keyof typeof SKILL_META], 100);
  for (const id of Object.keys(TECHNIQUES)) assert.ok(techniqueUnlocked(w, id as TechniqueId));
  assert.ok(hasBook(w));
  for (const spell of Object.values(SPELL_META)) {
    assert.ok(w.player.mana >= spell.mana);
    for (const reagent of spell.reagents) assert.ok(w.player.pack[reagent]! >= 99);
  }
  assert.equal(w.player.mana, maxMana(w.people.find(p => p.isPlayer)!.int, 100));
  const before = JSON.stringify(w.player);
  prepareSandbox(w);
  assert.equal(JSON.stringify(w.player), before);
  assert.equal(encodeItemInscription(w, "sword"), null);
  assert.equal(encodeCharacterLookInscription(w, w.people.find(p => p.isPlayer)!), null);
  assert.equal(encodePartInscription(w, null as never), null);
  assert.throws(() => preflightItemRedeem(w, {}), /Sandbox/);
  for (const spell of Object.keys(SPELL_META)) {
    w.player.armedSpell = spell as keyof typeof SPELL_META;
    assert.doesNotThrow(() => encodeSave(w), `saving armed ${spell}`);
  }
});

test("sandbox saves reload separately and cannot replace normal progress even after mode exit", () => {
  const storage = new Map<string, string>();
  const old = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  } });
  try {
    setGodOverride(false);
    const normal = createWorld(1);
    assert.equal(writeSave(normal).ok, true);
    const original = storage.get(SAVE_KEY);
    setGodOverride(true);
    const skills = { ...normal.player.skills };
    setWorld(normal);
    assert.deepEqual(getWorld().player.skills, skills, "another tab changing mode never grants to a normal world");
    normal.player.mana = 1;
    tickMana(normal, 0.016);
    assert.ok(normal.player.mana < 2, "normal world gets ordinary regen despite mode flag");
    const sandbox = createWorld(2);
    prepareSandbox(sandbox);
    setGodOverride(true);
    assert.equal(writeSave(sandbox).ok, true);
    assert.ok(storage.has(SANDBOX_SAVE_KEY));
    assert.ok(isSandbox(loadSave()!));
    assert.equal(storage.get(SAVE_KEY), original);
    setGodOverride(false);
    assert.equal(writeSave(sandbox).ok, true);
    assert.equal(storage.get(SAVE_KEY), original);
    assert.equal(loadSave()!.seed, normal.seed);
    const savedSandbox = storage.get(SANDBOX_SAVE_KEY)!;
    const originalSetter = localStorage.setItem;
    localStorage.setItem = () => { throw new Error("quota"); };
    assert.deepEqual(writeSave(sandbox), { ok: false, reason: "storage-unavailable" });
    assert.equal(storage.get(SAVE_KEY), original);
    assert.equal(storage.get(SANDBOX_SAVE_KEY), savedSandbox);
    localStorage.setItem = originalSetter;
    storage.set(SAVE_KEY, storage.get(SANDBOX_SAVE_KEY)!);
    assert.equal(loadSave(), null, "a sandbox payload never loads as a normal character");
  } finally {
    setGodOverride(null);
    if (old) Object.defineProperty(globalThis, "localStorage", old);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
