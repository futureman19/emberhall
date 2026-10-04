import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Group } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CROP_ORDER } from "../../game/farm.ts";
import { extractFloraGeometry, floraHerbGroundOffset, FLORA_CROPS, FLORA_HERBS, FLORA_NAMES } from "./flora-art.ts";
import { HERB_ORDER } from "../../game/herbs.ts";

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
test("all canonical wild herbs seat ready and picked authored bases just above soil", () => {
  assert.deepEqual([...FLORA_HERBS].sort(), [...HERB_ORDER].sort());
  for (const kind of HERB_ORDER) {
    for (const ready of [true, false]) {
      const g = geometry[`herb_${kind}_${ready ? "ready" : "picked"}`];
      const scale = ready ? 1 : 0.62;
      const positions = Array.from(g.getAttribute("position").array);
      const offset = floraHerbGroundOffset(g, ready);
      for (const soilY of [-2, 0, 0.8, 5]) {
        const base = soilY + offset + g.boundingBox!.min.y * scale;
        assert(Math.abs(base - soilY - 0.006) < 1e-9, `${kind}/${ready}: ${base}`);
      }
      assert.deepEqual(Array.from(g.getAttribute("position").array), positions, "shared geometry stays unchanged");
    }
  }
});
test("wild herb fallback keeps its original primitive root offset in both states", () => {
  assert.equal(floraHerbGroundOffset(undefined, true), 0.06);
  assert.equal(floraHerbGroundOffset(undefined, false), 0.06);
});
test("herb renderer applies geometry-aware seating without changing scale or crop beds", () => {
  const source = fs.readFileSync(new URL("./herb-meshes.tsx", import.meta.url), "utf8");
  assert.match(source, /position=\{\[patch\.tx, y \+ floraHerbGroundOffset\(authored, ready\), patch\.ty\]\}/);
  assert.match(source, /scale=\{ready \? 1 : 0\.62\}/);
});
test("missing export fails closed instead of displaying an incomplete kit", () => {
  assert.throws(() => extractFloraGeometry(new Group()), /Missing flora/);
});
