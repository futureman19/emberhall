import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { collectInventory, auditLedger, makeLedger, refreshLedger } from "../../../scripts/audit-art-coverage.mjs";
import type { Ledger, LedgerAsset } from "../../../scripts/audit-art-coverage.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const inventory = collectInventory({ root });
const ledger: Ledger = JSON.parse(
  readFileSync(new URL("../../../art/asset-ledger.json", import.meta.url), "utf8"),
);

test("committed first-pass ledger covers the current AST inventory", () => {
  assert.deepEqual(auditLedger(ledger, inventory), []);
  for (const family of [
    "building",
    "fauna",
    "item",
    "class",
    "npc",
    "resource",
    "crop",
    "herb",
    "tile",
    "biome",
    "craft-form",
    "exact-recipe",
    "look-skin",
    "look-hair",
    "look-garb",
    "renderer",
    "ui",
    "state-vocabulary",
  ]) {
    assert.ok(
      inventory.rows.some((row) => row.family === family),
      `missing family ${family}`,
    );
  }
  assert.ok(
    inventory.rows.some(
      (row) => row.id.includes("world-scene.tsx") && row.canonicalId.includes("Fx"),
    ),
  );
  assert.ok(inventory.rows.some((row) => row.id.includes("sky.tsx")));
  assert.ok(inventory.rows.some((row) => row.id.includes("weather-fx.tsx")));
});

test("AST/checker follows indexed aliases, satisfies, spread catalogs and anonymous JSX", () => {
  const changed = collectInventory({
    root,
    overrides: {
      "src/game/art-audit-fixture.ts": `const KEYS = ["first", "second"] as const; export type AuditFixtureKind = (typeof KEYS)[number]; const base = { first: { label: "One" } }; export const AUDIT_FIXTURE_META = { ...base, second: { label: "Two" } } satisfies Record<AuditFixtureKind, {label: string}>;`,
      "src/components/game/art-audit-fixture.tsx": `export const NewRenderer = () => <group name="unmapped-new-prop"><mesh /></group>; function NewProceduralBuilder() { return [{ shape: "box" }]; }`,
    },
  });
  const errors = auditLedger(ledger, changed);
  assert.ok(
    errors.some((error) => error.includes("first")),
    errors.join("\n"),
  );
  assert.ok(
    errors.some((error) => error.includes("NewRenderer")),
    errors.join("\n"),
  );
  assert.ok(
    errors.some((error) => error.includes("unmapped-new-prop")),
    errors.join("\n"),
  );
  assert.ok(
    errors.some((error) => error.includes("NewProceduralBuilder")),
    errors.join("\n"),
  );
  assert.deepEqual(changed.catalogs.AUDIT_FIXTURE_META, ["first", "second"]);
  assert.ok(
    !inventory.rows.some(
      (row) =>
        row.family.startsWith("catalog/") &&
        ["toString", "charAt", "toFixed"].includes(row.canonicalId),
    ),
  );
  const changedTags = structuredClone(inventory);
  const taggedRow = changedTags.rows.find((row) => row.jsxTags?.length);
  assert.ok(taggedRow?.jsxTags?.length, "fixture must contain a JSX renderer");
  taggedRow.jsxTags.push("NewUnmappedVisual");
  assert.ok(auditLedger(ledger, changedTags).some((error) => error.includes("NewUnmappedVisual")));
});

test("coverage rejects deletions, duplicates, absent states, fabricated completion and missing metadata", () => {
  const missing = structuredClone(ledger);
  missing.assets.pop();
  assert.ok(auditLedger(missing, inventory).some((error) => error.includes("unmapped")));
  const duplicate = structuredClone(ledger);
  duplicate.assets.push(duplicate.assets[0]);
  assert.ok(auditLedger(duplicate, inventory).some((error) => error.includes("duplicate")));
  const state = structuredClone(ledger);
  const building = state.assets.find((row) => row.family === "building");
  assert.ok(building, "fixture must contain a building");
  building.states.pop();
  assert.ok(auditLedger(state, inventory).some((error) => error.includes("state")));
  const bogus: Omit<Ledger, "assets"> & {
    assets: (Omit<LedgerAsset, "status" | "metrics"> & {
      status: string;
      metrics?: LedgerAsset["metrics"];
    })[];
  } = structuredClone(ledger);
  bogus.assets[0].status = "complete";
  delete bogus.assets[0].metrics;
  assert.ok(auditLedger(bogus, inventory).some((error) => error.includes("status")));
  assert.ok(auditLedger(bogus, inventory).some((error) => error.includes("metrics")));
});

test("refresh preserves reviewed evidence and rejects reviewed removals", () => {
  const prior = makeLedger(inventory);
  const row = prior.assets[0];
  row.status = "verified";
  row.reviewEvidence = ["fixture-only review"];
  row.metrics.bytes = 123;
  row.states[0].status = "approved";
  row.states[0].reviewEvidence = ["fixture-only human acceptance"];
  const refreshed = refreshLedger(inventory, prior);
  assert.deepEqual(refreshed.assets[0], row);
  assert.deepEqual(auditLedger(refreshed, inventory), []);
  const removed = structuredClone(inventory);
  removed.rows.shift();
  assert.throws(() => refreshLedger(removed, prior), /reviewed stale asset/);
  const missingLocation = structuredClone(prior);
  missingLocation.assets[0].catalogSources = [];
  assert.ok(auditLedger(missingLocation, inventory).some((error) => error.includes("catalogSources")));
});

test("generator is deterministic and refuses to turn inventory into approval", () => {
  assert.deepEqual(makeLedger(inventory), makeLedger(inventory));
  const generated = makeLedger(inventory);
  assert.ok(generated.assets.every((row) => row.status === "inventoried"));
  assert.ok(
    generated.assets.every((row) => row.states.every((state) => state.status === "inventoried")),
  );
  assert.deepEqual(auditLedger(generated, inventory), []);
});
