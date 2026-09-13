import assert from "node:assert/strict";
import test from "node:test";
import { collectInventory, makeLedger, refreshLedger, auditLedger } from "./audit-art-coverage.mjs";

const fixture = () => ({
  extractor: "fixture", files: [], catalogs: {}, diagnostics: [],
  rows: [{ id: "renderer:fixture", canonicalId: "fixture", family: "renderer",
    sources: ["fixture.tsx:1"], sourceNames: ["fixture"], rendererLocations: [],
    surfaces: [], states: ["present", "predicate:active &&\n ready"] }],
});

for (const status of ["approved", "verified", "retained-by-decision", "inventoried"]) {
  test(`mixed ledger EOL preserves ${status} evidence without approving additions`, () => {
    const inventory = fixture();
    const prior = makeLedger(inventory);
    const row = prior.assets[0];
    row.status = status;
    row.reviewEvidence = ["fixture-only row review"];
    row.metrics.bytes = 123;
    row.notes = "fixture-only notes";
    const state = row.states[1];
    state.id = state.id.replaceAll("\n", "\r\n");
    state.status = status;
    state.reviewEvidence = ["fixture-only state review"];
    state.evidence = ["historical.tsx:42"];
    state.applicability = "fixture-only applicability";
    const untouched = structuredClone(prior);
    assert.deepEqual(auditLedger(prior, inventory), []);
    inventory.rows[0].states.push("predicate:newCondition");
    const refreshed = refreshLedger(inventory, prior);
    assert.deepEqual(prior, untouched);
    assert.deepEqual(refreshed.assets[0], { ...row, states: [row.states[0],
      { ...state, id: "predicate:active &&\n ready" },
      makeLedger(inventory).assets[0].states[2]] });
    assert.equal(refreshed.assets[0].states[2].status, "inventoried");
    assert.equal(refreshed.assets[0].states[2].reviewEvidence, undefined);
    assert.deepEqual(auditLedger(refreshed, inventory), []);
    assert.deepEqual(refreshLedger(inventory, refreshed), refreshed);
    const removedState = structuredClone(inventory);
    removedState.rows[0].states[1] = "predicate:active ||\n ready";
    assert.throws(() => refreshLedger(removedState, prior), /reviewed stale state/);
    assert.throws(() => refreshLedger({ ...inventory, rows: [] }, prior), /reviewed stale asset/);
  });
}

test("canonical EOL collisions fail closed rather than discard evidence", () => {
  const inventory = fixture();
  const prior = makeLedger(inventory);
  const state = prior.assets[0].states[1];
  prior.assets[0].states.push({ ...state, id: state.id.replaceAll("\n", "\r\n"),
    status: "approved", reviewEvidence: ["fixture-only distinct evidence"] });
  assert.ok(auditLedger(prior, inventory).some((error) => error.includes("duplicate state")));
  assert.throws(() => refreshLedger(inventory, prior), /duplicate canonical state/);
});

test("art predicate identities are independent of LF versus CRLF checkouts", () => {
  const file = "src/components/game/audit-eol-fixture.tsx";
  const lf = "export function EolRenderer({ active }: { active: boolean }) { if (active &&\n true) return <mesh />; return null; }\n";
  const select = (text) => collectInventory({ overrides: { [file]: text } }).rows.filter((row) => row.id.includes("audit-eol-fixture"));
  assert.deepEqual(select(lf.replaceAll("\n", "\r\n")), select(lf));
});
