import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FIRST_PERSON_EYE,
  FIRST_PERSON_LOOK,
  firstPersonHotkey,
  firstPersonPose,
  orbitRestPose,
  toggleFirstPerson,
} from "./first-person-view.ts";

function read(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8").replaceAll("\r\n", "\n");
}

test("eye camera sits on the body and looks along simulation facing", () => {
  const groundY = 2;
  const storyY = 1.5;
  const pose = firstPersonPose({ x: 10, z: 20, facing: 0, groundY, storyY });
  assert.equal(pose.position.x, 10);
  assert.equal(pose.position.z, 20);
  assert.equal(pose.position.y, groundY + storyY + FIRST_PERSON_EYE);
  assert.ok(pose.lookAt.z > pose.position.z);
  assert.ok(Math.abs(pose.lookAt.x - 10) < 1e-12);
  assert.ok(pose.lookAt.y < pose.position.y);

  const east = firstPersonPose({ x: 0, z: 0, facing: Math.PI / 2, groundY: 0 });
  assert.ok(east.lookAt.x > east.position.x);
  assert.ok(Math.abs(east.lookAt.z) < 1e-12);
  assert.ok(Math.abs(east.lookAt.x - FIRST_PERSON_LOOK) < 1e-12);
});

test("bad facing or height cannot throw the camera off the vale", () => {
  const pose = firstPersonPose({ x: 1, z: 2, facing: Number.NaN, groundY: Number.NaN, storyY: Number.NaN });
  assert.equal(pose.position.x, 1);
  assert.equal(pose.position.z, 2);
  assert.ok(Number.isFinite(pose.position.y));
  assert.ok(Number.isFinite(pose.lookAt.x) && Number.isFinite(pose.lookAt.z));
});

test("leaving eyes restores the tactical offset, not a zeroed camera", () => {
  const rest = orbitRestPose(100, 200, 3, 1);
  assert.equal(rest.target.x, 100);
  assert.equal(rest.target.z, 200);
  assert.ok(rest.position.y > rest.target.y + 10);
  assert.ok(rest.position.x > rest.target.x);
  assert.ok(rest.position.z > rest.target.z);
});

test("V toggles eyes except when typing in a field", () => {
  assert.equal(toggleFirstPerson(false), true);
  assert.equal(toggleFirstPerson(true), false);
  assert.equal(firstPersonHotkey("v", false), "toggle");
  assert.equal(firstPersonHotkey("V", false), "toggle");
  assert.equal(firstPersonHotkey("v", true), "ignore");
  assert.equal(firstPersonHotkey(".", false), "ignore");
});

test("rig, figure, HUD chip and settings all reach the same first-person flag", () => {
  const rig = read("../components/game/world-scene.tsx");
  const people = read("../components/game/people-meshes.tsx");
  const hud = read("../components/game/hud.tsx");
  const settings = read("../components/game/settings-gump.tsx");
  assert.match(rig, /firstPersonPose/);
  assert.match(rig, /orbitRestPose/);
  assert.match(rig, /firstPerson/);
  assert.match(people, /emberhall-player-figure/);
  assert.match(people, /firstPerson/);
  assert.match(hud, /firstPersonHotkey/);
  assert.match(hud, /First-person/);
  assert.match(settings, /firstPerson/);
  assert.match(settings, /Eyes/);
});
