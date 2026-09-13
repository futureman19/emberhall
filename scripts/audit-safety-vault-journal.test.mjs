import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Execute the production primitive. Only durable storage/save boundaries are fake.
const source = await readFile(
  new URL("../src/chain/vault-operation-journal.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { createVaultOperationJournal, vaultOperationJournalKey, VAULT_JOURNAL_MAX_RECORDS } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const txid = "a".repeat(64);
const identity = {
  accountScope: "main:account-a",
  worldId: "world-a",
  operationId: "operation-a",
  action: "redeem",
  inputIdentity: "outpoint-a:0;quantity=1",
};
class FakeStorage {
  data = new Map();
  writes = 0;
  fault = null;
  readError = false;
  async read(key) {
    if (this.readError) throw new Error("read unavailable");
    return this.data.get(key) ?? null;
  }
  async compareAndSet(key, expected, value) {
    this.writes++;
    if (this.fault === "before") throw new Error("quota");
    if ((this.data.get(key) ?? null) !== expected) return false;
    if (this.fault !== "silent") this.data.set(key, value);
    if (this.fault === "after") throw new Error("commit response lost");
    return true;
  }
}
function fixture() {
  const storage = new FakeStorage();
  let context = { accountScope: identity.accountScope, worldId: identity.worldId };
  let saved = { reward: 0, receipts: {} };
  const open = () =>
    createVaultOperationJournal({
      storage,
      getContext: () => context,
      readCommittedReceipt: async (i) => saved.receipts[i.operationId] ?? null,
    });
  return {
    storage,
    open,
    setContext: (c) => {
      context = c;
    },
    get saved() {
      return saved;
    },
    commit(receipt, fail = false) {
      // Model ONE authoritative game-save transaction: receipt check, grant, receipt write.
      const prior = saved.receipts[receipt.operationId];
      if (prior) {
        assert.deepEqual(prior, receipt);
        return;
      }
      const next = {
        reward: saved.reward + 1,
        receipts: { ...saved.receipts, [receipt.operationId]: receipt },
      };
      if (fail) throw new Error("save quota");
      saved = next;
    },
  };
}
async function reach(j, state) {
  await j.prepare(identity);
  if (state === "prepared") return;
  await j.transition(identity, { state: "submitted" });
  if (state === "submitted") return;
  await j.transition(identity, { state: "confirmed", txid });
}
test("durable lifecycle reloads and applies only with a committed matching receipt", async () => {
  const f = fixture();
  let j = f.open();
  assert.deepEqual(await j.list(), []);
  await j.prepare(identity);
  j = f.open();
  assert.equal((await j.list())[0].state, "prepared");
  await j.transition(identity, { state: "submitted" });
  j = f.open();
  assert.equal((await j.list())[0].state, "submitted");
  await j.recordTxid(identity, txid);
  await j.transition(identity, { state: "confirmed", txid });
  j = f.open();
  assert.equal((await j.list())[0].txid, txid);
  await assert.rejects(j.acknowledgeApplied(identity), /receipt/);
  const receipt = await j.applicationReceipt(identity);
  assert.ok(Object.isFrozen(receipt));
  f.commit(receipt);
  await j.acknowledgeApplied(identity);
  j = f.open();
  const writes = f.storage.writes;
  assert.equal((await j.acknowledgeApplied(identity)).state, "applied");
  assert.equal(f.storage.writes, writes);
  assert.equal(f.saved.reward, 1);
  await assert.rejects(j.applicationReceipt(identity), /confirmed/);
  await assert.rejects(j.prepare(identity), /duplicate/);
});
const mutations = [
  ["prepare", null, (j) => j.prepare(identity), "prepared"],
  ["submitted", "prepared", (j) => j.transition(identity, { state: "submitted" }), "submitted"],
  ["txid", "submitted", (j) => j.recordTxid(identity, txid), "submitted"],
  [
    "confirmed",
    "submitted",
    (j) => j.transition(identity, { state: "confirmed", txid }),
    "confirmed",
  ],
  [
    "needs-reconciliation",
    "submitted",
    (j) => j.transition(identity, { state: "needs-reconciliation", txid }),
    "needs-reconciliation",
  ],
  ["applied", "confirmed", (j) => j.acknowledgeApplied(identity), "applied"],
];
for (const [name, before, mutate, after] of mutations)
  for (const fault of ["before", "after", "silent"]) {
    test(`${name}: ${fault}-write failure blocks continuation, reload preserves durable outcome`, async () => {
      const f = fixture();
      const j = f.open();
      if (before) await reach(j, before);
      if (name === "applied") f.commit(await j.applicationReceipt(identity));
      const previous = await f.storage.read(vaultOperationJournalKey(identity.accountScope));
      f.storage.fault = fault;
      let authorized = false;
      await assert.rejects(async () => {
        await mutate(j);
        authorized = true;
      });
      assert.equal(authorized, false);
      await assert.rejects(j.list(), /uncertain/);
      f.storage.fault = null;
      const durable = await f.open().list();
      if (fault === "after") assert.equal(durable[0].state, after);
      else
        assert.equal(
          await f.storage.read(vaultOperationJournalKey(identity.accountScope)),
          previous,
        );
      if (name === "applied") {
        await f.open().acknowledgeApplied(identity);
        assert.equal(f.saved.reward, 1);
      }
    });
  }
test("save failure grants nothing; journal acknowledgement failure never grants twice", async () => {
  const f = fixture();
  let j = f.open();
  await reach(j, "confirmed");
  const receipt = await j.applicationReceipt(identity);
  assert.throws(() => f.commit(receipt, true), /quota/);
  assert.equal(f.saved.reward, 0);
  await assert.rejects(j.acknowledgeApplied(identity), /receipt/);
  f.commit(receipt);
  f.storage.fault = "before";
  await assert.rejects(j.acknowledgeApplied(identity));
  f.storage.fault = null;
  j = f.open();
  f.commit(await j.applicationReceipt(identity));
  await j.acknowledgeApplied(identity);
  assert.equal(f.saved.reward, 1);
});
test("strict transition graph, immutable identity and txid, no retry of ambiguous submit", async () => {
  const f = fixture();
  const j = f.open();
  await reach(j, "prepared");
  await assert.rejects(j.transition(identity, { state: "confirmed", txid }), /transition/);
  await assert.rejects(j.acknowledgeApplied(identity), /confirmed/);
  await assert.rejects(
    j.transition({ ...identity, action: "mint" }, { state: "submitted" }),
    /identity/,
  );
  await assert.rejects(
    j.transition({ ...identity, inputIdentity: "different" }, { state: "submitted" }),
    /identity/,
  );
  await assert.rejects(j.transition(identity, { state: "submitted", txid }), /payload/);
  await j.transition(identity, { state: "submitted" });
  await assert.rejects(f.open().transition(identity, { state: "submitted" }), /transition/);
  await j.recordTxid(identity, txid);
  await assert.rejects(j.recordTxid(identity, txid), /duplicate/);
  await assert.rejects(
    j.transition(identity, { state: "confirmed", txid: "b".repeat(64) }),
    /immutable/,
  );
  await j.transition(identity, { state: "needs-reconciliation" });
  await assert.rejects(j.transition(identity, { state: "submitted" }), /transition/);
  await assert.rejects(j.applicationReceipt(identity), /confirmed/);
  await assert.rejects(
    j.prepare({ ...identity, operationId: "new", inputIdentity: "new" }),
    /unresolved/,
  );
  await j.transition(identity, { state: "confirmed", txid });
  await assert.rejects(j.transition(identity, { state: "confirmed", txid }), /transition/);
});
test("prepared or confirmed can be frozen for reconciliation without erasing txid", async () => {
  for (const state of ["prepared", "confirmed"]) {
    const f = fixture();
    const j = f.open();
    await reach(j, state);
    await j.transition(identity, { state: "needs-reconciliation" });
    const [r] = await f.open().list();
    assert.equal(r.state, "needs-reconciliation");
    assert.equal(r.txid, state === "prepared" ? null : txid);
  }
});
test("stale live context and caller world/account mismatch fail closed", async () => {
  for (const context of [
    { accountScope: "other", worldId: identity.worldId },
    { accountScope: identity.accountScope, worldId: "other" },
  ]) {
    const f = fixture();
    const j = f.open();
    await reach(j, "prepared");
    await assert.rejects(
      j.transition({ ...identity, ...context }, { state: "submitted" }),
      /mismatch/,
    );
    f.setContext(context);
    await assert.rejects(j.transition(identity, { state: "submitted" }), /stale/);
    await assert.rejects(j.list(), /stale/);
    if (context.accountScope === identity.accountScope) {
      const fresh = f.open();
      assert.equal((await fresh.list())[0].worldId, identity.worldId);
      await assert.rejects(
        fresh.prepare({ ...identity, ...context, operationId: "new", inputIdentity: "new" }),
        /unresolved/,
      );
    } else assert.deepEqual(await f.open().list(), []);
  }
});
test("context change during storage await rejects before authorization", async () => {
  const f = fixture();
  const j = f.open();
  await reach(j, "prepared");
  const read = f.storage.read.bind(f.storage);
  f.storage.read = async (key) => {
    const result = await read(key);
    f.setContext({ ...identity, worldId: "new" });
    return result;
  };
  await assert.rejects(j.transition(identity, { state: "submitted" }), /stale/);
});
test("two instances racing submission: atomic CAS allows only one success", async () => {
  const f = fixture();
  await f.open().prepare(identity);
  const outcomes = await Promise.allSettled([
    f.open().transition(identity, { state: "submitted" }),
    f.open().transition(identity, { state: "submitted" }),
  ]);
  assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await f.open().list())[0].state, "submitted");
});
test("malformed/version/duplicate/account/size data is never silently replaced", async () => {
  const valid = {
    version: 1,
    accountScope: identity.accountScope,
    records: [{ ...identity, state: "prepared", txid: null }],
  };
  const corrupt = [
    "{",
    "null",
    "[]",
    JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, accountScope: "other" }),
    JSON.stringify({ ...valid, extra: true }),
    JSON.stringify({ ...valid, records: [...valid.records, ...valid.records] }),
    JSON.stringify({ ...valid, records: [{ ...valid.records[0], state: "confirmed" }] }),
    JSON.stringify({ ...valid, records: [{ ...valid.records[0], accountScope: "other" }] }),
    "x".repeat(256001),
  ];
  for (const raw of corrupt) {
    const f = fixture();
    const key = vaultOperationJournalKey(identity.accountScope);
    f.storage.data.set(key, raw);
    await assert.rejects(f.open().prepare(identity));
    assert.equal(f.storage.writes, 0);
    assert.equal(f.storage.data.get(key), raw);
  }
});
test("read error prevents any journal write or action permission", async () => {
  const f = fixture();
  f.storage.readError = true;
  await assert.rejects(f.open().prepare(identity), /unavailable/);
  assert.equal(f.storage.writes, 0);
});
test("receipt account/world/input/txid/version mismatch never marks applied", async () => {
  for (const change of [
    { accountScope: "other" },
    { worldId: "other" },
    { inputIdentity: "other" },
    { txid: "b".repeat(64) },
    { version: 2 },
  ]) {
    const f = fixture();
    const j = f.open();
    await reach(j, "confirmed");
    f.commit({ ...(await j.applicationReceipt(identity)), ...change });
    await assert.rejects(j.acknowledgeApplied(identity), /receipt/);
    assert.equal((await j.list())[0].state, "confirmed");
  }
});
test("bounded journal never evicts history, and duplicate input survives applied state", async () => {
  const f = fixture();
  const j = f.open();
  for (let n = 0; n < VAULT_JOURNAL_MAX_RECORDS; n++) {
    const i = { ...identity, operationId: `op-${n}`, inputIdentity: `input-${n}` };
    await j.prepare(i);
    await j.transition(i, { state: "submitted" });
    await j.transition(i, { state: "confirmed", txid });
    f.commit(await j.applicationReceipt(i));
    await j.acknowledgeApplied(i);
    if (n === 0)
      await assert.rejects(j.prepare({ ...i, operationId: "different-id" }), /duplicate/);
  }
  const raw = await f.storage.read(vaultOperationJournalKey(identity.accountScope));
  await assert.rejects(j.prepare(identity), /capacity/);
  assert.equal((await f.open().list()).length, VAULT_JOURNAL_MAX_RECORDS);
  assert.equal(await f.storage.read(vaultOperationJournalKey(identity.accountScope)), raw);
});
