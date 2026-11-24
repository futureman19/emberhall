import assert from "node:assert/strict";
import { test, mock } from "node:test";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { createMindFetch } from "./mind-egress.ts";
import { createOpenAIAdapter } from "../game/agent/adapters/openai-compatible.ts";

async function loopback(run: (origin: string) => Promise<void>, handler: http.RequestListener) {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("rejects unsafe URL syntax and public HTTP before DNS", async () => {
  const lookup = mock.method(dns, "lookup", async () => {
    throw new Error("DNS must not run");
  });
  try {
    for (const url of [
      "http://example.com/x",
      "https://user:secret@example.com",
      "https://example.com/?key=secret",
      "https://example.com/#secret",
      "https://example.com/?",
      "https://example.com/#",
      "file:///secret",
    ]) {
      await assert.rejects(createMindFetch()(url), /Mind endpoint blocked/);
    }
    assert.equal(lookup.mock.callCount(), 0);
  } finally {
    lookup.mock.restore();
  }
});

test("blocks private, special-use and mapped literal addresses", async () => {
  for (const host of [
    "0.1.2.3",
    "10.0.0.1",
    "100.64.0.1",
    "127.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.168.0.1",
    "192.0.0.9",
    "192.0.2.1",
    "192.88.99.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "[::]",
    "[::1]",
    "[::ffff:127.0.0.1]",
    "[::ffff:a00:1]",
    "[64:ff9b::a00:1]",
    "[100::1]",
    "[2001::1]",
    "[2001:db8::1]",
    "[2002:7f00:1::]",
    "[3fff::1]",
    "[fc00::1]",
    "[fe80::1]",
    "[ff02::1]",
  ]) {
    await assert.rejects(createMindFetch()(`https://${host}/v1`), /Mind endpoint blocked/, host);
  }
});

test("metadata cannot be operator allowlisted", async () => {
  for (const host of [
    "169.254.169.254",
    "100.100.100.200",
    "168.63.129.16",
    "[fd00:ec2::254]",
    "[::ffff:169.254.169.254]",
    "metadata.google.internal",
    "metadata.google.internal.",
  ]) {
    const origin = `http://${host}`;
    await assert.rejects(
      createMindFetch({ allowedPrivateOrigins: [origin] })(origin),
      /Mind endpoint blocked/,
    );
  }
});

test("rejects a mixed public/private DNS answer, even if public comes first", async () => {
  const lookup = mock.method(dns, "lookup", async () => [
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ]);
  try {
    await assert.rejects(createMindFetch()("https://provider.example/v1"), /Mind endpoint blocked/);
  } finally {
    lookup.mock.restore();
  }
});

test("aborts unresolved DNS promptly and prevents late connection", async () => {
  let resolve!: (value: { address: string; family: number }[]) => void;
  const lookup = mock.method(
    dns,
    "lookup",
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  try {
    const controller = new AbortController();
    const result = createMindFetch()("https://provider.example", { signal: controller.signal });
    await new Promise((r) => setImmediate(r));
    controller.abort(new Error("secret-url-key"));
    await assert.rejects(
      result,
      (e: Error) => e.name === "AbortError" && !e.message.includes("secret"),
    );
    resolve([{ address: "127.0.0.1", family: 4 }]);
  } finally {
    lookup.mock.restore();
  }
});

test("exact operator origin permits real adapter POST without credential or body changes", async () => {
  await loopback(
    async (origin) => {
      await assert.rejects(createMindFetch()(origin), /blocked/);
      await assert.rejects(
        createMindFetch({ allowedPrivateOrigins: [origin.replace("127.0.0.1", "localhost")] })(
          origin,
        ),
        /blocked/,
      );
      const adapter = createOpenAIAdapter({
        baseUrl: `${origin}/v1`,
        model: "test",
        apiKey: "fixture-key",
        fetchImpl: createMindFetch({ allowedPrivateOrigins: [origin] }),
      });
      assert.equal(await adapter.complete([{ role: "user", content: "hello" }]), "ok");
    },
    (req, res) => {
      assert.equal(req.url, "/v1/chat/completions");
      assert.equal(req.headers.authorization, "Bearer fixture-key");
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        assert.equal(JSON.parse(body).model, "test");
        res.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
      });
    },
  );
});

test("pins DNS resolution to actual loopback connection, preserves Host, never re-resolves", async () => {
  await loopback(
    async (origin) => {
      const target = origin.replace("127.0.0.1", "provider.example");
      const lookup = mock.method(dns, "lookup", async () => [{ address: "127.0.0.1", family: 4 }]);
      try {
        const response = await createMindFetch({ allowedPrivateOrigins: [target] })(`${target}/v1`);
        assert.equal(await response.text(), "pinned");
        assert.equal(lookup.mock.callCount(), 1);
      } finally {
        lookup.mock.restore();
      }
    },
    (req, res) => {
      assert.match(req.headers.host!, /^provider\.example:/);
      res.end("pinned");
    },
  );
});

test("rejects redirects without contacting the destination", async () => {
  let hits = 0;
  await loopback(
    async (origin) => {
      await assert.rejects(
        createMindFetch({ allowedPrivateOrigins: [origin] })(origin),
        /redirect/i,
      );
      assert.equal(hits, 1);
    },
    (_req, res) => {
      hits++;
      res.writeHead(302, { Location: "/destination" });
      res.end();
    },
  );
});

test("accepts exactly 1 MiB and rejects larger streamed and declared bodies", async () => {
  await loopback(
    async (origin) => {
      const fetcher = createMindFetch({ allowedPrivateOrigins: [origin] });
      assert.equal(
        (await (await fetcher(`${origin}/exact`)).arrayBuffer()).byteLength,
        1024 * 1024,
      );
      await assert.rejects(fetcher(`${origin}/stream`), /too large/);
      await assert.rejects(fetcher(`${origin}/declared`), /too large/);
    },
    (req, res) => {
      if (req.url === "/declared") {
        res.writeHead(200, { "Content-Length": 1024 * 1024 + 1 });
        res.flushHeaders();
        return;
      }
      res.write(Buffer.alloc(1024 * 1024));
      res.end(req.url === "/stream" ? "x" : "");
    },
  );
});

test("aborts stalled response body and pre-aborted requests with sanitized errors", async () => {
  let started!: () => void;
  const receiving = new Promise<void>((resolve) => {
    started = resolve;
  });
  await loopback(
    async (origin) => {
      const fetcher = createMindFetch({ allowedPrivateOrigins: [origin] });
      const controller = new AbortController();
      const pending = fetcher(origin, { signal: controller.signal });
      await receiving;
      controller.abort("fixture-secret");
      await assert.rejects(pending, { name: "AbortError", message: "Mind request aborted" });
      await assert.rejects(fetcher(origin, { signal: controller.signal }), { name: "AbortError" });
    },
    (_req, res) => {
      res.write("partial");
      started();
    },
  );
});

test("cancels a stalled outgoing Request body on abort", async () => {
  let cancelled = false;
  let began!: () => void;
  const reading = new Promise<void>((resolve) => {
    began = resolve;
  });
  await loopback(
    async (origin) => {
      const controller = new AbortController();
      const body = new ReadableStream<Uint8Array>({
        pull() {
          began();
        },
        cancel() {
          cancelled = true;
        },
      });
      const request = new Request(origin, {
        method: "POST",
        body,
        duplex: "half",
        signal: controller.signal,
      } as RequestInit);
      const result = createMindFetch({ allowedPrivateOrigins: [origin] })(request);
      await reading;
      await new Promise((resolve) => setImmediate(resolve));
      controller.abort();
      await assert.rejects(result, { name: "AbortError" });
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(cancelled, true);
    },
    (_req, res) => {
      res.end("unexpected");
      assert.fail("aborted body must never be sent");
    },
  );
});

test("does not leak an upstream AbortError message", async () => {
  const lookup = mock.method(dns, "lookup", async () => {
    throw new DOMException("secret-key-provider-url", "AbortError");
  });
  try {
    await assert.rejects(createMindFetch()("https://provider.example"), {
      message: "Mind request failed",
    });
  } finally {
    lookup.mock.restore();
  }
});

test("pins public IPv4 and IPv6 on HTTPS without disabling TLS identity checks", async () => {
  for (const address of ["8.8.8.8", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    const family = address.includes(":") ? 6 : 4;
    const lookup = mock.method(dns, "lookup", async () => [{ address, family }]);
    let captured!: { url: URL; options: https.RequestOptions };
    const transport = mock.method(https, "request", (url: URL, options: https.RequestOptions) => {
      captured = { url, options };
      throw new Error("test transport stop: no external traffic");
    });
    try {
      await assert.rejects(createMindFetch()("https://provider.example"), /Mind request failed/);
      assert.ok(captured);
      const { url, options } = captured;
      assert.equal(url.hostname, "provider.example");
      assert.equal(options.agent, false);
      assert.notEqual(options.rejectUnauthorized, false);
      assert.equal(options.servername, undefined); // Node derives original URL hostname
      assert.ok(options.lookup);
      options.lookup("provider.example", {}, (error, actual, actualFamily) => {
        assert.equal(error, null);
        assert.equal(actual, address);
        assert.equal(actualFamily, family);
      });
      options.lookup("provider.example", { all: true }, (error, actual) => {
        assert.equal(error, null);
        assert.deepEqual(actual, [{ address, family }]);
      });
      assert.equal(lookup.mock.callCount(), 1);
    } finally {
      lookup.mock.restore();
      transport.mock.restore();
    }
  }
});

test("rejects DNS metadata aliases even for operator origins", async () => {
  const lookup = mock.method(dns, "lookup", async () => [
    { address: "169.254.169.254", family: 4 },
  ]);
  try {
    await assert.rejects(
      createMindFetch({ allowedPrivateOrigins: ["http://provider.example"] })(
        "http://provider.example",
      ),
      /blocked/,
    );
  } finally {
    lookup.mock.restore();
  }
});

test("rejects compressed and prematurely closed bodies", async () => {
  await loopback(
    async (origin) => {
      const fetcher = createMindFetch({ allowedPrivateOrigins: [origin] });
      await assert.rejects(fetcher(`${origin}/compressed`), /encoding unsupported/);
      await assert.rejects(
        fetcher(`${origin}/truncated`),
        /Mind (response interrupted|request failed)/,
      );
    },
    (req, res) => {
      if (req.url === "/compressed") {
        res.writeHead(200, { "Content-Encoding": "gzip" });
        res.end("not decoded");
      } else {
        res.writeHead(200, { "Content-Length": 100 });
        res.write("short");
        setImmediate(() => res.destroy());
      }
    },
  );
});

test("network errors are controlled and never expose URL, key or raw cause", async () => {
  const lookup = mock.method(dns, "lookup", async () => {
    throw new Error("https://provider.example secret-key");
  });
  try {
    await assert.rejects(
      createMindFetch()("https://provider.example", {
        headers: { authorization: "Bearer secret-key" },
      }),
      (e: Error) => e.message === "Mind request failed" && !("cause" in e),
    );
  } finally {
    lookup.mock.restore();
  }
});
