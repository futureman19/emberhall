import test from "node:test";
import assert from "node:assert/strict";
import { Color, ShaderLib } from "three";
import { generateTiles } from "../../game/world.ts";
import { groundY } from "../../game/height.ts";
import { RESOURCE_CATALOG } from "../../game/resources/catalog.ts";
import { resolveResourceVisual } from "./resource-visuals.ts";
import { readFileSync } from "node:fs";
import type { World } from "../../game/types.ts";
import { selectPondTrees } from "./pond-tree-sway.ts";
const load = () => import("./pond-autumn.ts");
const world = () =>
  ({
    seed: 17,
    tiles: generateTiles(17),
    buildings: [],
    placedObjects: [],
    plantedTimber: {},
  }) as unknown as World;

test("seed 7/17 canonical selection contains six ordinary oaks; repeated rebuilds are capped and deterministic", async () => {
  const { createPondAutumn, isPondAutumnSpecies } = await load();
  for (const entry of Object.values(RESOURCE_CATALOG))
    assert.equal(isPondAutumnSpecies(entry.id), entry.id === "oak");
  for (const seed of [7, 17]) {
    const w = world();
    w.seed = seed;
    w.tiles = generateTiles(seed);
    const a = createPondAutumn(),
      sites = selectPondTrees(w);
    assert.equal(sites.length, 6);
    const rebuild = () => {
      a.begin(w);
      for (const [x, z] of sites) {
        const id = resolveResourceVisual({ seed, tx: x, ty: z, nodeKind: "tree" }).resourceId;
        assert.equal(id, "oak");
        a.crown(w, id, x, groundY(w, x, z) + 3, z);
        a.crown(w, id, x, groundY(w, x, z) + 3, z);
      }
      a.flush();
    };
    rebuild();
    assert.equal(a.mesh.count, 24);
    const source = a.mesh.geometry.getAttribute("autumnSource").array.slice();
    for (let n = 0; n < 20; n++) rebuild();
    assert.equal(a.mesh.count, 24);
    assert.deepEqual(a.mesh.geometry.getAttribute("autumnSource").array, source);
    const ground = a.mesh.geometry.getAttribute("autumnGround");
    for (let i = 0; i < sites.length; i++) {
      const [x, z] = sites[i]!;
      for (const [fx, fz] of [
        [0.15, 0.23],
        [0.4, 0.5],
        [0.62, 0.58],
      ]) {
        const y =
          (ground.getX(i * 4) * (1 - fx) + ground.getY(i * 4) * fx) * (1 - fz) +
          (ground.getZ(i * 4) * (1 - fx) + ground.getW(i * 4) * fx) * fz;
        assert.ok(Math.abs(y - groundY(w, x + fx, z + fz)) < 1e-5);
      }
    }
    a.begin(w);
    a.flush();
    assert.equal(a.mesh.count, 0);
    a.dispose();
  }
});

test("terrain integration tints only crown instance colors and preserves marking/fallback/faded art", () => {
  const source = readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  assert.match(source, /autumn\.current\?\.tint\(woodId, tx, ty, leafCol\)/);
  assert.match(source, /paint\(customCrown \?\? null, treeIndex, leafCol\)/);
  assert.match(source, /paint\(gh, gi, leafCol\)/);
  assert.match(source, /paint\(cn, si, leafCol\)/);
  assert.match(source, /softCanopy\.current\.setColorAt\(li\+\+, leafCol\)/);
  assert.match(source, /resourceWorld\.current !== w \|\| resourceTiles\.current !== w.tiles/);
  assert.match(source, /parent\?\.remove\(leaves.mesh\); leaves.dispose\(\)/);
});

test("autumn is explicit oak only, capped to current sway selection and never mutates source color", async () => {
  const { createPondAutumn } = await load();
  const w = world(),
    a = createPondAutumn();
  a.begin(w);
  const [x, z] = selectPondTrees(w)[0]!;
  const original = new Color("#406030");
  for (const id of ["pine", "ghostwood", "lanternwood", "willow", "birch"])
    assert.equal(a.tint(id, x, z, original), original);
  assert.notDeepEqual(a.tint("oak", x, z, original), original);
  assert.equal(original.getHexString(), "406030");
  assert.equal(a.tint("oak", 100, 100, original), original);
  w.tiles[z]![x]!.kind = "grass";
  a.begin(w);
  assert.equal(a.tint("oak", x, z, original), original);
  a.dispose();
});

test("bounded leaves have live independent shader clock; chopping, occupancy and distance hide immediately", async () => {
  const { createPondAutumn, POND_AUTUMN_CAPACITY } = await load();
  const w = world(),
    a = createPondAutumn();
  const [x, z] = selectPondTrees(w)[0]!;
  a.begin(w);
  a.crown(w, "oak", x, 4, z);
  a.flush();
  a.update(w, 250, 304, 1);
  assert.equal(a.mesh.count, 4);
  assert.equal(a.mesh.instanceMatrix.count, POND_AUTUMN_CAPACITY);
  assert.equal(a.uniforms.uAutumnLeafTime.value, 0.05);
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
  };
  a.material.onBeforeCompile(shader as never, {} as never);
  assert.match(shader.vertexShader, /pondAutumnLeaves/);
  assert.equal(
    (shader.uniforms as Record<string, unknown>).uAutumnLeafTime,
    a.uniforms.uAutumnLeafTime,
  );
  a.update(w, 0, 0, 1);
  assert.equal(a.mesh.visible, false);
  assert.equal(a.uniforms.uAutumnLeafTime.value, 0.05);
  a.update(w, 250, 304, 0);
  assert.equal(a.mesh.visible, true);
  w.buildings.push({ kind: "cottage", tx: x, ty: z } as World["buildings"][number]);
  a.update(w, 250, 304, 0);
  assert.equal(a.mesh.geometry.getAttribute("autumnAlive").getX(0), 0);
  w.buildings.length = 0;
  a.update(w, 250, 304, 0);
  assert.equal(a.mesh.geometry.getAttribute("autumnAlive").getX(0), 1);
  w.tiles[z]![x]!.kind = "grass";
  a.update(w, 250, 304, 0);
  assert.equal(a.mesh.geometry.getAttribute("autumnAlive").getX(0), 0);
  let disposed = 0;
  a.mesh.geometry.addEventListener("dispose", () => disposed++);
  a.material.addEventListener("dispose", () => disposed++);
  a.dispose();
  a.dispose();
  assert.equal(disposed, 2);
});
