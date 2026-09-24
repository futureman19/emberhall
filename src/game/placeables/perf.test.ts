import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encodeSave } from "../save.ts";
import { createPerson, createStubWorld } from "../world.ts";
import { placeObject } from "./commands.ts";
import { SIGN_TEXT_MAX, STRUCTURE_OBJECT_MAX } from "./schema.ts";

test("a hold is capped at 250 pieces and a lodge save stays under 1 MB", () => {
  assert.equal(STRUCTURE_OBJECT_MAX, 250);
  assert.equal(SIGN_TEXT_MAX, 80);
  const world = createStubWorld();
  const player = createPerson(world, () => 0.5, { x: 100, z: 100, isPlayer: true, member: true });
  world.people.push(player);
  world.player.id = player.id;
  world.player.ghost = false;
  world.player.pack.board = 400;
  for (let i = 0; i < 20; i++) {
    assert.equal(placeObject(world, "floor_timber", 80 + (i % 10) * 2, 80 + Math.floor(i / 10) * 2, 0), null);
  }
  assert.equal(world.placedObjects.length, 20);
  const bytes = Buffer.byteLength(encodeSave(world), "utf8");
  assert.ok(bytes < 1_000_000, `save was ${bytes} bytes`);
});

test("kit meshes batch by palette, not a material per piece", () => {
  const source = readFileSync(new URL("../../components/game/placeable-meshes.tsx", import.meta.url), "utf8");
  assert.match(source, /instancedMesh/);
  assert.match(source, /PALETTE/);
  assert.doesNotMatch(source, /new THREE\.MeshStandardMaterial/);
});
