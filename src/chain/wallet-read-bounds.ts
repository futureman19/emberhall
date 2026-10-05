/** Read-only resource limits. Exceeding one is incomplete data, never empty holdings. */
export const WALLET_READ_LIMITS = Object.freeze({ pageSize: 200, pages: 5, outputs: 1000, contentBytes: 256_000, cacheEntries: 128, contentMs: 8000, scanMs: 30_000 });

export function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException("Read aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    // Attach handlers even when already aborted: late SDK rejection must be consumed.
    pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

export async function readBoundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.ok) throw new Error(`Inscription content unavailable (HTTP ${response.status}).`);
  const mime = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const declaredJson = mime === "application/json" || mime.endsWith("+json");
  // Successfully fetched media is a foreign inscription, not a failed game read.
  if (/^(image|audio|video|font)\//.test(mime) || mime === "application/pdf") {
    void response.body?.cancel().catch(() => {});
    signal.throwIfAborted();
    return null;
  }
  const size = response.headers.get("content-length");
  if (size !== null && (!/^\d+$/.test(size) || Number(size) > WALLET_READ_LIMITS.contentBytes)) {
    void response.body?.cancel().catch(() => {});
    throw new Error("Inscription content exceeds the byte limit.");
  }
  if (!response.body) throw new Error("Inscription content unavailable (missing body).");
  const reader = response.body.getReader();
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > WALLET_READ_LIMITS.contentBytes) throw new Error("Inscription content exceeds the byte limit.");
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    signal.throwIfAborted();
    // JSON objects/arrays remain strict even when a CDN serves text/plain.
    // Do not turn a truncated game payload into successful empty holdings.
    if (!declaredJson && !/^[\s\uFEFF]*[[{]/.test(text)) return null;
    return JSON.parse(text);
  } finally {
    // Do not await a hostile/stalled stream's cancellation callback.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readOrdinalPages<T extends { outpoint: string; tags?: string[] }>(
  query: (input: { includeTags: true; limit: number; offset: number }) => Promise<unknown>,
  signal: AbortSignal,
): Promise<T[]> {
  const outputs: T[] = [];
  const seen = new Set<string>();
  let expected: number | undefined;
  for (let pageIndex = 0; pageIndex < WALLET_READ_LIMITS.pages; pageIndex++) {
    signal.throwIfAborted();
    const page = await abortable(query({ includeTags: true, limit: WALLET_READ_LIMITS.pageSize, offset: outputs.length }), signal);
    if (!page || typeof page !== "object" || !("outputs" in page) || !Array.isArray(page.outputs)) throw new Error("Malformed wallet outputs response.");
    const rows: unknown[] = page.outputs;
    const total = "totalOutputs" in page ? page.totalOutputs : undefined;
    if (total !== undefined && (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0 || total > WALLET_READ_LIMITS.outputs)) throw new Error("Wallet total exceeds the read limit or is invalid.");
    if (pageIndex > 0 && total !== expected) throw new Error("Wallet totals changed during the read; retry.");
    expected = total as number | undefined;
    if (rows.length > WALLET_READ_LIMITS.pageSize || outputs.length + rows.length > WALLET_READ_LIMITS.outputs) throw new Error("Wallet page exceeds the read limit.");
    for (const row of rows) {
      if (!row || typeof row !== "object" || !("outpoint" in row) || typeof row.outpoint !== "string" || !/^[0-9a-f]{64}\.\d+$/i.test(row.outpoint) || !("tags" in row) || !Array.isArray(row.tags) || row.tags.length > 128 || row.tags.some((tag) => typeof tag !== "string" || tag.length > 1024)) throw new Error("Malformed wallet output metadata.");
      if (seen.has(row.outpoint)) throw new Error("Duplicate wallet output; pagination did not progress.");
      seen.add(row.outpoint);
      outputs.push(row as T);
    }
    if (expected !== undefined) {
      if (outputs.length > expected || (rows.length === 0 && outputs.length < expected)) throw new Error("Incomplete wallet page; retry.");
      if (outputs.length === expected) return outputs;
    } else if (rows.length < WALLET_READ_LIMITS.pageSize) {
      // SDK total is optional. A full page without a total requires another page.
      return outputs;
    }
  }
  throw new Error("Wallet scan reached its page limit; holdings are incomplete.");
}
