import { test } from "node:test";
import assert from "node:assert/strict";
import { mintKeys, writeKeys } from "./shard-keys.mjs";
test("character keys are independent 256-bit secrets with validated names", () => {
  const keys = mintKeys(["kett", "bran"]).split(",");
  assert.match(keys[0], /^kett:[a-f0-9]{64}$/);
  assert.match(keys[1], /^bran:[a-f0-9]{64}$/);
  assert.notEqual(keys[0].split(":")[1], keys[1].split(":")[1]);
  for (const names of [[], ["kett", "kett"], ["bad:name"], ["bad,name"], [" "]]) assert.throws(() => mintKeys(names));
  assert.throws(() => writeKeys("./secret-should-not-exist", ["kett"]), /outside the repository/);
});
