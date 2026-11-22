import { pathToFileURL } from "node:url";
import { createShard, shardConfig, TICK_MS } from "./shard.ts";
import { createTransport } from "./ws.ts";

/** Node-only authoritative host with a shared HTTP/WebSocket listener. */
export function runMain(config = shardConfig()) {
  const shard = createShard(config);
  const transport = createTransport(shard);
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
  return { ...shard, ready, shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runMain();
