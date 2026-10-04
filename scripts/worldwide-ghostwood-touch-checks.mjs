// Actual Chromium touch events; no direct context-menu opening or harvest dispatch.
export async function ghostTouchNegatives({page,tx,ty,prefix,locate,check}) {
  const cdp=await page.context().newCDPSession(page);
  const state=()=>page.evaluate(()=>{const w=window.__ember.getWorld();return {ctx:window.__ember.useGame.getState().ctx,intent:{...w.player.intent},path:w.people[0].path};});
  const reset=()=>page.evaluate(()=>{const s=window.__ember.useGame.getState(),w=window.__ember.getWorld();s.closeCtx();w.player.intent.kind='none';w.people[0].path=[];});
  for(const type of ['drag','cancel','second-finger','skill-lost','target-depleted','phase-changed']) {
    await reset();const point=await locate();const touch={x:point.x,y:point.y,id:1};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
    await page.waitForTimeout(80);
    if(type==='drag')await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touch,x:touch.x+30}]});
    if(type==='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    if(type==='second-finger')await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch,{x:touch.x+50,y:touch.y+10,id:2}]});
    if(type==='skill-lost')await page.evaluate(()=>{window.__ember.getWorld().player.skills.lumberjack=79;});
    if(type==='target-depleted')await page.evaluate(({tx,ty})=>{const w=window.__ember.getWorld();w.tiles[ty][tx].kind='dirt';w.landRev++;window.__ember.useGame.getState().tick(.13);},{tx,ty});
    if(type==='phase-changed')await page.evaluate(()=>window.__ember.useGame.setState({phase:'looking'}));
    await page.waitForTimeout(650);
    if(type!=='cancel')await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const after=await state();check(prefix+'-hold-cancels-'+type,after.ctx===null&&after.intent.kind!=='chop',after);
    await page.evaluate(({tx,ty})=>{const w=window.__ember.getWorld();w.player.skills.lumberjack=100;w.tiles[ty][tx].kind='tree';w.landRev++;window.__ember.useGame.setState({phase:'playing'});window.__ember.useGame.getState().tick(.13);},{tx,ty});
    await page.waitForTimeout(250);
  }
  await cdp.detach();await reset();
}
