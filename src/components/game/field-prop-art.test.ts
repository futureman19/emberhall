import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Group, InstancedMesh, DodecahedronGeometry, MeshBasicMaterial, Matrix4, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { extractFieldPropGeometry, FIELD_PROP_NAMES } from "./field-prop-art.ts";
const bytes = fs.readFileSync(new URL("../../../public/art/lanternwood/field-props.glb", import.meta.url));
const scene = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "")).scene;
const kit = extractFieldPropGeometry(scene);
test("field kit is complete, finite and bounded with actual palette", () => {
  assert.deepEqual(Object.keys(kit), FIELD_PROP_NAMES);
  for (const [name,g] of Object.entries(kit)) {
    assert(g.boundingBox!.max.y <= 0.43, name);
    assert(g.groups.length <= 1, name);
    const color = g.getAttribute("color");
    assert(Array.from({length:color.count},(_,i)=>color.getX(i)).some(v=>v<0.9), name);
  }
  const manifest = JSON.parse(fs.readFileSync(new URL("../../../public/art/lanternwood/field-props-manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.sha256,createHash("sha256").update(bytes).digest("hex"));
});
test("original rock proxy still raycasts with painting disabled", () => {
  const material = new MeshBasicMaterial({colorWrite:false,depthWrite:false});
  const proxy = new InstancedMesh(new DodecahedronGeometry(0.42),material,2);
  proxy.setMatrixAt(0,new Matrix4().makeTranslation(1,0,0));
  proxy.setMatrixAt(1,new Matrix4().makeTranslation(3,0,0));
  proxy.updateMatrixWorld(true);
  const hits = new Raycaster(new Vector3(3,3,0),new Vector3(0,-1,0)).intersectObject(proxy);
  assert(hits.length>0);assert.equal(hits[0].instanceId,1);
  proxy.geometry.dispose();material.dispose();
});
test("authored rock base stays on soil across scale, tilt and mining wobble", async () => {
  const { seatFieldRockMatrix } = await import("./field-prop-art.ts");
  const { Object3D } = await import("three");
  const rock = kit.field_rock;
  const vertex = new Vector3();
  const dummy = new Object3D();
  for (const [width, height, depth] of [[0.22, 0.14, 0.2], [0.7, 0.5, 0.6], [1.7, 1.3, 1.5]]) {
    for (const yaw of [0, 1.7, 4.2]) for (const wobble of [-0.08, 0, 0.08]) {
      const ground = 3.25;
      dummy.position.set(184, ground + 0.42 * height * 0.55, 385);
      dummy.rotation.set(0.1 + wobble, yaw, -0.1 + 0.05);
      dummy.scale.set(width, height, depth);
      dummy.updateMatrix();
      const proxy = dummy.matrix.clone();
      seatFieldRockMatrix(rock, dummy.matrix, ground);
      const positions = rock.getAttribute("position");
      let bottom = Infinity;
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(dummy.matrix);
        bottom = Math.min(bottom, vertex.y);
      }
      assert(Math.abs(bottom - (ground + 0.006)) < 1e-7, `base ${bottom} at ${width}/${height}/${yaw}/${wobble}`);
      for (let i = 0; i < 16; i++) if (i !== 13) assert.equal(dummy.matrix.elements[i], proxy.elements[i]);
      const seated = dummy.matrix.clone();
      seatFieldRockMatrix(rock, dummy.matrix, ground);
      assert.deepEqual(dummy.matrix.elements, seated.elements, "seating is idempotent");
    }
  }
});

test("terrain seats only authored rock after recording the unchanged picking proxy", () => {
  const source = fs.readFileSync(new URL("./terrain.tsx", import.meta.url), "utf8");
  assert.match(source, /rk\.setMatrixAt\(ri, dummy\.matrix\);\s*if \(ar && fieldProps\) \{\s*seatFieldRockMatrix\(fieldProps\.field_rock, dummy\.matrix, groundY\(w, tx, ty\)\);\s*ar\.setMatrixAt\(ri, dummy\.matrix\);/);
});

test("missing field kit rejects so original rendering can stay active", () => {
  assert.throws(()=>extractFieldPropGeometry(new Group()),/Missing field-props/);
});
