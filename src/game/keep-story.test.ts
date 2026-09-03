import assert from "node:assert/strict";
import test from "node:test";
import { KEEP_MAX_STORY, KEEP_STAIR, applyKeepStory, insideKeep, onKeepStairs } from "./keep-story.ts";
import type { Person } from "./types.ts";

function walker(x: number, z: number, story = 0): Person {
  return { isPlayer: true, x, z, story } as Person;
}

test("keep stairs sit inside the shell", () => {
  assert.equal(onKeepStairs(KEEP_STAIR.x0, KEEP_STAIR.z1), true);
  assert.equal(onKeepStairs(176, 320), false);
  assert.equal(insideKeep(176, 320), true);
  assert.equal(insideKeep(152, 336), false);
});

test("walking north on the well climbs; south descends", () => {
  const p = walker(KEEP_STAIR.x0, KEEP_STAIR.z1, 0);
  applyKeepStory(p, KEEP_STAIR.x0, KEEP_STAIR.z1);
  assert.equal(p.story, 0);
  p.z = KEEP_STAIR.z1 - (KEEP_STAIR.z1 - KEEP_STAIR.z0) / KEEP_MAX_STORY;
  applyKeepStory(p, KEEP_STAIR.x0, KEEP_STAIR.z1);
  assert.ok(Math.abs((p.story ?? 0) - 1) < 0.05, `story ${p.story}`);
  const mid = p.z;
  const midStory = p.story ?? 0;
  p.z = KEEP_STAIR.z1;
  applyKeepStory(p, KEEP_STAIR.x0, mid);
  assert.ok(Math.abs((p.story ?? 0) - (midStory - 1)) < 0.05);
});

test("leaving the keep drops you to the bailey", () => {
  const p = walker(200, 336, 2);
  applyKeepStory(p, 185, 320);
  assert.equal(p.story, 0);
});

test("story clamps at the roof", () => {
  const p = walker(KEEP_STAIR.x0, KEEP_STAIR.z0, KEEP_MAX_STORY);
  applyKeepStory(p, KEEP_STAIR.x0, KEEP_STAIR.z0 + 3);
  assert.equal(p.story, KEEP_MAX_STORY);
});
