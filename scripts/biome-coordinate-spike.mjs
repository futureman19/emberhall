import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { performance } from 'node:perf_hooks';
const out='art/verification/civic/biome-coordinate-spike.json';assert(!fs.existsSync(out));
const source=fs.readFileSync('src/game/biome.ts','utf8');
const helper=`
function prepareNoise(x:number,y:number){const x0=Math.floor(x),y0=Math.floor(y);return {x0,y0,fx:fade3(x-x0),fy:fade3(y-y0)};}
function preparedNoise(p:ReturnType<typeof prepareNoise>,seed:number){const {x0,y0,fx,fy}=p;const a=hash2(x0,y0,seed),b=hash2(x0+1,y0,seed),c=hash2(x0,y0+1,seed),d=hash2(x0+1,y0+1,seed);return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;}
`;
let candidate=source.replace('export function biomeWeights(x: number, y: number): BiomeW {','export function biomeWeights(x: number, y: number): BiomeW {\nconst coarse=prepareNoise(x/32,y/32),fine=prepareNoise(x/13,y/13);');
for(const seed of [17,23,29,31,37]){const from=`macroNoise(x, y, ${seed})`;assert.equal(candidate.split(from).length,2);candidate=candidate.replace(from,`(preparedNoise(coarse,${seed})*0.62+preparedNoise(fine,${seed+9})*0.38)`);}
candidate+=helper;
async function load(text){let js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;for(const p of ['atlas.ts','rng.ts'])js=js.replaceAll(`"./${p}"`,JSON.stringify(new URL('../src/game/'+p,import.meta.url).href));return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
const original=await load(source),changed=await load(candidate);const r={scope:'Node numeric equivalence and sampler microbenchmark only; no runtime integration or frame-time claim',comparisons:0,runs:[]};
try{
for(let z=0;z<512;z++)for(let x=0;x<512;x++){assert.deepEqual(changed.biomeWeights(x,z),original.biomeWeights(x,z));r.comparisons++;}
for(let z=0;z<181;z++)for(let x=0;x<181;x++){const wx=184+x*.8,wz=220+z*.8;assert.deepEqual(changed.biomeWeights(wx,wz),original.biomeWeights(wx,wz));r.comparisons++;}
for(const cached of [false,true,true,false]){const fn=cached?changed.biomeWeights:original.biomeWeights;let sum=0;const start=performance.now();for(let z=0;z<181;z++)for(let x=0;x<181;x++)sum+=fn(184+x*.8,220+z*.8).vale;r.runs.push({prepared:cached,ms:performance.now()-start,sum});}
assert(r.runs.every(x=>Object.is(x.sum,r.runs[0].sum)));r.passed=true;
}catch(e){r.passed=false;r.failure=e.message;process.exitCode=1;}finally{fs.writeFileSync(out,JSON.stringify(r,null,2));}
console.log(JSON.stringify(r));
