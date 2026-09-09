/** Typed public boundary for the JavaScript Phase 0 AST inventory CLI. */
export interface InventoryRow {
  id: string;
  family: string;
  canonicalId: string;
  sources: string[];
  sourceNames: string[];
  rendererLocations: string[];
  surfaces: string[];
  states: string[];
  jsxTags?: string[];
}

export interface Inventory {
  schemaVersion: 1;
  extractor: "typescript-ast-checker/1";
  files: string[];
  catalogs: Record<string, string[]>;
  diagnostics: string[];
  rows: InventoryRow[];
}

export type ReviewStatus =
  | "inventoried"
  | "authored"
  | "integrated"
  | "verified"
  | "approved"
  | "retained-by-decision"
  | "blocked";

/** Review metadata is JSON-persisted; Phase 0 does not prescribe its schema. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface AssetSource {
  blend: string | null;
  script: string | null;
  export: string | null;
  parts: JsonValue;
  materials: JsonValue;
  attachments: JsonValue;
  lods: JsonValue;
  reference?: string;
  scope?: string;
}

export interface AssetMetrics {
  bounds: JsonValue;
  bytes: number | null;
  triangles: number | null;
  materialSlots: number | null;
}

export interface LedgerState {
  id: string;
  status: ReviewStatus;
  evidence: string[];
  applicability: string;
  reviewEvidence?: string[];
}

export interface LedgerAsset {
  id: string;
  canonicalId: string;
  family: string;
  catalogSources: string[];
  sourceNames: string[];
  rendererLocations: string[];
  rendererMapping: string;
  surfaces: string[];
  jsxTags: string[] | null;
  states: LedgerState[];
  source: AssetSource;
  metrics: AssetMetrics;
  status: ReviewStatus;
  evidence: string[];
  batchOwner: string;
  notes: string;
  reviewEvidence?: string[];
}

export interface Ledger {
  schemaVersion: 1;
  inventoryVersion: string;
  extractor: string;
  scope: string;
  sourceFiles: string[];
  catalogCounts: Record<string, number>;
  omissions: string[];
  assets: LedgerAsset[];
}

/** The validator also accepts incomplete records and invalid status strings. */
export type AuditState = Omit<Partial<LedgerState>, "status"> & { status?: string };
export type AuditAsset = Omit<Partial<LedgerAsset>, "status" | "states" | "metrics" | "source"> & {
  status?: string;
  states?: AuditState[];
  metrics?: Partial<AssetMetrics>;
  source?: Partial<AssetSource>;
};
export type AuditLedgerInput = Omit<Partial<Ledger>, "schemaVersion" | "assets"> & {
  schemaVersion?: number;
  assets?: AuditAsset[];
};

export interface InventorySummary {
  inventoryVersion: string;
  assets: number;
  uniqueIds: number;
  states: number;
  sourceFiles: number;
  families: Record<string, number>;
  catalogCounts: Record<string, number>;
}

export function collectInventory(options?: {
  root?: string;
  overrides?: Record<string, string>;
}): Inventory;
export function makeLedger(inventory: Inventory): Ledger;
export function refreshLedger(inventory: Inventory, previous: Ledger): Ledger;
export function auditLedger(ledger: AuditLedgerInput, inventory: Inventory): string[];
export function summarize(inventory: Inventory, ledger: Ledger): InventorySummary;
