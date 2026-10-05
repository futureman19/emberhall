/** Recovery groundwork only: no wallet calls and no game-state mutation.
 * Storage MUST provide durable, atomic compare-and-set across all tabs/writers.
 * Plain localStorage getItem/setItem is NOT a valid adapter. See the integration plan.
 */
export interface VaultJournalStorage {
  read(key: string): Promise<string | null>;
  compareAndSet(key: string, expected: string | null, value: string): Promise<boolean>;
}

export interface VaultJournalContext {
  readonly accountScope: string;
  readonly worldId: string;
}
export interface VaultOperationIdentity extends VaultJournalContext {
  readonly operationId: string;
  readonly action: "mint" | "list" | "redeem" | "cancel";
  /** Canonical identity of the exact inputs, including quantities/parameters. */
  readonly inputIdentity: string;
}
export type VaultOperationState =
  "prepared" | "submitted" | "confirmed" | "applied" | "needs-reconciliation";
export interface VaultOperationRecord extends VaultOperationIdentity {
  readonly state: VaultOperationState;
  readonly txid: string | null;
}
export interface VaultApplicationReceipt extends VaultOperationIdentity {
  readonly version: 1;
  readonly txid: string;
}
export type VaultJournalTransition =
  | { readonly state: "submitted" }
  | { readonly state: "confirmed"; readonly txid: string }
  | { readonly state: "needs-reconciliation"; readonly txid?: string };

export const VAULT_JOURNAL_MAX_RECORDS = 128;
const MAX_CHARS = 256_000;
const identityKeys = ["accountScope", "worldId", "operationId", "action", "inputIdentity"] as const;
const actions = ["mint", "list", "redeem", "cancel"];
const states = ["prepared", "submitted", "confirmed", "applied", "needs-reconciliation"];
function fail(message: string): never {
  throw new Error(`Vault journal: ${message}`);
}
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 512 && v.trim() === v;
const txidValid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
function keys(v: Record<string, unknown>, expected: readonly string[]) {
  return Object.keys(v).length === expected.length && expected.every((k) => Object.hasOwn(v, k));
}
function identityValid(v: unknown): v is VaultOperationIdentity {
  return object(v) && identityKeys.every((k) => text(v[k])) && actions.includes(String(v.action));
}
function sameIdentity(a: VaultOperationIdentity, b: VaultOperationIdentity) {
  return identityKeys.every((k) => a[k] === b[k]);
}
function receiptValid(v: unknown): v is VaultApplicationReceipt {
  return (
    object(v) &&
    keys(v, [...identityKeys, "version", "txid"]) &&
    identityValid(v) &&
    v.version === 1 &&
    txidValid(v.txid)
  );
}
export function vaultOperationJournalKey(accountScope: string): string {
  if (!text(accountScope)) fail("invalid account scope");
  return `emberhall-vault-operations:v1:${encodeURIComponent(accountScope)}`;
}

/** All errors block continuation. Never catch an error and proceed with a signature.
 * getContext must report the LIVE account and persistent world ID, not a captured UI value.
 * readCommittedReceipt must read the authoritative saved game, not in-memory state.
 */
export function createVaultOperationJournal(options: {
  storage: VaultJournalStorage;
  getContext: () => VaultJournalContext;
  readCommittedReceipt: (identity: VaultOperationIdentity) => Promise<unknown>;
}) {
  const bound = { ...options.getContext() };
  if (!text(bound.accountScope) || !text(bound.worldId)) fail("invalid context");
  const key = vaultOperationJournalKey(bound.accountScope);
  let poisoned = false;
  function current() {
    if (poisoned) fail("storage outcome uncertain; reopen and reconcile");
    const live = options.getContext();
    if (live.accountScope !== bound.accountScope || live.worldId !== bound.worldId)
      fail("stale account/world context");
  }
  function checkIdentity(identity: VaultOperationIdentity) {
    current();
    if (
      !identityValid(identity) ||
      !keys(identity as unknown as Record<string, unknown>, identityKeys)
    )
      fail("invalid identity");
    if (identity.accountScope !== bound.accountScope || identity.worldId !== bound.worldId)
      fail("account/world mismatch");
  }
  function decode(raw: string | null): VaultOperationRecord[] {
    if (raw === null) return [];
    if (raw.length > MAX_CHARS) fail("size limit exceeded");
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      !keys(value, ["version", "accountScope", "records"]) ||
      value.version !== 1 ||
      value.accountScope !== bound.accountScope ||
      !Array.isArray(value.records) ||
      value.records.length > VAULT_JOURNAL_MAX_RECORDS
    )
      fail("corrupt/version/account envelope");
    const ids = new Set<string>();
    const inputs = new Set<string>();
    for (const r of value.records) {
      if (
        !object(r) ||
        !keys(r, [...identityKeys, "state", "txid"]) ||
        !identityValid(r) ||
        r.accountScope !== bound.accountScope ||
        !states.includes(String(r.state)) ||
        (r.txid !== null && !txidValid(r.txid)) ||
        (r.state === "prepared" && r.txid !== null) ||
        (["confirmed", "applied"].includes(String(r.state)) && !txidValid(r.txid))
      )
        fail("corrupt record");
      const input = JSON.stringify([r.worldId, r.action, r.inputIdentity]);
      if (ids.has(r.operationId) || inputs.has(input)) fail("duplicate record/input");
      ids.add(r.operationId);
      inputs.add(input);
    }
    if (value.records.filter((r) => r.state !== "applied").length > 1)
      fail("multiple unresolved operations");
    return value.records as VaultOperationRecord[];
  }
  async function load() {
    current();
    try {
      const raw = await options.storage.read(key);
      current();
      return { raw, records: decode(raw) };
    } catch (error) {
      poisoned = true;
      throw error;
    }
  }
  async function persist(raw: string | null, records: VaultOperationRecord[]) {
    current();
    const next = JSON.stringify({ version: 1, accountScope: bound.accountScope, records });
    decode(next);
    try {
      if (!(await options.storage.compareAndSet(key, raw, next)))
        fail("concurrent update; reload without retrying action");
      current();
      if ((await options.storage.read(key)) !== next) fail("write readback mismatch");
      current();
    } catch (error) {
      poisoned = true;
      throw error;
    }
  }
  function locate(records: VaultOperationRecord[], identity: VaultOperationIdentity) {
    const index = records.findIndex((r) => r.operationId === identity.operationId);
    if (index < 0 || !sameIdentity(records[index], identity))
      fail("unknown operation or immutable identity mismatch");
    return index;
  }
  async function receiptFor(identity: VaultOperationIdentity): Promise<VaultApplicationReceipt> {
    identity = Object.freeze({ ...identity });
    checkIdentity(identity);
    const { records } = await load();
    const r = records[locate(records, identity)];
    if (r.state !== "confirmed" || !r.txid) fail("application requires confirmed operation");
    return Object.freeze({ ...identity, version: 1 as const, txid: r.txid });
  }
  return {
    /** Inspection only: recovered submitted/prepared records never authorize a wallet retry.
     * Includes historical worlds so a reset cannot hide unresolved operations. */
    async list(): Promise<readonly VaultOperationRecord[]> {
      return Object.freeze((await load()).records.map((r) => Object.freeze(r)));
    },
    async prepare(identity: VaultOperationIdentity): Promise<VaultOperationRecord> {
      identity = Object.freeze({ ...identity });
      checkIdentity(identity);
      const { raw, records } = await load();
      if (records.length >= VAULT_JOURNAL_MAX_RECORDS)
        fail("capacity reached; no records were pruned");
      if (
        records.some(
          (r) =>
            r.operationId === identity.operationId ||
            (r.worldId === identity.worldId &&
              r.action === identity.action &&
              r.inputIdentity === identity.inputIdentity),
        )
      )
        fail("duplicate operation/input");
      if (records.some((r) => r.state !== "applied"))
        fail("unresolved operation requires reconciliation (possibly another world)");
      const next: VaultOperationRecord = { ...identity, state: "prepared", txid: null };
      await persist(raw, [...records, next]);
      return Object.freeze(next);
    },
    /** Persist submitted BEFORE the one user-authorized wallet invocation. It means
     * submission may have happened, including a crash before the invocation itself.
     * confirmed requires caller-supplied verified chain evidence, not broadcast acceptance. */
    async transition(
      identity: VaultOperationIdentity,
      update: VaultJournalTransition,
    ): Promise<VaultOperationRecord> {
      identity = Object.freeze({ ...identity });
      checkIdentity(identity);
      if (
        !object(update) ||
        !["submitted", "confirmed", "needs-reconciliation"].includes(String(update.state)) ||
        !keys(
          update,
          update.state === "submitted"
            ? ["state"]
            : update.state === "confirmed" || Object.hasOwn(update, "txid")
              ? ["state", "txid"]
              : ["state"],
        )
      )
        fail("invalid transition payload");
      update = Object.freeze({ ...update });
      if ("txid" in update && !txidValid(update.txid)) fail("invalid txid");
      const { raw, records } = await load();
      const index = locate(records, identity);
      const old = records[index];
      const allowed =
        update.state === "submitted"
          ? old.state === "prepared"
          : update.state === "confirmed"
            ? ["submitted", "needs-reconciliation"].includes(old.state)
            : ["prepared", "submitted", "confirmed"].includes(old.state);
      if (!allowed) fail("invalid/duplicate transition");
      const txid = "txid" in update ? (update.txid ?? old.txid) : old.txid;
      if (old.txid !== null && txid !== old.txid) fail("immutable txid mismatch");
      const next = { ...old, state: update.state, txid };
      records[index] = next;
      await persist(raw, records);
      return Object.freeze(next);
    },
    /** Persist a newly learned txid without claiming confirmation. */
    async recordTxid(
      identity: VaultOperationIdentity,
      txid: string,
    ): Promise<VaultOperationRecord> {
      identity = Object.freeze({ ...identity });
      checkIdentity(identity);
      if (!txidValid(txid)) fail("invalid txid");
      const { raw, records } = await load();
      const index = locate(records, identity);
      const old = records[index];
      if (!["submitted", "needs-reconciliation"].includes(old.state) || old.txid !== null)
        fail("invalid/duplicate txid attachment");
      const next = { ...old, txid };
      records[index] = next;
      await persist(raw, records);
      return Object.freeze(next);
    },
    applicationReceipt: receiptFor,
    /** Bookkeeping only. NEVER grant the reward here. The receipt and reward must
     * already be atomically committed in the SAME saved-game transaction. */
    async acknowledgeApplied(identity: VaultOperationIdentity): Promise<VaultOperationRecord> {
      identity = Object.freeze({ ...identity });
      checkIdentity(identity);
      const { raw, records } = await load();
      const index = locate(records, identity);
      const old = records[index];
      if (!["confirmed", "applied"].includes(old.state))
        fail("application requires confirmed operation");
      const receipt = await options.readCommittedReceipt(Object.freeze({ ...identity }));
      current();
      if (!receiptValid(receipt) || !sameIdentity(receipt, old) || receipt.txid !== old.txid)
        fail("missing/mismatched committed game-save receipt");
      if (old.state === "applied") return Object.freeze(old); // No game mutation or journal write.
      const next: VaultOperationRecord = { ...old, state: "applied" };
      records[index] = next;
      await persist(raw, records);
      return Object.freeze(next);
    },
  };
}
