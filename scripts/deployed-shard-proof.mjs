import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { runProof } from "./two-client-proof.mjs";

const app = "emberhall-shard";
const base = `https://${app}.fly.dev`;
const fly = process.env.FLYCTL ?? "flyctl";
const invoke = (...args) => execFileSync(fly, [...args, "-a", app], { encoding: "utf8", timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
if (!process.env.SHARD_KEYS_FILE) throw new Error("SHARD_KEYS_FILE must name a private file outside the repository");
const keys = readFileSync(process.env.SHARD_KEYS_FILE, "utf8").trim();
const machines = JSON.parse(invoke("machines", "list", "--json"));
if (machines.length !== 1 || machines[0].state !== "started") throw new Error("Exactly one running machine required");
const machineId = machines[0].id;
const evidence = await runProof({
  url: `wss://${app}.fly.dev`, httpBase: base, seed: 1977, keys,
  evidencePath: ".hermes/verification/p2/deployed-proof.json",
  restartRemote: async () => {
    const before = await (await fetch(`${base}/healthz`)).json();
    const output = invoke("machines", "restart", machineId);
    let after;
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(5000) });
        const health = await res.json();
        if (res.ok && health.ok && health.uptimeSec < before.uptimeSec && health.tick >= before.tick) { after = health; break; }
      } catch { /* restart outage */ }
      await sleep(2000);
    }
    if (!after) throw new Error("Restart did not recover a fresh process with retained tick");
    const save = JSON.parse(invoke("ssh", "console", "-C", "cat /data/shard-save.json"));
    return { save, evidence: { machineId, command: "fly machines restart", output, before, after } };
  },
});
// Also catch future accidental inclusion before claiming any passing gate.
const encoded = JSON.stringify(evidence);
if (keys.split(",").some(pair => encoded.includes(pair.slice(pair.indexOf(":") + 1)))) throw new Error("Credential leaked into evidence");
process.exitCode = evidence.summary.fail || evidence.summary.skip ? 1 : 0;
