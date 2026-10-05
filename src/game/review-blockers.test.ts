import assert from "node:assert/strict";
import test from "node:test";
import { createWorld, placeBuilding } from "./world.ts";
import { setWorld } from "./live.ts";
import { commandWalk, you } from "./player.ts";
import { astar, lineWalkable } from "./pathfinding.ts";
import { siteError } from "./building-size.ts";
import { groundY } from "./height.ts";
import { writeSave, loadSave } from "./save.ts";
import { depleteResourceNode } from "./resources/state.ts";

function world() { const w = createWorld(7); setWorld(w); return w; }
function legal(w: ReturnType<typeof world>, x: number, z: number, path: NonNullable<ReturnType<typeof astar>>) {
  for (const p of path) { assert.ok(lineWalkable(w, x, z, p.x, p.y), `illegal ${x},${z} -> ${p.x},${p.y}`); x=p.x; z=p.y; }
}
test("construction reserves bridge deck, approaches and generated farm beds atomically", () => {
  const w=world(), before=groundY(w,947,560), gold=w.gold;
  assert.notEqual(placeBuilding(w,"farm",945,560),null);
  assert.equal(w.gold,gold); assert.equal(w.plots.length,0);
  assert.equal(w.tiles[560][947].kind,"step"); assert.equal(groundY(w,947,560),before);
  assert.notEqual(siteError(w,"board",952,560),null);
  // Centre footprint outside bridge, generated +2 bed still overlaps approach.
  assert.notEqual(placeBuilding(w,"farm",943,560),null);
  assert.equal(placeBuilding(w,"farm",940,555),null,"adjacent ordinary ground stays available");
});
test("chart-scale non-marker destination and return route use legal road connectors", () => {
  const w=world();
  assert.equal(commandWalk(w,660,560,48000),null);
  const p=you(w)!; assert.ok(p.path.length);
  legal(w,256,293,p.path.map(q=>({x:q.tx,y:q.ty})));
  const back=astar(w,660,560,256,293,48000); assert.ok(back); legal(w,660,560,back);
});
test("blocked nearest connector uses another reachable connector; sealed destinations stay closed", () => {
  const w=world();
  // Seal the nearest named entry, including cardinal and diagonal shoulders.
  for (let z=267;z<=269;z++) for (let x=419;x<=421;x++) if (x!==420 || z!==268) w.tiles[z][x]={kind:"wall",h:8};
  const path=astar(w,256,293,660,560,48000); assert.ok(path); legal(w,256,293,path);
  // Walkable target in a sealed room must not be mistaken for reachable.
  for (let z=559;z<=561;z++) for (let x=659;x<=661;x++) if (x!==660 || z!==560) w.tiles[z][x]={kind:"wall",h:8};
  assert.equal(astar(w,256,293,660,560,48000),null);
});
test("saved legacy regrowth on a stamped road gets a bounded legal local detour", () => {
  const w=world();
  // Persist the exact legacy depleted-node record; hydration, not direct rock
  // injection, restores its natural seed-7 height/kind over the new road.
  w.hour=1;
  w.resourceNodes=depleteResourceNode({seed:7,tx:423,ty:268,nodeKind:"rock",hour:1,resourceNodes:w.resourceNodes});
  w.tiles[268][423].kind="dirt"; w.scars["423,268"]={kind:"dirt"}; w.hour=1000;
  const storage=new Map<string,string>();
  const old=globalThis.localStorage;
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
  try {
    writeSave(w); const loaded=loadSave(); assert.ok(loaded); setWorld(loaded);
    assert.equal(loaded.tiles[268][423].kind,"rock");
    assert.ok(astar(loaded,422,268,424,268));
    for (const [x,z] of [[560,560],[1020,1000],[660,560]]) {
      const path=astar(loaded,256,293,x,z,48000); assert.ok(path,`${x},${z}`); legal(loaded,256,293,path);
    }
  } finally { Object.defineProperty(globalThis,"localStorage",{configurable:true,value:old}); }
});
