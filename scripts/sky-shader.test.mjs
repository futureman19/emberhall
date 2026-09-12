import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/game/sky.tsx',import.meta.url),'utf8');

test('sky shader literal smoothstep edges are strictly increasing',()=>{
 const calls=[...source.matchAll(/smoothstep\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)];
 assert.equal(calls.length,4,'cover all four literal ramps in the shader');
 for(const [,a,b] of calls)assert.ok(Number(a)<Number(b),`undefined GLSL smoothstep edges: ${a}, ${b}`);
});

test('below-horizon haze smoothly increases downward without changing its rim',()=>{
 const expr=source.match(/c = mix\(c, uHaze, \(1\.0 - smoothstep\((-?[\d.]+), (-?[\d.]+), y\)\)\);/);
 assert.ok(expr,'actual shader must use defined reversed ramp, not reversed edges');
 const lo=Number(expr[1]),hi=Number(expr[2]);
 assert.equal(lo,-.5);assert.equal(hi,-.05);
 const haze=y=>{const t=Math.max(0,Math.min(1,(y-lo)/(hi-lo)));return 1-t*t*(3-2*t);};
 assert.equal(haze(-1),1);assert.equal(haze(lo),1);assert.equal(haze(hi),0);assert.equal(haze(1),0);
 let previous=1;
 for(let i=0;i<=100;i++){const h=haze(-1+i*.02);assert.ok(Number.isFinite(h)&&h>=0&&h<=1);assert.ok(h<=previous+1e-12);previous=h;}
 assert.ok(Math.abs(haze((lo+hi)/2)-.5)<1e-12);
});
