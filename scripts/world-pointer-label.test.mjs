import assert from "node:assert/strict";
import test from "node:test";
import { verbsFor } from "../src/game/context.ts";
import { setWorld } from "../src/game/live.ts";
import { useGame } from "../src/game/store.ts";
import { createWorld } from "../src/game/world.ts";
import { hitAt } from "../src/game/world-pointer.ts";

function pondWorld() {
  const world = createWorld(1);
  // Isolate terrain picking from higher-priority entities.
  world.piles = [];
  world.herbs = [];
  world.fauna = [];
  world.people = [world.player];
  setWorld(world);
  return world;
}

test("starter pond context says water and still offers Cast a line", () => {
  const world = pondWorld();
  assert.equal(world.tiles[302][249].kind, "water");
  hitAt(249, 302, 120, 240);
  const ctx = useGame.getState().ctx;
  assert.deepEqual(ctx, {
    x: 120, y: 240,
    target: { kind: "tile", id: "249,302", tx: 249, ty: 302, label: "water" },
  });
  assert.ok(verbsFor(ctx.target).some(({ verb, label }) => verb === "fish" && label === "Cast a line"));
});

test("terrain labels follow the current tile kind, including edited pond tiles", () => {
  const world = pondWorld();
  for (const kind of ["grass", "dirt", "cobble", "road", "tree", "rock", "water", "sand", "floor", "wall", "step", "pit", "snow", "marsh"]) {
    world.tiles[302][249].kind = kind;
    hitAt(249, 302, 120, 240);
    assert.equal(useGame.getState().ctx.target.label, kind);
  }
});

test("higher-priority pile labels and missing-tile fallback are preserved", () => {
  const world = pondWorld();
  world.piles.push({ id: "pond-pile", tx: 249, ty: 302, label: "Lost supplies", items: {}, gold: 0 });
  hitAt(249, 302, 120, 240);
  assert.equal(useGame.getState().ctx.target.kind, "pile");
  assert.equal(useGame.getState().ctx.target.label, "Lost supplies");
  hitAt(-1, -1, 120, 240);
  assert.equal(useGame.getState().ctx.target.label, "dirt");
});
