import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Group } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CROP_ORDER } from "../../game/farm.ts";
import { extractFloraGeometry, FLORA_CROPS, FLORA_HERBS, FLORA_NAMES } from "./flora-art.ts";

const bytes = fs.readFileSync(new URL("../../../public/art/lanternwood/flora.glb", import.meta.url));
const scene = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
const geometry = extractFloraGeometry(scene);

test("flora kit covers canonical crops, five reagent kinds and every visual state", () => {
  assert.deepEqual([...FLORA_CROPS], CROP_ORDER);
  assert.equal(FLORA_HERBS.length, 5);
  assert.equal(FLORA_NAMES.length, 28);
  assert.equal(new Set(FLORA_NAMES).size, 28);
  assert.deepEqual(Object.keys(geometry), FLORA_NAMES);
  const manifest = JSON.parse(fs.readFileSync(new URL("../../../public/art/lanternwood/flora-manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.sha256, createHash("sha256").update(bytes).digest("hex"));
});
test("all exported states are finite, ground-seated, colored and bed bounded", () => {
  for (const [name, g] of Object.entries(geometry)) {
    const box = g.boundingBox!;
    assert(box.min.y >= -0.021 && box.max.y <= 0.86, name);
    assert(g.getAttribute("color").count === g.getAttribute("position").count, name);
    assert(g.groups.length <= 1, name);
    const attribute = g.getAttribute("color");
    const colors = Array.from({ length: attribute.count }, (_, i) => attribute.getX(i));
    assert(colors.some(v => v < 0.8), `Palette missing: ${name}`);
  }
});
test("crop growth increases visible bounds and harvested herbs have distinct states", () => {
  for (const id of FLORA_CROPS) {
    const a = geometry[`crop_${id}_1`].boundingBox!;
    const b = geometry[`crop_${id}_3`].boundingBox!;
    assert(b.max.y > a.max.y, id);
  }
  for (const id of FLORA_HERBS) {
    assert.notDeepEqual(Array.from(geometry[`herb_${id}_ready`].getAttribute("color").array), Array.from(geometry[`herb_${id}_picked`].getAttribute("color").array));
  }
});
test("missing export fails closed instead of displaying an incomplete kit", () => {
  assert.throws(() => extractFloraGeometry(new Group()), /Missing flora/);
});
