import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
test("You and every side panel share one accessible drawer shell", () => {
  assert.ok(existsSync(new URL("../src/components/game/chrome/drawer-shell.tsx", import.meta.url)), "shared drawer shell exists");
  const shell = read("src/components/game/chrome/drawer-shell.tsx");
  assert.match(shell, /usePanelA11y<HTMLDivElement>\(onClose\)/);
  assert.match(shell, /drawer-in/);
  assert.match(shell, /bottom-\[var\(--corner-clear\)\]/);
  for (const p of ["hud.tsx", "chrome/you-drawer.tsx"]) assert.match(read(`src/components/game/${p}`), /<DrawerShell/);
});
test("mobile vitals do not paint over an open drawer", () => {
  const band = read("src/components/game/chrome/band.tsx");
  assert.doesNotMatch(band.split("function VitalsStrip")[0], /fixed top-3 left-3 z-10/);
});
test("reading and top anchored gumps clear the frame", () => {
  for (const name of ["spell", "pets", "vault", "craft"]) {
    const source = read(`src/components/game/${name}-gump.tsx`);
    assert.ok(source.includes("var(--corner-clear)"), name);
    assert.ok(source.includes("md:right-[68px]"), name);
  }
  assert.match(read("src/components/game/spell-gump.tsx"), /parchment-panel/);
});
test("drawer covers rail controls and parchment wins over the generic frame material", () => {
  assert.doesNotMatch(read("src/components/game/chrome/rail.tsx"), /z-10/);
  assert.match(read("src/styles.css"), /\.classic-ui > \.pointer-events-auto\.parchment-panel/);
});
test("classic chrome has tokenized materials, parchment, faceted vitals and reduced entrances", () => {
  const css = read("src/styles.css");
  for (const token of ["stone", "parchment", "ink", "health", "mana"]) assert.match(css, new RegExp(`--color-${token}:`));
  for (const marker of ["classic-frame", "parchment-panel", "surface-in"]) assert.ok(css.includes(marker), marker);
  assert.match(css, /\[data-effects="reduced"\] \.surface-in/);
  const hud = read("src/components/game/hud.tsx");
  for (const fn of ["SelectedCard", "GhostBanner"]) assert.match(hud.slice(hud.indexOf(`function ${fn}`)).split("\nfunction ")[0], /surface-in/);
  assert.match(read("src/routes/__root.tsx"), /family=Cinzel/);
  for (const p of ["chrome/band.tsx", "chrome/rail.tsx", "chrome/docked-minimap.tsx", "hud.tsx"]) assert.doesNotMatch(read(`src/components/game/${p}`), /#[0-9a-fA-F]{3,8}\b/);
});
