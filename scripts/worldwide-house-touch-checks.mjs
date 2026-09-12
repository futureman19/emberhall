// Cancellable house holds exercised through real browser touch, no menu injection.
export async function houseTouchNegatives({ page, prefix, locate, check }) {
  const cdp = await page.context().newCDPSession(page);
  const reset = () => page.evaluate(() => {
    const w = window.__ember.getWorld(), s = window.__ember.useGame.getState();
    s.closeCtx(); w.player.intent.kind = 'none'; w.people.find(p => p.isPlayer).path = [];
  });
  const state = () => page.evaluate(() => {
    const w = window.__ember.getWorld(), s = window.__ember.useGame.getState();
    return { ctx: s.ctx, intent: w.player.intent.kind, path: w.people.find(p => p.isPlayer).path };
  });
  await reset();const point = await locate();await page.touchscreen.tap(point.x, point.y);
  const tap = await state();check(prefix+'-short-tap-still-walks',!tap.ctx && tap.intent==='walk' && tap.path.length>0,tap);
  for (const kind of ['drag','cancel','second-finger','ghost','owner-changed','target-replaced','phase-changed','build-armed','spell-armed','till-armed','npc-arrived']) {
    await reset();const p = await locate(), touch = { x: p.x, y: p.y, id: 1 };
    const before = await page.evaluate(() => { const w=window.__ember.getWorld();return { owner:w.buildings[0].ownerId,id:w.buildings[0].id }; });
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await page.waitForTimeout(80);
    if(kind==='drag')await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touch,x:touch.x+30}]});
    if(kind==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    if(kind==='second-finger')await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch,{x:touch.x+50,y:touch.y+10,id:2}]});
    await page.evaluate(kind=>{const w=window.__ember.getWorld(),g=window.__ember.useGame;
      if(kind==='ghost')w.player.ghost=true;
      if(kind==='owner-changed')w.buildings[0].ownerId='qa-other';
      if(kind==='target-replaced')w.buildings[0].id='qa-replaced';
      if(kind==='phase-changed')g.setState({phase:'looking'});
      if(kind==='build-armed')g.setState({buildKind:'hut'});
      if(kind==='spell-armed')w.player.armedSpell='teleport';
      if(kind==='till-armed')g.setState({tillArmed:true});
      if(kind==='npc-arrived'){const p=w.people.find(p=>p.isPlayer);w.people.push({...structuredClone(p),id:'qa-near-npc',isPlayer:false,role:null,home:null,name:'Review neighbour',x:256.6,z:321,path:[],task:'idle'});}
    },kind);
    await page.waitForTimeout(650);if(kind!=='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await state();check(prefix+'-hold-cancels-'+kind,!after.ctx&&after.intent==='none'&&after.path.length===0,after);
    await page.evaluate(before=>{const w=window.__ember.getWorld(),g=window.__ember.useGame;w.player.ghost=false;w.player.armedSpell=null;w.buildings[0].id=before.id;w.buildings[0].ownerId=before.owner;w.people=w.people.filter(p=>p.id!=='qa-near-npc');g.setState({phase:'playing',buildKind:null,tillArmed:false});g.getState().tick(.13);},before);
    await page.waitForTimeout(120);
  }
  await reset();await cdp.detach();
}
