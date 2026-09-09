import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [url,label='preview',mode='candidate']=process.argv.slice(2);
assert(url);assert.match(label,/^[a-zA-Z0-9_-]+$/);
const root=new URL('../',import.meta.url),out=new URL(`art/verification/${label}/`,root);fs.mkdirSync(out,{recursive:true});
const result={url,mode,errors:[],assets:[],checks:[]};
const save=JSON.parse(fs.readFileSync(new URL('art/verification/baseline/baseline-save.json',root),'utf8'));
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try{const context=await browser.newContext({viewport:{width:1440,height:960}});await context.routeWebSocket(/.*/,()=>{});const page=await context.newPage();page.setDefaultTimeout(30000);
page.on('pageerror',e=>result.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|GLSL|shader|WebGL/.test(m.text()))result.errors.push(m.text())});page.on('response',r=>{if(r.url().endsWith('.glb'))result.assets.push({url:r.url(),status:r.status()})});
if(mode==='reference'){await page.addInitScript(raw=>localStorage.setItem('emberhall-save-v4',raw),JSON.stringify(save));await page.goto(url,{waitUntil:'domcontentloaded'});}else{
await page.goto(new URL('/art/commons-preview.html',url).href,{waitUntil:'domcontentloaded'});
await page.evaluate(()=>{localStorage.setItem('emberhall-save-v4','preserve-this-disposable-sentinel');localStorage.removeItem('emberhall-commons-review-backup-v1')});
await page.locator('#enter').click();await page.waitForURL(u=>u.pathname==='/');
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('emberhall-commons-review-backup-v1')).original),'preserve-this-disposable-sentinel');result.checks.push('launcher preserves existing preview save');
await page.goto(new URL('/art/commons-preview.html',url).href);await page.locator('#restore').click();assert.equal(await page.evaluate(()=>localStorage.getItem('emberhall-save-v4')),'preserve-this-disposable-sentinel');result.checks.push('restore reads back exact prior save');await page.locator('#enter').click();await page.waitForURL(u=>u.pathname==='/');}
await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');await page.waitForSelector('canvas');
await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.flash('');window.__ember.getWorld().hour=12});await page.waitForTimeout(1500);
result.world=await page.evaluate(()=>{const w=window.__ember.getWorld();return {player:w.people.find(p=>p.isPlayer),localBuildings:w.buildings.filter(b=>Math.hypot(b.tx-256,b.ty-292)<=18)}});
if(mode!=='reference'){assert(['dormitory','yard','farm'].every(kind=>result.world.localBuildings.some(b=>b.kind===kind)));for(const name of ['bank','forge','hall','character','oak','kitchen','tavern','market','dormitory','yard','farm']){const response=await page.request.get(new URL(`/art/lanternwood/${name}.glb`,url).href);assert.equal(response.status(),200);const bytes=await response.body();assert.equal(bytes.toString('ascii',0,4),'glTF');result.checks.push(`${name}.glb HTTP200 valid header`)} }
for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){await page.setViewportSize(viewport);await page.waitForTimeout(500);const cdp=await context.newCDPSession(page);const shot=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(new URL(`${device}.png`,out),Buffer.from(shot.data,'base64'));await cdp.detach()}
assert.equal(result.errors.length,0);result.checks.push('game visible desktop/mobile with no captured page/shader errors');result.passed=true;
}catch(e){result.failure=String(e);process.exitCode=1}finally{await browser.close();fs.writeFileSync(new URL('results.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result))}
