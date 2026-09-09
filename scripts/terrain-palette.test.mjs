import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { Color, ColorManagement, LinearSRGBColorSpace, SRGBColorSpace } from 'three';

test('fixed palette preserves exact conversion across color-management changes', async () => {
  const path='src/components/game/terrain-palette.ts';
  const source=fs.readFileSync(path,'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace('from "three"','from '+JSON.stringify(new URL('../node_modules/three/build/three.module.js',import.meta.url).href));
  const {createTerrainPalette}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const terrain=fs.readFileSync('src/components/game/terrain.tsx','utf8');
  const match=terrain.match(/const KIND_COLOR:[^=]+=(\s*\{[\s\S]*?\n\});/);
  assert(match);const colors=Function('return ('+match[1]+')')();
  const get=createTerrainPalette(colors), prior={enabled:ColorManagement.enabled,space:ColorManagement.workingColorSpace};
  try {
    for(const space of [LinearSRGBColorSpace,SRGBColorSpace,LinearSRGBColorSpace])for(const enabled of [true,false,true]){
      ColorManagement.enabled=enabled;ColorManagement.workingColorSpace=space;
      const palette=get();assert.equal(get(),palette);
      for(const [key,value]of Object.entries(colors)){
        assert.deepEqual(palette[key].toArray(),new Color().set(value).toArray());
        const scratch=new Color().copy(palette[key]);scratch.multiplyScalar(0);
        assert.deepEqual(palette[key].toArray(),new Color().set(value).toArray());
      }
      assert.equal(Object.keys(palette).length,Object.keys(colors).length);
    }
  }finally{ColorManagement.enabled=prior.enabled;ColorManagement.workingColorSpace=prior.space;}
});
