/** Server-only: check every DNS answer, pin connection, retain TLS identity.
 * Buffer responses before resolving so both abort and size limits cover bodies. */
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

const MAX_BODY = 1024 * 1024;
class MindEgressError extends Error {}
const blocked = () => new MindEgressError("Mind endpoint blocked");
const aborted = () => {
  const error = new MindEgressError("Mind request aborted");
  error.name = "AbortError";
  return error;
};
type IP = { value: bigint; bits: number };
function ipNumber(address: string): IP | null {
  const family = isIP(address);
  if (family === 4)
    return {
      value: address.split(".").reduce((n, octet) => (n << 8n) | BigInt(octet), 0n),
      bits: 32,
    };
  if (family !== 6 || address.includes("%")) return null;
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const a = left ? left.split(":") : [];
  const b = right ? right.split(":") : [];
  const words =
    right === undefined ? a : [...a, ...Array<string>(8 - a.length - b.length).fill("0"), ...b];
  return { value: words.reduce((n, word) => (n << 16n) | BigInt(`0x${word}`), 0n), bits: 128 };
}
function within(address: IP, base: string, prefix: number): boolean {
  const network = ipNumber(base)!;
  return (
    address.bits === network.bits &&
    address.value >> BigInt(address.bits - prefix) ===
      network.value >> BigInt(address.bits - prefix)
  );
}
function classify(address: string): { public: boolean; metadata: boolean } {
  let ip = ipNumber(address);
  if (!ip) return { public: false, metadata: true };
  if (ip.bits === 128 && within(ip, "::ffff:0:0", 96))
    ip = { value: ip.value & 0xffffffffn, bits: 32 };
  if (ip.bits === 32) {
    const metadata =
      within(ip, "169.254.0.0", 16) ||
      within(ip, "100.100.100.200", 32) ||
      within(ip, "168.63.129.16", 32);
    const reserved: [string, number][] = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.31.196.0", 24],
      ["192.52.193.0", 24],
      ["192.88.99.0", 24],
      ["192.168.0.0", 16],
      ["192.175.48.0", 24],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 3],
    ];
    return {
      public: !metadata && !reserved.some(([base, prefix]) => within(ip!, base, prefix)),
      metadata,
    };
  }
  // Only current global unicast, excluding special-purpose/docs/tunnel ranges.
  const reserved: [string, number][] = [
    ["2001::", 23],
    ["2001:db8::", 32],
    ["2002::", 16],
    ["3fff::", 20],
    ["2620:4f:8000::", 48],
  ];
  return {
    public:
      within(ip, "2000::", 3) && !reserved.some(([base, prefix]) => within(ip!, base, prefix)),
    metadata: within(ip, "fd00:ec2::254", 128) || within(ip, "fe80::", 10),
  };
}
function parseEndpoint(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw blocked();
  }
  if (
    raw.length > 2048 ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    raw.includes("?") ||
    raw.includes("#") ||
    /^\w+:\/\/[^/]*@/.test(raw)
  )
    throw blocked();
  return url;
}
function metadataHost(host: string): boolean {
  const name = host.toLowerCase().replace(/\.$/, "");
  return (
    name === "metadata" ||
    name === "instance-data" ||
    name.startsWith("metadata.") ||
    name.startsWith("instance-data.")
  );
}

export function createMindFetch(options: { allowedPrivateOrigins?: string[] } = {}): typeof fetch {
  const allowed = new Set<string>();
  try {
    for (const origin of options.allowedPrivateOrigins ?? []) {
      const url = parseEndpoint(origin);
      if (url.pathname !== "/") throw blocked();
      allowed.add(url.origin);
    }
  } catch {
    throw blocked();
  }
  return (input, init) =>
    new Promise<Response>((resolve, reject) => {
      let request: http.ClientRequest | undefined;
      let incoming: http.IncomingMessage | undefined;
      let bodyReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      let signal: AbortSignal | undefined;
      let finished = false;
      const cleanup = () => signal?.removeEventListener("abort", onAbort);
      const fail = (error: unknown) => {
        if (finished) return;
        finished = true;
        cleanup();
        request?.destroy();
        incoming?.destroy();
        void bodyReader?.cancel().catch(() => {});
        reject(
          error instanceof MindEgressError ? error : new MindEgressError("Mind request failed"),
        );
      };
      const onAbort = () => fail(aborted());
      const start = async () => {
        signal = init?.signal ?? (input instanceof Request ? input.signal : undefined) ?? undefined;
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener("abort", onAbort, { once: true });
        const raw = input instanceof Request ? input.url : String(input);
        const url = parseEndpoint(raw);
        const host = url.hostname.replace(/^\[|\]$/g, "");
        const allowPrivate = allowed.has(url.origin);
        if (
          metadataHost(host) ||
          (!allowPrivate &&
            (url.protocol !== "https:" || /(^|\.)(localhost|local|internal)\.?$/i.test(host)))
        )
          throw blocked();
        const literal = isIP(host);
        const addresses = literal
          ? [{ address: host, family: literal }]
          : await dns.lookup(host, { all: true, verbatim: true });
        if (finished) return;
        if (
          !addresses.length ||
          addresses.some(({ address, family }) => {
            const policy = classify(address);
            return family !== isIP(address) || policy.metadata || (!allowPrivate && !policy.public);
          })
        )
          throw blocked();
        const pinned = addresses[0];
        const webRequest = new Request(input, init);
        let body: Buffer | undefined;
        if (webRequest.body) {
          bodyReader = webRequest.body.getReader();
          const chunks: Buffer[] = [];
          try {
            while (!finished) {
              const chunk = await bodyReader.read();
              if (chunk.done || finished) break;
              chunks.push(Buffer.from(chunk.value));
            }
            body = Buffer.concat(chunks);
          } finally {
            bodyReader.releaseLock();
            bodyReader = undefined;
          }
        }
        if (finished) return;
        const headers: Record<string, string> = {};
        webRequest.headers.forEach((value, key) => {
          headers[key] = value;
        });
        // Prevent virtual-host/smuggling overrides and compressed-body bombs.
        for (const key of [
          "host",
          "connection",
          "transfer-encoding",
          "content-length",
          "upgrade",
          "proxy-authorization",
          "proxy-connection",
          "trailer",
          "te",
          "expect",
        ])
          delete headers[key];
        headers["accept-encoding"] = "identity";
        if (body) headers["content-length"] = String(body.byteLength);
        request = (url.protocol === "https:" ? https : http).request(
          url,
          {
            method: webRequest.method,
            headers,
            agent: false,
            // Original URL supplies Host + TLS SNI/certificate validation. Lookup
            // never calls DNS, including Node autoSelectFamily's all mode.
            lookup: (_hostname, lookupOptions, callback) => {
              if (lookupOptions.all) callback(null, [pinned]);
              else callback(null, pinned.address, pinned.family);
            },
          },
          (res) => {
            incoming = res;
            res.on("error", fail);
            res.on("aborted", () => fail(new MindEgressError("Mind response interrupted")));
            const status = res.statusCode ?? 0;
            if (status >= 300 && status < 400) {
              fail(new MindEgressError("Mind redirects forbidden"));
              return;
            }
            if (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity") {
              fail(new MindEgressError("Mind response encoding unsupported"));
              return;
            }
            if (Number(res.headers["content-length"]) > MAX_BODY) {
              fail(new MindEgressError("Mind response too large"));
              return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            res.on("data", (chunk: Buffer) => {
              size += chunk.length;
              if (size > MAX_BODY) {
                fail(new MindEgressError("Mind response too large"));
                return;
              }
              if (!finished) chunks.push(chunk);
            });
            res.on("end", () => {
              if (finished) return;
              try {
                const responseHeaders = new Headers();
                for (let i = 0; i < res.rawHeaders.length; i += 2)
                  responseHeaders.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
                const noBody = webRequest.method === "HEAD" || [204, 205, 304].includes(status);
                const response = new Response(noBody ? null : Buffer.concat(chunks), {
                  status,
                  headers: responseHeaders,
                });
                finished = true;
                cleanup();
                resolve(response);
              } catch (error) {
                fail(error);
              }
            });
          },
        );
        request.on("error", fail);
        request.end(body);
      };
      void start().catch(fail);
    });
}
