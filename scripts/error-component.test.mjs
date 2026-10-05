import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const source = fs.readFileSync("src/lib/error-component.tsx", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
const exports = {};
vm.runInNewContext(outputText, { exports, require, Error });
const fallback = "An unexpected error occurred. Try reloading the page.";
for (const [name, error, expected] of [
  ["Error message", new Error("Example failure"), "Example failure"],
  ["empty Error", new Error(""), fallback],
  ["null", null, fallback],
  ["undefined", undefined, fallback],
  ["string", "unexpected thrown value", fallback],
  ["object", { message: 123 }, fallback],
]) {
  test(`error component handles ${name}`, () => {
    const element = exports.AppErrorComponent({ error });
    assert.equal(element.props.children[2].props.children, expected);
  });
}
test("explicit test paths exist", () => {
  const command = JSON.parse(fs.readFileSync("package.json", "utf8")).scripts.test;
  const paths = command.split(/\s+/).filter((p) => p.endsWith(".test.ts"));
  assert.ok(paths.length > 0);
  for (const path of paths) assert.ok(fs.existsSync(path), `Missing test path: ${path}`);
});
