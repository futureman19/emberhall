// Opt-in live local journey. Transparent owned proxy allows isolated disconnection.
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
import { createServer, request } from 'node:http';
import { chromium } from 'playwright';
import { createShard } from '../src/server/shard.ts';
import { createDirector } from '../src/server/accounts.ts';
import { createAgentRuntime } from '../src/server/agent-runtime.ts';
import { createTransport } from '../src/server/ws.ts';
import { createMindFetch } from '../src/server/mind-egress.ts';
import { createMeteredReflexBackend } from '../src/game/agent/metered.ts';
import { jevConfigFromEnv } from '../src/game/agent/jev.ts';
import { BudgetGuard } from '../src/game/agent/budget.ts';
import { createJsonlAttemptLog } from '../src/game/agent/attempts-file.ts';
if (process.env.PHASE4_PAID_APPROVED !== '1') throw Error('Authorization required');
const env = parseEnv(readFileSync(process.env.PHASE4_PROTECTED_ENV, 'utf8'));
const out = 'artifacts/phase4-onboarding-qa';
if (existsSync(join(out, 'local-live.json')) || (existsSync(join(out, 'local-live-attempts.jsonl')) && readFileSync(join(out, 'local-live-attempts.jsonl'), 'utf8').trim())) throw Error('Paid evidence already exists; reconcile remaining authorization before another run');
const dir = mkdtempSync(join('C:/Users/futur/.hermes/profiles/telegram2/cache/scratch', 'phase4-live-'));
const base = 'http://127.0.0.1:5612';
const local = 'http://127.0.0.1:5613';
const model = 'huihui_ai/qwen3-abliterated:8b';
const report = { environment: 'real providers, real shard, dev browser UI; no fixtures', dataDir: dir, events: [], errors: [], gate: 'NOT_PASSED', cloud: 'BLOCKED invalid_api_key', fullDay: 'NOT_VERIFIED' };
const pause = ms => new Promise(r => setTimeout(r, ms));
let browser, runtime, shard, director, transport, proxy, gateway;
let calls = 0, reservedMicros = 0, awakeProxy = true;
const log = createJsonlAttemptLog(join(out, 'local-live-attempts.jsonl'));
const guard = new BudgetGuard({ dailyCapMicros: 200000 });
const config = jevConfigFromEnv(env);
const backendFactory = (id, signal) => createMeteredReflexBackend({ jev: { ...config, fetchImpl: async (url, init) => {
  // Reserve $0.005/request, maximum 40 requests, <=64KiB input, output free.
  // Together with prerequisite probe's $0.01 envelope this stays below $0.25.
  if (calls >= 40 || Buffer.byteLength(init.body) > 65536) throw Error('QA spend envelope exhausted');
  calls++; reservedMicros += 5000;
  return fetch(url, { ...init, signal: AbortSignal.any([signal, init.signal]) });
} }, guard, log, agentId: id, maxRetries: 0, isActive: () => !signal.aborted });
const guarded = createMindFetch({ allowedPrivateOrigins: [local] });
const fetchMind = async (url, init) => {
  const body = JSON.parse(init.body);
  const pack = readFileSync('agent-packs/ranger.md', 'utf8');
  report.events.push({ event: 'mind-request', at: new Date().toISOString(), packOccurrences: JSON.stringify(body.messages).split(JSON.stringify(pack).slice(1,-1)).length - 1, directiveDelivered: JSON.stringify(body.messages).includes('Gather food and stay safe.'), model: body.model });
  return guarded(url, init);
};
const hostConfig = { dataDir: dir, seed: 42, port: 5611, keys: [] };
function makeHost() {
  shard = createShard(hostConfig, { log() {} });
  director = createDirector({ dataDir: dir, shard, secretKey: Buffer.from(env.EMBERHALL_SECRET_KEY,'hex'), policy: { allowPrivateEndpoints: true }, allowedOrigins: [base], log() {}, runtimeFactory: services => runtime = createAgentRuntime({ shard, services, backendFactory, fetchImpl: fetchMind }) });
  transport = createTransport(shard, director);
}
function forward(req, res, target) {
  const f = request(new URL(req.url, target), { method: req.method, headers: req.headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  f.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(f);
}
const close = async s => { if(s) { s.closeAllConnections(); await new Promise(r=>s.close(r)); } };
try {
  proxy = createServer((req,res) => { if (!awakeProxy) { req.socket.destroy(); return; } forward(req,res,'http://127.0.0.1:11434'); });
  await new Promise(r=>proxy.listen(5613,'127.0.0.1',r));
  makeHost(); await transport.listen(5611); shard.start();
  gateway = createServer((req,res)=>forward(req,res,req.url.startsWith('/api/v1/')?'http://127.0.0.1:5611':'http://127.0.0.1:5610'));
  await new Promise(r=>gateway.listen(5612,'127.0.0.1',r));
  browser = await chromium.launch({ headless:true });
  const context = await browser.newContext({ viewport:{width:1366,height:900} });
  const page = await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.fulfill({ status:200,body:'' }));
  await page.goto(base+'/console'); await pause(3000);
  const click = id=>page.getByTestId(id).click();
  const started = performance.now();
  await click('create-account'); await page.getByTestId('owner-token').waitFor();
  await click('token-saved');
  await page.getByTestId('name').fill('Live Ranger'); await click('save-name'); await click('role-ranger');
  await page.getByTestId('directive').fill('Gather food and stay safe.'); await click('save-directive');
  await click('mind-kind-local'); await page.getByTestId('mind-endpoint').fill(local+'/v1'); await page.getByTestId('mind-local-model').fill(model);
  await click('save-mind'); await click('unleash'); await page.getByTestId('status-lifecycle').waitFor();
  const accounts = JSON.parse(readFileSync(join(dir,'accounts.json'),'utf8'));
  // IDs are read from server persistence, not a mocked browser contract.
  report.accountsEnvelopeKeys = Object.keys(accounts);
  const saved = JSON.parse(readFileSync(join(dir,'director-characters.json'),'utf8'));
  report.characterEnvelopeKeys = Object.keys(saved);
  const characters = Array.isArray(saved)?saved:Object.values(saved).find(Array.isArray);
  const c = characters[0]; const id = c.characterId, owner = c.accountId;
  while(performance.now()-started < 290000) {
    const s = director.status(owner,id);
    if(s.lastAppliedActionTick !== null && s.mindState === 'awake') break;
    if(calls >= 40) break;
    await pause(1000);
  }
  report.elapsedSeconds = (performance.now()-started)/1000;
  report.initial = director.status(owner,id);
  report.body = shard.observationFor(id).you;
  report.localOnboardingPass = report.elapsedSeconds < 300 && report.initial.mindState === 'awake' && report.initial.lastAppliedActionTick !== null;
  await page.screenshot({path:join(out,'local-live.png'),fullPage:true});
  await context.close(); await browser.close(); browser=null;
  report.events.push({event:'console-closed',tick:shard.currentTick()});
  // Real connection loss at dedicated transport, never stop the shared model service.
  awakeProxy=false;
  const latest=director.getCharacter(owner,id).character;
  director.updateCharacter(owner,id,{expectedRevision:latest.revision,directive:'Gather food and stay safe. Rest when needed.'});
  const startTick=shard.currentTick();
  for(let i=0;i<90 && calls<40;i++) { await pause(1000); const s=director.status(owner,id); if(s.mindState==='asleep' && s.lastAppliedActionTick>startTick) break; }
  report.closedConsoleSleep=director.status(owner,id);
  report.sleepContinued=report.closedConsoleSleep.mindState==='asleep' && report.closedConsoleSleep.lastAppliedActionTick>startTick;
  const before=director.getCharacter(owner,id).character;
  runtime.stopAll(); await runtime.settled(); await transport.close(); shard.stop();
  makeHost(); director.recover();
  const after=director.getCharacter(owner,id).character;
  report.restartPersistence=before.characterId===after.characterId && before.directive===after.directive && before.roleId===after.roleId && shard.hasAgent(id);
  report.restartedCharacter={id:after.characterId,roleId:after.roleId,lifecycle:after.lifecycle};
  report.accountsPersisted=director.listCharacters(owner).characters.length===1;
  awakeProxy=true;
} catch(e) { report.failure={name:e.name,message:e.message}; }
finally {
  await browser?.close(); runtime?.stopAll(); await runtime?.settled(); await transport?.close(); shard?.stop();
  await close(gateway); await close(proxy); log.close();
  report.providerCalls=calls; report.reservedEnvelopeMicros=reservedMicros;
  let text=JSON.stringify(report,null,2);
  for(const v of Object.values(env)) if(v.length>8) text=text.split(v).join('[redacted]');
  writeFileSync(join(out,'local-live.json'),text); console.log(text);
}
