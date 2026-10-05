import test from 'node:test';
import assert from 'node:assert/strict';
import { createTouchHold } from '../src/game/touch-hold.ts';

test('native prototype pointer getters survive hold, tap and drag snapshots', () => {
  const event = Object.create({get pointerId(){return 7;},get pointerType(){return 'touch';},get clientX(){return 100;},get clientY(){return 120;}});
  let timer; let taps=0; let held;
  const h=createTouchHold({schedule:fn=>{timer=fn;return 1;},unschedule:()=>{timer=null;},eligible:()=>true,tap:()=>taps++,hold:(_tile,p)=>{held=p;}});
  const tile={tx:3,ty:4};
  h.trackDown(event);assert.equal(h.begin(event,tile),true);h.end(event);assert.equal(taps,1);
  h.trackDown(event);h.begin(event,tile);timer();h.end(event);
  assert.deepEqual(held,{pointerId:7,pointerType:'touch',clientX:100,clientY:120});assert.equal(taps,1);
  h.trackDown(event);h.begin(event,tile);h.move({pointerId:7,clientX:140,clientY:120});assert.equal(timer,null);h.end(event);assert.equal(taps,1);
});
