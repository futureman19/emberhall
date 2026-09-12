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
test("missing field kit rejects so original rendering can stay active", () => {
  assert.throws(()=>extractFieldPropGeometry(new Group()),/Missing field-props/);
});
