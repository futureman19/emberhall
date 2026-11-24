// Isolated authoritative shard for the zero-paid water-survival live proof
// (t_4e2c4d13). Boots the REAL host (src/server/main.ts -> createShard +
// createTransport) on a dedicated port with a dedicated data dir / seed / key.
// No game code is modified; this only supplies configuration via env.
import { runMain } from "../src/server/main.ts";
import { shardConfig } from "../src/server/shard.ts";

const config = shardConfig(process.env);
const handle = runMain(config);
handle.ready.catch((error) => {
  console.error("water shard boot failed", error);
  process.exit(1);
});
