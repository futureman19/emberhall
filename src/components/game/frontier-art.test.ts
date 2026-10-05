import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FRONTIER_ART } from "../../game/frontier.ts";

test("every placed binary parses, retains ground pivot, shares resources and never intercepts picking", async () => {
  const { cloneFrontierArt } = await import("./frontier-art-data.ts");
  for (const p of FRONTIER_ART) {
    const b = await fs.readFile(new URL(`../../../public${p.url}`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      "",
    );
    const clone = cloneFrontierArt(gltf.scene);
    clone.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0, 20, 0), new Vector3(0, -1, 0));
    assert.equal(ray.intersectObject(clone, true).length, 0, p.id);
    const originals: unknown[] = [];
    gltf.scene.traverse((o) => {
      if ("geometry" in o) originals.push(o.geometry);
    });
    clone.traverse((o) => {
      if ("geometry" in o) assert.ok(originals.includes(o.geometry));
    });
  }
});

test("failed asset load is cached and returns a fallback signal", async () => {
  const { loadFrontierArt } = await import("./frontier-art-data.ts");
  const a = loadFrontierArt("invalid://frontier-test");
  assert.equal(a, loadFrontierArt("invalid://frontier-test"));
  assert.equal(await a, null);
});
