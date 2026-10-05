import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const approved = {"band": "639ec8cfee15a28a36ee119999cbf8ec8b6e5baee9434bc2bd0fa5d08bd52441", "corner": "e52a95dacf669232b890e8d6a4a2763a7bef4d9ad939b6131c35029a028a8a89", "button": "f175642463664cca05d88a1f8dda284cac740a982d2257832fbbac8cefab4066"};
test("shipped oak textures are the exact user-approved Blender exports", () => {
  assert.ok(existsSync(new URL("public/art/gui/forged-oak/manifest.json", root)), "oak assets integrated");
  const manifest = JSON.parse(read("public/art/gui/forged-oak/manifest.json"));
  for (const [name, hash] of Object.entries(approved)) {
    const png = readFileSync(new URL(`public/art/gui/forged-oak/${name}.png`, root));
    assert.equal(createHash("sha256").update(png).digest("hex"), hash);
    assert.equal(manifest.assets.find((a) => a.name === name).sha256, hash);
    assert.equal(png.readUInt32BE(16), name === "band" ? 1024 : name === "corner" ? 336 : 132);
    assert.equal(png.readUInt32BE(20), name === "band" ? 120 : name === "corner" ? 336 : 132);
  }
  assert.ok(existsSync(new URL(manifest.source.blend, root)));
  assert.ok(existsSync(new URL(manifest.source.script, root)));
});
test("oak CSS keeps geometry, tokens, pointer pass-through and readable text labels", () => {
  assert.ok(existsSync(new URL("src/styles/forged-oak.css", root)), "oak stylesheet integrated");
  const css = read("src/styles/forged-oak.css");
  assert.match(read("src/styles.css"), /@import "\.\/styles\/forged-oak.css"/);
  assert.match(css, /--oak-band:/);
  assert.match(css, /button:not\(\[aria-label="Open the vale map"\]\)/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /\[aria-label="Open the vale map"\] \+ p\s*\{[^}]*background-color:\s*var\(--color-bg\)/, "small clock text must be backed, not written across brass trim");
  assert.match(css, /border-top-color: transparent/);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|!important|z-index|border-top:\s*0/);
});
