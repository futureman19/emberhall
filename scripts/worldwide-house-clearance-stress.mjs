import assert from 'node:assert/strict';
import { ITEM_META } from '../src/game/catalog.ts';
import { HOUSE_SLOTS } from '../src/game/house.ts';

// Read clipping geometry only. Positive scroll acceptance below uses native input,
// never scrollTop assignment, scrollIntoView(), injected menus or transfer calls.
async function targetGeometry(locator) {
  return locator.evaluate(el => {
    const raw=el.getBoundingClientRect();
    const clipped=node=>{
      const r=node.getBoundingClientRect();let left=r.left,right=r.right,top=r.top,bottom=r.bottom;
      for(let p=node.parentElement;p;p=p.parentElement){
        const s=getComputedStyle(p),b=p.getBoundingClientRect();
        if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom);}
        if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right);}
      }
      return {x:left,y:top,right,bottom,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};
    };
    const visible=clipped(el),hit=document.elementFromPoint(raw.x+raw.width/2,raw.y+raw.height/2);
    const ancestors=[];
    for(let p=el.parentElement;p;p=p.parentElement)if(p.scrollHeight>p.clientHeight+1&&/auto|scroll/.test(getComputedStyle(p).overflowY))ancestors.push({tag:p.tagName,testId:p.dataset.testid,scrollTop:p.scrollTop,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight,...clipped(p)});
    return {raw:{x:raw.x,y:raw.y,width:raw.width,height:raw.height,bottom:raw.bottom},visible,hittable:hit===el||el.contains(hit),ancestors};
  });
}

async function revealWithInput({page,context,touch,locator,row}) {
  for(let attempt=0;attempt<24;attempt++){
    const before=await targetGeometry(locator);
    if(before.hittable&&before.visible.height>=before.raw.height-1&&before.visible.width>=before.raw.width-1)return before;
    const scroller=before.ancestors.find(a=>a.height>=48&&a.width>=50);
    assert(scroller,'visible scroll container with room for a 44px item target');
    const down=before.raw.bottom>scroller.bottom,x=scroller.x+scroller.width/2;
    if(touch){
      const cdp=await context.newCDPSession(page),start=down?scroller.bottom-8:scroller.y+8,end=down?scroller.y+8:scroller.bottom-8;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start,id:91}]});
      for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*i/8,id:91}]});await page.waitForTimeout(22);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    }else{await page.mouse.move(x,scroller.y+scroller.height/2);await page.mouse.wheel(0,down?260:-260);}
    await page.waitForTimeout(220);
    const after=await targetGeometry(locator);row.scrolls.push({input:touch?'native-touch-swipe':'mouse-wheel',before,after});
  }
  assert.fail('item not fully visible after bounded native scrolling');
}

export async function stressHouseClearance({page,context,touch,row,prefix,check,capture,clearance,activate}) {
  const kinds=Object.keys(ITEM_META).filter(id=>id!=='bandage'),ids=kinds.slice(0,HOUSE_SLOTS-1),spare=kinds[HOUSE_SLOTS-1],panel=page.getByTestId('house-chest');
  row.stressScope='Supplied catalog items within canonical eight-slot chest capacity plus one extra pack kind for a real full-chest rejection; supplied multiline notification and ghost toggle. Not earned inventory or natural ghost transition.';
  row.scrolls=[];
  await page.evaluate(({ids,id,spare})=>{
    const w=window.__ember.getWorld(),s=window.__ember.useGame.getState(),h=w.buildings.find(b=>b.id===id);
    w.player.pack=Object.fromEntries(ids.map(item=>[item,1]));w.player.pack[spare]=1;w.player.pack.bandage=3;
    h.chest=Object.fromEntries(ids.map(item=>[item,2]));s.tick(.13);
  },{ids,id:row.id,spare});
  await capture(page,prefix,'dense-before',row);
  const put=panel.locator('div.grid > div').nth(0).getByRole('button',{name:'Bandage 3',exact:true});
  await revealWithInput({page,context,touch,locator:put,row});
  check(prefix+'-dense-pack-native-scroll',row.scrolls.some(s=>s.after.ancestors.some((a,i)=>a.scrollTop!==s.before.ancestors[i]?.scrollTop)));
  await activate(put);
  const deposited=await capture(page,prefix,'dense-deposited',row);
  check(prefix+'-dense-deposit-accepted',deposited.state.toast==='Into the chest.'&&deposited.state.house.chest.bandage===3);
  const extra=panel.locator('div.grid > div').nth(0).getByRole('button',{name:ITEM_META[spare].label+' 1',exact:true});
  await revealWithInput({page,context,touch,locator:extra,row});await activate(extra);
  const blocked=await capture(page,prefix,'full-chest',row);clearance(prefix+'-full-chest',blocked.bounds);
  check(prefix+'-full-chest-rejection-preserved',blocked.state.toast==='The chest is full.'&&blocked.state.pack[spare]===1&&!(blocked.state.house.chest[spare]>0));
  const take=panel.locator('div.grid > div').nth(1).getByRole('button',{name:'Bandage 3',exact:true});await take.waitFor();
  const index=row.scrolls.length;
  await revealWithInput({page,context,touch,locator:take,row});
  check(prefix+'-dense-chest-native-scroll',row.scrolls.slice(index).some(s=>s.after.ancestors.some((a,i)=>a.scrollTop!==s.before.ancestors[i]?.scrollTop)));
  const ready=await capture(page,prefix,'dense-ready',row);clearance(prefix+'-dense-ready',ready.bounds);
  check(prefix+'-dense-deposit-exact',ready.state.pack.bandage===0&&ready.state.house.chest.bandage===3);
  await activate(take);
  const after=await capture(page,prefix,'dense-returned',row);clearance(prefix+'-dense-returned',after.bounds);
  check(prefix+'-dense-roundtrip-exact',after.state.pack.bandage===3&&after.state.house.chest.bandage===0&&after.state.pack[spare]===1&&ids.every(id=>after.state.pack[id]===1&&after.state.house.chest[id]===2));
  const long='Chest check: your stored supplies remain here. Use Close to return to the vale, then open the chest again when you need them.';
  await page.evaluate(message=>window.__ember.useGame.getState().flash(message),long);
  const feedback=await capture(page,prefix,'multiline',row);clearance(prefix+'-multiline',feedback.bounds);
  check(prefix+'-multiline-local-readable',feedback.bounds.status.length===1&&feedback.bounds.status[0].inside&&feedback.bounds.status[0].text===long&&feedback.bounds.status[0].scrollHeight===feedback.bounds.status[0].clientHeight);
  check(prefix+'-body-retains-tappable-height',feedback.bounds.content.height>=48,{height:feedback.bounds.content.height});
  await page.evaluate(()=>{const w=window.__ember.getWorld();w.player.ghost=true;window.__ember.useGame.getState().tick(.13);});
  check(prefix+'-ghost-item-controls-disabled',await panel.locator('div.grid button').evaluateAll(items=>items.length>0&&items.every(b=>b.disabled)));
  await page.evaluate(()=>{window.__ember.getWorld().player.ghost=false;window.__ember.useGame.getState().tick(.13);});
  check(prefix+'-living-controls-restored',await panel.locator('div.grid button').evaluateAll(items=>items.length>0&&items.every(b=>!b.disabled)));
}

export async function closedHouseClearance({page,prefix,check,activate}) {
  await page.evaluate(()=>window.__ember.useGame.getState().flash('The chest is closed.'));
  const status=page.getByRole('status');
  check(prefix+'-closed-restores-global-feedback',await status.count()===1&&await status.textContent()==='The chest is closed.'&&await page.getByTestId('house-feedback').count()===0);
  for(const id of ['missing-ui-house','']){
    await page.evaluate(id=>window.__ember.useGame.setState({openHouseId:id}),id);
    check(prefix+'-stale-'+(id||'empty')+'-keeps-feedback',await status.count()===1&&await page.getByTestId('house-chest').count()===0);
  }
  await page.evaluate(()=>window.__ember.useGame.setState({openHouseId:null}));
  await activate(page.getByRole('button',{name:'Minimize mini-map',exact:true}));
  check(prefix+'-map-still-minimizes',await page.getByRole('button',{name:'Maximize mini-map',exact:true}).isVisible());
  await activate(page.getByRole('button',{name:'Maximize mini-map',exact:true}));
  check(prefix+'-map-restores',await page.getByRole('button',{name:'Minimize mini-map',exact:true}).isVisible());
}

export async function competingHousePanels({page,row,prefix,check,activate}) {
  const panel=page.getByTestId('house-chest');
  for(const [name,button,field] of [
    ['settings','Settings — sound, graphics and the Vault','openSettings'],
    ['work','Work','openCraft'],
    ['spellbook','Spellbook','openBook'],
    ['pack','You — pack, paperdoll, skills','panel'],
    ['vault','Settings — sound, graphics and the Vault','openVault'],
  ]) {
    if(name==='spellbook')await page.evaluate(()=>{window.__ember.getWorld().player.pack.spellbook=1;window.__ember.useGame.getState().tick(.13);});
    await activate(page.getByRole('button',{name:button,exact:true}));
    if(name==='vault')await activate(page.getByRole('button',{name:/The Vault/}));
    const live=await page.evaluate(field=>{const s=window.__ember.useGame.getState();return {value:s[field],id:s.openHouseId};},field);
    check(prefix+'-'+name+'-takes-precedence',Boolean(live.value)&&live.id===row.id&&!await panel.isVisible(),{live});
    await page.evaluate(()=>window.__ember.useGame.getState().flash('Panel routing check.'));
    check(prefix+'-'+name+'-feedback-exposed',await page.getByRole('status').count()===1&&await page.getByTestId('house-feedback').count()===0);
    if(name==='pack')await activate(page.getByRole('button',{name:button,exact:true}));
    else await activate(page.getByRole('button',{name:'Close',exact:true}));
    check(prefix+'-'+name+'-returns-to-same-chest',await panel.isVisible()&&await page.evaluate(id=>window.__ember.useGame.getState().openHouseId===id,row.id));
  }
  await page.evaluate(()=>{const w=window.__ember.getWorld();w.player.poisonUntil=w.hour+1;w.player.blessUntil=w.hour+1;w.player.invisUntil=w.hour+1;window.__ember.useGame.getState().tick(.13);});
}
