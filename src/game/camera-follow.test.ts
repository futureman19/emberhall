import assert from "node:assert/strict";
import test from "node:test";
import { CAMERA_MAX_DT, cameraFollowAlpha } from "./camera-follow.ts";

function followForSecond(hz: number) {
  let current = 0;
  const dt = 1 / hz;
  for (let frame = 0; frame < hz; frame++) current += (1 - current) * cameraFollowAlpha(dt);
  return current;
}

test("camera follow is frame-rate independent across common refresh rates", () => {
  const at30 = followForSecond(30);
  const at60 = followForSecond(60);
  const at120 = followForSecond(120);
  assert.ok(Math.abs(at30 - at60) < 1e-12);
  assert.ok(Math.abs(at60 - at120) < 1e-12);
});

test("camera follow stays monotonic, bounded, and clamps long frames", () => {
  const short = cameraFollowAlpha(1 / 120);
  const normal = cameraFollowAlpha(1 / 60);
  const stalled = cameraFollowAlpha(5);
  assert.ok(short > 0 && short < normal);
  assert.ok(normal < stalled && stalled < 1);
  assert.equal(stalled, cameraFollowAlpha(CAMERA_MAX_DT));
  assert.equal(cameraFollowAlpha(0), 0);
  assert.equal(cameraFollowAlpha(Number.NaN), 0);
});
