import type { LedgerEntry, TrackedListing } from "../game/vault.ts";

/** Public identity key is supplied by the provider; never adopt legacy global records. */
export function walletScope(identityKey: string | null, network = "main"): string | null {
  if (!identityKey || !/^(02|03)[0-9a-f]{64}$/i.test(identityKey)) return null;
  return `${encodeURIComponent(network)}:${identityKey.toLowerCase()}`;
}

const walletIds = new WeakMap<object, number>();
let nextWalletId = 0;
export function walletSessionKey(wallet: object | null, scope: string | null, status: string): string {
  if (wallet && !walletIds.has(wallet)) walletIds.set(wallet, ++nextWalletId);
  return `${status}:${scope ?? "unknown"}:${wallet ? walletIds.get(wallet) : "none"}`;
}

export function walletRecordKey(scope: string, kind: "ledger" | "listings"): string {
  return `emberhall-vault-${kind}:v2:${scope}`;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 512;
const at = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
const sats = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
export function isLedgerEntry(value: unknown): value is LedgerEntry {
  return record(value) && text(value.label) && at(value.at) && ["mint", "list", "redeem", "cancel"].includes(String(value.kind)) && (value.sats === undefined || sats(value.sats));
}
export function isTrackedListing(value: unknown): value is TrackedListing {
  return record(value) && text(value.id) && /^[0-9a-f]{64}\.\d+$/i.test(value.id) && text(value.label) && at(value.at) && sats(value.sats);
}
export function loadWalletRecords<T>(storage: Pick<Storage, "getItem">, scope: string, kind: "ledger" | "listings", valid: (value: unknown) => value is T): T[] {
  const raw = storage.getItem(walletRecordKey(scope, kind));
  if (raw === null) return [];
  if (raw.length > 256_000) throw new Error("Wallet history is too large to read.");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > 1000 || !parsed.every(valid)) throw new Error("Wallet history is damaged; it was not loaded.");
  return parsed;
}

/** A new request, disconnect, account change or close invalidates every old ticket. */
export function createReadEpoch() {
  let controller = new AbortController();
  let generation = 0;
  return {
    invalidate() { generation++; controller.abort(); },
    begin() {
      controller.abort();
      controller = new AbortController();
      const ticket = ++generation;
      const signal = controller.signal;
      return { signal, current: () => ticket === generation && !signal.aborted };
    },
  };
}
