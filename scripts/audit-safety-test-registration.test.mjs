import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
function sourceTests(dir) {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const name = `${dir}/${entry.name}`;
    return entry.isDirectory() ? sourceTests(name) : name.endsWith(".test.ts") ? [name] : [];
  });
}

test("canonical test script registers every source test exactly once, with no missing paths", () => {
  const registered = pkg.scripts.test.match(/src\/[^\s"']+\.test\.ts/g) ?? [];
  assert.equal(new Set(registered).size, registered.length, "duplicate source test registration");
  assert.deepEqual([...registered].sort(), sourceTests("src").sort());
});
