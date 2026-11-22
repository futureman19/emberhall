// Shared CPU/browser chain driver. QA-only durable-health veteran, not a balance test.
export function createDriver(w, api, tick) {
  const p = w.people.find(p => p.isPlayer);
  const events = [];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const pump = (until, label, limit = 12000) => {
    let ticks = 0;
    while (!until() && ticks < limit) {
      tick(.05); ticks++;
      check(p.hp > 0 && !w.player.ghost, `${label}: player died`);
    }
    check(until(), `${label}: timeout at ${p.x},${p.z}; intent=${JSON.stringify(w.player.intent)}`);
    return ticks;
  };
  const walk = (tx, ty) => {
    check(api.commandWalk(w, tx, ty) === null, `walk refused ${tx},${ty}`);
    const ticks = pump(() => Math.hypot(p.x-tx,p.z-ty)<.3, `walk ${tx},${ty}`);
    events.push({action:'walk',tx,ty,ticks});
  };
  const fight = id => {
    const c = w.fauna.find(c => c.id === id);
    check(c, `missing spawn ${id}`);
    if (c.task === 'dead') return;
    const hp = c.hp;
    check(api.commandHunt(w,id) === null, `hunt refused ${id}`);
    const ticks = pump(() => c.task === 'dead', `hunt ${id}`);
    tick(.05); // publish authoritative clear after the killing beat
    events.push({action:'kill',id,kind:c.kind,startingHp:hp,ticks,playerHp:p.hp});
  };
  return { events, walk, fight, check,
    room(room) {
      walk(room.tx,room.ty);
      for (const spawn of api.dungeonSpawns(w).filter(a=>a.roomId===room.id)) fight(spawn.id);
      tick(.05);
      check(w.emberdeep.visited.includes(room.id), `not visited ${room.id}`);
      check(w.emberdeep.cleared.includes(room.id), `not cleared ${room.id}`);
    },
    boss() {
      check(w.emberdeep.bossDoorOpen, 'boss gate never unlocked');
      walk(1100,674);
      check(w.emberdeep.bossEncounter==='fighting', 'boss did not engage');
      check(!w.emberdeep.bossDoorOpen, 'boss gate failed to seal');
      fight(api.WARDEN_ID);
      check(w.emberdeep.bossDefeated && w.emberdeep.bossDoorOpen, 'boss victory not published');
      const loot=w.piles.filter(p=>p.items.furnace_heart);
      check(loot.length===1 && loot[0].items.furnace_heart===1,'expected exactly one heart');
      walk(loot[0].tx,loot[0].ty);
      api.takeFromPile(w,loot[0].id);
      check(w.player.pack.furnace_heart===1,'heart not collected');
      for(let i=0;i<20;i++)tick(.05);
      check(!w.piles.some(p=>p.items.furnace_heart),'heart duplicated');
    },
  };
}
export function prepareVeteran(w, entry) {
  const p=w.people.find(p=>p.isPlayer);
  p.x=entry.tx;p.z=entry.ty;p.path=[];
  p.hp=p.maxHp=5000;
  w.player.wear.main='sword';
  w.player.skills.swords=100;w.player.skills.anatomy=100;
  w.player.invisUntil=0;
  return p;
}
