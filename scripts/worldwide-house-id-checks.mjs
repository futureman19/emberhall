// Identity acceptance supplements the placement harness. No direct place/open
// command, save rewrite or counter normalization. Body relocation is a labeled
// fixture step; real context/button input and canonical autosave/load follow.
import assert from 'node:assert/strict';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export async function houseIdentityChecks({page,device,mode,url,out,prefix,row,project,ground,check,report}) {
  const id=row.added[0].id,site=row.site;
  const inspect=p=>p.evaluate(id=>{const w=window.__ember.getWorld(),s=window.__ember.useGame.getState();return {building:structuredClone(w.buildings.find(b=>b.id===id)),buildings:structuredClone(w.buildings),pack:structuredClone(w.player.pack),bank:structuredClone(w.player.chest),gold:w.gold,owner:w.player.id,tickCount:w.tickCount,hour:w.hour,restored:w.restored,ctx:structuredClone(s.ctx),openHouse:s.openHouseId};},id);
  const activate=async(p,button)=>{if(device==='mobile')await button.tap();else await button.click();};
  const open=async(p,suffix)=>{
    const point=await project(p,site.x,site.z+1,ground);
    if(device==='desktop')await p.mouse.click(point.x,point.y,{button:'right'});
    else {
      const cdp=await p.context().newCDPSession(p);
      try {await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:1}]});await p.waitForTimeout(750);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
      finally {await cdp.detach();}
    }
    const s=await inspect(p);check(prefix+'-'+suffix+'-context-exact-id',s.ctx?.target.kind==='building'&&s.ctx.target.id===id,{ctx:s.ctx});
    await activate(p,p.getByRole('button',{name:'Open the chest',exact:true}));
    const chest=p.getByTestId('house-chest');await chest.waitFor();
    check(prefix+'-'+suffix+'-opened-exact-id',(await inspect(p)).openHouse===id);
    return chest;
  };
  row.identity={before:await inspect(page)};
  // Keep terrain and the paused simulation unchanged. This checks chest targeting,
  // not pathfinding to the house or construction-animation completion.
  await page.evaluate(site=>{const w=window.__ember.getWorld(),p=w.people.find(p=>p.isPlayer),s=window.__ember.useGame.getState();p.x=site.x;p.z=site.z;p.path=[];w.player.intent.kind='none';s.tick(.01);},site);
  await page.waitForTimeout(550);
  const chest=await open(page,'placed');
  await activate(page,chest.locator('div.grid > div').nth(0).getByRole('button',{name:'Bandage 3',exact:true}));
  await chest.locator('div.grid > div').nth(1).getByRole('button',{name:'Bandage 3',exact:true}).waitFor();
  row.identity.stored=await inspect(page);
  const before=row.identity.before,stored=row.identity.stored;
  check(prefix+'-chest-deposit-exact-owner-and-amount',stored.building.ownerId===before.owner&&stored.building.chest.bandage===3&&stored.pack.bandage===0&&stored.gold===before.gold&&JSON.stringify(stored.bank)===JSON.stringify(before.bank));
  check(prefix+'-chest-does-not-touch-original-buildings',JSON.stringify(stored.buildings.filter(b=>b.id!==id))===JSON.stringify(row.before.buildings));
  check(prefix+'-placement-and-chest-counter-unadjusted',stored.tickCount===row.before.tickCount&&stored.hour===row.before.hour);
  await page.screenshot({path:path.join(out,prefix+'-id-chest-deposit.png')});
  await activate(page,chest.getByRole('button',{name:'Close',exact:true}));
  // Observe the application's normal autosave, not a helper-generated payload.
  await page.waitForFunction(({id,tickCount,buildings,pack})=>{try {const s=JSON.parse(localStorage.getItem('emberhall-save-v4'));return s?.tickCount===tickCount&&JSON.stringify(s.buildings)===JSON.stringify(buildings)&&JSON.stringify(s.player.pack)===JSON.stringify(pack)&&s.buildings.find(b=>b.id===id)?.chest?.bandage===3;}catch{return false;}},{id,tickCount:stored.tickCount,buildings:stored.buildings,pack:stored.pack},{timeout:30000});
  row.identity.autosaved=await page.evaluate(()=>JSON.parse(localStorage.getItem('emberhall-save-v4')));
  const saved=row.identity.autosaved;
  check(prefix+'-canonical-autosave-exact-records',JSON.stringify(saved.buildings)===JSON.stringify(stored.buildings)&&saved.tickCount===stored.tickCount&&saved.player.pack.bandage===0);
  // A fresh isolated browser context resets module globals and loads only the
  // actual storage state produced above. The placement tab stays untouched.
  const context=await page.context().browser().newContext({viewport:page.viewportSize(),hasTouch:device==='mobile',deviceScaleFactor:1,storageState:await page.context().storageState()});
  await context.routeWebSocket(/.*/,()=>{});
  if(mode==='failure')await context.route('**/art/lanternwood/architecture-*.glb',route=>{report.requests.push({device,reload:true,url:route.request().url(),injected:true,status:503});return route.fulfill({status:503,contentType:'text/plain',body:'Deliberate local reload QA rejection'});});
  const reloaded=await context.newPage();reloaded.setDefaultTimeout(12000);
  reloaded.on('pageerror',e=>report.errors.push({device,reload:true,type:'page',text:e.message}));
  reloaded.on('console',m=>{if(m.type()==='error')report.errors.push({device,reload:true,type:'console',text:m.text()});});
  try {
    await reloaded.goto(url+'/?qa=1');await activate(reloaded,reloaded.getByRole('button',{name:'Continue',exact:true}));
    await reloaded.waitForFunction(()=>window.__ember?.useGame.getState().phase==='playing'&&window.__emberCamera);
    await reloaded.evaluate(()=>{const s=window.__ember.useGame.getState();s.speed(0);s.setPanel('none');s.closeCtx();});
    await reloaded.waitForLoadState('networkidle');await reloaded.waitForTimeout(500);
    const loaded=await inspect(reloaded);row.identity.loaded=loaded;
    check(prefix+'-fresh-context-reloaded-exact-building-records',loaded.restored&&JSON.stringify(loaded.buildings)===JSON.stringify(saved.buildings),{ids:loaded.buildings.map(b=>b.id)});
    check(prefix+'-reload-preserves-pack-owner-and-bank',isDeepStrictEqual(loaded.pack,saved.player.pack)&&loaded.owner===saved.player.id&&loaded.gold===saved.gold&&JSON.stringify(loaded.bank)===JSON.stringify(saved.player.chest));
    check(prefix+'-reload-building-ids-unique',new Set(loaded.buildings.map(b=>b.id)).size===loaded.buildings.length);
    const loadedChest=await open(reloaded,'reloaded');
    await activate(reloaded,loadedChest.locator('div.grid > div').nth(1).getByRole('button',{name:'Bandage 3',exact:true}));
    await loadedChest.locator('div.grid > div').nth(0).getByRole('button',{name:'Bandage 3',exact:true}).waitFor();
    row.identity.taken=await inspect(reloaded);const taken=row.identity.taken;
    check(prefix+'-reload-retrieves-from-exact-house',taken.openHouse===id&&taken.pack.bandage===3&&taken.building.chest.bandage===0&&taken.gold===loaded.gold&&JSON.stringify(taken.bank)===JSON.stringify(loaded.bank));
    check(prefix+'-reload-chest-keeps-original-buildings',JSON.stringify(taken.buildings.filter(b=>b.id!==id))===JSON.stringify(row.before.buildings));
    await reloaded.screenshot({path:path.join(out,prefix+'-id-reloaded-chest.png')});
    assert.equal(taken.building.ownerId,before.owner);
  } catch(e) {await reloaded.screenshot({path:path.join(out,prefix+'-id-reload-failure.png')}).catch(()=>{});throw e;}
  finally {await context.close();}
  // Don't copy full saved terrain/entity data into every result unnecessarily.
  row.identity.autosaved={saveVersion:saved.saveVersion,tickCount:saved.tickCount,buildings:saved.buildings,player:{id:saved.player.id,pack:saved.player.pack,chest:saved.player.chest}};
}
