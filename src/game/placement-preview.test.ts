import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BUILD_SIZE, siteError } from "./building-size.ts";
import { HOUSE_DEEDS, HOUSE_KINDS, houseSiteError, isHouseKind, placeHouse } from "./house.ts";
import { placementPreviewError } from "./placement-preview.ts";
import { createPerson, createStubWorld } from "./world.ts";
import type { BuildingKind, World } from "./types.ts";

function fixture() {
  const world = createStubWorld();
  const p = createPerson(world, () => 0.5, { x: 256, z: 320, cls: "ranger", member: true, isPlayer: true });
  world.player.id = p.id;
  world.people = [p]; world.buildings = []; world.plots = [];
  world.player.ghost = false; world.gold = 100;
  for (const kind of HOUSE_KINDS) world.player.pack[HOUSE_DEEDS[kind]] = 2;
  return world;
}

for (const kind of HOUSE_KINDS) {
  test(`${kind} valid preview agrees with real deed placement, without mutation`, () => {
    const world = fixture(), before = JSON.stringify(world);
    assert.equal(houseSiteError(world, kind, 256, 320), null);
    assert.equal(placementPreviewError(world, kind, 256, 320), null);
    assert.equal(JSON.stringify(world), before);
    assert.equal(placeHouse(world, kind, 256, 320), null);
    assert.equal(world.player.pack[HOUSE_DEEDS[kind]], 1);
    assert.equal(world.gold, 100);
    assert.equal(world.buildings[0]?.ownerId, world.player.id);
    assert.equal(placementPreviewError(world, kind, 256, 320), "You already have a house.");
  });
  test(`${kind} preview retains canonical rejection reasons and restores eligibility`, () => {
    const cases: Array<[string, (w: World) => void]> = [
      ["A ghost cannot.", w => { w.player.ghost = true; }],
      ["You already have a house.", w => { w.buildings.push({ id: "owned", kind: "hut", tx: 265, ty: 329, beds: [], ownerId: w.player.id }); }],
      [`Need a ${kind} deed.`, w => { w.player.pack[HOUSE_DEEDS[kind]] = 0; }],
      ["No body.", w => { w.people = []; }],
      ["Stand nearer the dirt.", w => { w.people[0]!.x = 280; }],
      ["No footing.", w => { w.tiles[320]![256]!.kind = "water"; }],
      ["That ground is taken.", w => { w.buildings.push({ id: "occupied", kind: "shop", tx: 256, ty: 320, beds: [] }); }],
    ];
    for (const [expected, mutate] of cases) {
      const world = fixture(); mutate(world);
      const before = JSON.stringify(world);
      assert.equal(placementPreviewError(world, kind, 256, 320), expected);
      assert.equal(placementPreviewError(world, kind, 256, 320), houseSiteError(world, kind, 256, 320));
      assert.equal(JSON.stringify(world), before);
      assert.equal(placeHouse(world, kind, 256, 320), expected);
      assert.equal(JSON.stringify(world), before);
    }
    const world = fixture(); world.player.pack[HOUSE_DEEDS[kind]] = 0;
    assert.notEqual(placementPreviewError(world, kind, 256, 320), null);
    world.player.pack[HOUSE_DEEDS[kind]] = 1;
    assert.equal(placementPreviewError(world, kind, 256, 320), null);
  });
}

test("ordinary building previews preserve all canonical non-deed kind decisions", () => {
  const world = fixture();
  for (const kind of Object.keys(BUILD_SIZE) as BuildingKind[]) {
    if (isHouseKind(kind)) continue;
    for (const gold of [0, 27, 28, 39, 40, 100]) {
      world.gold = gold;
      assert.equal(placementPreviewError(world, kind, 256, 320), siteError(world, kind, 256, 320));
    }
    world.buildings = [{ id: "existing", kind, tx: 256, ty: 320, beds: [] }];
    assert.equal(placementPreviewError(world, kind, 256, 320), siteError(world, kind, 256, 320));
    world.buildings = [];
  }
});

test("live preview subscribes to the current validity result even when pointer stays still", () => {
  const source = readFileSync(new URL("../components/game/building-meshes.tsx", import.meta.url), "utf8");
  assert.match(source, /const ok = useGame\(\(\) => !placementPreviewError\(getWorld\(\), kind, tx, ty\)\)/);
});

test("new buildings update the renderer while paused despite mutable array identity", () => {
  const source = readFileSync(new URL("../components/game/building-meshes.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("useGame((s) => s.snap.buildings.length)"));
});
