import assert from "node:assert/strict";
import { test } from "node:test";
import { mulberry32 } from "../rng.ts";
import { setWorld } from "../live.ts";
import type { Intent, IntentKind } from "../types.ts";
import { createPerson } from "../world.ts";
import { candidatesForPlayer } from "./candidates.ts";
import * as candidateApi from "./candidates.ts";
import * as observationApi from "./observe.ts";
import { verbsFor } from "../context.ts";
import { buildCourtMorning } from "./fixtures/court-morning.ts";
import { submitIntent, validateIntent } from "./intent.ts";
import { createDecisionLog, hashObservation } from "./log.ts";
import { bodySheet, observeWorld } from "./observe.ts";
import { answerChoice, answerNoul, choice, normalize, noul, topPick } from "./reflex.ts";

function actorFixture() {
  const fixture = buildCourtMorning();
  const { world, miraId } = fixture;
  const actor = structuredClone(world.player);
  actor.id = miraId;
  actor.pack = {} as typeof actor.pack;
  world.playerStates = { [miraId]: actor };
  return { ...fixture, actor, person: world.people.find((p) => p.id === miraId)! };
}

test("actor context uses its own pack, skills, ghost state and explicit world", () => {
  const { world, miraId, actor, treeTx, treeTy } = actorFixture();
  setWorld(buildCourtMorning().world);
  const target = { kind: "tile" as const, id: "ground", tx: treeTx, ty: treeTy, label: "grass" };
  world.tiles[treeTy]![treeTx] = { h: 1, kind: "grass" };
  world.player.pack.spellbook = 1;
  actor.pack.acorn = 1;
  actor.skills.forestry = 100;
  const before = structuredClone(world.player);
  const menu = verbsFor(world, miraId, target);
  assert.ok(menu.some((v) => v.verb === "sowAcorn"));
  assert.ok(!menu.some((v) => v.verb === "teleport"));
  actor.pack.spellbook = 1;
  assert.ok(verbsFor(world, miraId, target).some((v) => v.verb === "teleport"));
  actor.ghost = true;
  assert.deepEqual(verbsFor(world, miraId, target).map((v) => v.verb), ["walk"]);
  assert.deepEqual(world.player, before);
  assert.throws(() => verbsFor(world, "missing", target), /Unknown actor/);
  setWorld(world);
  assert.deepEqual(verbsFor(target), verbsFor(world, undefined, target));
});

test("explicit actor context restricts a body-only ghost", () => {
  const { world, miraId, person, treeTx, treeTy } = actorFixture();
  person.ghost = true;
  const target = { kind: "tile" as const, id: "ground", tx: treeTx, ty: treeTy, label: "grass" };
  world.tiles[treeTy]![treeTx] = { h: 1, kind: "grass" };
  assert.deepEqual(verbsFor(world, miraId, target).map((v) => v.verb), ["walk"]);
});

test("actor candidates are centered on its body without a live-world dependency", () => {
  const { world, miraId, person } = actorFixture();
  setWorld(buildCourtMorning().world);
  person.x = 10;
  person.z = 10;
  world.tiles[10]![10] = { h: 1, kind: "grass" };
  const nearby = createPerson(world, mulberry32(99), { x: 11, z: 10, name: "Neighbor" });
  world.people.push(nearby);
  const menu = candidateApi.candidatesFor(world, miraId);
  assert.ok(menu.some((c) => c.target.id === nearby.id));
  assert.ok(menu.some((c) => c.target.id === "10,10"));
  assert.ok(!menu.some((c) => c.target.id === miraId || c.target.id === world.player.id));
  assert.doesNotThrow(() => candidatesForPlayer(world));
  assert.throws(() => candidateApi.candidatesFor(world, "missing"), /Unknown actor/);
  world.people = world.people.filter((p) => p.id !== miraId);
  assert.deepEqual(candidateApi.candidatesFor(world, miraId), []);
});

test("actor observation reads its own sheet and includes the other player body", () => {
  const { world, miraId, actor, person, youId } = actorFixture();
  actor.pack.acorn = 3;
  actor.mana = 7;
  person.hp = 19;
  const before = structuredClone(world);
  const obs = observationApi.observeBody(world, miraId);
  assert.equal(obs.you.id, miraId);
  assert.equal(obs.you.hp, 19);
  assert.equal(obs.you.mana, 7);
  assert.deepEqual(obs.you.pack, actor.pack);
  assert.deepEqual(obs.people.map((p) => p.id), [youId]);
  // structuredClone normalizes null-prototype resource-node dictionaries.
  assert.deepEqual(structuredClone(world), before);
  obs.you.pack.acorn = 99;
  assert.equal(actor.pack.acorn, 3);
  assert.throws(() => observationApi.observeBody(world, "missing"), /Unknown actor/);
  world.people = world.people.filter((p) => p.id !== miraId);
  assert.throws(() => observationApi.observeBody(world, miraId), /body/i);
});

test("observation mirrors the player's sheet and nearby souls only", () => {
  const { world, youId, miraId } = buildCourtMorning();
  const farRng = mulberry32(11);
  world.people.push(
    createPerson(world, farRng, { x: 500, z: 500, cls: "warrior", name: "Far Away" }),
  );
  for (let i = 0; i < 25; i++) world.log.push({ t: i, text: `line ${i}` });

  const obs = observeWorld(world);
  assert.equal(obs.you.id, youId);
  assert.equal(obs.you.name, "You");
  assert.deepEqual(obs.you.skills, world.player.skills);
  assert.deepEqual(obs.you.pack, world.player.pack);
  assert.equal(obs.you.ghost, false);
  assert.equal(obs.hour, 9);
  assert.equal(obs.isNight, false);
  assert.equal(obs.weather.kind, world.weather.kind);
  assert.deepEqual(
    obs.people.map((p) => p.id),
    [miraId],
  );
  assert.equal(obs.logTail.length, 20);
  assert.equal(obs.logTail[0], "line 5");
  assert.deepEqual(obs.verbs, []);
});

test("bodySheet falls back to player state when the person row is missing", () => {
  const { world } = buildCourtMorning();
  world.people.length = 0;
  const sheet = bodySheet(world);
  assert.equal(sheet.id, world.player.id);
  assert.equal(sheet.name, "you");
  assert.equal(sheet.hp, 0);
});

test("candidates list the golden tree chop, walks, and talk (live world)", () => {
  const { world, miraId, treeTx, treeTy } = buildCourtMorning();
  setWorld(world);
  const cands = candidatesForPlayer();
  const chop = cands.find((c) => c.verb === "chop" && c.target.id === `${treeTx},${treeTy}`);
  assert.ok(chop, "expected a chop verb on the fixture tree");
  assert.ok(cands.some((c) => c.verb === "walk"), "expected at least one walk verb");
  const mira = cands.filter((c) => c.target.kind === "person" && c.target.id === miraId);
  assert.ok(mira.some((c) => c.verb === "talk"), "expected Talk on Mira");
  assert.ok(
    cands.every((c) => c.target.kind !== "person" || c.target.id !== world.player.id),
    "the player's own body must never be a menu target",
  );
});

test("ghost bodies get the ghost menu: no chop, keep talk and walk", () => {
  const { world, miraId, treeTx, treeTy } = buildCourtMorning();
  world.player.ghost = true;
  setWorld(world);
  const cands = candidatesForPlayer();
  assert.equal(
    cands.find((c) => c.verb === "chop" && c.target.id === `${treeTx},${treeTy}`),
    undefined,
  );
  assert.ok(cands.some((c) => c.verb === "walk"));
  assert.ok(cands.some((c) => c.verb === "talk" && c.target.id === miraId));
});

test("submitIntent accepts pipeline intents and never mutates on reject", () => {
  const { world } = buildCourtMorning();
  const walk: Intent = { kind: "walk", tx: 260, ty: 293, targetId: null, spell: null };
  assert.equal(submitIntent(world, walk), null);
  assert.equal(world.player.intent.kind, "walk");
  assert.equal(world.player.intent.tx, 260);

  const dance = { kind: "dance", tx: 1, ty: 1, targetId: null, spell: null } as unknown as Intent;
  const reason = submitIntent(world, dance);
  assert.match(reason ?? "", /unknown intent kind/);
  assert.equal(world.player.intent.kind, "walk", "rejected intent must not overwrite the pipeline");
  assert.equal(world.player.intent.tx, 260);

  assert.match(
    validateIntent(world, { kind: "walk", tx: -1, ty: 5, targetId: null, spell: null }) ?? "",
    /outside the map/,
  );
  assert.match(
    validateIntent(world, { kind: "walk", tx: 1.5, ty: 5, targetId: null, spell: null }) ?? "",
    /integer/,
  );
  assert.equal(
    validateIntent(world, { kind: "walk", tx: 5, ty: 5, targetId: "p1", spell: null }),
    null,
  );
});

test("every save-loadable intent kind passes harness validation", () => {
  const { world } = buildCourtMorning();
  const kinds: IntentKind[] = [
    "walk", "chop", "mine", "fish", "hunt", "skin", "loot", "gate", "tame",
    "cast", "plant", "harvest", "till", "forest", "pick", "dig", "fill", "none",
  ];
  for (const kind of kinds) {
    assert.equal(
      validateIntent(world, { kind, tx: 1, ty: 1, targetId: null, spell: null }),
      null,
      `kind ${kind} should validate`,
    );
  }
});

test("reflex answers normalize, clamp, and pick deterministically", () => {
  assert.deepEqual(normalize([2, 2]), [0.5, 0.5]);
  assert.deepEqual(normalize([0, 0]), [0.5, 0.5]);
  assert.deepEqual(normalize([Number.NaN, 3]), [0, 1]);
  assert.equal(topPick([0.1, 0.7, 0.2]), 1);
  assert.equal(topPick([0.5, 0.5]), 0, "ties resolve to the first option");

  const q = choice("next", "What now?", ["chop the tree", "walk to bank"]);
  const a = answerChoice(q, [4, 6]);
  assert.equal(a.pick, 1);
  assert.ok(Math.abs(a.probabilities.reduce((x, y) => x + y, 0) - 1) < 1e-9);
  assert.throws(() => answerChoice(q, [1]), /2 options/);
  assert.throws(() => choice("bad", "one option", ["only"]), /at least two/);

  const n = answerNoul(noul("danger", "Am I in danger?"), 1.4);
  assert.equal(n.p, 1);
});

test("decision log rows serialize as JSONL; observation hashes are stable", () => {
  const { world } = buildCourtMorning();
  const h1 = hashObservation(observeWorld(world));
  const h2 = hashObservation(observeWorld(world));
  assert.equal(h1, h2, "same decision surface, same hash");
  const withVerbs = observeWorld(world, {
    verbs: [{ verb: "walk", label: "Walk here", target: { kind: "tile", id: "1,1", tx: 1, ty: 1, label: "grass" } }],
  });
  assert.notEqual(hashObservation(withVerbs), h1);

  const log = createDecisionLog();
  log.append({
    tick: 1,
    bodyId: "you",
    lane: "reflex",
    question: "What now?",
    candidates: ["chop the tree", "walk to bank"],
    answer: "chop the tree",
    intent: { kind: "chop", tx: 258, ty: 293, targetId: null, spell: null },
    stateHash: h1,
    outcome: null,
  });
  log.append({
    tick: 2,
    bodyId: "you",
    lane: "mind",
    question: "set goals",
    candidates: [],
    answer: "earn 100 gold",
    intent: null,
    stateHash: h1,
    outcome: { gold: 12 },
  });
  const lines = log.toJSONL().split("\n");
  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0]!) as { answer: string; intent: { kind: string } };
  assert.equal(first.answer, "chop the tree");
  assert.equal(first.intent.kind, "chop");
});
