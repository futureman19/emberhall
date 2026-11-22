import { pathToFileURL } from "node:url";
import { createShard, shardConfig, TICK_MS } from "./shard.ts";

/** Node-only host. No listener until the separate transport card lands. */
export function runMain() {
  const config = shardConfig();
  const shard = createShard(config);
  const shutdown = () => {
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
    try { shard.stop(); }
    catch (error) {
      console.error("shard shutdown save failed", error);
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  shard.start();
  console.log(`shard running tickMs=${TICK_MS}; transport not attached`);
  return shard;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runMain();
