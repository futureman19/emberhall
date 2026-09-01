import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMERA_HEIGHT_DEAD_ZONE,
  CAMERA_MAX_DT,
  cameraFollowAlpha,
  cameraFollowAxis,
  cameraLockedAxis,
  cameraVerticalAxis,
} from "./camera-follow.ts";

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

test("an independent anchor translates camera and controls equally without erasing pan", () => {
  const anchor = cameraFollowAxis(10, 12, 1 / 60);
  const camera = 30 + anchor.delta;
  const controlsTarget = 15 + anchor.delta;

  assert.ok(anchor.next > 10 && anchor.next < 12);
  assert.ok(Math.abs(camera - controlsTarget - 15) < 1e-12);
  assert.ok(Math.abs(controlsTarget - anchor.next - 5) < 1e-12);
});

test("horizontal follow consumes the player's exact rendered displacement", () => {
  const right = cameraLockedAxis(10, 10.0375);
  const turn = cameraLockedAxis(right.next, 9.9925);

  assert.equal(right.next, 10.0375);
  assert.ok(Math.abs(right.delta - 0.0375) < 1e-12);
  assert.ok(Math.abs(turn.next - 9.9925) < 1e-12);
  assert.ok(Math.abs(turn.delta + 0.045) < 1e-12);
  assert.equal(cameraLockedAxis(4, Number.NaN).delta, 0);
});

test("vertical follow ignores terrain noise inside its dead zone", () => {
  const inside = cameraVerticalAxis(2, 2 + CAMERA_HEIGHT_DEAD_ZONE * 0.75, 1 / 60);
  const edge = cameraVerticalAxis(2, 2 + CAMERA_HEIGHT_DEAD_ZONE, 1 / 60);

  assert.deepEqual(inside, { next: 2, delta: 0 });
  assert.deepEqual(edge, { next: 2, delta: 0 });
});

test("vertical follow eases only the elevation outside the dead zone", () => {
  let current = 2;
  for (let frame = 0; frame < 60; frame++) {
    const step = cameraVerticalAxis(current, 3, 1 / 60);
    assert.ok(step.next >= current);
    assert.ok(step.next < 3);
    current = step.next;
  }

  assert.ok(current > 2.8);
  assert.ok(current <= 3 - CAMERA_HEIGHT_DEAD_ZONE + 1e-12);
  assert.deepEqual(cameraVerticalAxis(current, 3, 0), { next: current, delta: 0 });
});
