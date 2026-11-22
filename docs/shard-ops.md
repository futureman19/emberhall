# Emberhall authoritative shard operations

This is the Node host, **not** the Vercel browser application. One persistent
world runs at `wss://emberhall-shard.fly.dev`; health is
`https://emberhall-shard.fly.dev/healthz`. Region: lax. Data volume: `shard_data`,
mounted at `/data`. Seed 1977 is pinned for the initial locked proof.

## Single authority (mandatory)

**Never run two shard processes for this world.** There is no distributed writer
lock or consensus. Two processes independently admit actions and award loot;
separate volumes diverge and a shared volume can overwrite saves. A load balancer
or matching seed does not fix split brain. Use exactly one machine, one mounted
volume and one Node process. Do not clone this app or use blue/green or canary
rollout. Immediate replacement intentionally allows downtime; no HA standby.

```sh
fly status -a emberhall-shard
fly machines list -a emberhall-shard
fly volumes list -a emberhall-shard
fly scale count 1 -a emberhall-shard --yes
```

Before any deploy, verify the sole machine owns the original volume. If more than
one machine exists, stop and resolve ownership before accepting player traffic.
The Fly volume binds to one machine; scaling count is an operational guard, not a
code-level lock. `min_machines_running=1` and `auto_stop_machines=false` keep it up.

## First provision / deploy

Authenticate with the operator's existing Fly account. An auth, quota or billing
failure is a deployment blocker, never a passing local substitute.

```sh
fly apps create emberhall-shard --org personal
fly volumes create shard_data -a emberhall-shard --region lax --size 1 --yes
node scripts/shard-keys.mjs /PRIVATE/OUTSIDE/REPO/shard.keys kett bran
```

The key tool creates an exclusive mode-0600 file and never prints key values.
Restrict its ACL on Windows. Keep a private recovery copy; do not attach it to
cards or evidence. The file contains the `name:secret,...` secret value. Set
`EMBERHALL_KEYS` with `fly secrets set` using a privately loaded shell variable,
never a literal in a recorded command, or pipe `EMBERHALL_KEYS=<private value>`
into `fly secrets import --stage -a emberhall-shard` from a secret-aware process.
Never deploy without explicit production keys: server defaults are local-demo
credentials. `fly secrets list` shows names/digests, not secret values.

```sh
fly config validate
fly deploy --remote-only --ha=false -a emberhall-shard
fly scale count 1 -a emberhall-shard --yes
fly status -a emberhall-shard
curl --fail https://emberhall-shard.fly.dev/healthz
```

Docker runs Node 22 strip-types directly, no frontend build. The complete
production dependency lock must support npm 10 shipped in node:22-slim; a lock
created with npm 11 can omit a required transitive entry. Repair with
`npx --yes npm@10.9.9 install --package-lock-only --ignore-scripts`, review the
diff, then retry the real container build. Do not replace `npm ci` with an
unlocked install. Docker COPY whitelists package manifests and `src/`; no local
keys, `.hermes`, art, or node_modules enter the final image.

## Verify, restart and rollback

```sh
# Existing production state must never be erased to make a test pass.
# The original proof consumes one known tree, so do not blindly rerun it against
# a used world; inspect the previous evidence first.
SHARD_KEYS_FILE=/PRIVATE/OUTSIDE/REPO/shard.keys node scripts/deployed-shard-proof.mjs
fly machines restart MACHINE_ID -a emberhall-shard
fly releases -a emberhall-shard
fly deploy --image registry.fly.io/emberhall-shard:KNOWN_GOOD_IMAGE --ha=false -a emberhall-shard
```

The deployed adapter calls the P2-C harness with real private keys, verifies a
single running machine, restarts that actual machine, waits for reset process
uptime plus preserved tick, reads the durable save and verifies both identities,
positions, packs, one log total and the felled-tree scar. Evidence records names,
not secrets, at `.hermes/verification/p2/deployed-proof.json`.
The generic `two-client-proof.mjs --url wss://... --seed 1977` only reconnects
unless given the restart adapter: it is **not** the locked restart gate.

Rollback changes the image, not the volume. Check save-schema compatibility
before rolling back. Retain a private volume snapshot first; do not let an older
binary silently replace an incompatible save with a new world.

## State inspection and recovery

```sh
fly ssh console -a emberhall-shard
# Inside the VM:
node -e 'const fs=require("node:fs"); const s=JSON.parse(fs.readFileSync("/data/shard-save.json","utf8")); console.log({version:s.version,tick:s.tickCount,actors:Object.keys(s.playerStates||{}).length})'
```

`/data/shard-save.json` is atomically replaced every 300 host ticks and on graceful
SIGTERM. A hard kill can lose the unsaved interval. `/data/characters.json`
contains raw API keys and stable character IDs: **never print or upload it**.
Back up both privately together. Invalid saves currently start a fresh world;
`shard restore invalid` in logs is an incident, not healthy recovery. Invalid
registries fail closed. Preserve damaged files before recovery, never delete
world state as routine troubleshooting.

## Key rotation (registry is authoritative)

Changing `EMBERHALL_KEYS` alone does **not** rotate an existing name. Plan a brief
maintenance interval: stage and deploy the new complete key set securely, then
update existing registry keys from the newly deployed environment, preserving
`characterId`, name and creation time. Inside `fly ssh console`, use:

```sh
node --input-type=module -e '
import fs from "node:fs";
const p="/data/characters.json";
const rows=JSON.parse(fs.readFileSync(p,"utf8"));
const entries=process.env.EMBERHALL_KEYS.split(",").map(v=>{const i=v.indexOf(":");return [v.slice(0,i),v.slice(i+1)]});
const keys=new Map(entries);
if(entries.length!==rows.length || keys.size!==rows.length || new Set(entries.map(v=>v[1])).size!==rows.length || rows.some(r=>!keys.get(r.name))) throw Error("Complete unique key set required");
for(const r of rows) r.key=keys.get(r.name);
fs.writeFileSync(p+".tmp",JSON.stringify(rows),{mode:0o600});
fs.renameSync(p+".tmp",p);
console.log("Registry keys updated; restart required");'
```

Immediately restart the **same** machine. The running process still accepts the
old keys until that restart; rotation is not complete before old-key rejection
and new-key welcome are verified. Do not delete registry entries or change IDs.
No concurrent deploy/rotation is allowed during this sequence. The registry is
written at boot, not during periodic world saves. If rotating after compromise,
isolate traffic first; do not promise instantaneous revocation.

## Phase gate and integration

P2-D deploy uses locally integrated P2-C `e7593e6` on base `baa10bb`, not an
unverified claim that main contains it. Controller owns final-main integration.
Run `npm test`, `npx tsc --noEmit`, `node scripts/audit-art-coverage.mjs`,
`node --test scripts/audit-safety-test-registration.test.mjs`, and the local
`node scripts/two-client-proof.mjs` on the final merged revision before closing
the entire phase. Upstream approved exceptions modify `src/game/save.ts` and
`src/game/agent/intent.ts` plus its new test; the literal original no-solo-source
allowlist is therefore not true. Document those exceptions rather than claiming
an empty diff. This deploy adds no further solo-game source changes.
