import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.argv[2];assert(url);
const out='art/verification/civic/live';fs.mkdirSync(out,{recursive:true});
const result={url,scope:'Explicit disposable player positioning/NPC selection; actual Talk button clicks. Screenshots require visual review; no bundled scene-graph claim.',checks:[],errors:[]};
const flush=()=>fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));
const check=(name,ok)=>{result.checks.push({name,ok:!!ok});flush();assert(ok,name)};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-gpu']});
try{
 const ctx=await browser.newContext();await ctx.routeWebSocket(/.*/,()=>{});const page=await ctx.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>result.errors.push(e.message));
 await page.addInitScript(s=>localStorage.setItem('emberhall-save-v4',s),fs.readFileSync('public/art/phase1-review-save.json','utf8'));
 await page.goto(url+'/?qa=1');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing');await page.waitForLoadState('networkidle');
 for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
  await page.setViewportSize(viewport);
  for(const role of ['banker','provisioner','healer']){
   const before=await page.evaluate(role=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),p=w.people.find(p=>p.isPlayer),n=w.people.find(p=>p.role===role&&p.home&&Math.hypot(p.home.tx-256,p.home.ty-292)<18);s.select(null);s.setPanel('none');s.closeCraft();s.flash('');s.speed(0);p.x=n.x;p.z=n.z+2;p.path=[];w.hour=12;s.tick(0);return {id:n.id,name:n.name,npc:JSON.stringify(n),pack:JSON.stringify(w.player.pack)}},role);
   await page.waitForTimeout(900);await page.screenshot({path:out+'/'+device+'-'+role+'.png'});
   await page.evaluate(id=>window.__ember.useGame.getState().select(id),before.id);
   const button=page.getByRole('button',{name:'Talk',exact:true});check(device+'-'+role+'-talk-enabled',await button.isEnabled());await button.click();await page.waitForTimeout(200);
   check(device+'-'+role+'-dialogue', (await page.locator('body').innerText()).includes(before.name+':'));
   const after=await page.evaluate(id=>{const w=window.__ember.getWorld();return {npc:JSON.stringify(w.people.find(p=>p.id===id)),pack:JSON.stringify(w.player.pack)}},before.id);
   check(device+'-'+role+'-records-preserved',after.npc===before.npc&&after.pack===before.pack);
   await page.screenshot({path:out+'/'+device+'-'+role+'-talk.png'});
  }
 }
 check('no-page-errors',result.errors.length===0);result.passed=true;
}catch(e){result.passed=false;result.failure=e.message;process.exitCode=1}finally{flush();await browser.close()}
console.log(JSON.stringify({passed:result.passed,checks:result.checks.length,failure:result.failure}));
