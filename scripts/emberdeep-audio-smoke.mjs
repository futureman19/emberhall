import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createWorld} from '../src/game/world.ts';
import {encodeSave,SAVE_KEY} from '../src/game/save.ts';
const [url='http://127.0.0.1:8080',label='dev']=process.argv.slice(2);
const out=`screenshots/emberdeep-audio/${label}`;fs.mkdirSync(out,{recursive:true});
const w=createWorld(42);w.speed=0;const p=w.people.find(p=>p.isPlayer);p.x=650;p.z=565;
const raw=encodeSave(w),report={url,scope:'Original real HTMLAudio playback (no play mocks), decoded energy, native Continue/stairs/mute, seeded and paused encounter positioning, real AI/hunt ticks, pinned combat RNG; emulated touch not physical device; no human listening claim.',checks:[],errors:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11','--enable-webgl','--ignore-gpu-blocklist']});
try {for(const [device,viewport] of [['desktop',{width:1440,height:960}],['mobile',{width:390,height:844}]]){
 const ctx=await browser.newContext({viewport,hasTouch:device==='mobile'});await ctx.routeWebSocket(/.*/,()=>{});
 await ctx.addInitScript(()=>{
  Math.random=()=>.4;window.__audioEvents=[];window.__audioElements=new Set();
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){window.__audioElements.add(this);const src=this.src;return play.call(this).then(()=>{window.__audioEvents.push({src,event:'playing',volume:this.volume,loop:this.loop,gesture:navigator.userActivation.hasBeenActive});},e=>{window.__audioEvents.push({src,event:'rejected',error:e.name});throw e;});};
 });
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(url+'/?qa=1');await page.evaluate(({key,raw})=>{localStorage.setItem(key,raw);localStorage.setItem('emberhall-mute-sfx','0');},{key:SAVE_KEY,raw});await page.reload();
 assert.equal(await page.evaluate(()=>window.__audioEvents.filter(e=>e.event==='playing'&&e.src.includes('/audio/sfx/')).length),0);
 const click=async name=>{const b=page.getByRole('button',{name,exact:true});if(device==='mobile')await b.tap();else await b.click();};
 await click('Continue');await page.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing',{}, {timeout:90000});
 await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.closeCtx();});await page.waitForTimeout(1200);
 await click('Enter the Emberdeep');
 await page.waitForFunction(()=>[...window.__audioElements].some(a=>a.src.endsWith('emberdeep-ambience.mp3')&&!a.paused&&a.currentTime>.2));
 const decoded=await page.evaluate(async()=>{
  const ac=new AudioContext(),result=[];
  for(const name of [...['slag-golem','embercrawler','gloomwraith'].flatMap(k=>['aggro','attack','hit','death'].map(e=>`${k}-${e}`)),'emberdeep-ambience','emberdeep-door']){
   const response=await fetch(`/audio/sfx/${name}.mp3`);if(!response.ok)throw Error(name+' missing');const bytes=await response.arrayBuffer();const b=await ac.decodeAudioData(bytes);const data=b.getChannelData(0);let sum=0,peak=0;for(const v of data){sum+=v*v;peak=Math.max(peak,Math.abs(v));}
   result.push({name,bytes:bytes.byteLength,duration:b.duration,rms:Math.sqrt(sum/data.length),peak,seam:Math.abs(data[0]-data.at(-1))});
  }await ac.close();return result;
 });
 assert.equal(decoded.length,14);for(const d of decoded){assert(d.bytes<200000&&d.rms>.005&&d.peak<.99,JSON.stringify(d));}assert(decoded.find(d=>d.name==='emberdeep-ambience').seam<.04);
 await page.screenshot({path:`${out}/${device}-ambience.png`});
 for(const kind of ['slag_golem','embercrawler','gloomwraith']){
  await page.evaluate(kind=>{
   const {getWorld,useGame}=window.__ember,w=getWorld(),s=useGame.getState(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.kind===kind);window.__qaId=c.id;
   for(const other of w.fauna){other.x=1100;other.z=720;other.path=[];}
   c.x=1038;c.z=674;c.home={tx:1038,ty:674};c.hp=c.maxHp;c.task='idle';c.path=[];delete c.monster;delete c.crawler;delete c.gloom;
   p.x=1038;p.z=675.4;p.path=[];p.hp=p.maxHp=1000;w.player.intent={kind:'none',tx:0,ty:0,targetId:null,spell:null};w.player.invisUntil=0;w.player.wear={main:'sword'};w.player.skills.swords=50;w.player.skills.anatomy=40;w.weather.kind='clear';w.weather.wet=0;w.weather.untilHour=w.hour+100;s.speed(0);
  },kind);await page.waitForTimeout(250);
  for(let i=0;i<125;i++){
   await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);s.tick(.05);s.speed(0);});await page.waitForTimeout(20);
   if(await page.evaluate(name=>window.__audioEvents.some(e=>e.event==='playing'&&e.src.endsWith(name+'-attack.mp3')),kind.replaceAll('_','-')))break;
  }
  await page.evaluate(()=>{const {getWorld,useGame}=window.__ember,w=getWorld(),p=w.people.find(p=>p.isPlayer),c=w.fauna.find(c=>c.id===window.__qaId);p.x=c.x;p.z=c.z+.9;p.path=[];useGame.getState().doVerb('hunt',{kind:'fauna',id:c.id,tx:Math.round(c.x),ty:Math.round(c.z)});});
  for(let i=0;i<350;i++){
   const dead=await page.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(1);s.tick(.05);s.speed(0);return window.__ember.getWorld().fauna.find(c=>c.id===window.__qaId).task==='dead';});await page.waitForTimeout(20);if(dead)break;
  }
  await page.waitForTimeout(300);const events=await page.evaluate(name=>window.__audioEvents.filter(e=>e.src.includes(name)),kind.replaceAll('_','-'));
  for(const e of ['aggro','attack','hit','death'])assert(events.some(a=>a.src.endsWith(`-${e}.mp3`)&&a.event==='playing'&&a.volume>0&&a.gesture),`${device} ${kind} missing ${e}: ${JSON.stringify(events)}`);
  assert.equal(events.filter(e=>e.src.endsWith('-death.mp3')&&e.event==='playing').length,1);
  await page.screenshot({path:`${out}/${device}-${kind}-death.png`});report.checks.push({device,kind,events});
 }
 // Existing boss state is a fixture: downstream boss card owns real unlock gameplay.
 await page.evaluate(()=>{const w=window.__ember.getWorld();w.emberdeep.bossDoorOpen=true;});
 await page.waitForFunction(()=>window.__audioEvents.some(e=>e.src.endsWith('emberdeep-door.mp3')&&e.event==='playing'));
 // Open the existing settings via its store action; the mute button itself is native.
 await page.evaluate(()=>window.__ember.useGame.setState({openSettings:true}));await page.waitForTimeout(400);
 await click('The work: on');await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>[...window.__audioElements].filter(a=>a.src.includes('/audio/sfx/')&&!a.paused).length),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('emberhall-mute-sfx')),'1');
 const count=await page.evaluate(()=>window.__audioEvents.length);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.__audioEvents.length),count);
 await page.screenshot({path:`${out}/${device}-muted.png`});await click('The work: off');
 await page.waitForFunction(()=>[...window.__audioElements].some(a=>a.src.endsWith('emberdeep-ambience.mp3')&&!a.paused));
 await page.evaluate(()=>{const {getWorld,useGame}=window.__ember;useGame.setState({openSettings:false});const p=getWorld().people.find(p=>p.isPlayer);p.x=1010;p.z=674;});await page.waitForTimeout(600);
 await click('Leave the Emberdeep');await page.waitForTimeout(400);
 assert.equal(await page.evaluate(()=>[...window.__audioElements].some(a=>a.src.endsWith('emberdeep-ambience.mp3')&&!a.paused)),false);
 report.checks.push({device,decoded,entry:true,exit:true,mute:true,door:true});await ctx.close();
 }assert.deepEqual(report.errors,[]);assert.equal(report.checks.length,8);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}
finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.checks.length,errors:report.errors,failure:report.failure},null,2));
