import fs from 'node:fs';
import {createWorld} from '../src/game/world.ts';
import {setWorld} from '../src/game/live.ts';
import {writeSave,SAVE_KEY} from '../src/game/save.ts';
import {depleteResourceNode} from '../src/game/resources/state.ts';
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
for(const fixture of ['clean','regrowth']) {
 const w=createWorld(7);setWorld(w);
 if(fixture==='regrowth') {w.hour=1;w.resourceNodes=depleteResourceNode({seed:7,tx:423,ty:268,nodeKind:'rock',hour:1,resourceNodes:w.resourceNodes});w.tiles[268][423].kind='dirt';w.scars['423,268']={kind:'dirt'};w.hour=1000;}
 writeSave(w);fs.writeFileSync(`art/verification/review-fixes/${fixture}-save.json`,storage.get(SAVE_KEY));
}
