import { pathToFileURL } from "node:url";
import { createShard, shardConfig, TICK_MS } from "./shard.ts";
import { createTransport } from "./ws.ts";
import { createDirector } from "./accounts.ts";
import { createAgentRuntime } from "./agent-runtime.ts";
import { createMindFetch } from "./mind-egress.ts";
import { bundledReflex } from "./bundled-reflex.ts";

/** Node-only authoritative host with a shared HTTP/WebSocket listener. */
export function runMain(config = shardConfig()) {
  const shard = createShard(config);
  const rawSecretKey = process.env.EMBERHALL_SECRET_KEY ?? "";
  if (rawSecretKey && !/^[0-9a-fA-F]{64}$/.test(rawSecretKey)) {
    throw new Error("EMBERHALL_SECRET_KEY must be 64 hex characters (32 bytes)");
  }
  const bundled = bundledReflex(config.dataDir);
  const allowedPrivateOrigins = (process.env.EMBERHALL_MIND_PRIVATE_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const guardedFetch = createMindFetch({ allowedPrivateOrigins });
  let runtime!: ReturnType<typeof createAgentRuntime>;
  const director = createDirector({
    dataDir: config.dataDir,
    shard,
    secretKey: rawSecretKey ? Buffer.from(rawSecretKey, "hex") : null,
    defaultModel: process.env.EMBERHALL_DEFAULT_MODEL || null,
    policy: { allowPrivateEndpoints: allowedPrivateOrigins.length > 0 },
    runtimeFactory: services => runtime = createAgentRuntime({ shard, services, backendFactory: bundled.factory, fetchImpl: guardedFetch, defaultModel: process.env.EMBERHALL_DEFAULT_MODEL || null }),
    allowedOrigins: (process.env.EMBERHALL_CONSOLE_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080")
      .split(",").map(s => s.trim()).filter(Boolean),
  });
  director.recover();
  const transport = createTransport(shard, director);
  let stopped = false;
  let closing: Promise<void> | undefined;
  const ready = transport.listen(config.port).then(port => {
    if (!stopped) {
      shard.start();
      console.log(`shard running tickMs=${TICK_MS}; port=${port}`);
    }
    return port;
  });
  const shutdown = (): Promise<void> => {
    if (closing) return closing;
    stopped = true;
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
    // Close clears socket-owned intents before the final save.
    closing = ready.catch(() => undefined).then(async () => {
      runtime.stopAll();
      await runtime.settled();
      bundled.close();
      await transport.close();
      try { shard.stop(); }
      catch (error) {
        console.error("shard shutdown save failed", error);
        process.exitCode = 1;
      }
    });
    return closing;
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  void ready.catch(error => {
    console.error("shard listener failed", error);
    process.exitCode = 1;
    void shutdown();
  });
  return { ...shard, director, runtime, ready, shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runMain();
