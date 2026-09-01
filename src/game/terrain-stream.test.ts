import assert from "node:assert/strict";
import test from "node:test";
import { CHUNK, VIEW } from "./atlas.ts";
import {
  TERRAIN_STREAM_WINDOW,
  terrainStreamOrigin,
} from "./terrain-stream.ts";

test("terrain streaming origin changes only on chunk boundaries", () => {
  const origins: number[] = [];
  let previous: number | null = null;
  for (let frame = 0; frame <= 100; frame += 1) {
    const x = frame * 0.26;
    const origin = terrainStreamOrigin(x);
    if (origin !== previous) origins.push(origin);
    previous = origin;
  }

  assert.deepEqual(origins, [0, 8, 16, 24]);
  assert.ok(origins.length * CHUNK <= 32);
});

test("the buffered terrain window preserves the complete visible radius", () => {
  assert.equal(TERRAIN_STREAM_WINDOW, VIEW + CHUNK);
  for (let offset = -CHUNK / 2; offset <= CHUNK / 2; offset += 0.25) {
    const player = 256 + offset;
    const origin = terrainStreamOrigin(player);
    const nearestEdge = TERRAIN_STREAM_WINDOW / 2 - Math.abs(player - origin);
    assert.ok(nearestEdge >= VIEW / 2);
  }
});

test("terrain stream origin is finite and deterministic", () => {
  assert.equal(terrainStreamOrigin(255.9), 256);
  assert.equal(terrainStreamOrigin(259.9), 256);
  assert.equal(terrainStreamOrigin(260), 264);
  assert.equal(terrainStreamOrigin(Number.NaN), 0);
});
