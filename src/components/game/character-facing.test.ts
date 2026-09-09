import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Vector3 } from "three";
import { playerVisualYaw } from "./character-facing.ts";

test("authored negative-Z face aligns with actual simulation heading in eight directions", () => {
  for (const [dx, dz] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]) {
    const heading = Math.atan2(dx,dz);
    const target = new Vector3(dx,0,dz).normalize();
    const face = new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0),playerVisualYaw(heading));
    assert.ok(face.dot(target) > .999999);
    const oldFace = new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0),heading);
    assert.ok(oldFace.dot(target) < -.999999, "reproduces the original backwards face");
  }
});
test("visual yaw correction applies to player and bounded authored civic NPCs", () => {
  const text=readFileSync(new URL('./people-meshes.tsx',import.meta.url),'utf8');
  assert.ok(text.includes('root.current.rotation.y = playerVisualYaw(you.facing)'));
  assert.ok(text.includes('civicVisualYaw(p.facing, authored)'));
  assert.ok(text.includes('root.current.rotation.set(pose.bow, civicVisualYaw(live.facing, authored) + pose.turn, 0)'));
});
