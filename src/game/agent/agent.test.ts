import assert from "node:assert/strict";
import { test } from "node:test";
import { mulberry32 } from "../rng.ts";
import { setWorld } from "../live.ts";
import type { Intent, IntentKind } from "../types.ts";
import { createPerson } from "../world.ts";
import { candidatesForPlayer } from "./candidates.ts";
import { buildCourtMorning } from "./fixtures/court-morning.ts";
import { submitIntent, validateIntent } from "./intent.ts";
import { createDecisionLog, hashObservation } from "./log.ts";
import { bodySheet, observeWorld } from "./observe.ts";
import { answerChoice, answerNoul, choice, normalize, noul, topPick } from "./reflex.ts";

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
