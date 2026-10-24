import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as sfx from "../src/game/vale-sfx.ts";
import { syncMonsterAudio, syncDungeonAudio } from "../src/game/emberdeep-audio.ts";

const instances = [];
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, v),
};
globalThis.Audio = class {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.volume = 1;
    this.currentTime = 0;
    instances.push(this);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
};
const played = () => instances.filter((a) => !a.paused);
const reset = () => {
  storage.clear();
  for (const a of instances) a.pause();
};
const kinds = ["slag_golem", "embercrawler", "gloomwraith"];
const fixture = (kind) => ({
  people: [{ isPlayer: true, x: 1038, z: 677 }],
  fauna: [{ id: "test", kind, x: 1038, z: 674, hp: 100, task: "idle" }],
  emberdeep: { bossDoorOpen: false },
});

test("every SfxId has exactly one existing source; new pack is small", () => {
  const text = fs.readFileSync("src/game/vale-sfx.ts", "utf8");
  const union = text.split("export type SfxId =")[1].split(";")[0];
  const ids = [...union.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(Object.keys(sfx.SFX_SOURCES).sort(), ids.sort());
  for (const [id, path] of Object.entries(sfx.SFX_SOURCES)) {
    assert(fs.statSync(`public${path}`).size > 0, id);
  }
  for (const id of [
    ...kinds.flatMap((k) => ["aggro", "attack", "hit", "death"].map((e) => `${k}_${e}`)),
    "emberdeep_ambience",
    "emberdeep_door",
  ]) {
    assert(sfx.SFX_SOURCES[id], id);
    assert(fs.statSync(`public${sfx.SFX_SOURCES[id]}`).size < 200000, id);
  }
});
test("muting immediately stops pooled shots, rain and dungeon loop; blocks new audio", async () => {
  reset();
  sfx.playSfx("slag_golem_attack");
  sfx.setRainLevel(1);
  sfx.setDungeonAmbience(true);
  await Promise.resolve();
  assert(played().length >= 3);
  assert.equal(sfx.toggleSfx(), true);
  assert.equal(played().length, 0);
  sfx.playSfx("gloomwraith_death");
  sfx.setDungeonAmbience(true);
  sfx.setRainLevel(1);
  assert.equal(played().length, 0);
  assert.equal(sfx.toggleSfx(), false);
  sfx.setDungeonAmbience(true);
  assert.equal(played().length, 1);
  sfx.setDungeonAmbience(false);
  assert.equal(played().length, 0);
});
test("zone loop reused, exit stops, door transition plays once, load does not rumble", async () => {
  reset();
  const w = fixture("slag_golem");
  syncDungeonAudio(w);
  await Promise.resolve();
  const loop = played()[0];
  assert(loop.loop);
  syncDungeonAudio(w);
  assert.equal(played().length, 1);
  w.emberdeep.bossDoorOpen = true;
  syncDungeonAudio(w);
  assert(played().some((a) => a.src.endsWith("emberdeep-door.mp3")));
  const count = instances.length;
  syncDungeonAudio(w);
  assert.equal(instances.length, count);
  w.people[0].x = 650;
  syncDungeonAudio(w);
  assert(loop.paused);
  reset();
  const loaded = fixture("slag_golem");
  loaded.emberdeep.bossDoorOpen = true;
  syncDungeonAudio(loaded);
  assert.equal(played().length, 1);
});
for (const kind of kinds)
  test(`${kind}: pull once, strike once, hit, death once; muted history not replayed`, () => {
    reset();
    const w = fixture(kind),
      c = w.fauna[0];
    syncMonsterAudio(w);
    assert.equal(played().length, 0);
    c.task = "fight";
    syncMonsterAudio(w);
    assert(played().some((a) => a.src.endsWith(`${kind.replaceAll("_", "-")}-aggro.mp3`)));
    const field = kind === "slag_golem" ? "monster" : kind === "embercrawler" ? "crawler" : "gloom";
    c[field] = {
      phase: kind === "slag_golem" ? "strike" : kind === "embercrawler" ? "lunge" : "bolt",
    };
    syncMonsterAudio(w);
    assert(played().some((a) => a.src.endsWith(`${kind.replaceAll("_", "-")}-attack.mp3`)));
    const n = played().length;
    syncMonsterAudio(w);
    assert.equal(played().length, n);
    c.hp = 50;
    syncMonsterAudio(w);
    assert(played().some((a) => a.src.endsWith(`${kind.replaceAll("_", "-")}-hit.mp3`)));
    c.hp = 0;
    c.task = "dead";
    syncMonsterAudio(w);
    assert(played().some((a) => a.src.endsWith(`${kind.replaceAll("_", "-")}-death.mp3`)));
    const dead = played().length;
    syncMonsterAudio(w);
    assert.equal(played().length, dead);
    reset();
    const m = fixture(kind);
    syncMonsterAudio(m);
    sfx.toggleSfx();
    m.fauna[0].task = "fight";
    syncMonsterAudio(m);
    sfx.toggleSfx();
    syncMonsterAudio(m);
    assert.equal(played().length, 0);
  });
test("warming does not play before a user gesture and rejected playback is handled", async () => {
  reset();
  sfx.warmSfx();
  assert.equal(played().length, 0);
  const original = globalThis.Audio.prototype.play;
  globalThis.Audio.prototype.play = () =>
    Promise.reject(new DOMException("gesture needed", "NotAllowedError"));
  try {
    sfx.playSfx("slag_golem_attack");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(played().length, 0);
  } finally {
    globalThis.Audio.prototype.play = original;
  }
});

test("remote monsters and loaded corpses are silent", () => {
  reset();
  const w = fixture("slag_golem");
  w.fauna[0].task = "dead";
  w.fauna[0].hp = 0;
  syncMonsterAudio(w);
  assert.equal(played().length, 0);
  const r = fixture("embercrawler");
  syncMonsterAudio(r);
  r.people[0].x = 650;
  r.fauna[0].task = "fight";
  syncMonsterAudio(r);
  assert.equal(played().length, 0);
});
